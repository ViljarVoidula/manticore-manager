import React, { useState, useEffect } from 'react';
import { useDataProvider } from '@refinedev/core';

interface VectorColumn {
  tbl_name: string;
  col_name: string;
  mdl_name: string;
  knn_type: string;
  similarity_metric: string;
  dimensions: number;
  combined_fields?: any;
}

interface TableCellRendererProps {
  value: unknown;
  columnField: string;
  columnType: string;
  tableName: string;
}

export const TableCellRenderer: React.FC<TableCellRendererProps> = ({
  value,
  columnField,
  columnType,
  tableName
}) => {
  const [vectorColumns, setVectorColumns] = useState<VectorColumn[]>([]);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const dataProvider = useDataProvider();

  // Fetch vector column mappings on mount
  useEffect(() => {
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
                match: { tbl_name: tableName }
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
  }, [tableName, dataProvider]);

  // Check if current column is a vector column
  const isVectorColumn = columnType === 'float_vector' || 
    vectorColumns.some(vc => vc.col_name === columnField);

  // Helper function to detect if a string is an image URL
  const isImageUrl = (str: string): boolean => {
    if (!str || typeof str !== 'string') return false;
    
    // Check for base64 data URLs first
    if (str.startsWith('data:image/')) {
      return true;
    }
    
    // Check if it looks like a URL
    if (!str.match(/^https?:\/\//)) return false;
    
    try {
      const url = new URL(str);
      const pathname = url.pathname.toLowerCase();
      
      // Check for common image file extensions
      if (/\.(jpg|jpeg|png|gif|bmp|webp|svg|ico|tiff|tif)(\?|$|#)/.test(pathname)) {
        return true;
      }
      
      // Check for image-related domains/paths
      if (url.hostname.includes('image') || 
          pathname.includes('image') || 
          pathname.includes('photo') ||
          pathname.includes('picture') ||
          url.hostname.includes('imgur') ||
          url.hostname.includes('unsplash') ||
          url.hostname.includes('pixabay') ||
          url.hostname.includes('pexels')) {
        return true;
      }
      
      
      return false;
    } catch {
      return false;
    }
  };

  // Check if column should be treated as image based on vector mappings or direct URL detection
  const isImageField = (): boolean => {
    const stringValue = typeof value === 'object' && value !== null 
      ? JSON.stringify(value) 
      : String(value || '');
    
    // First check if it's a direct image URL regardless of vector configuration
    if (isImageUrl(stringValue)) {
      return true;
    }
    
    // Then check if it's configured as an image field in vector mappings
    const vectorColumn = vectorColumns.find(vc => vc.col_name === columnField);
    if (vectorColumn?.combined_fields?.source_fields?.includes(columnField)) {
      return isImageUrl(stringValue);
    }
    
    return false;
  };

  // Copy to clipboard function
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) {
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2000);
      console.error('Failed to copy to clipboard:', error);
    }
  };

  // Handle vector column rendering
  if (isVectorColumn && Array.isArray(value)) {
    return (
      <div className="flex items-center space-x-2">
        <button
          onClick={() => copyToClipboard(JSON.stringify(value))}
          className={`px-2 py-1 text-xs rounded border transition-colors ${
            copyStatus === 'copied' 
              ? 'bg-green-100 border-green-300 text-green-700 dark:bg-green-900 dark:border-green-600 dark:text-green-300'
              : copyStatus === 'error'
              ? 'bg-red-100 border-red-300 text-red-700 dark:bg-red-900 dark:border-red-600 dark:text-red-300'
              : 'bg-purple-100 border-purple-300 text-purple-700 hover:bg-purple-200 dark:bg-purple-900 dark:border-purple-600 dark:text-purple-300 dark:hover:bg-purple-800'
          }`}
        >
          {copyStatus === 'copied' ? '✓ Copied' : copyStatus === 'error' ? '✗ Error' : '📋 Copy'}
        </button>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Vector ({value.length}d)
        </span>
      </div>
    );
  }

  // Handle image URL rendering
  const stringValue = typeof value === 'object' && value !== null 
    ? JSON.stringify(value) 
    : String(value || '');

  if (isImageField() && isImageUrl(stringValue)) {
    return (
      <div className="flex items-center space-x-2">
        <img 
          src={stringValue} 
          alt="Preview" 
          className="w-12 h-12 object-cover rounded border border-gray-200 dark:border-gray-600 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => window.open(stringValue, '_blank')}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <div className="flex flex-col space-y-1">
          <span className="text-xs text-blue-600 dark:text-blue-400 truncate max-w-32">
            {stringValue}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard(stringValue);
            }}
            className={`px-1 py-0.5 text-xs rounded border transition-colors self-start ${
              copyStatus === 'copied' 
                ? 'bg-green-100 border-green-300 text-green-700 dark:bg-green-900 dark:border-green-600 dark:text-green-300'
                : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {copyStatus === 'copied' ? '✓' : '📋'}
          </button>
        </div>
      </div>
    );
  }

  // Handle regular content rendering
  if (typeof value === 'object' && value !== null) {
    const jsonString = JSON.stringify(value);
    if (jsonString.length > 100) {
      return (
        <div className="flex items-center space-x-2">
          <span className="truncate max-w-32 text-sm">
            {jsonString.substring(0, 50)}...
          </span>
          <button
            onClick={() => copyToClipboard(jsonString)}
            className={`px-1 py-0.5 text-xs rounded border transition-colors ${
              copyStatus === 'copied' 
                ? 'bg-green-100 border-green-300 text-green-700 dark:bg-green-900 dark:border-green-600 dark:text-green-300'
                : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {copyStatus === 'copied' ? '✓' : '📋'}
          </button>
        </div>
      );
    }
    return <span className="text-sm">{jsonString}</span>;
  }

  // Default string rendering
  const displayValue = String(value || '');
  if (displayValue.length > 100) {
    return (
      <div className="flex items-center space-x-2">
        <span className="truncate max-w-32 text-sm">
          {displayValue.substring(0, 50)}...
        </span>
        <button
          onClick={() => copyToClipboard(displayValue)}
          className={`px-1 py-0.5 text-xs rounded border transition-colors ${
            copyStatus === 'copied' 
              ? 'bg-green-100 border-green-300 text-green-700 dark:bg-green-900 dark:border-green-600 dark:text-green-300'
              : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
        }`}
        >
          {copyStatus === 'copied' ? '✓' : '📋'}
        </button>
      </div>
    );
  }

  return <span className="text-sm">{displayValue}</span>;
};