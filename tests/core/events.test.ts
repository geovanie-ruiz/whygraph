import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  loadEvents,
  appendEvent,
  appendEvents,
  initEventLog,
  findEventsFile,
  getEventsFilePath,
} from "../../src/core/events.js";
import type { WhyEvent, NodeAddedEvent } from "../../src/core/types.js";

let tmpDir: string;

function setupEventsFile(content: string): string {
  const whygraphDir = path.join(tmpDir, ".whygraph");
  fs.mkdirSync(whygraphDir, { recursive: true });
  const filePath = path.join(whygraphDir, "events.jsonl");
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

function makeAppEvent(id = "abc-123", name = "TestApp"): NodeAddedEvent {
  return {
    type: "node_added",
    timestamp: "2026-03-22T00:00:00Z",
    id,
    label: "App",
    properties: { name },
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "whygraph-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("loadEvents", () => {
  it("parses valid JSONL correctly", () => {
    const event1 = makeAppEvent("abc-123", "TestApp");
    const event2 = makeAppEvent("def-456", "Auth");
    event2.label = "Feature";
    const filePath = setupEventsFile(
      JSON.stringify(event1) + "\n" + JSON.stringify(event2) + "\n"
    );

    const events = loadEvents(filePath);

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual(event1);
    expect(events[1]).toEqual(event2);
  });

  it("skips blank lines", () => {
    const event = makeAppEvent();
    const filePath = setupEventsFile(
      "\n" + JSON.stringify(event) + "\n\n  \n"
    );

    const events = loadEvents(filePath);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(event);
  });

  it("handles malformed trailing line gracefully", () => {
    const event = makeAppEvent();
    const filePath = setupEventsFile(
      JSON.stringify(event) + "\n{malformed json\n"
    );

    const events = loadEvents(filePath);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(event);
  });
});

describe("appendEvent", () => {
  it("rejects invalid event and does not write", () => {
    const filePath = setupEventsFile("");
    const invalid = { foo: "bar" } as unknown as WhyEvent;

    expect(() => appendEvent(filePath, invalid)).toThrow();

    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toBe("");
  });

  it("correctly appends a valid event with trailing newline", () => {
    const filePath = setupEventsFile("");
    const event = makeAppEvent();

    appendEvent(filePath, event);

    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toBe(JSON.stringify(event) + "\n");
    expect(content.endsWith("\n")).toBe(true);
  });
});

describe("appendEvents", () => {
  it("writes all events in one fs.appendFile call", () => {
    const filePath = setupEventsFile("");
    const event1 = makeAppEvent("id-1", "App1");
    const event2 = makeAppEvent("id-2", "App2");

    appendEvents(filePath, [event1, event2]);

    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toBe(
      JSON.stringify(event1) + "\n" + JSON.stringify(event2) + "\n"
    );

    // Verify loadEvents can round-trip the result
    const loaded = loadEvents(filePath);
    expect(loaded).toHaveLength(2);
    expect(loaded[0]).toEqual(event1);
    expect(loaded[1]).toEqual(event2);
  });

  it("validates all events before writing any", () => {
    const filePath = setupEventsFile("");
    const valid = makeAppEvent("id-1", "App1");
    const invalid = { foo: "bar" } as unknown as WhyEvent;

    expect(() => appendEvents(filePath, [valid, invalid])).toThrow();

    // Nothing should have been written since validation happens first
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toBe("");
  });
});

describe("initEventLog", () => {
  it("creates .whygraph/ directory and events.jsonl", () => {
    initEventLog(tmpDir, "MyApp");

    const eventsPath = path.join(tmpDir, ".whygraph", "events.jsonl");
    expect(fs.existsSync(eventsPath)).toBe(true);
  });

  it("appends App node_added event", () => {
    initEventLog(tmpDir, "MyApp");

    const eventsPath = path.join(tmpDir, ".whygraph", "events.jsonl");
    const events = loadEvents(eventsPath);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("node_added");
    const nodeEvent = events[0] as NodeAddedEvent;
    expect(nodeEvent.label).toBe("App");
    expect(nodeEvent.properties).toHaveProperty("name", "MyApp");
  });

  it("throws if events.jsonl already exists", () => {
    setupEventsFile("");

    expect(() => initEventLog(tmpDir, "MyApp")).toThrow();
  });
});

describe("findEventsFile", () => {
  it("finds .whygraph/events.jsonl in the given directory", () => {
    setupEventsFile("");

    const result = findEventsFile(tmpDir);

    expect(result).toBe(path.join(tmpDir, ".whygraph", "events.jsonl"));
  });

  it("walks up directory tree to find .whygraph/events.jsonl", () => {
    setupEventsFile("");
    const nested = path.join(tmpDir, "a", "b", "c");
    fs.mkdirSync(nested, { recursive: true });

    const result = findEventsFile(nested);

    expect(result).toBe(path.join(tmpDir, ".whygraph", "events.jsonl"));
  });

  it("returns null when no events file found", () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "whygraph-empty-"));

    try {
      const result = findEventsFile(emptyDir);
      expect(result).toBeNull();
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});

describe("getEventsFilePath", () => {
  it("returns path where events.jsonl should be created", () => {
    const result = getEventsFilePath(tmpDir);
    expect(result).toBe(path.join(tmpDir, ".whygraph", "events.jsonl"));
  });
});
