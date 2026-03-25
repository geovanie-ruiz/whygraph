---
id: wg-d021
label: Decision
title: Single config.yaml at .whygraph/config.yaml
status: active
date: "2026-03-24"
affects:
  - wg-cmdi
  - wg-plat
tags:
  - convention
  - dx
created_at: "2026-03-24T15:00:00Z"
updated_at: "2026-03-24T15:00:00Z"
---

## Context

Configuration is needed for server port, platform integration, and feature flags. Could use multiple config files, environment variables, or a single file.

## Decision

Single .whygraph/config.yaml file for all configuration. CLI reads it on startup. No environment variable overrides in v1.

## Tradeoffs

Gained: one place to look, git-tracked, human-readable. Lost: no per-environment overrides without editing the file, YAML lacks comments-as-documentation culture.
