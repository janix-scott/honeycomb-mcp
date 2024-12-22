# Honeycomb MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server for interacting with Honeycomb observability data. This server enables LLMs like Claude to directly analyze and query your Honeycomb datasets.

## Features

- Query Honeycomb datasets
- Analyze columns and data patterns
- Run basic analytics queries
- Access dataset metadata and schema information

## Installation

```bash
npm install
npm run build
```

## Configuration

Create a configuration file at `~/.hny/config.json` with your Honeycomb API key:

```json
{
  "apiKey": "your_honeycomb_api_key_here"
}
```

## Usage

### With Claude Desktop

Add this to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "honeycomb": {
      "command": "node",
      "args": ["/path/to/build/index.js"]
    }
  }
}
```

### Available Tools

- `get-columns`: List all columns in a dataset
- `run-query`: Run basic analytics queries with aggregations
- `analyze-column`: Get detailed analysis of specific columns

### Resources

The server exposes Honeycomb datasets as resources with the URI format:
`honeycomb://{dataset-slug}`

## Development

```bash
npm install
npm run build
```

## Requirements

- Node.js 16+
- A Honeycomb API key with query permissions

## License

MIT
