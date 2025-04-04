import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getInstrumentationGuidance } from "./guidance.js";

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
 * Handler for the instrumentation-guidance prompt
 */
async function handleInstrumentationGuidance(args?: Record<string, any>) {
  try {
    const guidance = getInstrumentationGuidance();
    
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

/**
 * Register prompt capabilities with the MCP server
 * 
 * @param server - The MCP server instance
 */
export function registerPrompts(server: McpServer) {
  try {
    // Cast server to any to access internal structure
    const serverAny = server as any;
    
    let registered = false;
    
    // Approach 1: Use server.prompt if available (direct SDK method)
    if (typeof serverAny.prompt === 'function') {
      try {
        serverAny.prompt(
          "instrumentation-guidance",
          { 
            language: z.string().optional(),
            filepath: z.string().optional()
          },
          handleInstrumentationGuidance
        );
        console.error("Registered prompts using server.prompt API");
        registered = true;
      } catch (error) {
        console.error("Error using server.prompt API:", error instanceof Error ? error.message : String(error));
      }
    }
    
    // Approach 2: Try server.server.setRequestHandler (works in tests)
    if (!registered && serverAny.server && typeof serverAny.server.setRequestHandler === 'function') {
      try {
        // Register prompts/list handler
        serverAny.server.setRequestHandler(
          { method: 'prompts/list' },
          async () => ({ prompts: PROMPTS })
        );
        
        // Register prompts/get handler
        serverAny.server.setRequestHandler(
          { method: 'prompts/get' },
          async (request: { params: { name: string; arguments?: Record<string, any> } }) => {
            const { name, arguments: promptArgs } = request.params;
            
            if (name !== 'instrumentation-guidance') {
              throw new Error(`Prompt not found: ${name}`);
            }
            
            return handleInstrumentationGuidance(promptArgs);
          }
        );
        
        console.error("Registered prompts using server.server.setRequestHandler API");
        registered = true;
      } catch (error) {
        console.error("Error using server.server.setRequestHandler API:", error instanceof Error ? error.message : String(error));
      }
    }
    
    // Approach 3: Add to internal registries directly if available
    if (!registered && serverAny._registeredPrompts && Array.isArray(serverAny._registeredPrompts)) {
      try {
        // Add each prompt definition to the registry
        PROMPTS.forEach(prompt => {
          if (!serverAny._registeredPrompts.some((p: any) => p.name === prompt.name)) {
            serverAny._registeredPrompts.push(prompt);
          }
        });
        
        // Add handler mappings if possible
        if (serverAny._promptHandlers && typeof serverAny._promptHandlers === 'object') {
          serverAny._promptHandlers["instrumentation-guidance"] = handleInstrumentationGuidance;
        }
        
        console.error("Registered prompts by adding to internal registries");
        registered = true;
      } catch (error) {
        console.error("Error adding to internal registries:", error instanceof Error ? error.message : String(error));
      }
    }
    
    if (!registered) {
      console.error("Could not register prompts: no compatible registration method found");
    }
  } catch (error) {
    // Log the error but don't let it crash the server
    console.error("Error in registerPrompts:", error instanceof Error ? error.message : String(error));
  }
}
