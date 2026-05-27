import path from "node:path";
import url from "node:url";
import "dotenv/config";
import express from "express";
import compression from "compression";
import morgan from "morgan";
import { createRequestHandler } from "@react-router/express";
import { mcpRouter } from "./app/mcp/router";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const app = express();
app.disable("x-powered-by");
app.use(compression());

// Static assets with long-term caching
app.use(
  "/assets",
  express.static("build/client/assets", {
    immutable: true,
    maxAge: "1y",
  }),
);
app.use(express.static("build/client"));
app.use(express.static("public", { maxAge: "1h" }));

app.use(morgan("tiny"));

// MCP endpoint - all requests to /mcp will be handled by the MCP router
app.use("/mcp", mcpRouter);

// React Router handles everything else 
const build = await import(
  url.pathToFileURL(path.resolve("build/server/index.js")).href
);
app.all("*", createRequestHandler({ build, mode: process.env.NODE_ENV }));

const server = app.listen(PORT, HOST, () => {
  console.log(`[server] http://localhost:${PORT}`);
});

["SIGTERM", "SIGINT"].forEach((signal) => {
  process.once(signal, () => server?.close(console.error));
});
