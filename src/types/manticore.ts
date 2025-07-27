// Manticore Search API types based on the OpenAPI specification

export interface ManticoreSearchRequest {
  index: string;
  query?: QueryFilter;
  limit?: number;
  offset?: number;
  sort?: Record<string, 'asc' | 'desc' | { order: 'asc' | 'desc' }>[];
  highlight?: Highlight;
  aggs?: Record<string, Aggregation>;
  expressions?: Record<string, string>;
  max_matches?: number;
  options?: Record<string, string | number | boolean>;
  profile?: boolean;
  _source?: boolean | string[];
  track_scores?: boolean;
  knn?: KnnQuery;
  size?: number;
  from?: number;
}

export interface KnnQuery {
    field: string;
    query_vector: number[];
    k: number;
    ef?: number;
    filter?: QueryFilter;
}

export interface QueryFilter {
  query_string?: string | { query: string };
  match?: Record<string, string | { query: string; operator: string; }>;
  match_phrase?: Record<string, string>;
  match_all?: Record<string, unknown>;
  bool?: BoolFilter;
  equals?: Record<string, string | number | boolean>;
  in?: Record<string, (string | number)[]>;
  range?: Record<string, Range>;
  geo_distance?: GeoDistance;
}

export interface BoolFilter {
  must?: QueryFilter[];
  must_not?: QueryFilter[];
  should?: QueryFilter[];
}

export interface Range {
  lt?: string | number;
  lte?: string | number;
  gt?: string | number;
  gte?: string | number;
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
  fields?: string[] | Record<string, Record<string, unknown>>;
  pre_tags?: string;
  post_tags?: string;
  fragment_size?: number;
  number_of_fragments?: number;
}

export interface Aggregation {
  terms?: {
    field: string;
    size?: number;
    order?: Record<string, 'asc' | 'desc'>;
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
  aggregations?: Record<string, {
    buckets: { key: string | number; doc_count: number }[];
    doc_count_error_upper_bound?: number;
    sum_other_doc_count?: number;
  }>;
  profile?: Record<string, unknown>;
  warning?: Record<string, string>;
}

export interface SearchHit {
  _id: string | number;
  _score?: number;
  _source: Record<string, unknown>;
  _knn_dist?: number;
  highlight?: Record<string, string[]>;
  table?: string;
  _type?: string;
  fields?: Record<string, unknown>;
}

export interface InsertDocumentRequest {
  index: string;
  cluster?: string;
  id?: number;
  doc: Record<string, unknown>;
}

export interface UpdateDocumentRequest {
  index: string;
  cluster?: string;
  id?: number;
  doc: Record<string, unknown>;
  query?: QueryFilter;
}

export interface DeleteDocumentRequest {
  index: string;
  cluster?: string;
  id?: number;
  query?: QueryFilter;
}

export interface ManticoreSuccessResponse {
  index: string;
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
    index?: string;
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
  data?: Array<Record<string, unknown>>;
}

export interface TableInfo {
  name: string;
  engine?: string;
  columns?: TableColumn[];
  settings?: {
    min_infix_len?: number;
    [key: string]: unknown;
  };
}

export interface TableColumn {
  field: string;
  type: string;
  properties?: string;
}
