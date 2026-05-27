import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Creates and configures the MCP server with all available tools.
 * Add your tool definitions here.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "openSenseIntelligence",
    version: "1.0.0",
  });

  // TODO: Define tools here, e.g.:
  // server.tool("search_devices", { query: z.string() }, async ({ query }) => { ... });

  return server;
}
