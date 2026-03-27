import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import * as yaml from "js-yaml";
import {
  findWhygraphDir,
  getConfiguredPort,
  isServerRunning,
  killProcessOnPort,
  waitForPortFree,
  waitForServerReady,
} from "../../src/cli/commands/server-utils.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(tmpdir(), "whygraph-server-utils-test-"));
}

describe("findWhygraphDir", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("finds .whygraph in the given directory", () => {
    fs.mkdirSync(path.join(tempDir, ".whygraph"), { recursive: true });
    expect(findWhygraphDir(tempDir)).toBe(tempDir);
  });

  it("walks up parent directories to find .whygraph", () => {
    fs.mkdirSync(path.join(tempDir, ".whygraph"), { recursive: true });
    const nested = path.join(tempDir, "a", "b", "c");
    fs.mkdirSync(nested, { recursive: true });
    expect(findWhygraphDir(nested)).toBe(tempDir);
  });

  it("returns null when no .whygraph found", () => {
    // tempDir has no .whygraph
    const nested = path.join(tempDir, "deep");
    fs.mkdirSync(nested, { recursive: true });
    expect(findWhygraphDir(nested)).toBeNull();
  });
});

describe("getConfiguredPort", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("reads port from config.yaml", () => {
    const whygraphDir = path.join(tempDir, ".whygraph");
    fs.mkdirSync(whygraphDir, { recursive: true });
    fs.writeFileSync(
      path.join(whygraphDir, "config.yaml"),
      yaml.dump({ serverPort: 5999 }),
    );
    expect(getConfiguredPort(tempDir)).toBe(5999);
  });

  it("defaults to 4777 when no config file", () => {
    expect(getConfiguredPort(tempDir)).toBe(4777);
  });

  it("defaults to 4777 when config has no port", () => {
    const whygraphDir = path.join(tempDir, ".whygraph");
    fs.mkdirSync(whygraphDir, { recursive: true });
    fs.writeFileSync(path.join(whygraphDir, "config.yaml"), yaml.dump({ appName: "Test" }));
    expect(getConfiguredPort(tempDir)).toBe(4777);
  });
});

describe("isServerRunning", () => {
  it("returns false for a port nothing is listening on", () => {
    expect(isServerRunning(19877)).toBe(false);
  });
});

describe("killProcessOnPort", () => {
  it("returns false when no process on port", () => {
    // Port 19881 has nothing listening on it
    expect(killProcessOnPort(19881)).toBe(false);
  });
});

describe("waitForPortFree", () => {
  it("resolves immediately when nothing is on the port", async () => {
    // Port 19882 has nothing → fetch fails → function returns immediately
    await expect(waitForPortFree(19882, 500)).resolves.toBeUndefined();
  });

  it("throws when port stays in use throughout timeout", async () => {
    // Start a real server that responds to health checks
    const server = createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
    });

    const port = await new Promise<number>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object") resolve(addr.port);
      });
    });

    try {
      // Short timeout so test doesn't hang
      await expect(waitForPortFree(port, 400)).rejects.toThrow(/still in use/);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("waitForServerReady", () => {
  it("resolves when server responds to /api/health", async () => {
    const server = createServer((req, res) => {
      if (req.url === "/api/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    const port = await new Promise<number>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object") resolve(addr.port);
      });
    });

    try {
      await expect(waitForServerReady(port, 3000)).resolves.toBeUndefined();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("throws when server does not become ready in time", async () => {
    // Port 19883 has nothing on it
    await expect(waitForServerReady(19883, 300)).rejects.toThrow(/not ready/);
  });
});
