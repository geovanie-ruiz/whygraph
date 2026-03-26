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
  - arch
  - integration
created_at: "2026-03-24T15:00:00Z"
updated_at: "2026-03-24T15:00:00Z"
---

## Context

Configuration is needed for server port, platform integration, and feature flags. Could use multiple config files, environment variables, or a single file.

## Decision

Single .whygraph/config.yaml file for all configuration. CLI reads it on startup. No environment variable overrides in v1.

## Tradeoffs

Gained: one place to look, git-tracked, human-readable. Lost: no per-environment overrides without editing the file, YAML lacks comments-as-documentation culture.

## Alternatives

**Environment variables for all configuration**: No config file — set port, mode, and flags via env vars. Rejected because env vars are session-scoped and not committed to the repo. They require every developer (and agent) to manually set them, and they're invisible to git history when debugging why a project was configured a certain way.

**Multiple config files by concern** (e.g., `server.yaml`, `platform.yaml`): Split configuration into domain-specific files. Rejected because it multiplies the number of files to read without reducing complexity. Whygraph's configuration surface is small enough to fit comfortably in one file.

**package.json `whygraph` key**: Store configuration in the project's existing package.json. Rejected because whygraph is not always used in a Node.js project. Requiring package.json creates a dependency that breaks non-JS repos.
