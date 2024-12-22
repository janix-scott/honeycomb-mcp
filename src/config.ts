import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { HoneycombConfig } from "./types/config.js";
import { z } from "zod";

const ConfigSchema = z.object({
  environments: z.array(
    z.object({
      name: z.string(),
      apiKey: z.string(),
      baseUrl: z.string().optional(),
    }),
  ),
});

export function loadConfig(): HoneycombConfig {
  try {
    const configPath = join(homedir(), ".hny", "config.json");
    const configFile = readFileSync(configPath, "utf-8");
    const config = JSON.parse(configFile);

    // Validate config against schema
    const validatedConfig = ConfigSchema.parse(config);

    if (validatedConfig.environments.length === 0) {
      throw new Error("No environments configured");
    }

    // Check for duplicate environment names
    const names = new Set<string>();
    for (const env of validatedConfig.environments) {
      if (names.has(env.name)) {
        throw new Error(`Duplicate environment name: ${env.name}`);
      }
      names.add(env.name);
    }

    return validatedConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        "Invalid config format in ~/.hny/config.json: " +
          error.errors
            .map((e) => `${e.path.join(".")}: ${e.message}`)
            .join(", "),
      );
    }

    throw new Error(
      "Could not load config from ~/.hny/config.json. " +
        "Please create this file with your Honeycomb environments: " +
        '{"environments": [{"name": "env-name", "apiKey": "your_key_here"}]}',
    );
  }
}
