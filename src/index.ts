import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { HoneycombAPI } from "./api/client.js";
import { registerHandlers } from "./handlers.js";
import process from "node:process";

// Create a main async function to run everything
async function main() {
  // Load config and create API client
  const config = loadConfig();
  const api = new HoneycombAPI(config);

  // Create server with proper initialization options
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

  // Register all our handlers
  registerHandlers(server, api);

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
