import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { WhyEvent, NodeAddedEvent } from "./types.js";

const EVENTS_RELATIVE_PATH = path.join(".whygraph", "events.jsonl");

/**
 * Minimal inline validation for WhyEvent.
 * Checks structural requirements: type field must be a known event type,
 * timestamp and id must be present strings.
 * Full validation will be provided by validate.ts (bead 3).
 */
function validateEvent(event: WhyEvent): void {
  const validTypes = [
    "node_added",
    "edge_added",
    "node_patched",
    "edge_removed",
    "node_removed",
  ];

  if (!event || typeof event !== "object") {
    throw new Error("Event must be a non-null object");
  }

  if (!validTypes.includes(event.type)) {
    throw new Error(`Invalid event type: ${event.type}`);
  }

  if (typeof event.timestamp !== "string" || event.timestamp === "") {
    throw new Error("Event must have a non-empty timestamp string");
  }

  if (typeof event.id !== "string" || event.id === "") {
    throw new Error("Event must have a non-empty id string");
  }
}

/**
 * Walk up from `startDir` until `.whygraph/events.jsonl` is found, or return null.
 */
export function findEventsFile(startDir: string): string | null {
  let current = path.resolve(startDir);

  while (true) {
    const candidate = path.join(current, EVENTS_RELATIVE_PATH);
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      // Reached filesystem root
      return null;
    }
    current = parent;
  }
}

/**
 * Return the path where events.jsonl should be created (does not check existence).
 */
export function getEventsFilePath(rootDir: string): string {
  return path.join(rootDir, EVENTS_RELATIVE_PATH);
}

/**
 * Parse JSONL file into WhyEvent[].
 * Skips blank lines and handles malformed lines gracefully (skip, don't throw).
 */
export function loadEvents(filePath: string): WhyEvent[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const events: WhyEvent[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    try {
      events.push(JSON.parse(trimmed) as WhyEvent);
    } catch {
      // Skip malformed lines gracefully — common with trailing incomplete writes
    }
  }

  return events;
}

/**
 * Validate then append a single event. Never writes if validation fails.
 */
export function appendEvent(filePath: string, event: WhyEvent): void {
  validateEvent(event);
  fs.appendFileSync(filePath, JSON.stringify(event) + "\n", "utf-8");
}

/**
 * Atomic batch append via single fs.appendFileSync call.
 * All events are validated before any writing occurs.
 */
export function appendEvents(filePath: string, events: WhyEvent[]): void {
  // Validate all before writing any
  for (const event of events) {
    validateEvent(event);
  }

  const payload = events.map((e) => JSON.stringify(e) + "\n").join("");
  fs.appendFileSync(filePath, payload, "utf-8");
}

/**
 * Create `.whygraph/` directory and empty `events.jsonl`,
 * append App node_added event. Throws if events.jsonl already exists.
 */
export function initEventLog(rootDir: string, appName: string): void {
  const eventsPath = getEventsFilePath(rootDir);

  if (fs.existsSync(eventsPath)) {
    throw new Error(
      `Event log already exists at ${eventsPath}. Use loadEvents() to read it.`
    );
  }

  const whygraphDir = path.dirname(eventsPath);
  fs.mkdirSync(whygraphDir, { recursive: true });
  fs.writeFileSync(eventsPath, "", "utf-8");

  const appEvent: NodeAddedEvent = {
    type: "node_added",
    timestamp: new Date().toISOString(),
    id: crypto.randomUUID(),
    label: "App",
    properties: { name: appName },
  };

  appendEvent(eventsPath, appEvent);
}
