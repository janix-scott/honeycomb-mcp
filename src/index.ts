/**
 * Honeycomb MCP Server Implementation
 * MCP Compliance Status: Testing in progress against protocol version 2025-03-26
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { HoneycombAPI } from "./api/client.js";
import process from "node:process";
import { registerResources } from "./resources/index.js";
import { registerTools } from "./tools/index.js";
import { registerPrompts } from "./prompts/index.js";
import { initializeCache } from "./cache/index.js";

function checkNodeVersion() {
  const requiredMajorVersion = 18;
  const nodeVersion: string = process.versions.node;
  if (!nodeVersion) {
    console.error(`Error: Unable to determine Node.js version. Node.js version ${requiredMajorVersion} or higher is required.`);
    process.exit(1);
  }

  const majorVersion = nodeVersion.split('.')[0];
  if (!majorVersion) {
    console.error(`Error: Unable to determine Node.js major version. Node.js version ${requiredMajorVersion} or higher is required.`);
    process.exit(1);
  }

  const currentMajorVersion = parseInt(majorVersion, 10);
  if (isNaN(currentMajorVersion)) {
    console.error(`Error: Unable to parse Node.js major version. Node.js version ${requiredMajorVersion} or higher is required.`);
    process.exit(1);
  }

  if (currentMajorVersion < requiredMajorVersion) {
    console.error(
      `Error: Node.js version ${requiredMajorVersion} or higher is required. Current version: ${nodeVersion}`
    );
    process.exit(1);
  }
}

/**
 * Main function to run the Honeycomb MCP server
 */
async function main() {
  try {
    checkNodeVersion();
    // Load config asynchronously and create API client
    console.error("Loading configuration from environment variables...");
    const config = await loadConfig();
    console.error(`Loaded ${config.environments.length} environment(s): ${config.environments.map(e => e.name).join(', ')}`);
    
    // Initialize the cache
    console.error("Initializing cache...");
    const cacheManager = initializeCache(config);
    console.error(`Cache initialized (enabled: ${config.cache.enabled})`);
    
    const api = new HoneycombAPI(config);

    // Create server with proper initialization options and capabilities
    const server = new McpServer({
      name: "honeycomb",
      version: "1.0.0",
      capabilities: {
        prompts: {} // Register prompts capability
      }
    });

    // Add a small delay to ensure the server is fully initialized before registering tools
    console.error("Initializing MCP server...");
    await new Promise(resolve => setTimeout(resolve, 500));

    // Register resources, tools, and prompts
    console.error("Registering resources, tools, and prompts...");
    registerResources(server, api);
    registerTools(server, api);
    registerPrompts(server);

    // Wait for registration to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    console.error("All resources, tools, and prompts registered");

    // Create transport and start server
    const transport = new StdioServerTransport();
    
    // Add reconnect logic to handle connection issues
    let connected = false;
    const maxRetries = 3;
    let retries = 0;
    
    while (!connected && retries < maxRetries) {
      try {
        await server.connect(transport);
        connected = true;
        console.error("Honeycomb MCP Server running on stdio");
      } catch (error) {
        retries++;
        console.error(`Connection attempt ${retries} failed: ${error instanceof Error ? error.message : String(error)}`);
        
        if (retries < maxRetries) {
          console.error(`Retrying in 1 second...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.error(`Max retries (${maxRetries}) reached. Server may be unstable.`);
          // Continue anyway, but warn about potential issues
          console.error("Honeycomb MCP Server running with potential connection issues");
          break;
        }
      }
    }
  } catch (error) {
    console.error("Failed to start MCP server:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run main with proper error handling
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
  });
}
