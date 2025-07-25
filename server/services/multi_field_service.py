"""Service for generating multi-field embeddings with weights."""

import time
import logging
from typing import List, Dict, Any
import numpy as np

from ..models.embeddings import (
    MultiFieldEmbeddingRequest,
    FieldInput,
    EmbeddingResponse,
    ModelType
)
from ..config import settings
from .model_manager import model_manager


logger = logging.getLogger(__name__)


class MultiFieldService:
    """Service for generating weighted multi-field embeddings."""
    
    def __init__(self):
        self.model_manager = model_manager
    
    async def generate_multi_field_embeddings(self, request: MultiFieldEmbeddingRequest) -> EmbeddingResponse:
        """Generate combined embeddings from multiple fields with weights."""
        start_time = time.time()
        
        try:
            # Generate embeddings for each field
            field_embeddings = []
            field_weights = []
            used_models = []
            
            for field in request.fields:
                # Determine model to use for this field
                if field.model_name:
                    model_name = field.model_name
                else:
                    model_name = self._get_default_model_for_type(field.type)
                
                # Generate embedding for this field
                embedding = await self.model_manager.get_embedding(
                    model_name=model_name,
                    content=[field.content],
                    content_type=field.type
                )
                
                field_embeddings.append(embedding[0])  # Get first (and only) embedding
                field_weights.append(field.weight)
                used_models.append(model_name)
            
            # Combine embeddings using the specified method
            combined_embedding = await self._combine_embeddings(
                field_embeddings,
                field_weights,
                request.combine_method
            )
            
            # Normalize if requested
            if request.normalize:
                combined_embedding = self._normalize_embedding(combined_embedding)
            
            # Get dimensions
            dimensions = len(combined_embedding)
            
            processing_time = time.time() - start_time
            
            return EmbeddingResponse(
                embeddings=[combined_embedding],
                model_name=f"multi-field({','.join(set(used_models))})",
                dimensions=dimensions,
                processing_time=processing_time
            )
            
        except Exception as e:
            logger.error(f"Error generating multi-field embeddings: {str(e)}")
            raise
    
    async def _combine_embeddings(
        self, 
        embeddings: List[List[float]], 
        weights: List[float], 
        method: str
    ) -> List[float]:
        """Combine multiple embeddings using the specified method."""
        
        if method == "weighted_average":
            return await self._weighted_average(embeddings, weights)
        elif method == "concatenate":
            return await self._concatenate(embeddings, weights)
        elif method == "max_pooling":
            return await self._max_pooling(embeddings, weights)
        else:
            raise ValueError(f"Unsupported combine method: {method}")
    
    async def _weighted_average(self, embeddings: List[List[float]], weights: List[float]) -> List[float]:
        """Combine embeddings using weighted average."""
        # Ensure all embeddings have the same dimension
        target_dim = len(embeddings[0])
        processed_embeddings = []
        
        for embedding in embeddings:
            if len(embedding) != target_dim:
                # If dimensions don't match, we need to handle this
                # For now, we'll pad or truncate to match the first embedding's dimension
                if len(embedding) < target_dim:
                    # Pad with zeros
                    embedding = embedding + [0.0] * (target_dim - len(embedding))
                else:
                    # Truncate
                    embedding = embedding[:target_dim]
            processed_embeddings.append(embedding)
        
        # Convert to numpy arrays for easier computation
        embeddings_array = np.array(processed_embeddings)
        weights_array = np.array(weights).reshape(-1, 1)
        
        # Normalize weights to sum to 1
        weights_array = weights_array / np.sum(weights_array)
        
        # Compute weighted average
        weighted_sum = np.sum(embeddings_array * weights_array, axis=0)
        
        return weighted_sum.tolist()
    
    async def _concatenate(self, embeddings: List[List[float]], weights: List[float]) -> List[float]:
        """Combine embeddings by concatenation (weights used for scaling)."""
        result = []
        
        for embedding, weight in zip(embeddings, weights):
            # Scale embedding by weight
            scaled_embedding = [x * weight for x in embedding]
            result.extend(scaled_embedding)
        
        return result
    
    async def _max_pooling(self, embeddings: List[List[float]], weights: List[float]) -> List[float]:
        """Combine embeddings using max pooling (weights used for scaling)."""
        # Scale embeddings by weights first
        scaled_embeddings = []
        for embedding, weight in zip(embeddings, weights):
            scaled_embeddings.append([x * weight for x in embedding])
        
        # Ensure all embeddings have the same dimension
        target_dim = len(scaled_embeddings[0])
        processed_embeddings = []
        
        for embedding in scaled_embeddings:
            if len(embedding) != target_dim:
                if len(embedding) < target_dim:
                    embedding = embedding + [0.0] * (target_dim - len(embedding))
                else:
                    embedding = embedding[:target_dim]
            processed_embeddings.append(embedding)
        
        # Convert to numpy array and apply max pooling
        embeddings_array = np.array(processed_embeddings)
        max_pooled = np.max(embeddings_array, axis=0)
        
        return max_pooled.tolist()
    
    def _normalize_embedding(self, embedding: List[float]) -> List[float]:
        """Normalize a single embedding to unit vector."""
        embedding_array = np.array(embedding)
        norm = np.linalg.norm(embedding_array)
        if norm > 0:
            normalized_embedding = embedding_array / norm
        else:
            normalized_embedding = embedding_array
        return normalized_embedding.tolist()
    
    def _get_default_model_for_type(self, field_type: ModelType) -> str:
        """Get the default model for a given field type."""
        if field_type == ModelType.TEXT:
            return settings.default_text_model
        elif field_type in [ModelType.IMAGE, ModelType.MULTIMODAL]:
            return settings.default_image_model
        else:
            raise ValueError(f"Unknown field type: {field_type}")


# Global multi-field service instance
multi_field_service = MultiFieldService()
