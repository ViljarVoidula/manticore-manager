# Manticore Manager

A modern database management UI for Manticore Search built with React and Refine.dev, featuring advanced embedding capabilities through a FastAPI backend.

## Features

- 🔍 **Table Management**: View and explore Manticore Search tables with detailed schema information
- 📝 **SQL Query Editor**: Execute SQL queries with syntax highlighting and result visualization
- 📊 **Dynamic Results Display**: View query results in formatted tables with export capabilities
- 🎯 **Real-time Search**: Perform full-text searches with advanced filtering options
- 🤖 **AI Embeddings**: Generate and manage embeddings for text and images using state-of-the-art models
- 🚀 **Modern UI**: Clean, responsive interface built with Tailwind CSS
- 🔄 **Smart Proxy**: FastAPI backend that seamlessly proxies Manticore Search with additional AI capabilities

## Architecture

This application consists of three main components:

1. **Frontend (React/Vite)**: Runs on port 7600
2. **Python FastAPI Server**: Runs on port 3001, provides embedding capabilities and proxies Manticore Search
3. **Manticore Search**: Runs on port 9308

### Request Flow

```
Frontend (7600) → Python Server (3001) → Manticore Search (9308)
                      ↓
                Embedding Services
```

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Python 3.8+
- Manticore Search instance running (default: http://127.0.0.1:9308)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd manticore-manager
```

2. Install frontend dependencies:
```bash
pnpm install
```

3. Install Python dependencies:
```bash
npm run server:install
# or manually:
# pip install -r server/requirements.txt
```

4. Start both servers in development mode:
```bash
npm run dev:full
```

This will start:
- Python FastAPI server on http://localhost:3001
- React frontend on http://localhost:7600

Alternatively, you can start them separately:

```bash
# Terminal 1: Start Python server
npm run server:dev

# Terminal 2: Start frontend
npm run dev
```

### Running Manticore Search

You can use the provided Docker Compose file to run Manticore Search:

```bash
docker-compose -f docker-compose.dev.yaml up -d
```

This will:
- Start Manticore Search on ports 9306 (MySQL), 9308 (HTTP API), and 9312 (SphinxQL)
- Mount a persistent volume for data storage

### Core Components

- **FastAPI Backend**: Handles embedding generation, model management, and proxies Manticore Search API
- **ManticoreDataProvider**: Custom Refine.dev data provider implementing Manticore Search API
- **SqlEditor**: Code editor component for executing raw SQL queries
- **TableManager**: Interface for browsing tables and viewing schema information
- **Dashboard**: Main application layout combining all features
- **Embedding Services**: AI-powered text and image embedding generation

### API Integration

The application uses a multi-layered API approach:

#### Frontend → Python Server
- `/manticore/*` - Proxied to Manticore Search via `/api/*`
- `/embeddings/*` - AI embedding services
- `/api/*` - Direct proxy to Manticore Search

#### Python Server → Manticore Search
- `/search` - Full-text search and document retrieval
- `/insert` - Document insertion
- `/update` - Document updates
- `/delete` - Document deletion
- `/sql` - Raw SQL query execution

#### Embedding Services
- `/embeddings/text` - Generate text embeddings
- `/embeddings/image` - Generate image embeddings
- `/embeddings/models` - List available models

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
├── src/                  # React frontend
│   ├── types/           # TypeScript type definitions
│   ├── providers/       # Custom data provider
│   ├── components/      # Reusable UI components
│   ├── pages/          # Application pages
│   ├── config/         # Environment configuration
│   └── App.tsx         # Main application entry
├── server/              # Python FastAPI backend
│   ├── main.py         # FastAPI application
│   ├── config.py       # Server configuration
│   ├── run.py          # Development server runner
│   ├── models/         # AI model management
│   ├── routers/        # API route handlers
│   ├── services/       # Business logic services
│   └── requirements.txt # Python dependencies
├── vite.config.ts      # Vite configuration with proxy setup
└── package.json        # Frontend dependencies and scripts
```

### Development Workflow

1. **Frontend Development**: 
   - The Vite dev server proxies `/manticore` and `/embeddings` requests to the Python server
   - Hot reloading for React components
   - TypeScript compilation and error checking

2. **Backend Development**:
   - FastAPI with auto-reload for Python changes
   - Automatic API documentation at http://localhost:3001/docs
   - Proxies all `/api/*` requests to Manticore Search

3. **Full Stack Development**:
   - Use `npm run dev:full` to start both servers concurrently
   - Frontend accessible at http://localhost:7600
   - Backend API docs at http://localhost:3001/docs

### Environment Configuration

The application automatically detects development vs production:

- **Development**: Uses Vite proxy to route requests through the Python server
- **Production**: Configurable via environment variables

Set these environment variables for production:
```bash
VITE_MANTICORE_PROXY_URL=/api
VITE_EMBEDDINGS_URL=/embeddings
```

### Adding New Features

1. **New Query Types**: Extend the `QueryFilter` interface in `types/manticore.ts`
2. **UI Components**: Create components in `components/` following the existing patterns
3. **API Integration**: Update the data provider methods as needed
4. **Embedding Models**: Add new models in `server/models/` and update the model manager
5. **API Endpoints**: Create new routers in `server/routers/` for additional functionality

## Vector Column Management

The system now includes automatic vector column metadata management. When the server starts, it will:

1. **Check for metadata table**: Verify that `manager_vector_column_settings` table exists
2. **Create if missing**: Automatically create the table with the following schema:
   - `id`: Unique identifier
   - `table_name`: Name of the table containing the vector column
   - `column_name`: Name of the vector column
   - `model_name`: Name of the model used for embeddings
   - `dimensions`: Number of dimensions in the vector
   - `knn_type`: KNN algorithm type (e.g., "HNSW")
   - `similarity_metric`: Similarity metric (e.g., "L2", "cosine")
   - `combined_fields`: JSON field storing weighted field configurations for multi-field embeddings
   - `created_at`: Timestamp when the column was registered
   - `updated_at`: Timestamp when the column was last updated

### Vector Column API Endpoints

- `POST /embeddings/vector-columns/register`: Register a new vector column
- `GET /embeddings/vector-columns/tables`: List all tables with vector columns
- `GET /embeddings/vector-columns/tables/{table_name}/columns`: Get vector columns for a table
- `GET /embeddings/vector-columns/tables/{table_name}/columns/{column_name}`: Get specific column info

### Example Usage

```bash
# Register a simple vector column
curl -X POST "http://localhost:3001/embeddings/vector-columns/register" \
  -H "Content-Type: application/json" \
  -d '{
    "table_name": "products",
    "column_name": "description_vector",
    "model_name": "sentence-transformers/all-MiniLM-L6-v2",
    "knn_type": "HNSW",
    "similarity_metric": "L2"
  }'

# Register a combined vector column with weighted fields
curl -X POST "http://localhost:3001/embeddings/vector-columns/register" \
  -H "Content-Type: application/json" \
  -d '{
    "table_name": "products",
    "column_name": "combined_vector",
    "model_name": "openai/clip-vit-base-patch32",
    "knn_type": "HNSW",
    "similarity_metric": "L2",
    "combined_fields": {
      "weights": {
        "product_image": 0.6,
        "product_description": 0.4
      }
    }
  }'

# List vector tables
curl "http://localhost:3001/embeddings/vector-columns/tables"

# Get table vector columns
curl "http://localhost:3001/embeddings/vector-columns/tables/products/columns"
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
