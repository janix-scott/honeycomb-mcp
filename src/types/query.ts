export interface QueryCalculation {
  op: string;
  column?: string;
}

export interface AnalysisQuery {
  calculations: QueryCalculation[];
  breakdowns: string[];
  time_range: number;
  orders?: Array<{
    op: string;
    order: "ascending" | "descending";
  }>;
  limit?: number;
}

export interface QueryResult {
  data?: {
    results: any[];
    series: any[];
  };
  links?: {
    query_url?: string;
    graph_image_url?: string;
  };
  complete: boolean;
  id: string;
}

export interface QueryResponse {
  id: string;
  complete: boolean;
  data?: {
    results: any[];
    series: any[];
  };
  links?: {
    query_url?: string;
    graph_image_url?: string;
  };
}
