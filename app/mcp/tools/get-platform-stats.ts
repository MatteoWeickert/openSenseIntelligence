import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { osemFetch } from "../lib/api-client";

export function registerGetPlatformStats(server: McpServer) {
  server.registerTool(
    "get_platform_stats",
    {
      description:
        "Get an overview of the openSenseMap platform: total number of stations, total measurements, and measurements per minute. Use this to answer general questions about the platform's scale and activity. E.g. [\"318\", \"118\", \"393\"] => 318 stations, 118M measurements, 393 measurements/minute",
    },
    async () => {
      const stats = await osemFetch<number[]>({ path: "/stats" });

      const [boxes, measurements, measurementsPerMinute] = stats;

      const text = [
        `**openSenseMap Platform Statistics**`,
        ``,
        `Stations: ${boxes?.toLocaleString() ?? "unknown"}`,
        `Total measurements: ${measurements?.toLocaleString() ?? "unknown"}`,
        `Measurements/minute: ${measurementsPerMinute?.toLocaleString() ?? "unknown"}`,
      ].join("\n");

      return { content: [{ type: "text" as const, text }] };
    }
  );
}
