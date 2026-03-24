import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildSchema } from "../../src/server/schema.js";
import { createHttpServer } from "../../src/server/http.js";
import { ServerCore } from "../../src/server/core.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import type { Server } from "node:http";

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(tmpdir(), "whygraph-schema-test-"));
}

function structuralMd(id: string, opts: { label?: string; name?: string; parent?: string } = {}): string {
  const label = opts.label ?? "Feature";
  const name = opts.name ?? "TestFeature";
  const parent = opts.parent ? `parent: ${opts.parent}\n` : "";
  return `---
id: ${id}
label: ${label}
name: ${name}
status: active
${parent}created_at: "2026-03-24T00:00:00Z"
updated_at: "2026-03-24T00:00:00Z"
---
`;
}

function decisionMd(id: string, opts: { affects?: string[] } = {}): string {
  const affects = opts.affects ?? [];
  const affectsYaml = affects.length > 0
    ? `affects:\n${affects.map((a) => `  - ${a}`).join("\n")}`
    : "affects: []";
  return `---
id: ${id}
label: Decision
title: Test Decision
status: active
date: "2026-03-24"
${affectsYaml}
tags:
  - arch
created_at: "2026-03-24T00:00:00Z"
updated_at: "2026-03-24T00:00:00Z"
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
    let server: Server;
    let baseUrl: string;

    beforeEach(async () => {
      const whygraphDir = await makeTempDir();
      const graphDir = path.join(whygraphDir, "graph");
      await fs.mkdir(graphDir, { recursive: true });
      await fs.writeFile(path.join(graphDir, "wg-feat1.md"), structuralMd("wg-feat1"));
      await fs.writeFile(path.join(graphDir, "wg-dec1.md"), decisionMd("wg-dec1", { affects: ["wg-feat1"] }));
      const core = new ServerCore(whygraphDir);
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
});
