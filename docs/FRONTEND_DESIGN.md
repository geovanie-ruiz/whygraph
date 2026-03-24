# Design System Strategy: The Technical Monolith

## 1. Overview & Creative North Star

The North Star for this design system is **"The Technical Monolith."**

In an era of rounded, "bubbly" consumer interfaces, this system takes a stand for the professional developer. It is an editorial approach to data density, drawing inspiration from architectural blueprints and high-end technical journals. We reject the "friendly" aesthetic in favor of **Rigid Authority**.

The interface is defined by intentional asymmetry, 0px border radii, and a structural layout that prioritizes the hierarchy of information over decorative elements. By utilizing a "Dark Mode by Default" philosophy and shifting away from traditional 1px outlines, we create a workspace that feels like a precision instrument—not a toy.

---

## 2. Colors: Tonal Depth & The No-Line Rule

The palette is anchored in a sophisticated "Cool Charcoal" base. We move beyond flat backgrounds by using light and saturation to define spatial relationships.

### The "No-Line" Rule

**Standard 1px borders are strictly prohibited for sectioning.** To separate the sidebar from the main graph, or a header from the content, use background shifts. A section should be defined by its container level (e.g., `surface-container-low` vs. `surface`).

### Surface Hierarchy & Nesting

Depth is achieved through a "Stacking Principle." Treat the UI as physical layers of tech-matte materials:

- **Level 0 (Base):** `surface` (#080F18) - The infinite void of the workspace.
- **Level 1 (Sections):** `surface-container-low` (#091421) - Side panels and primary navigation regions.
- **Level 2 (In-set Containers):** `surface-container` (#0B1A2C) - Content blocks within panels.
- **Level 3 (Floating/Elevated):** `surface-bright` (#0E2D4D) - Tooltips and active dropdowns.

### The Glass & Gradient Rule

For floating overlays (like the Theme/Filter popover), use **Glassmorphism**. Apply `surface-container-highest` with a 70% opacity and a `backdrop-blur` of 12px. This ensures that the complex node-graphs behind the panel remain visible as a "ghosted" texture, maintaining context while focusing on the task.

---

## 3. Typography: Editorial Utility

The system pairs **Space Grotesk** (Display/Headlines) with **Inter** (Body/Labels) to create a high-contrast, technical feel.

- **Display/Headline (`spaceGrotesk`):** Used for primary page titles and major graph headers. The sharp terminals of Space Grotesk mirror the 0px corner radius of the UI.
- **Body/Labels (`inter`):** Used for all data entry and reading. The focus is on mathematical legibility.
- **Data Density:** Use `label-sm` (0.6875rem) with `medium` weights for metadata tags. This allows for high-information density without sacrificing readability.

---

## 4. Elevation & Depth: Tonal Layering

We eschew traditional drop-shadows. Elevation is a product of light, not darkness.

- **Layering Principle:** Instead of a shadow, a "lifted" element (like a fly-out panel) is simply a lighter hex code (`surface-container-high`) than the surface beneath it.
- **Ambient Shadows:** For floating menus, use a "Tinted Glow." Instead of a black shadow, use a large, 40px blur shadow at 8% opacity using the `surface-tint` (#71D7CD) color. This mimics the light emitted from the technical graph nodes.
- **The Ghost Border:** For accessibility on inputs, use the `outline-variant` (#334966) at **20% opacity**. This provides a guide for the eye without creating the "boxed-in" feel of a consumer app.

---

## 5. Components

### Buttons & Inputs

- **Shape:** 0px radius (square corners) across all states.
- **Primary:** Background `primary` (#71D7CD), Text `on-primary` (#004944). No gradients, just high-contrast flat color.
- **Input Fields:** Use `surface-container-lowest` (#000000) for the field background to create a "recessed" look into the UI.

### Chips & Filtering

- **Selection Chips:** Forbid rounded ends. Chips are rectangular.
- **Styling:** Use `secondary-container` (#323C4C) with a `ghost-border` for inactive states. Active states use `tertiary` (#FFC87F) to draw immediate attention to active filters.

### Scrollable Fly-out Panels

- **Transition:** Panels should slide in from the right, utilizing a `surface-container-high` background.
- **Organization:** Do not use dividers. Use `Spacing 8` (1.75rem) to separate sections like "Context," "Decision," and "Tradeoffs."

### Status Badges

- **Execution:** Small, rectangular blocks. Use `error` (#EE7D77) for alerts and `primary` (#71D7CD) for "Connected" states. Use all-caps `label-sm` typography for an authoritative look.

---

## 6. Do's and Don'ts

### Do

- **DO** use strict 0px corners. Every element should feel like it was cut from a single sheet of metal.
- **DO** lean into "warmth" in Light Mode. The eggshell (#F4F1EA) and charcoal blue (#2D3436) should feel like a high-end physical notebook.
- **DO** use vertical whitespace to imply hierarchy. If two sections are related, bring them closer (Spacing 2); if they are distinct, push them apart (Spacing 10).

### Don't

- **DON'T** use 1px solid lines to "box" everything. It creates visual noise. Let the tonal shifts of the surfaces do the work.
- **DON'T** use standard blue for links. Use `primary` (Teal) or `tertiary` (Orange) to maintain the technical palette.
- **DON'T** use icons alone. This is a developer tool; accompany icons with clear, text-based labels to ensure zero ambiguity.
