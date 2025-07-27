import React, { useState, useEffect } from "react";
import { useCustomMutation, useDataProvider } from "@refinedev/core";
import toast from "react-hot-toast";
import { toastMessages } from "../../utils/toast";

interface VectorConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  tableName: string;
  columnName: string;
  initialConfig?: {
    model_name?: string;
    knn_type?: string;
    similarity_metric?: string;
    dimensions?: number;
    combined_fields?: Record<string, unknown>;
  };
}

interface Model {
  name: string;
  dimensions: number;
}

interface VectorColumnSettings {
  model_name: string;
  knn_type: string;
  similarity_metric: string;
  dimensions?: number;
  combined_fields?: {
    weights?: Record<string, number>;
    source_fields?: string[];
    [key: string]: unknown;
  };
}

interface FieldMapping {
  field: string;
  weight: number;
}

export const VectorConfigModal: React.FC<VectorConfigModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  tableName, 
  columnName, 
  initialConfig 
}) => {
  console.log('VectorConfigModal: Component rendered with props:', {
    isOpen,
    tableName,
    columnName,
    initialConfig
  });
  const [settings, setSettings] = useState<VectorColumnSettings>({
    model_name: initialConfig?.model_name || "sentence-transformers/all-MiniLM-L6-v2",
    knn_type: initialConfig?.knn_type || "HNSW",
    similarity_metric: initialConfig?.similarity_metric || "L2",
    dimensions: initialConfig?.dimensions,
    combined_fields: initialConfig?.combined_fields || {}
  });

  const { mutate: registerVectorColumn } = useCustomMutation();
  const { mutate: fetchTableInfo } = useCustomMutation();
  const dataProvider = useDataProvider();

  // Ensure settings.model_name and dimensions update when initialConfig changes and modal opens
  useEffect(() => {
    if (isOpen && initialConfig) {
      setSettings(prev => ({
        ...prev,
        model_name: initialConfig.model_name || "sentence-transformers/all-MiniLM-L6-v2",
        dimensions: initialConfig.dimensions
      }));
    }
  }, [isOpen, initialConfig, dataProvider]);
  
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [showFieldMappings, setShowFieldMappings] = useState(false);
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [dimensionMismatch, setDimensionMismatch] = useState(false);

  // Load available models
  useEffect(() => {
    if (isOpen && dataProvider) {
      const dp = dataProvider();
      if (dp && dp.custom) {
        setIsLoadingModels(true);
        console.log('VectorConfigModal: Loading models, initialConfig:', initialConfig);
        dp.custom({
            url: "/embeddings/models",
            method: "get"
        })
        .then((response: any) => {
            let models = response.data?.models || [];
            console.log('VectorConfigModal: Available models from API:', models);
            
            // Set initial model and dimensions
            const initialModelName = initialConfig?.model_name || "sentence-transformers/all-MiniLM-L6-v2";
            console.log('VectorConfigModal: Setting initial model to:', initialModelName);
            
            // If we have an initial model but it's not in the available models, add it
            if (initialModelName && !models.find((m: Model) => m.name === initialModelName)) {
              console.log('VectorConfigModal: Initial model not found in available models, adding it');
              models = [...models, { name: initialModelName, dimensions: initialConfig?.dimensions || 0 }];
            }
            
            setAvailableModels(models);
            console.log('VectorConfigModal: Final available models:', models);
            
            const initialModel = models.find((m: Model) => m.name === initialModelName);
            console.log('VectorConfigModal: Found initial model:', initialModel);
            
            setSettings(prev => ({
              ...prev,
              model_name: initialModelName,
              dimensions: initialModel?.dimensions || initialConfig?.dimensions
            }));

            setIsLoadingModels(false);
      })
      .catch((error: any) => {
            console.error('Failed to fetch models:', error);
            setAvailableModels([]);
            setIsLoadingModels(false);
      });
      }
    }
  }, [isOpen, dataProvider, initialConfig?.model_name]);

  // Check for dimension mismatch when settings or initialConfig changes
  useEffect(() => {
    if (initialConfig?.dimensions && settings.model_name) {
      const model = availableModels.find(m => m.name === settings.model_name);
      if (model && model.dimensions !== initialConfig.dimensions) {
        setDimensionMismatch(true);
      } else {
        setDimensionMismatch(false);
      }
    } else {
      setDimensionMismatch(false);
    }
  }, [settings.model_name, initialConfig?.dimensions, availableModels]);

  // Load table columns for field mapping
  useEffect(() => {
    if (isOpen && tableName) {
      fetchTableInfo(
        {
          url: "/table-info",
          method: "post",
          values: { table: tableName },
        },
        {
          onSuccess: (data) => {
            const tableInfo = data.data;
            const columns = tableInfo?.columns?.map((col: { field?: string; Field?: string; name?: string }) => 
              col.field || col.Field || col.name
            ).filter((name: string | undefined): name is string => 
              name !== undefined && name !== columnName
            ) || [];
            setTableColumns(columns);
          },
          onError: (error) => {
            console.error('Failed to fetch table info:', error);
            setTableColumns([]);
          },
        }
      );
    }
  }, [isOpen, tableName, columnName, fetchTableInfo]);

  const addFieldMapping = () => {
    if (tableColumns.length > 0) {
      setFieldMappings([...fieldMappings, { field: tableColumns[0], weight: 1.0 }]);
    }
  };

  const removeFieldMapping = (index: number) => {
    setFieldMappings(fieldMappings.filter((_, i) => i !== index));
  };

  const updateFieldMapping = (index: number, field: keyof FieldMapping, value: string | number) => {
    const updated = [...fieldMappings];
    updated[index] = { ...updated[index], [field]: value };
    setFieldMappings(updated);
  };

  const normalizeWeights = () => {
    const totalWeight = fieldMappings.reduce((sum, mapping) => sum + mapping.weight, 0);
    if (totalWeight > 0) {
      const normalized = fieldMappings.map(mapping => ({
        ...mapping,
        weight: mapping.weight / totalWeight
      }));
      setFieldMappings(normalized);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!settings.model_name) {
      toastMessages.generalError('configure vector', 'Model name is required');
      return;
    }

    setIsLoading(true);

    // Prepare combined_fields with field mappings if configured
    const combinedFields = { ...settings.combined_fields };
    if (fieldMappings.length > 0) {
      const weights: Record<string, number> = {};
      fieldMappings.forEach(mapping => {
        weights[mapping.field] = mapping.weight;
      });
      combinedFields.weights = weights;
      combinedFields.source_fields = fieldMappings.map(mapping => mapping.field);
    }

    // Use fetch directly for complete control over request format
    try {
      const url = `/embeddings/vector-columns/register?table_name=${encodeURIComponent(tableName)}&column_name=${encodeURIComponent(columnName)}&model_name=${encodeURIComponent(settings.model_name)}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: Object.keys(combinedFields).length > 0 ? JSON.stringify(combinedFields) : JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      setIsLoading(false);
      toast.success('Vector column configured successfully');
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error: unknown) {
      setIsLoading(false);
      console.error('Error configuring vector column:', error);
      toastMessages.generalError('configure vector column', error);
    }
  };

  const handleClose = () => {
    // Reset settings to initial values
    setSettings({
      model_name: initialConfig?.model_name || "sentence-transformers/all-MiniLM-L6-v2",
      knn_type: initialConfig?.knn_type || "HNSW",
      similarity_metric: initialConfig?.similarity_metric || "L2",
      combined_fields: initialConfig?.combined_fields || {}
    });
    setFieldMappings([]);
    setShowFieldMappings(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Configure Vector Column
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
            Table: {tableName} | Column: {columnName}
          </h3>
          <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
            Configure the embedding model and search parameters for this vector column.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Embedding Model *
            </label>
            {isLoadingModels ? (
              <div className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                Loading models...
              </div>
            ) : (
              <select
                value={settings.model_name}
                onChange={(e) => {
                  const modelName = e.target.value;
                  const model = availableModels.find(m => m.name === modelName);
                  setSettings({
                    ...settings,
                    model_name: modelName,
                    dimensions: model?.dimensions
                  });
                  if (initialConfig?.dimensions && model && model.dimensions !== initialConfig.dimensions) {
                    setDimensionMismatch(true);
                  } else {
                    setDimensionMismatch(false);
                  }
                }}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="">Select a model...</option>
                {availableModels.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.name}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Choose the embedding model that will be used to generate vectors for this column.
            </p>
            {dimensionMismatch && (
                <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                        <strong>Warning:</strong> The selected model's dimensions ({settings.dimensions}) do not match the column's dimensions ({initialConfig?.dimensions}). This may lead to unexpected behavior.
                    </p>
                </div>
            )}
          </div>

          {/* Field Mappings Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Multi-Field Embeddings (Optional)
              </label>
              <button
                type="button"
                onClick={() => setShowFieldMappings(!showFieldMappings)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
              >
                {showFieldMappings ? 'Hide' : 'Configure Field Mappings'}
              </button>
            </div>
            
            {showFieldMappings && (
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  Combine multiple table fields into a single vector embedding with weighted importance.
                </p>
                
                {fieldMappings.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {fieldMappings.map((mapping, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
                        <select
                          value={mapping.field}
                          onChange={(e) => updateFieldMapping(index, 'field', e.target.value)}
                          className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        >
                          {tableColumns.map((column) => (
                            <option key={column} value={column}>
                              {column}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600 dark:text-gray-400">Weight:</label>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            value={mapping.weight}
                            onChange={(e) => updateFieldMapping(index, 'weight', parseFloat(e.target.value) || 0)}
                            className="w-20 p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFieldMapping(index)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={normalizeWeights}
                        className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
                      >
                        Normalize Weights
                      </button>
                      <span className="text-xs text-gray-500 dark:text-gray-400 self-center">
                        Total weight: {fieldMappings.reduce((sum, m) => sum + m.weight, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addFieldMapping}
                    disabled={tableColumns.length === 0 || fieldMappings.length >= tableColumns.length}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-sm rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Field
                  </button>
                  {tableColumns.length === 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 self-center">
                      No other fields available in table
                    </span>
                  )}
                </div>
                
                {fieldMappings.length > 0 && (
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      <strong>Example:</strong> If you map "title" (weight: 0.7) and "description" (weight: 0.3), 
                      the embeddings will be generated from: 70% title content + 30% description content.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
            <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
              ℹ️ What happens next?
            </h4>
            <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1 list-disc list-inside">
              <li>The model configuration will be saved to the metadata table</li>
              <li>You can update this configuration later if needed</li>
              <li>The embedding model will be loaded when you start generating vectors</li>
              <li>Use the embeddings API to generate vectors for this column</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !settings.model_name}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Configuring..." : "Save Configuration"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
