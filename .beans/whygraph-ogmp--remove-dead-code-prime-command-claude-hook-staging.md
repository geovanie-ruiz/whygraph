---
# whygraph-ogmp
title: 'Remove dead code: prime command, claude-hook, staging references'
status: completed
type: task
priority: normal
created_at: 2026-03-25T03:55:20Z
updated_at: 2026-03-25T04:57:48Z
parent: whygraph-rqnp
---

Remove:
- src/cli/commands/prime.ts and its registration in cli/index.ts
- src/platform/claude-hook.ts (generateSessionStartHook is unused)
- SessionStart hook injection in writeClaudeCodeRules()
- Any references to staging directory or whygraph sync command

Clean up stale memory reference about staging in .claude memory files.
