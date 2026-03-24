---
# whygraph-h6a8
title: React app scaffold + urql + WebSocket setup
status: completed
type: task
priority: high
tags:
    - afk
    - frontend
created_at: 2026-03-24T05:35:24Z
updated_at: 2026-03-24T06:37:19Z
parent: whygraph-ileg
blocked_by:
    - whygraph-7zcc
---

## What to build

Create React app with Vite. Set up urql GraphQL client pointing to the local whygraph server. Set up graphql-ws for WebSocket subscriptions. Establish the subscription to entityChanged with INITIAL_SNAPSHOT. Verify round-trip: server sends data, React app receives and renders a placeholder.

## Acceptance criteria

- [ ] React app scaffolded with Vite
- [ ] urql client configured for queries/mutations
- [ ] graphql-ws configured for subscriptions
- [ ] Successfully subscribes and receives INITIAL_SNAPSHOT
- [ ] Basic placeholder UI renders entity count

## User stories addressed

- User story 5
