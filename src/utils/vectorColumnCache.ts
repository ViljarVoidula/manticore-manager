/**
 * Shared cache for vector column settings to prevent duplicate API requests
 * Used by both SearchFilter and TableCellRenderer components
 */

export interface VectorColumnInfo {
  table_name: string;
  column_name: string;
  model_name: string;
  combined_fields?: {
    weights?: Record<string, number>;
    source_fields?: string[];
  };
  dimensions?: number;
  knn_type?: string;
  similarity_metric?: string;
}

interface CacheEntry {
  data: VectorColumnInfo[];
  timestamp: number;
  expiresAt: number;
}

// Global cache for vector column settings
const vectorColumnSettingsCache = new Map<string, CacheEntry>();

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Function to clear expired entries from cache
const clearExpiredCache = () => {
  const now = Date.now();
  for (const [key, entry] of vectorColumnSettingsCache.entries()) {
    if (now >= entry.expiresAt) {
      vectorColumnSettingsCache.delete(key);
    }
  }
};

// Clear expired cache entries every minute
const intervalId = setInterval(clearExpiredCache, 60 * 1000);

// Export function to manually clear cache for specific table or all
export const clearVectorColumnSettingsCache = (tableName?: string) => {
  if (tableName) {
    // Clear cache entries for specific table
    for (const [key] of vectorColumnSettingsCache.entries()) {
      if (key.startsWith(`${tableName}:`)) {
        vectorColumnSettingsCache.delete(key);
      }
    }
  } else {
    // Clear all cache entries
    vectorColumnSettingsCache.clear();
  }
};

// Export function to get cached vector column settings
export const getCachedVectorColumnSettings = (tableName: string): VectorColumnInfo[] | null => {
  const cacheKey = `${tableName}:vector_settings`;
  const cached = vectorColumnSettingsCache.get(cacheKey);
  const now = Date.now();
  
  if (cached && now < cached.expiresAt) {
    console.log(`✅ Using cached vector settings for ${tableName} (age: ${((now - cached.timestamp) / 1000).toFixed(1)}s)`);
    return cached.data;
  }
  
  // Clear expired entry
  if (cached && now >= cached.expiresAt) {
    console.log(`🗑️ Removing expired cache entry for ${tableName}`);
    vectorColumnSettingsCache.delete(cacheKey);
  }
  
  return null;
};

// Export function to set cached vector column settings
export const setCachedVectorColumnSettings = (tableName: string, data: VectorColumnInfo[]): void => {
  const now = Date.now();
  const cacheKey = `${tableName}:vector_settings`;
  
  vectorColumnSettingsCache.set(cacheKey, {
    data,
    timestamp: now,
    expiresAt: now + CACHE_DURATION
  });
  
  console.log(`💾 Cached vector settings for ${tableName} (${data.length} columns, expires in ${(CACHE_DURATION / 1000 / 60).toFixed(1)}min)`);
};

// Export function to load vector column settings with caching
export const loadVectorColumnSettings = async (
  tableName: string, 
  vectorColumns: unknown[], // TableColumn array but avoiding circular dependency
  dataProvider: unknown // DataProvider instance from useDataProvider()
): Promise<VectorColumnInfo[]> => {
  // Check cache first
  const cached = getCachedVectorColumnSettings(tableName);
  if (cached !== null) {
    return cached;
  }
  
  // Load from server if not cached
  console.log(`Loading vector settings for ${tableName} from server`);
  
  try {
    // Type guard for dataProvider
    if (!dataProvider || typeof dataProvider !== 'object' || !('custom' in dataProvider) || typeof (dataProvider as Record<string, unknown>).custom !== 'function') {
      throw new Error('Data provider does not support custom requests');
    }
    
    const dp = dataProvider as { custom: (params: Record<string, unknown>) => Promise<{ data?: { hits?: { hits?: unknown[] } } }> };
    
    // Query manager_vector_column_settings table
    const settingsResponse = await dp.custom({
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
    
    const vectorSettings = settingsResponse.data?.hits?.hits || [];
    console.log(`Found ${vectorSettings.length} vector settings records for ${tableName}`);
    
    // Convert to our format
    const vectorColumnsData: VectorColumnInfo[] = vectorSettings.map((setting: unknown) => {
      const src = (setting as { _source: Record<string, unknown> })._source;
      
      // Parse combined_fields if it's a JSON string
      let combinedFields = src.combined_fields;
      if (typeof combinedFields === 'string') {
        try {
          combinedFields = JSON.parse(combinedFields);
        } catch (e) {
          console.warn('Failed to parse combined_fields JSON:', e);
          combinedFields = undefined;
        }
      }
      
      return {
        table_name: tableName,
        column_name: String(src.col_name || ''),
        model_name: String(src.mdl_name || ''),
        combined_fields: combinedFields as VectorColumnInfo['combined_fields'],
        dimensions: src.dimensions as number | undefined,
        knn_type: src.knn_type as string | undefined,
        similarity_metric: src.similarity_metric as string | undefined
      };
    });
    
    // Cache the results
    setCachedVectorColumnSettings(tableName, vectorColumnsData);
    
    return vectorColumnsData;
    
  } catch (error) {
    console.error('Failed to load vector column settings:', error);
    return [];
  }
};

// Cleanup interval on module unload (for HMR in development)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    clearInterval(intervalId);
  });
}