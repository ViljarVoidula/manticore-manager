"""API routes for embedding operations."""

from fastapi import APIRouter, HTTPException, status
from typing import List, Union

from ..models.embeddings import (
    TextEmbeddingRequest,
    ImageEmbeddingRequest,
    MultiFieldEmbeddingRequest,
    BatchEmbeddingRequest,
    EmbeddingResponse,
    ModelInfo,
    ModelListResponse,
    ModelLoadRequest,
    ErrorResponse
)
from ..services.embedding_service import embedding_service
from ..services.multi_field_service import multi_field_service
from ..services.model_manager import model_manager
from ..services.database_init import database_initializer


router = APIRouter(prefix="/embeddings", tags=["embeddings"])


@router.post("/text", response_model=EmbeddingResponse)
async def generate_text_embeddings(request: TextEmbeddingRequest):
    """Generate embeddings for text input."""
    try:
        return await embedding_service.generate_text_embeddings(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/image", response_model=EmbeddingResponse)
async def generate_image_embeddings(request: ImageEmbeddingRequest):
    """Generate embeddings for image input."""
    try:
        return await embedding_service.generate_image_embeddings(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/multi-field", response_model=EmbeddingResponse)
async def generate_multi_field_embeddings(request: MultiFieldEmbeddingRequest):
    """Generate combined embeddings from multiple fields with weights."""
    try:
        return await multi_field_service.generate_multi_field_embeddings(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/batch", response_model=List[EmbeddingResponse])
async def generate_batch_embeddings(request: BatchEmbeddingRequest):
    """Generate embeddings for a batch of requests."""
    try:
        return await embedding_service.generate_batch_embeddings(request.requests)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# Model management routes
models_router = APIRouter(prefix="/models", tags=["models"])


@models_router.get("", response_model=ModelListResponse)
async def list_models():
    """List all models and their status."""
    try:
        models = model_manager.list_models()
        available_models = model_manager.get_available_models()
        total_memory = model_manager.get_total_memory_usage()
        
        return ModelListResponse(
            models=models,
            total_memory_usage=total_memory,
            available_models=available_models
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@models_router.post("/load", response_model=ModelInfo)
async def load_model(request: ModelLoadRequest):
    """Load a specific model."""
    try:
        return await model_manager.load_model(
            model_name=request.model_name,
            model_type=request.model_type,
            force_reload=request.force_reload
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@models_router.delete("/{model_name}")
async def unload_model(model_name: str):
    """Unload a specific model."""
    try:
        success = await model_manager.unload_model(model_name)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Model {model_name} not found"
            )
        return {"message": f"Model {model_name} unloaded successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@models_router.get("/{model_name:path}", response_model=ModelInfo)
async def get_model_info(model_name: str):
    """Get information about a specific model."""
    import urllib.parse
    # Decode URL-encoded model_name
    decoded_name = urllib.parse.unquote(model_name)
    # Try exact match first
    model_info = model_manager.get_model_info(decoded_name)
    # If not found, try case-insensitive match
    if not model_info:
        for available in model_manager.get_available_models():
            if available.lower() == decoded_name.lower():
                model_info = model_manager.get_model_info(available)
                break
    if not model_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model {decoded_name} not found"
        )
    return model_info


# Vector column management routes
vector_router = APIRouter(prefix="/vector-columns", tags=["vector-columns"])


@vector_router.post("/register")
async def register_vector_column(
    table_name: str,
    column_name: str,
    model_name: str,
    combined_fields: dict = None
):
    """Register a vector column with its model and settings.
    
    combined_fields example:
    {
        "weights": {"image_field": 0.6, "text_field": 0.4}
    }
    """
    try:
        await model_manager.save_vector_column_metadata(
            table_name=table_name,
            column_name=column_name,
            model_name=model_name,
            combined_fields=combined_fields
        )
        return {
            "message": f"Vector column {table_name}.{column_name} registered successfully",
            "table_name": table_name,
            "column_name": column_name,
            "model_name": model_name,
            "dimensions": model_manager.get_model_dimensions(model_name),
            "combined_fields": combined_fields
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@vector_router.get("/tables")
async def list_vector_tables():
    """List all tables with vector columns."""
    try:
        tables = await model_manager.list_vector_tables()
        return {"tables": tables}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@vector_router.get("/tables/{table_name}/columns")
async def get_table_vector_columns(table_name: str):
    """Get all vector columns for a specific table."""
    try:
        columns = await model_manager.get_table_vector_columns(table_name)
        return {"table_name": table_name, "vector_columns": columns}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@vector_router.get("/tables/{table_name}/columns/{column_name}")
async def get_vector_column_info(table_name: str, column_name: str):
    """Get information about a specific vector column."""
    try:
        column_info = await model_manager.get_vector_column_metadata(table_name, column_name)
        if not column_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Vector column {table_name}.{column_name} not found"
            )
        return column_info
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@vector_router.delete("/tables/{table_name}/columns/{column_name}")
async def delete_vector_column_settings(table_name: str, column_name: str):
    """Delete vector column settings."""
    try:
        await database_initializer.delete_vector_column_settings(table_name, column_name)
        return {
            "message": f"Vector column settings for {table_name}.{column_name} deleted successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@vector_router.delete("/tables/{table_name}")
async def delete_table_vector_settings(table_name: str):
    """Delete all vector column settings for a table."""
    try:
        await database_initializer.delete_table_vector_settings(table_name)
        return {
            "message": f"All vector column settings for table {table_name} deleted successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# Include the models router in the main embeddings router
router.include_router(models_router)

# Include the vector router in the main embeddings router
router.include_router(vector_router)
