# CLAUDE.md

The role of this file is to describe common mistakes and confusion points that agents might encounter as they work in this project. If you ever encounter something in the project that surprises you, please alert the developer working with you and indicate that this is the case in the ClaudeMD file to help prevent future agents from having the same issue.

**Do not update this file without explicit approval from the developer.** If you believe a change to CLAUDE.md is warranted, propose the change and wait for confirmation before writing it.

## Task Tracking

This project uses beads (`bd` CLI) for task tracking. Run `bd ready` to see unblocked tasks. Run `bd show <id>` for full task details including design context and decision capture requirements.

## Conventions

- ESM throughout — .js extensions on imports in TypeScript source
- Named exports only — no default exports
- Validate before every append — never skip validation
- TDD: red-green-refactor with vitest
- graphology is the graph — do not build parallel data structures
