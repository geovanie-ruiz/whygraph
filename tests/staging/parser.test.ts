import { describe, it, expect } from "vitest";
import { parseEntries } from "../../src/staging/parser.js";
import type {
  FeatureEntry,
  ComponentEntry,
  DecisionEntry,
  RefUpdateEntry,
  PatchEntry,
  DeprecateEntry,
  ResolveReviewEntry,
  NodeRemovedEntry,
} from "../../src/core/types.js";

describe("parseEntries", () => {
  // ============================================================
  // Empty / edge cases
  // ============================================================

  it("returns empty array for empty string", () => {
    expect(parseEntries("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(parseEntries("   \n\n  \n")).toEqual([]);
  });

  it("returns empty array for content with no headings", () => {
    expect(parseEntries("some random text\nwithout headings")).toEqual([]);
  });

  // ============================================================
  // Feature entries
  // ============================================================

  it("parses a feature entry with all fields", () => {
    const content = `## [feature] Notifications
timestamp: 2026-03-21T14:05:00Z
alias: notifications
description: Push and in-app notification system
refs:
  - file: src/notifications/
`;
    const entries = parseEntries(content);
    expect(entries).toHaveLength(1);
    const entry = entries[0] as FeatureEntry;
    expect(entry.type).toBe("feature");
    expect(entry.name).toBe("Notifications");
    expect(entry.timestamp).toBe("2026-03-21T14:05:00Z");
    expect(entry.alias).toBe("notifications");
    expect(entry.description).toBe("Push and in-app notification system");
    expect(entry.refs).toEqual([{ file: "src/notifications/" }]);
  });

  it("parses a feature entry with minimal fields", () => {
    const content = `## [feature] Auth
`;
    const entries = parseEntries(content);
    expect(entries).toHaveLength(1);
    const entry = entries[0] as FeatureEntry;
    expect(entry.type).toBe("feature");
    expect(entry.name).toBe("Auth");
    expect(entry.timestamp).toBeUndefined();
    expect(entry.alias).toBeUndefined();
    expect(entry.description).toBeUndefined();
    expect(entry.refs).toBeUndefined();
  });

  // ============================================================
  // Component entries
  // ============================================================

  it("parses a component entry with all fields", () => {
    const content = `## [component] OAuth callback handler
timestamp: 2026-03-21T14:06:00Z
alias: oauth-callback
parent: c4e82b1f-9012-4d3e-bcde-234567890abc
description: Handles OAuth provider callbacks and token exchange
refs:
  - file: src/auth/oauth/callback.ts, symbol: handleOAuthCallback
`;
    const entries = parseEntries(content);
    expect(entries).toHaveLength(1);
    const entry = entries[0] as ComponentEntry;
    expect(entry.type).toBe("component");
    expect(entry.name).toBe("OAuth callback handler");
    expect(entry.timestamp).toBe("2026-03-21T14:06:00Z");
    expect(entry.alias).toBe("oauth-callback");
    expect(entry.parent).toBe("c4e82b1f-9012-4d3e-bcde-234567890abc");
    expect(entry.description).toBe(
      "Handles OAuth provider callbacks and token exchange"
    );
    expect(entry.refs).toEqual([
      { file: "src/auth/oauth/callback.ts", symbol: "handleOAuthCallback" },
    ]);
  });

  it("parses a component with parent: app", () => {
    const content = `## [component] Core module
parent: app
`;
    const entries = parseEntries(content);
    const entry = entries[0] as ComponentEntry;
    expect(entry.parent).toBe("app");
  });

  // ============================================================
  // Ref-update entries
  // ============================================================

  it("parses a ref-update entry", () => {
    const content = `## [ref-update] d5f93c2a-3456-4e7f-cdef-345678901bcd
timestamp: 2026-03-21T14:07:00Z
add:
  - file: src/auth/oauth/pkce.ts, symbol: PKCEFlow
remove:
  - file: src/auth/oauth/legacy.ts, symbol: LegacyFlow
`;
    const entries = parseEntries(content);
    expect(entries).toHaveLength(1);
    const entry = entries[0] as RefUpdateEntry;
    expect(entry.type).toBe("ref-update");
    expect(entry.nodeId).toBe("d5f93c2a-3456-4e7f-cdef-345678901bcd");
    expect(entry.timestamp).toBe("2026-03-21T14:07:00Z");
    expect(entry.add).toEqual([
      { file: "src/auth/oauth/pkce.ts", symbol: "PKCEFlow" },
    ]);
    expect(entry.remove).toEqual([
      { file: "src/auth/oauth/legacy.ts", symbol: "LegacyFlow" },
    ]);
  });

  it("parses a ref-update with only add", () => {
    const content = `## [ref-update] abc-123
add:
  - file: src/new.ts
`;
    const entries = parseEntries(content);
    const entry = entries[0] as RefUpdateEntry;
    expect(entry.add).toEqual([{ file: "src/new.ts" }]);
    expect(entry.remove).toBeUndefined();
  });

  // ============================================================
  // Patch entries
  // ============================================================

  it("parses a patch entry with arbitrary key-value properties", () => {
    const content = `## [patch] abc-uuid-123
timestamp: 2026-03-21T14:08:00Z
status: deprecated
description: Updated description
`;
    const entries = parseEntries(content);
    expect(entries).toHaveLength(1);
    const entry = entries[0] as PatchEntry;
    expect(entry.type).toBe("patch");
    expect(entry.nodeId).toBe("abc-uuid-123");
    expect(entry.timestamp).toBe("2026-03-21T14:08:00Z");
    expect(entry.properties).toEqual({
      status: "deprecated",
      description: "Updated description",
    });
  });

  it("parses a patch entry with unknown keys as properties", () => {
    const content = `## [patch] abc-uuid-123
custom-field: some value
another: thing
`;
    const entries = parseEntries(content);
    const entry = entries[0] as PatchEntry;
    expect(entry.properties).toEqual({
      "custom-field": "some value",
      another: "thing",
    });
  });

  // ============================================================
  // Deprecate entries
  // ============================================================

  it("parses a deprecate entry with two UUIDs", () => {
    const content = `## [deprecate] e6a04d3b-old-uuid f7b15e4c-new-uuid
timestamp: 2026-03-21T14:08:00Z
`;
    const entries = parseEntries(content);
    expect(entries).toHaveLength(1);
    const entry = entries[0] as DeprecateEntry;
    expect(entry.type).toBe("deprecate");
    expect(entry.oldNodeId).toBe("e6a04d3b-old-uuid");
    expect(entry.newNodeId).toBe("f7b15e4c-new-uuid");
    expect(entry.timestamp).toBe("2026-03-21T14:08:00Z");
  });

  // ============================================================
  // Decision entries
  // ============================================================

  it("parses a decision entry with all fields", () => {
    const content = `## [decision] Use JWT over session cookies
timestamp: 2026-03-21T14:10:00Z
context: Session cookies don't work well with mobile clients
  and require server-side state. The mobile app needs stateless
  auth that works across API boundaries.
decision: Use JWT tokens for authentication. Tokens are signed,
  stateless, and include user claims.
tradeoffs: Gained stateless auth, lost easy revocation. Token
  expiry is the primary revocation mechanism.
alternatives: Session cookies (rejected: requires server-side
  session store, doesn't work for mobile). OAuth-only (rejected:
  not all consumers are OAuth clients).
files-touched: src/auth/session.ts, src/auth/oauth/callback.ts
tags: security, arch
supersedes: b7d91a3e-5678-4c9f-abcd-1234567890ef
`;
    const entries = parseEntries(content);
    expect(entries).toHaveLength(1);
    const entry = entries[0] as DecisionEntry;
    expect(entry.type).toBe("decision");
    expect(entry.name).toBe("Use JWT over session cookies");
    expect(entry.timestamp).toBe("2026-03-21T14:10:00Z");
    expect(entry.context).toBe(
      "Session cookies don't work well with mobile clients and require server-side state. The mobile app needs stateless auth that works across API boundaries."
    );
    expect(entry.decision).toBe(
      "Use JWT tokens for authentication. Tokens are signed, stateless, and include user claims."
    );
    expect(entry.tradeoffs).toBe(
      "Gained stateless auth, lost easy revocation. Token expiry is the primary revocation mechanism."
    );
    expect(entry.alternatives).toBe(
      "Session cookies (rejected: requires server-side session store, doesn't work for mobile). OAuth-only (rejected: not all consumers are OAuth clients)."
    );
    expect(entry.filesTouched).toEqual([
      "src/auth/session.ts",
      "src/auth/oauth/callback.ts",
    ]);
    expect(entry.tags).toEqual(["security", "arch"]);
    expect(entry.supersedes).toBe("b7d91a3e-5678-4c9f-abcd-1234567890ef");
  });

  it("parses a decision entry with affects instead of files-touched", () => {
    const content = `## [decision] Use event sourcing
timestamp: 2026-03-21T14:10:00Z
context: Need to track graph changes
decision: Use event sourcing for the graph
tradeoffs: Gained full history, lost simplicity
alternatives: Direct mutation (rejected: no history)
affects: uuid-1, uuid-2
tags: arch
`;
    const entries = parseEntries(content);
    const entry = entries[0] as DecisionEntry;
    expect(entry.affects).toEqual(["uuid-1", "uuid-2"]);
    expect(entry.filesTouched).toBeUndefined();
  });

  it("parses a decision entry with date field", () => {
    const content = `## [decision] Something
timestamp: 2026-03-21T14:10:00Z
date: September 2025
context: Some context
decision: Some decision
tradeoffs: Some tradeoffs
alternatives: Some alternatives
tags: arch
`;
    const entries = parseEntries(content);
    const entry = entries[0] as DecisionEntry;
    expect(entry.date).toBe("September 2025");
  });

  // ============================================================
  // Resolve-review entries
  // ============================================================

  it("parses a resolve-review entry", () => {
    const content = `## [resolve-review] review-line-id
timestamp: 2026-03-21T14:12:00Z
action: supersede
`;
    const entries = parseEntries(content);
    expect(entries).toHaveLength(1);
    const entry = entries[0] as ResolveReviewEntry;
    expect(entry.type).toBe("resolve-review");
    expect(entry.reviewId).toBe("review-line-id");
    expect(entry.timestamp).toBe("2026-03-21T14:12:00Z");
    expect(entry.action).toBe("supersede");
  });

  it("parses a resolve-review with dismiss action", () => {
    const content = `## [resolve-review] review-456
action: dismiss
`;
    const entries = parseEntries(content);
    const entry = entries[0] as ResolveReviewEntry;
    expect(entry.action).toBe("dismiss");
  });

  // ============================================================
  // Node-removed entries
  // ============================================================

  it("parses a node-removed entry", () => {
    const content = `## [node-removed] e6a04d3b-4567-4f8a-def0-456789012cde
timestamp: 2026-03-21T14:15:00Z
`;
    const entries = parseEntries(content);
    expect(entries).toHaveLength(1);
    const entry = entries[0] as NodeRemovedEntry;
    expect(entry.type).toBe("node-removed");
    expect(entry.nodeId).toBe("e6a04d3b-4567-4f8a-def0-456789012cde");
    expect(entry.timestamp).toBe("2026-03-21T14:15:00Z");
  });

  // ============================================================
  // Multiple entries
  // ============================================================

  it("parses multiple entries in a single file", () => {
    const content = `## [feature] Auth
timestamp: 2026-03-21T14:05:00Z
alias: auth
description: Authentication system

## [component] Login handler
timestamp: 2026-03-21T14:06:00Z
parent: auth
description: Handles user login

## [node-removed] old-uuid-123
timestamp: 2026-03-21T14:15:00Z
`;
    const entries = parseEntries(content);
    expect(entries).toHaveLength(3);
    expect(entries[0].type).toBe("feature");
    expect(entries[1].type).toBe("component");
    expect(entries[2].type).toBe("node-removed");
  });

  // ============================================================
  // Multiline field continuation
  // ============================================================

  it("handles multiline description", () => {
    const content = `## [feature] Notifications
description: Push and in-app notification system
  with support for email and SMS channels
  and configurable delivery rules.
`;
    const entries = parseEntries(content);
    const entry = entries[0] as FeatureEntry;
    expect(entry.description).toBe(
      "Push and in-app notification system with support for email and SMS channels and configurable delivery rules."
    );
  });

  it("handles multiline context in decision", () => {
    const content = `## [decision] Test
context: First line
  second line
  third line
decision: The decision
tradeoffs: None
alternatives: None
tags: arch
`;
    const entries = parseEntries(content);
    const entry = entries[0] as DecisionEntry;
    expect(entry.context).toBe("First line second line third line");
  });

  // ============================================================
  // Refs parsing
  // ============================================================

  it("parses refs with file only", () => {
    const content = `## [feature] Test
refs:
  - file: src/test/
`;
    const entries = parseEntries(content);
    const entry = entries[0] as FeatureEntry;
    expect(entry.refs).toEqual([{ file: "src/test/" }]);
  });

  it("parses refs with file and symbol", () => {
    const content = `## [feature] Test
refs:
  - file: src/test.ts, symbol: TestClass
  - file: src/other.ts, symbol: OtherFunc
`;
    const entries = parseEntries(content);
    const entry = entries[0] as FeatureEntry;
    expect(entry.refs).toEqual([
      { file: "src/test.ts", symbol: "TestClass" },
      { file: "src/other.ts", symbol: "OtherFunc" },
    ]);
  });

  it("parses multiple refs in add/remove on ref-update", () => {
    const content = `## [ref-update] uuid-123
add:
  - file: src/a.ts, symbol: A
  - file: src/b.ts
remove:
  - file: src/c.ts, symbol: C
`;
    const entries = parseEntries(content);
    const entry = entries[0] as RefUpdateEntry;
    expect(entry.add).toEqual([
      { file: "src/a.ts", symbol: "A" },
      { file: "src/b.ts" },
    ]);
    expect(entry.remove).toEqual([{ file: "src/c.ts", symbol: "C" }]);
  });

  // ============================================================
  // Tags parsing
  // ============================================================

  it("parses tags as comma-separated list", () => {
    const content = `## [decision] Test
context: c
decision: d
tradeoffs: t
alternatives: a
tags: security, arch, performance
`;
    const entries = parseEntries(content);
    const entry = entries[0] as DecisionEntry;
    expect(entry.tags).toEqual(["security", "arch", "performance"]);
  });

  it("handles single tag", () => {
    const content = `## [decision] Test
context: c
decision: d
tradeoffs: t
alternatives: a
tags: arch
`;
    const entries = parseEntries(content);
    const entry = entries[0] as DecisionEntry;
    expect(entry.tags).toEqual(["arch"]);
  });

  // ============================================================
  // Files-touched parsing
  // ============================================================

  it("parses files-touched as comma-separated paths", () => {
    const content = `## [decision] Test
context: c
decision: d
tradeoffs: t
alternatives: a
files-touched: src/a.ts, src/b.ts, src/c.ts
tags: arch
`;
    const entries = parseEntries(content);
    const entry = entries[0] as DecisionEntry;
    expect(entry.filesTouched).toEqual([
      "src/a.ts",
      "src/b.ts",
      "src/c.ts",
    ]);
  });

  // ============================================================
  // Unknown entry types
  // ============================================================

  it("skips unknown entry types", () => {
    const content = `## [unknown-type] Something
timestamp: 2026-03-21T14:05:00Z

## [feature] Real entry
timestamp: 2026-03-21T14:06:00Z
`;
    const entries = parseEntries(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe("feature");
  });

  // ============================================================
  // Affects parsing
  // ============================================================

  it("parses affects as comma-separated UUIDs", () => {
    const content = `## [decision] Test
context: c
decision: d
tradeoffs: t
alternatives: a
affects: uuid-1, uuid-2, uuid-3
tags: arch
`;
    const entries = parseEntries(content);
    const entry = entries[0] as DecisionEntry;
    expect(entry.affects).toEqual(["uuid-1", "uuid-2", "uuid-3"]);
  });

  // ============================================================
  // Full staging file from spec
  // ============================================================

  it("parses the full example staging file from the spec", () => {
    const content = `## [feature] Notifications
timestamp: 2026-03-21T14:05:00Z
alias: notifications
description: Push and in-app notification system
refs:
  - file: src/notifications/

## [component] OAuth callback handler
timestamp: 2026-03-21T14:06:00Z
alias: oauth-callback
parent: c4e82b1f-9012-4d3e-bcde-234567890abc
description: Handles OAuth provider callbacks and token exchange
refs:
  - file: src/auth/oauth/callback.ts, symbol: handleOAuthCallback

## [ref-update] d5f93c2a-3456-4e7f-cdef-345678901bcd
timestamp: 2026-03-21T14:07:00Z
add:
  - file: src/auth/oauth/pkce.ts, symbol: PKCEFlow
remove:
  - file: src/auth/oauth/legacy.ts, symbol: LegacyFlow

## [deprecate] e6a04d3b-old-uuid f7b15e4c-new-uuid
timestamp: 2026-03-21T14:08:00Z

## [decision] Use JWT over session cookies
timestamp: 2026-03-21T14:10:00Z
context: Session cookies don't work well with mobile clients
  and require server-side state. The mobile app needs stateless
  auth that works across API boundaries.
decision: Use JWT tokens for authentication. Tokens are signed,
  stateless, and include user claims.
tradeoffs: Gained stateless auth, lost easy revocation. Token
  expiry is the primary revocation mechanism.
alternatives: Session cookies (rejected: requires server-side
  session store, doesn't work for mobile). OAuth-only (rejected:
  not all consumers are OAuth clients).
files-touched: src/auth/session.ts, src/auth/oauth/callback.ts
tags: security, arch
supersedes: b7d91a3e-5678-4c9f-abcd-1234567890ef

## [resolve-review] review-line-id
timestamp: 2026-03-21T14:12:00Z
action: supersede

## [node-removed] e6a04d3b-4567-4f8a-def0-456789012cde
timestamp: 2026-03-21T14:15:00Z
`;
    const entries = parseEntries(content);
    expect(entries).toHaveLength(7);
    expect(entries.map((e) => e.type)).toEqual([
      "feature",
      "component",
      "ref-update",
      "deprecate",
      "decision",
      "resolve-review",
      "node-removed",
    ]);
  });

  // ============================================================
  // Edge cases
  // ============================================================

  it("handles entry at end of file without trailing newline", () => {
    const content = `## [node-removed] uuid-123
timestamp: 2026-03-21T14:15:00Z`;
    const entries = parseEntries(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe("node-removed");
    expect((entries[0] as NodeRemovedEntry).nodeId).toBe("uuid-123");
  });

  it("handles continuation lines without leading whitespace", () => {
    const content = `## [decision] Test
context: First line
second line without indent
decision: d
tradeoffs: t
alternatives: a
tags: arch
`;
    const entries = parseEntries(content);
    const entry = entries[0] as DecisionEntry;
    expect(entry.context).toBe("First line second line without indent");
  });
});
