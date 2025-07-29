"""Recommendations API endpoints for vector similarity search."""

import time
import logging
import json
from typing import List, Optional, Dict, Any, Union
from fastapi import APIRouter, HTTPException, Depends
import httpx

from ..models.recommendations import (
    RecommendationRequest,
    RecommendationResponse,
    RecommendationItem,
    VectorColumnInfo,
    ErrorResponse,
    RecommendationInputType
)
from ..services.database_init import database_initializer
from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


class RecommendationService:
    """Service for handling vector similarity recommendations."""
    
    def __init__(self):
        self.manticore_url = f"http://{settings.manticore_host}:{settings.manticore_port}"
    
    async def get_recommendations(self, request: RecommendationRequest) -> RecommendationResponse:
        """Get recommendations using two-stage approach."""
        start_time = time.time()
        
        try:
            # Stage 1: Get reference vector and validate table/column
            stage1_start = time.time()
            reference_vector, vector_column_info, actual_doc_id = await self._get_reference_vector(request)
            stage1_time = (time.time() - stage1_start) * 1000
            
            # Stage 2: Perform similarity search
            stage2_start = time.time()
            recommendations = await self._similarity_search(
                request, reference_vector, vector_column_info, actual_doc_id
            )
            stage2_time = (time.time() - stage2_start) * 1000
            
            total_time = (time.time() - start_time) * 1000
            
            return RecommendationResponse(
                reference_table=request.table_name,
                reference_input_type=request.input_type.value,
                reference_input_value=request.input_value,
                vector_column_used=vector_column_info.column_name,
                model_name=vector_column_info.model_name,
                recommendations=recommendations,
                total_found=len(recommendations),
                query_time_ms=total_time,
                reference_vector=reference_vector if len(reference_vector) <= 10 else None,  # Don't return very large vectors
                stage1_time_ms=stage1_time,
                stage2_time_ms=stage2_time
            )
            
        except Exception as e:
            logger.error(f"Error getting recommendations: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    
    async def _get_reference_vector(
        self, request: RecommendationRequest
    ) -> tuple[List[float], VectorColumnInfo, Union[str, int, None]]:
        """Stage 1: Get reference vector from input. Returns (vector, column_info, actual_doc_id)."""
        
        # Get vector column information
        vector_columns = await self._get_table_vector_columns(request.table_name)
        if not vector_columns:
            raise HTTPException(
                status_code=404, 
                detail=f"No vector columns found for table '{request.table_name}'"
            )
        
        # Select vector column
        if request.vector_column:
            vector_column_info = next(
                (col for col in vector_columns if col.column_name == request.vector_column), 
                None
            )
            if not vector_column_info:
                raise HTTPException(
                    status_code=404,
                    detail=f"Vector column '{request.vector_column}' not found in table '{request.table_name}'"
                )
        else:
            # Use first available vector column
            vector_column_info = vector_columns[0]
            logger.info(f"Auto-selected vector column: {vector_column_info.column_name}")
        
        # Get reference vector based on input type
        if request.input_type == RecommendationInputType.VECTOR:
            if not isinstance(request.input_value, list):
                raise HTTPException(status_code=400, detail="Input value must be a list for vector input type")
            return request.input_value, vector_column_info, None
            
        elif request.input_type == RecommendationInputType.ID:
            # Query table to get vector by ID and return actual document ID found
            vector, actual_doc_id = await self._get_vector_by_id(
                request.table_name, 
                request.input_value, 
                vector_column_info.column_name
            )
            return vector, vector_column_info, actual_doc_id
            
        elif request.input_type == RecommendationInputType.TEXT:
            # Generate embedding for text (would need embedding service)
            raise HTTPException(
                status_code=501, 
                detail="Text input type not yet implemented - requires embedding service"
            )
        
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported input type: {request.input_type}")
    
    async def _get_vector_by_id(
        self, table_name: str, doc_id: Union[str, int], vector_column: str
    ) -> tuple[List[float], Union[str, int]]:
        """Get vector from document by ID. Returns (vector, actual_doc_id_found)."""
        
        try:
            # Convert doc_id to int for Manticore search
            try:
                numeric_id = int(doc_id)
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid document ID format: {doc_id}. ID must be numeric."
                )
            
            # Use search API instead of SQL to get document by ID
            search_request = {
                "table": table_name,
                "query": {
                    "equals": {"id": numeric_id}
                },
                "limit": 1
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.manticore_url}/search",
                    json=search_request,
                    headers={"Content-Type": "application/json"}
                )
                response.raise_for_status()
                result = response.json()
                
                hits = result.get("hits", {}).get("hits", [])
                
                # If exact match not found, try to find similar IDs (for JavaScript precision issues)
                if not hits:
                    logger.warning(f"Exact ID {numeric_id} not found, searching for similar IDs due to potential JS precision loss")
                    
                    # Search for IDs that start with the same prefix (handle precision loss)
                    # Convert to string and get first 15 digits as the precision-safe prefix
                    id_str = str(numeric_id)
                    if len(id_str) > 15:
                        prefix = id_str[:15]
                        
                        # Use range query to find IDs that start with this prefix
                        range_search_request = {
                            "table": table_name,
                            "query": {
                                "range": {
                                    "id": {
                                        "gte": int(prefix + "0" * (len(id_str) - 15)),
                                        "lte": int(prefix + "9" * (len(id_str) - 15))
                                    }
                                }
                            },
                            "limit": 5
                        }
                        
                        response = await client.post(
                            f"{self.manticore_url}/search",
                            json=range_search_request,
                            headers={"Content-Type": "application/json"}
                        )
                        response.raise_for_status()
                        result = response.json()
                        hits = result.get("hits", {}).get("hits", [])
                        
                        if hits:
                            logger.info(f"Found {len(hits)} similar IDs for imprecise ID {numeric_id}, using first match: {hits[0]['_id']}")
            
            if not hits:
                raise HTTPException(
                    status_code=404, 
                    detail=f"Document with ID {doc_id} not found in table {table_name}"
                )
            
            # Get the actual document ID that was found (important for precision-corrected IDs)
            actual_doc_id = hits[0]["_id"]
            vector_data = hits[0]["_source"].get(vector_column)
            if not vector_data:
                raise HTTPException(
                    status_code=404,
                    detail=f"Vector column '{vector_column}' is empty for document ID {doc_id}"
                )
            
            # Validate that this is actually vector data, not a URL or other text
            if isinstance(vector_data, str):
                # If it's a string, it's likely a URL or text, not a vector
                if vector_data.startswith(('http://', 'https://', 'ftp://')):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Column '{vector_column}' contains URL data, not vector embeddings. Please use a proper vector column."
                    )
                # Try to parse as vector string format
                try:
                    clean_str = vector_data.strip("()")
                    parsed_vector = [float(x.strip()) for x in clean_str.split(",")]
                    if len(parsed_vector) < 10:  # Vectors should have many dimensions
                        raise HTTPException(
                            status_code=400,
                            detail=f"Column '{vector_column}' does not appear to contain vector data (too few dimensions: {len(parsed_vector)})"
                        )
                except ValueError:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Column '{vector_column}' contains text data, not vector embeddings. Please use a proper vector column."
                    )
            
            # Handle different vector formats
            if isinstance(vector_data, list):
                return [float(x) for x in vector_data], actual_doc_id
            elif isinstance(vector_data, str):
                # Parse string representation of vector
                try:
                    # Remove parentheses if present: "(1.0,2.0,3.0)" -> "1.0,2.0,3.0"
                    clean_str = vector_data.strip("()")
                    return [float(x.strip()) for x in clean_str.split(",")], actual_doc_id
                except ValueError as e:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Could not parse vector data for ID {doc_id}: {str(e)}"
                    )
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unexpected vector data format for ID {doc_id}: {type(vector_data)}"
                )
                
        except httpx.HTTPError as e:
            logger.error(f"HTTP error getting vector by ID: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error getting vector by ID: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    
    async def _similarity_search(
        self, 
        request: RecommendationRequest,
        reference_vector: List[float],
        vector_column_info: VectorColumnInfo,
        actual_reference_doc_id: Union[str, int, None] = None
    ) -> List[RecommendationItem]:
        """Stage 2: Perform similarity search using KNN."""
        
        try:
            # Build KNN query
            vector_str = "(" + ",".join(map(str, reference_vector)) + ")"
            
            # Base KNN query
            knn_limit = request.limit
            if request.exclude_self and request.input_type == RecommendationInputType.ID:
                knn_limit += 1  # Get one extra to exclude self
            
            # Build SELECT fields - get all fields for now
            select_fields = "*"
            
            # Build WHERE clause with KNN
            where_clause = f"knn({vector_column_info.column_name}, {knn_limit}, {vector_str})"
            
            # Add additional filters if provided
            if request.filters:
                additional_filters = self._build_filter_clause(request.filters)
                if additional_filters:
                    where_clause = f"({where_clause}) AND ({additional_filters})"
            
            # Build complete query (KNN results are automatically ordered by distance)
            query = f"""
            SELECT {select_fields}, knn_dist() as similarity_distance 
            FROM {request.table_name} 
            WHERE {where_clause}
            """
            
            logger.info(f"Executing KNN query: {query}")
            
            # Execute query using CLI JSON endpoint for better KNN support
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.manticore_url}/cli_json",
                    data=query,
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                response.raise_for_status()
                cli_result = response.json()
            
            # Convert CLI JSON format to search format
            if cli_result and len(cli_result) > 0 and "data" in cli_result[0]:
                # Extract column names from the columns definition
                column_names = []
                for col_info in cli_result[0]["columns"]:
                    for col_name in col_info.keys():
                        column_names.append(col_name)
                
                # Convert data rows to hits format
                hits = []
                for row in cli_result[0]["data"]:
                    # row is already a dict with column_name: value pairs
                    source_data = dict(row)  # Make a copy of the row data
                    
                    hits.append({
                        "_id": source_data.get("id", 0),
                        "_score": 1.0,
                        "_source": source_data
                    })
                
                result = {
                    "hits": {
                        "hits": hits
                    }
                }
            else:
                result = {"hits": {"hits": []}}
            
            hits = result.get("hits", {}).get("hits", [])
            
            # Process results
            recommendations = []
            for hit in hits:
                source_data = hit["_source"]
                doc_id = source_data.get("id")
                distance = source_data.get("similarity_distance", 0.0)
                
                # Skip self if requested and input was ID  
                # Use actual_reference_doc_id if available (handles precision issues), otherwise fall back to input_value
                exclude_id = actual_reference_doc_id if actual_reference_doc_id is not None else request.input_value
                if (request.exclude_self and 
                    request.input_type == RecommendationInputType.ID and 
                    str(doc_id) == str(exclude_id)):
                    logger.debug(f"Excluding self-reference: doc_id={doc_id}, exclude_id={exclude_id}")
                    continue
                
                # Apply similarity threshold if specified
                if request.similarity_threshold is not None:
                    score = 1.0 / (1.0 + distance) if distance > 0 else 1.0  # Convert distance to similarity
                    if score < request.similarity_threshold:
                        continue
                
                # Remove internal fields from response
                clean_data = {k: v for k, v in source_data.items() 
                            if k not in ['similarity_distance', vector_column_info.column_name]}
                
                recommendations.append(RecommendationItem(
                    id=doc_id,
                    score=1.0 / (1.0 + distance) if distance > 0 else 1.0,
                    distance=distance,
                    data=clean_data
                ))
            
            # Limit results
            return recommendations[:request.limit]
            
        except httpx.HTTPError as e:
            logger.error(f"HTTP error in similarity search: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Similarity search failed: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error in similarity search: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    
    def _build_filter_clause(self, filters: Dict[str, Any]) -> str:
        """Build WHERE clause from filters."""
        conditions = []
        
        for field, value in filters.items():
            if isinstance(value, (str, int, float)):
                if isinstance(value, str):
                    conditions.append(f"{field} = '{value}'")
                else:
                    conditions.append(f"{field} = {value}")
            elif isinstance(value, list):
                if all(isinstance(v, str) for v in value):
                    value_str = "', '".join(value)
                    conditions.append(f"{field} IN ('{value_str}')")
                else:
                    value_str = ", ".join(map(str, value))
                    conditions.append(f"{field} IN ({value_str})")
            elif isinstance(value, dict):
                # Handle range queries
                if "gte" in value:
                    conditions.append(f"{field} >= {value['gte']}")
                if "lte" in value:
                    conditions.append(f"{field} <= {value['lte']}")
                if "gt" in value:
                    conditions.append(f"{field} > {value['gt']}")
                if "lt" in value:
                    conditions.append(f"{field} < {value['lt']}")
        
        return " AND ".join(conditions)
    
    async def _get_table_vector_columns(self, table_name: str) -> List[VectorColumnInfo]:
        """Get vector column information for a table."""
        
        try:
            # Get vector column settings from manager_vector_column_settings
            vector_settings = await database_initializer.get_table_vector_columns(table_name)
            
            if not vector_settings:
                return []
            
            return [
                VectorColumnInfo(
                    table_name=table_name,
                    column_name=setting["column_name"],
                    model_name=setting["model_name"],
                    combined_fields=setting.get("combined_fields"),
                    dimensions=setting.get("dimensions"),
                    knn_type=setting.get("knn_type"),
                    similarity_metric=setting.get("similarity_metric")
                )
                for setting in vector_settings
            ]
            
        except Exception as e:
            logger.error(f"Error getting table vector columns: {str(e)}")
            return []


# Global service instance
recommendation_service = RecommendationService()


@router.post("/search", response_model=RecommendationResponse)
async def get_recommendations(request: RecommendationRequest):
    """
    Get vector similarity recommendations using two-stage approach.
    
    Stage 1: Get reference vector from ID, vector, or text input
    Stage 2: Perform KNN similarity search in Manticore
    
    Example requests:
    
    **By ID:**
    ```json
    {
        "table_name": "products",
        "input_type": "id",
        "input_value": 123,
        "limit": 10
    }
    ```
    
    **By vector:**
    ```json
    {
        "table_name": "products", 
        "input_type": "vector",
        "input_value": [0.1, 0.2, 0.3, ...],
        "limit": 10,
        "vector_column": "embedding"
    }
    ```
    
    **With filters:**
    ```json
    {
        "table_name": "products",
        "input_type": "id", 
        "input_value": 123,
        "limit": 10,
        "filters": {
            "category": "electronics",
            "price": {"gte": 100, "lte": 1000}
        }
    }
    ```
    """
    return await recommendation_service.get_recommendations(request)


@router.get("/tables/{table_name}/vector-columns", response_model=List[VectorColumnInfo])
async def get_table_vector_columns(table_name: str):
    """Get information about vector columns in a table."""
    try:
        vector_columns = await recommendation_service._get_table_vector_columns(table_name)
        if not vector_columns:
            raise HTTPException(
                status_code=404,
                detail=f"No vector columns found for table '{table_name}'"
            )
        return vector_columns
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting vector columns: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tables", response_model=List[str])
async def list_vector_tables():
    """List all tables that have vector columns configured."""
    try:
        tables = await database_initializer.list_vector_tables()
        return tables
    except Exception as e:
        logger.error(f"Error listing vector tables: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))