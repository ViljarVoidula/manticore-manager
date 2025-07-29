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
        combined_fields: Optional[Dict[str, Any]] = None
    ) -> None:
        """Save vector column settings to the metadata table."""
        try:
            logger.info(f"Saving vector column settings for {table_name}.{column_name} with model {model_name}")
            logger.info(f"Combined fields data: {combined_fields}")
            
            # Force create the table if it doesn't exist
            table_name_meta = "manager_vector_column_settings"
            create_sql = f"""CREATE TABLE IF NOT EXISTS {table_name_meta} (
id bigint,
tbl_name text,
col_name text,
mdl_name text,
combined_fields json,
created_at bigint,
updated_at bigint
)"""
            
            logger.info(f"Ensuring table exists with SQL: {create_sql}")
            try:
                await self._execute_cli_query(create_sql)
                logger.info("Table creation/check completed")
            except Exception as create_error:
                logger.warning(f"Table creation failed, but continuing: {create_error}")
            
            # Simple escaping for values
            def simple_escape(value: str) -> str:
                return value.replace("'", "''")  # SQL standard way to escape single quotes
            
            table_name_escaped = simple_escape(table_name)
            column_name_escaped = simple_escape(column_name)  
            model_name_escaped = simple_escape(model_name)
            
            current_time = int(time.time())
            record_id = int(time.time() * 1000000)  # microsecond timestamp
            
            # Handle JSON data - use simple approach
            combined_fields_value = "NULL"
            if combined_fields:
                json_str = json.dumps(combined_fields)
                # Simple escape for JSON
                json_escaped = json_str.replace("'", "''")
                combined_fields_value = f"'{json_escaped}'"
                logger.info(f"JSON value: {combined_fields_value}")
            
            # Try INSERT first (simpler approach)
            insert_sql = f"""INSERT INTO {table_name_meta} 
(id, tbl_name, col_name, mdl_name, combined_fields, created_at, updated_at) 
VALUES 
({record_id}, '{table_name_escaped}', '{column_name_escaped}', '{model_name_escaped}', {combined_fields_value}, {current_time}, {current_time})"""
            
            logger.info(f"Executing INSERT SQL: {insert_sql}")
            
            try:
                await self._execute_cli_query(insert_sql)
                logger.info(f"Successfully saved vector column settings for {table_name}.{column_name}")
            except Exception as insert_error:
                logger.warning(f"INSERT failed, might be duplicate. Error: {insert_error}")
                
                # Try UPDATE instead
                update_sql = f"""UPDATE {table_name_meta} 
SET mdl_name = '{model_name_escaped}', 
    combined_fields = {combined_fields_value}, 
    updated_at = {current_time} 
WHERE tbl_name = '{table_name_escaped}' AND col_name = '{column_name_escaped}'"""
                
                logger.info(f"Executing UPDATE SQL: {update_sql}")
                await self._execute_cli_query(update_sql)
                logger.info(f"Successfully updated vector column settings for {table_name}.{column_name}")
                
        except Exception as e:
            logger.error(f"Error saving vector column settings: {str(e)}")
            # Try to get more error details
            if hasattr(e, 'response'):
                try:
                    error_text = await e.response.aread() if hasattr(e.response, 'aread') else e.response.text
                    logger.error(f"Response details: {error_text}")
                except:
                    logger.error(f"Could not read response details")
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
            # Use search API instead of SQL to avoid syntax issues
            search_request = {
                "table": "manager_vector_column_settings",
                "query": {
                    "match": {"tbl_name": table_name}
                },
                "limit": 100
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.manticore_url}/search",
                    json=search_request,
                    headers={"Content-Type": "application/json"}
                )
                response.raise_for_status()
                search_response = response.json()
            
            if search_response and search_response.get("hits", {}).get("hits"):
                results = []
                for hit in search_response["hits"]["hits"]:
                    row = hit["_source"]
                    # Map internal column names back to external names
                    mapped_row = {
                        "column_name": row.get("col_name"),
                        "model_name": row.get("mdl_name"),
                        "combined_fields": row.get("combined_fields")
                    }
                    # Parse JSON combined_fields if present
                    if mapped_row.get("combined_fields"):
                        try:
                            if isinstance(mapped_row["combined_fields"], str):
                                mapped_row["combined_fields"] = json.loads(mapped_row["combined_fields"])
                        except (json.JSONDecodeError, TypeError):
                            mapped_row["combined_fields"] = None
                    results.append(mapped_row)
                return results
            return []
            
        except Exception as e:
            logger.error(f"Error getting table vector columns: {str(e)}")
            return []

    async def delete_vector_column_settings(self, table_name: str, column_name: str) -> None:
        """Delete vector column settings for a specific table and column."""
        try:
            delete_sql = f"""
            DELETE FROM manager_vector_column_settings 
            WHERE tbl_name = '{table_name}' AND col_name = '{column_name}'
            """
            await self._execute_cli_query(delete_sql)
            logger.info(f"Deleted vector column settings for {table_name}.{column_name}")
            
        except Exception as e:
            logger.error(f"Error deleting vector column settings: {str(e)}")
            raise

    async def delete_table_vector_settings(self, table_name: str) -> None:
        """Delete all vector column settings for a specific table."""
        try:
            delete_sql = f"""
            DELETE FROM manager_vector_column_settings 
            WHERE tbl_name = '{table_name}'
            """
            await self._execute_cli_query(delete_sql)
            logger.info(f"Deleted all vector column settings for table {table_name}")
            
        except Exception as e:
            logger.error(f"Error deleting table vector settings: {str(e)}")
            raise


# Global database initializer instance
database_initializer = DatabaseInitializer()
