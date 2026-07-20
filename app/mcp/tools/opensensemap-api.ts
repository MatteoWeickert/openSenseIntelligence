import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { osemFetch, getBaseUrl } from "../lib/api-client";

/**
 * Fetches the available API routes from the root endpoint and caches them.
 */
let cachedEndpointDocs: string | null = null;

async function getEndpointDocs(): Promise<string> {
  if (cachedEndpointDocs) return cachedEndpointDocs;

  try {
    const baseUrl = getBaseUrl();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(baseUrl, { signal: controller.signal });
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("json")) {
        const json = await res.json();
        cachedEndpointDocs = JSON.stringify(json, null, 2);
      } else {
        cachedEndpointDocs = await res.text();
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    cachedEndpointDocs = "(Could not fetch endpoint list from API root)";
  }
  return cachedEndpointDocs;
}

const STATIC_DESCRIPTION = `Generic tool to call any openSenseMap staging API endpoint directly. Use this as a fallback when the dedicated tools (search_boxes, get_box_info, get_sensor_data, get_platform_stats) don't cover your needs. Note: This queries the staging instance only.

Key public endpoints:
GET /boxes — List/search stations. Params: name, near (lat,lng), maxDistance, bbox (lonSW,latSW,lonNE,latNE), exposure, grouptag, model, limit, minimal
GET /boxes/:id — Get single station with sensors and last measurements
GET /boxes/:id/sensors — Get latest measurements of all sensors (with optional count param, 1-100)
GET /boxes/:id/sensors/:sensorId — Get latest measurement of a single sensor
GET /boxes/:id/data/:sensorId — Get up to 10000 measurements. Params: from-date, to-date, format (json/csv), outliers (mark/replace), outlier-window (1-50)
GET /boxes/:id/locations — Location history. Params: from-date, to-date, format (json/geojson)
GET /boxes/data — Stream measurements across devices and sensors. Params: boxId, phenomenon, from-date, to-date, bbox, exposure, format, delimiter, separator
GET /stats — Platform statistics [boxCount, measurementCount, measurementsPerMinute]
GET /tags — List known device tags

Use path "/" to see all available routes dynamically.`;

export function registerOpensensemapApi(server: McpServer) {
  server.registerTool(
    "opensensemap_api",
    {
      description: STATIC_DESCRIPTION,
      inputSchema: {
        path: z
          .string()
          .describe(
            "API path with path parameters substituted, e.g. '/boxes/abc123/data/sensor456'. Use '/' to list all available routes."
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
    },
    async ({ path, params, method }) => {
      // If requesting root, return cached endpoint docs
      if (path === "/") {
        const docs = await getEndpointDocs();
        return {
          content: [
            {
              type: "text" as const,
              text: `API Routes (${getBaseUrl()}):\n\n${docs}`,
            },
          ],
        };
      }

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
