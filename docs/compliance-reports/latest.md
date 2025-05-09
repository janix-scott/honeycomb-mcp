# Index.Mjs MCP Compliance Report

## Server Information

- **Server Command**: `node build/index.mjs`
- **Protocol Version**: 2025-03-26
- **Test Date**: 2025-05-08 18:22:09

## Summary

- **Total Tests**: 36
- **Passed**: 24 (66.7%)
- **Failed**: 12 (33.3%)

**Compliance Status**: ❌ Non-Compliant (66.7%)

## Detailed Results

### Passed Tests

| Test | Duration | Message |
|------|----------|---------|
| Initialization | 1.06s | Initialization successful |
| Server Capabilities | 1.09s | Server supports all required capabilities for 2025-03-26 |
| Async Echo Tool | 1.10s | Echo tool not available (skipping test) |
| Async Long Running Tool | 1.09s | Sleep tool not available (skipping test) |
| Async Tool Cancellation | 1.08s | Sleep tool not available (skipping test) |
| Request Format | 1.08s | Server accepts properly formatted JSON-RPC requests |
| Response Format | 1.09s | Server returns properly formatted JSON-RPC responses |
| Notification Format | 1.08s | Server accepts properly formatted JSON-RPC notifications |
| Http Transport Requirements | 1.09s | Not using HTTP transport, test skipped |
| Initialization Negotiation | 1.09s | Server correctly negotiated protocol version '2024-11-05' |
| Capability Declaration | 1.08s | Server correctly declared capabilities: resources, tools, prompts |
| Logging Capability | 1.09s | Server does not advertise logging capability |
| Authorization Requirements | 1.08s | Not using HTTP transport, authorization test skipped |
| Workspace Configuration | 1.08s | Server does not advertise workspace configuration capability |
| Resources Capability | 1.10s | Server correctly implements empty resources list |
| Resource Uri Validation | 1.08s | Server correctly implements empty resources list (can't test URI validation) |
| Async Tools Capability | 1.08s | Server does not advertise async tools capability |
| Async Tool Calls Validation | 1.09s | Server does not advertise async tools capability |
| Async Cancellation | 1.09s | Server does not advertise async tools capability |
| Tools List | 1.08s | Successfully retrieved 14 tools |
| Tool Functionality | 1.09s | Successfully tested tool: list_datasets |
| Tool With Invalid Params | 1.10s | Server correctly validates tool parameters |
| Tools Capability | 1.09s | Server correctly implements tools capability |
| Tool Schema Validation | 1.09s | Server correctly validates tool parameters against schema for tool 'list_datasets' |

### Failed Tests

| Test | Duration | Error Message |
|------|----------|--------------|
| Jsonrpc Batch Support | 6.11s | Batch request failed: Failed to send batch request: No response received from server within 5.0 seconds |
| Async Tool Support | 1.08s | Server does not advertise async tool support in capabilities |
| Unique Request Ids | 1.08s | First server/info request failed: Method not found |
| Error Handling | 1.07s | Server not responsive after error tests |
| Jsonrpc Batch Support | 6.13s | Batch request failed: Failed to send batch request: No response received from server within 5.0 seconds |
| Stdio Transport Requirements | 1.08s | Valid message with proper newline delimiter failed: Method not found |
| Versioning Requirements | 1.09s | Failed to get server info for version check |
| Server Info Requirements | 1.08s | Server/info request failed: Method not found |
| Initialization Order | 1.09s | Server didn't properly accept request after initialization: Method not found |
| Prompts Capability | 1.09s | Failed to test prompts capability: object dict can't be used in 'await' expression |
| Prompt Arguments Validation | 1.09s | Failed to test prompt arguments validation: object dict can't be used in 'await' expression |
| Cancellation Validation | 1.09s | Server failed to respond after cancellation tests |