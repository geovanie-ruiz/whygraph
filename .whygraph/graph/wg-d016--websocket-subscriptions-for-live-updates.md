---
id: wg-d016
label: Decision
title: WebSocket subscriptions for live graph updates
status: active
date: "2026-03-24"
affects:
  - wg-pubs
  - wg-gqls
  - wg-gviz
tags:
  - arch
created_at: "2026-03-24T15:00:00Z"
updated_at: "2026-03-24T15:00:00Z"
---

## Context

When an agent writes a decision file, the frontend graph should update within milliseconds. Polling would add latency and waste bandwidth.

## Decision

Use graphql-ws WebSocket transport for GraphQL subscriptions. The PubSub component fans out graph change events to all connected subscribers. The frontend GraphView re-renders on each subscription message.

## Tradeoffs

Gained: sub-second update latency, no polling overhead, natural fit with GraphQL subscriptions. Lost: WebSocket connection management complexity, reconnection logic needed in the frontend.

## Alternatives

**HTTP polling**: Frontend polls a REST or GraphQL endpoint every N seconds for changes. Rejected because it introduces artificial latency (half a polling interval on average) and wastes bandwidth on unchanged responses. When an agent is actively writing decisions, the graph should feel live.

**Server-Sent Events (SSE)**: One-way push from server to client over HTTP. Rejected because GraphQL subscriptions over graphql-ws are already part of the graphql-yoga stack, so SSE would require a separate push mechanism without adding capability. SSE also doesn't compose with the GraphQL query/mutation model already in use.

**Long polling**: Client holds an open HTTP request that the server responds to only when data changes. Rejected because it is harder to implement correctly than WebSockets, adds server complexity (pending request management), and provides no advantage over WebSockets in a Node.js server context.
