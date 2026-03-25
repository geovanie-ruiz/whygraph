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
