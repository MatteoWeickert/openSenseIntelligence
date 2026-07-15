import http from "node:http";
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

// Create the HTTP server object before calling listen so we can pass it to
// Vite's HMR config. HMR will piggyback on port 3000 via the 'upgrade'
// event rather than binding its own port (24678), preventing EADDRINUSE on
// dev-server restarts.
const server = http.createServer(app);

if (IS_PROD) {
  const build = await import(
    url.pathToFileURL(path.resolve("build/server/index.js")).href
  );
  app.all("*", createRequestHandler({ build, mode: MODE }));
} else {
  console.log("[server] initializing vite…");
  const vite = await import("vite");
  const viteDevServer = await vite.createServer({
    server: {
      middlewareMode: true,
      hmr: { server },
    },
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

// Call listen after all middleware/routes are registered so no request can
// arrive before the app is fully wired up.
server.listen(PORT, HOST, () => {
  console.log(`[server] ${MODE} – http://localhost:${PORT}`);
});

["SIGTERM", "SIGINT"].forEach((signal) => {
  process.once(signal, () => server?.close(console.error));
});
