import { describe, it, expect, beforeEach, vi } from "vitest";
import { ServerCore } from "../../src/server/core.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import type { GraphEvent } from "../../src/server/pubsub.js";

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(tmpdir(), "whygraph-subscriptions-test-"));
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

describe("PubSub integration with ServerCore", () => {
  let whygraphDir: string;
  let core: ServerCore;

  beforeEach(async () => {
    whygraphDir = await makeTempDir();
    const graphDir = path.join(whygraphDir, "graph");
    await fs.mkdir(graphDir, { recursive: true });
    core = new ServerCore(whygraphDir);
    await core.load();
  });

  it("publishes entity_created when addOrUpdateEntity adds new entity", () => {
    const callback = vi.fn();
    core.pubsub.subscribe(callback);

    core.addOrUpdateEntity("wg-feat1", {
      id: "wg-feat1",
      label: "Feature",
      name: "Auth",
      status: "active",
      created_at: "2026-03-24T00:00:00Z",
      updated_at: "2026-03-24T00:00:00Z",
    });

    expect(callback).toHaveBeenCalledOnce();
    const event: GraphEvent = callback.mock.calls[0][0];
    expect(event.type).toBe("entity_created");
    expect(event.entityId).toBe("wg-feat1");
    expect(event.entity).toBeDefined();
    expect(event.entity!.id).toBe("wg-feat1");
  });

  it("publishes entity_updated when addOrUpdateEntity updates existing entity", async () => {
    await fs.writeFile(
      path.join(whygraphDir, "graph", "wg-feat1.md"),
      structuralMd("wg-feat1"),
    );
    core = new ServerCore(whygraphDir);
    await core.load();

    const callback = vi.fn();
    core.pubsub.subscribe(callback);

    core.addOrUpdateEntity("wg-feat1", {
      id: "wg-feat1",
      label: "Feature",
      name: "Auth Updated",
      status: "active",
      created_at: "2026-03-24T00:00:00Z",
      updated_at: "2026-03-24T00:00:00Z",
    });

    expect(callback).toHaveBeenCalledOnce();
    const event: GraphEvent = callback.mock.calls[0][0];
    expect(event.type).toBe("entity_updated");
    expect(event.entityId).toBe("wg-feat1");
  });

  it("publishes entity_deleted when removeEntity removes existing entity", async () => {
    await fs.writeFile(
      path.join(whygraphDir, "graph", "wg-feat1.md"),
      structuralMd("wg-feat1"),
    );
    core = new ServerCore(whygraphDir);
    await core.load();

    const callback = vi.fn();
    core.pubsub.subscribe(callback);

    core.removeEntity("wg-feat1");

    expect(callback).toHaveBeenCalledOnce();
    const event: GraphEvent = callback.mock.calls[0][0];
    expect(event.type).toBe("entity_deleted");
    expect(event.entityId).toBe("wg-feat1");
  });

  it("does not publish event when removing nonexistent entity", () => {
    const callback = vi.fn();
    core.pubsub.subscribe(callback);

    core.removeEntity("nonexistent");

    expect(callback).not.toHaveBeenCalled();
  });

  it("publishes events for multiple operations in sequence", () => {
    const events: GraphEvent[] = [];
    core.pubsub.subscribe((e) => events.push(e));

    core.addOrUpdateEntity("wg-feat1", {
      id: "wg-feat1",
      label: "Feature",
      name: "Auth",
      status: "active",
      created_at: "2026-03-24T00:00:00Z",
      updated_at: "2026-03-24T00:00:00Z",
    });

    core.addOrUpdateEntity("wg-feat1", {
      id: "wg-feat1",
      label: "Feature",
      name: "Auth v2",
      status: "active",
      created_at: "2026-03-24T00:00:00Z",
      updated_at: "2026-03-24T00:00:00Z",
    });

    core.removeEntity("wg-feat1");

    expect(events).toHaveLength(3);
    expect(events[0].type).toBe("entity_created");
    expect(events[1].type).toBe("entity_updated");
    expect(events[2].type).toBe("entity_deleted");
  });
});
