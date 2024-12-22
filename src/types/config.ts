export interface HoneycombEnvironment {
  name: string;
  apiKey: string;
  baseUrl?: string;
}

export interface HoneycombConfig {
  environments: HoneycombEnvironment[];
}
