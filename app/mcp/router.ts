import { Router, json } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server";

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

// SSE endpoint for server-to-client notifications (optional, for stateful sessions)
mcpRouter.get("/", async (req, res) => {
  res.status(405).json({ error: "Method not allowed. Use POST for MCP requests." });
});

// DELETE for session termination (optional, for stateful sessions)
mcpRouter.delete("/", async (req, res) => {
  res.status(405).json({ error: "Session management not enabled." });
});
