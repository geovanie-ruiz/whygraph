---
# whygraph-7zcc
title: 'GraphQL subscriptions: WebSocket + INITIAL_SNAPSHOT'
status: completed
type: task
priority: high
tags:
    - afk
    - server
created_at: 2026-03-24T05:34:27Z
updated_at: 2026-03-24T06:33:05Z
parent: whygraph-ileg
blocked_by:
    - whygraph-skxk
    - whygraph-fxnn
---

## What to build

Implement GraphQL subscription resolvers using WebSocket transport. Subscribe to server pub/sub channel. Implement INITIAL_SNAPSHOT pattern: on subscribe, send current full state as first event, then stream subsequent changes. Events: entity_created, entity_updated, entity_deleted.

## Acceptance criteria

- [ ] WebSocket subscription transport working
- [ ] INITIAL_SNAPSHOT sent on subscribe (full current state)
- [ ] Subsequent changes streamed as individual events
- [ ] Multiple concurrent subscribers supported
- [ ] Clean disconnect handling

## User stories addressed

- User story 5, 19
