import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHttpServer } from "../../src/server/http.js";
import { ServerCore } from "../../src/server/core.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import type { HttpServer } from "../../src/server/http.js";

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(tmpdir(), "whygraph-mutations-test-"));
}

function structuralMd(id: string, opts: { label?: string; name?: string } = {}): string {
  const label = opts.label ?? "Feature";
  const name = opts.name ?? "TestFeature";
  return `---
id: ${id}
label: ${label}
name: ${name}
status: active
created_at: "2026-03-24T00:00:00Z"
updated_at: "2026-03-24T00:00:00Z"
---
`;
}

async function gql(baseUrl: string, query: string, variables?: Record<string, unknown>): Promise<{ data?: Record<string, unknown>; errors?: unknown[] }> {
  const res = await fetch(`${baseUrl}/api/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return res.json() as Promise<{ data?: Record<string, unknown>; errors?: unknown[] }>;
}

describe("GraphQL mutations", () => {
  let httpServer: HttpServer;
  let baseUrl: string;
  let whygraphDir: string;
  let graphDir: string;

  beforeEach(async () => {
    whygraphDir = await makeTempDir();
    graphDir = path.join(whygraphDir, "graph");
    await fs.mkdir(graphDir, { recursive: true });
    const core = new ServerCore(whygraphDir);
    await core.load();
    httpServer = createHttpServer(core, 0);

    await new Promise<void>((resolve) => {
      httpServer.server.listen(0, () => resolve());
    });
    const addr = httpServer.server.address();
    if (addr && typeof addr === "object") {
      baseUrl = `http://localhost:${addr.port}`;
    }
  });

  afterEach(async () => {
    await httpServer.stop();
  });

  describe("ping", () => {
    it("ping mutation returns true", async () => {
      const body = await gql(baseUrl, `mutation { ping }`);
      expect(body.errors).toBeUndefined();
      expect(body.data?.ping).toBe(true);
    });
  });

  describe("createNode", () => {
    it("creates a structural node and returns it", async () => {
      const body = await gql(baseUrl, `
        mutation {
          createNode(label: "Feature", name: "Auth") {
            id
            label
            name
            status
            created_at
            updated_at
          }
        }
      `);

      expect(body.errors).toBeUndefined();
      const node = body.data?.createNode as Record<string, unknown>;
      expect(node.label).toBe("Feature");
      expect(node.name).toBe("Auth");
      expect(node.status).toBe("active");
      expect(node.id).toBeDefined();
      expect(typeof node.created_at).toBe("string");
    });

    it("writes entity file to disk", async () => {
      await gql(baseUrl, `
        mutation {
          createNode(label: "Feature", name: "Auth") {
            id
          }
        }
      `);

      const files = await fs.readdir(graphDir);
      const mdFiles = files.filter((f) => f.endsWith(".md"));
      expect(mdFiles).toHaveLength(1);

      const content = await fs.readFile(path.join(graphDir, mdFiles[0]), "utf-8");
      expect(content).toContain("name: Auth");
      expect(content).toContain("label: Feature");
    });

    it("creates node with optional fields", async () => {
      const body = await gql(baseUrl, `
        mutation {
          createNode(
            label: "Component"
            name: "Button"
            description: "A button component"
            refs: [{ file: "src/button.ts", symbol: "Button" }]
          ) {
            id
            label
            name
            description
            refs { file symbol }
          }
        }
      `);

      expect(body.errors).toBeUndefined();
      const node = body.data?.createNode as Record<string, unknown>;
      expect(node.description).toBe("A button component");
      expect(node.refs).toEqual([{ file: "src/button.ts", symbol: "Button" }]);
    });

    it("node is queryable after creation", async () => {
      const createBody = await gql(baseUrl, `
        mutation {
          createNode(label: "Feature", name: "Auth") {
            id
          }
        }
      `);
      const id = (createBody.data?.createNode as Record<string, unknown>).id;

      const queryBody = await gql(baseUrl, `{
        entity(id: "${id}") {
          __typename
          ... on StructuralNode { id name label }
        }
      }`);

      expect(queryBody.errors).toBeUndefined();
      expect(queryBody.data?.entity).toMatchObject({
        __typename: "StructuralNode",
        id,
        name: "Auth",
      });
    });
  });

  describe("createDecision", () => {
    it("creates a decision node and returns it", async () => {
      const body = await gql(baseUrl, `
        mutation {
          createDecision(
            title: "Use GraphQL"
            date: "2026-03-24"
            affects: []
            tags: ["arch"]
            context: "Need an API"
            decision: "Use GraphQL"
            tradeoffs: "Complexity"
            alternatives: "REST"
          ) {
            id
            label
            title
            status
            date
            context
            decision
            tradeoffs
            alternatives
            tags
          }
        }
      `);

      expect(body.errors).toBeUndefined();
      const dec = body.data?.createDecision as Record<string, unknown>;
      expect(dec.label).toBe("Decision");
      expect(dec.title).toBe("Use GraphQL");
      expect(dec.status).toBe("active");
      expect(dec.context).toBe("Need an API");
      expect(dec.tags).toEqual(["arch"]);
    });

    it("writes decision file to disk", async () => {
      await gql(baseUrl, `
        mutation {
          createDecision(
            title: "Use GraphQL"
            date: "2026-03-24"
            affects: []
            tags: ["arch"]
            context: "Need an API"
            decision: "Use GraphQL"
            tradeoffs: "Complexity"
            alternatives: "REST"
          ) {
            id
          }
        }
      `);

      const files = await fs.readdir(graphDir);
      const mdFiles = files.filter((f) => f.endsWith(".md"));
      expect(mdFiles).toHaveLength(1);

      const content = await fs.readFile(path.join(graphDir, mdFiles[0]), "utf-8");
      expect(content).toContain("title: Use GraphQL");
      expect(content).toContain("## Context");
    });
  });

  describe("updateEntity", () => {
    it("updates entity status", async () => {
      // Create a node first
      const createBody = await gql(baseUrl, `
        mutation {
          createNode(label: "Feature", name: "Auth") {
            id
          }
        }
      `);
      const id = (createBody.data?.createNode as Record<string, unknown>).id;

      const body = await gql(baseUrl, `
        mutation {
          updateEntity(id: "${id}", status: "deprecated") {
            __typename
            ... on StructuralNode { id status updated_at }
          }
        }
      `);

      expect(body.errors).toBeUndefined();
      const entity = body.data?.updateEntity as Record<string, unknown>;
      expect(entity.status).toBe("deprecated");
    });

    it("updates entity removed_at", async () => {
      const createBody = await gql(baseUrl, `
        mutation {
          createNode(label: "Feature", name: "Auth") {
            id
          }
        }
      `);
      const id = (createBody.data?.createNode as Record<string, unknown>).id;

      const body = await gql(baseUrl, `
        mutation {
          updateEntity(id: "${id}", removed_at: "2026-03-24T00:00:00Z") {
            __typename
            ... on StructuralNode { id removed_at }
          }
        }
      `);

      expect(body.errors).toBeUndefined();
      const entity = body.data?.updateEntity as Record<string, unknown>;
      expect(entity.removed_at).toBe("2026-03-24T00:00:00Z");
    });

    it("updates entity refs", async () => {
      const createBody = await gql(baseUrl, `
        mutation {
          createNode(label: "Feature", name: "Auth") {
            id
          }
        }
      `);
      const id = (createBody.data?.createNode as Record<string, unknown>).id;

      const body = await gql(baseUrl, `
        mutation {
          updateEntity(id: "${id}", refs: [{ file: "src/auth.ts", symbol: "login" }]) {
            __typename
            ... on StructuralNode { id refs { file symbol } }
          }
        }
      `);

      expect(body.errors).toBeUndefined();
      const entity = body.data?.updateEntity as Record<string, unknown>;
      expect(entity.refs).toEqual([{ file: "src/auth.ts", symbol: "login" }]);
    });

    it("returns error for nonexistent entity", async () => {
      const body = await gql(baseUrl, `
        mutation {
          updateEntity(id: "nonexistent", status: "deprecated") {
            __typename
          }
        }
      `);

      expect(body.errors).toBeDefined();
      expect(body.errors!.length).toBeGreaterThan(0);
    });

    it("persists update to disk", async () => {
      const createBody = await gql(baseUrl, `
        mutation {
          createNode(label: "Feature", name: "Auth") {
            id
          }
        }
      `);
      const id = (createBody.data?.createNode as Record<string, unknown>).id;

      await gql(baseUrl, `
        mutation {
          updateEntity(id: "${id}", status: "deprecated") {
            __typename
          }
        }
      `);

      // Read the file back and check status was persisted
      const files = await fs.readdir(graphDir);
      const mdFiles = files.filter((f) => f.endsWith(".md"));
      // There may be 2 files (old + new filename) or 1 depending on writeEntity behavior
      // Just check any .md file contains deprecated
      let foundDeprecated = false;
      for (const f of mdFiles) {
        const content = await fs.readFile(path.join(graphDir, f), "utf-8");
        if (content.includes("status: deprecated")) {
          foundDeprecated = true;
          break;
        }
      }
      expect(foundDeprecated).toBe(true);
    });
  });
});
