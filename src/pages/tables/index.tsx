import React, { useState, useEffect, useCallback } from "react";
import { useCustomMutation, useCreate, useUpdate, useDelete, useList, BaseRecord } from "@refinedev/core";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { TableInfo } from "../../types/manticore";
import { TableCreator } from "../../components/table-creator/TableCreator";
import { toastMessages } from "../../utils/toast";

interface Document extends BaseRecord {
  id: string | number;
  [key: string]: unknown;
}

export const TablesPage: React.FC = () => {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [showCreateDocumentForm, setShowCreateDocumentForm] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
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

  const loadTables = useCallback(() => {
    fetchTables(
      {
        url: "/tables",
        method: "post",
        values: {},
      },
      {
        onSuccess: (data) => {
          setTables((data.data as unknown[]) as TableInfo[]);
        },
      }
    );
  }, [fetchTables]);

  const loadTableInfo = useCallback((tableName: string) => {
    fetchTableInfo(
      {
        url: "/table-info",
        method: "post",
        values: { table: tableName },
      },
      {
        onSuccess: (data) => {
          setSelectedTable(data.data as TableInfo);
        },
        onError: (error) => {
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
  }, [fetchTableInfo]);

  // Load tables on mount
  useEffect(() => {
    loadTables();
  }, [loadTables]);

  // Load table info when tableId changes
  useEffect(() => {
    if (tableId) {
      loadTableInfo(tableId);
    } else {
      setSelectedTable(null);
    }
  }, [tableId, loadTableInfo]);

  const handleTableSelect = (tableName: string) => {
    navigate(`/tables/${tableName}`);
  };

  const handleDeleteTable = async (tableName: string) => {
    await toastMessages.confirmDelete(
      tableName,
      () => {
        return new Promise<void>((resolve, reject) => {
          deleteTable(
            {
              url: "/sql",
              method: "post",
              values: { query: `DROP TABLE ${tableName}` },
            },
            {
              onSuccess: () => {
                loadTables();
                if (tableId === tableName) {
                  navigate("/tables");
                }
                resolve();
              },
              onError: (error) => {
                console.error('Failed to delete table:', error);
                reject(error);
              },
            }
          );
        });
      },
      'table'
    );
  };

  const initializeDocumentForm = () => {
    const initialData: Record<string, unknown> = {};
    if (selectedTable?.columns) {
      selectedTable.columns.forEach((column) => {
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

  const handleEditDocument = (document: Document) => {
    setFormData({ ...document });
    setEditingDocument(document);
    setShowCreateDocumentForm(true);
  };

  const handleDeleteDocument = async (id: string | number) => {
    if (!tableId) return;

    await toastMessages.confirmDelete(
      `document with ID ${id}`,
      () => {
        return new Promise<void>((resolve, reject) => {
          deleteDocument(
            {
              resource: tableId,
              id,
            },
            {
              onSuccess: () => {
                refetchDocuments();
                resolve();
              },
              onError: (error) => {
                console.error('Failed to delete document:', error);
                reject(error);
              },
            }
          );
        });
      },
      'document'
    );
  };

  const handleSubmitDocument = (e: React.FormEvent) => {
    e.preventDefault();

    if (!tableId) return;

    if (editingDocument) {
      updateDocument(
        {
          resource: tableId,
          id: editingDocument.id,
          values: formData,
        },
        {
          onSuccess: () => {
            setShowCreateDocumentForm(false);
            setEditingDocument(null);
            refetchDocuments();
            toastMessages.documentUpdated();
          },
          onError: (error) => {
            toastMessages.generalError('update document', error);
          },
        }
      );
    } else {
      createDocument(
        {
          resource: tableId,
          values: formData,
        },
        {
          onSuccess: () => {
            setShowCreateDocumentForm(false);
            refetchDocuments();
            toastMessages.documentCreated();
          },
          onError: (error) => {
            toastMessages.generalError('create document', error);
          },
        }
      );
    }
  };

  const handleInputChange = (field: string, value: unknown) => {
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

  const renderFormField = (column: { field: string; type: string }) => {
    const value = formData[column.field] || '';

    switch (column.type) {
      case 'integer':
      case 'bigint':
        return (
          <input
            type="number"
            value={String(value)}
            onChange={(e) => handleInputChange(column.field, parseInt(e.target.value) || 0)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );
      case 'float':
        return (
          <input
            type="number"
            step="any"
            value={String(value)}
            onChange={(e) => handleInputChange(column.field, parseFloat(e.target.value) || 0)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );
      case 'bool':
        return (
          <select
            value={String(value)}
            onChange={(e) => handleInputChange(column.field, e.target.value === 'true')}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="false">False</option>
            <option value="true">True</option>
          </select>
        );
      case 'json':
        return (
          <div>
            <textarea
              value={typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleInputChange(column.field, parsed);
                } catch {
                  handleInputChange(column.field, e.target.value);
                }
              }}
              placeholder="Enter valid JSON"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32 font-mono text-sm"
            />
            <div className="mt-1 text-xs text-gray-500">
              💡 Make sure your JSON is properly formatted
            </div>
          </div>
        );
      default:
        return (
          <input
            type="text"
            value={String(value)}
            onChange={(e) => handleInputChange(column.field, e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {tableId ? `Table: ${tableId}` : 'Tables'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
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
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Create Table
              </button>
            )}
            <button
              onClick={loadTables}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Tables Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Tables</h2>
            {tables.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No tables found</p>
                <button
                  onClick={() => navigate('/tables?create=true')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
                        ? 'bg-blue-50 border-blue-200'
                        : 'hover:bg-gray-50 border-gray-200'
                    }`}
                    onClick={() => handleTableSelect(table.name)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{table.name}</h3>
                        <p className="text-sm text-gray-500">
                          {table.columns?.length || 0} columns
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTable(table.name);
                        }}
                        className="text-red-500 hover:text-red-700 text-sm"
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
        <div className="flex-1 overflow-hidden">
          {!tableId ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-6xl mb-4">🗂️</div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Select a Table</h2>
                <p className="text-gray-500 mb-4">Choose a table from the sidebar to view and manage its data</p>
                <button
                  onClick={() => navigate('/tables?create=true')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create New Table
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {/* Table Data Header */}
              <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Table Data</h2>
                    {documentsData && (
                      <p className="text-sm text-gray-500">
                        {documentsData.total} documents total
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateDocument}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
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
                      className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Search
                    </button>
                  </div>
                </form>
              </div>

              {/* Documents Table */}
              <div className="flex-1 overflow-auto p-6">
                {documentsData && documentsData.data.length > 0 ? (
                  <div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full bg-white border border-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {selectedTable?.columns?.map((column) => (
                              <th
                                key={column.field}
                                className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b"
                              >
                                {column.field}
                              </th>
                            ))}
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {documentsData.data.map((document, index) => (
                            <tr key={document.id || index} className="hover:bg-gray-50">
                              {selectedTable?.columns?.map((column) => (
                                <td
                                  key={column.field}
                                  className="px-4 py-2 text-sm text-gray-900 border-b max-w-xs truncate"
                                >
                                  {typeof document[column.field] === 'object'
                                    ? JSON.stringify(document[column.field])
                                    : String(document[column.field] || '')}
                                </td>
                              ))}
                              <td className="px-4 py-2 text-sm border-b">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleEditDocument(document as Document)}
                                    className="px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => document.id && handleDeleteDocument(document.id)}
                                    className="px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs"
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
                        className="px-4 py-2 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-600">
                        Page {currentPage}
                      </span>
                      <button
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={!documentsData || documentsData.data.length < 10}
                        className="px-4 py-2 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-4">📄</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Documents</h3>
                    <p className="text-gray-500 mb-4">This table doesn't have any documents yet</p>
                    <button
                      onClick={handleCreateDocument}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
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
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">
                  {editingDocument ? 'Edit Document' : 'Create Document'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateDocumentForm(false);
                    setEditingDocument(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitDocument} className="space-y-4">
                {selectedTable?.columns
                  ?.filter(column => column.field !== 'id' || editingDocument)
                  .map((column) => (
                    <div key={column.field}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {column.field} ({column.type})
                        {column.field === 'id' && editingDocument && ' (read-only)'}
                      </label>
                      {column.field === 'id' && editingDocument ? (
                        <input
                          type="text"
                          value={String(formData[column.field] || '')}
                          disabled
                          className="w-full p-2 border border-gray-300 rounded-md bg-gray-100"
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
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
