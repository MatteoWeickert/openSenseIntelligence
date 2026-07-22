import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  fetchBoxMetaWithFallback,
  fetchSensorCsvWithFallback,
  getArchiveCoordinates,
  getDateRange,
  type ArchiveMeasurement,
} from "../lib/archive-client";
import { createExport } from "../lib/exports";

export function registerArchiveGetBoxData(server: McpServer) {
  server.registerTool(
    "archive_get_box_data",
    {
      description:
        "Get archived measurement data for a senseBox station from the openSenseMap archive. " +
        "Use this tool ONLY if the user explicitly requests historical data for a box. " +
        "For recent data (last 2 years) use get_box_info instead. " +
        "The archive contains historical data since 2014. " +
        "IMPORTANT: Always use search_boxes or get_box_info first to find the box ID and name from the staging instance — " +
        "only boxes registered on the staging platform can be queried here. " +
        "Returns metadata about available sensors and their data for the specified date range. " +
        "For large date ranges, only a summary is returned.",
      inputSchema: {
        boxId: z.string().describe("The senseBox station ID"),
        boxName: z
          .string()
          .describe(
            "The senseBox station name (needed for archive URL construction)"
          ),
        fromDate: z
          .string()
          .describe("Start date in YYYY-MM-DD format, e.g. '2020-06-01'"),
        toDate: z
          .string()
          .describe("End date in YYYY-MM-DD format, e.g. '2020-06-30'"),
        sensorType: z
          .string()
          .optional()
          .describe(
            "Filter by sensor type (e.g. 'BME280', 'SDS011', 'HDC1080'). Only returns data for matching sensors."
          ),
        exportFormat: z
          .enum(["json", "csv"])
          .optional()
          .describe(
            "If set, creates a downloadable file with ALL measurements from all sensors. Returns a download URL valid for 1 hour."
          ),
      },
    },
    async ({ boxId, boxName, fromDate, toDate, sensorType, exportFormat }) => {
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

      if (dates.length > 365) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Date range too large. Maximum supported range is 365 days. Please narrow your query.",
            },
          ],
        };
      }

      // Fetch metadata from the first available date to discover sensors
      let meta = null;
      for (const date of dates) {
        meta = await fetchBoxMetaWithFallback(boxId, boxName, date);
        if (meta) break;
      }

      if (!meta) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No archive data found for box "${boxName}" (${boxId}) in the date range ${fromDate} to ${toDate}. ` +
                "The box may not have recorded data during this period, or the box name may not match the archive format.",
            },
          ],
        };
      }

      // Filter sensors by type if requested
      // Normalize sensor IDs (_id -> id) for consistency
      let sensors = meta.sensors.map((s) => ({
        ...s,
        id: s._id ?? s.id,
      }));
      if (sensorType) {
        sensors = sensors.filter(
          (s) => s.sensorType.toLowerCase() === sensorType.toLowerCase()
        );
        if (sensors.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text:
                  `No sensors of type "${sensorType}" found for this box. ` +
                  `Available sensor types: ${meta.sensors.map((s) => s.sensorType).join(", ")}`,
              },
            ],
          };
        }
      }

      // For ranges > 31 days and no export, return overview only
      if (dates.length > 31 && !exportFormat) {
        const sensorLines = sensors.map(
          (s) => `  - ${s.title} [${s.sensorType}] (${s.unit}) — ID: ${s.id}`
        );

        const coords = getArchiveCoordinates(meta);
        const text = [
          `**Archive Data Overview: ${meta.name}** (${meta.id})`,
          `Location: [${coords?.[0] ?? "?"},  ${coords?.[1] ?? "?"}]`,
          `Exposure: ${meta.exposure ?? "unknown"} | Model: ${meta.model ?? "unknown"}`,
          ``,
          `Date range: ${fromDate} to ${toDate} (${dates.length} days)`,
          ``,
          `Available sensors (${sensors.length}):`,
          ...sensorLines,
          ``,
          `⚠️ Date range exceeds 31 days. Use archive_get_sensor_data with a specific sensor ID and exportFormat to fetch and download data.`,
        ].join("\n");

        return { content: [{ type: "text" as const, text }] };
      }

      // Cap fetching to 31 days for summary, but allow full range for export
      const fetchDates = exportFormat ? dates.slice(0, 365) : dates;

      // For shorter ranges, fetch all sensor data
      const sensorResults: string[] = [];
      const allExportData: { timestamp: string; value: string; sensor_id: string; sensor_title: string; sensor_type: string; unit: string; box_id: string }[] = [];
      const concurrency = 10;

      for (const sensor of sensors) {
        const allMeasurements: ArchiveMeasurement[] = [];
        let daysWithData = 0;
        let daysMissing = 0;

        for (let i = 0; i < fetchDates.length; i += concurrency) {
          const batch = fetchDates.slice(i, i + concurrency);
          const results = await Promise.allSettled(
            batch.map((date) =>
              fetchSensorCsvWithFallback(boxId, boxName, sensor.id, date)
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

        if (allMeasurements.length > 0) {
          // Collect data for export
          if (exportFormat) {
            for (const m of allMeasurements) {
              allExportData.push({
                timestamp: m.createdAt,
                value: m.value,
                sensor_id: sensor.id,
                sensor_title: sensor.title,
                sensor_type: sensor.sensorType,
                unit: sensor.unit,
                box_id: boxId,
              });
            }
          }

          const values = allMeasurements
            .map((m) => parseFloat(m.value))
            .filter((v) => !isNaN(v));

          let statsLine = `${allMeasurements.length} measurements over ${daysWithData} days`;
          if (values.length > 0) {
            const min = Math.min(...values);
            const max = Math.max(...values);
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            statsLine += ` | Min: ${min.toFixed(2)} | Max: ${max.toFixed(2)} | Mean: ${mean.toFixed(2)}`;
          }

          sensorResults.push(
            `  **${sensor.title}** [${sensor.sensorType}] (${sensor.unit}):\n    ${statsLine}` +
              (daysMissing > 0 ? ` | ${daysMissing} days missing` : "")
          );
        } else {
          sensorResults.push(
            `  **${sensor.title}** [${sensor.sensorType}] (${sensor.unit}): no data available`
          );
        }
      }

      // If export requested, create downloadable file
      if (exportFormat && allExportData.length > 0) {
        const filenameHint = `archive-${boxId}-${fromDate}-to-${toDate}`;
        const result = await createExport(allExportData, exportFormat, filenameHint);

        const exportCoords = getArchiveCoordinates(meta);
        const text = [
          `**Archive Data Export Complete: ${meta.name}** (${meta.id})`,
          `Location: [${exportCoords?.[0] ?? "?"}, ${exportCoords?.[1] ?? "?"}]`,
          `Exposure: ${meta.exposure ?? "unknown"} | Model: ${meta.model ?? "unknown"}`,
          `Period: ${fromDate} to ${toDate} (${fetchDates.length} days)`,
          ``,
          `Records exported: ${result.records.toLocaleString()}`,
          `Format: ${exportFormat.toUpperCase()}`,
          `Sensors included: ${sensors.length}`,
          ``,
          `Sensor Summary:`,
          ...sensorResults,
          ``,
          `**Download URL:** ${result.url}`,
          `(Valid for 1 hour)`,
        ].join("\n");

        return { content: [{ type: "text" as const, text }] };
      }

      const dataCoords = getArchiveCoordinates(meta);
      const text = [
        `**Archive Data: ${meta.name}** (${meta.id})`,
        `Location: [${dataCoords?.[0] ?? "?"}, ${dataCoords?.[1] ?? "?"}]`,
        `Exposure: ${meta.exposure ?? "unknown"} | Model: ${meta.model ?? "unknown"}`,
        `Period: ${fromDate} to ${toDate} (${dates.length} days)`,
        ``,
        `Sensor Data Summary:`,
        ...sensorResults,
        ``,
        `Use archive_get_sensor_data for detailed time series of a specific sensor.`,
      ].join("\n");

      return { content: [{ type: "text" as const, text }] };
    }
  );
}
