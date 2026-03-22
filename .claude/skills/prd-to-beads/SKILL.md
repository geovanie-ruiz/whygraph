---
name: prd-to-beads
description: Break a PRD into independently-grabbable beads using tracer-bullet vertical slices. Use when user wants to convert a PRD to beads, create implementation tasks, or break down a PRD into work items.
---

# PRD to Beads

Break a PRD into independently-grabbable beads (tasks) using vertical slices (tracer bullets). Uses the `bd` CLI (beads) for dependency-aware task tracking.

## Prerequisites

- `bd` CLI installed globally (`npm install -g @beads/bd`, `brew install beads`, or `go install`)
- Project initialized with `bd init` (check with `bd info`; if not initialized, run `bd init --quiet`)

## Process

### 1. Locate the PRD

Ask the user for the PRD source. The PRD may be:
- A GitHub issue — fetch with `gh issue view <number>`
- A local file — read it directly
- Already in context from a previous conversation turn

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code.

### 3. Draft vertical slices

Break the PRD into **tracer bullet** beads. Each bead is a thin vertical slice that cuts through ALL integration layers end-to-end, NOT a horizontal slice of one layer.

Slices may be 'HITL' or 'AFK'. HITL slices require human interaction, such as an architectural decision or a design review. AFK slices can be implemented and merged without human interaction. Prefer AFK over HITL where possible.

<vertical-slice-rules>
- Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests)
- A completed slice is demoable or verifiable on its own
- Prefer many thin slices over few thick ones
</vertical-slice-rules>

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each slice, show:

- **Title**: short descriptive name
- **Type**: HITL / AFK
- **Blocked by**: which other slices (if any) must complete first
- **User stories covered**: which user stories from the PRD this addresses

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any slices be merged or split further?
- Are the correct slices marked as HITL and AFK?

Iterate until the user approves the breakdown.

### 5. Create beads

Create beads in dependency order (blockers first) so you can reference real bead IDs when adding dependencies.

**Step 5a**: Create a parent epic for the PRD:

```bash
EPIC_ID=$(bd create "PRD: <prd-title>" -t epic -p 0 --json | jq -r '.id')
```

If the PRD came from a GitHub issue, link it:

```bash
EPIC_ID=$(bd create "PRD: <prd-title>" -t epic -p 0 --external-ref "github:<owner>/<repo>#<number>" --json | jq -r '.id')
```

**Step 5b**: For each approved slice, create a bead as a child of the epic. Write the description to a temp file and pass it via `--body-file`:

```bash
# Write description to temp file
cat > /tmp/bead-desc.md <<'DESC'
## What to build

A concise description of this vertical slice. Describe the end-to-end behavior,
not layer-by-layer implementation. Reference specific sections of the parent PRD
rather than duplicating content.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## User stories addressed

- User story 3
- User story 7
DESC

# Create the bead
BEAD_ID=$(bd create "<slice-title>" \
  -t task \
  -p <priority> \
  --parent "$EPIC_ID" \
  --label "<hitl-or-afk>" \
  --body-file /tmp/bead-desc.md \
  --json | jq -r '.id')
```

**Step 5c**: After creating all beads, add dependency relationships:

```bash
# Make bead-B depend on bead-A (B is blocked until A closes)
bd dep add <bead-B-id> <bead-A-id>
```

**Priority mapping**:
- p0: Critical path, must be done first
- p1: High priority, core functionality
- p2: Medium priority, important but not blocking
- p3: Lower priority, nice to have
- p4: Lowest priority, can defer

**Labels to apply**:
- `hitl` or `afk` — whether the slice requires human interaction
- Component labels as appropriate (e.g., `core`, `cli`, `viz`, `mcp`)

### 6. Verify the breakdown

After creating all beads, verify the structure:

```bash
# Show the epic and its children
bd list --parent "$EPIC_ID"

# Confirm unblocked beads are correct starting points
bd ready

# Show any blocked beads and their blockers
bd blocked
```

Print a summary showing each bead's ID, title, type (HITL/AFK), and blockers.

Do NOT close or modify the parent PRD GitHub issue (if one exists).
