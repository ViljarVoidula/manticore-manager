import React, { useState, useEffect } from "react";
import { useCustomMutation, useDataProvider } from "@refinedev/core";
import { toastMessages } from "../../utils/toast";
import { VectorConfigModal } from "../vector-config-modal";
import { Modal, FormActions } from "../forms";

interface Model {
  name: string;
  dimensions: number;
}

interface TableCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface TableSettings {
  // Search & NLP settings for hybrid search
  min_infix_len?: number;
  min_prefix_len?: number;
  min_word_len?: number;
  morphology?: string;
  charset_table?: string;
  
  // Performance settings
  rt_mem_limit?: string;
  optimize_cutoff?: number;
  
  // Access modes for performance
  access_plain_attrs?: 'mmap' | 'mmap_preread' | 'mlock';
  access_blob_attrs?: 'mmap' | 'mmap_preread' | 'mlock';
  access_doclists?: 'file' | 'mmap' | 'mlock';
  access_hitlists?: 'file' | 'mmap' | 'mlock';
  access_dict?: 'mmap' | 'mmap_preread' | 'mlock';
  
  // Storage settings
  engine?: 'rowwise' | 'columnar';
  docstore_compression?: 'lz4' | 'lz4hc' | 'none';
  docstore_block_size?: string;
  
  // Advanced settings
  preopen?: boolean;
  attr_update_reserve?: string;
}

interface ColumnDefinition {
  name: string;
  type: 'text' | 'integer' | 'bigint' | 'float' | 'bool' | 'json' | 'timestamp' | 'float_vector';
  indexed: boolean;
  stored: boolean;
  // Vector-specific properties
  vectorDimensions?: number;
  knnType?: 'hnsw' | 'flat';
  similarityMetric?: 'l2' | 'ip' | 'cosine';
  hnswM?: number;
  hnswEfConstruction?: number;
  quantization?: '8bit' | '1bit' | '1bitsimple';
  modelName?: string;
}

export const TableCreator: React.FC<TableCreatorProps> = ({ isOpen, onClose, onSuccess }) => {
  const [tableName, setTableName] = useState("");
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [columns, setColumns] = useState<ColumnDefinition[]>([
    { name: 'id', type: 'bigint', indexed: true, stored: true },
    { name: 'data', type: 'json', indexed: false, stored: true }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVectorConfig, setShowVectorConfig] = useState(false);
  const [vectorColumnToConfig, setVectorColumnToConfig] = useState<{
    tableName: string;
    columnName: string;
  } | null>(null);
  
  // Table settings with optimal defaults for hybrid fulltext + vector search
  const [tableSettings, setTableSettings] = useState<TableSettings>({
    // Enable fuzzy search and morphology for better fulltext search
    min_infix_len: 2,
    min_prefix_len: 3,
    min_word_len: 2,
    morphology: 'stem_en',
    
    // Performance settings optimized for mixed workloads
    rt_mem_limit: '256M',
    optimize_cutoff: 5,
    
    // Balanced access modes for hybrid search
    access_plain_attrs: 'mmap_preread',
    access_blob_attrs: 'mmap_preread', 
    access_doclists: 'mmap',
    access_hitlists: 'mmap',
    access_dict: 'mmap_preread',
    
    // Row-wise storage for better search performance
    engine: 'rowwise',
    docstore_compression: 'lz4hc',
    docstore_block_size: '32k',
    
    // Advanced settings
    preopen: true,
    attr_update_reserve: '256k'
  });

  const { mutate: createTable } = useCustomMutation();
  const dataProvider = useDataProvider();

  useEffect(() => {
    const fetchModels = async () => {
      if (!isOpen || !dataProvider) return;
      
      try {
        const dp = dataProvider();
        if (!dp || !dp.custom) return;
        
        const response = await dp.custom({
          url: "/embeddings/models",
          method: "get"
        });
        
        // Use the same logic as TableSchemaEditor - get available_models for all available models
        const availableModels = response.data?.available_models || [];
        // If loaded models have details, merge them
        const loadedModels = response.data?.models || [];
        // Map available models to details (dimensions, description, etc)
        const modelDetailsMap: Record<string, Model> = {};
        loadedModels.forEach((m: Model) => {
          modelDetailsMap[m.name] = m;
        });
        // Compose final list with details from loaded or just name
        const modelsWithDetails = availableModels.map((name: string) => {
          const details = modelDetailsMap[name];
          return details ? details : { name };
        });
        
        console.log('TableCreator: Available models from API:', availableModels);
        console.log('TableCreator: Loaded models with details:', loadedModels);
        console.log('TableCreator: Final models with details:', modelsWithDetails);
        
        setAvailableModels(modelsWithDetails);
      } catch (error) {
        console.error('Failed to fetch models:', error);
        setAvailableModels([]);
      }
    };

    fetchModels();
  }, [isOpen, dataProvider]);

  const handleAddColumn = () => {
    setColumns([...columns, { 
      name: '', 
      type: 'text', 
      indexed: false, 
      stored: true,
      vectorDimensions: 128,
      knnType: 'hnsw',
      similarityMetric: 'l2',
      hnswM: 16,
      hnswEfConstruction: 200,
      quantization: undefined
    }]);
  };

  const handleRemoveColumn = (index: number) => {
    if (columns.length > 1) {
      setColumns(columns.filter((_, i) => i !== index));
    }
  };

  const handleColumnChange = async (index: number, field: keyof ColumnDefinition, value: string | boolean | number | undefined) => {
    const newColumns = [...columns];
    const column = newColumns[index];
    
    if (field === 'modelName' && typeof value === 'string') {
        console.log('TableCreator: Model selected:', value);
        if (value === 'custom') {
            column.modelName = 'custom';
            console.log('TableCreator: Set column.modelName to custom');
        } else {
            column.modelName = value;
            console.log('TableCreator: Set column.modelName to:', value);
            
            // Fetch model info from API to get accurate dimensions
            try {
                if (dataProvider) {
                    const dp = dataProvider();
                    if (dp && dp.custom) {
                        // Encode model name for URL
                        const encodedName = encodeURIComponent(value);
                        const response = await dp.custom({
                            url: `/embeddings/models/${encodedName}`,
                            method: "get"
                        });
                        const info = response.data;
                        if (info && info.dimensions) {
                            column.vectorDimensions = info.dimensions;
                            console.log('TableCreator: Updated dimensions from API:', info.dimensions);
                        }
                    }
                }
            } catch (err) {
                console.log('TableCreator: API fetch failed, falling back to local model data');
                // Fallback to local model details if API fails
                const model = availableModels.find(m => m.name === value);
                if (model && model.dimensions) {
                    column.vectorDimensions = model.dimensions;
                    console.log('TableCreator: Updated dimensions from local data:', model.dimensions);
                }
            }
        }
    } else {
        newColumns[index] = { ...newColumns[index], [field]: value };
    }
    
    setColumns(newColumns);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tableName.trim()) {
      setError("Table name is required");
      return;
    }

    if (columns.some(col => !col.name.trim())) {
      setError("All columns must have names");
      return;
    }

    setIsLoading(true);
    setError(null);

    // Generate CREATE TABLE SQL for Manticore Search
    const columnDefinitions = columns.map(col => {
      let def = `${col.name} ${col.type.toUpperCase()}`;
      
      // Handle vector fields with KNN parameters
      if (col.type === 'float_vector') {
        def += ` knn_type='${col.knnType || 'hnsw'}'`;
        def += ` knn_dims='${col.vectorDimensions || 128}'`;
        def += ` hnsw_similarity='${col.similarityMetric || 'l2'}'`;
        
        if (col.quantization) {
          def += ` quantization='${col.quantization}'`;
        }
        
        if (col.knnType === 'hnsw') {
          if (col.hnswM) def += ` hnsw_m='${col.hnswM}'`;
          if (col.hnswEfConstruction) def += ` hnsw_ef_construction='${col.hnswEfConstruction}'`;
        }
      }
      // For Manticore Search, handle attributes correctly according to documentation
      // - BIGINT is used for document IDs (no special attributes needed)
      // - TEXT fields can be 'indexed' for full-text search or 'attribute' for filtering
      // - JSON fields are stored by default
      // - 'stored' is not a valid attribute in Manticore CREATE TABLE syntax
      else if (col.type === 'text' && !col.indexed) {
        // Text fields that should be attributes (for filtering/sorting)
        def += ' attribute';
      }
      // For other types and indexed text fields, no special attributes needed in CREATE TABLE
      
      return def;
    }).join(',\n  ');

    // Build table settings string
    const settingsArray: string[] = ["type='rt'"];
    
    // Add enabled table settings
    if (tableSettings.min_infix_len !== undefined) {
      settingsArray.push(`min_infix_len='${tableSettings.min_infix_len}'`);
    }
    if (tableSettings.min_prefix_len !== undefined) {
      settingsArray.push(`min_prefix_len='${tableSettings.min_prefix_len}'`);
    }
    if (tableSettings.min_word_len !== undefined) {
      settingsArray.push(`min_word_len='${tableSettings.min_word_len}'`);
    }
    if (tableSettings.morphology) {
      settingsArray.push(`morphology='${tableSettings.morphology}'`);
    }
    if (tableSettings.rt_mem_limit) {
      settingsArray.push(`rt_mem_limit='${tableSettings.rt_mem_limit}'`);
    }
    if (tableSettings.optimize_cutoff !== undefined) {
      settingsArray.push(`optimize_cutoff='${tableSettings.optimize_cutoff}'`);
    }
    if (tableSettings.access_plain_attrs) {
      settingsArray.push(`access_plain_attrs='${tableSettings.access_plain_attrs}'`);
    }
    if (tableSettings.access_blob_attrs) {
      settingsArray.push(`access_blob_attrs='${tableSettings.access_blob_attrs}'`);
    }
    if (tableSettings.access_doclists) {
      settingsArray.push(`access_doclists='${tableSettings.access_doclists}'`);
    }
    if (tableSettings.access_hitlists) {
      settingsArray.push(`access_hitlists='${tableSettings.access_hitlists}'`);
    }
    if (tableSettings.access_dict) {
      settingsArray.push(`access_dict='${tableSettings.access_dict}'`);
    }
    if (tableSettings.engine) {
      settingsArray.push(`engine='${tableSettings.engine}'`);
    }
    if (tableSettings.docstore_compression) {
      settingsArray.push(`docstore_compression='${tableSettings.docstore_compression}'`);
    }
    if (tableSettings.docstore_block_size) {
      settingsArray.push(`docstore_block_size='${tableSettings.docstore_block_size}'`);
    }
    if (tableSettings.preopen !== undefined) {
      settingsArray.push(`preopen='${tableSettings.preopen ? 1 : 0}'`);
    }
    if (tableSettings.attr_update_reserve) {
      settingsArray.push(`attr_update_reserve='${tableSettings.attr_update_reserve}'`);
    }

    const createTableSql = `CREATE TABLE ${tableName} (\n  ${columnDefinitions}\n) ${settingsArray.join(' ')}`;

    createTable(
      {
        url: "/cli_json",
        method: "post",
        values: { command: createTableSql },
      },
      {
        onSuccess: async () => {
          // Check if there are any vector columns that need configuration
          const vectorColumns = columns.filter(col => col.type === 'float_vector');
          
          setIsLoading(false);
          toastMessages.tableCreated(tableName);
          
          if (vectorColumns.length > 0) {
            // Show vector configuration modal for the first vector column
            const firstVectorColumn = vectorColumns[0];
            setVectorColumnToConfig({
              tableName: tableName,
              columnName: firstVectorColumn.name
            });
            setShowVectorConfig(true);
            
            // Don't close the main dialog yet - wait for vector config to complete
          } else {
            // No vector columns, proceed normally
            onSuccess();
            handleClose();
          }
        },
        onError: (error: unknown) => {
          setError((error as Error)?.message || "Failed to create table");
          setIsLoading(false);
          toastMessages.generalError('create table', error);
        },
      }
    );
  };

  const handleClose = () => {
    setTableName("");
    setColumns([
      { name: 'id', type: 'bigint', indexed: true, stored: true },
      { name: 'data', type: 'json', indexed: false, stored: true }
    ]);
    // Reset table settings to defaults
    setTableSettings({
      min_infix_len: 2,
      min_prefix_len: 3,
      min_word_len: 2,
      morphology: 'stem_en',
      rt_mem_limit: '256M',
      optimize_cutoff: 5,
      access_plain_attrs: 'mmap_preread',
      access_blob_attrs: 'mmap_preread',
      access_doclists: 'mmap',
      access_hitlists: 'mmap',
      access_dict: 'mmap_preread',
      engine: 'rowwise',
      docstore_compression: 'lz4hc',
      docstore_block_size: '32k',
      preopen: true,
      attr_update_reserve: '256k'
    });
    setError(null);
    setShowVectorConfig(false);
    setVectorColumnToConfig(null);
    onClose();
  };

  const handleVectorConfigComplete = () => {
    setShowVectorConfig(false);
    setVectorColumnToConfig(null);
    onSuccess();
    handleClose();
  };

  const handleVectorConfigClose = () => {
    setShowVectorConfig(false);
    setVectorColumnToConfig(null);
    // Still call onSuccess and handleClose even if user cancels vector config
    onSuccess();
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Create New Table"
        size="4xl"
      >
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-md">
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Table Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Table Name
              </label>
              <input
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="e.g., products, articles, documents"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Columns */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Columns
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setColumns([...columns, { 
                        name: 'embedding', 
                        type: 'float_vector', 
                        indexed: false, 
                        stored: true,
                        vectorDimensions: 768,
                        knnType: 'hnsw',
                        similarityMetric: 'cosine',
                        hnswM: 16,
                        hnswEfConstruction: 200,
                        quantization: '8bit'
                      }]);
                    }}
                    className="px-3 py-1 bg-blue-600 dark:bg-blue-700 text-white text-sm rounded-md hover:bg-blue-700 dark:hover:bg-blue-800"
                  >
                    Add Vector Field
                  </button>
                  <button
                    type="button"
                    onClick={handleAddColumn}
                    className="px-3 py-1 bg-green-600 dark:bg-green-700 text-white text-sm rounded-md hover:bg-green-700 dark:hover:bg-green-800"
                  >
                    Add Column
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {columns.map((column, index) => (
                  <React.Fragment key={index}>
                    <div className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={column.name}
                          onChange={(e) => handleColumnChange(index, 'name', e.target.value)}
                          placeholder="Column name"
                          disabled={column.name === 'id'}
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-600"
                        />
                      </div>
                      <div className="w-32">
                        <select
                          value={column.type}
                          onChange={(e) => handleColumnChange(index, 'type', e.target.value)}
                          disabled={column.name === 'id'}
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-600"
                        >
                          <option value="text">Text</option>
                          <option value="integer">Integer</option>
                          <option value="bigint">Big Integer</option>
                          <option value="float">Float</option>
                          <option value="float_vector">Float Vector</option>
                          <option value="bool">Boolean</option>
                          <option value="json">JSON</option>
                          <option value="timestamp">Timestamp</option>
                        </select>
                      </div>
                      <div className="flex items-center space-x-4">
                        {column.type === 'text' && (
                          <label className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                            <input
                              type="checkbox"
                              checked={column.indexed}
                              onChange={(e) => handleColumnChange(index, 'indexed', e.target.checked)}
                              className="mr-1"
                            />
                            Full-text searchable
                          </label>
                        )}
                        {column.type === 'text' && !column.indexed && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            (Will be created as attribute for filtering/sorting)
                          </span>
                        )}
                        {column.type === 'float_vector' && (
                          <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                            Vector field - configure parameters below
                          </span>
                        )}
                        {column.type !== 'text' && column.type !== 'float_vector' && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            (Stored as attribute)
                          </span>
                        )}
                      </div>
                      {column.name !== 'id' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveColumn(index)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    
                    {/* Vector Configuration Panel */}
                    {column.type === 'float_vector' && (
                      <div className="ml-6 mt-3 p-4 border-l-2 border-blue-200 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-r-md">
                        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-3">Vector Search Configuration</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                              Embedding Model
                            </label>
                            <select
                              value={column.modelName || ''}
                              onChange={(e) => handleColumnChange(index, 'modelName', e.target.value)}
                              className="w-full p-2 text-sm border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Select a model...</option>
                              {availableModels.map(model => (
                                <option key={model.name} value={model.name}>{model.name}</option>
                              ))}
                              <option value="custom">Custom</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                              Dimensions
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="4096"
                              value={column.vectorDimensions || ''}
                              onChange={(e) => handleColumnChange(index, 'vectorDimensions', parseInt(e.target.value))}
                              className="w-full p-2 text-sm border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500"
                              readOnly={column.modelName !== 'custom'}
                            />
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Dimensions are set by the model, unless 'Custom' is selected.</p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                              KNN Algorithm
                            </label>
                            <select
                              value={column.knnType || 'hnsw'}
                              onChange={(e) => handleColumnChange(index, 'knnType', e.target.value)}
                              className="w-full p-2 text-sm border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="hnsw">HNSW (Hierarchical NSW)</option>
                              <option value="flat">Flat (Exact search)</option>
                            </select>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">HNSW for fast approximate search, Flat for exact results</p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                              Similarity Metric
                            </label>
                            <select
                              value={column.similarityMetric || 'l2'}
                              onChange={(e) => handleColumnChange(index, 'similarityMetric', e.target.value)}
                              className="w-full p-2 text-sm border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="l2">L2 (Euclidean distance)</option>
                              <option value="ip">IP (Inner product)</option>
                              <option value="cosine">Cosine similarity</option>
                            </select>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Distance metric for similarity calculation</p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                              Quantization (Optional)
                            </label>
                            <select
                              value={column.quantization || ''}
                              onChange={(e) => handleColumnChange(index, 'quantization', e.target.value || undefined)}
                              className="w-full p-2 text-sm border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">None (Full precision)</option>
                              <option value="8bit">8-bit (Good balance)</option>
                              <option value="1bit">1-bit (High compression, asymmetric)</option>
                              <option value="1bitsimple">1-bit Simple (Fastest, less accurate)</option>
                            </select>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Reduce memory usage and increase speed</p>
                          </div>
                          {column.knnType === 'hnsw' && (
                            <>
                              <div>
                                <label className="block text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                                  HNSW M Parameter
                                </label>
                                <input
                                  type="number"
                                  min="4"
                                  max="64"
                                  value={column.hnswM || 16}
                                  onChange={(e) => handleColumnChange(index, 'hnswM', parseInt(e.target.value))}
                                  className="w-full p-2 text-sm border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Number of connections (higher = better recall, more memory)</p>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                                  HNSW EF Construction
                                </label>
                                <input
                                  type="number"
                                  min="16"
                                  max="1000"
                                  value={column.hnswEfConstruction || 200}
                                  onChange={(e) => handleColumnChange(index, 'hnswEfConstruction', parseInt(e.target.value))}
                                  className="w-full p-2 text-sm border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Build-time search depth (higher = better quality, slower build)</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Table Settings */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Table Settings
                </label>
                <button
                  type="button"
                  onClick={() => {
                    // Reset to minimal settings for simple tables
                    setTableSettings({
                      min_infix_len: 2,
                      morphology: 'stem_en',
                      engine: 'rowwise'
                    });
                  }}
                  className="px-3 py-1 bg-gray-500 text-white text-sm rounded-md hover:bg-gray-600"
                >
                  Reset to Minimal
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-md">
                {/* Search & NLP Settings */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">🔍 Search & Language Processing</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Min Infix Length (fuzzy search)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={tableSettings.min_infix_len || ''}
                        onChange={(e) => setTableSettings(prev => ({
                          ...prev,
                          min_infix_len: e.target.value ? parseInt(e.target.value) : undefined
                        }))}
                        className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-600 text-gray-900 dark:text-white rounded-md"
                        placeholder="2 (recommended)"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enable fuzzy search (2+ recommended)</p>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Morphology
                      </label>
                      <select
                        value={tableSettings.morphology || ''}
                        onChange={(e) => setTableSettings(prev => ({
                          ...prev,
                          morphology: e.target.value || undefined
                        }))}
                        className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-600 text-gray-900 dark:text-white rounded-md"
                      >
                        <option value="">None</option>
                        <option value="stem_en">English Stemming</option>
                        <option value="stem_ru">Russian Stemming</option>
                        <option value="stem_de">German Stemming</option>
                        <option value="stem_fr">French Stemming</option>
                        <option value="lemmatize_en">English Lemmatization</option>
                        <option value="lemmatize_ru">Russian Lemmatization</option>
                      </select>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Word normalization for better matching</p>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Min Word Length
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={tableSettings.min_word_len || ''}
                        onChange={(e) => setTableSettings(prev => ({
                          ...prev,
                          min_word_len: e.target.value ? parseInt(e.target.value) : undefined
                        }))}
                        className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-600 text-gray-900 dark:text-white rounded-md"
                        placeholder="2"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Minimum length of indexed words</p>
                    </div>
                  </div>
                </div>

                {/* Performance Settings */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">⚡ Performance & Storage</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        RAM Chunk Limit
                      </label>
                      <select
                        value={tableSettings.rt_mem_limit || ''}
                        onChange={(e) => setTableSettings(prev => ({
                          ...prev,
                          rt_mem_limit: e.target.value || undefined
                        }))}
                        className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-600 text-gray-900 dark:text-white rounded-md"
                      >
                        <option value="128M">128M (Default)</option>
                        <option value="256M">256M (Recommended)</option>
                        <option value="512M">512M</option>
                        <option value="1G">1GB</option>
                        <option value="2G">2GB</option>
                      </select>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Memory limit for RAM chunk</p>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Storage Engine
                      </label>
                      <select
                        value={tableSettings.engine || ''}
                        onChange={(e) => setTableSettings(prev => ({
                          ...prev,
                          engine: e.target.value as 'rowwise' | 'columnar' || undefined
                        }))}
                        className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-600 text-gray-900 dark:text-white rounded-md"
                      >
                        <option value="rowwise">Row-wise (Better for search)</option>
                        <option value="columnar">Columnar (Better for analytics)</option>
                      </select>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Storage format optimization</p>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Document Compression
                      </label>
                      <select
                        value={tableSettings.docstore_compression || ''}
                        onChange={(e) => setTableSettings(prev => ({
                          ...prev,
                          docstore_compression: e.target.value as 'lz4' | 'lz4hc' | 'none' || undefined
                        }))}
                        className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-600 text-gray-900 dark:text-white rounded-md"
                      >
                        <option value="lz4">LZ4 (Fast)</option>
                        <option value="lz4hc">LZ4HC (Better compression)</option>
                        <option value="none">None</option>
                      </select>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Compression for stored fields</p>
                    </div>
                    
                    <div>
                      <label className="flex items-center text-xs text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={tableSettings.preopen || false}
                          onChange={(e) => setTableSettings(prev => ({
                            ...prev,
                            preopen: e.target.checked
                          }))}
                          className="mr-2"
                        />
                        Pre-open table files (better performance, more file descriptors)
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md">
                <h5 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">💡 Optimal Settings for Hybrid Search</h5>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  These settings are optimized for applications that use both fulltext search and vector similarity. 
                  Key features: fuzzy search enabled, English stemming, balanced memory usage, row-wise storage for search performance.
                </p>
              </div>
            </div>

            {/* Vector Search Info */}
            {columns.some(col => col.type === 'float_vector') && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md p-4">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">📊 Vector Search Information</h4>
                <div className="text-xs text-blue-700 dark:text-blue-300 space-y-2">
                  <p><strong>Use cases:</strong> Text embeddings (OpenAI, Sentence Transformers), image embeddings, product recommendations</p>
                  <p><strong>Quantization options:</strong></p>
                  <ul className="list-disc list-inside text-xs space-y-1 ml-2">
                    <li><strong>8bit:</strong> Good balance of memory savings and accuracy</li>
                    <li><strong>1bit:</strong> High compression with asymmetric quantization (queries: 4-bit, stored: 1-bit)</li>
                    <li><strong>1bitsimple:</strong> Fastest option but least accurate</li>
                  </ul>
                  <p><strong>Inserting vectors:</strong> Use arrays in SQL or JSON format:</p>
                  <code className="block bg-blue-100 dark:bg-blue-800 p-2 rounded text-xs font-mono">
                    INSERT INTO {tableName || 'your_table'} (id, title, embedding) VALUES<br/>
                    (1, 'Sample text', (0.653, 0.192, 0.018, 0.340)),<br/>
                    (2, 'Another doc', (-0.149, 0.748, 0.092, -0.095))
                  </code>
                  <p><strong>Vector search query example:</strong></p>
                  <code className="block bg-blue-100 dark:bg-blue-800 p-2 rounded text-xs font-mono">
                    SELECT id, title, knn_dist() FROM {tableName || 'your_table'}<br/>
                    WHERE knn(embedding, 5, (0.287, -0.032, 0.067, 0.033), 100)<br/>
                    ORDER BY knn_dist() ASC
                  </code>
                  <p className="text-xs"><strong>Parameters:</strong> embedding=field_name, 5=results_count, vector=query_vector, 100=max_candidates</p>
                </div>
              </div>
            )}

            {/* Preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                SQL Preview
              </label>
              <pre className="bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-3 rounded-md text-sm font-mono overflow-x-auto">
                {tableName ? (() => {
                  // Build column definitions
                  const columnDefs = columns.map(col => {
                    let def = `  ${col.name} ${col.type.toUpperCase()}`;
                    
                    if (col.type === 'float_vector') {
                      def += ` knn_type='${col.knnType || 'hnsw'}'`;
                      def += ` knn_dims='${col.vectorDimensions || 128}'`;
                      def += ` hnsw_similarity='${col.similarityMetric || 'l2'}'`;
                      
                      if (col.quantization) {
                        def += ` quantization='${col.quantization}'`;
                      }
                      
                      if (col.knnType === 'hnsw') {
                        if (col.hnswM) def += ` hnsw_m='${col.hnswM}'`;
                        if (col.hnswEfConstruction) def += ` hnsw_ef_construction='${col.hnswEfConstruction}'`;
                      }
                    } else if (col.type === 'text' && !col.indexed) {
                      def += ' attribute';
                    }
                    
                    return def;
                  }).join(',\n');
                  
                  // Build settings array
                  const settingsArray = ["type='rt'"];
                  if (tableSettings.min_infix_len !== undefined) settingsArray.push(`min_infix_len='${tableSettings.min_infix_len}'`);
                  if (tableSettings.min_prefix_len !== undefined) settingsArray.push(`min_prefix_len='${tableSettings.min_prefix_len}'`);
                  if (tableSettings.min_word_len !== undefined) settingsArray.push(`min_word_len='${tableSettings.min_word_len}'`);
                  if (tableSettings.morphology) settingsArray.push(`morphology='${tableSettings.morphology}'`);
                  if (tableSettings.rt_mem_limit) settingsArray.push(`rt_mem_limit='${tableSettings.rt_mem_limit}'`);
                  if (tableSettings.optimize_cutoff !== undefined) settingsArray.push(`optimize_cutoff='${tableSettings.optimize_cutoff}'`);
                  if (tableSettings.engine) settingsArray.push(`engine='${tableSettings.engine}'`);
                  if (tableSettings.docstore_compression) settingsArray.push(`docstore_compression='${tableSettings.docstore_compression}'`);
                  if (tableSettings.docstore_block_size) settingsArray.push(`docstore_block_size='${tableSettings.docstore_block_size}'`);
                  if (tableSettings.preopen !== undefined) settingsArray.push(`preopen='${tableSettings.preopen ? 1 : 0}'`);
                  if (tableSettings.attr_update_reserve) settingsArray.push(`attr_update_reserve='${tableSettings.attr_update_reserve}'`);
                  
                  return `CREATE TABLE ${tableName} (\n${columnDefs}\n) ${settingsArray.join(' ')}`;
                })() : (
                  "CREATE TABLE table_name (\n  ...\n) type='rt' [settings...]"
                )}
              </pre>
            </div>

            <FormActions
              onCancel={handleClose}
              submitLabel={isLoading ? 'Creating...' : 'Create Table'}
              isLoading={isLoading}
            />
          </form>
        </Modal>

        {/* Vector Configuration Modal */}
        {vectorColumnToConfig && (
          <VectorConfigModal
            isOpen={showVectorConfig}
            onClose={handleVectorConfigClose}
            onSuccess={handleVectorConfigComplete}
            tableName={vectorColumnToConfig.tableName}
            columnName={vectorColumnToConfig.columnName}
            initialConfig={{
              model_name: columns.find(c => c.name === vectorColumnToConfig.columnName)?.modelName,
              knn_type: columns.find(c => c.name === vectorColumnToConfig.columnName)?.knnType,
              similarity_metric: columns.find(c => c.name === vectorColumnToConfig.columnName)?.similarityMetric,
              dimensions: columns.find(c => c.name === vectorColumnToConfig.columnName)?.vectorDimensions,
            }}
          />
        )}
      </>
    );
  };
