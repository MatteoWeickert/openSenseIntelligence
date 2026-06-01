import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { osemFetch, getBaseUrl } from "../lib/api-client";

const ENDPOINT_DOCS = `Available openSenseMap API endpoints:

GET /boxes — List/search stations. Params: name, near (lat,lng), maxDistance, bbox (lonSW,latSW,lonNE,latNE), exposure, grouptag, model, limit (max 20), minimal (true/false)
GET /boxes/:id — Get single station with sensors and last measurements
GET /boxes/:id/sensors — Get latest measurements of all sensors (with optional count param, 1-100)
GET /boxes/:id/data/:sensorId — Get up to 10000 measurements. Params: from-date, to-date, format (json/csv), outliers (mark/replace), outlier-window (1-50)
GET /boxes/:id/locations — Location history. Params: from-date, to-date, format (json/geojson)
GET /stats — Platform statistics [boxCount, measurementCount, measurementsPerMinute]
GET /statistics/descriptive — Aggregated statistics. Params: boxId, phenomenon, from-date, to-date, operation (arithmeticMean/max/min/median/standardDeviation), window (ms), format (json/csv), bbox, exposure`;

export function registerOpensensemapApi(server: McpServer) {
  server.tool(
    "opensensemap_api",
    `Generic tool to call any openSenseMap API endpoint directly. Use this as a fallback when the dedicated tools (search_boxes, get_box_info, get_sensor_data, get_platform_stats) don't cover your needs.\n\n${ENDPOINT_DOCS}`,
    {
      path: z
        .string()
        .describe(
          "API path with path parameters substituted, e.g. '/boxes/abc123/data/sensor456'"
        ),
      params: z
        .record(z.string(), z.string())
        .optional()
        .describe("Query parameters as key-value pairs"),
      method: z
        .enum(["GET", "POST"])
        .optional()
        .default("GET")
        .describe("HTTP method (default: GET)"),
    },
    async ({ path, params, method }) => {
      const result = await osemFetch<unknown>({
        path,
        params: params as Record<string, string> | undefined,
        method: method as "GET" | "POST",
        timeout: 20000,
      });

      // Truncate large responses
      let text = JSON.stringify(result, null, 2);
      const MAX_LENGTH = 8000;
      if (text.length > MAX_LENGTH) {
        const items = Array.isArray(result) ? result.length : null;
        text = text.slice(0, MAX_LENGTH);
        text += `\n\n... [TRUNCATED — response too large${items ? ` (${items} items total)` : ""}. Use dedicated tools or export_data for full results.]`;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `API ${method ?? "GET"} ${getBaseUrl()}${path}\n\n${text}`,
          },
        ],
      };
    }
  );
}
