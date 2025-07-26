"""Model manager for loading and managing HuggingFace models."""

import os
import gc
import time
import torch
import logging
from typing import Dict, List, Optional, Any, Union
from collections import OrderedDict
from datetime import datetime
from sentence_transformers import SentenceTransformer
from transformers import CLIPProcessor, CLIPModel, CLIPTokenizerFast, AutoModel, AutoProcessor
from PIL import Image
import base64
import io
import open_clip
import httpx

from ..config import settings
from ..models.embeddings import ModelType, ModelInfo
from .database_init import database_initializer


logger = logging.getLogger(__name__)


class ModelManager:
    """Manages loading, caching, and unloading of embedding models."""
    
    def __init__(self):
        self._models: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self._model_info: Dict[str, ModelInfo] = {}
        self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Create model cache directory
        os.makedirs(settings.model_cache_dir, exist_ok=True)
        
        # Predefined model configurations
        self._available_models = {
            # Text models
            "sentence-transformers/all-MiniLM-L6-v2": {
                "type": ModelType.TEXT,
                "dimensions": 384,
                "description": "Fast and efficient text embedding model"
            },
            "sentence-transformers/all-mpnet-base-v2": {
                "type": ModelType.TEXT,
                "dimensions": 768,
                "description": "High-quality text embedding model"
            },
            "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2": {
                "type": ModelType.TEXT,
                "dimensions": 384,
                "description": "Multilingual text embedding model"
            },
            # Image/multimodal models
            "openai/clip-vit-base-patch32": {
                "type": ModelType.MULTIMODAL,
                "dimensions": 512,
                "description": "CLIP model for text and image embeddings"
            },
            "sentence-transformers/clip-ViT-B-32": {
                "type": ModelType.MULTIMODAL,
                "dimensions": 512,
                "description": "Sentence-transformers CLIP model"
            },
            # Marqo models (require AutoModel and AutoProcessor with trust_remote_code)
            "Marqo/marqo-ecommerce-embeddings-B": {
                "type": ModelType.MULTIMODAL,
                "dimensions": 768,
                "description": "Marqo ecommerce embedding model",
                "use_auto_model": True
            },
            "Marqo/marqo-ecommerce-embeddings-L": {
                "type": ModelType.MULTIMODAL,
                "dimensions": 1024,
                "description": "Marqo ecommerce embedding model (large)",
                "use_auto_model": True
            }
        }
    
    async def load_model(self, model_name: str, model_type: ModelType, force_reload: bool = False) -> ModelInfo:
        """Load a model into memory."""
        try:
            # Check if model is already loaded
            if model_name in self._models and not force_reload:
                self._update_last_used(model_name)
                return self._model_info[model_name]
            
            # Check memory limits and unload if necessary
            await self._ensure_memory_available()
            
            logger.info(f"Loading model: {model_name} (type: {model_type})")
            start_time = time.time()
            
            # Load the model based on type
            if model_type == ModelType.TEXT:
                model_data = await self._load_text_model(model_name)
            elif model_type in [ModelType.IMAGE, ModelType.MULTIMODAL]:
                model_data = await self._load_multimodal_model(model_name)
            else:
                raise ValueError(f"Unsupported model type: {model_type}")
            
            # Store the model
            self._models[model_name] = model_data
            self._models.move_to_end(model_name)  # Mark as most recently used
            
            # Create model info
            model_info = ModelInfo(
                name=model_name,
                type=model_type,
                dimensions=model_data["dimensions"],
                is_loaded=True,
                description=self._available_models.get(model_name, {}).get("description")
            )
            self._model_info[model_name] = model_info
            
            load_time = time.time() - start_time
            logger.info(f"Model {model_name} loaded in {load_time:.2f}s")
            
            return model_info
            
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {str(e)}")
            raise
    
    async def _load_text_model(self, model_name: str) -> Dict[str, Any]:
        """Load a text embedding model."""
        model = SentenceTransformer(model_name, cache_folder=settings.model_cache_dir)
        model.to(self._device)
        
        # Get dimensions from model
        dimensions = model.get_sentence_embedding_dimension()
        
        return {
            "model": model,
            "type": ModelType.TEXT,
            "dimensions": dimensions,
            "processor": None
        }

    async def _load_multimodal_model(self, model_name: str) -> Dict[str, Any]:
        """Load a multimodal (CLIP) model."""
        # Check if this model should use AutoModel
        model_config = self._available_models.get(model_name, {})
        use_auto_model = model_config.get("use_auto_model", False)
        force_sentence_transformers = model_config.get("force_sentence_transformers", False)
        
        if use_auto_model:
            logger.info(f"Loading {model_name} with open_clip library for meta tensor handling.")
            
            # Determine model and pretrained tag for open_clip
            if "marqo-ecommerce-embeddings-b" in model_name.lower():
                clip_model_name = "ViT-B-16-SigLIP"
                clip_pretrained = "webli"
            elif "marqo-ecommerce-embeddings-l" in model_name.lower():
                clip_model_name = "ViT-L-14-SigLIP-384"
                clip_pretrained = "webli"
            else:
                # Fallback or error for other auto_models if any
                raise ValueError(f"Unsupported 'use_auto_model' for {model_name}")

            model, _, processor = open_clip.create_model_and_transforms(
                clip_model_name,
                pretrained=clip_pretrained,
                cache_dir=settings.model_cache_dir,
            )
            model.to(self._device)
            
            tokenizer = open_clip.get_tokenizer(clip_model_name)

            dimensions = self._available_models.get(model_name, {}).get("dimensions", 768)
            
            return {
                "model": model,
                "type": ModelType.MULTIMODAL,
                "dimensions": dimensions,
                "processor": processor, # image processor
                "tokenizer": tokenizer, # text tokenizer
                "is_open_clip": True
            }
        
        elif "sentence-transformers" in model_name or force_sentence_transformers:
            # Use sentence-transformers for CLIP models or forced models
            logger.info(f"Loading {model_name} with sentence-transformers")
            model = SentenceTransformer(model_name, cache_folder=settings.model_cache_dir)
            model.to(self._device)
            dimensions = model.get_sentence_embedding_dimension()
            processor = None
        else:
            # Use transformers for raw CLIP models
            try:
                model = CLIPModel.from_pretrained(model_name, cache_dir=settings.model_cache_dir)
                
                # Try loading processor with tokenizer fixes
                try:
                    processor = CLIPProcessor.from_pretrained(
                        model_name, 
                        cache_dir=settings.model_cache_dir,
                        use_fast=True
                    )
                except Exception as tokenizer_error:
                    logger.warning(f"Failed to load processor with fast tokenizer for {model_name}: {tokenizer_error}")
                    try:
                        # Try with slow tokenizer and from_slow=True
                        processor = CLIPProcessor.from_pretrained(
                            model_name,
                            cache_dir=settings.model_cache_dir,
                            tokenizer=CLIPTokenizerFast.from_pretrained(model_name, from_slow=True)
                        )
                    except Exception as slow_tokenizer_error:
                        logger.warning(f"Failed to load processor with slow tokenizer conversion: {slow_tokenizer_error}")
                        # Fall back to sentence-transformers if available
                        try:
                            logger.info(f"Falling back to sentence-transformers for {model_name}")
                            model = SentenceTransformer(model_name, cache_folder=settings.model_cache_dir)
                            model.to(self._device)
                            dimensions = model.get_sentence_embedding_dimension()
                            processor = None
                            return {
                                "model": model,
                                "type": ModelType.MULTIMODAL,
                                "dimensions": dimensions,
                                "processor": processor
                            }
                        except Exception as st_error:
                            logger.error(f"All fallback methods failed for {model_name}: {st_error}")
                            raise tokenizer_error
                
                model.to(self._device)
                
                # Try to get dimensions from various config attributes
                try:
                    if hasattr(model.config, 'text_config') and hasattr(model.config.text_config, 'hidden_size'):
                        dimensions = model.config.text_config.hidden_size
                    elif hasattr(model.config, 'projection_dim'):
                        dimensions = model.config.projection_dim
                    elif hasattr(model.config, 'hidden_size'):
                        dimensions = model.config.hidden_size
                    elif hasattr(model.config, 'text_embed_dim'):
                        dimensions = model.config.text_embed_dim
                    else:
                        # Fallback: get dimensions from a test encoding
                        logger.warning(f"Could not determine dimensions from config for {model_name}, using test encoding")
                        test_input = processor(text=["test"], return_tensors="pt")
                        test_input = {k: v.to(self._device) for k, v in test_input.items()}
                        with torch.no_grad():
                            test_output = model.get_text_features(**test_input)
                            dimensions = test_output.shape[-1]
                except Exception as dim_error:
                    logger.warning(f"Failed to determine dimensions for {model_name}: {dim_error}")
                    # Use predefined dimensions if available
                    if model_name in self._available_models:
                        dimensions = self._available_models[model_name]["dimensions"]
                    else:
                        dimensions = 512  # Default fallback
                
            except Exception as model_error:
                # Try sentence-transformers as fallback
                logger.warning(f"Failed to load {model_name} with transformers, trying sentence-transformers: {model_error}")
                model = SentenceTransformer(model_name, cache_folder=settings.model_cache_dir)
                model.to(self._device)
                dimensions = model.get_sentence_embedding_dimension()
                processor = None
        
        return {
            "model": model,
            "type": ModelType.MULTIMODAL,
            "dimensions": dimensions,
            "processor": processor
        }
    
    async def unload_model(self, model_name: str) -> bool:
        """Unload a model from memory."""
        if model_name not in self._models:
            return False
        
        logger.info(f"Unloading model: {model_name}")
        
        # Remove from memory
        del self._models[model_name]
        if model_name in self._model_info:
            self._model_info[model_name].is_loaded = False
        
        # Force garbage collection
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        return True
    
    async def get_embedding(self, model_name: str, content: Union[str, List[str]], content_type: ModelType) -> List[List[float]]:
        """Generate embeddings using a loaded model."""
        if model_name not in self._models:
            # Try to load the model if it's available
            if model_name in self._available_models:
                await self.load_model(model_name, self._available_models[model_name]["type"])
            else:
                raise ValueError(f"Model {model_name} is not loaded")
        
        model_data = self._models[model_name]
        model = model_data["model"]
        self._update_last_used(model_name)
        
        # Ensure content is a list
        if isinstance(content, str):
            content = [content]
        
        try:
            if content_type == ModelType.TEXT:
                return await self._get_text_embeddings(model, content, model_data)
            elif content_type == ModelType.IMAGE:
                return await self._get_image_embeddings(model, content, model_data)
            else:
                raise ValueError(f"Unsupported content type: {content_type}")
        except Exception as e:
            logger.error(f"Error generating embeddings with {model_name}: {str(e)}")
            raise
    
    async def _get_text_embeddings(self, model: Any, texts: List[str], model_data: Dict[str, Any]) -> List[List[float]]:
        """Generate text embeddings."""
        if model_data.get("is_open_clip"):
            tokenizer = model_data["tokenizer"]
            with torch.no_grad(), torch.cuda.amp.autocast():
                text_features = model.encode_text(tokenizer(texts).to(self._device))
                text_features /= text_features.norm(dim=-1, keepdim=True)
                embeddings = text_features.cpu().numpy()
        elif hasattr(model, 'encode'):
            # SentenceTransformer model
            embeddings = model.encode(texts, convert_to_tensor=False, normalize_embeddings=True)
        elif model_data.get("is_auto_model", False):
            # AutoModel (like Marqo models)
            processor = model_data["processor"]
            processed = processor(text=texts, return_tensors="pt", padding='max_length')
            processed = {k: v.to(self._device) for k, v in processed.items()}
            
            with torch.no_grad():
                embeddings = model.get_text_features(processed['input_ids'], normalize=True)
                embeddings = embeddings.cpu().numpy()
        else:
            # Raw transformers model
            processor = model_data["processor"]
            inputs = processor(text=texts, return_tensors="pt", padding=True, truncation=True)
            inputs = {k: v.to(self._device) for k, v in inputs.items()}
            
            with torch.no_grad():
                outputs = model.get_text_features(**inputs)
                embeddings = outputs.cpu().numpy()
        
        return embeddings.tolist()
    
    async def _get_image_embeddings(self, model: Any, images: List[str], model_data: Dict[str, Any]) -> List[List[float]]:
        """Generate image embeddings from base64 encoded images or URLs."""
        processed_images = []
        
        # Process images (base64 or URLs)
        for i, img_data in enumerate(images):
            try:
                image = None
                
                # Check if it's a URL
                if img_data.startswith(('http://', 'https://')):
                    logger.debug(f"Downloading image {i} from URL: {img_data[:100]}...")
                    async with httpx.AsyncClient() as client:
                        response = await client.get(img_data, timeout=30.0)
                        response.raise_for_status()
                        image_bytes = response.content
                        logger.debug(f"Downloaded image {i}, size: {len(image_bytes)} bytes")
                        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
                else:
                    # Handle base64 encoded images
                    if img_data.startswith('data:image'):
                        # Remove data URL prefix
                        img_data = img_data.split(',')[1]
                    
                    # Decode base64
                    image_bytes = base64.b64decode(img_data)
                    logger.debug(f"Decoded base64 image {i}, size: {len(image_bytes)} bytes")
                    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
                
                processed_images.append(image)
                logger.debug(f"Successfully processed image {i}, size: {image.size}")
                
            except Exception as e:
                logger.error(f"Failed to process image {i}: {str(e)}")
                logger.error(f"Image data: {img_data[:200]}...")
                raise ValueError(f"Failed to process image {i}: {str(e)}")
        
        if model_data.get("is_open_clip"):
            processor = model_data["processor"]
            image_tensors = torch.stack([processor(img) for img in processed_images]).to(self._device)
            with torch.no_grad(), torch.cuda.amp.autocast():
                image_features = model.encode_image(image_tensors)
                image_features /= image_features.norm(dim=-1, keepdim=True)
                embeddings = image_features.cpu().numpy()
        elif hasattr(model, 'encode'):
            # SentenceTransformer CLIP model
            embeddings = model.encode(processed_images, convert_to_tensor=False, normalize_embeddings=True)
        elif model_data.get("is_auto_model", False):
            # AutoModel (like Marqo models)
            processor = model_data["processor"]
            processed = processor(images=processed_images, return_tensors="pt", padding='max_length')
            processed = {k: v.to(self._device) for k, v in processed.items()}
            
            # Set do_rescale to False as per Marqo documentation
            if hasattr(processor, 'image_processor'):
                processor.image_processor.do_rescale = False
            
            with torch.no_grad():
                embeddings = model.get_image_features(processed['pixel_values'], normalize=True)
                embeddings = embeddings.cpu().numpy()
        else:
            # Raw CLIP model
            processor = model_data["processor"]
            inputs = processor(images=processed_images, return_tensors="pt")
            inputs = {k: v.to(self._device) for k, v in inputs.items()}
            
            with torch.no_grad():
                outputs = model.get_image_features(**inputs)
                embeddings = outputs.cpu().numpy()
        
        return embeddings.tolist()
    
    def get_model_info(self, model_name: str) -> Optional[ModelInfo]:
        """Get information about a specific model."""
        return self._model_info.get(model_name)
    
    def list_models(self) -> List[ModelInfo]:
        """List all models and their status."""
        return list(self._model_info.values())
    
    def get_available_models(self) -> List[str]:
        """Get list of available models that can be loaded."""
        return list(self._available_models.keys())
    
    def get_total_memory_usage(self) -> float:
        """Get total memory usage of loaded models."""
        total_memory = 0.0
        for model_name, model_data in self._models.items():
            if model_name in self._model_info and self._model_info[model_name].is_loaded:
                total_memory += self._estimate_model_memory(model_data)
        return total_memory
    
    def get_model_dimensions(self, model_name: str) -> Optional[int]:
        """Get dimensions for a model (from loaded model or predefined config)."""
        # First check if model is loaded
        if model_name in self._models:
            return self._models[model_name]["dimensions"]
        
        # Check predefined models
        if model_name in self._available_models:
            return self._available_models[model_name]["dimensions"]
        
        return None
    
    async def save_vector_column_metadata(
        self,
        table_name: str,
        column_name: str,
        model_name: str,
        knn_type: str = "HNSW",
        similarity_metric: str = "L2",
        combined_fields: Optional[Dict[str, Any]] = None
    ) -> None:
        """Save vector column metadata including model dimensions and combined fields configuration."""
        dimensions = self.get_model_dimensions(model_name)
        if dimensions is None:
            # Try to load the model to get dimensions
            model_config = self._available_models.get(model_name)
            if model_config:
                await self.load_model(model_name, model_config["type"])
                dimensions = self.get_model_dimensions(model_name)
        
        if dimensions is None:
            raise ValueError(f"Cannot determine dimensions for model: {model_name}")
        
        await database_initializer.save_vector_column_settings(
            table_name=table_name,
            column_name=column_name,
            model_name=model_name,
            dimensions=dimensions,
            knn_type=knn_type,
            similarity_metric=similarity_metric,
            combined_fields=combined_fields
        )
    
    async def get_vector_column_metadata(self, table_name: str, column_name: str) -> Optional[Dict[str, Any]]:
        """Get vector column metadata from database."""
        return await database_initializer.get_vector_column_settings(table_name, column_name)
    
    async def list_vector_tables(self) -> List[str]:
        """List all tables with vector columns."""
        return await database_initializer.list_vector_tables()
    
    async def get_table_vector_columns(self, table_name: str) -> List[Dict[str, Any]]:
        """Get all vector columns for a specific table."""
        return await database_initializer.get_table_vector_columns(table_name)

    async def _ensure_memory_available(self):
        """Ensure memory is available by unloading least recently used models."""
        while len(self._models) >= settings.max_models_in_memory:
            # Get least recently used model (first in OrderedDict)
            lru_model = next(iter(self._models))
            await self.unload_model(lru_model)
    
    def _update_last_used(self, model_name: str):
        """Update the last used time for a model."""
        if model_name in self._models:
            self._models.move_to_end(model_name)
            # Note: last_used tracking would require extending ModelInfo model
    
    def _estimate_model_memory(self, model_data: Dict[str, Any]) -> float:
        """Estimate memory usage of a model in MB."""
        model = model_data["model"]
        total_params = 0
        
        if hasattr(model, 'parameters'):
            for param in model.parameters():
                total_params += param.numel()
        
        # Rough estimate: 4 bytes per parameter (float32)
        memory_mb = (total_params * 4) / (1024 * 1024)
        return round(memory_mb, 2)


# Global model manager instance
model_manager = ModelManager()
