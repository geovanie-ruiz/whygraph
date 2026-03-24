---
# whygraph-skxk
title: 'Server pub/sub: event channel for graph changes'
status: completed
type: task
priority: high
tags:
    - afk
    - server
created_at: 2026-03-24T05:34:05Z
updated_at: 2026-03-24T06:18:55Z
parent: whygraph-ileg
blocked_by:
    - whygraph-oq6u
---

## What to build

Event channel that file watcher and other state changes publish to. Subscribers receive typed events: entity_created, entity_updated, entity_deleted, graph_changed. Support multiple subscribers (fan-out). Buffered channels with non-blocking send (drop events for slow subscribers). Used by GraphQL subscriptions and any other consumer.

## Acceptance criteria

- [ ] Pub/sub with typed event channel
- [ ] Multiple subscribers supported
- [ ] Non-blocking send (buffered)
- [ ] Subscribe/unsubscribe lifecycle
- [ ] Events include entity data and change type

## User stories addressed

- User story 5
