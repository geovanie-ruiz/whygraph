---
# whygraph-fxnn
title: GraphQL schema definition + server setup
status: todo
type: task
priority: critical
tags:
    - afk
    - server
created_at: 2026-03-24T05:34:27Z
updated_at: 2026-03-24T05:34:27Z
parent: whygraph-ileg
blocked_by:
    - whygraph-8l5e
---

## What to build

Set up graphql-yoga (or similar Node GraphQL server). Define the full GraphQL schema: Entity types (Node, Decision), query types (nodes, decisions, context, gaps, listNodes, search, validationErrors, supersedeCandidates, status), mutation types (createNode, createDecision, updateEntity), subscription types (entityChanged with INITIAL_SNAPSHOT pattern). Wire to Express/Fastify HTTP server.

## Acceptance criteria

- [ ] GraphQL schema defined with all types from PRD
- [ ] Server mounted at /api/graphql
- [ ] Playground available at /playground (dev mode)
- [ ] WebSocket transport for subscriptions
- [ ] Schema validates and introspects correctly

## User stories addressed

- User story 4
