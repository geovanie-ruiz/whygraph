import { createServer, type Server } from "node:http";
import { createYoga } from "graphql-yoga";
import { buildSchema } from "./schema.js";
import type { ServerCore } from "./core.js";

const DEFAULT_PORT = 4777;

export interface HttpServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly server: Server;
}

export function createHttpServer(core: ServerCore, port: number = DEFAULT_PORT): HttpServer {
  const schema = buildSchema(core);

  const yoga = createYoga({
    schema,
    graphqlEndpoint: "/api/graphql",
    landingPage: false,
  });

  const server = createServer((req, res) => {
    // Health endpoint
    if (req.url === "/api/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // Delegate everything else to yoga
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
  const httpServer = createHttpServer(core, port);
  return httpServer.start().then(() => httpServer);
}
