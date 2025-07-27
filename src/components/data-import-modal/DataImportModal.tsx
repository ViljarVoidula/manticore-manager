import React, { useState, useCallback, useEffect } from 'react';
import { useDataProvider } from '@refinedev/core';
import Papa from 'papaparse';
import { Modal } from '../forms';
import { TableInfo } from '../../types/manticore';

interface ParsedFileData {
  headers: string[];
  rows: string[][];
  totalRows: number;
  fileType: 'csv' | 'tsv' | 'json';
}

interface FieldMapping {
  csvField: string;
  tableColumn: string;
  enabled: boolean;
}

interface VectorColumn {
  tbl_name: string;
  col_name: string;
  mdl_name: string;
  knn_type: string;
  similarity_metric: string;
  dimensions: number;
  combined_fields?: any;
}

interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  table: TableInfo;
}

type ImportStep = 'upload' | 'mapping' | 'importing' | 'complete';

export const DataImportModal: React.FC<DataImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  table
}) => {
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedFileData | null>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [uploadError, setUploadError] = useState<string>('');
  const [importProgress, setImportProgress] = useState(0);
  const [importError, setImportError] = useState<string>('');
  const [vectorColumns, setVectorColumns] = useState<VectorColumn[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [importCancelled, setImportCancelled] = useState(false);
  
  const dataProvider = useDataProvider();
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

  // Load vector column configurations
  useEffect(() => {
    if (isOpen && table.name) {
      const fetchVectorColumns = async () => {
        try {
          const dp = dataProvider();
          if (dp && dp.custom) {
            const response = await dp.custom({
              url: "/search",
              method: "post",
              payload: {
                table: "manager_vector_column_settings",
                query: {
                  match: { tbl_name: table.name }
                },
                limit: 100
              }
            });

            if (response.data?.hits?.hits?.length > 0) {
              const columns = response.data.hits.hits.map((hit: any) => ({
                tbl_name: hit._source.tbl_name,
                col_name: hit._source.col_name,
                mdl_name: hit._source.mdl_name,
                knn_type: hit._source.knn_type,
                similarity_metric: hit._source.similarity_metric,
                dimensions: hit._source.dimensions,
                combined_fields: hit._source.combined_fields ? 
                  (typeof hit._source.combined_fields === 'string' ? 
                    JSON.parse(hit._source.combined_fields) : 
                    hit._source.combined_fields) : undefined
              }));
              setVectorColumns(columns);
            }
          }
        } catch (error) {
          console.error('Failed to fetch vector columns:', error);
        }
      };

      fetchVectorColumns();
    }
  }, [isOpen, table.name, dataProvider]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('upload');
      setUploadedFile(null);
      setParsedData(null);
      setFieldMappings([]);
      setUploadError('');
      setImportProgress(0);
      setImportError('');
      setIsDragOver(false);
      setIsCancelling(false);
      setImportCancelled(false);
    }
  }, [isOpen]);

  const processFile = useCallback((file: File) => {
    setUploadError('');

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('File size exceeds 100MB limit');
      return;
    }

    // Determine file type
    const fileName = file.name.toLowerCase();
    let fileType: 'csv' | 'tsv' | 'json' | null = null;
    
    if (fileName.endsWith('.csv')) {
      fileType = 'csv';
    } else if (fileName.endsWith('.tsv') || fileName.endsWith('.txt')) {
      fileType = 'tsv';
    } else if (fileName.endsWith('.json')) {
      fileType = 'json';
    } else {
      setUploadError('Unsupported file format. Please upload CSV, TSV, or JSON files.');
      return;
    }

    setUploadedFile(file);

    // Parse file based on type
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        
        if (!text.trim()) {
          setUploadError('File is empty');
          return;
        }

        let headers: string[] = [];
        let rows: string[][] = [];

        if (fileType === 'json') {
          // Parse JSON file
          const jsonData = JSON.parse(text);
          
          if (Array.isArray(jsonData)) {
            if (jsonData.length === 0) {
              setUploadError('JSON array is empty');
              return;
            }
            
            // Extract headers from first object
            const firstItem = jsonData[0];
            if (typeof firstItem === 'object' && firstItem !== null) {
              headers = Object.keys(firstItem);
              rows = jsonData.map(item => 
                headers.map(header => {
                  const value = item[header];
                  return typeof value === 'object' && value !== null 
                    ? JSON.stringify(value) 
                    : String(value || '');
                })
              );
            } else {
              setUploadError('JSON array must contain objects');
              return;
            }
          } else if (typeof jsonData === 'object' && jsonData !== null) {
            // Single object - treat keys as headers and values as single row
            headers = Object.keys(jsonData);
            rows = [headers.map(header => {
              const value = jsonData[header];
              return typeof value === 'object' && value !== null 
                ? JSON.stringify(value) 
                : String(value || '');
            })];
          } else {
            setUploadError('JSON must be an array of objects or a single object');
            return;
          }
        } else {
          // Parse CSV/TSV using PapaParse
          const delimiter = fileType === 'csv' ? ',' : '\t';
          const parseResult = Papa.parse(text, {
            delimiter,
            header: false,
            skipEmptyLines: true,
            transformHeader: (header: string) => header.trim(),
            transform: (value: string) => value.trim()
          });

          if (parseResult.errors.length > 0) {
            console.warn('Parse warnings:', parseResult.errors);
          }

          const data = parseResult.data as string[][];
          
          if (data.length === 0) {
            setUploadError(`${fileType.toUpperCase()} file is empty`);
            return;
          }

          headers = data[0];
          rows = data.slice(1);
        }

        console.log('Parsed headers:', headers);
        console.log(`Parsed ${rows.length} data rows`);

        setParsedData({
          headers,
          rows: rows.slice(0, 100), // Show first 100 rows for preview
          totalRows: rows.length,
          fileType
        });

        // Initialize field mappings with better logic
        const mappings: FieldMapping[] = headers.map(header => {
          // Check if this field contains vector data (array of numbers)
          const isVectorData = rows.length > 0 && isFieldContainingVectorData(rows[0][headers.indexOf(header)]);
          
          // Try to find matching table column
          const matchingColumn = table.columns?.find(col => 
            col.field.toLowerCase() === header.toLowerCase() ||
            col.field.toLowerCase().includes(header.toLowerCase()) ||
            header.toLowerCase().includes(col.field.toLowerCase())
          );

          // If field contains vector data, only auto-map to actual vector columns (float_vector type)
          let suggestedColumn = '';
          if (isVectorData) {
            const actualVectorCol = table.columns?.find(col => col.type === 'float_vector');
            suggestedColumn = actualVectorCol?.field || '';
          } else {
            suggestedColumn = matchingColumn?.field || '';
          }

          return {
            csvField: header,
            tableColumn: suggestedColumn,
            enabled: !!suggestedColumn
          };
        });

        setFieldMappings(mappings);
        console.log(`Successfully parsed ${fileType.toUpperCase()}, switching to mapping step`);
        setCurrentStep('mapping');
      } catch (error) {
        setUploadError(`Failed to parse ${fileType?.toUpperCase() || 'file'}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error('File parsing error:', error);
      }
    };

    reader.readAsText(file);
  }, [table.columns, MAX_FILE_SIZE]);

  // Helper function to detect if a field contains vector data
  const isFieldContainingVectorData = (value: string): boolean => {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) && parsed.length > 0 && parsed.every(v => typeof v === 'number');
    } catch {
      return false;
    }
  };

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  const handleCancelImport = () => {
    setIsCancelling(true);
    setImportCancelled(true);
  };

  const handleMappingChange = (csvField: string, tableColumn: string) => {
    setFieldMappings(prev => 
      prev.map(mapping => 
        mapping.csvField === csvField 
          ? { ...mapping, tableColumn, enabled: !!tableColumn }
          : mapping
      )
    );
  };

  const handleMappingToggle = (csvField: string) => {
    setFieldMappings(prev => 
      prev.map(mapping => 
        mapping.csvField === csvField 
          ? { ...mapping, enabled: !mapping.enabled }
          : mapping
      )
    );
  };

  // Helper function to generate vector for a field
  const generateVector = async (vectorColumn: VectorColumn, docData: Record<string, unknown>): Promise<number[] | null> => {
    try {
      const dp = dataProvider();
      if (!dp || !dp.custom) return null;

      // Check if it's a multi-field vector
      if (vectorColumn.combined_fields?.source_fields?.length > 0) {
        const fields = vectorColumn.combined_fields.source_fields
          .map((sourceField: string) => {
            const content = docData[sourceField];
            if (!content) return null;
            
            let stringValue: string;
            if (typeof content === 'object' && content !== null) {
              stringValue = JSON.stringify(content);
            } else {
              stringValue = String(content);
            }
            
            if (!stringValue.trim()) return null;

            // Determine content type
            const isImage = /^https?:\/\/.*\.(jpg|jpeg|png|gif|bmp|webp|svg)/i.test(stringValue) ||
                            stringValue.startsWith('data:image/');
            
            const weight = vectorColumn.combined_fields?.weights?.[sourceField] || 1.0;
            
            return {
              content: stringValue,
              type: isImage ? 'image' : 'text',
              weight,
              model_name: vectorColumn.mdl_name
            };
          })
          .filter(Boolean);

        if (fields.length === 0) return null;

        const response = await dp.custom({
          url: "/embeddings/multi-field",
          method: "post",
          payload: {
            fields,
            combine_method: "weighted_average",
            normalize: true
          }
        });

        return response.data?.embeddings?.[0] || null;
      } else {
        // Single field vector - try to find a suitable source field
        const sourceField = Object.keys(docData).find(field => 
          field !== vectorColumn.col_name && docData[field] && String(docData[field]).trim()
        );
        
        if (!sourceField) return null;
        
        const content = docData[sourceField];
        let stringValue: string;
        if (typeof content === 'object' && content !== null) {
          stringValue = JSON.stringify(content);
        } else {
          stringValue = String(content);
        }

        if (!stringValue.trim()) return null;

        // Determine content type
        const isImage = /^https?:\/\/.*\.(jpg|jpeg|png|gif|bmp|webp|svg)/i.test(stringValue) ||
                        stringValue.startsWith('data:image/');

        if (isImage) {
          const response = await dp.custom({
            url: "/embeddings/image",
            method: "post",
            payload: {
              images: [stringValue],
              model_name: vectorColumn.mdl_name,
              normalize: true
            }
          });
          return response.data?.embeddings?.[0] || null;
        } else {
          const response = await dp.custom({
            url: "/embeddings/text",
            method: "post",
            payload: {
              texts: [stringValue],
              model_name: vectorColumn.mdl_name,
              normalize: true
            }
          });
          return response.data?.embeddings?.[0] || null;
        }
      }
    } catch (error) {
      console.error('Failed to generate vector:', error);
      return null;
    }
  };

  const handleImport = async () => {
    if (!parsedData || !uploadedFile) return;

    setCurrentStep('importing');
    setImportProgress(0);
    setImportError('');
    setIsCancelling(false);
    setImportCancelled(false);

    try {
      const enabledMappings = fieldMappings.filter(m => m.enabled && m.tableColumn);
      
      if (enabledMappings.length === 0) {
        setImportError('Please map at least one field');
        setCurrentStep('mapping');
        return;
      }

      const dp = dataProvider();
      if (!dp) {
        setImportError('Data provider not available');
        setCurrentStep('mapping');
        return;
      }

      // Process data in batches
      const batchSize = 50; // Smaller batches for vector generation
      const totalBatches = Math.ceil(parsedData.totalRows / batchSize);
      
      // Re-read file to get all data (not just preview)
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          let allRows: string[][] = [];

          if (parsedData.fileType === 'json') {
            // Re-parse JSON
            const jsonData = JSON.parse(text);
            const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
            allRows = dataArray.map(item => 
              parsedData.headers.map(header => {
                const value = item[header];
                return typeof value === 'object' && value !== null 
                  ? JSON.stringify(value) 
                  : String(value || '');
              })
            );
          } else {
            // Re-parse CSV/TSV
            const delimiter = parsedData.fileType === 'csv' ? ',' : '\t';
            const parseResult = Papa.parse(text, {
              delimiter,
              header: false,
              skipEmptyLines: true,
              transform: (value: string) => value.trim()
            });
            const data = parseResult.data as string[][];
            allRows = data.slice(1); // Skip header row
          }

          let successCount = 0;
          let errorCount = 0;

          // Process in batches
          for (let i = 0; i < totalBatches; i++) {
            // Check for cancellation before each batch
            if (importCancelled) {
              setImportError('Import cancelled by user');
              setCurrentStep('mapping');
              return;
            }

            const batchStart = i * batchSize;
            const batchEnd = Math.min(batchStart + batchSize, allRows.length);
            const batchRows = allRows.slice(batchStart, batchEnd);

            // Process each row in the batch
            for (const row of batchRows) {
              // Check for cancellation before each row
              if (importCancelled) {
                setImportError(`Import cancelled by user. ${successCount} rows were imported successfully.`);
                setCurrentStep('mapping');
                return;
              }

              try {
                const doc: Record<string, unknown> = {};
                
                // Map all enabled fields based on their table column types
                // Group mappings by table column to handle multiple fields mapping to same column
                const mappingsByColumn = new Map<string, FieldMapping[]>();
                enabledMappings.forEach(mapping => {
                  if (!mappingsByColumn.has(mapping.tableColumn)) {
                    mappingsByColumn.set(mapping.tableColumn, []);
                  }
                  const columnMappings = mappingsByColumn.get(mapping.tableColumn);
                  if (columnMappings) {
                    columnMappings.push(mapping);
                  }
                });

                // Process each target column
                mappingsByColumn.forEach((mappings, tableColumn) => {
                  const column = table.columns?.find(col => col.field === tableColumn);
                  const isActualVectorColumn = column?.type === 'float_vector';
                  
                  // For actual vector columns (float_vector type), skip direct mapping - they'll be generated below
                  if (isActualVectorColumn) {
                    return;
                  }
                  
                  // Collect values from all CSV fields mapping to this table column
                  const values: unknown[] = [];
                  
                  mappings.forEach(mapping => {
                    const csvIndex = parsedData.headers.indexOf(mapping.csvField);
                    if (csvIndex >= 0 && csvIndex < row.length) {
                      const value = row[csvIndex];
                      
                      // Check if the CSV field contains vector data (array of numbers)
                      let parsedValue: unknown = value;
                      try {
                        const jsonValue = JSON.parse(value);
                        if (Array.isArray(jsonValue) && jsonValue.every(v => typeof v === 'number')) {
                          console.warn(`Skipping vector array data in CSV field "${mapping.csvField}" - cannot map to non-vector column "${tableColumn}" (${column?.type})`);
                          return;
                        }
                        parsedValue = jsonValue;
                      } catch {
                        // Not JSON, use as string
                        parsedValue = value;
                      }
                      
                      values.push(parsedValue);
                    }
                  });
                  
                  if (values.length === 0) {
                    return;
                  }
                  
                  // Combine values based on column type
                  let finalValue: unknown;
                  
                  if (values.length === 1) {
                    // Single value - use as is
                    finalValue = values[0];
                  } else {
                    // Multiple values - concatenate based on column type
                    if (column) {
                      switch (column.type) {
                        case 'json':
                          // For JSON columns, create an array of all values
                          finalValue = values;
                          break;
                        case 'integer':
                        case 'bigint':
                          // For numeric columns, sum the values
                          finalValue = values.reduce((sum, val) => {
                            const num = val ? parseInt(String(val)) || 0 : 0;
                            return (typeof sum === 'number' ? sum : 0) + num;
                          }, 0);
                          break;
                        case 'float':
                          // For float columns, sum the values
                          finalValue = values.reduce((sum, val) => {
                            const num = val ? parseFloat(String(val)) || 0.0 : 0.0;
                            return (typeof sum === 'number' ? sum : 0) + num;
                          }, 0.0);
                          break;
                        case 'bool':
                          // For boolean columns, use OR logic (true if any value is true)
                          finalValue = values.some(val => 
                            String(val).toLowerCase() === 'true' || String(val) === '1'
                          );
                          break;
                        default:
                          // For text/string columns, concatenate with space separator
                          finalValue = values
                            .map(val => String(val).trim())
                            .filter(val => val.length > 0)
                            .join(' ');
                      }
                    } else {
                      // Unknown column type - concatenate as strings
                      finalValue = values
                        .map(val => String(val).trim())
                        .filter(val => val.length > 0)
                        .join(' ');
                    }
                  }
                  
                  // Type conversion for final value based on table column type
                  if (column) {
                    switch (column.type) {
                      case 'integer':
                      case 'bigint':
                        doc[tableColumn] = typeof finalValue === 'number' ? finalValue : (finalValue ? parseInt(String(finalValue)) || 0 : 0);
                        break;
                      case 'float':
                        doc[tableColumn] = typeof finalValue === 'number' ? finalValue : (finalValue ? parseFloat(String(finalValue)) || 0.0 : 0.0);
                        break;
                      case 'bool':
                        doc[tableColumn] = typeof finalValue === 'boolean' ? finalValue : (String(finalValue).toLowerCase() === 'true' || String(finalValue) === '1');
                        break;
                      case 'json':
                        doc[tableColumn] = finalValue;
                        break;
                      default:
                        // For text, string fields - store as string
                        doc[tableColumn] = String(finalValue);
                    }
                  } else {
                    doc[tableColumn] = String(finalValue);
                  }
                });

                // Generate vectors only for actual vector columns (float_vector type)
                const actualVectorColumns = vectorColumns.filter(vectorColumn => {
                  const column = table.columns?.find(col => col.field === vectorColumn.col_name);
                  return column?.type === 'float_vector';
                });

                for (const vectorColumn of actualVectorColumns) {
                  // Check if this vector column has mapped source fields or available data
                  const hasSourceData = vectorColumn.combined_fields?.source_fields?.some((sourceField: string) => 
                    enabledMappings.some(mapping => mapping.tableColumn === sourceField) && doc[sourceField]
                  ) || Object.keys(doc).some(field => field !== vectorColumn.col_name && doc[field]);

                  if (hasSourceData) {
                    const vector = await generateVector(vectorColumn, doc);
                    if (vector) {
                      doc[vectorColumn.col_name] = vector;
                    }
                  }
                }

                // Create document
                await dp.create({
                  resource: table.name,
                  variables: doc
                });

                successCount++;
              } catch (error) {
                console.error('Failed to import row:', error);
                errorCount++;
              }
            }

            const progress = ((i + 1) / totalBatches) * 100;
            setImportProgress(progress);
            
            // Small delay to allow cancellation to be processed
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          if (errorCount > 0) {
            setImportError(`Import completed with ${errorCount} errors. ${successCount} rows imported successfully.`);
          }

          setCurrentStep('complete');
        } catch (error) {
          setImportError(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          setCurrentStep('mapping');
        }
      };

      reader.readAsText(uploadedFile);
    } catch (error) {
      setImportError(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setCurrentStep('mapping');
    }
  };

  const handleClose = () => {
    // If import is in progress, cancel it first
    if (currentStep === 'importing' && !importCancelled) {
      handleCancelImport();
      return;
    }

    setUploadedFile(null);
    setParsedData(null);
    setFieldMappings([]);
    setUploadError('');
    setImportProgress(0);
    setImportError('');
    setIsDragOver(false);
    setIsCancelling(false);
    setImportCancelled(false);
    setCurrentStep('upload');
    onClose();
  };

  const renderUploadStep = () => (
    <div className="space-y-4">
      {/* Drag and Drop Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="text-4xl mb-4">
          {isDragOver ? '📥' : '📁'}
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {isDragOver ? 'Drop file here' : 'Upload Data File'}
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          {isDragOver 
            ? 'Release to upload your file'
            : `Drag and drop a CSV, TSV, or JSON file for importing into the ${table.name} table`
          }
        </p>
        
        {!isDragOver && (
          <div className="max-w-sm mx-auto">
            <label className="block">
              <input
                type="file"
                accept=".csv,.tsv,.txt,.json"
                onChange={handleFileUpload}
                className="sr-only"
              />
              <div className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer inline-block transition-colors">
                Choose File
              </div>
            </label>
          </div>
        )}
        
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
          Supported: CSV, TSV, JSON files up to 100MB
        </p>
      </div>

      {/* File info if selected */}
      {uploadedFile && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-600 rounded-md p-3">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <div>
              <span className="text-sm font-medium text-green-800 dark:text-green-300">
                {uploadedFile.name}
              </span>
              <span className="text-xs text-green-600 dark:text-green-400 ml-2">
                ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
          </div>
        </div>
      )}
      
      {uploadError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-600 rounded-md p-3">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-red-800 dark:text-red-300">{uploadError}</span>
          </div>
        </div>
      )}
    </div>
  );

  const renderMappingStep = () => (
    <div className="space-y-4">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Map {parsedData?.fileType?.toUpperCase()} Fields to Table Columns
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {parsedData?.totalRows} rows found in {parsedData?.fileType?.toUpperCase()} file. Map your data fields to table columns.
        </p>
        
        <div className="mt-2 space-y-2">
          {vectorColumns.filter(vc => {
            const column = table.columns?.find(col => col.field === vc.col_name);
            return column?.type === 'float_vector';
          }).length > 0 && (
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-600 rounded-md">
              <div className="flex items-center text-sm text-purple-800 dark:text-purple-300">
                <span className="mr-2">🧠</span>
                <span>
                  Vector fields ({vectorColumns.filter(vc => {
                    const column = table.columns?.find(col => col.field === vc.col_name);
                    return column?.type === 'float_vector';
                  }).map(vc => vc.col_name).join(', ')}) will be auto-generated from text/image content.
                </span>
              </div>
            </div>
          )}
          
          {vectorColumns.filter(vc => {
            const column = table.columns?.find(col => col.field === vc.col_name);
            return column?.type !== 'float_vector';
          }).length > 0 && (
            <div className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-600 rounded-md">
              <div className="flex items-center text-sm text-green-800 dark:text-green-300">
                <span className="mr-2">⚙️</span>
                <span>
                  Fields with vector config ({vectorColumns.filter(vc => {
                    const column = table.columns?.find(col => col.field === vc.col_name);
                    return column?.type !== 'float_vector';
                  }).map(vc => vc.col_name).join(', ')}) will store original data and auto-generate vectors.
                </span>
              </div>
            </div>
          )}
          
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-600 rounded-md">
            <div className="flex items-center text-sm text-blue-800 dark:text-blue-300">
              <span className="mr-2">💡</span>
              <span>
                Fields marked with 🔢 contain vector data. These should only be mapped to vector columns (float_vector type).
              </span>
            </div>
          </div>
          
          <div className="p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-600 rounded-md">
            <div className="flex items-center text-sm text-amber-800 dark:text-amber-300">
              <span className="mr-2">🔗</span>
              <span>
                Multiple CSV fields can be mapped to the same table column. Values will be combined: text fields are concatenated with spaces, numbers are summed, JSON fields become arrays.
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto space-y-3">
        {fieldMappings.map((mapping, index) => (
          <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-md p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={mapping.enabled}
                  onChange={() => handleMappingToggle(mapping.csvField)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-gray-900 dark:text-white">
                  {mapping.csvField}
                  {parsedData && parsedData.rows.length > 0 && (() => {
                    const sampleValue = parsedData.rows[0][parsedData.headers.indexOf(mapping.csvField)];
                    const isVectorData = isFieldContainingVectorData(sampleValue || '');
                    return isVectorData ? ' 🔢' : '';
                  })()}
                </span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {parsedData && parsedData.rows.length > 0 && (() => {
                  const sampleValue = parsedData.rows[0][parsedData.headers.indexOf(mapping.csvField)];
                  const isVectorData = isFieldContainingVectorData(sampleValue || '');
                  return isVectorData ? 'Vector Data' : 'CSV Field';
                })()}
              </span>
            </div>
            
            {mapping.enabled && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Map to table column:
                </label>
                <select
                  value={mapping.tableColumn}
                  onChange={(e) => handleMappingChange(mapping.csvField, e.target.value)}
                  className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select column...</option>
                  {table.columns?.filter(col => col.field !== 'id').map(column => {
                    const isActualVectorColumn = column.type === 'float_vector';
                    const hasVectorConfig = vectorColumns.some(vc => vc.col_name === column.field);
                    
                    // Count how many fields are already mapped to this column
                    const mappedCount = fieldMappings.filter(m => 
                      m.enabled && m.tableColumn === column.field && m.csvField !== mapping.csvField
                    ).length;
                    
                    const mappedIndicator = mappedCount > 0 ? ` (${mappedCount + 1} fields)` : '';
                    
                    return (
                      <option key={column.field} value={column.field}>
                        {column.field} ({column.type}) {isActualVectorColumn ? '🧠' : hasVectorConfig ? '⚙️' : ''}{mappedIndicator}
                      </option>
                    );
                  })}
                </select>

                {/* Warning for incompatible mappings */}
                {mapping.tableColumn && parsedData && parsedData.rows.length > 0 && (() => {
                  const sampleValue = parsedData.rows[0][parsedData.headers.indexOf(mapping.csvField)];
                  const isVectorData = isFieldContainingVectorData(sampleValue || '');
                  const selectedColumn = table.columns?.find(col => col.field === mapping.tableColumn);
                  const isTargetVectorColumn = selectedColumn?.type === 'float_vector';
                  const hasVectorConfig = vectorColumns.some(vc => vc.col_name === mapping.tableColumn);
                  
                  if (isVectorData && !isTargetVectorColumn) {
                    return (
                      <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-600 rounded-md">
                        <div className="flex items-center text-sm text-yellow-800 dark:text-yellow-300">
                          <span className="mr-2">⚠️</span>
                          <span>
                            This field contains vector data (array of numbers) but you're mapping it to a non-vector column ({selectedColumn?.type}). 
                            This data will be skipped during import.
                          </span>
                        </div>
                      </div>
                    );
                  }
                  
                  if (!isVectorData && isTargetVectorColumn) {
                    return (
                      <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-600 rounded-md">
                        <div className="flex items-center text-sm text-blue-800 dark:text-blue-300">
                          <span className="mr-2">ℹ️</span>
                          <span>
                            Vector will be auto-generated from this text/image data during import.
                          </span>
                        </div>
                      </div>
                    );
                  }
                  
                  if (!isVectorData && hasVectorConfig && !isTargetVectorColumn) {
                    return (
                      <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-600 rounded-md">
                        <div className="flex items-center text-sm text-green-800 dark:text-green-300">
                          <span className="mr-2">⚙️</span>
                          <span>
                            This field has vector configuration. The original data will be stored, and vectors will be auto-generated.
                          </span>
                        </div>
                      </div>
                    );
                  }
                  
                  // Check if multiple fields are mapped to the same column
                  const otherFieldsToSameColumn = fieldMappings.filter(m => 
                    m.enabled && m.tableColumn === mapping.tableColumn && m.csvField !== mapping.csvField
                  );
                  
                  if (otherFieldsToSameColumn.length > 0) {
                    const combineMethod = selectedColumn?.type === 'json' ? 'combined into an array' :
                                        selectedColumn?.type === 'integer' || selectedColumn?.type === 'bigint' || selectedColumn?.type === 'float' ? 'summed together' :
                                        selectedColumn?.type === 'bool' ? 'combined with OR logic' :
                                        'concatenated with spaces';
                    
                    return (
                      <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-600 rounded-md">
                        <div className="flex items-center text-sm text-orange-800 dark:text-orange-300">
                          <span className="mr-2">🔗</span>
                          <span>
                            Multiple fields mapped to this column: {[mapping.csvField, ...otherFieldsToSameColumn.map(m => m.csvField)].join(', ')}. 
                            Values will be {combineMethod}.
                          </span>
                        </div>
                      </div>
                    );
                  }
                  
                  return null;
                })()}
                
                {/* Preview sample data */}
                {parsedData && parsedData.rows.length > 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium">Sample data: </span>
                    {parsedData.rows.slice(0, 3).map((row) => {
                      const cellIndex = parsedData.headers.indexOf(mapping.csvField);
                      return cellIndex >= 0 ? `"${row[cellIndex] || ''}"` : '';
                    }).filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {importError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-600 rounded-md p-3">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-red-800 dark:text-red-300">{importError}</span>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <button
          onClick={() => setCurrentStep('upload')}
          className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          Back
        </button>
        <button
          onClick={handleImport}
          disabled={fieldMappings.filter(m => m.enabled && m.tableColumn).length === 0}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start Import
        </button>
      </div>
    </div>
  );

  const renderImportingStep = () => (
    <div className="space-y-4 text-center py-8">
      <div className="text-4xl mb-4">
        {isCancelling ? '🛑' : importCancelled ? '❌' : '⏳'}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        {isCancelling ? 'Cancelling Import...' : importCancelled ? 'Import Cancelled' : 'Importing Data...'}
      </h3>
      <div className="max-w-sm mx-auto">
        <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              importCancelled ? 'bg-red-500' : 'bg-blue-600'
            }`}
            style={{ width: `${importProgress}%` }}
          />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {importCancelled 
            ? 'Process stopped' 
            : isCancelling 
            ? 'Stopping...' 
            : `${Math.round(importProgress)}% complete`
          }
        </p>
      </div>
      
      {!importCancelled && !isCancelling && (
        <button
          onClick={handleCancelImport}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Cancel Import
        </button>
      )}
      
      {importCancelled && (
        <button
          onClick={() => setCurrentStep('mapping')}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          Back to Mapping
        </button>
      )}
    </div>
  );

  const renderCompleteStep = () => (
    <div className="space-y-4 text-center py-8">
      <div className="text-4xl mb-4">✅</div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Import Complete!
      </h3>
      <p className="text-gray-500 dark:text-gray-400">
        Successfully imported {parsedData?.totalRows} rows from {parsedData?.fileType?.toUpperCase()} file into {table.name}
      </p>
      <button
        onClick={() => {
          onSuccess();
          handleClose();
        }}
        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
      >
        Done
      </button>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'upload':
        return renderUploadStep();
      case 'mapping':
        return renderMappingStep();
      case 'importing':
        return renderImportingStep();
      case 'complete':
        return renderCompleteStep();
      default:
        return renderUploadStep();
    }
  };

  if (!isOpen) return null;

  const handleModalClose = () => {
    // Prevent closing during active import
    if (currentStep === 'importing' && !importCancelled) {
      return;
    }
    handleClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title={`Import Data - ${table.name}`}
      size="2xl"
    >
      <div className="min-h-96">
        {renderCurrentStep()}
      </div>
      
      {/* Show warning for closing during import */}
      {currentStep === 'importing' && !importCancelled && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            💡 Close button is disabled during import to prevent data loss. Use "Cancel Import" to stop the process.
          </div>
        </div>
      )}
    </Modal>
  );
};