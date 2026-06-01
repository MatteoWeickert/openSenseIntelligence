import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSearchBoxes } from "./tools/search-boxes";
import { registerGetBoxInfo } from "./tools/get-box-info";
import { registerGetSensorData } from "./tools/get-sensor-data";
import { registerGetPlatformStats } from "./tools/get-platform-stats";
import { registerOpensensemapApi } from "./tools/opensensemap-api";
import { registerExportData } from "./tools/export-data";

/**
 * Creates and configures the MCP server with all available tools.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "openSenseIntelligence",
    version: "1.0.0",
  });

  // Layer 1: Dedicated smart tools (optimized output for LLMs)
  registerSearchBoxes(server);
  registerGetBoxInfo(server);
  registerGetSensorData(server);
  registerGetPlatformStats(server);

  // Layer 2: Generic API fallback
  registerOpensensemapApi(server);

  // Layer 3: Data export (file downloads)
  registerExportData(server);

  return server;
}
