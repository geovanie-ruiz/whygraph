---
id: wg-d003
label: Decision
title: Chokidar file watcher with 100ms debounce batching
status: active
date: "2026-03-24"
affects:
  - wg-fwat
tags:
  - arch
  - integration
created_at: "2026-03-24T03:02:00Z"
updated_at: "2026-03-24T03:02:00Z"
---

## Context

When an agent writes a decision file, the server needs to detect it and update the graph. File system events can fire multiple times for a single logical write (create + write + close). Without debouncing, the server would parse and rebuild for each intermediate event.

## Decision

Use chokidar (cross-platform file watcher) with a 100ms debounce window. Events accumulate during the window, then fire as a single batch. Only .md files in .whygraph/graph/ are watched. The watcher emits typed events (created, updated, deleted) with entity IDs.

## Tradeoffs

Gained: single rebuild per logical write, cross-platform reliability (chokidar handles macOS FSEvents, Linux inotify, Windows). Lost: 100ms latency between file write and graph update. Chokidar is an additional dependency (~2MB). Node's built-in fs.watch would be zero-dependency but unreliable across platforms.

## Alternatives

- Node.js fs.watch — rejected because it's notoriously unreliable on macOS (doesn't always fire, fires duplicates) and doesn't support recursive watching without manual directory traversal.
- Polling (fs.stat on interval) — rejected because it wastes CPU and introduces much higher latency than event-driven watching.
- No debounce (process every event) — rejected because editors and git operations can trigger dozens of events for a single file save, causing unnecessary graph rebuilds.
