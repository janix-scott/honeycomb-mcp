import { z } from "zod";

export const DatasetArgumentsSchema = z.object({
  dataset: z.string(),
});

// Add a schema for column-related operations
export const ColumnInfoSchema = z.object({
  datasetSlug: z.string(),
  columnName: z.string().optional(),
  type: z.enum(["string", "float", "integer", "boolean"]).optional(),
  includeHidden: z.boolean().optional().default(false),
});

// Input validation schemas using zod
export const QueryInputSchema = z.object({
  dataset: z.string(),
  timeRange: z.number().optional(),
  filter: z.record(z.any()).optional(),
  breakdowns: z.array(z.string()).optional(),
  calculations: z.array(z.record(z.any())).optional(),
});

// Tool definition schemas
export const queryToolSchema = z.object({
  dataset: z.string(),
  query: z.record(z.any()),
});

export const QueryToolSchema = z.object({
  dataset: z.string(),
  timeRange: z.number().optional(),
  calculation: z.enum(["COUNT", "AVG", "MAX", "MIN", "P95", "P99"]),
  column: z.string().optional(),
  filter: z.record(z.any()).optional(),
  breakdowns: z.array(z.string()).optional(),
});

export const ColumnAnalysisSchema = z.object({
  dataset: z.string(),
  column: z.string(),
  timeRange: z.number().optional(),
});

export const PromptSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  arguments: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        required: z.boolean().optional(),
      }),
    )
    .optional(),
});

export const SLOArgumentsSchema = z.object({
  dataset: z.string(),
  sloId: z.string(),
});

export const TriggerArgumentsSchema = z.object({
  dataset: z.string(),
  triggerId: z.string(),
});

export const NotificationRecipientSchema = z.object({
  id: z.string(),
  type: z.enum([
    "pagerduty",
    "email",
    "slack",
    "webhook",
    "msteams",
    "msteams_workflow",
  ]),
  target: z.string().optional(),
  details: z
    .object({
      pagerduty_severity: z
        .enum(["critical", "error", "warning", "info"])
        .optional(),
    })
    .optional(),
});

export const TriggerThresholdSchema = z.object({
  op: z.enum([">", ">=", "<", "<="]),
  value: z.number(),
  exceeded_limit: z.number().optional(),
});

export const WeekdaySchema = z.enum([
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]);

export const TimeStringSchema = z
  .string()
  .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/);

export const EvaluationScheduleSchema = z.object({
  window: z.object({
    days_of_week: z.array(WeekdaySchema),
    start_time: TimeStringSchema,
    end_time: TimeStringSchema,
  }),
});

export const TriggerSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  threshold: TriggerThresholdSchema,
  frequency: z.number(),
  alert_type: z.enum(["on_change", "on_true"]).optional(),
  disabled: z.boolean(),
  triggered: z.boolean(),
  recipients: z.array(NotificationRecipientSchema),
  evaluation_schedule_type: z.enum(["frequency", "window"]).optional(),
  evaluation_schedule: EvaluationScheduleSchema.optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const SLISchema = z.object({
  alias: z.string(),
});

export const SLOSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  sli: SLISchema,
  time_period_days: z.number(),
  target_per_million: z.number(),
  reset_at: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const SLODetailedResponseSchema = SLOSchema.extend({
  compliance: z.number(),
  budget_remaining: z.number(),
});

export const DatasetConfigSchema = z.object({
  name: z.string(),
  apiKey: z.string(),
  baseUrl: z.string().optional(),
});

export const ConfigSchema = z.object({
  datasets: z.array(DatasetConfigSchema),
});
