---
id: wg-14rc
label: Decision
title: Flat DecisionNode fields in context query instead of serialized attributes blob
status: active
date: "2026-03-25"
affects:
  - wg-mcrt
tags:
  - arch
  - ux
created_at: "2026-03-25T23:23:35.386Z"
updated_at: "2026-03-25T23:23:35.386Z"
---
## Context

The whygraph_context MCP tool returned decisions as { id, attributes } where attributes was a JSON-stringified blob of all graphology node attributes. An agent consuming this result would need to parse a string-within-JSON to access decision content, which is awkward and error-prone.

## Decision

Replace ContextDecisionResult with DecisionNode throughout: query.ts returns DecisionNode[], the GraphQL ContextResult type uses DecisionNode, and the MCP query requests flat fields (id title status date affects tags context decision tradeoffs alternatives).

## Tradeoffs

Gained: consistent shape with whygraph_get_decisions, no double-parsing for consumers, self-documenting fields. Lost: slightly more verbose GraphQL query; any future new fields on DecisionNode must be explicitly added to the MCP query.

## Alternatives

Keeping attributes as a blob but documenting the parse step — rejected because it shifts complexity to every consumer. Returning attributes as a JSON scalar type — rejected because it still obscures the shape from agents reading tool descriptions.
