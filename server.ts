import path from "node:path";
import url from "node:url";
import "dotenv/config";
import express from "express";
import compression from "compression";
import morgan from "morgan";
import { createRequestHandler } from "@react-router/express";
import { mcpRouter } from "./app/mcp/router";

const MODE = process.env.NODE_ENV ?? "development";
const IS_PROD = MODE === "production";
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const app = express();
app.disable("x-powered-by");

if (IS_PROD) {
  app.use(compression());
  app.use(
    "/assets",
    express.static("build/client/assets", {
      immutable: true,
      maxAge: "1y",
    }),
  );
  app.use(express.static("build/client"));
  app.use(express.static("public", { maxAge: "1h" }));
}

app.use(morgan("tiny"));

// MCP endpoint – available in both dev and prod
app.use("/mcp", mcpRouter);

if (IS_PROD) {
  // Production: serve the pre-built app bundle
  const build = await import(
    url.pathToFileURL(path.resolve("build/server/index.js")).href
  );
  app.all("*", createRequestHandler({ build, mode: MODE }));
} else {
  // Development: use Vite middleware for HMR
  const vite = await import("vite");
  const viteDevServer = await vite.createServer({
    server: { middlewareMode: true },
  });
  app.use(viteDevServer.middlewares);
  app.all("*", (req, res, next) => {
    viteDevServer
      .ssrLoadModule("virtual:react-router/server-build")
      .then((build: any) =>
        createRequestHandler({ build, mode: MODE })(req, res, next),
      )
      .catch(next);
  });
}

const server = app.listen(PORT, HOST, () => {
  console.log(`[server] ${MODE} – http://localhost:${PORT}`);
});

["SIGTERM", "SIGINT"].forEach((signal) => {
  process.once(signal, () => server?.close(console.error));
});
