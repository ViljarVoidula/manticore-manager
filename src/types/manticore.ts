// Manticore Search API types based on the OpenAPI specification

export interface ManticoreSearchRequest {
  table: string;
  query?: QueryFilter;
  limit?: number;
  offset?: number;
  sort?: any;
  highlight?: Highlight;
  aggs?: Record<string, Aggregation>;
  expressions?: Record<string, string>;
  max_matches?: number;
  options?: Record<string, any>;
  profile?: boolean;
  _source?: any;
  track_scores?: boolean;
}

export interface QueryFilter {
  query_string?: string;
  match?: Record<string, any>;
  match_phrase?: Record<string, any>;
  match_all?: Record<string, any>;
  bool?: BoolFilter;
  equals?: Record<string, any>;
  in?: Record<string, any>;
  range?: Record<string, Range>;
  geo_distance?: GeoDistance;
}

export interface BoolFilter {
  must?: QueryFilter[];
  must_not?: QueryFilter[];
  should?: QueryFilter[];
}

export interface Range {
  lt?: any;
  lte?: any;
  gt?: any;
  gte?: any;
}

export interface GeoDistance {
  location_anchor: {
    lat: number;
    lon: number;
  };
  location_source: string;
  distance_type?: 'adaptive' | 'haversine';
  distance: string;
}

export interface Highlight {
  fields?: string[] | Record<string, any>;
  pre_tags?: string;
  post_tags?: string;
  fragment_size?: number;
  number_of_fragments?: number;
}

export interface Aggregation {
  terms?: {
    field: string;
    size?: number;
  };
  histogram?: {
    field: string;
    interval: number;
    offset?: number;
    keyed?: boolean;
  };
}

export interface ManticoreSearchResponse {
  took: number;
  timed_out: boolean;
  hits: {
    total: number;
    total_relation?: string;
    max_score?: number;
    hits: SearchHit[];
  };
  aggregations?: Record<string, any>;
  profile?: Record<string, any>;
  warning?: Record<string, any>;
}

export interface SearchHit {
  _id: string | number;
  _score?: number;
  _source: Record<string, any>;
  _knn_dist?: number;
  highlight?: Record<string, string[]>;
  table?: string;
  _type?: string;
  fields?: Record<string, any>;
}

export interface InsertDocumentRequest {
  table: string;
  cluster?: string;
  id?: number;
  doc: Record<string, any>;
}

export interface UpdateDocumentRequest {
  table: string;
  cluster?: string;
  id?: number;
  doc: Record<string, any>;
  query?: QueryFilter;
}

export interface DeleteDocumentRequest {
  table: string;
  cluster?: string;
  id?: number;
  query?: QueryFilter;
}

export interface ManticoreSuccessResponse {
  table: string;
  id?: number;
  created?: boolean;
  result: string;
  found?: boolean;
  status?: number;
  updated?: number;
  deleted?: number;
}

export interface ManticoreErrorResponse {
  error: {
    type?: string;
    reason?: string;
    table?: string;
  } | string;
  status: number;
}

export interface SqlResponse {
  total?: number;
  error?: string | null;
  warning?: string;
  columns?: Array<{
    [key: string]: {
      type: string;
    };
  }>;
  data?: Array<Record<string, any>>;
}

export interface TableInfo {
  name: string;
  engine?: string;
  columns?: TableColumn[];
}

export interface TableColumn {
  field: string;
  type: string;
  properties?: string;
}
