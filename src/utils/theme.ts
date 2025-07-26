/**
 * Theme utilities for managing dark/light mode preferences
 */

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'manticore-manager-theme';

/**
 * Get the user's theme preference from localStorage
 */
export const getStoredTheme = (): Theme | null => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch (error) {
    console.warn('Failed to read theme from localStorage:', error);
  }
  return null;
};

/**
 * Save the theme preference to localStorage
 */
export const saveTheme = (theme: Theme): void => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.warn('Failed to save theme to localStorage:', error);
  }
};

/**
 * Get the system's preferred color scheme
 */
export const getSystemTheme = (): Theme => {
  try {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  } catch (error) {
    console.warn('Failed to detect system theme:', error);
  }
  return 'light'; // Default fallback
};

/**
 * Get the initial theme preference with fallback chain:
 * 1. User's stored preference
 * 2. System preference
 * 3. Light mode (default)
 */
export const getInitialTheme = (): Theme => {
  const storedTheme = getStoredTheme();
  if (storedTheme) {
    return storedTheme;
  }
  
  const systemTheme = getSystemTheme();
  // Save the system preference for future use
  saveTheme(systemTheme);
  return systemTheme;
};

/**
 * Apply theme to the document
 */
export const applyTheme = (theme: Theme): void => {
  try {
    if (typeof document !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  } catch (error) {
    console.warn('Failed to apply theme to document:', error);
  }
};

/**
 * Listen for system theme changes
 */
export const createSystemThemeListener = (callback: (theme: Theme) => void): (() => void) => {
  try {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = (e: MediaQueryListEvent) => {
        const systemTheme = e.matches ? 'dark' : 'light';
        callback(systemTheme);
      };
      
      mediaQuery.addEventListener('change', handleChange);
      
      // Return cleanup function
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }
  } catch (error) {
    console.warn('Failed to create system theme listener:', error);
  }
  
  return () => {
    // No-op cleanup function
  };
};
