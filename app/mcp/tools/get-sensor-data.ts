import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { osemFetch } from "../lib/api-client";
import {
  type MeasurementPoint,
  summarizeMeasurements,
  downsample,
} from "../lib/summarize";

export function registerGetSensorData(server: McpServer) {
  server.registerTool(
    "get_sensor_data",
    {
      description:
        "Get measurement data from a specific sensor of a senseBox station. Returns a time series with automatic downsampling and statistical summary (min, max, mean, trend). Use get_box_info first to find sensor IDs.",
      inputSchema: {
        boxId: z.string().describe("The senseBox station ID"),
        sensorId: z.string().describe("The sensor ID"),
        fromDate: z
          .string()
          .optional()
          .describe(
            "Start date in RFC3339 format (default: 48h ago), e.g. '2026-05-30T00:00:00Z'"
          ),
        toDate: z
          .string()
          .optional()
          .describe(
            "End date in RFC3339 format (default: now), e.g. '2026-06-01T12:00:00Z'"
          ),
        limit: z
          .number()
          .optional()
          .default(100)
          .describe(
            "Max data points to return (default: 100). Data is downsampled if more points exist."
          ),
      },
    },
    async ({ boxId, sensorId, fromDate, toDate, limit }) => {
      const params: Record<string, string | number | boolean | undefined> = {};
      if (fromDate) params["from-date"] = fromDate;
      if (toDate) params["to-date"] = toDate;

      const rawData = await osemFetch<MeasurementPoint[]>({
        path: `/boxes/${boxId}/data/${sensorId}`,
        params,
        timeout: 30000,
      });

      if (rawData.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No measurements found for this sensor in the specified time range.",
            },
          ],
        };
      }

      const summary = summarizeMeasurements(rawData);
      const maxPoints = Math.min(limit ?? 100, 200);
      const sampled = downsample(rawData, maxPoints);

      const dataLines = sampled.map(
        (d) => `  ${d.time}: ${d.value}`
      );

      const text = [
        `**Sensor Data Summary** (${summary.count} total measurements)`,
        `Period: ${summary.firstTimestamp} → ${summary.lastTimestamp}`,
        `Min: ${summary.min} | Max: ${summary.max} | Mean: ${summary.mean} | StdDev: ${summary.stddev}`,
        `Trend: ${summary.trend}`,
        ``,
        `Data (${sampled.length} points${sampled.length < rawData.length ? `, downsampled from ${rawData.length}` : ""}):`,
        ...dataLines,
      ].join("\n");

      return { content: [{ type: "text" as const, text }] };
    }
  );
}
