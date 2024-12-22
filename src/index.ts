import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import process from "node:process";

interface HoneycombConfig {
  apiKey: string;
  baseUrl?: string;
}

interface Column {
  id: string;
  key_name: string;
  type: "string" | "float" | "integer" | "boolean";
  description: string;
  hidden: boolean;
  last_written?: string;
  created_at: string;
  updated_at: string;
}

interface QueryCalculation {
  op: string;
  column?: string;
}

interface AnalysisQuery {
  calculations: QueryCalculation[];
  breakdowns: string[];
  time_range: number;
  orders?: Array<{
    op: string;
    order: "ascending" | "descending";
  }>;
  limit?: number;
}

interface QueryResult {
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

interface QueryResponse {
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

class HoneycombError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "HoneycombError";
  }
}

function loadConfig(): HoneycombConfig {
  try {
    const configPath = join(homedir(), ".hny", "config.json");
    const configFile = readFileSync(configPath, "utf-8");
    const config = JSON.parse(configFile);

    if (!config.apiKey) {
      throw new Error("No API key found in config");
    }

    return config;
  } catch (error) {
    throw new Error(
      "Could not load config from ~/.hny/config.json. " +
        "Please create this file with your Honeycomb API key: " +
        '{"apiKey": "your_key_here"}',
    );
  }
}

async function honeycombRequest(
  config: HoneycombConfig,
  path: string,
  options: RequestInit = {},
) {
  const baseUrl = config.baseUrl || "https://api.honeycomb.io";
  const url = `${baseUrl}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "X-Honeycomb-Team": config.apiKey,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new HoneycombError(
      response.status,
      `Honeycomb API error: ${response.statusText}`,
    );
  }

  return response.json();
}

const HoneycombAPI = {
  // Get dataset info
  async getDataset(config: HoneycombConfig, datasetSlug: string) {
    return honeycombRequest(config, `/1/datasets/${datasetSlug}`);
  },

  // Create a query - POST /1/queries/{datasetSlug}
  async createQuery(config: HoneycombConfig, datasetSlug: string, query: any) {
    return honeycombRequest(config, `/1/queries/${datasetSlug}`, {
      method: "POST",
      body: JSON.stringify(query),
    });
  },

  // Create query result - POST /1/query_results/{datasetSlug}
  async createQueryResult(
    config: HoneycombConfig,
    datasetSlug: string,
    queryId: string,
  ) {
    return honeycombRequest(config, `/1/query_results/${datasetSlug}`, {
      method: "POST",
      body: JSON.stringify({ query_id: queryId }),
    });
  },

  // Get query result - GET /1/query_results/{datasetSlug}/{queryResultId}
  async getQueryResults(
    config: HoneycombConfig,
    datasetSlug: string,
    queryResultId: string,
  ) {
    return honeycombRequest(
      config,
      `/1/query_results/${datasetSlug}/${queryResultId}`,
    );
  },

  // Enhanced queryAndWaitForResults to use correct endpoints
  async queryAndWaitForResults(
    config: HoneycombConfig,
    datasetSlug: string,
    query: AnalysisQuery,
    maxAttempts = 10,
  ) {
    // First create the query
    const queryResponse = await this.createQuery(config, datasetSlug, query);
    const queryId = queryResponse.id;

    // Then create query result
    const queryResult = await this.createQueryResult(
      config,
      datasetSlug,
      queryId,
    );
    const queryResultId = queryResult.id;

    // Poll for results
    let attempts = 0;
    while (attempts < maxAttempts) {
      const results = await this.getQueryResults(
        config,
        datasetSlug,
        queryResultId,
      );
      if (results.complete) {
        return results;
      }
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("Query timed out waiting for results");
  },

  async getColumns(
    config: HoneycombConfig,
    datasetSlug: string,
  ): Promise<Column[]> {
    return honeycombRequest(config, `/1/columns/${datasetSlug}`);
  },

  // Get a specific column by key name
  async getColumnByName(
    config: HoneycombConfig,
    datasetSlug: string,
    keyName: string,
  ): Promise<Column> {
    const response = await honeycombRequest(
      config,
      `/1/columns/${datasetSlug}?key_name=${encodeURIComponent(keyName)}`,
    );
    return response;
  },

  // Helper to get all non-hidden columns
  async getVisibleColumns(
    config: HoneycombConfig,
    datasetSlug: string,
  ): Promise<Column[]> {
    const columns = await this.getColumns(config, datasetSlug);
    return columns.filter((column) => !column.hidden);
  },

  // Helper to get column names by type
  async getColumnsByType(
    config: HoneycombConfig,
    datasetSlug: string,
    type: Column["type"],
  ): Promise<Column[]> {
    const columns = await this.getColumns(config, datasetSlug);
    return columns.filter((column) => column.type === type);
  },

  // Helper to get a summary of column information
  async getColumnSummary(config: HoneycombConfig, datasetSlug: string) {
    const columns = await this.getColumns(config, datasetSlug);
    return {
      total: columns.length,
      byType: {
        string: columns.filter((c) => c.type === "string").length,
        float: columns.filter((c) => c.type === "float").length,
        integer: columns.filter((c) => c.type === "integer").length,
        boolean: columns.filter((c) => c.type === "boolean").length,
      },
      hidden: columns.filter((c) => c.hidden).length,
      visible: columns.filter((c) => !c.hidden).length,
      recentlyWritten: columns
        .filter((c) => c.last_written)
        .sort((a, b) => {
          return (
            new Date(b.last_written!).getTime() -
            new Date(a.last_written!).getTime()
          );
        })
        .slice(0, 5)
        .map((c) => ({
          name: c.key_name,
          last_written: c.last_written,
        })),
    };
  },

  async runAnalysisQuery(
    config: HoneycombConfig,
    datasetSlug: string,
    params: z.infer<typeof QueryToolSchema>,
  ) {
    const query: AnalysisQuery = {
      calculations: [
        {
          op: params.calculation,
          ...(params.column && { column: params.column }),
        },
      ],
      breakdowns: params.breakdowns || [],
      time_range: params.timeRange || 3600,
      ...(params.filter && { filters: [params.filter] }),
    };

    try {
      const results = await this.queryAndWaitForResults(
        config,
        datasetSlug,
        query,
      );

      // Format results according to the API response structure
      return {
        data: {
          results: results.data?.results || [],
          series: results.data?.series || [],
        },
        links: results.links,
      };
    } catch (error) {
      throw new Error(
        `Analysis query failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  },

  async analyzeColumn(
    config: HoneycombConfig,
    datasetSlug: string,
    params: z.infer<typeof ColumnAnalysisSchema>,
  ) {
    const column = await this.getColumnByName(
      config,
      datasetSlug,
      params.column,
    );

    const query: AnalysisQuery = {
      calculations: [{ op: "COUNT" }],
      breakdowns: [params.column],
      time_range: params.timeRange || 3600,
      orders: [
        {
          op: "COUNT",
          order: "descending",
        },
      ],
      limit: 10,
    };

    if (column.type === "integer" || column.type === "float") {
      const numericCalculations: QueryCalculation[] = [
        { op: "AVG", column: params.column },
        { op: "P95", column: params.column },
        { op: "MAX", column: params.column },
        { op: "MIN", column: params.column },
      ];
      query.calculations.push(...numericCalculations);
    }

    try {
      const results = await this.queryAndWaitForResults(
        config,
        datasetSlug,
        query,
      );

      return {
        data: {
          results: results.data?.results || [],
          series: results.data?.series || [],
        },
        links: results.links,
      };
    } catch (error) {
      throw new Error(
        `Column analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  },
};

const DatasetArgumentsSchema = z.object({
  dataset: z.string(),
});

// Add a schema for column-related operations
const ColumnInfoSchema = z.object({
  datasetSlug: z.string(),
  columnName: z.string().optional(),
  type: z.enum(["string", "float", "integer", "boolean"]).optional(),
  includeHidden: z.boolean().optional().default(false),
});

// Input validation schemas using zod
const QueryInputSchema = z.object({
  dataset: z.string(),
  timeRange: z.number().optional(),
  filter: z.record(z.any()).optional(),
  breakdowns: z.array(z.string()).optional(),
  calculations: z.array(z.record(z.any())).optional(),
});

// Tool definition schemas
const queryToolSchema = z.object({
  dataset: z.string(),
  query: z.record(z.any()),
});

const QueryToolSchema = z.object({
  dataset: z.string(),
  timeRange: z.number().optional(),
  calculation: z.enum(["COUNT", "AVG", "MAX", "MIN", "P95", "P99"]),
  column: z.string().optional(),
  filter: z.record(z.any()).optional(),
  breakdowns: z.array(z.string()).optional(),
});

const ColumnAnalysisSchema = z.object({
  dataset: z.string(),
  column: z.string(),
  timeRange: z.number().optional(),
});

// Server setup

const honeycombConfig = loadConfig();
const server = new Server(
  {
    name: "honeycomb",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  },
);

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    // Get list of datasets from Honeycomb
    const datasets = await honeycombRequest(honeycombConfig, "/1/datasets");

    return {
      resources: datasets.map((dataset: any) => ({
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
  const match = uri.match(/^honeycomb:\/\/(.+)$/);

  if (!match) {
    throw new Error("Invalid resource URI");
  }

  const datasetSlug = match[1];

  try {
    const dataset = await HoneycombAPI.getDataset(honeycombConfig, datasetSlug);
    const columns = await HoneycombAPI.getVisibleColumns(
      honeycombConfig,
      datasetSlug,
    );

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              ...dataset,
              columns: columns.map((c) => ({
                name: c.key_name,
                type: c.type,
                description: c.description,
              })),
            },
            null,
            2,
          ),
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
        name: "get-columns",
        description: "Get columns for a dataset.",
        inputSchema: {
          type: "object",
          properties: {
            dataset: {
              type: "string",
              description: "Name of the dataset",
            },
          },
          required: ["dataset"],
        },
      },
      {
        name: "run-query",
        description: "Run a basic analytics query on a dataset",
        inputSchema: {
          type: "object",
          properties: {
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
          required: ["dataset", "calculation"],
        },
      },
      {
        name: "analyze-column",
        description: "Perform detailed analysis of a specific column",
        inputSchema: {
          type: "object",
          properties: {
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
          required: ["dataset", "column"],
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
      case "get-columns": {
        const { dataset } = DatasetArgumentsSchema.parse(args);

        try {
          const columns = await HoneycombAPI.getVisibleColumns(
            honeycombConfig,
            dataset,
          );

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
        const params = QueryToolSchema.parse(args);
        try {
          const results = await HoneycombAPI.runAnalysisQuery(
            honeycombConfig,
            params.dataset,
            params,
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
        const params = ColumnAnalysisSchema.parse(args);
        try {
          const results = await HoneycombAPI.analyzeColumn(
            honeycombConfig,
            params.dataset,
            params,
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

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Honeycomb MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
