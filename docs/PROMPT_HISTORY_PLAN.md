# Prompt History Plan

## Problem

When a developer looks at a component, decision, or bug in whygraph, there is no record of the prompts that shaped it. Prompt history adds a decoupled, optional overlay that links developer prompts back to the graph entities they affected — revealing the intent behind how the system was built.

## Prior Art

| Project | Mechanism | Limitation |
|---------|-----------|------------|
| [prompt-book](https://github.com/23jmo/prompt-book) | Claude Code Skill (manual save) | User pastes prompt manually. No response capture. Zero code — just a SKILL.md. |
| [ai-cli-log](https://github.com/alingse/ai-cli-log) | PTY wrapper (`node-pty`) | Captures rendered terminal text. Lossy, no structure, no role separation. |
| [vscode-chat-history](https://github.com/jesustdmen/vscode-chat-history) | Reads VS Code SQLite + JSONL | Copilot only, not Claude Code. Good pipeline pattern (ingest/normalize/report). |
| [claude-history-tool](https://github.com/andyfischer/ai-coding-tools/tree/main/claude-history-tool) | Reads Claude Code JSONL directly | Confirms format is stable. No parentUuid threading, no file-change index, no semantic linking. |

**Key insight:** Claude Code already writes complete structured session logs to `~/.claude/projects/{encoded-path}/{session-uuid}.jsonl`. Every prompt, every tool call, every file path — already captured. The problem is not capture. The problem is parsing, linking, and presentation.

## JSONL Format (confirmed stable)

Each line is a JSON object. Relevant fields:

```
type: "user" | "assistant" | "progress" | "file-history-snapshot"
message.role: "user" | "assistant"
message.content: string | ContentBlock[]
  ContentBlock = { type: "text", text: string }
               | { type: "tool_use", name: string, input: object }
               | { type: "tool_result", content: string }
uuid: string
parentUuid: string | null     # conversation tree threading
sessionId: string
timestamp: ISO 8601
cwd: string
gitBranch: string
```

**Path derivation:** `~/.claude/projects/{cwd.replace(/\//g, '-')}/{sessionId}.jsonl`

**Scale:** Files range from 3KB (6 lines) to 12MB (4000 lines) for this project. Parser must be a streaming script, not agent-driven file reads.

## Design Decisions (Resolved)

- **Prompt is a decoupled overlay, not a graph node.** No new edges. No entity schema changes. Prompts reference entities via `touches`; entities don't reference prompts. The graph works without the prompt layer.
- **Prompt text is the primary artifact.** No step synthesis, no summarizer. The prompt captures developer intent. Metadata is limited to files changed, date, and linked entities.
- **One record per user message.** Each prompt in a session is a separate record. No grouping, no task boundary inference. Simple 1:1 mapping to JSONL structure.
- **Parser-based capture.** No agent self-reporting. A Node.js script parses the JSONL after the fact. Retroactive capture of all historical sessions via `whygraph capture --all`.
- **Gitignored by default.** `.whygraph/prompts/` is added to `.gitignore` during `whygraph init`. Opt-in sharing via `whygraph prompts share`. Developer takes responsibility for sensitive content if they enable sharing.
- **Deduplication via composite key.** `session_id` + ordinal position of user message. Re-running capture on the same session is a no-op.

## Prompt File Format

```yaml
# .whygraph/prompts/wp-a1b2.md
---
id: wp-a1b2
session_id: 1d5ce346-1a17-4b20-84e0-07ba60299c1d
text: "Create a button that increases the count by +1 every click."
status: completed | failed | partial
date: 2026-03-27
files_changed:
  - src/components/Counter.tsx
  - src/components/Counter.test.tsx
touches:
  - wg-btnc
  - wg-d014
created_at: "2026-03-27T14:00:00Z"
---
```

## Storage

```
.whygraph/
  prompts/           # gitignored by default
    wp-a1b2.md
    wp-c3d4.md
```

No changes to entity files. The reverse lookup ("which prompts shaped this component?") scans prompt files where `touches` includes the entity ID, or is indexed at query time.

## Sharing

- **`whygraph init`** — adds `.whygraph/prompts/` to `.gitignore`
- **`whygraph prompts share`** — removes the `.gitignore` entry, prints warning about sensitive content
- **`whygraph prompts unshare`** — adds the entry back, warns about already-committed files
- **Per-developer override** — `.whygraph/config.local.yaml` (gitignored) with `promptExport: false` uses `.git/info/exclude` to untrack prompts locally even when the project has sharing enabled

## Architecture

### Parser (`src/prompts/parser.ts`)

Streaming JSONL parser that extracts prompt segments from a session file.

**Input:** Session file path or session ID.

**Processing:**
1. Stream JSONL line by line (no full-file read into memory)
2. Extract user prompts: `type === "user"` where `message.content` is a string (not a tool_result)
3. Extract files changed: Edit/Write `tool_use` inputs → `file_path` field
4. Segment by user message: each prompt owns the tool calls until the next user prompt

**Output:** `PromptSegment[]`

```ts
interface PromptSegment {
  promptText: string;
  promptTimestamp: string;
  filesChanged: string[];
}
```

### Linker (`src/prompts/linker.ts`)

Maps `filesChanged` back to whygraph entities via their `refs` fields.

Uses existing `getContext(graph, file)` to resolve file paths to structural nodes. Collects all matched entity IDs into `touches[]`.

### Writer (`src/prompts/writer.ts`)

1. Generate `wp-{nanoid}` ID
2. Write `.whygraph/prompts/{id}.md` with YAML frontmatter

### Capture orchestrator (`src/prompts/capture.ts`)

Derives JSONL path from cwd or session ID. Runs parser → linker → writer pipeline. Checks composite key for deduplication before writing.

## Trigger Mechanisms

### 1. CLI command: `whygraph capture`

```bash
whygraph capture [session-id]         # capture specific session
whygraph capture --latest             # capture most recent session
whygraph capture --all                # batch process all historical sessions
whygraph capture --json               # programmatic output
```

Primary mechanism. Works retroactively on any historical session.

### 2. MCP tool: `whygraph_capture_session`

```
whygraph_capture_session(session_id?: string)
```

Agent or user calls explicitly. Runs the same pipeline as CLI.

### 3. Claude Code hook (future)

A `SessionEnd` hook that triggers capture automatically. Blocked on Claude Code exposing a reliable session-end event. When available, this becomes the zero-friction path.

## Frontend

### Node detail view

When viewing a component/decision/bug, show a list of prompts that touch it:
- Truncated prompt text (first ~80 chars)
- Date
- Status badge (completed/failed/partial)

### Prompt detail view (sidepanel drill-in)

Click a prompt → sidepanel page-turns to show:
- Full prompt text
- Files changed (as links)
- Linked entities
- Date
- Back button returns to node view

## Implementation Phases

### Phase 6 — Parser & Storage

**Files to create:**
1. `src/prompts/types.ts` — `PromptSegment`, `PromptRecord` interfaces
2. `src/prompts/parser.ts` — Streaming JSONL parser
3. `src/prompts/linker.ts` — Maps files to entities via `getContext`
4. `src/prompts/writer.ts` — Creates prompt files
5. `src/prompts/capture.ts` — Orchestrator with deduplication

**Files to modify:**
- `.gitignore` — Add `.whygraph/prompts/`

**Tests:** Parser extracts prompts from sample JSONL fixture, parser segments correctly with multiple user messages, linker maps file paths to entity IDs, writer creates valid prompt files, capture skips duplicates on re-run.

### Phase 7 — CLI Commands

**Files to create:**
1. `src/cli/commands/capture.ts` — `whygraph capture` with `--latest`, `--all`, `--json`
2. `src/cli/commands/prompts.ts` — `whygraph prompts [--entity]`, `share`, `unshare`

**Files to modify:**
- `src/cli/index.ts` — Register new commands

### Phase 8 — MCP & GraphQL Integration

**MCP tools:**
- `whygraph_get_prompts(entity_id?)` — read
- `whygraph_capture_session(session_id?)` — write
- Enhanced `whygraph_context` — include `prompts[]`

**GraphQL:**
- `Query.prompts(entity?)` — list prompts
- `Query.context` — add `prompts` to `ContextResult`

**Files to modify:**
- `src/mcp/server.ts`
- `src/server/schema.ts`

### Phase 9 — Frontend

1. Prompt list on node detail view
2. Prompt detail sidepanel with page-turn transition
3. Back navigation
