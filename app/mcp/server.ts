import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchBoxes } from "./tools/search-boxes";
import { registerGetBoxInfo } from "./tools/get-box-info";
import { registerGetSensorData } from "./tools/get-sensor-data";
import { registerGetPlatformStats } from "./tools/get-platform-stats";
import { registerOpensensemapApi } from "./tools/opensensemap-api";
import { registerExportData } from "./tools/export-data";
import { registerArchiveGetBoxData } from "./tools/archive-get-box-data";
import { registerArchiveGetSensorData } from "./tools/archive-get-sensor-data";

/**
 * Creates and configures the MCP server with all available tools.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "openSenseIntelligence",
    version: "1.0.0",
  });

  // Layer 1: Staging API tools — primary source for discovering boxes
  searchBoxes(server);
  registerGetBoxInfo(server);
  registerGetSensorData(server);
  registerGetPlatformStats(server);

  // Layer 2: Archive tools — historical data for boxes found via staging API
  registerArchiveGetBoxData(server);
  registerArchiveGetSensorData(server);

  // Layer 3: Generic staging API fallback
  registerOpensensemapApi(server);

  // Layer 4: Data export (file downloads)
  registerExportData(server);

  return server;
}
