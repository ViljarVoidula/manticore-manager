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
import { getManticoreBaseUrl } from "../config/environment";

class ManticoreDataProvider implements DataProvider {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || getManticoreBaseUrl();
    
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
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData: ManticoreErrorResponse = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
      }));
      throw new Error(
        typeof errorData.error === "string"
          ? errorData.error
          : errorData.error.reason || "Unknown error"
      );
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
      const searchRequest: ManticoreSearchRequest = {
        table: resource,
        limit: pagination?.pageSize || 10,
        offset: ((pagination?.current || 1) - 1) * (pagination?.pageSize || 10),
      };

      // Handle filters
      if (filters && filters.length > 0) {
        const queryFilters = this.buildQueryFromFilters(filters);
        if (queryFilters) {
          searchRequest.query = queryFilters;
        }
      }

      // Handle sorters
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
    } catch (error) {
      console.error("Error in getList:", error);
      throw error;
    }
  }

  async getOne<TData extends BaseRecord = BaseRecord>(
    params: GetOneParams
  ): Promise<GetOneResponse<TData>> {
    const { resource, id, meta } = params;
    try {
      const searchRequest: ManticoreSearchRequest = {
        table: resource,
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

  async create<TData extends BaseRecord = BaseRecord, TVariables = Record<string, any>>(
    params: CreateParams<TVariables>
  ): Promise<CreateResponse<TData>> {
    const { resource, variables, meta } = params;
    try {
      const docData = { ...variables } as any;
      const request: InsertDocumentRequest = {
        table: resource,
        doc: docData,
      };

      if (variables && typeof variables === 'object' && 'id' in variables && (variables as any).id) {
        request.id = (variables as any).id as number;
        delete docData.id;
      }

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

  async update<TData extends BaseRecord = BaseRecord, TVariables = Record<string, any>>(
    params: UpdateParams<TVariables>
  ): Promise<UpdateResponse<TData>> {
    const { resource, id, variables, meta } = params;
    try {
      const request: UpdateDocumentRequest = {
        table: resource,
        id: Number(id),
        doc: variables as any,
      };

      const response: ManticoreSuccessResponse = await this.apiCall("/update", {
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

  async deleteOne<TData extends BaseRecord = BaseRecord, TVariables = Record<string, any>>(
    params: DeleteOneParams<TVariables>
  ): Promise<DeleteOneResponse<TData>> {
    const { resource, id, meta } = params;
    try {
      const request: DeleteDocumentRequest = {
        table: resource,
        id: Number(id),
      };

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

  async deleteMany<TData extends BaseRecord = BaseRecord, TVariables = Record<string, any>>(
    params: DeleteManyParams<TVariables>
  ): Promise<DeleteManyResponse<TData>> {
    const { resource, ids, meta } = params;
    try {
      const results = await Promise.all(
        ids.map(async (id: any) => {
          const request: DeleteDocumentRequest = {
            table: resource,
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
        data: results,
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
    const { url, method, payload, headers, meta } = params;
    
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

      console.log(`✅ Final columns for ${tableName}:`, columns);
      return {
        name: tableName,
        columns,
      };
    } catch (error) {
      console.error(`❌ Error getting table info for ${tableName}:`, error);
      return {
        name: tableName,
        columns: [],
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
}

export default ManticoreDataProvider;
