import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { createHttpServer, type HttpServer } from "../../src/server/http.js";
import { ServerCore } from "../../src/server/core.js";

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(tmpdir(), "whygraph-http-test-"));
}

function structuralMd(id: string): string {
  return `---
id: ${id}
label: Feature
name: TestFeature
status: active
created_at: "2026-03-24T00:00:00Z"
updated_at: "2026-03-24T00:00:00Z"
---
`;
}

async function fetchJson(url: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(url);
  const body = await res.json() as Record<string, unknown>;
  return { status: res.status, body };
}

describe("HTTP Server", () => {
  let server: HttpServer | null = null;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  it("health endpoint responds with status and entity count", async () => {
    const whygraphDir = await makeTempDir();
    const graphDir = path.join(whygraphDir, "graph");
    await fs.mkdir(graphDir, { recursive: true });
    await fs.writeFile(path.join(graphDir, "wg-feat1.md"), structuralMd("wg-feat1"));
    await fs.writeFile(path.join(graphDir, "wg-feat2.md"), structuralMd("wg-feat2"));

    const core = new ServerCore(whygraphDir);
    await core.load();

    server = createHttpServer(core, 0);
    // Use port 0 to let OS assign a free port — but our API uses fixed port
    // So use a high ephemeral port instead
    const testPort = 44770 + Math.floor(Math.random() * 1000);
    server = createHttpServer(core, testPort);
    await server.start();

    const res = await fetchJson(`http://localhost:${testPort}/api/health`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", entities: 2 });
  });

  it("returns 404 for unknown routes", async () => {
    const whygraphDir = await makeTempDir();
    const graphDir = path.join(whygraphDir, "graph");
    await fs.mkdir(graphDir, { recursive: true });

    const core = new ServerCore(whygraphDir);
    await core.load();

    const testPort = 44770 + Math.floor(Math.random() * 1000);
    server = createHttpServer(core, testPort);
    await server.start();

    const res = await fetchJson(`http://localhost:${testPort}/nonexistent`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "not found" });
  });

  it("graceful shutdown stops the server", async () => {
    const whygraphDir = await makeTempDir();
    const graphDir = path.join(whygraphDir, "graph");
    await fs.mkdir(graphDir, { recursive: true });

    const core = new ServerCore(whygraphDir);
    await core.load();

    const testPort = 44770 + Math.floor(Math.random() * 1000);
    server = createHttpServer(core, testPort);
    await server.start();

    // Verify it's running
    const res = await fetchJson(`http://localhost:${testPort}/api/health`);
    expect(res.status).toBe(200);

    // Stop and verify it's down
    await server.stop();
    server = null;

    await expect(
      fetch(`http://localhost:${testPort}/api/health`),
    ).rejects.toThrow();
  });
});
