import React, { useState } from "react";
import { useCustomMutation } from "@refinedev/core";
import { getSqlEndpoint, getSqlPayload } from "../../utils/sql-routing";

export const SqlPage: React.FC = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { mutate: executeQuery } = useCustomMutation();

  const handleExecuteQuery = () => {
    if (!query.trim()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const endpoint = getSqlEndpoint(query);
    const payload = getSqlPayload(query, true);

    executeQuery(
      {
        url: endpoint,
        method: "post",
        values: payload,
      },
      {
        onSuccess: (data: any) => {
          setResults(Array.isArray(data.data) ? data.data : [data.data]);
          setIsLoading(false);
        },
        onError: (error: any) => {
          setError(error.message || "An error occurred while executing the query");
          setIsLoading(false);
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecuteQuery();
    }
  };

  const formatResult = (result: any) => {
    if (typeof result === 'object' && result !== null) {
      return JSON.stringify(result, null, 2);
    }
    return String(result);
  };

  const commonQueries = [
    {
      name: "Show Tables",
      query: "SHOW TABLES"
    },
    {
      name: "Show Table Structure",
      query: "DESCRIBE your_table_name"
    },
    {
      name: "Select All Documents",
      query: "SELECT * FROM your_table_name LIMIT 10"
    },
    {
      name: "Create Table",
      query: `CREATE TABLE example_table (
  id BIGINT,
  title TEXT,
  content TEXT,
  data JSON
) type='rt'`
    },
    {
      name: "Insert Document",
      query: `INSERT INTO your_table_name (title, content, data) 
VALUES ('Sample Title', 'Sample content', '{"key": "value"}')`
    }
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">SQL Editor</h1>
            <p className="text-xs lg:text-sm text-gray-500 dark:text-gray-400 mt-1">
              Execute SQL queries against your Manticore Search database
            </p>
          </div>
          <div className="hidden sm:block text-xs lg:text-sm text-gray-500 dark:text-gray-400">
            Press <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">Ctrl+Enter</kbd> to execute
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Query Panel */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-800">
          {/* Query Input */}
          <div className="p-4 lg:p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                SQL Query
              </label>
              <button
                onClick={handleExecuteQuery}
                disabled={isLoading || !query.trim()}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white text-sm rounded-md disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Executing...' : 'Execute Query'}
              </button>
            </div>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your SQL query here..."
              className="w-full h-24 lg:h-32 p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-xs lg:text-sm"
            />
            <div className="sm:hidden mt-2 text-xs text-gray-500 dark:text-gray-400">
              💡 Press Ctrl+Enter to execute
            </div>
          </div>

          {/* Results Panel */}
          <div className="flex-1 p-4 lg:p-6 overflow-auto">
            {error && (
              <div className="mb-4 p-3 lg:p-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-md">
                <div className="flex">
                  <svg className="h-5 w-5 text-red-400 dark:text-red-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="ml-3 min-w-0">
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Query Error</h3>
                    <p className="mt-1 text-xs lg:text-sm text-red-700 dark:text-red-300 break-words">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {results.length > 0 && (
              <div className="space-y-4 lg:space-y-6">
                {results.map((result, index) => (
                  <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 dark:bg-gray-700 px-3 lg:px-4 py-2 border-b border-gray-200 dark:border-gray-600">
                      <h3 className="text-xs lg:text-sm font-medium text-gray-900 dark:text-white">
                        Result {index + 1}
                        {result.total && (
                          <span className="ml-2 text-gray-500 dark:text-gray-400">({result.total} rows)</span>
                        )}
                      </h3>
                    </div>
                    <div className="p-3 lg:p-4">
                      {result.data && Array.isArray(result.data) && result.data.length > 0 ? (
                        <>
                          {/* Mobile: Card layout */}
                          <div className="lg:hidden space-y-3">
                            {result.data.map((row: any, rowIndex: number) => (
                              <div key={rowIndex} className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                                {Object.entries(row).map(([key, value]) => (
                                  <div key={key} className="mb-2 last:mb-0">
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                      {key}:
                                    </span>
                                    <div className="text-sm text-gray-900 dark:text-gray-100 mt-1 break-words">
                                      {formatResult(value)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                          
                          {/* Desktop: Table layout */}
                          <div className="hidden lg:block overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                              <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                  {Object.keys(result.data[0]).map((column) => (
                                    <th
                                      key={column}
                                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                                    >
                                      {column}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {result.data.map((row: any, rowIndex: number) => (
                                  <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                    {Object.values(row).map((value: any, cellIndex: number) => (
                                      <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                        <div className="max-w-xs truncate">
                                          {formatResult(value)}
                                        </div>
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : (
                        <pre className="bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-3 lg:p-4 rounded-md text-xs lg:text-sm font-mono overflow-x-auto">
                          {formatResult(result)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {results.length === 0 && !error && !isLoading && (
              <div className="text-center py-8 lg:py-12">
                <svg className="mx-auto h-10 w-10 lg:h-12 lg:w-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No results</h3>
                <p className="mt-1 text-xs lg:text-sm text-gray-500 dark:text-gray-400">
                  Execute a SQL query to see results here.
                </p>
              </div>
            )}

            {isLoading && (
              <div className="text-center py-8 lg:py-12">
                <div className="animate-spin rounded-full h-6 w-6 lg:h-8 lg:w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
                <p className="mt-2 text-xs lg:text-sm text-gray-500 dark:text-gray-400">Executing query...</p>
              </div>
            )}
          </div>
        </div>

        {/* Common Queries Sidebar - Hidden on mobile, can be toggled */}
        <div className="hidden lg:block lg:w-80 bg-gray-50 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Common Queries</h3>
          <div className="space-y-3">
            {commonQueries.map((item, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                onClick={() => setQuery(item.query)}
              >
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</h4>
                <pre className="mt-1 text-xs text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap">
                  {item.query.substring(0, 100)}
                  {item.query.length > 100 && '...'}
                </pre>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Quick Tips</h4>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Use LIMIT to restrict result size</li>
              <li>• Press Ctrl+Enter to execute</li>
              <li>• JSON data is searchable with MATCH()</li>
              <li>• Use DESCRIBE to see table structure</li>
            </ul>
          </div>
        </div>

        {/* Mobile Common Queries - Show at bottom */}
        <div className="lg:hidden bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3">Common Queries</h3>
          <div className="grid grid-cols-1 gap-2">
            {commonQueries.map((item, index) => (
              <button
                key={index}
                className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                onClick={() => setQuery(item.query)}
              >
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</h4>
                <div className="mt-1 text-xs text-gray-600 dark:text-gray-400 font-mono truncate">
                  {item.query.substring(0, 60)}
                  {item.query.length > 60 && '...'}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
