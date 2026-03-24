import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildSchema } from "../../src/server/schema.js";
import { createHttpServer } from "../../src/server/http.js";
import { ServerCore } from "../../src/server/core.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import type { HttpServer } from "../../src/server/http.js";

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(tmpdir(), "whygraph-schema-test-"));
}

function structuralMd(id: string, opts: { label?: string; name?: string; parent?: string; refs?: Array<{ file: string; symbol?: string }> } = {}): string {
  const label = opts.label ?? "Feature";
  const name = opts.name ?? "TestFeature";
  const parent = opts.parent ? `parent: ${opts.parent}\n` : "";
  let refsYaml = "";
  if (opts.refs && opts.refs.length > 0) {
    refsYaml = `refs:\n${opts.refs.map((r) => r.symbol ? `  - file: ${r.file}\n    symbol: ${r.symbol}` : `  - file: ${r.file}`).join("\n")}\n`;
  }
  return `---
id: ${id}
label: ${label}
name: ${name}
status: active
${parent}${refsYaml}created_at: "2026-03-24T00:00:00Z"
updated_at: "2026-03-24T00:00:00Z"
---
`;
}

function decisionMd(id: string, opts: { affects?: string[]; tags?: string[]; status?: string; date?: string; title?: string; created_at?: string } = {}): string {
  const affects = opts.affects ?? [];
  const affectsYaml = affects.length > 0
    ? `affects:\n${affects.map((a) => `  - ${a}`).join("\n")}`
    : "affects: []";
  const tags = opts.tags ?? ["arch"];
  const tagsYaml = `tags:\n${tags.map((t) => `  - ${t}`).join("\n")}`;
  const status = opts.status ?? "active";
  const date = opts.date ?? "2026-03-24";
  const title = opts.title ?? "Test Decision";
  const created_at = opts.created_at ?? "2026-03-24T00:00:00Z";
  return `---
id: ${id}
label: Decision
title: ${title}
status: ${status}
date: "${date}"
${affectsYaml}
${tagsYaml}
created_at: "${created_at}"
updated_at: "${created_at}"
---

## Context

Some context.

## Decision

Some decision.

## Tradeoffs

Some tradeoffs.

## Alternatives

Some alternatives.
`;
}

async function gql(baseUrl: string, query: string): Promise<{ data?: Record<string, unknown>; errors?: unknown[] }> {
  const res = await fetch(`${baseUrl}/api/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return res.json() as Promise<{ data?: Record<string, unknown>; errors?: unknown[] }>;
}

describe("GraphQL schema", () => {
  it("builds without errors", () => {
    const whygraphDir = "/tmp/whygraph-schema-build-test";
    const core = new ServerCore(whygraphDir);
    const schema = buildSchema(core);
    expect(schema).toBeDefined();
  });

  describe("query resolvers", () => {
    let httpServer: HttpServer;
    let baseUrl: string;

    beforeEach(async () => {
      const whygraphDir = await makeTempDir();
      const graphDir = path.join(whygraphDir, "graph");
      await fs.mkdir(graphDir, { recursive: true });
      await fs.writeFile(path.join(graphDir, "wg-feat1.md"), structuralMd("wg-feat1"));
      await fs.writeFile(path.join(graphDir, "wg-dec1.md"), decisionMd("wg-dec1", { affects: ["wg-feat1"] }));
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

    it("entities query returns all entities", async () => {
      const body = await gql(baseUrl, `{
        entities {
          __typename
          ... on StructuralNode { id name label }
          ... on DecisionNode { id title label }
        }
      }`);

      expect(body.errors).toBeUndefined();
      expect(body.data?.entities).toHaveLength(2);
    });

    it("entity(id) returns single entity", async () => {
      const body = await gql(baseUrl, `{
        entity(id: "wg-feat1") {
          __typename
          ... on StructuralNode { id name label status }
        }
      }`);

      expect(body.errors).toBeUndefined();
      expect(body.data?.entity).toMatchObject({
        __typename: "StructuralNode",
        id: "wg-feat1",
        name: "TestFeature",
        label: "Feature",
        status: "active",
      });
    });

    it("entity(id) returns null for nonexistent", async () => {
      const body = await gql(baseUrl, `{
        entity(id: "nonexistent") {
          __typename
        }
      }`);

      expect(body.errors).toBeUndefined();
      expect(body.data?.entity).toBeNull();
    });

    it("status query returns counts", async () => {
      const body = await gql(baseUrl, `{
        status {
          running
          entityCount
          nodeCount
          decisionCount
        }
      }`);

      expect(body.errors).toBeUndefined();
      expect(body.data?.status).toEqual({
        running: true,
        entityCount: 2,
        nodeCount: 1,
        decisionCount: 1,
      });
    });

    it("decision node returns all fields", async () => {
      const body = await gql(baseUrl, `{
        entity(id: "wg-dec1") {
          __typename
          ... on DecisionNode {
            id title label status date
            affects tags context decision
            tradeoffs alternatives
          }
        }
      }`);

      expect(body.errors).toBeUndefined();
      expect(body.data?.entity).toMatchObject({
        __typename: "DecisionNode",
        id: "wg-dec1",
        title: "Test Decision",
        label: "Decision",
        context: "Some context.",
        decision: "Some decision.",
      });
    });
  });

  describe("extended query resolvers", () => {
    let httpServer: HttpServer;
    let baseUrl: string;

    beforeEach(async () => {
      const whygraphDir = await makeTempDir();
      const graphDir = path.join(whygraphDir, "graph");
      await fs.mkdir(graphDir, { recursive: true });

      // App node
      await fs.writeFile(path.join(graphDir, "wg-app1.md"), structuralMd("wg-app1", { label: "App", name: "MyApp" }));

      // Feature with refs
      await fs.writeFile(path.join(graphDir, "wg-feat1.md"), structuralMd("wg-feat1", {
        label: "Feature",
        name: "Auth",
        parent: "wg-app1",
        refs: [{ file: "src/auth.ts", symbol: "login" }],
      }));

      // Component with refs
      await fs.writeFile(path.join(graphDir, "wg-comp1.md"), structuralMd("wg-comp1", {
        label: "Component",
        name: "TokenStore",
        parent: "wg-feat1",
        refs: [{ file: "src/auth.ts", symbol: "TokenStore" }],
      }));

      // Feature without decision coverage (gap)
      await fs.writeFile(path.join(graphDir, "wg-feat2.md"), structuralMd("wg-feat2", {
        label: "Feature",
        name: "Billing",
        parent: "wg-app1",
      }));

      // Two decisions affecting wg-feat1 (for supersede candidates)
      await fs.writeFile(path.join(graphDir, "wg-dec1.md"), decisionMd("wg-dec1", {
        affects: ["wg-feat1"],
        tags: ["arch", "security"],
        title: "Use JWT tokens",
        date: "2026-03-20",
        created_at: "2026-03-20T00:00:00Z",
      }));

      await fs.writeFile(path.join(graphDir, "wg-dec2.md"), decisionMd("wg-dec2", {
        affects: ["wg-feat1"],
        tags: ["security"],
        title: "Add refresh tokens",
        date: "2026-03-22",
        created_at: "2026-03-22T00:00:00Z",
      }));

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

    it("context query resolves via getContext", async () => {
      const body = await gql(baseUrl, `{
        context(file: "src/auth.ts") {
          nodes { id label name parentChain }
          decisions { id attributes }
        }
      }`);

      expect(body.errors).toBeUndefined();
      const data = body.data?.context as { nodes: unknown[]; decisions: unknown[] };
      expect(data.nodes.length).toBeGreaterThanOrEqual(1);
      expect(data.decisions.length).toBeGreaterThanOrEqual(1);
    });

    it("context query with symbol filter", async () => {
      const body = await gql(baseUrl, `{
        context(file: "src/auth.ts", symbol: "login") {
          nodes { id name }
          decisions { id }
        }
      }`);

      expect(body.errors).toBeUndefined();
      const data = body.data?.context as { nodes: Array<{ id: string }>; decisions: unknown[] };
      expect(data.nodes.some((n) => n.id === "wg-feat1")).toBe(true);
    });

    it("decisions query with filters resolves", async () => {
      const body = await gql(baseUrl, `{
        decisions(tags: ["security"]) {
          id title tags
        }
      }`);

      expect(body.errors).toBeUndefined();
      const data = body.data?.decisions as Array<{ id: string; tags: string[] }>;
      expect(data.length).toBeGreaterThanOrEqual(1);
      for (const d of data) {
        expect(d.tags).toContain("security");
      }
    });

    it("decisions query without filters returns all", async () => {
      const body = await gql(baseUrl, `{
        decisions {
          id title
        }
      }`);

      expect(body.errors).toBeUndefined();
      const data = body.data?.decisions as unknown[];
      expect(data.length).toBe(2);
    });

    it("gaps query resolves", async () => {
      const body = await gql(baseUrl, `{
        gaps {
          id name label
        }
      }`);

      expect(body.errors).toBeUndefined();
      const data = body.data?.gaps as Array<{ id: string; name: string }>;
      // wg-feat2 has no decision coverage, wg-comp1 has no direct coverage
      expect(data.some((g) => g.id === "wg-feat2")).toBe(true);
    });

    it("gaps query with limit", async () => {
      const body = await gql(baseUrl, `{
        gaps(limit: 1) {
          id
        }
      }`);

      expect(body.errors).toBeUndefined();
      const data = body.data?.gaps as unknown[];
      expect(data.length).toBe(1);
    });

    it("nodes query with filters resolves", async () => {
      const body = await gql(baseUrl, `{
        nodes(label: "Feature") {
          id label name parent
        }
      }`);

      expect(body.errors).toBeUndefined();
      const data = body.data?.nodes as Array<{ label: string }>;
      expect(data.length).toBeGreaterThanOrEqual(1);
      for (const n of data) {
        expect(n.label).toBe("Feature");
      }
    });

    it("nodes query with search filter", async () => {
      const body = await gql(baseUrl, `{
        nodes(search: "auth") {
          id name
        }
      }`);

      expect(body.errors).toBeUndefined();
      const data = body.data?.nodes as Array<{ id: string }>;
      expect(data.some((n) => n.id === "wg-feat1")).toBe(true);
    });

    it("search query resolves", async () => {
      const body = await gql(baseUrl, `{
        search(query: "JWT") {
          id title
        }
      }`);

      expect(body.errors).toBeUndefined();
      const data = body.data?.search as Array<{ id: string; title: string }>;
      expect(data.some((d) => d.id === "wg-dec1")).toBe(true);
    });

    it("validationErrors returns entity errors", async () => {
      const body = await gql(baseUrl, `{
        validationErrors {
          entityId
          errors { field message severity }
        }
      }`);

      expect(body.errors).toBeUndefined();
      const data = body.data?.validationErrors as unknown[];
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it("supersedeCandidates returns overlapping decisions", async () => {
      const body = await gql(baseUrl, `{
        supersedeCandidates {
          newDecisionId
          existingDecisionId
          sharedNodeIds
        }
      }`);

      expect(body.errors).toBeUndefined();
      const data = body.data?.supersedeCandidates as Array<{ newDecisionId: string; existingDecisionId: string; sharedNodeIds: string[] }>;
      expect(data.length).toBe(1);
      expect(data[0].sharedNodeIds).toContain("wg-feat1");
    });
  });
});
