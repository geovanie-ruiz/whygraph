---
# whygraph-3h2e
title: 'npm packaging: files field, .npmignore, frontend bundling'
status: todo
type: task
priority: normal
created_at: 2026-03-25T03:55:20Z
updated_at: 2026-03-25T03:55:20Z
parent: whygraph-rqnp
---

Prepare for npm publish:

1. Add "files" field to package.json (dist/, README.md, LICENSE)
2. Create .npmignore (exclude src/, test/, .beans/, .whygraph/, frontend/src/)
3. Verify frontend build outputs to dist/frontend/ and http.ts resolves it correctly
4. Test with npm pack — verify tarball contains only needed files
5. Add publishConfig if needed
6. Document publishing steps in README

Goal: npm install whygraph works from registry, whygraph serve serves the frontend.
