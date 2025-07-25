import React, { useState, useEffect } from "react";
import { useCustomMutation, useCreate, useUpdate, useDelete, useList } from "@refinedev/core";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { TableInfo } from "../../types/manticore";
import { TableCreator } from "../../components/table-creator/TableCreator";

export const TablesPage: React.FC = () => {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [showCreateDocumentForm, setShowCreateDocumentForm] = useState(false);
  const [editingDocument, setEditingDocument] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  
  const { tableId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shouldShowCreateTable = searchParams.get('create') === 'true';

  const { mutate: fetchTables } = useCustomMutation();
  const { mutate: fetchTableInfo } = useCustomMutation();
  const { mutate: deleteTable } = useCustomMutation();
  const { mutate: createDocument } = useCreate();
  const { mutate: updateDocument } = useUpdate();
  const { mutate: deleteDocument } = useDelete();

  // Fetch documents for selected table
  const { data: documentsData, refetch: refetchDocuments } = useList({
    resource: tableId || "",
    pagination: {
      current: currentPage,
      pageSize: 10,
    },
    filters: searchQuery ? [
      {
        field: "query_string",
        operator: "contains",
        value: searchQuery,
      }
    ] : undefined,
    queryOptions: {
      enabled: !!tableId,
    },
  });

  // Load tables on mount
  useEffect(() => {
    loadTables();
  }, []);

  // Load table info when tableId changes
  useEffect(() => {
    if (tableId) {
      loadTableInfo(tableId);
    } else {
      setSelectedTable(null);
    }
  }, [tableId]);

  const loadTables = () => {
    fetchTables(
      {
        url: "/tables",
        method: "post",
        values: {},
      },
      {
        onSuccess: (data: any) => {
          setTables(data.data as TableInfo[]);
        },
      }
    );
  };

  const loadTableInfo = (tableName: string) => {
    fetchTableInfo(
      {
        url: "/table-info",
        method: "post",
        values: { table: tableName },
      },
      {
        onSuccess: (data: any) => {
          setSelectedTable(data.data as TableInfo);
        },
        onError: (error: any) => {
          console.error('Failed to fetch table info:', error);
          setSelectedTable({
            name: tableName,
            columns: [
              { field: 'id', type: 'bigint', properties: '' },
              { field: 'data', type: 'json', properties: '' }
            ]
          });
        }
      }
    );
  };

  const handleTableSelect = (tableName: string) => {
    navigate(`/tables/${tableName}`);
  };

  const handleDeleteTable = (tableName: string) => {
    if (!confirm(`Are you sure you want to delete table "${tableName}"? This action cannot be undone.`)) {
      return;
    }

    deleteTable(
      {
        url: "/delete-table",
        method: "post",
        values: { table: tableName },
      },
      {
        onSuccess: () => {
          loadTables();
          if (tableId === tableName) {
            navigate("/tables");
          }
        },
      }
    );
  };

  const initializeDocumentForm = () => {
    const initialData: Record<string, any> = {};
    if (selectedTable?.columns) {
      selectedTable.columns.forEach((column: any) => {
        if (column.field !== 'id') {
          switch (column.type) {
            case 'integer':
            case 'bigint':
              initialData[column.field] = 0;
              break;
            case 'float':
              initialData[column.field] = 0.0;
              break;
            case 'bool':
              initialData[column.field] = false;
              break;
            case 'json':
              if (column.field === 'data') {
                initialData[column.field] = {
                  title: "Sample Document",
                  content: "Document content here",
                  tags: ["tag1", "tag2"]
                };
              } else {
                initialData[column.field] = {};
              }
              break;
            default:
              initialData[column.field] = '';
          }
        }
      });
    }
    return initialData;
  };

  const handleCreateDocument = () => {
    const initialData = initializeDocumentForm();
    setFormData(initialData);
    setEditingDocument(null);
    setShowCreateDocumentForm(true);
  };

  const handleEditDocument = (document: any) => {
    setFormData({ ...document });
    setEditingDocument(document);
    setShowCreateDocumentForm(true);
  };

  const handleDeleteDocument = (id: string | number) => {
    if (!confirm("Are you sure you want to delete this document?")) {
      return;
    }

    deleteDocument(
      {
        resource: tableId!,
        id,
      },
      {
        onSuccess: () => {
          refetchDocuments();
        },
      }
    );
  };

  const handleSubmitDocument = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingDocument) {
      updateDocument(
        {
          resource: tableId!,
          id: editingDocument.id,
          values: formData,
        },
        {
          onSuccess: () => {
            setShowCreateDocumentForm(false);
            setEditingDocument(null);
            refetchDocuments();
          },
        }
      );
    } else {
      createDocument(
        {
          resource: tableId!,
          values: formData,
        },
        {
          onSuccess: () => {
            setShowCreateDocumentForm(false);
            refetchDocuments();
          },
        }
      );
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    refetchDocuments();
  };

  const renderFormField = (column: any) => {
    const value = formData[column.field] || '';

    switch (column.type) {
      case 'integer':
      case 'bigint':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleInputChange(column.field, parseInt(e.target.value) || 0)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );
      case 'float':
        return (
          <input
            type="number"
            step="any"
            value={value}
            onChange={(e) => handleInputChange(column.field, parseFloat(e.target.value) || 0)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );
      case 'bool':
        return (
          <select
            value={value.toString()}
            onChange={(e) => handleInputChange(column.field, e.target.value === 'true')}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="false">False</option>
            <option value="true">True</option>
          </select>
        );
      case 'json':
        return (
          <div>
            <textarea
              value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleInputChange(column.field, parsed);
                } catch {
                  handleInputChange(column.field, e.target.value);
                }
              }}
              placeholder="Enter valid JSON"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32 font-mono text-sm"
            />
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              💡 Make sure your JSON is properly formatted
            </div>
          </div>
        );
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(column.field, e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:!bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {tableId ? `Table: ${tableId}` : 'Tables'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">
              {tableId 
                ? `Manage data in the ${tableId} table`
                : 'Manage your Manticore Search tables'
              }
            </p>
          </div>
          <div className="flex gap-2">
            {!tableId && (
              <button
                onClick={() => navigate('/tables?create=true')}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white rounded-md transition-colors"
              >
                Create Table
              </button>
            )}
            <button
              onClick={loadTables}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-white rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Tables Sidebar */}
        <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Available Tables</h2>
            {tables.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-300 mb-4">No tables found</p>
                <button
                  onClick={() => navigate('/tables?create=true')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white rounded-md transition-colors"
                >
                  Create Your First Table
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {tables.map((table) => (
                  <div
                    key={table.name}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      tableId === table.name
                        ? 'bg-blue-50 dark:bg-blue-900/50 border-blue-200 dark:border-blue-700'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600'
                    }`}
                    onClick={() => handleTableSelect(table.name)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">{table.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-300">
                          {table.columns?.length || 0} columns
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTable(table.name);
                        }}
                        className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden bg-gray-50 dark:!bg-gray-900">
          {!tableId ? (
            <div className="flex items-center justify-center h-full bg-white dark:!bg-gray-900">
              <div className="text-center">
                <div className="text-6xl mb-4">🗂️</div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Select a Table</h2>
                <p className="text-gray-500 dark:text-gray-300 mb-4">Choose a table from the sidebar to view and manage its data</p>
                <button
                  onClick={() => navigate('/tables?create=true')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white rounded-md transition-colors"
                >
                  Create New Table
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col bg-white dark:!bg-gray-900">
              {/* Table Data Header */}
              <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Table Data</h2>
                    {documentsData && (
                      <p className="text-sm text-gray-500 dark:text-gray-300">
                        {documentsData.total} documents total
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateDocument}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white rounded-md transition-colors"
                    >
                      Add Document
                    </button>
                  </div>
                </div>

                {/* Search */}
                <form onSubmit={handleSearch} className="mt-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Search documents..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white rounded-md transition-colors"
                    >
                      Search
                    </button>
                  </div>
                </form>
              </div>

              {/* Documents Table */}
              <div className="flex-1 overflow-auto p-6 bg-gray-50 dark:!bg-gray-900">
                {documentsData && documentsData.data.length > 0 ? (
                  <div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            {selectedTable?.columns?.map((column) => (
                              <th
                                key={column.field}
                                className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-600"
                              >
                                {column.field}
                              </th>
                            ))}
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-600">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {documentsData.data.map((document: any, index) => (
                            <tr key={document.id || index} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                              {selectedTable?.columns?.map((column) => (
                                <td
                                  key={column.field}
                                  className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 max-w-xs truncate"
                                >
                                  {typeof document[column.field] === 'object'
                                    ? JSON.stringify(document[column.field])
                                    : String(document[column.field] || '')}
                                </td>
                              ))}
                              <td className="px-4 py-2 text-sm border-b border-gray-200 dark:border-gray-700">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleEditDocument(document)}
                                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white rounded-md text-xs transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDocument(document.id)}
                                    className="px-2 py-1 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white rounded-md text-xs transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="mt-4 flex justify-between items-center">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-white rounded-md disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Page {currentPage}
                      </span>
                      <button
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={!documentsData || documentsData.data.length < 10}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-white rounded-md disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-4">📄</div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Documents</h3>
                    <p className="text-gray-500 dark:text-gray-300 mb-4">This table doesn't have any documents yet</p>
                    <button
                      onClick={handleCreateDocument}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white rounded-md transition-colors"
                    >
                      Add First Document
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table Creator Modal */}
      <TableCreator
        isOpen={shouldShowCreateTable}
        onClose={() => navigate('/tables')}
        onSuccess={() => {
          navigate('/tables');
          loadTables();
        }}
      />

      {/* Document Form Modal */}
      {showCreateDocumentForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingDocument ? 'Edit Document' : 'Create Document'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateDocumentForm(false);
                    setEditingDocument(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitDocument} className="space-y-4">
                {selectedTable?.columns
                  ?.filter(column => column.field !== 'id' || editingDocument)
                  .map((column) => (
                    <div key={column.field}>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {column.field} ({column.type})
                        {column.field === 'id' && editingDocument && ' (read-only)'}
                      </label>
                      {column.field === 'id' && editingDocument ? (
                        <input
                          type="text"
                          value={formData[column.field] || ''}
                          disabled
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white rounded-md"
                        />
                      ) : (
                        renderFormField(column)
                      )}
                    </div>
                  ))}

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateDocumentForm(false);
                      setEditingDocument(null);
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-white rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white rounded-md transition-colors"
                  >
                    {editingDocument ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
