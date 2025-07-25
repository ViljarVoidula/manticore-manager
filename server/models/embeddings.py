"""Pydantic models for embedding operations."""

from pydantic import BaseModel, Field
from typing import List, Union, Optional, Dict, Any
from enum import Enum


class ModelType(str, Enum):
    """Supported model types."""
    TEXT = "text"
    IMAGE = "image"
    MULTIMODAL = "multimodal"


class CombineMethod(str, Enum):
    """Methods for combining multiple field embeddings."""
    WEIGHTED_AVERAGE = "weighted_average"
    CONCATENATE = "concatenate"
    MAX_POOL = "max_pool"
    SUM = "sum"


class FieldInput(BaseModel):
    """Input for a single field in multi-field embedding generation."""
    content: str = Field(..., description="Content to embed for this field")
    type: ModelType = Field(..., description="Type of content (text, image, multimodal)")
    weight: float = Field(1.0, description="Weight for this field in combination")
    model_name: Optional[str] = Field(None, description="Specific model to use for this field")


class TextEmbeddingRequest(BaseModel):
    """Request model for text embedding generation."""
    texts: List[str] = Field(..., description="List of texts to embed")
    model_name: Optional[str] = Field(None, description="Model name to use for embedding")
    normalize: bool = Field(True, description="Whether to normalize embeddings")


class ImageEmbeddingRequest(BaseModel):
    """Request model for image embedding generation."""
    images: List[str] = Field(..., description="List of image paths or base64 encoded images")
    model_name: Optional[str] = Field(None, description="Model name to use for embedding")
    normalize: bool = Field(True, description="Whether to normalize embeddings")


class MultiFieldEmbeddingRequest(BaseModel):
    """Request model for multi-field embedding generation."""
    fields: List[FieldInput] = Field(..., description="List of field inputs to combine")
    combine_method: CombineMethod = Field(CombineMethod.WEIGHTED_AVERAGE, description="Method to combine field embeddings")
    normalize: bool = Field(True, description="Whether to normalize final embeddings")
    combine_method: Optional[CombineMethod] = Field(
        CombineMethod.WEIGHTED_AVERAGE, description="Method to combine multiple field embeddings"
    )


class BatchEmbeddingRequest(BaseModel):
    """Request model for batch embedding generation."""
    requests: List[Union[TextEmbeddingRequest, ImageEmbeddingRequest, MultiFieldEmbeddingRequest]] = Field(
        ..., description="List of embedding requests to process in batch"
    )


class EmbeddingResponse(BaseModel):
    """Response model for embedding generation."""
    embeddings: List[List[float]] = Field(..., description="Generated embeddings")
    model_name: str = Field(..., description="Name of the model used")
    dimensions: int = Field(..., description="Dimension size of embeddings")
    processing_time: float = Field(..., description="Time taken to process in seconds")
    count: int = Field(..., description="Number of embeddings generated")
    
    def __init__(self, **data):
        # Auto-calculate count if not provided
        if 'count' not in data and 'embeddings' in data:
            data['count'] = len(data['embeddings'])
        super().__init__(**data)


class ModelInfo(BaseModel):
    """Information about an available model."""
    name: str = Field(..., description="Model name")
    type: ModelType = Field(..., description="Model type")
    dimensions: int = Field(..., description="Embedding dimensions")
    is_loaded: bool = Field(..., description="Whether model is currently loaded")
    description: Optional[str] = Field(None, description="Model description")


class ModelListResponse(BaseModel):
    """Response model for listing available models."""
    models: List[ModelInfo] = Field(..., description="List of available models")
    total_memory_usage: Optional[float] = Field(None, description="Total memory usage in MB")
    available_models: Optional[List[str]] = Field(None, description="List of available model names")


class ModelLoadRequest(BaseModel):
    """Request model for loading a model."""
    model_name: str = Field(..., description="Name of the model to load")
    model_type: Optional[ModelType] = Field(None, description="Type of the model to load")
    force_reload: bool = Field(False, description="Whether to force reload if already loaded")


class ErrorResponse(BaseModel):
    """Error response model."""
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Detailed error information")
    code: Optional[str] = Field(None, description="Error code")
