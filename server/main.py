"""FastAPI server for Manticore Manager with embedding capabilities."""

import logging
from datetime import datetime
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
import httpx
import uvicorn

from .config import settings
from .routers.embeddings import router as embeddings_router
from .services.database_init import database_initializer


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Manticore Manager API",
    description="FastAPI server with embedding capabilities and Manticore Search proxy",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=settings.cors_methods,
    allow_headers=settings.cors_headers,
)

# Include routers
app.include_router(embeddings_router)


@app.get("/")
async def root():
    """Root endpoint that redirects to API documentation."""
    return RedirectResponse(url="/docs")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
async def manticore_proxy(path: str, request: Request):
    """
    Generic proxy for all Manticore Search operations.
    Forwards all /api/* requests to Manticore Search server.
    """
    try:
        # Build target URL
        target_url = f"http://{settings.manticore_host}:{settings.manticore_port}/{path}"
        
        # Get request data
        headers = dict(request.headers)
        query_params = dict(request.query_params)
        body = await request.body()
        
        # Remove hop-by-hop headers
        headers_to_remove = ["host", "connection", "upgrade", "proxy-connection"]
        for header in headers_to_remove:
            headers.pop(header, None)
        
        # Log the request
        logger.info(f"Proxying {request.method} {request.url.path} to Manticore Search")
        
        # Make the request to Manticore
        async with httpx.AsyncClient(timeout=settings.request_timeout) as client:
            response = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                params=query_params,
                content=body
            )
        
        # Prepare response headers
        response_headers = dict(response.headers)
        
        # Remove hop-by-hop headers from response
        response_headers.pop("connection", None)
        response_headers.pop("transfer-encoding", None)
        
        # Return the response
        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=response_headers,
            media_type=response_headers.get("content-type")
        )
        
    except httpx.TimeoutException:
        logger.error(f"Timeout connecting to Manticore Search at {settings.manticore_host}:{settings.manticore_port}")
        raise HTTPException(
            status_code=504,
            detail="Gateway timeout - Manticore Search is not responding"
        )
    except httpx.ConnectError:
        logger.error(f"Connection error to Manticore Search at {settings.manticore_host}:{settings.manticore_port}")
        raise HTTPException(
            status_code=502,
            detail="Bad gateway - Cannot connect to Manticore Search"
        )
    except Exception as e:
        logger.error(f"Proxy error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Proxy error: {str(e)}"
        )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler."""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "details": str(exc)}
    )


@app.on_event("startup")
async def startup_event():
    """Startup event handler."""
    logger.info("Starting Manticore Manager API server")
    logger.info(f"Server running at http://{settings.host}:{settings.port}")
    logger.info(f"API Documentation available at http://{settings.host}:{settings.port}/docs")
    logger.info(f"ReDoc Documentation available at http://{settings.host}:{settings.port}/redoc")
    logger.info(f"Proxying to Manticore Search at {settings.manticore_host}:{settings.manticore_port}")
    logger.info(f"CORS origins: {settings.cors_origins}")
    
    # Initialize database tables
    try:
        await database_initializer.initialize_database()
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}")
        # Don't fail startup if database init fails, just log the error


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event handler."""
    logger.info("Shutting down Manticore Manager API server")


if __name__ == "__main__":
    uvicorn.run(
        "server.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        log_level="info"
    )
