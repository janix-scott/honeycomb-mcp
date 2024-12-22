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

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      // Get list of all environments
      const environments = api.getEnvironments();
      const allDatasets: Dataset[] = [];

      // Get datasets from each environment
      for (const env of environments) {
        try {
          const datasets = await api.listDatasets(env);
          allDatasets.push(...datasets);
        } catch (error) {
          console.error(
            `Error listing datasets for environment ${env}:`,
            error,
          );
        }
      }

      return {
        resources: allDatasets.map((dataset: Dataset) => ({
          uri: `honeycomb://${dataset.slug}`,
          name: dataset.name,
          description: `Honeycomb dataset: ${dataset.name}`,
        })),
      };
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
            required: ["environment, dataset"],
          },
        },
        {
          name: "run-query",
          description: "Run a basic analytics query on a dataset",
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
              calculation: {
                type: "string",
                enum: ["COUNT", "AVG", "MAX", "MIN", "P95", "P99"],
                description: "Type of calculation to perform",
              },
              column: {
                type: "string",
                description:
                  "Column to analyze (required for non-COUNT calculations)",
              },
              timeRange: {
                type: "number",
                description: "Time range in seconds (default: 3600)",
              },
              breakdowns: {
                type: "array",
                items: { type: "string" },
                description: "Columns to group by",
              },
            },
            required: ["environment", "dataset", "calculation"],
          },
        },
        {
          name: "analyze-column",
          description: "Perform detailed analysis of a specific column",
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
          description: "Get detailed information about a specific SLO",
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
          description: "List all triggers for a dataset",
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
          description: "Get information about a specific trigger",
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
            return {
              content: [
                {
                  type: "text",
                  text:
                    error instanceof Error
                      ? error.message
                      : "Failed to list datasets",
                },
              ],
            };
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
            return {
              content: [
                {
                  type: "text",
                  text:
                    error instanceof Error
                      ? error.message
                      : "An unknown error occurred",
                },
              ],
            };
          }
        }

        case "run-query": {
          const params = z
            .object({
              environment: z.string(),
              dataset: z.string(),
              calculation: z.enum(["COUNT", "AVG", "MAX", "MIN", "P95", "P99"]),
              column: z.string().optional(),
              timeRange: z.number().optional(),
              breakdowns: z.array(z.string()).optional(),
              filter: z.record(z.any()).optional(),
            })
            .parse(args);

          try {
            const results = await api.runAnalysisQuery(
              params.environment,
              params.dataset,
              {
                dataset: params.dataset,
                calculation: params.calculation,
                column: params.column,
                timeRange: params.timeRange,
                breakdowns: params.breakdowns,
                filter: params.filter,
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
            return {
              content: [
                {
                  type: "text",
                  text: error instanceof Error ? error.message : "Query failed",
                },
              ],
            };
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
            return {
              content: [
                {
                  type: "text",
                  text:
                    error instanceof Error ? error.message : "Analysis failed",
                },
              ],
            };
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
            return {
              content: [
                {
                  type: "text",
                  text:
                    error instanceof Error
                      ? error.message
                      : "Failed to list SLOs",
                },
              ],
            };
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
            return {
              content: [
                {
                  type: "text",
                  text:
                    error instanceof Error
                      ? error.message
                      : "Failed to get SLO details",
                },
              ],
            };
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
            return {
              content: [
                {
                  type: "text",
                  text:
                    error instanceof Error
                      ? error.message
                      : "Failed to list triggers",
                },
              ],
            };
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
            return {
              content: [
                {
                  type: "text",
                  text:
                    error instanceof Error
                      ? error.message
                      : "Failed to get trigger details",
                },
              ],
            };
          }
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    },
  );
}
