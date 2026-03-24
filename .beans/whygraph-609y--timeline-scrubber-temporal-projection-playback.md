---
# whygraph-609y
title: 'Timeline scrubber: temporal projection + playback'
status: completed
type: task
priority: high
tags:
    - afk
    - frontend
created_at: 2026-03-24T05:35:24Z
updated_at: 2026-03-24T06:48:36Z
parent: whygraph-ileg
blocked_by:
    - whygraph-40uk
    - whygraph-tupg
---

## What to build

Timeline slider/scrubber UI. Queries the server for temporal projections at each unique timestamp. Scrubbing the slider rebuilds the graph view at that point in time. Shows structural nodes and decisions appearing/disappearing as the user moves through time.

## Acceptance criteria

- [ ] Slider with min/max from first to last entity timestamp
- [ ] Moving slider queries temporal projection from server
- [ ] Graph view updates to show state at selected timestamp
- [ ] Smooth transition between timestamps
- [ ] Shows current timestamp label

## User stories addressed

- User story 6, 7
