# Whygraph Self-Dogfooding Bootstrap

This document defines the structural tree that bead 1 will seed into `.whygraph/events.jsonl`.
Subsequent beads reference these UUIDs when writing decision staging entries.

## Structural Tree

```
App: Whygraph
├── Feature: Core Graph
│   ├── Component: Types
│   ├── Component: Event Log
│   ├── Component: Projection
│   ├── Component: Query
│   └── Component: Validation
├── Feature: Staging Pipeline
│   ├── Component: Parser
│   ├── Component: Resolver
│   ├── Component: Processor
│   ├── Component: Sessions
│   ├── Component: Reviews
│   └── Component: Errors
├── Feature: CLI
│   ├── Component: Init Command
│   ├── Component: Sync Command
│   ├── Component: Viz Command
│   └── Component: Config Command
├── Feature: MCP Server
│   ├── Component: Server Core
│   ├── Component: Context Tool
│   ├── Component: Get Decisions Tool
│   ├── Component: Get Gaps Tool
│   ├── Component: Get Reviews Tool
│   └── Component: Get Errors Tool
├── Feature: Visualization
│   ├── Component: Bake Engine
│   ├── Component: HTML Template
│   ├── Component: Timeline Scrubber
│   ├── Component: Focus+Context
│   ├── Component: Tag Filtering
│   ├── Component: Side Panel
│   └── Component: URL Hash State
└── Feature: Platform Integration
    ├── Component: Claude Code Prompts
    ├── Component: Cursor Prompts
    ├── Component: Copilot Prompts
    └── Component: Generic Prompts
```

## Bead-to-Component Mapping

| Bead | Affects Components |
|------|-------------------|
| 1 | Types |
| 2 | Event Log |
| 3 | Validation |
| 4 | Projection |
| 5 | Query |
| 6 | Parser |
| 7 | Resolver |
| 8 | Processor |
| 9 | Sessions, Reviews, Errors |
| 10 | Init Command |
| 11 | Sync Command |
| 12 | Config Command |
| 13 | Server Core |
| 14 | Context Tool |
| 15 | Get Decisions Tool |
| 16 | Get Gaps Tool |
| 17 | Get Reviews Tool, Get Errors Tool |
| 18 | Bake Engine |
| 19 | HTML Template |
| 20 | Timeline Scrubber |
| 21 | Focus+Context |
| 22 | Tag Filtering |
| 23 | Side Panel |
| 24 | URL Hash State |
| 25 | Viz Command |
| 26 | Claude Code Prompts, Cursor Prompts, Copilot Prompts, Generic Prompts |
| 27 | Processor, Reviews |
| 28 | Processor |
| 29 | (all — reads decisions from all beads) |
