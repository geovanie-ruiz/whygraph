---
name: prd-to-beans
description: Break a PRD into independently-grabbable beans using tracer-bullet vertical slices. Use when user wants to convert a PRD to beans, create implementation tasks, or break down a PRD into work items.
---

# PRD to beans

Break a PRD into independently-grabbable beans (tasks) using vertical slices (tracer bullets).

## Prerequisites

- `beans` CLI installed (`brew install hmans/beans/beans` or `go install github.com/hmans/beans@latest`)
- Project initialized with `beans init` (check for `.beans.yml`; if not initialized, run `beans init`)

## Process

### 1. Locate the PRD

Ask the user for the PRD source. The PRD may be:

- A GitHub issue — fetch with `gh issue view <number>`
- A local file — read it directly
- Already in context from a previous conversation turn

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code.

### 3. Draft vertical slices

Break the PRD into **tracer bullet** beans. Each bean is a thin vertical slice that cuts through ALL integration layers end-to-end, NOT a horizontal slice of one layer.

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

### 5. Create beans

Create beans in dependency order (blockers first) so you can reference real bean IDs when adding dependencies.

**Step 5a**: Create a parent epic for the PRD:

```bash
EPIC_ID=$(beans create "PRD: <prd-title>" -t epic -p critical --json | jq -r '.id')
```

**Step 5b**: For each approved slice, create a bean as a child of the epic. Write the description to a temp file and pass it via `--body-file`:

```bash
# Write description to temp file
cat > /tmp/bean-desc.md <<'DESC'
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

# Create the bean
BEAN_ID=$(beans create "<slice-title>" \
  -t task \
  -p <priority> \
  --parent "$EPIC_ID" \
  --tag "<hitl-or-afk>" \
  --body-file /tmp/bean-desc.md \
  --json | jq -r '.id')
```

**Step 5c**: After creating all beans, add blocking relationships:

```bash
# Make bean-A block bean-B (B cannot start until A completes)
beans update <bean-A-id> --blocking <bean-B-id>
```

**Priority mapping**:

- critical: Critical path, must be done first
- high: High priority, core functionality
- normal: Medium priority, important but not blocking
- low: Lower priority, nice to have
- deferred: Lowest priority, can defer

**Tags to apply**:

- `hitl` or `afk` — whether the slice requires human interaction
- Component tags as appropriate (e.g., `core`, `cli`, `viz`, `mcp`, `server`, `frontend`)

### 6. Verify the breakdown

After creating all beans, verify the structure:

```bash
# Show all beans under the epic
beans list --parent "$EPIC_ID"

# Confirm unblocked beans are correct starting points
beans list --ready

# Show blocked beans
beans list --is-blocked

# Validate integrity (broken links, cycles)
beans check
```

Print a summary showing each bean's ID, title, type (HITL/AFK), and blockers.

Do NOT close or modify the parent PRD GitHub issue (if one exists).
