"""Recommendations models for vector similarity search."""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from enum import Enum


class RecommendationInputType(str, Enum):
    """Types of input for recommendations."""
    ID = "id"
    VECTOR = "vector"
    TEXT = "text"


class RecommendationRequest(BaseModel):
    """Request model for recommendations API."""
    
    # Stage 1: Reference input
    table_name: str = Field(..., description="Name of the table to search in")
    input_type: RecommendationInputType = Field(..., description="Type of input (id, vector, or text)")
    input_value: Union[str, int, List[float]] = Field(..., description="Input value - ID, vector array, or text")
    vector_column: Optional[str] = Field(None, description="Specific vector column to use (auto-detected if not provided)")
    
    # Stage 2: Search parameters
    limit: int = Field(10, ge=1, le=100, description="Number of recommendations to return")
    exclude_self: bool = Field(True, description="Exclude the reference item from results")
    similarity_threshold: Optional[float] = Field(None, ge=0.0, le=1.0, description="Minimum similarity threshold")
    
    # Additional filters
    filters: Optional[Dict[str, Any]] = Field(None, description="Additional filters to apply")


class RecommendationItem(BaseModel):
    """Single recommendation item."""
    id: Union[str, int]
    score: float
    distance: float
    data: Dict[str, Any]


class RecommendationResponse(BaseModel):
    """Response model for recommendations API."""
    
    # Metadata about the request
    reference_table: str
    reference_input_type: str
    reference_input_value: Union[str, int, List[float]]
    vector_column_used: str
    model_name: Optional[str]
    
    # Results
    recommendations: List[RecommendationItem]
    total_found: int
    query_time_ms: float
    
    # Debug info
    reference_vector: Optional[List[float]] = Field(None, description="The reference vector used for similarity search")
    stage1_time_ms: Optional[float] = Field(None, description="Time spent in stage 1 (getting reference)")
    stage2_time_ms: Optional[float] = Field(None, description="Time spent in stage 2 (similarity search)")


class VectorColumnInfo(BaseModel):
    """Information about a vector column."""
    table_name: str
    column_name: str
    model_name: str
    combined_fields: Optional[Dict[str, Any]] = None
    dimensions: Optional[int] = None
    knn_type: Optional[str] = None
    similarity_metric: Optional[str] = None


class ErrorResponse(BaseModel):
    """Error response model."""
    error: str
    details: Optional[str] = None
    code: Optional[str] = None