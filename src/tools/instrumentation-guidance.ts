import { z } from "zod";
import { HoneycombAPI } from "../api/client.js";
import { handleToolError } from "../utils/tool-error.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Reuse the docs path logic from prompts/index.ts
// Helper to safely check if a path exists, handling mocked environments
function safePathExists(pathToCheck: string): boolean {
  try {
    return fs.existsSync(pathToCheck);
  } catch (error) {
    // In test environments, fs.existsSync might be undefined
    // Default to false to continue to the next approach
    return false;
  }
}

// Detect if we're in a test environment
const isTestEnvironment = typeof (fs as any).readFileSync === 'function' && 
                        (fs as any).readFileSync.mockImplementation !== undefined;

// Get the docs path with fallbacks
function getDocsPath(): string {
  // In test environment, just return a placeholder path since the fs module is mocked
  // and the actual file will be mocked too
  if (isTestEnvironment) {
    return "/mocked/path/to/docs";
  }
  
  // First try: standard path resolution relative to this file
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const docsPath = path.resolve(__dirname, "../../docs");
    
    if (safePathExists(docsPath)) {
      return docsPath;
    }
  } catch (error) {
    console.error("Failed to resolve docs path using fileURLToPath:", error);
  }
  
  // Second try: use process.cwd() as base if running in deployed environment
  const cwdDocsPath = path.resolve(process.cwd(), "docs");
  if (safePathExists(cwdDocsPath)) {
    return cwdDocsPath;
  }
  
  // Third try: hardcode the path based on the repository location
  const hardcodedPath = "/Users/pcarter/repos/honeycomb-mcp/docs";
  if (safePathExists(hardcodedPath)) {
    return hardcodedPath;
  }
  
  // Default fallback
  return path.resolve(process.cwd(), "docs");
}

const docsPath = getDocsPath();

/**
 * Schema for the instrumentation guidance tool
 */
export const InstrumentationGuidanceSchema = z.object({
  language: z.string().optional().describe("Programming language of the code to instrument"),
  filepath: z.string().optional().describe("Path to the file being instrumented")
});

/**
 * Creates a tool for providing OpenTelemetry instrumentation guidance.
 * 
 * @param api - The Honeycomb API client
 * @returns A configured tool object with name, schema, and handler
 */
export function createInstrumentationGuidanceTool(api: HoneycombAPI) {
  return {
    name: "get_instrumentation_help",
    description: "Provides OpenTelemetry instrumentation guidance for traces and logs. This tool helps developers understand how to instrument their code effectively with OpenTelemetry to send telemetry data to Honeycomb. It is intended to be used when someone wants to instrument their code, or improve instrumentation (such as getting advice on improving their logs or tracing, or creating new instrumentation). It is BEST used after inspecting existing code and telemetry data to understand some operational characteristics. However, if there is no telemetry data to read from Honeycomb, it can still provide guidance on how to instrument code.",
    schema: InstrumentationGuidanceSchema.shape,
    /**
     * Handles the instrumentation_guidance tool request
     * 
     * @param params - The parameters for the instrumentation guidance
     * @returns A formatted response with instrumentation guidance
     */
    handler: async (params: z.infer<typeof InstrumentationGuidanceSchema>) => {
      try {
        // Read the instrumentation guidance from the docs directory
        const guidance = fs.readFileSync(
          path.join(docsPath, "generic-instrumentation-guidance.md"),
          'utf8'
        );
        
        const language = params?.language || "your code";
        const filepath = params?.filepath
          ? ` for ${params.filepath}`
          : "";
          
        return {
          content: [
            {
              type: "text",
              text: `# Instrumentation Guidance for ${language}${filepath}\n\n${guidance}`,
            },
          ],
        };
      } catch (error) {
        return handleToolError(error, "get_instrumentation_help");
      }
    }
  };
}
