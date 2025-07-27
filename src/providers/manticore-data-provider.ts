import type { 
  DataProvider, 
  GetListParams,
  GetListResponse,
  GetOneParams,
  GetOneResponse,
  CreateParams,
  CreateResponse,
  UpdateParams,
  UpdateResponse,
  DeleteOneParams,
  DeleteOneResponse,
  DeleteManyParams,
  DeleteManyResponse,
  CustomParams,
  CustomResponse,
  BaseRecord
} from "@refinedev/core";
import {
  ManticoreSearchRequest,
  ManticoreSearchResponse,
  InsertDocumentRequest,
  UpdateDocumentRequest,
  DeleteDocumentRequest,
  ManticoreSuccessResponse,
  ManticoreErrorResponse,
  SqlResponse,
  TableInfo,
  TableColumn,
} from "../types/manticore";
import { getManticoreBaseUrl, getEmbeddingsBaseUrl } from "../config/environment";

class ManticoreDataProvider implements DataProvider {
  private baseUrl: string;
  private embeddingsBaseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || getManticoreBaseUrl();
    this.embeddingsBaseUrl = getEmbeddingsBaseUrl();
    
    // Bind methods to preserve 'this' context
    this.getList = this.getList.bind(this);
    this.getOne = this.getOne.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.deleteOne = this.deleteOne.bind(this);
    this.deleteMany = this.deleteMany.bind(this);
    this.custom = this.custom.bind(this);
    this.getApiUrl = this.getApiUrl.bind(this);
    this.executeSql = this.executeSql.bind(this);
    this.getTables = this.getTables.bind(this);
  }

  private async apiCall<T = any>(
    endpoint: string,
    options: RequestInit = {},
    baseUrl?: string
  ): Promise<T> {
    const url = `${baseUrl || this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData: any = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
      }));
      
      let errorMessage = "Unknown error";
      if (typeof errorData.error === "string") {
        errorMessage = errorData.error;
      } else if (errorData.error && typeof errorData.error === "object" && errorData.error.reason) {
        errorMessage = errorData.error.reason;
      } else if (errorData.detail) {
        errorMessage = errorData.detail;
      } else {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // New method specifically for CLI JSON commands
  private async cliJsonCall(command: string): Promise<SqlResponse[]> {
    const url = `${this.baseUrl}/cli_json`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: command,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => `HTTP ${response.status}: ${response.statusText}`);
      throw new Error(errorText);
    }

    const result = await response.json();
    return Array.isArray(result) ? result : [result];
  }

  async getList<TData extends BaseRecord = BaseRecord>(
    params: GetListParams
  ): Promise<GetListResponse<TData>> {
    const { resource, pagination, sorters, filters, meta } = params;
    try {
      const limit = pagination?.pageSize || 10;
      const offset = ((pagination?.current || 1) - 1) * limit;

      // Check if this is a custom search (vector, advanced, etc.)
      if (meta?.searchParams) {
        return this.handleCustomSearch(resource, meta.searchParams, limit, offset);
      }

      // Use simple SQL SELECT for basic data retrieval - more reliable and consistent
      let sql = `SELECT * FROM ${resource}`;
      
      // Handle basic filters (primarily for search functionality)
      if (filters && filters.length > 0) {
        const whereConditions: string[] = [];
        
        for (const filter of filters) {
          const field = (filter as any).field;
          const operator = (filter as any).operator;
          const value = (filter as any).value;
          
          if (field === "query_string" && value) {
            // Use MATCH for full-text search
            whereConditions.push(`MATCH('${String(value).replace(/'/g, "''")}')`);
          } else if (field && value !== undefined) {
            // Handle other basic filters
            const sqlValue = typeof value === 'string' 
              ? `'${value.replace(/'/g, "''")}'` 
              : value;
            
            switch (operator) {
              case 'eq':
                whereConditions.push(`${field} = ${sqlValue}`);
                break;
              case 'gt':
                whereConditions.push(`${field} > ${sqlValue}`);
                break;
              case 'lt':
                whereConditions.push(`${field} < ${sqlValue}`);
                break;
              case 'gte':
                whereConditions.push(`${field} >= ${sqlValue}`);
                break;
              case 'lte':
                whereConditions.push(`${field} <= ${sqlValue}`);
                break;
              case 'contains':
                whereConditions.push(`MATCH('@${field} ${String(value).replace(/'/g, "''")}')`);
                break;
              default:
                whereConditions.push(`${field} = ${sqlValue}`);
            }
          }
        }
        
        if (whereConditions.length > 0) {
          sql += ` WHERE ${whereConditions.join(' AND ')}`;
        }
      }

      // Handle sorting
      if (sorters && sorters.length > 0) {
        const orderBy = sorters.map(sorter => 
          `${sorter.field} ${sorter.order?.toUpperCase() || 'ASC'}`
        ).join(', ');
        sql += ` ORDER BY ${orderBy}`;
      }

      // Add pagination
      sql += ` LIMIT ${offset}, ${limit}`;

      console.log('Executing SQL query:', sql);

      // Execute SQL query
      const response = await this.executeSql(sql, false);
      
      // Handle SQL response format
      if (response && response.hits && response.hits.hits) {
        return {
          data: response.hits.hits.map((hit: any) => ({
            id: hit._id,
            ...hit._source,
            _score: hit._score,
          })) as unknown as TData[],
          total: response.hits.total || response.hits.hits.length,
        };
      }

      // Fallback for different response formats
      return {
        data: [] as TData[],
        total: 0,
      };
    } catch (error) {
      console.error("Error in getList:", error);
      
      // Fallback to search API if SQL fails
      try {
        console.log("Falling back to search API");
        return this.getListFallback(params);
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError);
        throw error;
      }
    }
  }

  // Fallback method using search API
  private async getListFallback<TData extends BaseRecord = BaseRecord>(
    params: GetListParams
  ): Promise<GetListResponse<TData>> {
    const { resource, pagination, sorters, filters } = params;
    
    const searchRequest: ManticoreSearchRequest = {
      index: resource,
      limit: pagination?.pageSize || 10,
      offset: ((pagination?.current || 1) - 1) * (pagination?.pageSize || 10),
    };

    // Simple match-all query for fallback
    if (!filters || filters.length === 0) {
      searchRequest.query = { match_all: {} };
    } else {
      const queryFilters = this.buildQueryFromFilters(filters);
      if (queryFilters) {
        searchRequest.query = queryFilters;
      }
    }

    if (sorters && sorters.length > 0) {
      searchRequest.sort = this.buildSortFromSorters(sorters);
    }

    const response: ManticoreSearchResponse = await this.apiCall("/search", {
      method: "POST",
      body: JSON.stringify(searchRequest),
    });

    return {
      data: response.hits.hits.map((hit) => ({
        id: hit._id,
        ...hit._source,
        _score: hit._score,
      })) as unknown as TData[],
      total: response.hits.total,
    };
  }

  // Handle custom search types (vector, advanced filters)
  private async handleCustomSearch<TData extends BaseRecord = BaseRecord>(
    resource: string,
    searchParams: Record<string, any>,
    limit: number,
    offset: number
  ): Promise<GetListResponse<TData>> {
    const { type, query, filters, vectorSearch } = searchParams;

    try {
      if (type === 'vector' && vectorSearch) {
        // Implement hybrid search following Manticore best practices
        const hybridQuery = vectorSearch.hybridQuery || '';
        
        const searchRequest: ManticoreSearchRequest = {
          index: resource,
          knn: {
            field: vectorSearch.field,
            query_vector: vectorSearch.vector,
            k: !hybridQuery.trim() ? vectorSearch.k : Math.max(vectorSearch.k * 10, 1000),
            ef: vectorSearch.ef,
          },
          size: limit,
          from: offset,
          track_scores: true,
        };

        if (hybridQuery.trim()) {
          if (searchRequest.knn) {
            // Apply fuzzy search using query string operators instead of options.fuzzy
            let processedQuery = hybridQuery;
            
            if (searchParams.fuzzy?.enabled) {
              console.log('Applying fuzzy search using query string operators for vector search');
              // Convert the query to use wildcard operators for fuzzy matching
              // Split the query into words and add wildcards for fuzzy matching
              const words = hybridQuery.trim().split(/\s+/);
              const fuzzyWords = words.map((word: string) => {
                // For each word, add wildcards to enable fuzzy matching
                // This allows partial matches like "tisso" to match "tissot"
                if (word.length >= 3) {
                  return `*${word}*`;
                }
                return word;
              });
              processedQuery = fuzzyWords.join(' ');
              console.log('Fuzzy query transformed:', hybridQuery, '->', processedQuery);
            }
            
            searchRequest.knn.filter = { query_string: processedQuery };
          }
        }

        // Add applied facet filters using proper bool query structure
        if (searchParams.appliedFacetFilters && Object.keys(searchParams.appliedFacetFilters).length > 0) {
          console.log('Applying facet filters to vector search:', searchParams.appliedFacetFilters);
          
          const facetFilterClauses = Object.entries(searchParams.appliedFacetFilters).map(([fieldName, values]) => {
            const stringValues = values as string[];
            if (stringValues.length === 1) {
              return { equals: { [fieldName]: stringValues[0] } };
            } else {
              return { bool: { should: stringValues.map((value: string) => ({ equals: { [fieldName]: value } })) } };
            }
          });

          if (searchRequest.knn) {
            const existingFilter = searchRequest.knn.filter;
            const mustClauses = existingFilter ? [existingFilter, ...facetFilterClauses] : facetFilterClauses;
            searchRequest.knn.filter = { bool: { must: mustClauses } };
          }
        }

        // Add facets if specified
        if (searchParams.facets && searchParams.facets.length > 0) {
          searchRequest.aggs = {};
          searchParams.facets.forEach((facet: { field: string; size?: number; order?: 'asc' | 'desc' }, index: number) => {
            const aggName = `facet_${facet.field}_${index}`;
            if (searchRequest.aggs) {
              searchRequest.aggs[aggName] = {
                terms: { field: facet.field, size: facet.size || 20 }
              };
              if (facet.order && searchRequest.aggs[aggName].terms) {
                searchRequest.aggs[aggName].terms.order = { _count: facet.order };
              }
            }
          });
        }

        console.log('Executing vector search request:', JSON.stringify(searchRequest, null, 2));
        
        const response: ManticoreSearchResponse = await this.apiCall("/search", {
          method: "POST",
          body: JSON.stringify(searchRequest),
        });

        const result: GetListResponse<TData> & { facets?: typeof response.aggregations } = {
          data: response.hits.hits.map((hit) => ({
            id: hit._id,
            ...hit._source,
            _score: hit._score,
            _knn_dist: hit._knn_dist,
          })) as unknown as TData[],
          total: response.hits.total,
        };

        if (response.aggregations) {
          result.facets = response.aggregations;
        }
        
        return result;
      }

      if (type === 'basic' && query) {
        // Build JSON search request for proper fuzzy search and facets support
        const searchRequest: ManticoreSearchRequest = {
          index: resource,
          query: { match_all: {} },
          limit,
          offset
        };
        
        // Handle fuzzy search using query string operators
        if (searchParams.fuzzy?.enabled) {
          console.log('Applying fuzzy search using query string operators for basic search');
          
          // Convert the query to use wildcard operators for fuzzy matching
          const words = query.trim().split(/\s+/);
          const fuzzyWords = words.map((word: string) => {
            // For each word, add wildcards to enable fuzzy matching
            if (word.length >= 3) {
              return `*${word}*`;
            }
            return word;
          });
          const fuzzyQuery = fuzzyWords.join(' ');
          
          console.log('Fuzzy query transformed:', query, '->', fuzzyQuery);
          
          searchRequest.query = {
            query_string: fuzzyQuery
          };
        } else {
          // Use match query for regular search
          searchRequest.query = {
            match: { '*': query }
          };
        }
        
        // Add ranker if specified
        if (searchParams.ranker && searchParams.ranker !== 'proximity_bm25') {
          if (!searchRequest.options) searchRequest.options = {};
          searchRequest.options.ranker = searchParams.ranker;
          if (searchParams.ranker === 'expr' && searchParams.rankerExpression) {
            searchRequest.options.ranker = `expr('${searchParams.rankerExpression}')`;
          }
        }
        
        // Add field weights if specified
        if (searchParams.fieldWeights && Object.keys(searchParams.fieldWeights).length > 0) {
          if (!searchRequest.options) searchRequest.options = {};
          searchRequest.options.field_weights = searchParams.fieldWeights;
        }
        
        // Add sorting if specified
        if (searchParams.sort && searchParams.sort.length > 0) {
          searchRequest.sort = searchParams.sort.map((s: any) => {
            // Handle custom expressions
            if (s.field === 'custom' && s.expression) {
              return { [s.expression]: { order: s.order } };
            }
            // Handle regular field sorting
            return { [s.field]: { order: s.order } };
          });
        }
        
        // Add track_scores if specified
        if (searchParams.trackScores) {
          searchRequest.track_scores = true;
        }
        
        // Add applied facet filters using proper bool query structure
        if (searchParams.appliedFacetFilters && Object.keys(searchParams.appliedFacetFilters).length > 0) {
          console.log('Applying facet filters:', searchParams.appliedFacetFilters);
          
          // Build facet filter clauses
          const facetFilterClauses = Object.entries(searchParams.appliedFacetFilters).map(([fieldName, values]) => {
            const stringValues = values as string[]; // Type assertion since we know this is string[]
            if (stringValues.length === 1) {
              // Single value - use equals
              return { equals: { [fieldName]: stringValues[0] } };
            } else {
              // Multiple values for the same field - use should query (OR logic)
              return {
                bool: {
                  should: stringValues.map((value: string) => ({ equals: { [fieldName]: value } }))
                }
              };
            }
          });
          
          // Wrap the existing query in a bool query with facet filters
          const originalQuery = searchRequest.query;
          searchRequest.query = {
            bool: {
              must: [originalQuery, ...facetFilterClauses]
            }
          };
          
          console.log('Updated query with facet filters:', JSON.stringify(searchRequest.query, null, 2));
        }
        
        // Add facets if specified
        if (searchParams.facets && searchParams.facets.length > 0) {
          searchRequest.aggs = {};
          searchParams.facets.forEach((facet: any, index: number) => {
            const aggName = `facet_${facet.field}_${index}`;
            if(searchRequest.aggs) {
              searchRequest.aggs[aggName] = {
                terms: {
                  field: facet.field,
                  size: facet.size || 20
                }
              };
              if (facet.order) {
                // Use _count for sorting by frequency, _key for sorting by field value
                if(searchRequest.aggs[aggName].terms) {
                  searchRequest.aggs[aggName].terms.order = { _count: facet.order };
                }
              }
            }
          });
        }
        
        console.log('Executing enhanced basic search:', JSON.stringify(searchRequest, null, 2));
        
        const response: ManticoreSearchResponse = await this.apiCall("/search", {
          method: "POST",
          body: JSON.stringify(searchRequest),
        });
        
        const result: GetListResponse<TData> & { facets?: typeof response.aggregations } = {
          data: response.hits.hits.map((hit) => ({
            id: hit._id,
            ...hit._source,
            _score: hit._score,
          })) as unknown as TData[],
          total: response.hits.total,
        };
        
        // Add facets to result if present
        if (response.aggregations) {
          result.facets = response.aggregations;
        }
        
        return result;
      }

      if (type === 'advanced' && filters) {
        // Build SQL query from advanced filters
        let sql = `SELECT * FROM ${resource}`;
        const whereConditions: string[] = [];
        
        for (const filter of filters) {
          const { field, operator, value } = filter;
          if (!field || !operator || value === undefined || value === '') continue;
          
          const sqlValue = typeof value === 'string' 
            ? `'${value.replace(/'/g, "''")}'` 
            : value;
          
          switch (operator) {
            case 'equals':
              whereConditions.push(`${field} = ${sqlValue}`);
              break;
            case 'gt':
              whereConditions.push(`${field} > ${sqlValue}`);
              break;
            case 'lt':
              whereConditions.push(`${field} < ${sqlValue}`);
              break;
            case 'gte':
              whereConditions.push(`${field} >= ${sqlValue}`);
              break;
            case 'lte':
              whereConditions.push(`${field} <= ${sqlValue}`);
              break;
            case 'match':
              whereConditions.push(`MATCH('@${field} ${String(value).replace(/'/g, "''")}')`);
              break;
            case 'in': {
              const values = String(value).split(',').map(v => `'${v.trim().replace(/'/g, "''")}'`).join(',');
              whereConditions.push(`${field} IN (${values})`);
              break;
            }
            default:
              whereConditions.push(`${field} = ${sqlValue}`);
          }
        }
        
        if (whereConditions.length > 0) {
          sql += ` WHERE ${whereConditions.join(' AND ')}`;
        }
        
        sql += ` LIMIT ${offset}, ${limit}`;
        
        console.log('Executing advanced search SQL:', sql);
        
        const response = await this.executeSql(sql, false);
        
        if (response && response.hits && response.hits.hits) {
          return {
            data: response.hits.hits.map((hit: any) => ({
              id: hit._id,
              ...hit._source,
              _score: hit._score,
            })) as unknown as TData[],
            total: response.hits.total || response.hits.hits.length,
          };
        }
      }
    } catch (error) {
      console.error('Error in custom search:', error);
      // Fall back to basic data retrieval on error
      try {
        const sql = `SELECT * FROM ${resource} LIMIT ${offset}, ${limit}`;
        const response = await this.executeSql(sql, false);
        
        if (response && response.hits && response.hits.hits) {
          return {
            data: response.hits.hits.map((hit: any) => ({
              id: hit._id,
              ...hit._source,
              _score: hit._score,
            })) as unknown as TData[],
            total: response.hits.total || response.hits.hits.length,
          };
        }
      } catch (fallbackError) {
        console.error('Fallback search also failed:', fallbackError);
      }
    }

    // Default fallback
    return { data: [] as TData[], total: 0 };
  }

  async getOne<TData extends BaseRecord = BaseRecord>(
    params: GetOneParams
  ): Promise<GetOneResponse<TData>> {
    const { resource, id } = params;
    try {
      const searchRequest: ManticoreSearchRequest = {
        index: resource,
        query: {
          equals: { id: id },
        },
        limit: 1,
      };

      const response: ManticoreSearchResponse = await this.apiCall("/search", {
        method: "POST",
        body: JSON.stringify(searchRequest),
      });

      if (response.hits.hits.length === 0) {
        throw new Error(`Record with id ${id} not found`);
      }

      const hit = response.hits.hits[0];
      return {
        data: {
          id: hit._id,
          ...hit._source,
        } as unknown as TData,
      };
    } catch (error) {
      console.error("Error in getOne:", error);
      throw error;
    }
  }

  async create<TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: CreateParams<TVariables>
  ): Promise<CreateResponse<TData>> {
    const { resource, variables } = params;
    try {
      const docData = { ...variables };
      
      // Build proper insert request according to Manticore API spec
      const request: InsertDocumentRequest = {
        index: resource,
        doc: docData as Record<string, unknown>,
      };

      // Handle explicit ID if provided
      if (variables && typeof variables === 'object' && 'id' in variables && (variables as {id?: number}).id) {
        request.id = (variables as {id: number}).id;
        delete (docData as {id?: number}).id; // Remove from doc since it's set at request level
      }

      console.log('Executing INSERT request:', request);
      
      const response: ManticoreSuccessResponse = await this.apiCall("/insert", {
        method: "POST",
        body: JSON.stringify(request),
      });
      
      return {
        data: {
          id: response.id,
          ...variables,
        } as unknown as TData,
      };
    } catch (error) {
      console.error("Error in create:", error);
      throw error;
    }
  }

  async update<TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: UpdateParams<TVariables>
  ): Promise<UpdateResponse<TData>> {
    const { resource, id, variables } = params;
    try {
      // Build proper update request according to Manticore API spec
      const request: UpdateDocumentRequest = {
        index: resource,
        id: Number(id),
        doc: variables as Record<string, unknown>,
      };

      console.log('Executing UPDATE request:', request);
      
      await this.apiCall("/update", {
        method: "POST",
        body: JSON.stringify(request),
      });

      return {
        data: {
          id: id,
          ...variables,
        } as unknown as TData,
      };
    } catch (error) {
      console.error("Error in update:", error);
      throw error;
    }
  }

  async deleteOne<TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: DeleteOneParams<TVariables>
  ): Promise<DeleteOneResponse<TData>> {
    const { resource, id } = params;
    try {
      // Build proper delete request according to Manticore API spec
      const request: DeleteDocumentRequest = {
        index: resource,
        id: Number(id),
      };

      console.log('Executing DELETE request:', request);
      
      await this.apiCall("/delete", {
        method: "POST",
        body: JSON.stringify(request),
      });

      return {
        data: { id } as unknown as TData,
      };
    } catch (error) {
      console.error("Error in deleteOne:", error);
      throw error;
    }
  }

  async deleteMany<TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: DeleteManyParams<TVariables>
  ): Promise<DeleteManyResponse<TData>> {
    const { resource, ids } = params;
    try {
      // For multiple deletes, we need to use individual requests since Manticore doesn't support bulk delete by IDs
      const results = await Promise.all(
        ids.map(async (id) => {
          const request: DeleteDocumentRequest = {
            index: resource,
            id: Number(id),
          };
          await this.apiCall("/delete", {
            method: "POST",
            body: JSON.stringify(request),
          });
          return id;
        })
      );

      return {
        data: results as unknown as TData[],
      };
    } catch (error) {
      console.error("Error in deleteMany:", error);
      throw error;
    }
  }

  getApiUrl(): string {
    return this.baseUrl;
  }

  custom = async <TData extends BaseRecord = BaseRecord, TQuery = unknown, TPayload = unknown>(
    params: CustomParams<TQuery, TPayload>
  ): Promise<CustomResponse<TData>> => {
    const { url, method, payload, headers } = params;
    
    if (url.startsWith("/embeddings")) {
      const result = await this.apiCall(url.replace('/embeddings', ''), {
        method,
        body: payload ? JSON.stringify(payload) : undefined,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
      }, this.embeddingsBaseUrl);
      return { data: result as unknown as TData };
    }

    if (url === "/sql" && payload) {
      const sqlPayload = payload as any;
      // Handle both SELECT queries and other SQL commands
      if (sqlPayload.query && sqlPayload.query.trim().toUpperCase().startsWith('SELECT')) {
        // Use /sql endpoint for SELECT queries
        const result = await this.executeSql(sqlPayload.query, sqlPayload.raw_response);
        return { data: result as unknown as TData };
      } else if (sqlPayload.query) {
        // Use /cli_json for other SQL commands
        const result = await this.executeCliCommand(sqlPayload.query);
        return { data: result as unknown as TData };
      }
    }

    if (url === "/cli_json" && payload) {
      const cliPayload = payload as any;
      const result = await this.executeCliCommand(cliPayload.command);
      return { data: result as unknown as TData };
    }

    if (url === "/tables") {
      const result = await this.getTables();
      return { data: result as unknown as TData };
    }

    if (url === "/table-info" && payload) {
      const tablePayload = payload as any;
      const result = await this.getTableInfo(tablePayload.table);
      return { data: result as unknown as TData };
    }

    const result = await this.apiCall(url, {
      method,
      body: payload ? JSON.stringify(payload) : undefined,
      headers,
    });
    return { data: result as unknown as TData };
  }

  // Custom methods for Manticore-specific operations
  async executeSql(query: string, rawResponse = false): Promise<any> {
    try {
      if (rawResponse) {
        // Use mode=raw for non-SELECT queries or when raw response is explicitly requested
        const response = await this.apiCall(`/sql?mode=raw`, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
          },
          body: query,
        });
        return Array.isArray(response) ? response : [response];
      } else {
        // Use regular /sql endpoint for SELECT queries (returns JSON format)
        const response = await this.apiCall(`/sql`, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
          },
          body: query,
        });
        return response;
      }
    } catch (error) {
      console.error("Error executing SQL:", error);
      throw error;
    }
  }

  async executeCliCommand(command: string): Promise<SqlResponse[]> {
    try {
      const response = await this.cliJsonCall(command);
      return response;
    } catch (error) {
      console.error("Error executing CLI command:", error);
      throw error;
    }
  }

  async getTables(): Promise<TableInfo[]> {
    try {
      console.log("🔍 Fetching tables list...");
      const response = await this.executeCliCommand("SHOW TABLES");
      console.log("📝 SHOW TABLES response:", JSON.stringify(response, null, 2));
      
      if (response.length > 0 && response[0].data) {
        const basicTables = response[0].data.map((row: any) => ({
          name: row.Index || row.Table || Object.values(row)[0],
          engine: row.Type || row.Engine,
        }));

        console.log(`📊 Found ${basicTables.length} tables:`, basicTables.map(t => t.name));

        // Fetch column information for each table
        const tablesWithColumns = await Promise.all(
          basicTables.map(async (table) => {
            try {
              console.log(`🔧 Fetching columns for table: ${table.name}`);
              const tableInfo = await this.getTableInfo(table.name);
              const result = {
                ...table,
                columns: tableInfo.columns || [],
              };
              console.log(`✅ Table ${table.name} has ${result.columns.length} columns`);
              return result;
            } catch (error) {
              console.warn(`⚠️ Failed to get column info for table ${table.name}:`, error);
              return {
                ...table,
                columns: [],
              };
            }
          })
        );

        console.log("🎉 Final tables with columns:", tablesWithColumns);
        return tablesWithColumns;
      }
      return [];
    } catch (error) {
      console.error("❌ Error getting tables:", error);
      return [];
    }
  }

  async getTableInfo(tableName: string): Promise<TableInfo> {
    try {
      console.log(`🔍 Getting table info for: ${tableName}`);
      const response = await this.executeCliCommand(`DESCRIBE ${tableName}`);
      console.log(`📝 DESCRIBE ${tableName} response:`, JSON.stringify(response, null, 2));
      
      const columns: TableColumn[] = [];
      
      if (response.length > 0 && response[0].data) {
        console.log(`📊 Processing ${response[0].data.length} column records`);
        response[0].data.forEach((row: any) => {
          console.log(`🔧 Processing column row:`, row);
          columns.push({
            field: row.Field || row.field,
            type: row.Type || row.type,
            properties: row.Properties || row.properties || "",
          });
        });
      } else {
        console.warn(`⚠️ No data in DESCRIBE response for ${tableName}`);
      }

      // Get table settings to check for fuzzy search support
      const tableSettings: any = {};
      try {
        const settingsResponse = await this.executeCliCommand(`SHOW CREATE TABLE ${tableName}`);
        console.log(`📝 SHOW CREATE TABLE ${tableName} response:`, JSON.stringify(settingsResponse, null, 2));
        
        if (settingsResponse.length > 0 && settingsResponse[0].data) {
          const createStatement = settingsResponse[0].data[0]?.['Create Table'] || '';
          
          // Parse min_infix_len from the CREATE TABLE statement
          const minInfixMatch = (createStatement as string).match(/min_infix_len\s*=\s*'?(\d+)'?/i);
          if (minInfixMatch) {
            tableSettings.min_infix_len = parseInt(minInfixMatch[1]);
            console.log(`✅ Table ${tableName} has min_infix_len=${tableSettings.min_infix_len}`);
          } else {
            console.log(`⚠️ Table ${tableName} does not have min_infix_len configured`);
          }
        }
      } catch (settingsError) {
        console.warn(`⚠️ Could not get table settings for ${tableName}:`, settingsError);
      }

      console.log(`✅ Final columns for ${tableName}:`, columns);
      return {
        name: tableName,
        columns,
        settings: tableSettings
      };
    } catch (error) {
      console.error(`❌ Error getting table info for ${tableName}:`, error);
      return {
        name: tableName,
        columns: [],
        settings: {}
      };
    }
  }

  private buildQueryFromFilters(filters: any[]): any {
    if (filters.length === 0) return null;

    if (filters.length === 1) {
      const filter = filters[0];
      return this.buildSingleFilter(filter);
    }

    // Multiple filters - use bool query
    return {
      bool: {
        must: filters.map((filter) => this.buildSingleFilter(filter)),
      },
    };
  }

  private buildSingleFilter(filter: any): any {
    const { field, operator, value } = filter;

    switch (operator) {
      case "eq":
        return { equals: { [field]: value } };
      case "ne":
        return { bool: { must_not: [{ equals: { [field]: value } }] } };
      case "lt":
        return { range: { [field]: { lt: value } } };
      case "lte":
        return { range: { [field]: { lte: value } } };
      case "gt":
        return { range: { [field]: { gt: value } } };
      case "gte":
        return { range: { [field]: { gte: value } } };
      case "in":
        return { in: { [field]: Array.isArray(value) ? value : [value] } };
      case "contains":
      case "containsany":
        return { match: { [field]: value } };
      default:
        return { equals: { [field]: value } };
    }
  }

  private buildSortFromSorters(sorters: any[]): any {
    if (sorters.length === 0) return undefined;

    if (sorters.length === 1) {
      const sorter = sorters[0];
      return { [sorter.field]: { order: sorter.order } };
    }

    // Multiple sorters
    return sorters.reduce((acc, sorter) => {
      acc[sorter.field] = { order: sorter.order };
      return acc;
    }, {});
  }

  private processBasicQuery(query: string): string {
    // This method is now mainly used for fallback SQL queries
    // Remove extra whitespace
    query = query.trim();
    
    // If it's already a complex query with operators, return as-is
    if (query.includes('"') || query.includes('*') || query.includes('@') || query.includes('|') || query.includes('&')) {
      return query;
    }
    
    // Split into words and process each
    const words = query.split(/\s+/);
    
    if (words.length === 1) {
      // Single word - add wildcards for partial matching
      const word = words[0];
      if (word.length >= 2) {
        // For single words, use prefix matching (*word*) to catch partial matches
        return `*${word}*`;
      }
      return word;
    } else {
      // Multiple words - create a more flexible query
      // Option 1: All words with wildcards (more permissive)
      const wildcardWords = words.map(word => word.length >= 2 ? `*${word}*` : word);
      return wildcardWords.join(' ');
    }
  }
}

export default ManticoreDataProvider;
