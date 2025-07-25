import React, { useState, useEffect } from "react";
import { useList, useCreate, useUpdate, useDelete, useCustomMutation, BaseRecord } from "@refinedev/core";
import { TableInfo } from "../../types/manticore";
import { toastMessages } from "../../utils/toast";

interface DataManagerProps {
  tables: TableInfo[];
}

interface Document extends BaseRecord {
  id: string | number;
  [key: string]: any;
}

export const DataManager: React.FC<DataManagerProps> = ({ tables }) => {
  const [selectedTableName, setSelectedTableName] = useState<string>("");
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const { mutate: fetchTableInfo } = useCustomMutation();

  // Fetch table data
  const { data: documentsData, isLoading: isLoadingData, refetch: refetchData } = useList({
    resource: selectedTableName,
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
      enabled: !!selectedTableName,
    },
  });

  const { mutate: createDocument } = useCreate();
  const { mutate: updateDocument } = useUpdate();
  const { mutate: deleteDocument } = useDelete();

  useEffect(() => {
    if (selectedTableName && tables.length > 0) {
      console.log('Fetching table info for:', selectedTableName);
      // Get table info for the selected table
      fetchTableInfo(
        {
          url: "/table-info",
          method: "post",
          values: { table: selectedTableName },
        },
        {
          onSuccess: (data: any) => {
            console.log('Table info received:', data);
            const tableInfo = data.data as TableInfo;
            setSelectedTable(tableInfo);
            console.log('Table columns:', tableInfo.columns);
          },
          onError: (error: any) => {
            console.error('Failed to fetch table info:', error);
            // Set a fallback table structure
            setSelectedTable({
              name: selectedTableName,
              columns: [
                { field: 'id', type: 'bigint', properties: '' },
                { field: 'data', type: 'json', properties: '' }
              ]
            });
          }
        }
      );
    }
  }, [selectedTableName, tables]);

  const handleTableChange = (tableName: string) => {
    setSelectedTableName(tableName);
    setCurrentPage(1);
    setSearchQuery("");
    setShowCreateForm(false);
    setEditingDocument(null);
  };

  const initializeFormData = () => {
    const initialData: Record<string, any> = {};
    if (selectedTable?.columns) {
      console.log('Initializing form data for table:', selectedTable.name, 'with columns:', selectedTable.columns);
      selectedTable.columns.forEach(column => {
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
              // Create a helpful example for JSON fields
              if (column.field === 'data') {
                initialData[column.field] = {
                  title: "Sample Document Title",
                  content: "This is sample content for your document",
                  author: "John Doe",
                  tags: ["tag1", "tag2"],
                  published: true,
                  rating: 4.5,
                  metadata: {
                    created_at: new Date().toISOString(),
                    category: "example"
                  }
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
    } else {
      console.log('No selectedTable or columns available');
      // Fallback for when table schema isn't loaded
      initialData.data = {
        title: "Sample Document Title",
        content: "This is sample content for your document",
        author: "John Doe",
        tags: ["tag1", "tag2"],
        published: true,
        rating: 4.5
      };
    }
    console.log('Initial form data:', initialData);
    return initialData;
  };

  const handleCreate = () => {
    console.log('Handle create called. Selected table:', selectedTable);
    console.log('Selected table columns:', selectedTable?.columns);
    
    if (!selectedTable || !selectedTable.columns || selectedTable.columns.length === 0) {
      toastMessages.selectTable();
      return;
    }
    
    const initialData = initializeFormData();
    setFormData(initialData);
    setShowCreateForm(true);
    setEditingDocument(null);
  };

  const handleEdit = (document: Document) => {
    setFormData({ ...document });
    setEditingDocument(document);
    setShowCreateForm(true);
  };

  const handleDelete = async (id: string | number) => {
    await toastMessages.confirmDelete(
      `document with ID ${id}`,
      () => {
        return new Promise<void>((resolve, reject) => {
          deleteDocument(
            {
              resource: selectedTableName,
              id,
            },
            {
              onSuccess: () => {
                refetchData();
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingDocument) {
      // Update existing document
      updateDocument(
        {
          resource: selectedTableName,
          id: editingDocument.id,
          values: formData,
        },
        {
          onSuccess: () => {
            setShowCreateForm(false);
            setEditingDocument(null);
            refetchData();
          },
        }
      );
    } else {
      // Create new document
      createDocument(
        {
          resource: selectedTableName,
          values: formData,
        },
        {
          onSuccess: () => {
            setShowCreateForm(false);
            refetchData();
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
    refetchData();
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
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );
      case 'float':
        return (
          <input
            type="number"
            step="any"
            value={value}
            onChange={(e) => handleInputChange(column.field, parseFloat(e.target.value) || 0)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );
      case 'bool':
        return (
          <select
            value={value.toString()}
            onChange={(e) => handleInputChange(column.field, e.target.value === 'true')}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="false">False</option>
            <option value="true">True</option>
          </select>
        );
      case 'json': {
        // Create example JSON structure based on table columns
        const exampleJson = selectedTable?.columns ? 
          selectedTable.columns.reduce((acc, col) => {
            if (col.field !== 'id') {
              switch (col.type) {
                case 'integer':
                case 'bigint':
                  acc[col.field] = 123;
                  break;
                case 'float':
                  acc[col.field] = 123.45;
                  break;
                case 'bool':
                  acc[col.field] = true;
                  break;
                case 'json':
                  acc[col.field] = { "example": "value" };
                  break;
                default:
                  acc[col.field] = "example text";
              }
            }
            return acc;
          }, {} as Record<string, unknown>) : {};

        const placeholder = `Example structure:\n${JSON.stringify(exampleJson, null, 2)}`;
        
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
              placeholder={placeholder}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32 font-mono text-sm"
            />
            <div className="mt-1 text-xs text-gray-500">
              💡 Tip: Use the example structure above. Make sure your JSON is valid.
            </div>
          </div>
        );
      }
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(column.field, e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Data Manager</h2>
          {selectedTableName && (
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!selectedTable || !selectedTable.columns || selectedTable.columns.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Add Document
                {(!selectedTable || !selectedTable.columns || selectedTable.columns.length === 0) && 
                  ' (Loading...)'
                }
              </button>
              {selectedTable?.columns && (
                <span className="px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-md">
                  {selectedTable.columns.length} columns available
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Table
          </label>
          <select
            value={selectedTableName}
            onChange={(e) => handleTableChange(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Choose a table...</option>
            {tables.map((table) => (
              <option key={table.name} value={table.name}>
                {table.name}
              </option>
            ))}
          </select>
        </div>

        {selectedTableName && (
          <form onSubmit={handleSearch} className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Search
              </button>
            </div>
          </form>
        )}

        {selectedTableName && documentsData && (
          <div>
            <div className="mb-4 text-sm text-gray-600">
              Total: {documentsData.total} documents
            </div>

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
                  {documentsData.data.map((document: BaseRecord, index) => (
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
                            onClick={() => handleEdit(document as Document)}
                            className="px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(document.id!)}
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
                disabled={documentsData.data.length < 10}
                className="px-4 py-2 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">
                  {editingDocument ? 'Edit Document' : 'Create Document'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingDocument(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {/* Debug info */}
              {process.env.NODE_ENV === 'development' && (
                <div className="mb-4 p-2 bg-gray-100 rounded text-xs">
                  <div>Selected Table: {selectedTable?.name || 'None'}</div>
                  <div>Columns: {selectedTable?.columns?.length || 0}</div>
                  <div>Form Data Keys: {Object.keys(formData).join(', ')}</div>
                </div>
              )}

              {!selectedTable || !selectedTable.columns || selectedTable.columns.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">Loading table information...</p>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  
                  {/* Fallback form with manual JSON input */}
                  <div className="mt-6 text-left">
                    <p className="text-sm text-gray-600 mb-2">Or enter document data manually:</p>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        Document Data (JSON format)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const exampleData = {
                            title: "Sample Document Title",
                            content: "This is sample content for your document",
                            author: "John Doe",
                            tags: ["tag1", "tag2"],
                            published: true,
                            rating: 4.5,
                            metadata: {
                              created_at: new Date().toISOString(),
                              category: "example"
                            }
                          };
                          setFormData(exampleData);
                        }}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        Fill with Example
                      </button>
                    </div>
                    <textarea
                      value={typeof formData === 'object' ? JSON.stringify(formData, null, 2) : JSON.stringify({}, null, 2)}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          setFormData(parsed);
                        } catch {
                          // Keep the raw text if JSON is invalid
                        }
                      }}
                      placeholder={`Enter your document data in JSON format, for example:
{
  "title": "Sample Title",
  "content": "Sample content text",
  "author": "John Doe",
  "published": true,
  "rating": 4.5,
  "tags": ["tag1", "tag2"]
}`}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent h-40 font-mono text-sm"
                    />
                    <div className="mt-2 text-xs text-gray-500 flex justify-between items-center">
                      <span>💡 Make sure your JSON is properly formatted. Use double quotes for strings.</span>
                      <button
                        type="button"
                        onClick={() => setFormData({})}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        Clear
                      </button>
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateForm(false);
                          setEditingDocument(null);
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmit}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        {editingDocument ? 'Update' : 'Create'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {selectedTable.columns
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
                            value={formData[column.field] || ''}
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
                        setShowCreateForm(false);
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
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
