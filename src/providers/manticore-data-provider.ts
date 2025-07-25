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
    const { url, method, filters, sorters, payload, query, headers, meta } = params;
    if (url === "/sql" && payload) {
      const sqlPayload = payload as any;
      const result = await this.executeSql(sqlPayload.query, sqlPayload.raw_response);
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
  async executeSql(query: string, rawResponse = true): Promise<SqlResponse[]> {
    try {
      const response = await this.apiCall(`/sql?raw_response=${rawResponse}`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: query,
      });

      return Array.isArray(response) ? response : [response];
    } catch (error) {
      console.error("Error executing SQL:", error);
      throw error;
    }
  }

  async getTables(): Promise<TableInfo[]> {
    try {
      const response = await this.executeSql("SHOW TABLES");
      if (response.length > 0 && response[0].data) {
        return response[0].data.map((row: any) => ({
          name: row.Index || row.Table || Object.values(row)[0],
          engine: row.Type || row.Engine,
        }));
      }
      return [];
    } catch (error) {
      console.error("Error getting tables:", error);
      return [];
    }
  }

  async getTableInfo(tableName: string): Promise<TableInfo> {
    try {
      const response = await this.executeSql(`DESCRIBE ${tableName}`);
      const columns: TableColumn[] = [];
      
      if (response.length > 0 && response[0].data) {
        response[0].data.forEach((row: any) => {
          columns.push({
            field: row.Field || row.field,
            type: row.Type || row.type,
            properties: row.Properties || row.properties || "",
          });
        });
      }

      return {
        name: tableName,
        columns,
      };
    } catch (error) {
      console.error("Error getting table info:", error);
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
