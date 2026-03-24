import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHttpServer } from "../../src/server/http.js";
import { ServerCore } from "../../src/server/core.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import type { Server } from "node:http";

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

describe("HTTP server", () => {
  let server: Server;
  let baseUrl: string;
  let core: ServerCore;

  beforeEach(async () => {
    const whygraphDir = await makeTempDir();
    const graphDir = path.join(whygraphDir, "graph");
    await fs.mkdir(graphDir, { recursive: true });
    await fs.writeFile(path.join(graphDir, "wg-feat1.md"), structuralMd("wg-feat1"));

    core = new ServerCore(whygraphDir);
    await core.load();
    server = createHttpServer(core);

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    const addr = server.address();
    if (addr && typeof addr === "object") {
      baseUrl = `http://localhost:${addr.port}`;
    }
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("health endpoint returns 200", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("GraphQL endpoint responds to introspection", async () => {
    const res = await fetch(`${baseUrl}/api/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "{ __typename }",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.__typename).toBe("Query");
  });

  it("GraphQL entities query works over HTTP", async () => {
    const res = await fetch(`${baseUrl}/api/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `{
          entities {
            __typename
            ... on StructuralNode { id name }
          }
        }`,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.errors).toBeUndefined();
    expect(body.data.entities).toHaveLength(1);
    expect(body.data.entities[0].id).toBe("wg-feat1");
  });

  it("GraphQL status query works over HTTP", async () => {
    const res = await fetch(`${baseUrl}/api/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `{ status { running entityCount nodeCount decisionCount } }`,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toEqual({
      running: true,
      entityCount: 1,
      nodeCount: 1,
      decisionCount: 0,
    });
  });
});
