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

/** Haversine distance in meters between two lat/lng points */
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function searchBoxes(server: McpServer) {
  server.registerTool(
    "search_boxes",
    {
      description:
        "Search for senseBox stations on the openSenseMap staging instance. This is the primary tool to discover available boxes. " +
        "Find stations by name, location (near/bbox), exposure type, or grouptag. Returns a compact list of matching stations with ID, name, location, and exposure. " +
        "When using 'near', results are sorted by distance and filtered by maxDistance. " +
        "Use the returned box IDs with get_box_info or the archive tools to get detailed/historical data.",
      inputSchema: {
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
          .default(100000)
          .describe(
            "Max distance in meters for 'near' search (default: 100000). Boxes further away are excluded from results."
          ),
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
    },
    async (params) => {
      // Always fetch max 20 boxes (API hard limit)
      const queryParams: Record<string, string | number | boolean | undefined> =
        {
          minimal: true,
          limit: 20,
        };

      if (params.name) queryParams.name = params.name;
      if (params.near) {
        queryParams.near = params.near;
        queryParams.maxDistance = params.maxDistance ?? 10000;
      }
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

      // If near is provided: calculate distances, sort, and filter
      if (params.near) {
        const [lat, lng] = params.near.split(",").map(Number);
        const maxDist = params.maxDistance ?? 10000;
        const userLimit = Math.min(params.limit ?? 20, 20);

        const withDistance = boxes.map((box) => ({
          ...box,
          distance: haversineMeters(lat, lng, box.latitude, box.longitude),
        }));

        // Sort by distance ascending
        withDistance.sort((a, b) => a.distance - b.distance);

        // Filter by maxDistance and apply user limit
        const filtered = withDistance
          .filter((box) => box.distance <= maxDist)
          .slice(0, userLimit);

        if (filtered.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No stations found within ${formatDistance(maxDist)} of [${lat}, ${lng}]. The closest station is "${withDistance[0].name}" at ${formatDistance(withDistance[0].distance)}.`,
              },
            ],
          };
        }

        const lines = filtered.map(
          (box) =>
            `• ${box.name} (${box.id}) — ${box.exposure}, [${box.latitude}, ${box.longitude}], ${formatDistance(box.distance)} away`
        );

        const text = `Found ${filtered.length} station(s) within ${formatDistance(maxDist)} of [${lat}, ${lng}]:\n\n${lines.join("\n")}`;
        return { content: [{ type: "text" as const, text }] };
      }

      // No near parameter: return as-is with user limit
      const userLimit = Math.min(params.limit ?? 20, 20);
      const limited = boxes.slice(0, userLimit);

      const lines = limited.map(
        (box) =>
          `• ${box.name} (${box.id}) — ${box.exposure}, [${box.latitude}, ${box.longitude}]`
      );

      const text = `Found ${limited.length} station(s):\n\n${lines.join("\n")}`;
      return { content: [{ type: "text" as const, text }] };
    }
  );
}
