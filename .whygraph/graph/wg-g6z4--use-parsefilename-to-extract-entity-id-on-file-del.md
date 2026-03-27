---
id: wg-g6z4
label: Decision
title: Use parseFilename to extract entity ID on file deletion
status: active
date: "2026-03-26"
affects:
  - wg-fwat
tags:
  - arch
created_at: "2026-03-27T04:09:50.776Z"
updated_at: "2026-03-27T04:09:50.776Z"
---
## Context

The FileWatcher unlink handler needed to extract the entity ID from the deleted filename so ServerCore could remove the entity from the in-memory graph. Filenames follow the format id--slugified-name.md (e.g. wg-gwqi--fallbackfeature.md), but the entity ID is only the prefix before the double-dash (wg-gwqi).

## Decision

Use parseFilename() from entity/id.ts in the unlink handler instead of path.basename(filePath, ".md"). parseFilename already handles the id--slug format and returns just the entity ID.

## Tradeoffs

Reuses existing parsing logic rather than duplicating it. The only risk is that parseFilename returns null for non-entity .md files, but that case is handled with ?? undefined, which simply omits entityId from the event — the same behavior as before for non-matching files.

## Alternatives

Inline the double-dash split (filePath.split("--")[0]) — rejected because it duplicates logic already in parseFilename and is less defensive. Reading the file content to get the ID — rejected because the file no longer exists at the time of the unlink event.
