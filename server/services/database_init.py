"""Database initialization service for Manticore Search."""

import logging
import time
import json
import httpx
from typing import Dict, Any, Optional
from ..config import settings

logger = logging.getLogger(__name__)


class DatabaseInitializer:
    """Handles database initialization tasks for Manticore Search."""
    
    def __init__(self):
        self.manticore_url = f"http://{settings.manticore_host}:{settings.manticore_port}"
    
    async def initialize_database(self) -> None:
        """Initialize database by checking and creating required tables."""
        try:
            logger.info("Initializing database tables...")
            await self._ensure_vector_settings_table()
            logger.info("Database initialization completed successfully")
        except Exception as e:
            logger.error(f"Database initialization failed: {str(e)}")
            # Don't re-raise - let the server continue without database initialization
            logger.warning("Server will continue without database initialization")
    
    async def _ensure_vector_settings_table(self) -> None:
        """Ensure the manager_vector_column_settings table exists."""
        table_name = "manager_vector_column_settings"
        
        # Primary check: Try DESCRIBE first as it's most reliable
        try:
            describe_query = f"DESCRIBE {table_name}"
            result = await self._execute_cli_query(describe_query)
            if result:
                logger.info(f"Table '{table_name}' already exists (confirmed by DESCRIBE)")
                return
        except Exception as describe_error:
            logger.debug(f"DESCRIBE failed for {table_name}: {describe_error}")
        
        # Secondary check: Try simple SELECT
        try:
            select_query = f"SELECT * FROM {table_name} LIMIT 0"
            result = await self._execute_sql(select_query)
            if result is not None:
                logger.info(f"Table '{table_name}' already exists (confirmed by SELECT)")
                return
        except Exception as select_error:
            logger.debug(f"SELECT failed for {table_name}: {select_error}")
        
        # Tertiary check: SHOW TABLES
        exists = await self._table_exists(table_name)
        if exists:
            logger.info(f"Table '{table_name}' already exists (confirmed by SHOW TABLES)")
            return
        
        # Table doesn't exist, create it
        logger.info(f"Table '{table_name}' not found, creating it...")
        await self._create_vector_settings_table(table_name)
        logger.info(f"Table '{table_name}' setup completed")
    
    async def _table_exists(self, table_name: str) -> bool:
        """Check if a table exists in Manticore."""
        try:
            # Try a simple SELECT with LIMIT 0 to see if table exists
            query = f"SELECT * FROM {table_name} LIMIT 0"
            response = await self._execute_sql(query)
            # If we get here without error, table exists
            logger.debug(f"Table {table_name} exists (confirmed by SELECT)")
            return True
        except Exception as select_error:
            logger.debug(f"SELECT test failed for {table_name}: {select_error}")
            
            # Fallback to SHOW TABLES
            try:
                query = "SHOW TABLES"
                response = await self._execute_cli_query(query)
                
                logger.debug(f"SHOW TABLES response: {response}")
                
                if response and "data" in response:
                    # Check if our table is in the list
                    for table_info in response["data"]:
                        # Handle different response formats
                        table_found = False
                        if isinstance(table_info, dict):
                            # Check various possible key names
                            table_found = (
                                table_info.get("Index") == table_name or
                                table_info.get("Table") == table_name or
                                table_info.get("table") == table_name or
                                table_info.get("index") == table_name
                            )
                        elif isinstance(table_info, list) and len(table_info) > 0:
                            table_found = table_info[0] == table_name
                        elif isinstance(table_info, str):
                            table_found = table_info == table_name
                        
                        if table_found:
                            logger.debug(f"Found table {table_name} in SHOW TABLES response")
                            return True
                
                logger.debug(f"Table {table_name} not found in SHOW TABLES response")
                return False
            except Exception as show_error:
                logger.warning(f"Error checking if table {table_name} exists: {show_error}")
                # If we can't check, assume it doesn't exist
                return False
    
    async def _create_vector_settings_table(self, table_name: str) -> None:
        """Create the vector settings table."""
        # Create table SQL for Manticore Search
        # Note: Avoiding reserved keywords by using different column names
        create_sql = f"""CREATE TABLE {table_name} (
id bigint,
tbl_name text,
col_name text,
mdl_name text,
dimensions integer,
knn_algo text,
similarity_algo text,
combined_fields json,
created_at bigint,
updated_at bigint
)"""
        
        logger.info(f"Executing CREATE TABLE SQL: {create_sql}")
        try:
            await self._execute_cli_query(create_sql)
            logger.info(f"Table '{table_name}' created successfully")
        except Exception as e:
            error_msg = str(e).lower()
            # Check if the error is about table already existing
            if "already exists" in error_msg or "duplicate" in error_msg:
                logger.info(f"Table '{table_name}' already exists (confirmed by CREATE TABLE error)")
                return
            else:
                # Log the actual error and re-raise
                logger.error(f"Failed to create table '{table_name}': {e}")
                raise
    
    async def _execute_sql(self, query: str) -> Optional[Dict[str, Any]]:
        """Execute SQL SELECT query against Manticore Search using /sql endpoint."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.manticore_url}/sql",
                    json={"query": query},
                    headers={"Content-Type": "application/json"}
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            logger.error(f"HTTP error executing SQL query: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Error executing SQL query: {str(e)}")
            raise
    
    async def _execute_cli_query(self, query: str) -> Optional[Dict[str, Any]]:
        """Execute CLI query against Manticore Search using /cli_json endpoint."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.manticore_url}/cli_json",
                    data=query,
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                
                # Log response details for debugging
                logger.debug(f"CLI query response status: {response.status_code}")
                logger.debug(f"CLI query response text: {response.text}")
                
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            logger.error(f"HTTP error executing CLI query: {str(e)}")
            # Try to get response content for more details
            if hasattr(e, 'response') and e.response:
                logger.error(f"Response content: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Error executing CLI query: {str(e)}")
            raise
    
    async def save_vector_column_settings(
        self,
        table_name: str,
        column_name: str,
        model_name: str,
        dimensions: int,
        knn_type: str = "HNSW",
        similarity_metric: str = "L2",
        combined_fields: Optional[Dict[str, Any]] = None
    ) -> None:
        """Save vector column settings to the metadata table."""
        try:
            # Check if record already exists (use SELECT via /sql)
            check_sql = f"""
            SELECT id FROM manager_vector_column_settings 
            WHERE tbl_name = '{table_name}' AND col_name = '{column_name}'
            """
            
            existing = await self._execute_sql(check_sql)
            current_time = int(time.time())  # Unix timestamp
            
            # Prepare combined_fields JSON
            combined_fields_json = "NULL"
            if combined_fields:
                combined_fields_json = f"'{json.dumps(combined_fields)}'"
            
            if existing and existing.get("hits", {}).get("hits"):
                # Update existing record (use /cli_json for UPDATE)
                update_sql = f"""
                UPDATE manager_vector_column_settings 
                SET mdl_name = '{model_name}',
                    dimensions = {dimensions},
                    knn_algo = '{knn_type}',
                    similarity_algo = '{similarity_metric}',
                    combined_fields = {combined_fields_json},
                    updated_at = {current_time}
                WHERE tbl_name = '{table_name}' AND col_name = '{column_name}'
                """
                await self._execute_cli_query(update_sql)
                logger.info(f"Updated vector column settings for {table_name}.{column_name}")
            else:
                # Insert new record (use /cli_json for INSERT)
                # Generate a unique ID (timestamp-based)
                record_id = int(time.time() * 1000000)  # microsecond timestamp
                
                insert_sql = f"""
                INSERT INTO manager_vector_column_settings 
                (id, tbl_name, col_name, mdl_name, dimensions, knn_algo, similarity_algo, combined_fields, created_at, updated_at)
                VALUES 
                ({record_id}, '{table_name}', '{column_name}', '{model_name}', {dimensions}, '{knn_type}', '{similarity_metric}', {combined_fields_json}, {current_time}, {current_time})
                """
                await self._execute_cli_query(insert_sql)
                logger.info(f"Saved vector column settings for {table_name}.{column_name}")
                
        except Exception as e:
            logger.error(f"Error saving vector column settings: {str(e)}")
            raise
    
    async def get_vector_column_settings(self, table_name: str, column_name: str) -> Optional[Dict[str, Any]]:
        """Get vector column settings for a specific table and column."""
        try:
            query = f"""
            SELECT * FROM manager_vector_column_settings 
            WHERE tbl_name = '{table_name}' AND col_name = '{column_name}'
            """
            
            response = await self._execute_sql(query)
            if response and response.get("hits", {}).get("hits") and len(response["hits"]["hits"]) > 0:
                result = response["hits"]["hits"][0]["_source"]
                # Map internal column names back to external names
                mapped_result = {
                    "table_name": result.get("tbl_name"),
                    "column_name": result.get("col_name"),
                    "model_name": result.get("mdl_name"),
                    "dimensions": result.get("dimensions"),
                    "knn_type": result.get("knn_algo"),
                    "similarity_metric": result.get("similarity_algo"),
                    "combined_fields": result.get("combined_fields"),
                    "created_at": result.get("created_at"),
                    "updated_at": result.get("updated_at")
                }
                # Parse JSON combined_fields if present
                if mapped_result.get("combined_fields"):
                    try:
                        mapped_result["combined_fields"] = json.loads(mapped_result["combined_fields"])
                    except (json.JSONDecodeError, TypeError):
                        mapped_result["combined_fields"] = None
                return mapped_result
            return None
            
        except Exception as e:
            logger.error(f"Error getting vector column settings: {str(e)}")
            return None
    
    async def list_vector_tables(self) -> list:
        """List all tables with vector columns."""
        try:
            query = "SELECT DISTINCT tbl_name FROM manager_vector_column_settings"
            response = await self._execute_sql(query)
            
            if response and response.get("hits", {}).get("hits"):
                return [hit["_source"]["tbl_name"] for hit in response["hits"]["hits"]]
            return []
            
        except Exception as e:
            logger.error(f"Error listing vector tables: {str(e)}")
            return []
    
    async def get_table_vector_columns(self, table_name: str) -> list:
        """Get all vector columns for a specific table."""
        try:
            query = f"""
            SELECT col_name, mdl_name, dimensions, knn_algo, similarity_algo, combined_fields 
            FROM manager_vector_column_settings 
            WHERE tbl_name = '{table_name}'
            """
            
            response = await self._execute_sql(query)
            if response and response.get("hits", {}).get("hits"):
                results = []
                for hit in response["hits"]["hits"]:
                    row = hit["_source"]
                    # Map internal column names back to external names
                    mapped_row = {
                        "column_name": row.get("col_name"),
                        "model_name": row.get("mdl_name"),
                        "dimensions": row.get("dimensions"),
                        "knn_type": row.get("knn_algo"),
                        "similarity_metric": row.get("similarity_algo"),
                        "combined_fields": row.get("combined_fields")
                    }
                    # Parse JSON combined_fields if present
                    if mapped_row.get("combined_fields"):
                        try:
                            mapped_row["combined_fields"] = json.loads(mapped_row["combined_fields"])
                        except (json.JSONDecodeError, TypeError):
                            mapped_row["combined_fields"] = None
                    results.append(mapped_row)
                return results
            return []
            
        except Exception as e:
            logger.error(f"Error getting table vector columns: {str(e)}")
            return []


# Global database initializer instance
database_initializer = DatabaseInitializer()
