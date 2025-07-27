import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useDataProvider } from '@refinedev/core';
import { TableInfo } from '../../types/manticore';
import { 
  VectorColumnInfo, 
  loadVectorColumnSettings 
} from '../../utils/vectorColumnCache';

interface VectorSearchConfig {
  field: string;
  vector: number[];
  k: number;
  ef?: number;
  // Human-readable inputs
  textInput?: string;
  imageInput?: string;
  // Hybrid search support
  hybridQuery?: string;
  vectorSearchOnly?: boolean;
}

interface MultiFieldInput {
  field: string;
  content: string;
  type: 'text' | 'image';
  weight: number;
}

interface SearchFilterProps {
  table: TableInfo;
  onSearch: (searchParams: SearchParams) => void;
  onReset: () => void;
  className?: string;
}

export interface SearchParams {
  type: 'basic' | 'advanced' | 'vector';
  query?: string;
  filters?: Array<{
    field: string;
    operator: string;
    value: unknown;
  }>;
  vectorSearch?: VectorSearchConfig;
  limit?: number;
  offset?: number;
  // Enhanced basic search options
  fuzzy?: {
    enabled: boolean;
    distance?: number;
    preserve?: boolean;
    layouts?: string[];
  };
  fieldWeights?: Record<string, number>;
  ranker?: 'proximity_bm25' | 'bm25' | 'none' | 'wordcount' | 'proximity' | 'matchany' | 'fieldmask' | 'sph04' | 'expr';
  rankerExpression?: string;
  sort?: Array<{
    field: string;
    order: 'asc' | 'desc';
    expression?: string; // For custom sort expressions
  }>;
  trackScores?: boolean;
  // Facets support
  facets?: Array<{
    field: string;
    size?: number;
    order?: 'asc' | 'desc';
  }>;
  // Applied facet filters (for interactive checkbox filtering)
  appliedFacetFilters?: Record<string, string[]>;
}

export const SearchFilter: React.FC<SearchFilterProps> = ({
  table,
  onSearch,
  onReset,
  className = ""
}) => {
  // Debug: Log component mount with mount counter
  const mountId = useRef(Math.random().toString(36).substring(2, 9));
  console.log(`🟢 SearchFilter component mounted for table: ${table.name} (ID: ${mountId.current})`);
  
  // Search type state - default to vector search
  const [searchType, setSearchType] = useState<'basic' | 'advanced' | 'vector'>('vector');
  
  // Basic search state
  const [basicQuery, setBasicQuery] = useState('');
  
  // Advanced search state
  const [advancedFilters, setAdvancedFilters] = useState<Array<{
    field: string;
    operator: string;
    value: unknown;
  }>>([]);
  
  // Vector search state
  const [vectorConfig, setVectorConfig] = useState<VectorSearchConfig>({
    field: '',
    vector: [],
    k: 10,
    ef: 10
  });
  const [textSearchInput, setTextSearchInput] = useState('');
  const [imageSearchInput, setImageSearchInput] = useState('');
  
  // Multi-field vector search state
  const [useMultiField, setUseMultiField] = useState(false);
  const [multiFieldInputs, setMultiFieldInputs] = useState<MultiFieldInput[]>([
    { field: '', content: '', type: 'text', weight: 1 }
  ]);
  
  // Enhanced search options state
  const [showBasicAdvanced, setShowBasicAdvanced] = useState(false);
  const [showVectorAdvanced, setShowVectorAdvanced] = useState(false);
  const [fuzzyEnabled, setFuzzyEnabled] = useState(true); // Enable fuzzy by default
  const [fuzzyDistance, setFuzzyDistance] = useState(2);
  const [fuzzyPreserve, setFuzzyPreserve] = useState(false);
  const [fuzzyLayouts, setFuzzyLayouts] = useState(['us']);
  const [fieldWeights, setFieldWeights] = useState<Record<string, number>>({});
  const [ranker, setRanker] = useState<SearchParams['ranker']>('proximity_bm25');
  const [rankerExpression, setRankerExpression] = useState('');
  const [sortFields, setSortFields] = useState<Array<{ field: string; order: 'asc' | 'desc'; expression?: string }>>([
    { field: '_score', order: 'desc' }
  ]);
  const [trackScores, setTrackScores] = useState(true);
  
  // Facets state
  const [selectedFacets, setSelectedFacets] = useState<Array<{
    field: string;
    size?: number;
    order?: 'asc' | 'desc';
  }>>([]);

  // Helper functions for facets  
  const [, setIsSearchLoading] = useState(false);
  const [, setVectorColumnsLoading] = useState(false);
  
  const dataProvider = useDataProvider();
  
  // Load vector columns and their settings
  const vectorColumns = useMemo(() => {
    console.log(`🔍 Computing vector columns for table: ${table.name}`);
    const columns = table.columns?.filter(col => col.type === 'float_vector') || [];
    console.log(`📊 Found ${columns.length} vector columns:`, columns.map(c => c.field));
    return columns;
  }, [table.name, table.columns]);
  
  // Vector column infos will be loaded dynamically when needed during search
  
  // Load vector column settings when component mounts or table changes
  useEffect(() => {
    const mountIdCurrent = mountId.current;
    console.log(`🔄 SearchFilter useEffect triggered for table: ${table.name} (ID: ${mountIdCurrent})`);
    
    const loadVectorSettings = async () => {
      if (vectorColumns.length === 0) {
        console.log(`⏭️ No vector columns for table ${table.name}, skipping vector settings load`);
        return;
      }
      
      console.log(`🔍 Loading vector column settings for table: ${table.name}`);
      setVectorColumnsLoading(true);
      
      try {
        const dp = dataProvider();
        const infos = await loadVectorColumnSettings(table.name, vectorColumns, dp);
        console.log(`✅ Successfully loaded ${infos.length} vector column settings for table: ${table.name}`);
        
        // Auto-select the first vector field if available
        if (infos.length > 0 && !vectorConfig.field) {
          console.log(`🎯 Auto-selecting first vector field: ${infos[0].column_name}`);
          setVectorConfig(prev => ({ ...prev, field: infos[0].column_name }));
        }
      } catch (error) {
        console.error(`❌ Failed to load vector column settings for table: ${table.name}`, error);
      } finally {
        setVectorColumnsLoading(false);
      }
    };
    
    loadVectorSettings();
    
    return () => {
      console.log(`🔴 SearchFilter cleanup for table: ${table.name} (ID: ${mountIdCurrent})`);
    };
  }, [table.name, vectorColumns, dataProvider, vectorConfig.field]);
  
  // Search handlers
  const handleBasicSearch = useCallback(async () => {
    if (!basicQuery.trim()) return;
    
    setIsSearchLoading(true);
    
    const searchParams: SearchParams = {
      type: 'basic',
      query: basicQuery.trim(),
      fuzzy: fuzzyEnabled ? {
        enabled: true,
        distance: fuzzyDistance,
        preserve: fuzzyPreserve,
        layouts: fuzzyLayouts
      } : undefined,
      fieldWeights: Object.keys(fieldWeights).length > 0 ? fieldWeights : undefined,
      ranker: ranker !== 'proximity_bm25' ? ranker : undefined,
      rankerExpression: ranker === 'expr' ? rankerExpression : undefined,
      sort: sortFields.filter(s => s.field && s.order),
      trackScores,
      facets: selectedFacets.length > 0 ? selectedFacets.filter(f => f.field) : undefined,
    };
    
    console.log('🔍 Executing basic search with params:', searchParams);
    onSearch(searchParams);
    setIsSearchLoading(false);
  }, [basicQuery, fuzzyEnabled, fuzzyDistance, fuzzyPreserve, fuzzyLayouts, fieldWeights, ranker, rankerExpression, sortFields, trackScores, selectedFacets, onSearch]);
  
  const handleAdvancedSearch = useCallback(() => {
    const validFilters = advancedFilters.filter(f => f.field && f.operator && f.value !== undefined && f.value !== '');
    if (validFilters.length === 0) return;
    
    const searchParams: SearchParams = {
      type: 'advanced',
      filters: validFilters
    };
    
    onSearch(searchParams);
  }, [advancedFilters, onSearch]);
  
  // Embedding generation functions - moved before handleVectorSearch to avoid circular dependency
  const generateTextEmbedding = useCallback(async (text: string, vectorColumnInfo: VectorColumnInfo): Promise<number[]> => {
    console.log('📝 Generating text embedding with model:', vectorColumnInfo.model_name);
    
    try {
      const dp = dataProvider();
      if (!dp?.custom) {
        throw new Error('Data provider does not support custom requests');
      }
      
      const response = await dp.custom({
        url: '/embeddings/text',
        method: 'post',
        payload: {
          texts: [text],
          model_name: vectorColumnInfo.model_name,
          normalize: true
        }
      });
      
      return response.data?.embeddings?.[0] || [];
    } catch (error) {
      console.error('❌ Failed to generate text embedding:', error);
      return [];
    }
  }, [dataProvider]);
  
  const generateImageEmbedding = useCallback(async (imageUrl: string, vectorColumnInfo: VectorColumnInfo): Promise<number[]> => {
    console.log('🖼️ Generating image embedding with model:', vectorColumnInfo.model_name);
    
    try {
      const dp = dataProvider();
      if (!dp?.custom) {
        throw new Error('Data provider does not support custom requests');
      }
      
      const response = await dp.custom({
        url: '/embeddings/image',
        method: 'post',
        payload: {
          images: [imageUrl],
          model_name: vectorColumnInfo.model_name,
          normalize: true
        }
      });
      
      return response.data?.embeddings?.[0] || [];
    } catch (error) {
      console.error('❌ Failed to generate image embedding:', error);
      return [];
    }
  }, [dataProvider]);
  
  const generateMultiFieldEmbedding = useCallback(async (inputs: MultiFieldInput[], vectorColumnInfo: VectorColumnInfo): Promise<number[]> => {
    console.log('🔀 Processing multi-field inputs:', inputs);
    
    const validInputs = inputs.filter(input => input.field && input.content && input.weight > 0);
    if (validInputs.length === 0) {
      console.warn('⚠️ No valid multi-field inputs found');
      return [];
    }
    
    try {
      // For multi-field, we'll use the configured combined_fields if available
      const combinedFieldsConfig = vectorColumnInfo.combined_fields;
      if (combinedFieldsConfig && typeof combinedFieldsConfig === 'object') {
        console.log('🔧 Using combined fields configuration:', combinedFieldsConfig);
        
        // Build multi-field request with proper weighting based on configuration
        const multiFieldData: Record<string, unknown> = {};
        const weights: Record<string, number> = {};
        
        for (const input of validInputs) {
          if (input.type === 'text') {
            multiFieldData[input.field] = input.content;
          } else if (input.type === 'image') {
            multiFieldData[`${input.field}_image_url`] = input.content;
          }
          weights[input.field] = input.weight;
        }
        
        // Use the combined_fields weights if available, otherwise use user-specified weights
        // const finalWeights = combinedFieldsConfig.weights || weights; // Not used in multi-field endpoint
        
        const dp = dataProvider();
        if (!dp?.custom) {
          throw new Error('Data provider does not support custom requests');
        }
        
        // Build fields array for multi-field embedding
        const fields = validInputs.map(input => ({
          content: input.content,
          type: input.type,
          weight: input.weight,
          model_name: vectorColumnInfo.model_name
        }));
        
        const response = await dp.custom({
          url: '/embeddings/multi-field',
          method: 'post',
          payload: {
            fields,
            combine_method: 'weighted_average',
            normalize: true
          }
        });
        
        return response.data?.embeddings?.[0] || [];
      } else {
        // Fallback: process each input separately and combine
        let combinedEmbedding: number[] = [];
        
        for (const input of validInputs) {
          let embedding: number[] = [];
          
          if (input.type === 'text') {
            embedding = await generateTextEmbedding(input.content, vectorColumnInfo);
          } else if (input.type === 'image') {
            embedding = await generateImageEmbedding(input.content, vectorColumnInfo);
          }
          
          if (embedding.length > 0) {
            if (combinedEmbedding.length === 0) {
              // Initialize with first embedding
              combinedEmbedding = embedding.map(val => val * input.weight);
            } else {
              // Add weighted embedding
              for (let i = 0; i < Math.min(combinedEmbedding.length, embedding.length); i++) {
                combinedEmbedding[i] += embedding[i] * input.weight;
              }
            }
          }
        }
        
        // Normalize the combined embedding
        if (combinedEmbedding.length > 0) {
          const totalWeight = validInputs.reduce((sum, input) => sum + input.weight, 0);
          combinedEmbedding = combinedEmbedding.map(val => val / totalWeight);
        }
        
        console.log('🔄 Fallback combined embedding created with length:', combinedEmbedding.length);
        return combinedEmbedding;
      }
    } catch (error) {
      console.error('❌ Failed to generate multi-field embedding:', error);
      return [];
    }
  }, [dataProvider, generateTextEmbedding, generateImageEmbedding]);

  const handleVectorSearch = useCallback(async () => {
    if (!vectorConfig.field) {
      console.warn('🚫 No vector field selected for vector search');
      return;
    }
    
    console.log('🧠 Starting vector search process...');
    setIsSearchLoading(true);
    
    try {
      // Load vector column settings to get the correct model for embedding generation
      const dp = dataProvider();
      const vectorColumnInfos = await loadVectorColumnSettings(table.name, vectorColumns, dp);
      const selectedVectorColumn = vectorColumnInfos.find(info => info.column_name === vectorConfig.field);
      
      if (!selectedVectorColumn) {
        console.error('❌ Selected vector column not found in settings');
        setIsSearchLoading(false);
        return;
      }
      
      console.log('🔧 Using vector column config:', selectedVectorColumn);
      
      // Generate embeddings based on the search mode
      let generatedVector: number[] = [];
      
      if (useMultiField) {
        console.log('🔀 Using multi-field vector search');
        generatedVector = await generateMultiFieldEmbedding(multiFieldInputs, selectedVectorColumn);
      } else {
        // Simple text or image input
        if (textSearchInput) {
          console.log('📝 Generating text embedding for:', textSearchInput);
          generatedVector = await generateTextEmbedding(textSearchInput, selectedVectorColumn);
        } else if (imageSearchInput) {
          console.log('🖼️ Generating image embedding for:', imageSearchInput);
          generatedVector = await generateImageEmbedding(imageSearchInput, selectedVectorColumn);
        }
      }
      
      if (generatedVector.length === 0) {
        console.warn('⚠️ No vector generated, aborting search');
        setIsSearchLoading(false);
        return;
      }
      
      console.log(`✅ Generated vector with ${generatedVector.length} dimensions`);
      
      const searchParams: SearchParams = {
        type: 'vector',
        vectorSearch: {
          ...vectorConfig,
          vector: generatedVector,
          textInput: !useMultiField ? textSearchInput : undefined,
          imageInput: !useMultiField ? imageSearchInput : undefined,
          // Use the same text input for hybrid search (both embedding generation and keyword search)
          hybridQuery: (!useMultiField && textSearchInput.trim()) ? textSearchInput.trim() : undefined,
          vectorSearchOnly: false // Always enable hybrid search when we have text
        },
        // Add faceting, sorting, and other options to vector search (same as basic search)
        facets: selectedFacets.length > 0 ? selectedFacets.filter(f => f.field) : undefined,
        fuzzy: fuzzyEnabled ? {
          enabled: true,
          distance: fuzzyDistance,
          preserve: fuzzyPreserve,
          layouts: fuzzyLayouts
        } : undefined,
        fieldWeights: Object.keys(fieldWeights).length > 0 ? fieldWeights : undefined,
        ranker: ranker !== 'proximity_bm25' ? ranker : undefined,
        rankerExpression: ranker === 'expr' ? rankerExpression : undefined,
        sort: sortFields.filter(s => s.field && s.order),
        trackScores,
      };
      
      console.log('🚀 Executing vector search with params:', searchParams);
      onSearch(searchParams);
    } catch (error) {
      console.error('❌ Vector search failed:', error);
    } finally {
      setIsSearchLoading(false);
    }
  }, [vectorConfig, useMultiField, multiFieldInputs, textSearchInput, imageSearchInput, table.name, vectorColumns, dataProvider, onSearch, generateMultiFieldEmbedding, generateTextEmbedding, generateImageEmbedding, selectedFacets, fuzzyEnabled, fuzzyDistance, fuzzyPreserve, fuzzyLayouts, fieldWeights, ranker, rankerExpression, sortFields, trackScores]);
  
  // Helper functions for advanced search
  const addFilter = useCallback(() => {
    setAdvancedFilters(prev => [...prev, { field: '', operator: 'equals', value: '' }]);
  }, []);
  
  const updateFilter = useCallback((index: number, updates: Partial<typeof advancedFilters[0]>) => {
    setAdvancedFilters(
      prev => prev.map((filter, i) => i === index ? { ...filter, ...updates } : filter)
    );
  }, []);
  
  const removeFilter = useCallback((index: number) => {
    setAdvancedFilters(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Helper functions for facets
  const updateMultiFieldInput = useCallback((index: number, updates: Partial<MultiFieldInput>) => {
    setMultiFieldInputs(prev =>
      prev.map((input, i) => i === index ? { ...input, ...updates } : input)
    );
  }, []);

  const handleReset = useCallback(() => {
    setBasicQuery('');
    setAdvancedFilters([]);
    setTextSearchInput('');
    setImageSearchInput('');
    setVectorConfig(prev => ({ ...prev, vector: [] }));
    setMultiFieldInputs([{ field: '', content: '', type: 'text', weight: 1 }]);
    setUseMultiField(false);
    
    // Reset enhanced basic search options
    setShowBasicAdvanced(false);
    setShowVectorAdvanced(false);
    setFuzzyEnabled(true); // Keep fuzzy enabled by default
    setFuzzyDistance(2);
    setFuzzyPreserve(false);
    setFuzzyLayouts(['us']);
    setFieldWeights({});
    setRanker('proximity_bm25');
    setRankerExpression('');
    setSortFields([{ field: '_score', order: 'desc' }]);
    setTrackScores(true);
    setSelectedFacets([]);
    
    onReset();
  }, [onReset]);

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      {/* Compact Search Interface */}
      <div className="p-3">
        <div className="flex gap-2 items-center">
          {/* Search Type Selector */}
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as 'basic' | 'advanced' | 'vector')}
            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded"
          >
            <option value="vector">🧠 Vector</option>
            <option value="basic">� Basic</option>
            <option value="advanced">🔧 Advanced</option>
          </select>

          {/* Main Search Input */}
          {searchType === 'basic' && (
            <>
              <input
                type="text"
                placeholder="Search..."
                value={basicQuery}
                onChange={(e) => setBasicQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBasicSearch()}
                className="flex-1 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              />
              
              {/* Quick Options */}
              <button
                type="button"
                onClick={() => setFuzzyEnabled(!fuzzyEnabled)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  fuzzyEnabled
                    ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-600'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title="Toggle fuzzy search"
              >
                ~≈
              </button>
              
              
              {/* Options Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowBasicAdvanced(!showBasicAdvanced)}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                  title="More options"
                >
                  ⚙️
                </button>
                
                {showBasicAdvanced && (
                  <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 p-3 text-xs">
                    {/* Close button */}
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-semibold text-gray-700 dark:text-gray-300">Search Options</h3>
                      <button
                        onClick={() => setShowBasicAdvanced(false)}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Close options"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="space-y-2">
                      {/* Fuzzy Options */}
                      {fuzzyEnabled && (
                        <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200 dark:border-orange-800">
                          <div className="font-medium text-orange-800 dark:text-orange-200 mb-1">Fuzzy Search</div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-gray-600 dark:text-gray-400">Distance:</label>
                              <input
                                type="number"
                                min="1"
                                max="4"
                                value={fuzzyDistance}
                                onChange={(e) => setFuzzyDistance(parseInt(e.target.value) || 2)}
                                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded"
                              />
                            </div>
                            <div>
                              <label className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={fuzzyPreserve}
                                  onChange={(e) => setFuzzyPreserve(e.target.checked)}
                                  className="rounded"
                                />
                                <span className="text-gray-600 dark:text-gray-400">Preserve</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Ranking */}
                      <div>
                        <label className="block text-gray-600 dark:text-gray-400 mb-1">Ranking:</label>
                        <select
                          value={ranker}
                          onChange={(e) => setRanker(e.target.value as SearchParams['ranker'])}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded"
                        >
                          <option value="proximity_bm25">Proximity BM25 (default)</option>
                          <option value="bm25">BM25</option>
                          <option value="none">None</option>
                          <option value="wordcount">Word Count</option>
                          <option value="proximity">Proximity</option>
                          <option value="expr">Custom Expression</option>
                        </select>
                      </div>
                      
                      {/* Sorting */}
                      <div>
                        <label className="block text-gray-600 dark:text-gray-400 mb-1">Sort by:</label>
                        <select
                          value={sortFields[0]?.field || '_score'}
                          onChange={(e) => setSortFields([{ field: e.target.value, order: sortFields[0]?.order || 'desc' }])}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded"
                        >
                          <option value="_score">🏆 Score</option>
                          {table.columns?.map(col => (
                            <option key={col.field} value={col.field}>{col.field}</option>
                          ))}
                        </select>
                      </div>
                      
                      {/* Facets Configuration */}
                      <div>
                        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Facets</h4>
                        {selectedFacets.map((facet, index) => (
                          <div key={index} className="flex items-center space-x-2 mb-2 p-2 border rounded-md dark:border-gray-600">
                            <select
                              value={facet.field}
                              onChange={(e) => {
                                const newFacets = [...selectedFacets];
                                newFacets[index].field = e.target.value;
                                setSelectedFacets(newFacets);
                              }}
                              className="flex-grow p-2 border rounded-md bg-white dark:bg-gray-800 dark:border-gray-600"
                            >
                              <option value="">Select Field</option>
                              {table.columns?.filter(c => c.type === 'string' || c.type === 'integer').map(col => (
                                <option key={col.field} value={col.field}>{col.field}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              placeholder="Size"
                              value={facet.size || ''}
                              onChange={(e) => {
                                const newFacets = [...selectedFacets];
                                newFacets[index].size = parseInt(e.target.value, 10) || undefined;
                                setSelectedFacets(newFacets);
                              }}
                              className="w-20 p-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
                            />
                            <select
                              value={facet.order}
                              onChange={(e) => {
                                const newFacets = [...selectedFacets];
                                newFacets[index].order = e.target.value as 'asc' | 'desc';
                                setSelectedFacets(newFacets);
                              }}
                              className="w-24 p-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
                            >
                              <option value="desc">Desc</option>
                              <option value="asc">Asc</option>
                            </select>
                            <button
                              onClick={() => {
                                setSelectedFacets(selectedFacets.filter((_, i) => i !== index));
                              }}
                              className="p-2 text-red-500 hover:text-red-700"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setSelectedFacets([...selectedFacets, { field: '', size: 10, order: 'desc' }])}
                          className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          + Add Facet
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Vector Search Input */}
          {searchType === 'vector' && (
            <>
              {/* Text input for hybrid vector search */}
              <input
                type="text"
                placeholder="Enter text for hybrid search (semantic + keyword)..."
                value={textSearchInput}
                onChange={(e) => setTextSearchInput(e.target.value)}
                className="flex-1 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded focus:ring-1 focus:ring-purple-500 focus:border-transparent"
              />
              
              {/* Image URL input */}
              <input
                type="url"
                placeholder="Or image URL..."
                value={imageSearchInput}
                onChange={(e) => setImageSearchInput(e.target.value)}
                className="flex-1 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded focus:ring-1 focus:ring-purple-500 focus:border-transparent"
              />
              
              <select
                value={vectorConfig.field}
                onChange={(e) => setVectorConfig(prev => ({ ...prev, field: e.target.value }))}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded"
              >
                <option value="">Vector field...</option>
                {table.columns?.filter(col => col.type === 'float_vector').map(col => (
                  <option key={col.field} value={col.field}>{col.field}</option>
                ))}
              </select>
              
              {/* Fuzzy search toggle for vector search */}
              <button
                type="button"
                onClick={() => setFuzzyEnabled(!fuzzyEnabled)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  fuzzyEnabled
                    ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-600'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title="Toggle fuzzy search for hybrid queries"
              >
                ~≈
              </button>
              
              {/* Toggle for multi-field search */}
              <button
                type="button"
                onClick={() => setUseMultiField(!useMultiField)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  useMultiField
                    ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-600'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title="Toggle multi-field search"
              >
                🔗
              </button>

              {/* Vector Advanced Options Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowVectorAdvanced(!showVectorAdvanced)}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                  title="Vector search options"
                >
                  ⚙️
                </button>
                
                {showVectorAdvanced && (
                  <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 p-3 text-xs">
                    {/* Close button */}
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-semibold text-gray-700 dark:text-gray-300">Vector Search Options</h3>
                      <button
                        onClick={() => setShowVectorAdvanced(false)}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Close options"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="space-y-2">
                      {/* Vector Search Parameters */}
                      <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800">
                        <div className="font-medium text-purple-800 dark:text-purple-200 mb-1">Vector Parameters</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-gray-600 dark:text-gray-400">K (results):</label>
                            <input
                              type="number"
                              min="1"
                              max="1000"
                              value={vectorConfig.k}
                              onChange={(e) => setVectorConfig(prev => ({ ...prev, k: parseInt(e.target.value) || 10 }))}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-600 dark:text-gray-400">EF:</label>
                            <input
                              type="number"
                              min="1"
                              max="1000"
                              value={vectorConfig.ef || 10}
                              onChange={(e) => setVectorConfig(prev => ({ ...prev, ef: parseInt(e.target.value) || 10 }))}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Fuzzy Options */}
                      {fuzzyEnabled && (
                        <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200 dark:border-orange-800">
                          <div className="font-medium text-orange-800 dark:text-orange-200 mb-1">Fuzzy Search (for hybrid queries)</div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-gray-600 dark:text-gray-400">Distance:</label>
                              <input
                                type="number"
                                min="1"
                                max="4"
                                value={fuzzyDistance}
                                onChange={(e) => setFuzzyDistance(parseInt(e.target.value) || 2)}
                                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded"
                              />
                            </div>
                            <div>
                              <label className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={fuzzyPreserve}
                                  onChange={(e) => setFuzzyPreserve(e.target.checked)}
                                  className="rounded"
                                />
                                <span className="text-gray-600 dark:text-gray-400">Preserve</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Ranking */}
                      <div>
                        <label className="block text-gray-600 dark:text-gray-400 mb-1">Ranking:</label>
                        <select
                          value={ranker}
                          onChange={(e) => setRanker(e.target.value as SearchParams['ranker'])}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded"
                        >
                          <option value="proximity_bm25">Proximity BM25 (default)</option>
                          <option value="bm25">BM25</option>
                          <option value="none">None</option>
                          <option value="wordcount">Word Count</option>
                          <option value="proximity">Proximity</option>
                          <option value="expr">Custom Expression</option>
                        </select>
                      </div>
                      
                      {/* Sorting */}
                      <div>
                        <label className="block text-gray-600 dark:text-gray-400 mb-1">Sort by:</label>
                        <select
                          value={sortFields[0]?.field || '_score'}
                          onChange={(e) => setSortFields([{ field: e.target.value, order: sortFields[0]?.order || 'desc' }])}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded"
                        >
                          <option value="_score">🏆 Score</option>
                          {table.columns?.map(col => (
                            <option key={col.field} value={col.field}>{col.field}</option>
                          ))}
                        </select>
                      </div>
                      
                      {/* Facets Configuration */}
                      <div>
                        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Facets</h4>
                        {selectedFacets.map((facet, index) => (
                          <div key={index} className="flex items-center space-x-2 mb-2 p-2 border rounded-md dark:border-gray-600">
                            <select
                              value={facet.field}
                              onChange={(e) => {
                                const newFacets = [...selectedFacets];
                                newFacets[index].field = e.target.value;
                                setSelectedFacets(newFacets);
                              }}
                              className="flex-grow p-2 border rounded-md bg-white dark:bg-gray-800 dark:border-gray-600"
                            >
                              <option value="">Select Field</option>
                              {table.columns?.filter(c => c.type === 'string' || c.type === 'integer').map(col => (
                                <option key={col.field} value={col.field}>{col.field}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              placeholder="Size"
                              value={facet.size || ''}
                              onChange={(e) => {
                                const newFacets = [...selectedFacets];
                                newFacets[index].size = parseInt(e.target.value, 10) || undefined;
                                setSelectedFacets(newFacets);
                              }}
                              className="w-20 p-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
                            />
                            <select
                              value={facet.order}
                              onChange={(e) => {
                                const newFacets = [...selectedFacets];
                                newFacets[index].order = e.target.value as 'asc' | 'desc';
                                setSelectedFacets(newFacets);
                              }}
                              className="w-24 p-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
                            >
                              <option value="desc">Desc</option>
                              <option value="asc">Asc</option>
                            </select>
                            <button
                              onClick={() => {
                                setSelectedFacets(selectedFacets.filter((_, i) => i !== index));
                              }}
                              className="p-2 text-red-500 hover:text-red-700"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setSelectedFacets([...selectedFacets, { field: '', size: 10, order: 'desc' }])}
                          className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          + Add Facet
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Advanced Search */}
          {searchType === 'advanced' && (
            <div className="flex-1 text-xs text-gray-500 dark:text-gray-400">
              Advanced filters active ({advancedFilters.length} filters)
            </div>
          )}

          {/* Action Buttons */}
          <button
            onClick={searchType === 'basic' ? handleBasicSearch : searchType === 'vector' ? handleVectorSearch : handleAdvancedSearch}
            disabled={searchType === 'basic' ? !basicQuery : searchType === 'vector' ? (!textSearchInput && !imageSearchInput) || !vectorConfig.field : advancedFilters.length === 0}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Search
          </button>
          
          <button
            onClick={handleReset}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Reset
          </button>
        </div>
        
        {/* Advanced Filters Inline Display */}
        {searchType === 'advanced' && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Advanced Filters:</div>
            <div className="space-y-1">
              {advancedFilters.map((filter, index) => (
                <div key={index} className="flex gap-2 items-center text-xs">
                  <select
                    value={filter.field}
                    onChange={(e) => updateFilter(index, { field: e.target.value })}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded flex-1 max-w-32"
                  >
                    <option value="">Field...</option>
                    {table.columns?.map(col => (
                      <option key={col.field} value={col.field}>{col.field}</option>
                    ))}
                  </select>
                  <select
                    value={filter.operator}
                    onChange={(e) => updateFilter(index, { operator: e.target.value })}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded"
                  >
                    <option value="equals">=</option>
                    <option value="gt">&gt;</option>
                    <option value="lt">&lt;</option>
                    <option value="gte">≥</option>
                    <option value="lte">≤</option>
                    <option value="match">match</option>
                    <option value="in">in</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Value..."
                    value={String(filter.value || '')}
                    onChange={(e) => updateFilter(index, { value: e.target.value })}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded flex-1 max-w-32"
                  />
                  <button
                    onClick={() => removeFilter(index)}
                    className="px-1 text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={addFilter}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-xs"
              >
                + Add filter
              </button>
            </div>
          </div>
        )}
        
        {/* Multi-field Vector Search Expanded UI */}
        {searchType === 'vector' && useMultiField && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Multi-field Vector Search:</div>
            <div className="space-y-1">
              {multiFieldInputs.map((input, index) => (
                <div key={index} className="flex gap-2 items-center text-xs">
                  <select
                    value={input.field}
                    onChange={(e) => updateMultiFieldInput(index, { field: e.target.value })}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded flex-1 max-w-32"
                  >
                    <option value="">Field...</option>
                    {table.columns?.filter(col => col.type === 'text' || col.type === 'string').map(col => (
                      <option key={col.field} value={col.field}>{col.field}</option>
                    ))}
                  </select>
                  <select
                    value={input.type}
                    onChange={(e) => updateMultiFieldInput(index, { type: e.target.value as 'text' | 'image' })}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded"
                  >
                    <option value="text">Text</option>
                    <option value="image">Image URL</option>
                  </select>
                  <input
                    type={input.type === 'image' ? 'url' : 'text'}
                    placeholder={input.type === 'image' ? 'Image URL...' : 'Text content...'}
                    value={input.content}
                    onChange={(e) => updateMultiFieldInput(index, { content: e.target.value })}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded flex-1"
                  />
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={input.weight}
                    onChange={(e) => updateMultiFieldInput(index, { weight: parseFloat(e.target.value) || 1 })}
                    className="w-16 px-1 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded text-xs"
                    title="Weight"
                  />
                  <button
                    onClick={() => setMultiFieldInputs(prev => prev.filter((_, i) => i !== index))}
                    className="px-1 text-red-500 hover:text-red-700 text-xs"
                    disabled={multiFieldInputs.length <= 1}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => setMultiFieldInputs(prev => [...prev, { field: '', content: '', type: 'text', weight: 1 }])}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-xs"
              >
                + Add field
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

SearchFilter.displayName = 'SearchFilter';

export default SearchFilter;