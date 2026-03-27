---
id: wg-d014
label: Decision
title: CSS custom properties for theming instead of CSS-in-JS
status: active
date: "2026-03-24"
affects:
  - wg-vizf
  - wg-thmt
tags:
  - ux
created_at: "2026-03-23T23:00:00Z"
updated_at: "2026-03-23T23:00:00Z"
---

## Context

The frontend supports dark and light themes. Need a mechanism to swap colors, shadows, and borders across all components.

## Decision

Use CSS custom properties (--color-bg, --color-text, etc.) defined in tokens.css. Theme toggle swaps a data-theme attribute on the root element. No CSS-in-JS runtime.

## Tradeoffs

Gained: zero JS runtime cost for theming, works with plain CSS files, inspector-friendly. Lost: no type safety on token names, refactoring tokens requires manual find-replace.

## Alternatives

**CSS-in-JS (styled-components / emotion)**: Define styles and themes in JavaScript, colocated with components. Rejected because it adds a runtime that injects style tags, increases bundle size, and complicates the build setup. The theming problem is simple enough to not justify the overhead.

**Tailwind CSS with dark mode variant**: Use Tailwind's `dark:` prefix for theme variants. Rejected because Tailwind would require significant migration of existing CSS and adds a build step (PostCSS) that isn't otherwise needed. Token-based theming achieves the same outcome with less toolchain complexity.

**Two separate CSS files, loaded/unloaded on toggle**: Swap an entire stylesheet between light and dark versions. Rejected because it causes a flash of unstyled content on toggle, doubles the CSS maintenance surface, and is harder to override for one-off customizations.
