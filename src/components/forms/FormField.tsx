import React, { useState, useEffect } from 'react';
import { useDataProvider } from '@refinedev/core';

interface FormFieldProps {
  label: string;
  field: string;
  type: string;
  value: unknown;
  onChange: (field: string, value: unknown) => void;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
  className?: string;
  tableName?: string; // For vector field integration
  formData?: Record<string, unknown>; // Access to all form data for vector generation
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  field,
  type,
  value,
  onChange,
  disabled = false,
  placeholder,
  required = false,
  className = "w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white",
  tableName,
  formData = {}
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    let newValue: unknown = e.target.value;
    
    // Type conversion based on field type
    switch (type) {
      case 'integer':
      case 'bigint':
        newValue = e.target.value ? parseInt(e.target.value) : 0;
        break;
      case 'float':
        newValue = e.target.value ? parseFloat(e.target.value) : 0.0;
        break;
      case 'bool':
        newValue = (e.target as HTMLInputElement).checked;
        break;
      case 'json':
        newValue = e.target.value;
        break;
      default:
        newValue = e.target.value;
    }
    
    onChange(field, newValue);
  };

  const [jsonError, setJsonError] = useState<string>('');
  const [jsonValue, setJsonValue] = useState<string>(
    type === 'json' && typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || '')
  );
  const [vectorConfig, setVectorConfig] = useState<any>(null);
  const [isGeneratingVector, setIsGeneratingVector] = useState(false);
  const [lastSourceValues, setLastSourceValues] = useState<Record<string, string>>({});
  const [contentTypes, setContentTypes] = useState<Record<string, 'text' | 'image'>>({});
  const dataProvider = useDataProvider();

  // Helper function to detect if a string is an image URL
  const isImageUrl = (str: string): boolean => {
    if (!str) return false;
    try {
      const url = new URL(str);
      const pathname = url.pathname.toLowerCase();
      return /\.(jpg|jpeg|png|gif|bmp|webp|svg)(\?|$)/.test(pathname) || 
             url.hostname.includes('image') || 
             pathname.includes('image');
    } catch {
      return false;
    }
  };

  // Determine content type for a field value
  const getContentType = (value: unknown): 'text' | 'image' => {
    const stringValue = typeof value === 'object' && value !== null 
      ? JSON.stringify(value) 
      : String(value || '');
    
    return isImageUrl(stringValue) ? 'image' : 'text';
  };

  // Fetch vector configuration for float_vector fields
  useEffect(() => {
    if (type === 'float_vector' && tableName && field && dataProvider) {
      const dp = dataProvider();
      if (dp && dp.custom) {
        dp.custom({
          url: "/search",
          method: "post",
          payload: {
            table: "manager_vector_column_settings",
            query: {
              bool: {
                must: [
                  { match: { tbl_name: tableName } },
                  { match: { col_name: field } }
                ]
              }
            },
            limit: 1
          }
        })
        .then((response: any) => {
          if (response.data?.hits?.hits?.length > 0) {
            const hit = response.data.hits.hits[0];
            const config = {
              model_name: hit._source.mdl_name,
              knn_type: hit._source.knn_type,
              similarity_metric: hit._source.similarity_metric,
              dimensions: hit._source.dimensions,
              combined_fields: hit._source.combined_fields ? 
                (typeof hit._source.combined_fields === 'string' ? 
                  JSON.parse(hit._source.combined_fields) : 
                  hit._source.combined_fields) : undefined
            };
            setVectorConfig(config);
          }
        })
        .catch((error: any) => {
          console.error(`Failed to fetch vector config for ${tableName}.${field}:`, error);
        });
      }
    }
  }, [type, tableName, field, dataProvider]);

  // Auto-generate vector when source fields change
  useEffect(() => {
    if (type === 'float_vector' && vectorConfig && formData) {
      const sourceFields = vectorConfig.combined_fields?.source_fields || [];
      
      if (sourceFields.length > 0) {
        // Check if any source field values have changed
        const currentValues: Record<string, string> = {};
        let hasChanges = false;
        
        sourceFields.forEach((sourceField: string) => {
          const rawValue = formData[sourceField];
          let currentValue = '';
          
          // Handle JSON values by stringifying them
          if (typeof rawValue === 'object' && rawValue !== null) {
            currentValue = JSON.stringify(rawValue);
          } else {
            currentValue = String(rawValue || '');
          }
          
          currentValues[sourceField] = currentValue.trim();
          
          if (currentValue !== lastSourceValues[sourceField]) {
            hasChanges = true;
          }
        });
        
        if (hasChanges && Object.values(currentValues).some(v => v)) {
          setLastSourceValues(currentValues);
          
          // Auto-generate vector if we have values
          handleVectorGeneration('', currentValues);
        }
      }
    }
  }, [formData, vectorConfig, type, lastSourceValues]);

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const rawValue = e.target.value;
    setJsonValue(rawValue);
    
    if (!rawValue.trim()) {
      setJsonError('');
      onChange(field, {});
      return;
    }
    
    try {
      const parsed = JSON.parse(rawValue);
      setJsonError('');
      onChange(field, parsed);
    } catch (error) {
      setJsonError(`Invalid JSON: ${error instanceof Error ? error.message : 'Parse error'}`);
      onChange(field, rawValue);
    }
  };

  const handleJsonKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.target as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = jsonValue.substring(0, start) + '  ' + jsonValue.substring(end);
      setJsonValue(newValue);
      
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
      
      const syntheticEvent = {
        target: { value: newValue }
      } as React.ChangeEvent<HTMLTextAreaElement>;
      handleJsonChange(syntheticEvent);
    }
  };

  const handleVectorGeneration = React.useCallback(async (inputText: string, multiFieldInputs?: Record<string, string>) => {
    if (!vectorConfig?.model_name) return;
    
    setIsGeneratingVector(true);
    try {
      const dp = dataProvider();
      if (dp && dp.custom) {
        if (vectorConfig.combined_fields?.source_fields?.length > 0) {
          // Multi-field embedding with proper content type detection
          const fieldsToUse = multiFieldInputs || {};
          
          // If no explicit multi-field inputs, get from current form data
          if (Object.keys(fieldsToUse).length === 0) {
            vectorConfig.combined_fields.source_fields.forEach((sourceField: string) => {
              const rawValue = formData[sourceField];
              // Stringify JSON values, keep strings as-is
              let stringValue = '';
              if (typeof rawValue === 'object' && rawValue !== null) {
                stringValue = JSON.stringify(rawValue);
              } else {
                stringValue = String(rawValue || '');
              }
              fieldsToUse[sourceField] = stringValue.trim();
            });
          }
          
          // Build fields array with proper types for multi-field endpoint
          const fields = vectorConfig.combined_fields.source_fields
            .map((sourceField: string) => {
              const content = fieldsToUse[sourceField] || '';
              if (!content.trim()) return null;
              
              const contentType = getContentType(content);
              const weight = vectorConfig.combined_fields?.weights?.[sourceField] || 1.0;
              
              return {
                content,
                type: contentType,
                weight,
                model_name: vectorConfig.model_name
              };
            })
            .filter(Boolean);
          
          if (fields.length === 0) return;
          
          console.log('Sending multi-field embedding request:', {
            fields,
            combine_method: "weighted_average",
            normalize: true
          });
          
          const response = await dp.custom({
            url: "/embeddings/multi-field",
            method: "post",
            payload: {
              fields,
              combine_method: "weighted_average",
              normalize: true
            }
          });
          
          if (response.data?.embeddings?.length > 0) {
            onChange(field, response.data.embeddings[0]);
          }
        } else if (inputText.trim()) {
          // Single field embedding
          const contentType = getContentType(inputText);
          
          if (contentType === 'image') {
            console.log('Sending image embedding request:', {
              images: [inputText],
              model_name: vectorConfig.model_name,
              normalize: true
            });
            
            const response = await dp.custom({
              url: "/embeddings/image",
              method: "post",
              payload: {
                images: [inputText],
                model_name: vectorConfig.model_name,
                normalize: true
              }
            });
            
            if (response.data?.embeddings?.length > 0) {
              onChange(field, response.data.embeddings[0]);
            }
          } else {
            console.log('Sending text embedding request:', {
              texts: [inputText],
              model_name: vectorConfig.model_name,
              normalize: true
            });
            
            const response = await dp.custom({
              url: "/embeddings/text",
              method: "post",
              payload: {
                texts: [inputText],
                model_name: vectorConfig.model_name,
                normalize: true
              }
            });
            
            if (response.data?.embeddings?.length > 0) {
              onChange(field, response.data.embeddings[0]);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to generate vector:', error);
    } finally {
      setIsGeneratingVector(false);
    }
  }, [vectorConfig, formData, dataProvider, onChange, field]);

  const renderInput = () => {
    const commonInputProps = {
      value: String(value || ''),
      onChange: handleInputChange,
      disabled,
      required,
      className,
      placeholder
    };

    const jsonProps = {
      value: jsonValue,
      onChange: handleJsonChange,
      disabled,
      required,
      className,
      placeholder
    };

    switch (type) {
      case 'bool':
        return (
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={handleInputChange}
            disabled={disabled}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
          />
        );

      case 'integer':
      case 'bigint':
        return (
          <input
            type="number"
            step="1"
            {...commonInputProps}
          />
        );

      case 'float':
        return (
          <input
            type="number"
            step="0.01"
            {...commonInputProps}
          />
        );

      case 'json':
        return (
          <div>
            <textarea
              rows={6}
              {...jsonProps}
              onKeyDown={handleJsonKeyDown}
              placeholder={placeholder || '{"key": "value"}'}
              className={`${className} font-mono text-sm ${jsonError ? 'border-red-500 dark:border-red-400' : ''}`}
              style={{ tabSize: 2 }}
            />
            {jsonError && (
              <div className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-start space-x-1">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{jsonError}</span>
              </div>
            )}
          </div>
        );

      case 'timestamp':
        return (
          <input
            type="datetime-local"
            {...commonInputProps}
          />
        );

      case 'float_vector':
        return (
          <div className="space-y-3" data-vector-field={field}>
            <div className="flex items-center space-x-2 text-sm text-purple-600 dark:text-purple-400">
              <span>🧠</span>
              <span>Vector field</span>
              {vectorConfig && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({vectorConfig.model_name}, {vectorConfig.dimensions}d)
                </span>
              )}
            </div>
            
            {vectorConfig ? (
              <div className="space-y-3">
                {vectorConfig.combined_fields?.source_fields?.length > 0 ? (
                  // Multi-field display showing current values from form data
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-purple-700 dark:text-purple-300">
                      Multi-field embedding ({vectorConfig.combined_fields.source_fields.length} source fields):
                    </div>
                    
                    <div className="space-y-2">
                      {vectorConfig.combined_fields.source_fields.map((sourceField: string, idx: number) => {
                        const rawValue = formData[sourceField];
                        let displayValue = '';
                        
                        // Handle JSON values by stringifying them
                        if (typeof rawValue === 'object' && rawValue !== null) {
                          displayValue = JSON.stringify(rawValue);
                        } else {
                          displayValue = String(rawValue || '');
                        }
                        
                        const weight = vectorConfig.combined_fields?.weights?.[sourceField] || 1.0;
                        const contentType = getContentType(displayValue);
                        
                        return (
                          <div key={idx} className="p-2 bg-gray-50 dark:bg-gray-700 rounded border">
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                  {sourceField}
                                </span>
                                <span className={`text-xs px-1 py-0.5 rounded ${
                                  contentType === 'image' 
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                }`}>
                                  {contentType === 'image' ? '🖼️ image' : '📝 text'}
                                </span>
                              </div>
                              <span className="text-xs text-purple-600 dark:text-purple-400">
                                weight: {weight.toFixed(2)}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 max-h-20 overflow-y-auto">
                              {displayValue.trim() ? (
                                contentType === 'image' ? (
                                  <div className="flex items-center space-x-2">
                                    <img 
                                      src={displayValue} 
                                      alt="Preview" 
                                      className="w-8 h-8 object-cover rounded"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                    <span className="text-xs text-blue-600 dark:text-blue-400 truncate">
                                      {displayValue}
                                    </span>
                                  </div>
                                ) : (
                                  displayValue
                                )
                              ) : (
                                <em className="text-gray-400">No data yet...</em>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      💡 Vector will auto-generate when source fields are filled
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => handleVectorGeneration('')}
                      disabled={isGeneratingVector || !Object.values(vectorConfig.combined_fields.source_fields.map((f: string) => formData[f])).some(v => String(v || '').trim())}
                      className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                    >
                      {isGeneratingVector ? 'Generating...' : 'Regenerate Vector'}
                    </button>
                  </div>
                ) : (
                  // Single field input
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      placeholder="Enter text to generate vector embedding..."
                      className={`${className} font-normal`}
                      onBlur={(e) => {
                        if (e.target.value.trim()) {
                          handleVectorGeneration(e.target.value);
                        }
                      }}
                      disabled={isGeneratingVector}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        const textarea = e.currentTarget.previousElementSibling as HTMLTextAreaElement;
                        if (textarea?.value.trim()) {
                          handleVectorGeneration(textarea.value);
                        }
                      }}
                      disabled={isGeneratingVector}
                      className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                    >
                      Generate Vector
                    </button>
                  </div>
                )}
                
                {isGeneratingVector && (
                  <div className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Generating vector...</span>
                  </div>
                )}
                
                {Array.isArray(value) && value.length > 0 ? (
                  <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs font-mono text-gray-600 dark:text-gray-400">
                    Vector: [{(value as number[]).slice(0, 3).map(v => v.toFixed(3)).join(', ')}...] ({(value as number[]).length} dims)
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-600 rounded">
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Vector configuration not found. Configure this column first using the Table Schema Editor.
                </div>
              </div>
            )}
          </div>
        );

      default:
        return (
          <input
            type="text"
            {...commonInputProps}
          />
        );
    }
  };

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label} ({type})
        {field === 'id' && disabled && ' (read-only)'}
      </label>
      {type === 'bool' ? (
        <div className="flex items-center space-x-2">
          {renderInput()}
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {value ? 'True' : 'False'}
          </span>
        </div>
      ) : (
        renderInput()
      )}
    </div>
  );
};
