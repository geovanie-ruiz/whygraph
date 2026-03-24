---
id: wg-d001
label: Decision
title: GraphQL over REST for the API surface
status: active
date: "2026-03-24"
affects:
  - wg-gqls
  - wg-srvr
tags:
  - arch
created_at: "2026-03-24T03:00:00Z"
updated_at: "2026-03-24T03:00:00Z"
---

## Context

Whygraph has three API consumers with different data needs: the React frontend wants graph structure with full attributes, MCP tools want lightweight decision text and affected file paths, and the CLI wants counts and status. A single API surface needs to serve all three without over-fetching or maintaining separate endpoints.

## Decision

Use GraphQL via graphql-yoga as the single API endpoint at /api/graphql. Queries, mutations, and subscriptions all flow through one endpoint. Each client requests exactly the fields it needs. WebSocket subscriptions via graphql-ws handle live updates.

## Tradeoffs

Gained: one schema serves three clients, each gets exactly the data shape it needs. Self-documenting via introspection. Subscriptions are a first-class citizen. Lost: added graphql-yoga and graphql-ws as dependencies. Schema definition overhead for a relatively narrow API surface. Developers need to know GraphQL to debug the API.

## Alternatives

- REST + WebSocket — rejected because three clients with different data needs would require either multiple endpoints or over-fetching. WebSocket would need separate protocol handling outside the API contract.
- REST only with polling — rejected because real-time graph updates are a core requirement. Polling introduces latency and unnecessary load.
