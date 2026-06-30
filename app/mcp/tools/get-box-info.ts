import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { osemFetch } from "../lib/api-client";

interface Sensor {
  _id: string;
  title: string;
  unit: string;
  sensorType: string;
  lastMeasurement: { value: string; createdAt: string } | null;
}

interface BoxDetails {
  _id: string;
  name: string;
  description: string | null;
  grouptag: string[];
  exposure: string;
  model: string | null;
  latitude: number;
  longitude: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  useAuth: boolean;
  sensors: Sensor[];
}

export function registerGetBoxInfo(server: McpServer) {
  server.registerTool(
    "get_box_info",
    {
      description:
        "Get detailed information about a specific senseBox station, including all its sensors and their latest measurements. Use this after search_boxes to inspect a particular station.",
      inputSchema: {
        boxId: z.string().describe("The senseBox station ID"),
      },
    },
    async ({ boxId }) => {
      const box = await osemFetch<BoxDetails>({
        path: `/boxes/${boxId}`,
      });

      const sensors = box.sensors ?? [];
      const tags = box.grouptag ?? [];

      const sensorLines = sensors.map((s) => {
        const val = s.lastMeasurement
          ? `${s.lastMeasurement.value} ${s.unit} (${s.lastMeasurement.createdAt})`
          : "no data";
        return `  - ${s.title} [${s.sensorType}]: ${val} (ID: ${s._id})`;
      });

      const text = [
        `**${box.name}** (${box._id})`,
        `Status: ${box.status} | Exposure: ${box.exposure} | Model: ${box.model ?? "custom"}`,
        `Location: [${box.latitude}, ${box.longitude}]`,
        box.description ? `Description: ${box.description}` : null,
        tags.length > 0 ? `Tags: ${tags.join(", ")}` : null,
        `Created: ${box.createdAt}`,
        ``,
        `Sensors (${sensors.length}):`,
        ...sensorLines,
      ]
        .filter(Boolean)
        .join("\n");

      return { content: [{ type: "text" as const, text }] };
    }
  );
}
