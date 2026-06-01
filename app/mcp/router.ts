import { Router, json } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server";
import { getExportFile, readExportFile, cleanupExports } from "./lib/exports";

export const mcpRouter = Router();
mcpRouter.use(json());

mcpRouter.post("/", async (req, res) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// File export download endpoint
mcpRouter.get("/exports/:id/:filename", async (req, res) => {
  const { id } = req.params;
  const file = await getExportFile(id);

  if (!file) {
    res.status(404).json({ error: "Export not found or expired" });
    return;
  }

  const content = await readExportFile(id);
  if (!content) {
    res.status(404).json({ error: "Export file not found" });
    return;
  }

  const contentType =
    file.format === "csv" ? "text/csv" : "application/json";

  res.setHeader("Content-Type", contentType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${file.filename}"`
  );
  res.send(content);
});

// SSE endpoint for server-to-client notifications (optional, for stateful sessions)
mcpRouter.get("/", async (req, res) => {
  res.status(405).json({ error: "Method not allowed. Use POST for MCP requests." });
});

// DELETE for session termination (optional, for stateful sessions)
mcpRouter.delete("/", async (req, res) => {
  res.status(405).json({ error: "Session management not enabled." });
});

// Cleanup expired exports every 10 minutes
setInterval(() => {
  cleanupExports().catch(() => {});
}, 10 * 60 * 1000);
