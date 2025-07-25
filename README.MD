# Manticore Manager

A modern database management UI for Manticore Search built with React and Refine.dev.

## Features

- 🔍 **Table Management**: View and explore Manticore Search tables with detailed schema information
- 📝 **SQL Query Editor**: Execute SQL queries with syntax highlighting and result visualization
- 📊 **Dynamic Results Display**: View query results in formatted tables with export capabilities
- 🎯 **Real-time Search**: Perform full-text searches with advanced filtering options
- 🚀 **Modern UI**: Clean, responsive interface built with Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Manticore Search instance running (default: http://127.0.0.1:9308)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd manticore-manager
```

2. Install dependencies:
```bash
pnpm install
```

3. Start the development server:
```bash
pnpm dev
```

4. Open your browser and navigate to `http://localhost:3000`

### Running Manticore Search

You can use the provided Docker Compose file to run Manticore Search:

```bash
docker-compose -f docker-compose.dev.yaml up -d
```

This will:
- Start Manticore Search on ports 9306 (MySQL), 9308 (HTTP API), and 9312 (SphinxQL)
- Mount a persistent volume for data storage

## Architecture

### Core Components

- **ManticoreDataProvider**: Custom Refine.dev data provider implementing Manticore Search API
- **SqlEditor**: Code editor component for executing raw SQL queries
- **TableManager**: Interface for browsing tables and viewing schema information
- **Dashboard**: Main application layout combining all features

### API Integration

The application connects to Manticore Search via its HTTP JSON API:
- `/search` - Full-text search and document retrieval
- `/insert` - Document insertion
- `/update` - Document updates
- `/delete` - Document deletion
- `/sql` - Raw SQL query execution

### Key Features

1. **Table Discovery**: Automatically discovers available tables using `SHOW TABLES`
2. **Schema Inspection**: Retrieves table structure with `DESCRIBE table_name`
3. **Query Building**: Translates Refine filters/sorters to Manticore query format
4. **Error Handling**: Comprehensive error handling and user feedback
5. **Type Safety**: Full TypeScript support with Manticore API types

## Usage

### SQL Query Execution

1. Navigate to the SQL Editor panel
2. Enter your SQL query (supports all Manticore SQL syntax)
3. Press Ctrl+Enter or click "Execute Query"
4. View results in the formatted table below

### Table Management

1. The Table Manager automatically loads available tables
2. Click on any table to view its schema and column information
3. Use the refresh button to reload table list

### Search and Filtering

The application supports Manticore's powerful search capabilities:
- Full-text search with `MATCH` queries
- Range filtering
- Boolean queries with AND/OR/NOT logic
- Geo-distance searches
- Aggregations and faceting

## Development

### Project Structure

```
src/
├── types/           - TypeScript type definitions
├── providers/       - Custom data provider
├── components/      - Reusable UI components
├── pages/          - Application pages
└── App.tsx         - Main application entry
```

### Adding New Features

1. **New Query Types**: Extend the `QueryFilter` interface in `types/manticore.ts`
2. **UI Components**: Create components in `components/` following the existing patterns
3. **API Integration**: Update the data provider methods as needed

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
