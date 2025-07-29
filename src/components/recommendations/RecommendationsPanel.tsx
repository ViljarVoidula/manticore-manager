import React, { useState, useEffect } from "react";
import { useCustomMutation } from "@refinedev/core";
import { TableCellRenderer } from "../table-cell-renderer";
import { TableInfo } from "../../types/manticore";

interface RecommendationItem {
  id: string | number;
  score: number;
  distance: number;
  data: Record<string, unknown>;
}

interface RecommendationResponse {
  reference_table: string;
  reference_input_type: string;
  reference_input_value: string | number;
  vector_column_used: string;
  model_name?: string;
  recommendations: RecommendationItem[];
  total_found: number;
  query_time_ms: number;
  stage1_time_ms?: number;
  stage2_time_ms?: number;
}

interface VectorColumnInfo {
  table_name: string;
  column_name: string;
  model_name: string;
  combined_fields?: Record<string, unknown>;
}

interface RecommendationsPanelProps {
  selectedRecord: Record<string, unknown>;
  table: TableInfo;
  isVisible: boolean;
  onClose: () => void;
  onSelectRecommendation: (record: Record<string, unknown>) => void;
  onGoBack?: () => void;
}

export const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({
  selectedRecord,
  table,
  isVisible,
  onClose,
  onSelectRecommendation,
  onGoBack,
}) => {
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vectorColumns, setVectorColumns] = useState<VectorColumnInfo[]>([]);
  const [selectedVectorColumn, setSelectedVectorColumn] = useState<string>("");
  const [recommendationLimit, setRecommendationLimit] = useState(10);
  const [responseMetadata, setResponseMetadata] = useState<Omit<RecommendationResponse, 'recommendations'> | null>(null);

  // Use direct fetch instead of data provider to avoid base URL prefix issues

  const loadRecommendations = async () => {
    if (!selectedRecord?.id || !selectedVectorColumn) return;

    setLoading(true);
    setError(null);

    // Debug logging to check ID precision issues
    console.log('Original selectedRecord.id:', selectedRecord.id);
    console.log('Original selectedRecord.id type:', typeof selectedRecord.id);
    console.log('Stringified selectedRecord.id:', String(selectedRecord.id));

    const requestPayload = {
      table_name: table.name,
      input_type: "id",
      input_value: String(selectedRecord.id), // Convert to string to avoid JS precision issues with large integers
      vector_column: selectedVectorColumn,
      limit: recommendationLimit,
      exclude_self: true,
    };

    try {
      const response = await fetch("/recommendations/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as RecommendationResponse;
      
      setRecommendations(data.recommendations);
      setResponseMetadata({
        reference_table: data.reference_table,
        reference_input_type: data.reference_input_type,
        reference_input_value: data.reference_input_value,
        vector_column_used: data.vector_column_used,
        model_name: data.model_name,
        total_found: data.total_found,
        query_time_ms: data.query_time_ms,
        stage1_time_ms: data.stage1_time_ms,
        stage2_time_ms: data.stage2_time_ms,
      });
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
      setError('Failed to load recommendations');
      setRecommendations([]);
      setResponseMetadata(null);
      setLoading(false);
    }
  };

  // Load vector columns for the table
  useEffect(() => {
    const loadVectorColumns = async () => {
      if (!isVisible || !table.name) return;

      setLoading(true);
      
      try {
        const response = await fetch("/manticore/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            table: "manager_vector_column_settings",
            query: {
              match: { tbl_name: table.name }
            },
            limit: 100
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const searchResponse = await response.json() as any;
        
        if (searchResponse?.hits?.hits?.length > 0) {
          const columns = searchResponse.hits.hits.map((hit: any) => ({
            table_name: table.name,
            column_name: hit._source.col_name,
            model_name: hit._source.mdl_name,
            combined_fields: hit._source.combined_fields ? 
              (typeof hit._source.combined_fields === 'string' ? 
                JSON.parse(hit._source.combined_fields) : 
                hit._source.combined_fields) : undefined
          }));
          setVectorColumns(columns);
          if (columns.length > 0 && !selectedVectorColumn) {
            setSelectedVectorColumn(columns[0].column_name);
          }
        } else {
          setVectorColumns([]);
        }
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch vector columns:', error);
        setError('Failed to load vector columns for this table');
        setLoading(false);
      }
    };

    loadVectorColumns();
  }, [isVisible, table.name, selectedVectorColumn]);

  // Load recommendations when record or settings change
  useEffect(() => {
    if (isVisible && selectedRecord?.id && selectedVectorColumn && vectorColumns.length > 0) {
      loadRecommendations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, selectedRecord?.id, selectedVectorColumn, recommendationLimit]);

  const handleRecommendationClick = (recommendation: RecommendationItem) => {
    // Combine the recommendation data with the ID
    const fullRecord = {
      id: recommendation.id,
      ...recommendation.data,
    };
    console.log('🎯 Recommendation clicked:', {
      recommendationId: recommendation.id,
      fullRecord: fullRecord,
      currentSelectedRecord: selectedRecord?.id
    });
    onSelectRecommendation(fullRecord);
  };

  if (!isVisible) return null;

  return (
    <div className="w-full lg:w-96 h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-lg flex flex-col fixed lg:static right-0 top-0 z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {onGoBack && (
            <button
              onClick={onGoBack}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
              title="Go back to previous item"
            >
              ←
            </button>
          )}
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Similar Items</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              ID: {String(selectedRecord?.id || '')}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
        >
          ✕
        </button>
      </div>

      {/* Controls */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        {vectorColumns.length > 1 && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Vector Column
            </label>
            <select
              value={selectedVectorColumn}
              onChange={(e) => setSelectedVectorColumn(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {vectorColumns.map((col) => (
                <option key={col.column_name} value={col.column_name}>
                  {col.column_name} ({col.model_name})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Limit:
          </label>
          <select
            value={recommendationLimit}
            onChange={(e) => setRecommendationLimit(Number(e.target.value))}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <button
            onClick={loadRecommendations}
            disabled={loading || !selectedVectorColumn}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Refresh
          </button>
        </div>

        {/* Metadata */}
        {responseMetadata && (
          <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
            <p>Found {responseMetadata.total_found} similar items in {responseMetadata.query_time_ms.toFixed(1)}ms</p>
            {responseMetadata.model_name && (
              <p>Using model: {responseMetadata.model_name}</p>
            )}
            {responseMetadata.stage1_time_ms && responseMetadata.stage2_time_ms && (
              <p>
                Stage 1: {responseMetadata.stage1_time_ms.toFixed(1)}ms, 
                Stage 2: {responseMetadata.stage2_time_ms.toFixed(1)}ms
              </p>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400 ml-3">Loading recommendations...</p>
          </div>
        ) : error ? (
          <div className="p-4">
            {vectorColumns.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">📊</div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">No Vector Columns</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  This table doesn't have any vector columns configured for similarity search.
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Add vector columns through the table schema editor to enable recommendations.
                </p>
              </div>
            ) : (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">Error</h4>
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-8 px-4">
            <div className="text-4xl mb-4">🔍</div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">No Similar Items</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No similar items found for the selected record.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {recommendations.map((recommendation, index) => (
              <div
                key={`rec-${recommendation.id}-${index}`}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                onClick={() => handleRecommendationClick(recommendation)}
              >
                {/* Similarity Score */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      ID: {recommendation.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                      {(recommendation.score * 100).toFixed(1)}% similar
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      d: {recommendation.distance.toFixed(3)}
                    </span>
                  </div>
                </div>

                {/* Record Data Preview */}
                <div className="space-y-2">
                  {table.columns
                    ?.filter(col => col.field !== 'id' && col.field !== selectedVectorColumn)
                    .slice(0, 3) // Show first 3 non-ID, non-vector columns
                    .map((column) => (
                      <div key={column.field} className="text-xs">
                        <span className="font-medium text-gray-500 dark:text-gray-400 uppercase">
                          {column.field}:
                        </span>
                        <div className="text-gray-900 dark:text-gray-100 mt-1 break-words">
                          <TableCellRenderer
                            value={recommendation.data[column.field]}
                            columnField={column.field}
                            columnType={column.type}
                            tableName={table.name}
                          />
                        </div>
                      </div>
                    ))}
                </div>

                {/* Click indicator */}
                <div className="flex items-center justify-end mt-2">
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    Click to view →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {recommendations.length > 0 && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
            Showing {recommendations.length} of {responseMetadata?.total_found || 0} similar items
          </p>
        </div>
      )}
    </div>
  );
};