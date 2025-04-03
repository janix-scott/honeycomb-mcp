import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Get the directory name to help resolve paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsPath = path.resolve(__dirname, "../../docs");

/**
 * Available prompts with their metadata and arguments
 */
const PROMPTS = [
  {
    name: "instrumentation-guidance",
    description: "OpenTelemetry Instrumentation guidance optimized for Honeycomb",
    arguments: [
      {
        name: "language",
        description: "Programming language of the code to instrument",
        required: false
      },
      {
        name: "filepath",
        description: "Path to the file being instrumented",
        required: false
      }
    ]
  }
];

/**
 * Prompt handler function type
 */
type PromptHandler = {
  name: string;
  handler: (args?: Record<string, any>) => Promise<{
    messages: Array<{
      role: string;
      content: {
        type: string;
        text: string;
      };
    }>;
  }>;
};

/**
 * Collection of prompt handlers
 */
const promptHandlers: PromptHandler[] = [
  {
    name: "instrumentation-guidance",
    handler: async (args) => {
      try {
        const guidance = fs.readFileSync(
          path.join(docsPath, "generic-instrumentation-guidance.md"),
          'utf8'
        );

        const language = args?.language || "your code";
        const filepath = args?.filepath
          ? ` for ${args.filepath}`
          : "";

        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `I need help instrumenting ${language}${filepath} with OpenTelemetry for Honeycomb. Please provide specific recommendations following these guidelines:\n\n${guidance}`
              }
            }
          ]
        };
      } catch (error) {
        throw new Error(`Failed to read instrumentation guidance: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
];

/**
 * Register prompt capabilities with the MCP server
 * 
 * @param server - The MCP server instance
 */
export function registerPrompts(server: McpServer) {
  try {
    // Access the internal structure to register prompts
    const serverAny = server as any;

    // Add prompts to the server's internal registry
    if (serverAny._registeredPrompts && Array.isArray(serverAny._registeredPrompts)) {
      // Add each prompt definition to the registry
      PROMPTS.forEach(prompt => {
        if (!serverAny._registeredPrompts.some((p: any) => p.name === prompt.name)) {
          serverAny._registeredPrompts.push(prompt);
        }
      });

      // Add handler mappings if possible
      if (serverAny._promptHandlers && typeof serverAny._promptHandlers === 'object') {
        promptHandlers.forEach(handler => {
          serverAny._promptHandlers[handler.name] = handler.handler;
        });
      }

      console.error("Registered prompts in internal registry");
    } else {
      console.error("Prompts capability not available in current SDK version");
    }
  } catch (error) {
    // Log the error but don't let it crash the server
    console.log("Error registering prompts:", error instanceof Error ? error.message : String(error));
  }
}
