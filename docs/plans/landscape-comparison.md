# Whygraph Landscape Comparison

How whygraph's architecture compares to tools in the decision tracking, agent context, and developer tooling space.

## The Space

There is no direct competitor doing exactly what whygraph does — capturing architectural decisions in real-time during agent work and making them queryable by future agents. The adjacent tools fall into four categories:

1. **Traditional ADR tools** — human-authored decision records
2. **Agent task trackers** — track what agents do, not why
3. **Context injection tools** — get information into agent prompts
4. **Memory systems** — persist agent knowledge across sessions

Whygraph sits at the intersection: it's a decision tracker (like ADR tools) that's agent-first (like task trackers) with a context injection model (like memory systems).

## Detailed Comparisons

### Beads (`bd`) — Agent Task Tracking

**What it is**: Distributed, Git-backed task tracking designed for AI agents. Dolt database synced to Git as `.beads/issues.jsonl`. Graph-based dependency tracking.

**Architecture comparison**:
| Dimension | Beads | Whygraph |
|-----------|-------|----------|
| Storage | Dolt (versioned SQL) + Git | JSONL event log + Git |
| Data model | Tasks with status, priority, dependencies | Decision graph with nodes, edges, events |
| Agent injection | `bd prime` via SessionStart hook | `whygraph prime` via SessionStart hook (same pattern) |
| Platform | Claude Code primary | Platform-agnostic with Claude Code deepest |
| CLI | `bd` (Go binary) | `whygraph` (Node.js/npm) |
| What it tracks | Work items and progress | Architectural rationale |

**Key insight**: Beads and whygraph are complementary. Beads tracks *what* is being done. Whygraph tracks *why* things are shaped the way they are. The `prime` pattern originated in beads and whygraph adopted it for the same reason — it's the most reliable way to inject context into agent sessions.

**What whygraph can learn**: Beads' `bd prime` is more mature — it has MCP-mode output (minimal when MCP server is active), customizable via `PRIME.md` overrides, and memory injection (`bd remember`). Whygraph's prime is static; it could benefit from conditional output based on what tools are available.

---

### Log4brains — ADR Documentation

**What it is**: Docs-as-code ADR management. Markdown files in Git, MADR template, Next.js static site for browsing.

**Architecture comparison**:
| Dimension | Log4brains | Whygraph |
|-----------|-----------|----------|
| Storage | Markdown files | Event-sourced JSONL |
| Data model | Flat documents with status | Graph with nodes, edges, temporal replay |
| Queryability | Full-text search via static site | MCP tools, graph queries, file-based context lookup |
| Agent awareness | None — human documentation | Agent-first — instructions teach agents to capture |
| Decision lifecycle | Immutable records, status changes only | Append-only events, supersession chains |
| Visualization | Static site with navigation | D3 force-directed graph with timeline scrubber |

**Key insight**: Log4brains represents the traditional ADR approach — humans write decision records after the fact, stored as flat markdown. Whygraph's event-sourced graph model enables temporal replay, supersession tracking, and structured queries that flat markdown cannot support. But log4brains has a mature publishing story (static site) that whygraph lacks.

**What whygraph can learn**: Log4brains' monorepo support (decision scoping per package) is relevant for large projects. Whygraph's single `.whygraph/` directory doesn't have package-level scoping yet.

---

### Traditional ADR Ecosystem (adr-tools, adr-manager, Pyadr)

**What they are**: CLI tools for creating and managing Architectural Decision Records in Nygard format or MADR.

**Key difference from whygraph**: ADR tools are human-authored, retrospective, and unstructured. They produce numbered markdown files (`0001-use-postgresql.md`) with prose sections. Whygraph is agent-authored, real-time, and structured — staging entries have typed fields (context, decision, tradeoffs, alternatives, affects, tags) that enable machine queries.

ADR tools don't know about agents, don't inject into agent context, and don't support graph relationships between decisions. Whygraph replaces ADR tools for agent-driven development.

---

### Context7 MCP — Documentation Retrieval

**What it is**: MCP server that fetches up-to-date library documentation and injects it into agent context. Query-triggered — when an agent mentions a library, Context7 fetches its docs.

**Architecture comparison**:
| Dimension | Context7 | Whygraph |
|-----------|---------|----------|
| What it provides | External library documentation | Internal architectural rationale |
| Data source | Centralized doc aggregation service | Local event log in repo |
| Trigger | Agent mentions a library | Agent is about to modify code |
| MCP tools | Library resolution + doc fetch | Context, decisions, gaps, reviews, errors |
| Platform | Multi-platform via MCP | Multi-platform via layered delivery |

**Key insight**: Context7 and whygraph solve different halves of the same problem. Context7 answers "how does this library work?" Whygraph answers "why did we choose this library and what did we reject?" They're complementary — an agent could use Context7 for API reference and whygraph for decision context on the same file.

---

### Claude-Context (Zilliz) — Codebase Search

**What it is**: MCP server that indexes a codebase into a vector database for semantic code search. "Find functions handling authentication" returns relevant code chunks.

**Key difference from whygraph**: Claude-Context tells agents *what* code exists. Whygraph tells agents *why* the code is shaped the way it is. Claude-Context is structural; whygraph is rationale. An agent using both would know both the code and the reasoning behind it.

---

### Memory MCP Servers (mcp-memory-service, agent-memory-mcp, Redis Agent Memory)

**What they are**: Persistent memory systems for agents. Store semantic triples, support vector search, enable cross-session knowledge retention.

**Architecture comparison**:
| Dimension | Memory MCP | Whygraph |
|-----------|-----------|----------|
| Data model | Semantic triples, knowledge graph | Decision graph (typed nodes + events) |
| Storage | Vector DB / Redis / proprietary | JSONL in Git |
| Scope | Any agent knowledge | Architectural decisions specifically |
| Structure | Unstructured memory with embeddings | Structured entries with typed fields |
| Portability | Requires backend service | Repo-native, no external service |
| Multi-agent | Shared memory instances | Staging files + event log in Git |

**Key insight**: Memory servers are general-purpose — they store anything an agent wants to remember. Whygraph is domain-specific — it stores architectural decisions with a structured format that enables queries like "what decisions affect this file?" and "what alternatives were considered?" The specificity is the value — a general memory system can't answer "show me superseded decisions in the auth module" without whygraph's typed graph.

**What whygraph can learn**: Memory servers have good multi-agent patterns — shared instances, semantic search, consolidation. Whygraph's multi-agent story is currently "merge Git branches."

---

### Structurizr — Architecture Visualization

**What it is**: Architecture documentation platform with C4 diagrams and embedded decision logs.

**Key difference**: Structurizr is a SaaS platform focused on human visualization. It has decision logs with supersession tracking (similar to whygraph) but no agent integration. Whygraph's visualization is a self-contained HTML file, not a cloud service. Structurizr's C4 model and whygraph's feature/component hierarchy serve similar structural purposes but at different abstraction levels.

---

### Claude Code Hooks — Event-Driven Automation

**What they are**: Built-in Claude Code mechanism for running commands on lifecycle events (SessionStart, Stop, PreToolUse, etc.).

**Relevance to whygraph**: Hooks are whygraph's delivery mechanism for Claude Code, not a competitor. Whygraph uses SessionStart to run `whygraph prime` and Stop to run `whygraph sync`. The hook system is the infrastructure; whygraph is the application.

**Key finding**: SubagentStart hooks were tested (2026-03-22) and do not fire for Agent tool sub-agents. This means hook-based delivery doesn't reach sub-agents today — CLAUDE.md propagation is the current solution.

---

### Cursor Rules — Static Context Injection

**What they are**: Markdown files in `.cursor/rules/` loaded into Cursor's AI context. Glob-scoped, hierarchical (team > project > user).

**Relevance to whygraph**: Cursor Rules is whygraph's delivery mechanism for Cursor, not a competitor. `whygraph init --cursor` would write prime output to `.cursor/rules/whygraph.md`. The rules system is the infrastructure; whygraph provides the content.

**Key finding**: Cursor has `/Generate Cursor Rules` which analyzes a codebase and generates rules. A similar `whygraph scan` could generate decision-aware rules.

---

## Positioning Matrix

| | Human-authored | Agent-authored |
|---|---|---|
| **Unstructured** | ADR tools, Log4brains | General memory MCP |
| **Structured** | Structurizr | **Whygraph** |

| | Tracks structure | Tracks rationale |
|---|---|---|
| **External docs** | Context7 | — |
| **Internal code** | Claude-Context | **Whygraph** |

| | Task-oriented | Decision-oriented |
|---|---|---|
| **Agent-first** | Beads | **Whygraph** |
| **Human-first** | Jira/Linear | ADR tools |

## Key Takeaways

1. **No direct competitor exists.** The intersection of "structured decision records" + "agent-authored" + "queryable graph" + "repo-native" is unoccupied. Tools are either human-authored (ADRs), unstructured (memory systems), or not decision-focused (task trackers, code search).

2. **The `prime` pattern is proven.** Beads established it, whygraph adopted it. It's the right approach for context injection in hook-capable environments, and the stdout output is portable to non-hook environments via static files.

3. **MCP is the universal agent interface.** Context7, Claude-Context, and memory servers all use MCP. Whygraph already plans MCP tools. This is the right cross-platform strategy for agent integration.

4. **The layered delivery model covers the gap.** No other tool has articulated a multi-layer delivery strategy (repo file → CLI → platform files → hooks). Most are single-platform. Whygraph's layered approach is a differentiator.

5. **Complementary, not competing.** Whygraph works alongside beads (tasks), Context7 (library docs), Claude-Context (code search), and memory servers (general knowledge). Each fills a different slice of what an agent needs to work effectively.
