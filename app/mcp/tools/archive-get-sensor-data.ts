import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  fetchBoxMetaWithFallback,
  fetchSensorCsvWithFallback,
  getDateRange,
  type ArchiveMeasurement,
} from "../lib/archive-client";
import { downsample, summarizeMeasurements } from "../lib/summarize";
import { createExport } from "../lib/exports";

export function registerArchiveGetSensorData(server: McpServer) {
  server.registerTool(
    "archive_get_sensor_data",
    {
      description:
        "Get detailed time series data for a specific sensor from the openSenseMap archive. " +
        "Returns measurements with automatic downsampling and statistical summary. " +
        "IMPORTANT: Always use search_boxes first to discover boxes on the staging instance, then use get_box_info or archive_get_box_data to find sensor IDs. " +
        "Only boxes registered on the staging platform should be queried. " +
        "The archive contains ALL historical data since 2014.",
      inputSchema: {
        boxId: z.string().describe("The senseBox station ID"),
        boxName: z
          .string()
          .describe("The senseBox station name (needed for archive URL construction)"),
        sensorId: z
          .string()
          .describe("The sensor ID to fetch data for"),
        fromDate: z
          .string()
          .describe("Start date in YYYY-MM-DD format, e.g. '2020-06-01'"),
        toDate: z
          .string()
          .describe("End date in YYYY-MM-DD format, e.g. '2020-06-30'"),
        limit: z
          .number()
          .optional()
          .default(5000)
          .describe(
            "Max data points to return (default: 5000). Data is downsampled if more points exist."
          ),
        exportFormat: z
          .enum(["json", "csv"])
          .optional()
          .describe(
            "If set, creates a downloadable file with ALL measurements (no downsampling). Returns a download URL valid for 1 hour."
          ),
      },
    },
    async ({ boxId, boxName, sensorId, fromDate, toDate, limit, exportFormat }) => {
      const dates = getDateRange(fromDate, toDate);

      if (dates.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Invalid date range: fromDate must be before or equal to toDate.",
            },
          ],
        };
      }

      if (dates.length > 365 && !exportFormat) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Date range too large for inline display. Maximum is 365 days without export. Set exportFormat to 'csv' or 'json' to download larger ranges (up to 10 years).",
            },
          ],
        };
      }

      if (dates.length > 3650) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Date range too large. Maximum supported range is 3650 days (10 years) per request.",
            },
          ],
        };
      }

      // Fetch metadata to get sensor info
      let meta = null;
      for (const date of dates.slice(0, 7)) {
        meta = await fetchBoxMetaWithFallback(boxId, boxName, date);
        if (meta) break;
      }

      const sensorInfo = meta?.sensors.find((s) => (s._id ?? s.id) === sensorId);

      // Fetch CSV data for all dates
      const allMeasurements: ArchiveMeasurement[] = [];
      let daysWithData = 0;
      let daysMissing = 0;
      const concurrency = 10;

      for (let i = 0; i < dates.length; i += concurrency) {
        const batch = dates.slice(i, i + concurrency);
        const results = await Promise.allSettled(
          batch.map((date) =>
            fetchSensorCsvWithFallback(boxId, boxName, sensorId, date)
          )
        );

        for (const result of results) {
          if (result.status === "fulfilled" && result.value) {
            allMeasurements.push(...result.value);
            daysWithData++;
          } else {
            daysMissing++;
          }
        }
      }

      if (allMeasurements.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                `No archive measurements found for sensor ${sensorId} ` +
                `of box "${boxName}" (${boxId}) from ${fromDate} to ${toDate}. ` +
                `The sensor CSV files may not exist for this period.`,
            },
          ],
        };
      }

      // Convert to MeasurementPoint format for summarize/downsample
      const measurementPoints = allMeasurements.map((m) => ({
        sensor_id: sensorId,
        time: m.createdAt,
        value: parseFloat(m.value),
        location_id: null,
      }));

      const sensorLabel = sensorInfo
        ? `${sensorInfo.title} [${sensorInfo.sensorType}] (${sensorInfo.unit})`
        : `Sensor ${sensorId}`;

      const summary = summarizeMeasurements(measurementPoints);

      // If export requested, create downloadable file with ALL data
      if (exportFormat) {
        const exportData = allMeasurements.map((m) => ({
          timestamp: m.createdAt,
          value: m.value,
          sensor_id: sensorId,
          box_id: boxId,
        }));

        const filenameHint = `archive-${boxId}-${sensorId}-${fromDate}-to-${toDate}`;
        const result = await createExport(exportData, exportFormat, filenameHint);

        const text = [
          `**Archive Data Export Complete**`,
          ``,
          `Sensor: ${sensorLabel}`,
          `Box: ${meta?.name ?? boxName} (${boxId})`,
          `Period: ${fromDate} → ${toDate} (${daysWithData} days with data, ${daysMissing} days missing)`,
          `Records: ${result.records.toLocaleString()}`,
          `Format: ${exportFormat.toUpperCase()}`,
          ``,
          `**Statistics:**`,
          `Min: ${summary.min} | Max: ${summary.max} | Mean: ${summary.mean} | StdDev: ${summary.stddev}`,
          ``,
          `**Download URL:** ${result.url}`,
          `(Valid for 1 hour)`,
        ].join("\n");

        return { content: [{ type: "text" as const, text }] };
      }

      const maxPoints = Math.min(limit ?? 200, 500);
      const sampled = downsample(measurementPoints, maxPoints);

      const dataLines = sampled.map((d) => `  ${d.time}: ${d.value}`);

      const text = [
        `**Archive Sensor Data: ${sensorLabel}**`,
        `Box: ${meta?.name ?? boxName} (${boxId})`,
        `Period: ${fromDate} → ${toDate} (${daysWithData} days with data, ${daysMissing} days missing)`,
        ``,
        `**Statistics** (${summary.count} total measurements):`,
        `Min: ${summary.min} | Max: ${summary.max} | Mean: ${summary.mean} | StdDev: ${summary.stddev}`,
        `Trend: ${summary.trend}`,
        ``,
        `**Data** (${sampled.length} points${sampled.length < allMeasurements.length ? `, downsampled from ${allMeasurements.length}` : ""}):`,
        ...dataLines,
      ].join("\n");

      return { content: [{ type: "text" as const, text }] };
    }
  );
}
