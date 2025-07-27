import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useCustomMutation, useDelete, useList, BaseRecord } from "@refinedev/core";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { TableInfo } from "../../types/manticore";
import { TableCreator } from "../../components/table-creator/TableCreator";
import { TableSchemaEditor } from "../../components/table-schema-editor";
import { DocumentForm } from "../../components/forms";
import { TableCellRenderer } from "../../components/table-cell-renderer";
import { DataImportModal } from "../../components/data-import-modal";
import { SearchFilter, SearchParams } from "../../components/search-filter";
import { toastMessages } from "../../utils/toast";

interface Document extends BaseRecord {
  id: string | number;
  [key: string]: unknown;
}

export const TablesPage: React.FC = () => {
  const [previewedRecord, setPreviewedRecord] = useState<Document | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  
  // Memoize selectedTable to prevent unnecessary SearchFilter re-renders
  const stableSelectedTable = useMemo(() => {
    if (!selectedTable) return null;
    // Create a stable reference by only including essential properties
    return {
      name: selectedTable.name,
      columns: selectedTable.columns || []
    } as TableInfo;
  }, [selectedTable]);
  const [showCreateDocumentForm, setShowCreateDocumentForm] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchParameters, setSearchParameters] = useState<SearchParams | null>(null);
  const [showSchemaEditor, setShowSchemaEditor] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Loading states
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tableInfoLoading, setTableInfoLoading] = useState(false);
  const [searchFacets, setSearchFacets] = useState<Record<string, any> | null>(null);
  const [appliedFacetFilters, setAppliedFacetFilters] = useState<Record<string, string[]>>({});
  const [facetsExpanded, setFacetsExpanded] = useState(true);
  
  const { tableId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shouldShowCreateTable = searchParams.get('create') === 'true';

  const { mutate: fetchTables } = useCustomMutation();
  const { mutate: fetchTableInfo } = useCustomMutation();
  const { mutate: deleteTable } = useCustomMutation();
  const { mutate: deleteTableVectorSettings } = useCustomMutation();
  const { mutate: deleteDocument } = useDelete();

  // Memoize the useList parameters to prevent unnecessary re-renders
  const listParams = useMemo(() => ({
    resource: tableId || "",
    pagination: {
      current: currentPage,
      pageSize: 10,
    },
    filters: searchParameters?.type === 'basic' && searchParameters.query ? [
      {
        field: "query_string",
        operator: "contains",
        value: searchParameters.query,
      } as any
    ] : undefined,
    meta: searchParameters ? { searchParams: searchParameters } : undefined,
    queryOptions: {
      enabled: !!tableId,
    },
  }), [tableId, currentPage, searchParameters]);

  // Fetch documents for selected table
  const { data: documentsData, refetch: refetchDocuments, isLoading: documentsListLoading } = useList(listParams);
  
  // Extract facets from the documents data when it changes
  useEffect(() => {
    if (documentsData && (documentsData as any).facets) {
      setSearchFacets((documentsData as any).facets);
    } else {
      setSearchFacets(null);
    }
  }, [documentsData]);

  const loadTables = useCallback(() => {
    setTablesLoading(true);
    fetchTables(
      {
        url: "/tables",
        method: "post",
        values: {},
      },
      {
        onSuccess: (data) => {
          setTables((data.data as unknown[]) as TableInfo[]);
          setTablesLoading(false);
        },
        onError: () => {
          setTablesLoading(false);
        },
      }
    );
  }, [fetchTables]); // Keep fetchTables but this should be stable from useCustomMutation

  const loadTableInfo = useCallback((tableName: string) => {
    setTableInfoLoading(true);
    fetchTableInfo(
      {
        url: "/table-info",
        method: "post",
        values: { table: tableName },
      },
      {
        onSuccess: (data) => {
          setSelectedTable(data.data as TableInfo);
          setTableInfoLoading(false);
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
          setTableInfoLoading(false);
        }
      }
    );
  }, [fetchTableInfo]); // Keep fetchTableInfo but this should be stable from useCustomMutation

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
              onSuccess: async () => {
                // Clean up vector settings for this table
                try {
                  await new Promise<void>((resolveVector) => {
                    deleteTableVectorSettings(
                      {
                        url: `/embeddings/vector-columns/tables/${tableName}`,
                        method: "delete",
                        values: {},
                      },
                      {
                        onSuccess: () => {
                          console.log(`Vector settings for table ${tableName} deleted successfully`);
                          resolveVector();
                        },
                        onError: (error) => {
                          console.error(`Failed to delete vector settings for table ${tableName}:`, error);
                          // Don't fail the entire process if vector cleanup fails
                          resolveVector();
                        },
                      }
                    );
                  });
                } catch (error) {
                  console.error(`Error deleting vector settings for table ${tableName}:`, error);
                }
                
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
              onError: (error: unknown) => {
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

  const handleCreateDocument = () => {
    setEditingDocument(null);
    setShowCreateDocumentForm(true);
  };

  const handleEditDocument = (document: Document) => {
    setEditingDocument(document);
    setShowCreateDocumentForm(true);
  };

  const handleSearch = useCallback((newSearchParams: SearchParams) => {
    setSearchParameters(newSearchParams);
    setCurrentPage(1);
  }, []);

  const handleResetSearch = useCallback(() => {
    setSearchParameters(null);
    setAppliedFacetFilters({});
    setCurrentPage(1);
  }, []);

  // Handle facet filter changes
  const handleFacetFilterChange = useCallback((fieldName: string, value: string, checked: boolean) => {
    setAppliedFacetFilters(prev => {
      const updated = { ...prev };
      if (!updated[fieldName]) {
        updated[fieldName] = [];
      }
      
      if (checked) {
        // Add the value if it's not already present
        if (!updated[fieldName].includes(value)) {
          updated[fieldName] = [...updated[fieldName], value];
        }
      } else {
        // Remove the value
        updated[fieldName] = updated[fieldName].filter(v => v !== value);
        // Remove empty arrays
        if (updated[fieldName].length === 0) {
          delete updated[fieldName];
        }
      }
      
      return updated;
    });
  }, []);

  // Apply facet filters to search
  const applyFacetFilters = useCallback(() => {
    if (Object.keys(appliedFacetFilters).length === 0) {
      return; // No filters to apply
    }

    // When facet filters are applied, we need to update the search to include them
    // Start with the base search parameters or create a basic search
    let baseSearchParams: SearchParams;
    
    if (searchParameters) {
      baseSearchParams = { ...searchParameters };
    } else {
      // No existing search - create a match_all query with facet filters
      baseSearchParams = {
        type: 'basic',
        query: '*', // Match all documents
        facets: (searchParameters as any)?.facets || [], // Preserve existing facets config
        appliedFacetFilters: appliedFacetFilters
      };
    }

    // Add the applied facet filters to the search params
    baseSearchParams.appliedFacetFilters = appliedFacetFilters;

    setSearchParameters(baseSearchParams);
    setCurrentPage(1);
  }, [appliedFacetFilters, searchParameters]);

  // Auto-apply filters when facet selections change
  useEffect(() => {
    if (Object.keys(appliedFacetFilters).length > 0) {
      applyFacetFilters();
    } else if (Object.keys(appliedFacetFilters).length === 0 && searchParameters?.type === 'advanced') {
      // If no facet filters and we have advanced search with only facet filters, reset to basic
      const hasNonFacetFilters = searchParameters.filters?.some(f => 
        f.field === 'query_string' || !Object.keys({}).includes(f.field)
      ) || false;
      
      if (!hasNonFacetFilters) {
        setSearchParameters(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFacetFilters]);

  // Remove the problematic useEffect that causes infinite loops
  // The useList hook will automatically refetch when its memoized parameters change

  const handleTableUpdated = (updatedTable: TableInfo) => {
    setSelectedTable(updatedTable);
    // Update the table in the tables list as well
    setTables(prev => prev.map(table => 
      table.name === updatedTable.name ? updatedTable : table
    ));
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
            {tablesLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400">Loading tables...</p>
              </div>
            ) : tables.length === 0 ? (
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
                      <div className="flex items-center gap-2 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTable(table);
                            setShowSchemaEditor(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 text-sm flex-shrink-0 border border-blue-200 dark:border-blue-600 rounded px-2 py-1 bg-white dark:bg-gray-800"
                        >
                          Edit Schema
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTable(table.name);
                          }}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm flex-shrink-0 border border-red-200 dark:border-red-600 rounded px-2 py-1 bg-white dark:bg-gray-800"
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
                  <div className="flex items-center gap-2">
                    <h2 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-white">Table Data</h2>
                    {tableInfoLoading && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    )}
                  </div>
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
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="px-3 lg:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-sm lg:text-base"
                  >
                    Import Data
                  </button>
                </div>
              </div>

              {/* Advanced Search */}
              {stableSelectedTable && !tableInfoLoading && (
                <div className="mt-4">
                  <SearchFilter
                    table={stableSelectedTable}
                    onSearch={handleSearch}
                    onReset={handleResetSearch}
                  />
                </div>
              )}
              
              {/* Interactive Facets Display */}
              {searchFacets && Object.keys(searchFacets).length > 0 && (
                <div className="mt-4 border border-blue-200 dark:border-blue-700 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <div className="p-4 pb-2">
                    <div className="flex items-center justify-between mb-2">
                      <button
                        onClick={() => setFacetsExpanded(!facetsExpanded)}
                        className="flex items-center gap-2 text-sm font-semibold text-blue-800 dark:text-blue-200 hover:text-blue-900 dark:hover:text-blue-100"
                      >
                        <span className={`transform transition-transform ${facetsExpanded ? 'rotate-90' : ''}`}>
                          ▶
                        </span>
                        📊 Search Facets & Filters
                        <span className="text-xs bg-blue-200 dark:bg-blue-800 px-2 py-1 rounded-full">
                          {Object.keys(searchFacets).length}
                        </span>
                      </button>
                      <div className="flex items-center gap-2">
                        {Object.keys(appliedFacetFilters).length > 0 && (
                          <span className="text-xs text-blue-700 dark:text-blue-300 bg-blue-200 dark:bg-blue-800 px-2 py-1 rounded-full">
                            {Object.values(appliedFacetFilters).flat().length} active
                          </span>
                        )}
                        {Object.keys(appliedFacetFilters).length > 0 && (
                          <button
                            onClick={() => {
                              setAppliedFacetFilters({});
                              handleResetSearch();
                            }}
                            className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800"
                          >
                            Clear All
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Applied Filters Summary - Always visible */}
                  {Object.keys(appliedFacetFilters).length > 0 && (
                    <div className="px-4 pb-3">
                      <div className="bg-white dark:bg-gray-800 rounded border border-blue-100 dark:border-blue-800 p-3">
                        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                          🏷️ Active Filters ({Object.values(appliedFacetFilters).flat().length})
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(appliedFacetFilters).map(([fieldName, values]) =>
                            values.map(value => (
                              <span
                                key={`${fieldName}-${value}`}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                              >
                                {fieldName}: {value}
                                <button
                                  onClick={() => handleFacetFilterChange(fieldName, value, false)}
                                  className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                                >
                                  ✕
                                </button>
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Collapsible Facets Content */}
                  {facetsExpanded && (
                    <div className="p-4 pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(searchFacets).map(([facetName, facetData]) => {
                          const fieldName = facetName.replace('facet_', '').replace(/_\d+$/, '');
                          return (
                            <div key={facetName} className="bg-white dark:bg-gray-800 p-3 rounded-md border border-blue-100 dark:border-blue-800">
                              <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 uppercase">
                                {fieldName}
                              </h4>
                              <div className="space-y-1 max-h-48 overflow-y-auto">
                                {facetData?.buckets ? (
                                  // Terms aggregation with checkboxes
                                  facetData.buckets.slice(0, 20).map((bucket: any, index: number) => {
                                    const bucketValue = String(bucket.key || bucket._key || 'Unknown');
                                    const isChecked = appliedFacetFilters[fieldName]?.includes(bucketValue) || false;
                                    
                                    return (
                                      <label
                                        key={index}
                                        className="flex items-center justify-between text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded"
                                      >
                                        <div className="flex items-center min-w-0 flex-1">
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={(e) => handleFacetFilterChange(fieldName, bucketValue, e.target.checked)}
                                            className="mr-2 rounded text-blue-600 focus:ring-blue-500"
                                          />
                                          <span className="text-gray-700 dark:text-gray-300 truncate">
                                            {bucketValue}
                                          </span>
                                        </div>
                                        <span className={`ml-2 font-medium px-2 py-1 rounded text-xs ${
                                          isChecked 
                                            ? 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
                                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                        }`}>
                                          {bucket.doc_count || bucket.count || 0}
                                        </span>
                                      </label>
                                    );
                                  })
                                ) : (
                                  // Other aggregation types (non-interactive)
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    <pre className="whitespace-pre-wrap text-xs">
                                      {JSON.stringify(facetData, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="mt-3 text-xs text-blue-700 dark:text-blue-300">
                        💡 Check boxes to filter results. Selected filters are applied automatically.
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Table loading placeholder */}
              {tableInfoLoading && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/4 mb-2"></div>
                    <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
                  </div>
                </div>
              )}
            </div>

            {/* Documents Table */}
            <div className="flex-1 flex overflow-auto p-4 lg:p-6 bg-white dark:bg-gray-800">
              {tableInfoLoading || documentsListLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-500 dark:text-gray-400">Loading table data...</p>
                </div>
              ) : documentsData && documentsData.data.length > 0 ? (
                <div className="flex w-full h-full">
                  {/* Table and Pagination */}
                  <div className="flex-1 flex flex-col">
                    {/* Mobile: Card layout */}
                    <div className="lg:hidden space-y-4">
                      {documentsData.data.map((document, index) => (
                        <div
                          key={`doc-${document.id || 'no-id'}-${index}`}
                          className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600"
                          onClick={() => {
                            setPreviewedRecord(document as Document);
                            setShowDetailPanel(true);
                          }}
                        >
                          {selectedTable?.columns?.map((column) => (
                            <div key={column.field} className="mb-2 last:mb-0">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                {column.field}:
                              </span>
                              <div className="text-sm text-gray-900 dark:text-gray-100 mt-1 break-words">
                                <TableCellRenderer 
                                  value={document[column.field]}
                                  columnField={column.field}
                                  columnType={column.type}
                                  tableName={selectedTable.name}
                                />
                              </div>
                            </div>
                          ))}
                          {/* Add score in mobile view */}
                          {(document as any)._score !== undefined && (
                            <div className="mb-2">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                🏆 Score:
                              </span>
                              <div className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                                  {((document as any)._score as number).toFixed(3)}
                                </span>
                              </div>
                            </div>
                          )}
                          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditDocument(document as Document);
                              }}
                              className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-xs"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                document.id && handleDeleteDocument(document.id);
                              }}
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
                            {/* Add score column if any document has _score */}
                            {documentsData?.data.some(doc => (doc as any)._score !== undefined) && (
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-600">
                                🏆 Score
                              </th>
                            )}
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-600">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {documentsData.data.map((document, index) => (
                            <tr
                              key={`doc-${document.id || 'no-id'}-${index}`}
                              className="hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer"
                              onClick={() => {
                                setPreviewedRecord(document as Document);
                                setShowDetailPanel(true);
                              }}
                            >
                              {selectedTable?.columns?.map((column) => (
                                <td
                                  key={column.field}
                                  className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 max-w-xs"
                                >
                                  <TableCellRenderer 
                                    value={document[column.field]}
                                    columnField={column.field}
                                    columnType={column.type}
                                    tableName={selectedTable.name}
                                  />
                                </td>
                              ))}
                              {/* Add score column data if any document has _score */}
                              {documentsData?.data.some(doc => (doc as any)._score !== undefined) && (
                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700">
                                  {(document as any)._score !== undefined ? (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                                      {((document as any)._score as number).toFixed(3)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 dark:text-gray-500">-</span>
                                  )}
                                </td>
                              )}
                              <td className="px-4 py-2 text-sm border-b border-gray-200 dark:border-gray-700">
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditDocument(document as Document);
                                    }}
                                    className="px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-xs"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      document.id && handleDeleteDocument(document.id);
                                    }}
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
                  {/* Detail Panel */}
                  {showDetailPanel && previewedRecord && (
                    <div className="w-full lg:w-96 h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-lg p-6 overflow-y-auto fixed lg:static right-0 top-0 z-40">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Record Details</h3>
                        <button
                          onClick={() => setShowDetailPanel(false)}
                          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="space-y-4">
                        {selectedTable?.columns?.map((column) => (
                          <div key={column.field}>
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">{column.field}</div>
                            <div className="text-sm text-gray-900 dark:text-gray-100 break-words">
                              <TableCellRenderer 
                                value={previewedRecord[column.field]}
                                columnField={column.field}
                                columnType={column.type}
                                tableName={selectedTable.name}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
      {showCreateDocumentForm && selectedTable && (
        <DocumentForm
          isOpen={showCreateDocumentForm}
          onClose={() => {
            setShowCreateDocumentForm(false);
            setEditingDocument(null);
          }}
          onSuccess={() => {
            setShowCreateDocumentForm(false);
            setEditingDocument(null);
            refetchDocuments();
          }}
          table={selectedTable}
          editingDocument={editingDocument}
        />
      )}

      {/* Schema Editor Modal */}
      {showSchemaEditor && selectedTable && (
        <TableSchemaEditor
          table={selectedTable}
          onClose={() => setShowSchemaEditor(false)}
          onTableUpdated={handleTableUpdated}
        />
      )}

      {/* Data Import Modal */}
      {showImportModal && selectedTable && (
        <DataImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            refetchDocuments();
          }}
          table={selectedTable}
        />
      )}
    </div>
  );
};
