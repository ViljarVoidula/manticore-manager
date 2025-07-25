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


@models_router.get("/{model_name}", response_model=ModelInfo)
async def get_model_info(model_name: str):
    """Get information about a specific model."""
    try:
        model_info = model_manager.get_model_info(model_name)
        if not model_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Model {model_name} not found"
            )
        return model_info
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# Include the models router in the main embeddings router
router.include_router(models_router)
