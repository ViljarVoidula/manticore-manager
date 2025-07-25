import React, { useState } from "react";
import { useCustomMutation } from "@refinedev/core";
import { SqlResponse } from "../../types/manticore";

interface SqlEditorProps {
  onQueryExecuted?: (results: SqlResponse[]) => void;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({ onQueryExecuted }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SqlResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { mutate: executeQuery, isLoading } = useCustomMutation();

  const handleExecute = async () => {
    if (!query.trim()) return;

    setError(null);

    executeQuery(
      {
        url: "/sql",
        method: "post",
        values: {
          query: query.trim(),
          raw_response: true,
        },
      },
      {
        onSuccess: (data: any) => {
          const queryResults = data.data as SqlResponse[];
          setResults(queryResults);
          onQueryExecuted?.(queryResults);
        },
        onError: (error: any) => {
          setError(error.message || "An error occurred while executing the query");
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      handleExecute();
    }
  };

  const renderResults = () => {
    if (!results) return null;

    return (
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3">Results</h3>
        {results.map((result, index) => (
          <div key={index} className="mb-4 border rounded-lg p-4">
            {result.error ? (
              <div className="text-red-600">
                <strong>Error:</strong> {result.error}
              </div>
            ) : (
              <div>
                {result.total !== undefined && (
                  <div className="mb-2 text-sm text-gray-600">
                    Total: {result.total} rows
                  </div>
                )}
                {result.data && result.data.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {Object.keys(result.data[0]).map((column) => (
                            <th
                              key={column}
                              className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b"
                            >
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {result.data.map((row, rowIndex) => (
                          <tr key={rowIndex} className="hover:bg-gray-50">
                            {Object.values(row).map((value, cellIndex) => (
                              <td
                                key={cellIndex}
                                className="px-4 py-2 text-sm text-gray-900 border-b"
                              >
                                {typeof value === "object"
                                  ? JSON.stringify(value)
                                  : String(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-bold mb-4">SQL Query Editor</h2>
        <div className="mb-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            SQL Query
          </label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-40 p-3 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your SQL query here... (Ctrl+Enter to execute)"
          />
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={handleExecute}
            disabled={isLoading || !query.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? "Executing..." : "Execute Query"}
          </button>
          <div className="text-sm text-gray-500">
            Press Ctrl+Enter to execute
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800">
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {renderResults()}
    </div>
  );
};
