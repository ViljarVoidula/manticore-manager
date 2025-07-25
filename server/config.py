"""Configuration settings for the FastAPI server."""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings."""
    
    # Server settings
    port: int = 3001
    host: str = "0.0.0.0"
    
    # Manticore Search settings
    manticore_host: str = "127.0.0.1"
    manticore_port: int = 9308
    
    # CORS settings
    cors_origins: List[str] = ["http://localhost:7600", "http://127.0.0.1:7600"]
    cors_methods: List[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    cors_headers: List[str] = ["Content-Type", "Authorization"]
    
    # Model settings
    max_models_in_memory: int = 3
    default_text_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    default_image_model: str = "openai/clip-vit-base-patch32"
    model_cache_dir: str = "./models"
    
    # Embedding settings
    embedding_cache_ttl: int = 3600
    max_batch_size: int = 32
    max_text_length: int = 8192
    
    # Performance settings
    request_timeout: int = 300
    model_load_timeout: int = 600
    
    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()
