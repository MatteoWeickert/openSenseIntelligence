import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { osemFetch } from "../lib/api-client";

interface BoxMinimal {
  id: string;
  name: string;
  exposure: string;
  model: string | null;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
}

export function registerSearchBoxes(server: McpServer) {
  server.tool(
    "search_boxes",
    "Search for senseBox stations on openSenseMap. Find stations by name, location (near/bbox), exposure type, or grouptag. Returns a compact list of matching stations with ID, name, location, and exposure.",
    {
      name: z
        .string()
        .optional()
        .describe("Search by station name (partial match)"),
      near: z
        .string()
        .optional()
        .describe(
          "Comma-separated lat,lng for proximity search, e.g. '51.96,7.63'"
        ),
      maxDistance: z
        .number()
        .optional()
        .default(10000)
        .describe("Max distance in meters for 'near' search (default: 10000)"),
      bbox: z
        .string()
        .optional()
        .describe(
          "Bounding box as 'lonSW,latSW,lonNE,latNE', e.g. '7.5,51.8,7.8,52.1'"
        ),
      exposure: z
        .enum(["indoor", "outdoor", "mobile", "unknown"])
        .optional()
        .describe("Filter by exposure type"),
      grouptag: z.string().optional().describe("Filter by group tag"),
      limit: z
        .number()
        .optional()
        .default(20)
        .describe("Max results to return (default: 20, max: 20)"),
    },
    async (params) => {
      const queryParams: Record<string, string | number | boolean | undefined> =
        {
          minimal: true,
          limit: Math.min(params.limit ?? 20, 20),
        };

      if (params.name) queryParams.name = params.name;
      if (params.near) queryParams.near = params.near;
      if (params.near && params.maxDistance)
        queryParams.maxDistance = params.maxDistance;
      if (params.bbox) queryParams.bbox = params.bbox;
      if (params.exposure) queryParams.exposure = params.exposure;
      if (params.grouptag) queryParams.grouptag = params.grouptag;

      const boxes = await osemFetch<BoxMinimal[]>({
        path: "/boxes",
        params: queryParams,
      });

      if (boxes.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No stations found matching your criteria.",
            },
          ],
        };
      }

      const lines = boxes.map(
        (box) =>
          `• ${box.name} (${box.id}) — ${box.exposure}, [${box.latitude}, ${box.longitude}]`
      );

      const text = `Found ${boxes.length} station(s):\n\n${lines.join("\n")}`;

      return { content: [{ type: "text" as const, text }] };
    }
  );
}
