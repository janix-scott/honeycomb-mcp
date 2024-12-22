export interface SLI {
  alias: string;
}

export interface SLO {
  id: string;
  name: string;
  description?: string;
  sli: SLI;
  time_period_days: number;
  target_per_million: number;
  reset_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SLODetailedResponse extends SLO {
  compliance: number;
  budget_remaining: number;
}
