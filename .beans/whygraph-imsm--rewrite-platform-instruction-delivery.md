---
# whygraph-imsm
title: Rewrite platform instruction delivery
status: completed
type: task
priority: high
created_at: 2026-03-25T03:55:20Z
updated_at: 2026-03-25T05:09:01Z
parent: whygraph-rqnp
---

Replace current platform rules system:

Claude Code:
- Write minimal instructions into CLAUDE.md with markers (<!-- whygraph:start/end -->)
- Register MCP server in .claude/settings.json under mcpServers
- Tell developer to restart session
- Do NOT add SessionStart hook

All other platforms:
- Write minimal instructions into AGENTS.md with markers

Instruction content (non-inferable only):
1. Rule: capture non-trivial decisions before writing production code
2. Recognition heuristic (9 signals)
3. File format: frontmatter schema with canonical tag list
4. MCP server name to use for decision capture tools
5. How to check if whygraph server is running (whygraph status)

Remove:
- whygraph prime command entirely
- generateSessionStartHook() in claude-hook.ts
- SessionStart hook injection in writeClaudeCodeRules()
