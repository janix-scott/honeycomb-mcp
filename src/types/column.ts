export interface Column {
  id: string;
  key_name: string;
  type: "string" | "float" | "integer" | "boolean";
  description: string;
  hidden: boolean;
  last_written?: string;
  created_at: string;
  updated_at: string;
}
