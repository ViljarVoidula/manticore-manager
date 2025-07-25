"""Service for generating embeddings."""

import time
import logging
from typing import List, Union, Optional
import numpy as np

from ..models.embeddings import (
    TextEmbeddingRequest, 
    ImageEmbeddingRequest, 
    EmbeddingResponse,
    ModelType
)
from ..config import settings
from .model_manager import model_manager


logger = logging.getLogger(__name__)


class EmbeddingService:
    """Service for generating embeddings from text and images."""
    
    def __init__(self):
        self.model_manager = model_manager
    
    async def generate_text_embeddings(self, request: TextEmbeddingRequest) -> EmbeddingResponse:
        """Generate embeddings for text input."""
        start_time = time.time()
        
        # Determine model to use
        model_name = request.model_name or settings.default_text_model
        
        # Ensure texts is a list
        texts = request.texts if isinstance(request.texts, list) else [request.texts]
        
        # Validate text length
        for text in texts:
            if len(text) > settings.max_text_length:
                raise ValueError(f"Text length {len(text)} exceeds maximum of {settings.max_text_length}")
        
        try:
            # Generate embeddings
            embeddings = await self.model_manager.get_embedding(
                model_name=model_name,
                content=texts,
                content_type=ModelType.TEXT
            )
            
            # Normalize if requested
            if request.normalize:
                embeddings = self._normalize_embeddings(embeddings)
            
            # Get model info for response
            model_info = self.model_manager.get_model_info(model_name)
            dimensions = model_info.dimensions if model_info else len(embeddings[0])
            
            processing_time = time.time() - start_time
            
            return EmbeddingResponse(
                embeddings=embeddings,
                model_name=model_name,
                dimensions=dimensions,
                processing_time=processing_time
            )
            
        except Exception as e:
            logger.error(f"Error generating text embeddings: {str(e)}")
            raise
    
    async def generate_image_embeddings(self, request: ImageEmbeddingRequest) -> EmbeddingResponse:
        """Generate embeddings for image input."""
        start_time = time.time()
        
        # Determine model to use
        model_name = request.model_name or settings.default_image_model
        
        # Ensure images is a list
        images = request.images if isinstance(request.images, list) else [request.images]
        
        try:
            # Generate embeddings
            embeddings = await self.model_manager.get_embedding(
                model_name=model_name,
                content=images,
                content_type=ModelType.IMAGE
            )
            
            # Normalize if requested
            if request.normalize:
                embeddings = self._normalize_embeddings(embeddings)
            
            # Get model info for response
            model_info = self.model_manager.get_model_info(model_name)
            dimensions = model_info.dimensions if model_info else len(embeddings[0])
            
            processing_time = time.time() - start_time
            
            return EmbeddingResponse(
                embeddings=embeddings,
                model_name=model_name,
                dimensions=dimensions,
                processing_time=processing_time
            )
            
        except Exception as e:
            logger.error(f"Error generating image embeddings: {str(e)}")
            raise
    
    async def generate_batch_embeddings(self, requests: List[Union[TextEmbeddingRequest, ImageEmbeddingRequest]]) -> List[EmbeddingResponse]:
        """Generate embeddings for a batch of requests."""
        if len(requests) > settings.max_batch_size:
            raise ValueError(f"Batch size {len(requests)} exceeds maximum of {settings.max_batch_size}")
        
        results = []
        for request in requests:
            if isinstance(request, TextEmbeddingRequest):
                result = await self.generate_text_embeddings(request)
            elif isinstance(request, ImageEmbeddingRequest):
                result = await self.generate_image_embeddings(request)
            else:
                raise ValueError(f"Unsupported request type: {type(request)}")
            
            results.append(result)
        
        return results
    
    def _normalize_embeddings(self, embeddings: List[List[float]]) -> List[List[float]]:
        """Normalize embeddings to unit vectors."""
        normalized = []
        for embedding in embeddings:
            embedding_array = np.array(embedding)
            norm = np.linalg.norm(embedding_array)
            if norm > 0:
                normalized_embedding = embedding_array / norm
            else:
                normalized_embedding = embedding_array
            normalized.append(normalized_embedding.tolist())
        
        return normalized


# Global embedding service instance
embedding_service = EmbeddingService()
