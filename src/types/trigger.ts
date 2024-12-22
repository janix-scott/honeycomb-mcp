export interface NotificationRecipient {
  id: string;
  type:
    | "pagerduty"
    | "email"
    | "slack"
    | "webhook"
    | "msteams"
    | "msteams_workflow";
  target?: string;
  details?: {
    pagerduty_severity?: "critical" | "error" | "warning" | "info";
  };
}

export interface TriggerThreshold {
  op: ">" | ">=" | "<" | "<=";
  value: number;
  exceeded_limit?: number;
}

export interface TriggerResponse {
  id: string;
  name: string;
  description?: string;
  threshold: TriggerThreshold;
  frequency: number;
  alert_type?: "on_change" | "on_true";
  disabled: boolean;
  triggered: boolean;
  recipients: NotificationRecipient[];
  evaluation_schedule_type?: "frequency" | "window";
  evaluation_schedule?: {
    window: {
      days_of_week: (
        | "sunday"
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday"
      )[];
      start_time: string; // HH:mm format
      end_time: string; // HH:mm format
    };
  };
  created_at: string;
  updated_at: string;
}
