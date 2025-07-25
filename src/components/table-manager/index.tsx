import React, { useState, useEffect } from "react";
import { useCustomMutation } from "@refinedev/core";
import { TableInfo } from "../../types/manticore";
import { TableCreator } from "../table-creator";
import { toastMessages } from "../../utils/toast";

export const TableManager: React.FC = () => {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateTable, setShowCreateTable] = useState(false);

  const { mutate: fetchTables } = useCustomMutation();
  const { mutate: fetchTableInfo } = useCustomMutation();
  const { mutate: deleteTable } = useCustomMutation();

  const loadTables = async () => {
    setIsLoading(true);
    setError(null);
    
    fetchTables(
      {
        url: "/tables",
        method: "post",
        values: {},
      },
      {
        onSuccess: (data: any) => {
          setTables(data.data as TableInfo[]);
          setIsLoading(false);
        },
        onError: (err: any) => {
          setError(err.message || "Failed to load tables");
          setIsLoading(false);
        },
      }
    );
  };

  const loadTableDetails = async (tableName: string) => {
    setIsLoading(true);
    setError(null);
    
    fetchTableInfo(
      {
        url: "/table-info",
        method: "post",
        values: { table: tableName },
      },
      {
        onSuccess: (data: any) => {
          setSelectedTable(data.data as TableInfo);
          setIsLoading(false);
        },
        onError: (err: any) => {
          setError(err.message || "Failed to load table details");
          setIsLoading(false);
        },
      }
    );
  };

  const handleDeleteTable = async (tableName: string) => {
    await toastMessages.confirmDelete(
      tableName,
      () => {
        return new Promise<void>((resolve, reject) => {
          setIsLoading(true);
          setError(null);

          deleteTable(
            {
              url: "/sql",
              method: "post",
              values: {
                query: `DROP TABLE ${tableName}`,
                raw_response: true,
              },
            },
            {
              onSuccess: () => {
                setIsLoading(false);
                loadTables();
                setSelectedTable(null);
                resolve();
              },
              onError: (err: any) => {
                setError(err.message || "Failed to delete table");
                setIsLoading(false);
                reject(err);
              },
            }
          );
        });
      },
      'table'
    );
  };

  const handleTableCreated = () => {
    setShowCreateTable(false);
    loadTables();
  };

  useEffect(() => {
    loadTables();
  }, []);

  const renderTableColumns = () => {
    if (!selectedTable || !selectedTable.columns) return null;

    return (
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3">
          Columns for {selectedTable.name}
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Field
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Type
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Properties
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {selectedTable.columns.map((column, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm font-medium text-gray-900 border-b">
                    {column.field}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900 border-b">
                    {column.type}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900 border-b">
                    {column.properties || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Table Manager</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateTable(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Create Table
            </button>
            <button
              onClick={loadTables}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isLoading ? "Loading..." : "Refresh Tables"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="text-red-800">
              <strong>Error:</strong> {error}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-3">Available Tables</h3>
            {tables.length === 0 ? (
              <div className="text-gray-500 italic">No tables found</div>
            ) : (
              <div className="space-y-2">
                {tables.map((table, index) => (
                  <div
                    key={index}
                    className={`p-3 border rounded-md transition-colors ${
                      selectedTable?.name === table.name
                        ? "bg-blue-50 border-blue-300"
                        : "bg-white border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => loadTableDetails(table.name)}
                      >
                        <div className="font-medium">{table.name}</div>
                        {table.engine && (
                          <div className="text-sm text-gray-500">
                            Engine: {table.engine}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTable(table.name);
                        }}
                        className="ml-2 px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                        title="Delete table"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            {selectedTable ? (
              <div>
                <h3 className="text-lg font-semibold mb-3">Table Details</h3>
                <div className="bg-gray-50 p-4 rounded-md">
                  <div className="mb-2">
                    <strong>Name:</strong> {selectedTable.name}
                  </div>
                  {selectedTable.engine && (
                    <div className="mb-2">
                      <strong>Engine:</strong> {selectedTable.engine}
                    </div>
                  )}
                  <div>
                    <strong>Columns:</strong> {selectedTable.columns?.length || 0}
                  </div>
                </div>
                {renderTableColumns()}
              </div>
            ) : (
              <div className="text-gray-500 italic">
                Select a table to view its details
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateTable && (
        <TableCreator
          onTableCreated={handleTableCreated}
          onClose={() => setShowCreateTable(false)}
        />
      )}
    </div>
  );
};
