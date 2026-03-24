import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import type { ServerCore } from "./core.js";

export interface HttpServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly port: number;
}

export function createHttpServer(core: ServerCore, port: number): HttpServer {
  let server: Server | null = null;

  function handleRequest(req: IncomingMessage, res: ServerResponse): void {
    if (req.method === "GET" && req.url === "/api/health") {
      const body = JSON.stringify({
        status: "ok",
        entities: core.getAllEntities().length,
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(body);
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  }

  return {
    port,

    start(): Promise<void> {
      return new Promise((resolve, reject) => {
        server = createServer(handleRequest);
        server.on("error", reject);
        server.listen(port, () => {
          resolve();
        });
      });
    },

    stop(): Promise<void> {
      return new Promise((resolve, reject) => {
        if (!server) {
          resolve();
          return;
        }
        server.close((err) => {
          server = null;
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}
