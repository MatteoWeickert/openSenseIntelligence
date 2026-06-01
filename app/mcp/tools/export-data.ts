import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { osemFetch } from "../lib/api-client";
import { createExport } from "../lib/exports";
import type { MeasurementPoint } from "../lib/summarize";

export function registerExportData(server: McpServer) {
  server.tool(
    "export_data",
    "Export sensor measurement data as a downloadable file (JSON or CSV). Use this when users want to download data or when the dataset is too large to display inline. Returns a temporary download URL valid for 1 hour.",
    {
      boxId: z.string().describe("The senseBox station ID"),
      sensorId: z.string().describe("The sensor ID to export data from"),
      fromDate: z
        .string()
        .describe("Start date in RFC3339 format, e.g. '2026-05-01T00:00:00Z'"),
      toDate: z
        .string()
        .describe("End date in RFC3339 format, e.g. '2026-06-01T00:00:00Z'"),
      format: z
        .enum(["json", "csv"])
        .optional()
        .default("json")
        .describe("Export format: 'json' or 'csv' (default: json)"),
    },
    async ({ boxId, sensorId, fromDate, toDate, format }) => {
      const rawData = await osemFetch<MeasurementPoint[]>({
        path: `/boxes/${boxId}/data/${sensorId}`,
        params: { "from-date": fromDate, "to-date": toDate },
        timeout: 60000,
      });

      if (rawData.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No measurements found for the specified time range. Nothing to export.",
            },
          ],
        };
      }

      // Prepare data for export
      const exportData = rawData.map((d) => ({
        timestamp: d.time,
        value: d.value,
        sensor_id: d.sensor_id,
        location_id: d.location_id,
      }));

      const filenameHint = `${boxId}-${sensorId}`;
      const result = await createExport(exportData, format ?? "json", filenameHint);

      const text = [
        `**Data Export Complete**`,
        ``,
        `Records: ${result.records.toLocaleString()}`,
        `Format: ${format?.toUpperCase() ?? "JSON"}`,
        `Period: ${fromDate} → ${toDate}`,
        ``,
        `Download URL: ${result.url}`,
        `(Valid for 1 hour)`,
      ].join("\n");

      return { content: [{ type: "text" as const, text }] };
    }
  );
}
