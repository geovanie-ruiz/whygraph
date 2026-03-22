# Whygraph Repo Maturity Comparison

How whygraph's repository structure, developer experience, and tooling maturity
compare to established AI development tools — and what to learn from them.

## Why This Report

Whygraph has a ceiling and that ceiling is the developer's ability to structure,
ship, and maintain a professional tool. This report compares whygraph's current
state against tools that have solved similar problems, identifies concrete gaps,
and prioritizes what to fix.

## The Exemplar: Beads

Beads is the closest architectural analog — a CLI-first, agent-integrated,
Git-backed developer tool. It's written in Go, distributed via npm + Homebrew,
and has ~41,000 lines of test code. It's the standard whygraph should aim for.

### What Beads Gets Right

**1. Separation of concerns in code**

```
beads/
├── cmd/bd/          CLI commands (Cobra)
├── internal/        31 packages with clear functional boundaries
│   ├── beads/       Domain logic
│   ├── config/      Configuration (Viper)
│   ├── storage/     Database abstraction
│   ├── git/         VCS integration
│   ├── hooks/       Hook system
│   ├── audit/       Observability
│   └── validation/  Input validation
├── integrations/    Separate dir per platform
│   ├── beads-mcp/
│   ├── claude-code/
│   └── junie/
├── docs/            52+ files, organized by topic
├── tests/           Comprehensive
└── npm-package/     JS distribution wrapper
```

The key pattern: **internal packages are domain-bounded, not layer-bounded.**
`beads/` is the domain, `storage/` is the persistence, `config/` is configuration.
Each package has a clear responsibility. Integrations live separately from core.

**2. Documentation hierarchy**

Beads has 52+ docs organized into clear tiers:
- **Setup**: QUICKSTART.md, INSTALLING.md, SETUP.md
- **Architecture**: ARCHITECTURE.md, INTERNALS.md
- **Features**: One file per feature (GIT_INTEGRATION.md, DOLT.md, etc.)
- **AI Integration**: Per-platform guides (CLAUDE.md, COPILOT_INTEGRATION.md, AIDER_INTEGRATION.md)
- **Developer**: TESTING.md, TESTING_PHILOSOPHY.md, ERROR_HANDLING.md, CONTRIBUTING.md
- **Support**: FAQ.md, TROUBLESHOOTING.md

Plus a documentation website with progressive disclosure from quickstart to internals.

**3. CLI design philosophy**

> "Can this be a flag on an existing command?"

This question guides every CLI decision. The result: a small, learnable command
surface. Commands are nouns (`bd ready`, `bd show`, `bd list`), not verbs-on-nouns
(`bd show-issue`, `bd list-tasks`). JSON output (`--json`) throughout for
programmatic use.

**4. Testing discipline**

- Dual-mode testing: every test runs twice (embedded + server mode)
- ~313 tests, ~41,000 lines of test code, ~3.8s execution
- Known broken tests documented in `.test-skip` with issue references
- `go test -short` for rapid iteration (~2s)
- Full suite before commit (~14s)

**5. Distribution story**

Six installation methods: Homebrew, npm, install scripts (bash + PowerShell),
GitHub releases, source build. Multi-platform binaries via GoReleaser. The npm
package wraps the Go binary — it doesn't reimplement in JS.

**6. Configuration layering**

Four levels with clear precedence:
1. CLI flags (highest)
2. Environment variables
3. Config files (project → user → global)
4. Defaults (lowest)

Project-level config uses dot notation (`bd config set jira.url https://...`).
Version-controlled in the database, not a file that can be accidentally deleted.

**7. Error handling patterns**

Three explicit patterns:
- **Exit immediately**: Fatal errors (bad input, DB failure)
- **Warn and continue**: Optional operations (metadata updates)
- **Silent ignore**: Cleanup in defer statements

Each pattern is documented and consistently applied.

---

## Whygraph Self-Audit: Current State

### What's Good

| Area | Score | Notes |
|------|-------|-------|
| README | 9/10 | Excellent product positioning, clear problem statement |
| Core types | 8/10 | Well-designed, comprehensive, consistent naming |
| Testing | 7/10 | 135 tests, good coverage of implemented code |
| Self-dogfooding | 8/10 | Using own tool to capture decisions — 77 events, 56 decisions |
| Code organization | 7/10 | Clean separation: core/, staging/, cli/ |
| TypeScript config | 8/10 | Correct ESM + NodeNext setup |

### What Needs Work

| Area | Score | Gap |
|------|-------|-----|
| CLI completeness | 3/10 | Only `prime` implemented. No init, sync, viz, config, mcp |
| package.json | 4/10 | Missing: repository, license, keywords, files, exports, author, bugs |
| Documentation hierarchy | 5/10 | Good content, no index, no getting-started guide, orphaned analysis docs |
| Production readiness | 1/10 | No linting, CI/CD, pre-commit hooks, release automation |
| Implementation | 2/10 | ~20% of spec built. Missing: projection, queries, init, sync, viz, MCP |
| Integration structure | 4/10 | Integrations mixed into .claude/ rather than separated |

### Overall: 4.5/10

Solid foundation, incomplete execution. The architecture and types are right.
The implementation pipeline (events → projection → queries → CLI/MCP) has the
first two links (types, events) but not the rest.

---

## Gap Analysis: Whygraph vs Beads

### 1. Code Organization

**Beads**: `internal/` with 31 domain-bounded packages. Integrations separate.

**Whygraph**:
```
src/
├── cli/        2 files (index.ts, prime.ts)
├── core/       3 files (types.ts, events.ts, validate.ts)
├── staging/    3 files (parser.ts, sessions.ts, reviews.ts, errors.ts)
├── mcp/        empty
└── viz/        empty
```

**Gap**: Whygraph's structure is flat. It works now but won't scale. When MCP,
visualization, and platform integrations are built, everything will be in one
level. Beads' approach of domain-bounded packages is better.

**Action**: No restructuring needed yet — the current codebase is small enough.
But as modules grow, extract: `src/graph/` (projection + queries),
`src/integrations/` (platform-specific code), `src/mcp/` (server + tools).

### 2. Documentation

**Beads**: 52+ docs with clear tiers (setup → features → architecture → developer).
Documentation website with progressive disclosure.

**Whygraph**: Good content scattered across:
- README.md (product)
- CLAUDE.md (conventions)
- AGENTS.md (agent instructions)
- .whygraph/INSTRUCTIONS.md (decision capture)
- docs/analysis/ (13 working documents)
- docs/beads/ (3 task-specific docs)
- docs/plans/ (3 planning docs)
- docs/spec/ (1 spec)

**Gap**: No hierarchy. No index. No getting-started guide. Simulation passes
(11 files) clutter docs/analysis/. No API reference. No CONTRIBUTING.md.

**Action** (priority order):
1. Add `docs/README.md` as an index
2. Move simulation passes to `docs/design-history/`
3. Add CONTRIBUTING.md with dev setup and TDD workflow
4. Add API reference for types, events, staging format once CLI stabilizes

### 3. CLI Design

**Beads**: ~15 commands, consistent patterns, JSON output, no interactive editors
for agents, aliases.

**Whygraph**: 1 command (`prime`). No stubs, no help text for missing commands,
no JSON output mode.

**Gap**: The CLI is a skeleton. Users can't do anything except run `prime`.

**Action**: Implement commands in dependency order per the beads:
1. `init` — creates .whygraph/, registers hooks
2. `sync` — processes staging → events
3. `viz` — generates HTML
4. `mcp` — starts MCP server
5. `config` — manages settings

Each command should have `--json` output from the start. Add a global `--help`
that shows all commands (including unimplemented ones with "coming soon" notes).

### 4. Package.json / Distribution

**Beads**: GoReleaser for multi-platform binaries. Six install methods.
npm wrapper auto-downloads platform binary. Full metadata.

**Whygraph**: npm package with `tsc` build. Missing critical fields.

**Gap**: Can't publish to npm without: repository, license, files, keywords.
No `.npmignore`. No `prepublishOnly` script. No exports field.

**Action**: Add all missing fields now. This is 10 minutes of work:
```json
{
  "repository": { "type": "git", "url": "https://github.com/geovanie-ruiz/whygraph" },
  "license": "MIT",
  "keywords": ["architecture", "decisions", "ai", "agents", "graph"],
  "author": "Geo Ruiz",
  "bugs": { "url": "https://github.com/geovanie-ruiz/whygraph/issues" },
  "homepage": "https://github.com/geovanie-ruiz/whygraph#readme",
  "files": ["dist", "README.md", "LICENSE"]
}
```

### 5. Testing

**Beads**: 313 tests, 41K lines, dual-mode testing, known-broken tracking,
short vs full test modes.

**Whygraph**: 135 tests, well-written but unit-only. No integration tests,
no coverage thresholds, no CI.

**Gap**: Missing end-to-end tests (staging → events → graph → query). No CI
to enforce tests on commits. No coverage reporting.

**Action**:
1. Add coverage threshold to vitest config (aim for 90%+ on implemented code)
2. Add integration test: parse staging → validate → append events → load → verify
3. Set up GitHub Actions for test on push (simple workflow, <20 lines)

### 6. Error Handling

**Beads**: Three documented patterns (exit, warn, silent). Consistently applied.

**Whygraph**: Ad-hoc. Some functions throw, some return empty defaults, some
log to console.error. No custom error types. No documented strategy.

**Gap**: No error handling philosophy. As the codebase grows, inconsistent
error handling will create debugging nightmares.

**Action**: Document a strategy in CLAUDE.md (3 lines):
- Core functions throw typed errors (validation, file operations)
- CLI catches and formats errors for humans
- MCP catches and formats errors per protocol

### 7. Configuration

**Beads**: Four-level precedence (flags → env → config files → defaults).
Project config version-controlled in database.

**Whygraph**: `.whygraph/config.json` with 5 fields. No CLI flags override.
No environment variable support. No user-level config.

**Gap**: Configuration is minimal but functional for now. Will need layering
when `whygraph init` supports different environments and preferences.

**Action**: Defer. Current config is sufficient for v0.1.

---

## What to Learn from Each Tool

### From Beads
- **CLI consolidation rule**: "Can this be a flag?" before adding commands
- **JSON output everywhere**: `--json` on every command from day one
- **Error handling patterns**: Three explicit categories, documented and enforced
- **Documentation tiers**: Setup → Features → Architecture → Developer
- **Token economy mindset**: `prime` outputs ~1k tokens, not 10k

### From Context7 (MCP server + multi-platform)

**Repo traits**: pnpm monorepo, TypeScript-first (89.6%), Changeset versioning,
16+ languages in docs, `.claude-plugin/` directory for marketplace metadata.

- **Dual integration modes**: MCP tools (`resolve-library-id`, `query-docs`) AND
  CLI+Skills mode (`ctx7 library`, `ctx7 docs`). Same functionality, two delivery
  paths. Whygraph plans the same (MCP for queries, CLI for operations) but hasn't
  built either mode fully yet.
- **Setup command with platform flags**: `npx ctx7 setup --cursor --claude --opencode`
  detects and configures per platform. Whygraph's `init` should do the same.
- **Monorepo with packages/plugins/skills separation**: Clear boundaries between
  core MCP server, platform plugins, and skill definitions. Whygraph currently
  mixes everything in `src/`.
- **Cross-platform from day one**: Supports Claude Code, Cursor, OpenCode out of
  the gate. Whygraph designs for this but hasn't implemented beyond Claude Code.

**What whygraph should adopt**:
- Platform-specific setup flags on `init` (`--claude`, `--cursor`, `--copilot`)
- `.claude-plugin/` directory structure for eventual marketplace listing
- Dual mode pattern: MCP when available, CLI always

### From Log4brains (monorepo documentation tool)

**Repo traits**: Lerna monorepo with 6 packages (cli, core, cli-common, global-cli,
init, web), Jest for testing, dedicated e2e-tests directory, Docker support,
Apache 2.0 license.

- **Package separation by concern**: `core` (business logic), `cli` (interface),
  `init` (setup), `web` (static site). Each is independently publishable. Whygraph
  has this conceptually (core, staging, cli, mcp, viz) but as directories, not
  packages. The monorepo structure is overkill for whygraph's size but the
  *separation principle* is right.
- **`init` as its own package**: Initialization is complex enough to warrant
  isolation — detecting environment, generating config, writing templates. Whygraph's
  init will be similarly complex (detect platform, register hooks, write instruction
  files, seed event log). Keeping it isolated from core is smart.
- **e2e-tests as a separate directory**: Not mixed with unit tests. Clear signal
  of what's fast (unit) vs slow (e2e). Whygraph should do the same when integration
  tests are added.
- **Static site generation from decisions**: `log4brains build` produces a browsable
  website. Whygraph's `viz` command serves the same purpose but as a self-contained
  HTML file rather than a full site. Different approach, same user need.
- **README includes CI/CD examples**: Shows GitHub Actions and GitLab CI configs
  for deploying the docs site. Good for adoption — users can copy-paste into their
  own repos.

**What whygraph should adopt**:
- Separate e2e-tests directory when integration tests are added
- CI/CD examples in README showing how to integrate whygraph into a project's pipeline
- Init logic isolated from core business logic

### From the ADR ecosystem

- **Simplicity wins**: adr-tools is 5 bash scripts and has thousands of users
- **Convention over configuration**: Numbered files in `docs/decisions/`
- **Status is the only mutable field**: Everything else is append-only

---

## Priority Actions (What to Do Next)

### This Week
1. Fix package.json (add repository, license, keywords, files, author, bugs)
2. Add docs/README.md index
3. Add CONTRIBUTING.md
4. Move simulation passes to docs/design-history/

### Next Sprint
5. Implement graph projection (bead 4) — unblocks everything downstream
6. Implement sync command (bead 11) — completes the staging pipeline
7. Add GitHub Actions CI (test on push)
8. Add coverage reporting

### Before v0.5
9. Implement init command with multi-platform support
10. Implement MCP server with 5 read-only tools
11. Implement visualization
12. Add integration tests (end-to-end pipeline)
13. Restructure docs/ into hierarchy

### Before v1.0
14. Add --json output to all commands
15. Error handling standardization
16. API reference documentation
17. npm publish with proper .npmignore and prepublishOnly
