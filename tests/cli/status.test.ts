import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer, type Server } from "node:http";
import yaml from "js-yaml";
import { runStatus } from "../../src/cli/commands/status.js";
import type { WhygraphConfig } from "../../src/entity/types.js";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "whygraph-status-test-"));
}

function writeTestConfig(tempDir: string, config: WhygraphConfig): void {
  const whygraphDir = join(tempDir, ".whygraph");
  mkdirSync(whygraphDir, { recursive: true });
  const configPath = join(whygraphDir, "config.yaml");
  writeFileSync(configPath, yaml.dump(config, { lineWidth: -1 }), "utf-8");
}

function defaultConfig(overrides?: Partial<WhygraphConfig>): WhygraphConfig {
  return {
    appName: "TestApp",
    environment: "claude-code",
    prefix: "wg-",
    idLength: 4,
    tags: ["arch", "data", "security", "performance", "integration", "infra", "ux"],
    mcpMode: "default",
    serverPort: 0, // Will be overridden per test
    ...overrides,
  };
}

describe("runStatus", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("reports server not running when server is down", async () => {
    // Use a port that nothing is listening on
    writeTestConfig(tempDir, defaultConfig({ serverPort: 19876 }));

    const result = await runStatus(tempDir);

    expect(result.serverRunning).toBe(false);
    expect(result.serverPort).toBe(19876);
  });

  it("reports entity counts when server is up", async () => {
    // Start a mock server that responds to health and graphql
    const server = createServer((req, res) => {
      if (req.url === "/api/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }
      if (req.url === "/api/graphql" && req.method === "POST") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            data: {
              status: {
                running: true,
                entityCount: 5,
                nodeCount: 3,
                decisionCount: 2,
              },
            },
          }),
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });

    const port = await new Promise<number>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          resolve(addr.port);
        }
      });
    });

    try {
      writeTestConfig(tempDir, defaultConfig({ serverPort: port }));

      const result = await runStatus(tempDir);

      expect(result.serverRunning).toBe(true);
      expect(result.serverPort).toBe(port);
      expect(result.entityCount).toBe(5);
      expect(result.nodeCount).toBe(3);
      expect(result.decisionCount).toBe(2);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("returns error when GraphQL query returns non-ok status", async () => {
    const server = createServer((req, res) => {
      if (req.url === "/api/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }
      // GraphQL returns 500
      res.writeHead(500);
      res.end("Internal Server Error");
    });

    const port = await new Promise<number>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object") resolve(addr.port);
      });
    });

    try {
      writeTestConfig(tempDir, defaultConfig({ serverPort: port }));
      const result = await runStatus(tempDir);
      expect(result.serverRunning).toBe(true);
      expect(result.error).toBe("GraphQL query failed");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("returns error when GraphQL response has no status data", async () => {
    const server = createServer((req, res) => {
      if (req.url === "/api/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: null })); // no status field
    });

    const port = await new Promise<number>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object") resolve(addr.port);
      });
    });

    try {
      writeTestConfig(tempDir, defaultConfig({ serverPort: port }));
      const result = await runStatus(tempDir);
      expect(result.serverRunning).toBe(true);
      expect(result.error).toBe("Unexpected GraphQL response");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("throws when .whygraph not found", async () => {
    await expect(runStatus(tempDir)).rejects.toThrow(/not found/);
  });

  it("throws when config.yaml is missing", async () => {
    // Create .whygraph dir but no config.yaml
    const whygraphDir = join(tempDir, ".whygraph");
    mkdirSync(whygraphDir, { recursive: true });
    await expect(runStatus(tempDir)).rejects.toThrow(/config\.yaml not found/);
  });

  it("returns error when health check returns non-ok HTTP status", async () => {
    const server = createServer((req, res) => {
      if (req.url === "/api/health") {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "unavailable" }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    const port = await new Promise<number>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object") resolve(addr.port);
      });
    });

    try {
      writeTestConfig(tempDir, defaultConfig({ serverPort: port }));
      const result = await runStatus(tempDir);
      expect(result.serverRunning).toBe(false);
      expect(result.error).toBe("Health check failed");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
