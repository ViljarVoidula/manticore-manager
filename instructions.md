# Manticore Manager - Development Instructions

## Overview

Manticore Manager is a React-based web application that provides a user-friendly interface for managing Manticore Search databases. This document contains comprehensive guidelines for development, styling, architecture, and best practices to ensure consistency and maintainability across the codebase.

## Table of Contents

1. [Project Architecture](#project-architecture)
2. [Technology Stack](#technology-stack)
3. [Development Guidelines](#development-guidelines)
4. [Styling and UI Standards](#styling-and-ui-standards)
5. [Mobile Responsiveness](#mobile-responsiveness)
6. [API Integration](#api-integration)
7. [State Management](#state-management)
8. [Error Handling](#error-handling)
9. [Code Review Checklist](#code-review-checklist)
10. [Common Patterns](#common-patterns)
11. [Performance Guidelines](#performance-guidelines)

## Project Architecture

### Directory Structure

```
src/
├── components/          # Reusable UI components
│   ├── breadcrumb/
│   ├── data-manager/
│   ├── layout/
│   ├── menu/
│   ├── sql-editor/
│   ├── table-creator/
│   ├── table-manager/
│   └── table-schema-editor/
├── config/             # Configuration files
├── contexts/           # React contexts
├── hooks/              # Custom React hooks
├── pages/              # Page components
│   ├── dashboard/
│   ├── sql/
│   └── tables/
├── providers/          # Data providers and API clients
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

### Component Organization

- **Pages**: Top-level route components that orchestrate the overall page layout
- **Components**: Reusable UI components that can be used across multiple pages
- **Providers**: Data layer abstractions that handle API communication
- **Types**: TypeScript interfaces and types for type safety
- **Utils**: Pure functions for common operations

## Technology Stack

### Core Technologies

- **React 18+**: UI framework with hooks and functional components
- **TypeScript**: Static typing for improved developer experience
- **Refine**: Data fetching and state management framework
- **React Router**: Client-side routing
- **Tailwind CSS**: Utility-first CSS framework
- **Vite**: Build tool and development server

### Backend Integration

- **Manticore Search**: Primary search engine
- **Python/FastAPI**: Backend API server
- **REST API**: Communication protocol

## Development Guidelines

### Component Standards

1. **Use Functional Components**: Always use functional components with hooks
2. **TypeScript**: All components must have proper TypeScript interfaces
3. **Props Interface**: Define clear interfaces for component props
4. **Default Props**: Use default parameters instead of defaultProps

```tsx
interface ComponentProps {
  title: string;
  isVisible?: boolean;
  onClose?: () => void;
}

const Component: React.FC<ComponentProps> = ({ 
  title, 
  isVisible = false, 
  onClose 
}) => {
  // Component implementation
};
```

### Hook Usage

1. **State Management**: Use `useState` for local component state
2. **Side Effects**: Use `useEffect` for side effects and cleanup
3. **Memoization**: Use `useMemo` and `useCallback` for performance optimization
4. **Custom Hooks**: Extract reusable logic into custom hooks

```tsx
const useTableData = (tableId: string) => {
  const [data, setData] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchTableData(tableId);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    if (tableId) {
      fetchData();
    }
  }, [tableId, fetchData]);

  return { data, loading, error, refetch: fetchData };
};
```

### Naming Conventions

- **Components**: PascalCase (e.g., `TableCreator`, `DataManager`)
- **Files**: kebab-case for component files (e.g., `table-creator.tsx`)
- **Variables**: camelCase (e.g., `tableData`, `isVisible`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)
- **Types/Interfaces**: PascalCase (e.g., `TableInfo`, `Document`)

## Styling and UI Standards

### Dark Mode Implementation

All components must support both light and dark themes using Tailwind's dark mode classes:

```tsx
// Correct dark mode styling
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
  <button className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600">
    Action
  </button>
</div>
```

### Color Palette

#### Background Colors
- **Light Mode**: `bg-white`, `bg-gray-50`, `bg-gray-100`
- **Dark Mode**: `dark:bg-gray-800`, `dark:bg-gray-900`, `dark:bg-gray-700`

#### Text Colors
- **Primary**: `text-gray-900 dark:text-white`
- **Secondary**: `text-gray-600 dark:text-gray-300`
- **Muted**: `text-gray-500 dark:text-gray-400`

#### Border Colors
- **Default**: `border-gray-200 dark:border-gray-700`
- **Input**: `border-gray-300 dark:border-gray-600`

#### Interactive Elements
- **Primary Button**: `bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600`
- **Success Button**: `bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600`
- **Danger Button**: `bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600`

### Form Components

#### Input Fields
```tsx
<input
  className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
/>
```

#### Select Elements
```tsx
<select
  className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
>
```

#### Textarea
```tsx
<textarea
  className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
/>
```

### Modal Design

```tsx
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          Modal Title
        </h3>
        <button className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          ✕
        </button>
      </div>
      {/* Modal content */}
    </div>
  </div>
</div>
```

### Table Styling

```tsx
<table className="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
  <thead className="bg-gray-50 dark:bg-gray-700">
    <tr>
      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-600">
        Header
      </th>
    </tr>
  </thead>
  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700">
        Cell content
      </td>
    </tr>
  </tbody>
</table>
```

## Mobile Responsiveness

The Manticore Manager application is designed to be fully responsive and mobile-friendly. All components must work seamlessly across desktop, tablet, and mobile devices.

### Mobile-First Approach

Use Tailwind CSS's mobile-first responsive design principles:

```tsx
// Mobile-first: default styles are for mobile, then add larger screen styles
<div className="p-4 lg:p-6">
  <h1 className="text-xl lg:text-3xl font-bold">
    Mobile-Responsive Title
  </h1>
</div>
```

### Responsive Breakpoints

Use Tailwind's standard responsive breakpoints:
- **Mobile**: Default (no prefix) - up to 640px
- **Small**: `sm:` - 640px and up
- **Medium**: `md:` - 768px and up
- **Large**: `lg:` - 1024px and up
- **Extra Large**: `xl:` - 1280px and up

### Navigation Patterns

#### Desktop Navigation
- Fixed sidebar navigation on large screens
- Full navigation menu visible

#### Mobile Navigation
- Collapsible hamburger menu
- Mobile header with brand and menu toggle
- Overlay navigation menu

```tsx
// Mobile header example
<div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
  <div className="flex items-center justify-between">
    <Link to="/" className="flex items-center">
      <span className="text-xl mr-2">🔍</span>
      <h1 className="text-lg font-bold text-gray-900 dark:text-white">
        Manticore
      </h1>
    </Link>
    
    <button
      onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
    >
      {/* Hamburger icon */}
    </button>
  </div>
</div>
```

### Layout Patterns

#### Tables and Data Display
- **Desktop**: Traditional table layout with columns
- **Mobile**: Card-based layout with stacked information

```tsx
// Responsive table pattern
<div className="lg:hidden space-y-4">
  {/* Mobile: Card layout */}
  {data.map((item) => (
    <div key={item.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
      <div className="space-y-2">
        {Object.entries(item).map(([key, value]) => (
          <div key={key}>
            <span className="text-xs font-medium text-gray-500 uppercase">{key}:</span>
            <div className="text-sm text-gray-900 dark:text-gray-100">{value}</div>
          </div>
        ))}
      </div>
    </div>
  ))}
</div>

<div className="hidden lg:block">
  {/* Desktop: Table layout */}
  <table className="min-w-full">
    {/* Table content */}
  </table>
</div>
```

#### Forms and Modals
- **Mobile**: Full-width modals with improved touch targets
- **Stack form elements vertically on small screens**

```tsx
// Responsive modal pattern
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
    <div className="p-4 lg:p-6">
      {/* Modal content */}
      <form className="space-y-3 lg:space-y-4">
        {/* Form fields */}
        <div className="flex flex-col sm:flex-row justify-end gap-3">
          <button className="w-full sm:w-auto">Cancel</button>
          <button className="w-full sm:w-auto">Submit</button>
        </div>
      </form>
    </div>
  </div>
</div>
```

#### Sidebars and Secondary Content
- **Desktop**: Fixed sidebars alongside main content
- **Mobile**: Hidden by default, toggleable overlay or bottom sections

```tsx
// Responsive sidebar pattern
<div className="flex-1 flex flex-col lg:flex-row">
  {/* Main content always visible */}
  <div className="flex-1 p-4 lg:p-6">
    {/* Main content */}
  </div>
  
  {/* Sidebar: hidden on mobile, visible on desktop */}
  <div className="hidden lg:block lg:w-80 bg-gray-50 dark:bg-gray-800 border-l">
    {/* Sidebar content */}
  </div>
  
  {/* Mobile alternative: bottom section */}
  <div className="lg:hidden bg-gray-50 dark:bg-gray-800 border-t p-4">
    {/* Mobile-friendly sidebar content */}
  </div>
</div>
```

### Touch and Interaction

#### Touch Targets
- Minimum 44px touch targets for buttons and interactive elements
- Use larger padding for mobile touch interfaces

```tsx
// Mobile-friendly button sizing
<button className="px-3 lg:px-4 py-2 text-sm lg:text-base">
  Action Button
</button>
```

#### Spacing and Typography
- Increase spacing on mobile for better readability
- Use responsive typography scales

```tsx
// Responsive spacing and typography
<div className="p-4 lg:p-6 space-y-3 lg:space-y-4">
  <h1 className="text-xl lg:text-3xl font-bold">
    Responsive Heading
  </h1>
  <p className="text-sm lg:text-base text-gray-600 dark:text-gray-300">
    Responsive body text with appropriate sizing.
  </p>
</div>
```

### Mobile-Specific Features

#### Back Navigation
- Add back buttons for mobile navigation depth
- Use breadcrumbs on desktop, simple back buttons on mobile

```tsx
// Mobile back button
<div className="lg:hidden bg-white dark:bg-gray-800 border-b px-4 py-2">
  <button
    onClick={() => navigate('/tables')}
    className="flex items-center text-blue-600 dark:text-blue-400"
  >
    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
    Back to Tables
  </button>
</div>
```

#### Gesture Support
- Implement swipe gestures where appropriate
- Use touch-friendly scroll areas

### Testing Mobile Responsiveness

1. **Browser DevTools**: Test using device simulation
2. **Real Devices**: Test on actual mobile devices
3. **Responsive Breakpoints**: Verify all breakpoints work correctly
4. **Touch Interactions**: Ensure all interactive elements are touch-friendly
5. **Performance**: Monitor performance on mobile devices

### Mobile Accessibility

1. **Focus Management**: Ensure proper focus management for mobile screen readers
2. **Touch Accessibility**: Maintain accessibility for touch interactions
3. **Zoom Support**: Ensure content works with mobile zoom levels
4. **Orientation**: Support both portrait and landscape orientations

## API Integration

### Refine Integration

Use Refine's data provider pattern for all API interactions:

```tsx
const { data, isLoading, error } = useList({
  resource: "tables",
  pagination: { current: 1, pageSize: 10 },
  queryOptions: { enabled: !!condition }
});

const { mutate: createResource } = useCreate();
const { mutate: updateResource } = useUpdate();
const { mutate: deleteResource } = useDelete();
const { mutate: customAction } = useCustomMutation();
```

### Error Handling Pattern

```tsx
const handleAction = async () => {
  try {
    await performAction();
    toastMessages.success();
  } catch (error) {
    toastMessages.generalError('action name', error);
    console.error('Action failed:', error);
  }
};
```

### Data Provider Standards

1. **Consistent Response Format**: Ensure all API responses follow a consistent structure
2. **Error Handling**: Implement proper error handling with meaningful messages
3. **Loading States**: Always provide loading indicators for async operations
4. **Type Safety**: Use TypeScript interfaces for all API responses

```tsx
// Data provider method example
const getTables = async (): Promise<TableInfo[]> => {
  try {
    const response = await fetch('/api/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Failed to fetch tables:', error);
    throw error;
  }
};
```

## State Management

### Local State

Use `useState` for component-local state:

```tsx
const [isLoading, setIsLoading] = useState(false);
const [formData, setFormData] = useState<FormData>({});
const [errors, setErrors] = useState<Record<string, string>>({});
```

### Shared State

Use React Context for shared state across components:

```tsx
interface AppContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  user: User | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};
```

### Data Fetching

Use Refine's hooks for server state management:

```tsx
const { data: tables, isLoading, error, refetch } = useList({
  resource: 'tables',
  queryOptions: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  }
});
```

## Error Handling

### Error Boundaries

Implement error boundaries for graceful error handling:

```tsx
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Something went wrong
            </h1>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Toast Messages

Use the centralized toast utility for user feedback:

```tsx
import { toastMessages } from '../utils/toast';

// Success messages
toastMessages.tableCreated();
toastMessages.documentUpdated();

// Error messages
toastMessages.generalError('operation name', error);

// Custom messages
toastMessages.custom('Custom message', 'success');

// Confirmation dialogs
await toastMessages.confirmDelete('item name', deleteAction, 'item type');
```

### Loading States

Always provide loading indicators:

```tsx
const Component = () => {
  const { data, isLoading, error } = useList({ resource: 'tables' });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 dark:text-red-400">
          Error loading data: {error.message}
        </p>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return <div>{/* Render data */}</div>;
};
```

## Code Review Checklist

### Functionality
- [ ] Component renders correctly in both light and dark modes
- [ ] All interactive elements are accessible via keyboard
- [ ] Loading states are shown during async operations
- [ ] Error states are handled gracefully
- [ ] Form validation provides clear feedback

### Code Quality
- [ ] TypeScript interfaces are properly defined
- [ ] No any types used without justification
- [ ] Components are properly memoized if needed
- [ ] Custom hooks are used for reusable logic
- [ ] Console.log statements are removed or replaced with proper logging

### Styling
- [ ] Consistent color palette usage
- [ ] Proper dark mode support
- [ ] Focus states are visible and accessible
- [ ] Hover states provide appropriate feedback

### Mobile Responsiveness
- [ ] Component works correctly on mobile devices (< 640px)
- [ ] Touch targets are at least 44px for interactive elements
- [ ] Text is readable without horizontal scrolling
- [ ] Tables use card layout on mobile when appropriate
- [ ] Navigation is accessible on mobile (hamburger menu, back buttons)
- [ ] Modals and forms are mobile-friendly with proper spacing
- [ ] Sidebars collapse appropriately on smaller screens
- [ ] Images and content scale properly across breakpoints

### UX/UI Design
- [ ] Visual hierarchy is clear and logical
- [ ] Information architecture supports user goals
- [ ] Actions are grouped logically (create, read, update, delete)
- [ ] Destructive actions have appropriate warnings and confirmations
- [ ] Loading states provide meaningful feedback
- [ ] Form fields have clear labels and validation messages
- [ ] Color coding is consistent and meaningful (success/warning/error)
- [ ] Icons and visual cues support the content effectively

### Table Schema Editor Specific
- [ ] Current schema is clearly visible alongside actions
- [ ] Add/Modify/Drop operations are visually distinct
- [ ] Vector configuration appears only when relevant
- [ ] Field validation prevents invalid operations
- [ ] Destructive operations show clear warnings
- [ ] Mobile layout uses appropriate panel stacking
- [ ] Action buttons provide clear feedback during operations

### Performance
- [ ] Unnecessary re-renders are avoided
- [ ] Large lists are virtualized if needed
- [ ] Images are optimized and have alt text
- [ ] API calls are debounced where appropriate

### Security
- [ ] User input is properly sanitized
- [ ] XSS vulnerabilities are prevented
- [ ] Sensitive data is not logged to console
- [ ] API endpoints are validated

## Common Patterns

### Async Data Loading

```tsx
const useAsyncData = <T>(fetcher: () => Promise<T>, deps: unknown[] = []) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};
```

### Form Handling

```tsx
const useForm = <T extends Record<string, unknown>>(initialData: T) => {
  const [formData, setFormData] = useState<T>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = useCallback((field: keyof T, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field as string]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  const validate = useCallback((rules: Record<keyof T, (value: unknown) => string | undefined>) => {
    const newErrors: Record<string, string> = {};
    Object.keys(rules).forEach(field => {
      const error = rules[field](formData[field]);
      if (error) {
        newErrors[field] = error;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const reset = useCallback(() => {
    setFormData(initialData);
    setErrors({});
  }, [initialData]);

  return { formData, errors, updateField, validate, reset };
};
```

### Modal Management

```tsx
const useModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<unknown>(null);

  const openModal = useCallback((modalData?: unknown) => {
    setData(modalData);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setData(null);
  }, []);

  return { isOpen, data, openModal, closeModal };
};
```

## Performance Guidelines

### React Performance

1. **Memoization**: Use `React.memo` for components that render frequently
2. **Callback Optimization**: Use `useCallback` for event handlers passed to child components
3. **Value Optimization**: Use `useMemo` for expensive calculations
4. **Virtual Scrolling**: Implement virtual scrolling for large data sets

### Bundle Size

1. **Code Splitting**: Use dynamic imports for route-based code splitting
2. **Tree Shaking**: Ensure unused code is eliminated during build
3. **Dependency Analysis**: Regularly audit bundle size with tools like webpack-bundle-analyzer

### API Performance

1. **Debouncing**: Debounce search inputs and API calls
2. **Caching**: Use appropriate cache strategies for data that doesn't change frequently
3. **Pagination**: Implement pagination for large data sets
4. **Compression**: Enable gzip compression on API responses

## Testing Guidelines

### Unit Testing

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Component } from './Component';

describe('Component', () => {
  it('renders correctly', () => {
    render(<Component title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('handles user interaction', () => {
    const onClickMock = jest.fn();
    render(<Component onClick={onClickMock} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(onClickMock).toHaveBeenCalledTimes(1);
  });
});
```

### Integration Testing

Test components with their data providers and context:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};
```

## Deployment and Build

### Environment Configuration

Use environment variables for configuration:

```typescript
// config/environment.ts
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};
```

### Build Optimization

1. **Assets**: Optimize images and static assets
2. **Minification**: Ensure JavaScript and CSS are minified
3. **Source Maps**: Include source maps for debugging in production
4. **Cache Headers**: Set appropriate cache headers for static assets

## Troubleshooting

### Common Issues

1. **Dark Mode Not Working**: Ensure all elements have both light and dark classes
2. **API Errors**: Check network tab and server logs for detailed error messages
3. **Type Errors**: Ensure all TypeScript interfaces are properly defined
4. **Performance Issues**: Use React DevTools Profiler to identify bottlenecks

### Debugging Tools

1. **React DevTools**: For component inspection and profiling
2. **Network Tab**: For API request/response debugging
3. **Console Logs**: Strategic logging for data flow understanding
4. **Error Boundaries**: Graceful error handling and reporting

## Contributing

1. **Branch Naming**: Use descriptive branch names (e.g., `feature/table-creator`, `fix/dark-mode-styling`)
2. **Commit Messages**: Write clear, descriptive commit messages
3. **Pull Requests**: Include screenshots for UI changes and test your changes thoroughly
4. **Code Review**: Address all feedback and ensure tests pass before merging

## Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Refine Documentation](https://refine.dev/docs/)
- [Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Manticore Search Documentation](https://manticoresearch.com/docs/)

## Table Schema Editor UX Guidelines

### Design Principles

The Table Schema Editor has been redesigned to provide a clear, intuitive experience for managing database schemas. The following principles guide the UX:

#### 1. Split-Panel Layout
- **Left Panel**: Current Schema Overview
  - Visual representation of existing columns
  - Color-coded column types with icons
  - Highlighted primary columns (id)
  - Quick reference for column properties
- **Right Panel**: Schema Actions
  - Tabbed interface for Add/Modify/Drop operations
  - Context-specific guidance and warnings
  - Clear action buttons with visual feedback

#### 2. Visual Hierarchy
- **Color-coded Actions**: Green (Add), Blue (Modify), Red (Drop)
- **Informational Panels**: Each action type has a descriptive header with context
- **Progressive Disclosure**: Vector configuration appears only when needed
- **Clear Separation**: Visual boundaries between schema review and actions

#### 3. Enhanced Form Design
- **Larger Input Fields**: Improved touch targets for mobile
- **Better Labels**: Descriptive labels with contextual help
- **Validation Feedback**: Clear error states and requirements
- **Loading States**: Animated indicators during operations

#### 4. Mobile Optimization
- **Responsive Grid**: Single column layout on mobile devices
- **Touch-Friendly**: Larger buttons and input areas
- **Simplified Navigation**: Tab interface adapts to smaller screens
- **Overflow Handling**: Proper scrolling for long content

#### 5. Safety Features
- **Destructive Action Warnings**: Clear warnings for drop operations
- **Confirmation States**: Preview of changes before execution
- **Protected Columns**: Visual indication of non-deletable columns
- **Backup Reminders**: Contextual warnings about data safety

### Implementation Notes

#### Vector Configuration
- **Smart Disclosure**: Configuration panel appears only for vector columns
- **Guided Setup**: Helper text explains each parameter
- **Default Values**: Sensible defaults for common use cases
- **Visual Cues**: Purple color scheme distinguishes vector features

#### Action Buttons
- **Consistent Sizing**: All action buttons use same dimensions
- **Loading States**: Spinner animations during processing
- **Icon Usage**: Emojis provide quick visual reference
- **Disabled States**: Clear indication when actions are unavailable

#### Error Prevention
- **Field Validation**: Real-time validation of required fields
- **Type Checking**: Appropriate options based on column types
- **Constraint Awareness**: UI prevents invalid operations
- **User Guidance**: Helpful tooltips and descriptions

### Persistent State

#### Theme Preferences

The application automatically persists user theme preferences (light/dark mode) to localStorage:

```tsx
// Theme utilities handle persistence automatically
import { useTheme } from '../hooks/useTheme';

const MyComponent = () => {
  const { theme, toggleTheme, setTheme } = useTheme();
  
  return (
    <button onClick={toggleTheme}>
      Switch to {theme === 'light' ? 'dark' : 'light'} mode
    </button>
  );
};
```

**Key Features:**
- **Automatic Persistence**: Theme preference is saved to localStorage with key `manticore-manager-theme`
- **System Detection**: Falls back to system preference if no saved theme exists
- **Error Handling**: Graceful fallback if localStorage is unavailable
- **Type Safety**: Strict typing ensures only valid theme values are stored

**Storage Key:** `manticore-manager-theme`

**Implementation Details:**
```tsx
// Theme utility functions in src/utils/theme.ts
export const getStoredTheme = (): Theme | null => { /* ... */ };
export const saveTheme = (theme: Theme): void => { /* ... */ };
export const getInitialTheme = (): Theme => { /* ... */ };
```

#### Adding New Persistent State

When adding new persistent state, follow these patterns:

1. **Create utility functions** for get/set operations
2. **Add error handling** for localStorage failures  
3. **Provide fallbacks** for when storage is unavailable
4. **Use TypeScript** for type safety
5. **Choose unique keys** prefixed with `manticore-manager-`

```tsx
// Example: Persistent user preferences
const PREFERENCES_KEY = 'manticore-manager-preferences';

export const getStoredPreferences = (): UserPreferences | null => {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const savePreferences = (preferences: UserPreferences): void => {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.warn('Failed to save preferences:', error);
  }
};
```
