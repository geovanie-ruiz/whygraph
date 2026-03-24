---
# whygraph-v3j1
title: Frontend bundling into npm package
status: todo
type: task
priority: low
tags:
    - afk
    - frontend
created_at: 2026-03-24T05:35:24Z
updated_at: 2026-03-24T05:35:24Z
parent: whygraph-ileg
blocked_by:
    - whygraph-h6a8
---

## What to build

Bundle the built React app into the whygraph npm package. Server serves the bundled frontend from a known directory. Vite build outputs to a location the server can find at runtime. Single `npm install` gives you everything.

## Acceptance criteria

- [ ] Vite build outputs to dist/frontend/ (or similar)
- [ ] Server serves static files from bundled directory
- [ ] SPA fallback (all non-API routes serve index.html)
- [ ] Single npm package includes both server and frontend
- [ ] Works with `npx whygraph serve`

## User stories addressed

- User story 35
