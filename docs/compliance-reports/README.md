# MCP Compliance Reports

This directory contains the Model Context Protocol (MCP) compliance test reports for the Honeycomb MCP implementation.

## Reports

- [`latest.md`](./latest.md) - The most recent compliance test results
- Historical reports are available in the GitHub Actions artifacts

## Understanding the Reports

The compliance reports include:
- Protocol version being tested
- Overall compliance rate
- Detailed test results
- Failed test cases with error messages
- Test execution timestamps

## Automated Updates

These reports are automatically generated and updated by the GitHub Actions workflow whenever:
1. A pull request is created/updated
2. Changes are pushed to the main branch
3. The workflow is manually triggered

For historical reports, check the "Artifacts" section of the [GitHub Actions runs](../../actions/workflows/mcp-compliance.yml).

## Current Status

![MCP Compliance](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/janix-ai/honeycomb-mcp/main/.github/mcp-compliance/badges/compliance.json) 