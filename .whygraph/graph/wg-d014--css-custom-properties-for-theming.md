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
created_at: "2026-03-24T15:00:00Z"
updated_at: "2026-03-24T15:00:00Z"
---

## Context

The frontend supports dark and light themes. Need a mechanism to swap colors, shadows, and borders across all components.

## Decision

Use CSS custom properties (--color-bg, --color-text, etc.) defined in tokens.css. Theme toggle swaps a data-theme attribute on the root element. No CSS-in-JS runtime.

## Tradeoffs

Gained: zero JS runtime cost for theming, works with plain CSS files, inspector-friendly. Lost: no type safety on token names, refactoring tokens requires manual find-replace.
