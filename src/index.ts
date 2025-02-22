import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { HoneycombAPI } from "./api/client.js";
import { z } from "zod";
import {
  DatasetArgumentsSchema,
  QueryToolSchema,
  ColumnAnalysisSchema,
} from "./types/schema.js";
import { Dataset } from "./types/api.js";
import { HoneycombError } from "./utils/errors.js";
import process from "node:process";

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

  // Log the error to stderr for debugging
  console.error(`Tool '${toolName}' failed:`, error);

  return {
    content: [
      {
        type: "text",
        text: `Failed to execute tool '${toolName}': ${errorMessage}\n\n` +
          `Please verify:\n` +
          `- The environment name is correct and configured in .mcp-honeycomb.json\n` +
          `- Your API key is valid\n` +
          `- The dataset exists (if specified)\n` +
          `- Required parameters are provided correctly`,
      },
    ],
  };
}

// Create a main async function to run everything
async function main() {
  // Load config and create API client
  const config = loadConfig();
  const api = new HoneycombAPI(config);

  // Create server with proper initialization options
  const server = new McpServer({
    name: "honeycomb",
    version: "1.0.0"
  });

  // Register resource for datasets
  server.resource(
    "datasets",
    new ResourceTemplate("honeycomb://{environment}/{dataset}", { 
      list: async () => {
        const environments = api.getEnvironments();
        const resources: { uri: string; name: string; description?: string }[] = [];
        
        for (const env of environments) {
          try {
            const datasets = await api.listDatasets(env);
            datasets.forEach((dataset: Dataset) => {
              resources.push({
                uri: `honeycomb://${env}/${dataset.slug}`,
                name: dataset.name,
                description: dataset.description || `Dataset ${dataset.name} in environment ${env}`,
              });
            });
          } catch (error) {
            console.error(`Error listing datasets for environment ${env}:`, error);
          }
        }

        return { resources };
      }
    }),
    async (uri, { environment, dataset }) => {
      try {
        if (dataset) {
          // Get specific dataset
          const datasetInfo = await api.getDataset(environment as string, dataset as string);
          const columns = await api.getVisibleColumns(environment as string, dataset as string);

          const datasetWithColumns = {
            name: datasetInfo.name,
            columns: columns.map((c) => ({
              name: c.key_name,
              type: c.type,
              description: c.description,
            })),
          };

          return {
            contents: [
              {
                uri: uri.href,
                mimeType: "application/json",
                text: JSON.stringify(datasetWithColumns, null, 2),
              },
            ],
          };
        } else {
          // List all datasets
          const datasets = await api.listDatasets(environment as string);
          return {
            contents: datasets.map((dataset: Dataset) => ({
              uri: `honeycomb://${environment}/${dataset.slug}`,
              text: JSON.stringify({
                name: dataset.name,
                description: dataset.description,
              }, null, 2),
            })),
          };
        }
      } catch (error) {
        throw new Error(`Failed to read dataset: ${error}`);
      }
    }
  );

  // Register tools
  server.tool(
    "list_datasets",
    { environment: z.string() },
    async ({ environment }) => {
      try {
        const datasets = await api.listDatasets(environment);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(datasets, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleToolError(error, "list_datasets");
      }
    }
  );

  server.tool(
    "get_columns",
    {
      environment: z.string(),
      dataset: z.string(),
    },
    async ({ environment, dataset }) => {
      try {
        const columns = await api.getVisibleColumns(environment, dataset);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(columns, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleToolError(error, "get_columns");
      }
    }
  );

  server.tool(
    "run_query",
    QueryToolSchema.shape,
    async (params) => {
      try {
        const result = await api.runAnalysisQuery(params.environment, params.dataset, params);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleToolError(error, "run_query");
      }
    }
  );

  server.tool(
    "analyze_column",
    ColumnAnalysisSchema.shape,
    async (params) => {
      try {
        const result = await api.analyzeColumn(params.environment, params.dataset, params);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleToolError(error, "analyze_column");
      }
    }
  );

  server.tool(
    "list_slos",
    DatasetArgumentsSchema.shape,
    async ({ environment, dataset }) => {
      try {
        const slos = await api.getSLOs(environment, dataset);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(slos, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleToolError(error, "list_slos");
      }
    }
  );

  server.tool(
    "get_slo",
    {
      environment: z.string(),
      dataset: z.string(),
      sloId: z.string(),
    },
    async ({ environment, dataset, sloId }) => {
      try {
        const slo = await api.getSLO(environment, dataset, sloId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(slo, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleToolError(error, "get_slo");
      }
    }
  );

  server.tool(
    "list_triggers",
    DatasetArgumentsSchema.shape,
    async ({ environment, dataset }) => {
      try {
        const triggers = await api.getTriggers(environment, dataset);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(triggers, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleToolError(error, "list_triggers");
      }
    }
  );

  server.tool(
    "get_trigger",
    {
      environment: z.string(),
      dataset: z.string(),
      triggerId: z.string(),
    },
    async ({ environment, dataset, triggerId }) => {
      try {
        const trigger = await api.getTrigger(environment, dataset, triggerId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(trigger, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleToolError(error, "get_trigger");
      }
    }
  );

  // Create transport and start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Honeycomb MCP Server running on stdio");
}

// Run main with proper error handling
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
  });
}
