import React, { useState, useEffect, useCallback } from "react";
import { useCustomMutation, useCreate, useUpdate, useDelete, useList, BaseRecord } from "@refinedev/core";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { TableInfo } from "../../types/manticore";
import { TableCreator } from "../../components/table-creator/TableCreator";
import { TableSchemaEditor } from "../../components/table-schema-editor";
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
  const [showSchemaEditor, setShowSchemaEditor] = useState(false);
  
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
              url: "/cli_json",
              method: "post",
              values: { command: `DROP TABLE ${tableName}` },
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

  const handleTableUpdated = (updatedTable: TableInfo) => {
    setSelectedTable(updatedTable);
    // Update the table in the tables list as well
    setTables(prev => prev.map(table => 
      table.name === updatedTable.name ? updatedTable : table
    ));
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
            className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );
      case 'float':
        return (
          <input
            type="number"
            step="any"
            value={String(value)}
            onChange={(e) => handleInputChange(column.field, parseFloat(e.target.value) || 0)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );
      case 'bool':
        return (
          <select
            value={String(value)}
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
              className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32 font-mono text-sm"
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
            value={String(value)}
            onChange={(e) => handleInputChange(column.field, e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white truncate">
              {tableId ? `Table: ${tableId}` : 'Tables'}
            </h1>
            <p className="text-xs lg:text-sm text-gray-500 dark:text-gray-400 mt-1">
              {tableId 
                ? `Manage data in the ${tableId} table`
                : 'Manage your Manticore Search tables'
              }
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!tableId && (
              <button
                onClick={() => navigate('/tables?create=true')}
                className="px-3 lg:px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-sm lg:text-base"
              >
                Create Table
              </button>
            )}
            {tableId && selectedTable && (
              <button
                onClick={() => setShowSchemaEditor(true)}
                className="px-3 lg:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-sm lg:text-base"
              >
                Edit Schema
              </button>
            )}
            <button
              onClick={loadTables}
              className="px-3 lg:px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 text-sm lg:text-base"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Tables Sidebar - Hidden on mobile, shown as overlay when needed */}
        <div className="hidden lg:block lg:w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Available Tables</h2>
            {tables.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400 mb-4">No tables found</p>
                <button
                  onClick={() => navigate('/tables?create=true')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
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
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-600'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600'
                    }`}
                    onClick={() => handleTableSelect(table.name)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">{table.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {table.columns?.length || 0} columns
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTable(table.name);
                        }}
                        className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm ml-2 flex-shrink-0"
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

        {/* Mobile Table Selector */}
        {!tableId && (
          <div className="lg:hidden flex-1 p-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Select a Table</h2>
              {tables.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">🗂️</div>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">No tables found</p>
                  <button
                    onClick={() => navigate('/tables?create=true')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
                  >
                    Create Your First Table
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {tables.map((table) => (
                    <div
                      key={table.name}
                      className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => handleTableSelect(table.name)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-gray-900 dark:text-white truncate">{table.name}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {table.columns?.length || 0} columns
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 ml-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTableSelect(table.name);
                            }}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                          >
                            View
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTable(table.name);
                            }}
                            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Content */}
        {!tableId ? (
          <div className="hidden lg:flex flex-1 overflow-hidden bg-white dark:bg-gray-800">
            <div className="flex items-center justify-center h-full w-full">
              <div className="text-center">
                <div className="text-6xl mb-4">🗂️</div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Select a Table</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-4">Choose a table from the sidebar to view and manage its data</p>
                <button
                  onClick={() => navigate('/tables?create=true')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
                >
                  Create New Table
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-800">
            {/* Back button for mobile */}
            <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
              <button
                onClick={() => navigate('/tables')}
                className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Tables
              </button>
            </div>

            {/* Table Data Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-white">Table Data</h2>
                  {documentsData && (
                    <p className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">
                      {documentsData.total} documents total
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateDocument}
                    className="px-3 lg:px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-sm lg:text-base"
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
                    className="flex-1 p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base"
                  />
                  <button
                    type="submit"
                    className="px-3 lg:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-sm lg:text-base"
                  >
                    Search
                  </button>
                </div>
              </form>
            </div>

            {/* Documents Table */}
            <div className="flex-1 overflow-auto p-4 lg:p-6 bg-white dark:bg-gray-800">
              {documentsData && documentsData.data.length > 0 ? (
                <div>
                  {/* Mobile: Card layout, Desktop: Table layout */}
                  <div className="lg:hidden space-y-4">
                    {documentsData.data.map((document, index) => (
                      <div
                        key={`doc-${document.id || 'no-id'}-${index}`}
                        className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600"
                      >
                        {selectedTable?.columns?.map((column) => (
                          <div key={column.field} className="mb-2 last:mb-0">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              {column.field}:
                            </span>
                            <div className="text-sm text-gray-900 dark:text-gray-100 mt-1 break-words">
                              {typeof document[column.field] === 'object'
                                ? JSON.stringify(document[column.field])
                                : String(document[column.field] || '')}
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                          <button
                            onClick={() => handleEditDocument(document as Document)}
                            className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => document.id && handleDeleteDocument(document.id)}
                            className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-xs"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table view */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
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
                        {documentsData.data.map((document, index) => (
                          <tr key={`doc-${document.id || 'no-id'}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
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
                                  onClick={() => handleEditDocument(document as Document)}
                                  className="px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-xs"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => document.id && handleDeleteDocument(document.id)}
                                  className="px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-xs"
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
                  <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 text-sm lg:text-base"
                    >
                      Previous
                    </button>
                    <span className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">
                      Page {currentPage}
                    </span>
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={!documentsData || documentsData.data.length < 10}
                      className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 text-sm lg:text-base"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">📄</div>
                  <h3 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-white mb-2">No Documents</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm lg:text-base">This table doesn't have any documents yet</p>
                  <button
                    onClick={handleCreateDocument}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                  >
                    Add First Document
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 lg:p-6">
              <div className="flex items-center justify-between mb-4 lg:mb-6">
                <h3 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white">
                  {editingDocument ? 'Edit Document' : 'Create Document'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateDocumentForm(false);
                    setEditingDocument(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitDocument} className="space-y-3 lg:space-y-4">
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
                          value={String(formData[column.field] || '')}
                          disabled
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-sm lg:text-base"
                        />
                      ) : (
                        renderFormField(column)
                      )}
                    </div>
                  ))}

                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateDocumentForm(false);
                      setEditingDocument(null);
                    }}
                    className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 text-sm lg:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-sm lg:text-base"
                  >
                    {editingDocument ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Schema Editor Modal */}
      {showSchemaEditor && selectedTable && (
        <TableSchemaEditor
          table={selectedTable}
          onClose={() => setShowSchemaEditor(false)}
          onTableUpdated={handleTableUpdated}
        />
      )}
    </div>
  );
};
