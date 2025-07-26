/**
 * Determines which endpoint to use for a given SQL query
 * /sql endpoint: For SELECT queries and DML operations (INSERT, UPDATE, DELETE on documents)
 * /cli_json endpoint: For DDL operations (CREATE, ALTER, DROP, SHOW, DESCRIBE, etc.)
 */
export function getSqlEndpoint(query: string): '/sql' | '/cli_json' {
  const trimmedQuery = query.trim().toUpperCase();
  
  // DDL commands that should use /cli_json
  const ddlCommands = [
    'CREATE TABLE',
    'DROP TABLE', 
    'ALTER TABLE',
    'SHOW TABLES',
    'SHOW CREATE TABLE',
    'DESCRIBE',
    'DESC ',
    'SHOW VARIABLES',
    'SHOW STATUS',
    'SHOW WARNINGS',
    'SHOW ERRORS',
    'SHOW PLAN',
    'SHOW PROFILE',
    'SHOW DATABASES',
    'USE ',
    'SET ',
    'RESET',
    'FLUSH',
    'TRUNCATE',
    'OPTIMIZE',
    'CALL ',
    'IMPORT',
    'ATTACH',
    'RELOAD',
  ];
  
  // Check if the query starts with any DDL command
  for (const command of ddlCommands) {
    if (trimmedQuery.startsWith(command)) {
      return '/cli_json';
    }
  }
  
  // Everything else (SELECT, INSERT into documents, UPDATE documents, DELETE documents) uses /sql
  return '/sql';
}

/**
 * Gets the appropriate payload format for the endpoint
 */
export function getSqlPayload(query: string, rawResponse = true) {
  const endpoint = getSqlEndpoint(query);
  
  if (endpoint === '/cli_json') {
    return {
      command: query.trim()
    };
  } else {
    return {
      query: query.trim(),
      raw_response: rawResponse
    };
  }
}
