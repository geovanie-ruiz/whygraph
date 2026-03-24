import { createServer, type Server } from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { createYoga } from "graphql-yoga";
import { buildSchema } from "./schema.js";
import type { ServerCore } from "./core.js";

const DEFAULT_PORT = 4777;

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export interface HttpServerOptions {
  port?: number;
  frontendDir?: string;
}

export interface HttpServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly server: Server;
}

function defaultFrontendDir(): string {
  // In production, frontend is at dist/frontend relative to the package root.
  // import.meta.url points to dist/server/http.js, so go up one level to dist/,
  // then into frontend/.
  const thisFile = new URL(import.meta.url).pathname;
  return path.resolve(path.dirname(thisFile), "..", "frontend");
}

function tryServeStatic(
  frontendDir: string,
  reqUrl: string,
  res: import("node:http").ServerResponse,
): boolean {
  const urlPath = reqUrl.split("?")[0];
  const filePath = path.join(frontendDir, urlPath);

  // Prevent directory traversal
  if (!filePath.startsWith(frontendDir)) {
    return false;
  }

  try {
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      const ext = path.extname(filePath);
      const mime = MIME_TYPES[ext] ?? "application/octet-stream";
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { "Content-Type": mime });
      res.end(content);
      return true;
    }
  } catch {
    // File not found, fall through
  }
  return false;
}

function serveIndexFallback(
  frontendDir: string,
  res: import("node:http").ServerResponse,
): boolean {
  const indexPath = path.join(frontendDir, "index.html");
  try {
    const content = fs.readFileSync(indexPath, "utf-8");
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

export function createHttpServer(
  core: ServerCore,
  portOrOptions?: number | HttpServerOptions,
): HttpServer {
  const options: HttpServerOptions =
    typeof portOrOptions === "number"
      ? { port: portOrOptions }
      : portOrOptions ?? {};

  const port = options.port ?? DEFAULT_PORT;
  const frontendDir = options.frontendDir ?? defaultFrontendDir();

  const schema = buildSchema(core);

  const yoga = createYoga({
    schema,
    graphqlEndpoint: "/api/graphql",
    landingPage: false,
  });

  const server = createServer((req, res) => {
    const url = req.url ?? "/";

    // Health endpoint
    if (url === "/api/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // API routes go to yoga
    if (url.startsWith("/api/")) {
      yoga(req, res);
      return;
    }

    // Try to serve a static file
    if (tryServeStatic(frontendDir, url, res)) {
      return;
    }

    // SPA fallback: serve index.html for all non-API routes
    if (serveIndexFallback(frontendDir, res)) {
      return;
    }

    // No frontend built — fall back to yoga for backwards compat
    yoga(req, res);
  });

  return {
    server,
    start(): Promise<void> {
      return new Promise((resolve, reject) => {
        server.on("error", reject);
        server.listen(port, () => resolve());
      });
    },
    stop(): Promise<void> {
      return new Promise((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}

export function startServer(
  core: ServerCore,
  port: number = DEFAULT_PORT,
): Promise<HttpServer> {
  const httpServer = createHttpServer(core, { port });
  return httpServer.start().then(() => httpServer);
}
