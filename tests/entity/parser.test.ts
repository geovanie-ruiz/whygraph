import { describe, it, expect } from "vitest";
import { parseEntity } from "../../src/entity/parser.js";
import type { StructuralNode, DecisionNode } from "../../src/entity/types.js";

describe("parseEntity", () => {
  it("parses a structural node (Feature) with all required fields", () => {
    const content = `---
id: wg-a1b2
label: Feature
name: Authentication
status: active
parent: wg-app1
created_at: "2026-03-24T00:00:00Z"
updated_at: "2026-03-24T00:00:00Z"
---
`;

    const entity = parseEntity(content);
    expect(entity).not.toBeNull();
    const node = entity as StructuralNode;
    expect(node.id).toBe("wg-a1b2");
    expect(node.label).toBe("Feature");
    expect(node.name).toBe("Authentication");
    expect(node.status).toBe("active");
    expect(node.parent).toBe("wg-app1");
    expect(node.created_at).toBe("2026-03-24T00:00:00Z");
    expect(node.updated_at).toBe("2026-03-24T00:00:00Z");
  });

  it("parses a decision node with front matter and markdown body sections", () => {
    const content = `---
id: wg-c3d4
label: Decision
title: Use WebSockets for live updates
status: active
date: "2026-03-24"
affects:
  - wg-a1b2
  - wg-e5f6
tags:
  - arch
  - integration
created_at: "2026-03-24T10:00:00Z"
updated_at: "2026-03-24T10:00:00Z"
---

## Context

The baked HTML viz requires manual refresh.

## Decision

Use WebSocket subscriptions from the server.

## Tradeoffs

Gained: real-time. Lost: requires running server.

## Alternatives

Polling — rejected: latency.
`;

    const entity = parseEntity(content);
    expect(entity).not.toBeNull();
    const decision = entity as DecisionNode;
    expect(decision.id).toBe("wg-c3d4");
    expect(decision.label).toBe("Decision");
    expect(decision.title).toBe("Use WebSockets for live updates");
    expect(decision.status).toBe("active");
    expect(decision.date).toBe("2026-03-24");
    expect(decision.affects).toEqual(["wg-a1b2", "wg-e5f6"]);
    expect(decision.tags).toEqual(["arch", "integration"]);
    expect(decision.context).toBe("The baked HTML viz requires manual refresh.");
    expect(decision.decision).toBe("Use WebSocket subscriptions from the server.");
    expect(decision.tradeoffs).toBe("Gained: real-time. Lost: requires running server.");
    expect(decision.alternatives).toBe("Polling — rejected: latency.");
  });

  it("returns null for empty input", () => {
    expect(parseEntity("")).toBeNull();
  });

  it("returns null for garbage input", () => {
    expect(parseEntity("just some random text without front matter")).toBeNull();
  });

  it("returns null for front matter missing required fields", () => {
    const content = `---
id: wg-nope
---
`;
    expect(parseEntity(content)).toBeNull();
  });

  it("handles optional fields on structural nodes", () => {
    const content = `---
id: wg-comp
label: Component
name: SessionManager
status: active
parent: wg-feat
refs:
  - file: src/auth/session.ts
  - file: src/auth/session.ts
    symbol: createSession
description: Manages user sessions
created_at: "2026-03-24T00:00:00Z"
updated_at: "2026-03-24T00:00:00Z"
removed_at: "2026-03-25T00:00:00Z"
---
`;

    const entity = parseEntity(content);
    expect(entity).not.toBeNull();
    const node = entity as StructuralNode;
    expect(node.refs).toHaveLength(2);
    expect(node.refs![0]).toEqual({ file: "src/auth/session.ts" });
    expect(node.refs![1]).toEqual({ file: "src/auth/session.ts", symbol: "createSession" });
    expect(node.description).toBe("Manages user sessions");
    expect(node.removed_at).toBe("2026-03-25T00:00:00Z");
  });

  it("handles optional supersedes on decision nodes", () => {
    const content = `---
id: wg-new1
label: Decision
title: Switch to SSE instead of WebSockets
status: active
date: "2026-03-25"
affects:
  - wg-a1b2
tags:
  - arch
supersedes: wg-c3d4
created_at: "2026-03-25T00:00:00Z"
updated_at: "2026-03-25T00:00:00Z"
---

## Context

WebSocket overhead too high for unidirectional updates.

## Decision

Use Server-Sent Events.

## Tradeoffs

Gained: simplicity. Lost: bidirectional capability.

## Alternatives

Keep WebSockets — rejected: unnecessary complexity.
`;

    const entity = parseEntity(content);
    expect(entity).not.toBeNull();
    const decision = entity as DecisionNode;
    expect(decision.supersedes).toBe("wg-c3d4");
  });

  it("extracts body sections from markdown headings correctly", () => {
    const content = `---
id: wg-multi
label: Decision
title: Multi-paragraph sections
status: active
date: "2026-03-24"
affects:
  - wg-feat
tags:
  - arch
created_at: "2026-03-24T00:00:00Z"
updated_at: "2026-03-24T00:00:00Z"
---

## Context

First paragraph of context.

Second paragraph of context.

## Decision

The decision we made.

## Tradeoffs

Some tradeoffs here.

## Alternatives

Alternative one.

Alternative two.
`;

    const entity = parseEntity(content);
    expect(entity).not.toBeNull();
    const decision = entity as DecisionNode;
    expect(decision.context).toBe("First paragraph of context.\n\nSecond paragraph of context.");
    expect(decision.decision).toBe("The decision we made.");
    expect(decision.tradeoffs).toBe("Some tradeoffs here.");
    expect(decision.alternatives).toBe("Alternative one.\n\nAlternative two.");
  });

  it("parses structural node description from body when not in front matter", () => {
    const content = `---
id: wg-app1
label: App
name: Whygraph
status: active
created_at: "2026-03-24T00:00:00Z"
updated_at: "2026-03-24T00:00:00Z"
---

A graph-based architecture documentation tool.
`;

    const entity = parseEntity(content);
    expect(entity).not.toBeNull();
    const node = entity as StructuralNode;
    expect(node.description).toBe("A graph-based architecture documentation tool.");
  });
});
