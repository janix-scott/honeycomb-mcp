import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { HoneycombAPI } from "./api/client.js";
import { z } from "zod";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  DatasetArgumentsSchema,
  QueryToolSchema,
  ColumnAnalysisSchema,
} from "./types/schema.js";
import { Dataset, DatasetWithColumns } from "./types/api.js";
import { AnalysisQuery } from "./types/query.js";
import { HoneycombError } from "./utils/errors.js";

async function handleToolError(
  error: unknown,
  toolName: string,
): Promise<{ content: { type: "text"; text: string }[] }> {
  let errorMessage = "Unknown error occurred";

  if (error instanceof HoneycombError) {
    errorMessage = `Honeycomb API error (${error.statusCode}): ${error.message}`;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return {
    content: [
      {
        type: "text",
        text: `Failed to execute tool '${toolName}': ${errorMessage}\n\nPlease verify:\n- Your API key is valid\n- The environment exists\n- The dataset exists\n- Required parameters are provided correctly`,
      },
    ],
  };
}

export function registerHandlers(server: Server, api: HoneycombAPI) {
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      // Get list of all environments and their datasets
      const environments = api.getEnvironments();
      const allResources: { uri: string; name: string; description: string }[] =
        [];

      // For each environment, get its datasets
      for (const envName of environments) {
        try {
          const datasets = await api.listDatasets(envName);
          // Add each dataset as a resource, including the environment in the URI
          datasets.forEach((dataset: Dataset) => {
            allResources.push({
              uri: `honeycomb://${envName}/${dataset.slug}`,
              name: `${dataset.name} (${envName})`,
              description: `Honeycomb dataset: ${dataset.name} in environment: ${envName}`,
            });
          });
        } catch (error) {
          console.error(
            `Error listing datasets for environment ${envName}:`,
            error,
          );
        }
      }

      return { resources: allResources };
    } catch (error) {
      console.error("Error listing resources:", error);
      return { resources: [] };
    }
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const match = uri.match(/^honeycomb:\/\/([^/]+)\/(.+)$/);

    if (!match) {
      throw new Error(
        "Invalid resource URI. Expected format: honeycomb://<environment>/<dataset-slug>",
      );
    }

    const [, envName, datasetSlug] = match;
    if (!envName || !datasetSlug) {
      throw new Error("Environment and dataset slug must be provided in URI");
    }

    try {
      const dataset = await api.getDataset(envName, datasetSlug);
      const columns = await api.getVisibleColumns(envName, datasetSlug);

      const datasetWithColumns: DatasetWithColumns = {
        ...dataset,
        columns: columns.map((c) => ({
          name: c.key_name,
          type: c.type,
          description: c.description,
        })),
      };

      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(datasetWithColumns, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to read dataset: ${error}`);
    }
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "list-datasets",
          description: "List all datasets in an environment",
          inputSchema: {
            type: "object",
            properties: {
              environment: {
                type: "string",
                description: "Name of the Honeycomb environment",
              },
            },
            required: ["environment"],
          },
        },
        {
          name: "get-columns",
          description: "Get columns for a dataset.",
          inputSchema: {
            type: "object",
            properties: {
              environment: {
                type: "string",
                description: "Name of the Honeycomb environment",
              },
              dataset: {
                type: "string",
                description: "Name of the dataset",
              },
            },
            required: ["environment", "dataset"],
          },
        },
        {
          name: "run-query",
          description: `Run an analytics query on a Honeycomb dataset. Specialized in analyzing traces, errors, latency, and service behavior.

          Common Query Patterns:
          1. Latency Analysis
          - Use HEATMAP with duration_ms to see distribution
          - Filter trace.parent_id does-not-exist for root spans
          - Break down by http.target and name

          2. Database Performance
          - Filter on db.statement exists
          - Use HEATMAP with duration_ms

          3. Error Analysis
          - Use error column (boolean) for error rate
          - Break down by name for error source
          - Use COUNT with AVG(error) for error rate

          4. Exception Analysis
          - Filter on exception.message exists
          - Break down by exception.message and parent_name

          Key Tips:
          - COUNT counts events, COUNT_DISTINCT counts unique values
          - HEATMAP shows distributions (pair with AVG,SUM,P99,RATE_AVG)
          - trace.parent_id does-not-exist identifies root spans
          - name column identifies span or span event
          - error is a boolean column for operation status

          Performance Notes:
          - Results limited to 100 rows by default
          - Time series data is disabled by default for performance
          - Use the Honeycomb UI (via queryUrl in response) for full result sets`,
          inputSchema: {
            type: "object",
            properties: {
              environment: {
                type: "string",
                description: "Name of the Honeycomb environment",
              },
              dataset: {
                type: "string",
                description: "Name of the dataset to query",
              },
              calculations: {
                type: "array",
                description:
                  "List of metrics to calculate. Required for all queries.",
                items: {
                  type: "object",
                  properties: {
                    op: {
                      type: "string",
                      enum: [
                        "COUNT", // Simple event count
                        "CONCURRENCY", // Concurrent operations
                        "COUNT_DISTINCT", // Unique value count
                        "SUM", // Sum of values
                        "AVG", // Average of values
                        "MAX", // Maximum value
                        "MIN", // Minimum value
                        "P001",
                        "P01",
                        "P05",
                        "P10",
                        "P25", // Percentiles (0.1% to 25%)
                        "P50", // Median
                        "P75",
                        "P90",
                        "P95",
                        "P99",
                        "P999", // Percentiles (75% to 99.9%)
                        "RATE_AVG", // Average rate per second
                        "RATE_SUM", // Sum rate per second
                        "RATE_MAX", // Maximum rate per second
                        "HEATMAP", // Distribution visualization
                      ],
                      description:
                        "Type of calculation to perform. Note: HEATMAP cannot be used with orders or having filters",
                    },
                    column: {
                      type: "string",
                      description:
                        "Column to perform calculation on. Required for all operations except COUNT and CONCURRENCY",
                    },
                  },
                  required: ["op"],
                },
              },
              breakdowns: {
                type: "array",
                items: { type: "string" },
                description:
                  "Columns to group results by. Use for dimensional analysis like grouping by service name or error type",
              },
              filters: {
                type: "array",
                description:
                  "Conditions to filter data before calculations are performed",
                items: {
                  type: "object",
                  properties: {
                    column: {
                      type: "string",
                      description: "Column to filter on",
                    },
                    op: {
                      type: "string",
                      enum: [
                        "=",
                        "!=", // Equality
                        ">",
                        ">=",
                        "<",
                        "<=", // Numeric comparison
                        "starts-with",
                        "does-not-start-with", // String prefix
                        "ends-with",
                        "does-not-end-with", // String suffix
                        "contains",
                        "does-not-contain", // Substring
                        "exists",
                        "does-not-exist", // Presence check
                        "in",
                        "not-in", // List membership
                      ],
                      description: "Filter operation to apply",
                    },
                    value: {
                      description:
                        "Value to compare against. Not needed for exists/does-not-exist",
                    },
                  },
                  required: ["column", "op"],
                },
              },
              filter_combination: {
                type: "string",
                enum: ["AND", "OR"],
                description:
                  "How to combine multiple filters. AND requires all filters to match, OR requires any filter to match",
              },
              orders: {
                type: "array",
                description:
                  "How to sort results. Cannot be used with HEATMAP calculations",
                items: {
                  type: "object",
                  properties: {
                    column: {
                      type: "string",
                      description:
                        "Column to sort by. Use for raw column values",
                    },
                    op: {
                      type: "string",
                      description:
                        "Calculation to sort by (e.g. COUNT, P95). Use when sorting by a calculated metric",
                    },
                    order: {
                      type: "string",
                      enum: ["ascending", "descending"],
                      description: "Sort direction",
                    },
                  },
                  required: ["order"],
                },
              },
              having: {
                type: "array",
                description:
                  "Filters to apply after calculations. Cannot be used with HEATMAP calculations",
                items: {
                  type: "object",
                  properties: {
                    calculate_op: {
                      type: "string",
                      description: "Calculation to filter on (e.g. COUNT, P95)",
                    },
                    column: {
                      type: "string",
                      description: "Column used in calculation",
                    },
                    op: {
                      type: "string",
                      enum: ["=", "!=", ">", ">=", "<", "<="],
                      description: "Comparison operator",
                    },
                    value: {
                      type: "number",
                      description:
                        "Value to compare calculation result against",
                    },
                  },
                  required: ["calculate_op", "op", "value"],
                },
              },
              time_range: {
                type: "number",
                description:
                  "Relative time range in seconds (e.g., 3600 for last hour, 86400 for last day)",
              },
              start_time: {
                type: "number",
                description: "Absolute start time as UNIX timestamp in seconds",
              },
              end_time: {
                type: "number",
                description: "Absolute end time as UNIX timestamp in seconds",
              },
              granularity: {
                type: "number",
                description:
                  "Time bucket size in seconds for time series analysis (e.g., 60 for minute-level buckets)",
              },
            },
            required: ["environment", "dataset", "calculations"],
          },
        },
        {
          name: "analyze-column",
          description:
            "Perform detailed statistical analysis of a specific column",
          inputSchema: {
            type: "object",
            properties: {
              environment: {
                type: "string",
                description: "Name of the Honeycomb environment",
              },
              dataset: {
                type: "string",
                description: "Name of the dataset",
              },
              column: {
                type: "string",
                description: "Column to analyze",
              },
              timeRange: {
                type: "number",
                description: "Time range in seconds (default: 3600)",
              },
            },
            required: ["environment", "dataset", "column"],
          },
        },
        {
          name: "list-slos",
          description: "List all SLOs (Service Level Objectives) for a dataset",
          inputSchema: {
            type: "object",
            properties: {
              environment: {
                type: "string",
                description: "Name of the Honeycomb environment",
              },
              dataset: {
                type: "string",
                description: "Name of the dataset",
              },
            },
            required: ["environment", "dataset"],
          },
        },
        {
          name: "get-slo",
          description:
            "Get detailed information about a specific SLO including current compliance and budget",
          inputSchema: {
            type: "object",
            properties: {
              environment: {
                type: "string",
                description: "Name of the Honeycomb environment",
              },
              dataset: {
                type: "string",
                description: "Name of the dataset",
              },
              sloId: {
                type: "string",
                description: "ID of the SLO",
              },
            },
            required: ["environment", "dataset", "sloId"],
          },
        },
        {
          name: "list-triggers",
          description: "List all triggers (alerts) for a dataset",
          inputSchema: {
            type: "object",
            properties: {
              environment: {
                type: "string",
                description: "Name of the Honeycomb environment",
              },
              dataset: {
                type: "string",
                description: "Name of the dataset",
              },
            },
            required: ["environment", "dataset"],
          },
        },
        {
          name: "get-trigger",
          description:
            "Get detailed information about a specific trigger including its current state",
          inputSchema: {
            type: "object",
            properties: {
              environment: {
                type: "string",
                description: "Name of the Honeycomb environment",
              },
              dataset: {
                type: "string",
                description: "Name of the dataset",
              },
              triggerId: {
                type: "string",
                description: "ID of the trigger",
              },
            },
            required: ["environment", "dataset", "triggerId"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: z.infer<typeof CallToolRequestSchema>) => {
      const { name, arguments: args } = request.params;

      if (!args) {
        return {
          content: [
            {
              type: "text",
              text: "Missing required arguments for tool execution",
            },
          ],
        };
      }

      switch (name) {
        case "list-datasets": {
          const { environment } = z
            .object({
              environment: z.string(),
            })
            .parse(args);

          try {
            const datasets = await api.listDatasets(environment);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    datasets.map((dataset) => ({
                      name: dataset.name,
                      slug: dataset.slug,
                      description: dataset.description,
                    })),
                    null,
                    2,
                  ),
                },
              ],
            };
          } catch (error) {
            return handleToolError(error, name);
          }
        }

        case "get-columns": {
          const { environment, dataset } = z
            .object({
              environment: z.string(),
              dataset: z.string(),
            })
            .parse(args);

          try {
            const columns = await api.getVisibleColumns(environment, dataset);
            const simplified = columns
              .map((col) => `${col.key_name} (${col.type})`)
              .join(", ");

            return {
              content: [
                {
                  type: "text",
                  text: `Available columns: ${simplified}`,
                },
              ],
            };
          } catch (error) {
            return handleToolError(error, name);
          }
        }

        case "run-query": {
          const params = QueryToolSchema.parse(args);
          const { environment, dataset, calculations, ...queryParams } = params;

          try {
            const query: AnalysisQuery = {
              calculations,
              ...queryParams,
            };

            const results = await api.queryAndWaitForResults(
              environment,
              dataset,
              query,
              10,
              {
                includeSeries: false,
                limit: 50,
              },
            );

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      results: results.data?.results || [],
                      queryUrl: results.links?.query_url,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          } catch (error) {
            return handleToolError(error, name);
          }
        }

        case "analyze-column": {
          const params = z
            .object({
              environment: z.string(),
              dataset: z.string(),
              column: z.string(),
              timeRange: z.number().optional(),
            })
            .parse(args);

          try {
            const results = await api.analyzeColumn(
              params.environment,
              params.dataset,
              {
                dataset: params.dataset,
                column: params.column,
                timeRange: params.timeRange,
              },
            );
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(results.data, null, 2),
                },
              ],
            };
          } catch (error) {
            return handleToolError(error, name);
          }
        }

        case "list-slos": {
          const { environment, dataset } = z
            .object({
              environment: z.string(),
              dataset: z.string(),
            })
            .parse(args);

          try {
            const slos = await api.getSLOs(environment, dataset);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      slos: slos.map((slo) => ({
                        id: slo.id,
                        name: slo.name,
                        description: slo.description,
                        target_per_million: slo.target_per_million,
                        time_period_days: slo.time_period_days,
                      })),
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          } catch (error) {
            return handleToolError(error, name);
          }
        }

        case "get-slo": {
          const params = z
            .object({
              environment: z.string(),
              dataset: z.string(),
              sloId: z.string(),
            })
            .parse(args);

          try {
            const slo = await api.getSLO(
              params.environment,
              params.dataset,
              params.sloId,
            );
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      id: slo.id,
                      name: slo.name,
                      description: slo.description,
                      target_per_million: slo.target_per_million,
                      time_period_days: slo.time_period_days,
                      compliance: slo.compliance,
                      budget_remaining: slo.budget_remaining,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          } catch (error) {
            return handleToolError(error, name);
          }
        }

        case "list-triggers": {
          const { environment, dataset } = z
            .object({
              environment: z.string(),
              dataset: z.string(),
            })
            .parse(args);

          try {
            const triggers = await api.getTriggers(environment, dataset);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      triggers: triggers.map((trigger) => ({
                        id: trigger.id,
                        name: trigger.name,
                        description: trigger.description,
                        disabled: trigger.disabled,
                        triggered: trigger.triggered,
                      })),
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          } catch (error) {
            return handleToolError(error, name);
          }
        }

        case "get-trigger": {
          const params = z
            .object({
              environment: z.string(),
              dataset: z.string(),
              triggerId: z.string(),
            })
            .parse(args);

          try {
            const trigger = await api.getTrigger(
              params.environment,
              params.dataset,
              params.triggerId,
            );
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      id: trigger.id,
                      name: trigger.name,
                      description: trigger.description,
                      threshold: trigger.threshold,
                      disabled: trigger.disabled,
                      triggered: trigger.triggered,
                      frequency: trigger.frequency,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          } catch (error) {
            return handleToolError(error, name);
          }
        }

        default:
          return {
            content: [
              {
                type: "text",
                text: `Unknown tool: ${name}. Available tools can be listed using the list-tools command.`,
              },
            ],
          };
      }
    },
  );
}
