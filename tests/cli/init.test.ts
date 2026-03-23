import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runInit } from "../../src/cli/commands/init.js";
import type { WhygraphConfig } from "../../src/core/types.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "whygraph-init-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const defaultAnswers = {
  appName: "TestApp",
  environment: "claude-code" as const,
  syncTrigger: "hook" as const,
  contextInjection: "always" as const,
  autonomy: "full" as const,
};

describe("runInit", () => {
  describe("directory structure creation", () => {
    it("creates .whygraph directory with all required files", async () => {
      const result = await runInit(tmpDir, defaultAnswers);

      expect(fs.existsSync(path.join(tmpDir, ".whygraph"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".whygraph", "events.jsonl"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".whygraph", "staging"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".whygraph", "config.json"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".whygraph", "sessions.json"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".whygraph", "reviews.jsonl"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".whygraph", "errors.jsonl"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".whygraph", "viz"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".whygraph", ".gitignore"))).toBe(true);
      expect(result.created).toContain("events.jsonl");
    });

    it("creates config.json with collected preferences", async () => {
      await runInit(tmpDir, defaultAnswers);

      const config: WhygraphConfig = JSON.parse(
        fs.readFileSync(path.join(tmpDir, ".whygraph", "config.json"), "utf-8"),
      );

      expect(config.appName).toBe("TestApp");
      expect(config.environment).toBe("claude-code");
      expect(config.syncTrigger).toBe("hook");
      expect(config.contextInjection).toBe("always");
      expect(config.autonomy).toBe("full");
    });

    it("creates sessions.json with empty active array", async () => {
      await runInit(tmpDir, defaultAnswers);

      const sessions = JSON.parse(
        fs.readFileSync(path.join(tmpDir, ".whygraph", "sessions.json"), "utf-8"),
      );

      expect(sessions).toEqual({ active: [] });
    });

    it("creates empty reviews.jsonl and errors.jsonl", async () => {
      await runInit(tmpDir, defaultAnswers);

      const reviews = fs.readFileSync(
        path.join(tmpDir, ".whygraph", "reviews.jsonl"),
        "utf-8",
      );
      const errors = fs.readFileSync(
        path.join(tmpDir, ".whygraph", "errors.jsonl"),
        "utf-8",
      );

      expect(reviews).toBe("");
      expect(errors).toBe("");
    });
  });

  describe("events.jsonl App event", () => {
    it("writes App node_added event to events.jsonl", async () => {
      await runInit(tmpDir, defaultAnswers);

      const content = fs.readFileSync(
        path.join(tmpDir, ".whygraph", "events.jsonl"),
        "utf-8",
      );
      const lines = content.trim().split("\n");
      expect(lines).toHaveLength(1);

      const event = JSON.parse(lines[0]);
      expect(event.type).toBe("node_added");
      expect(event.label).toBe("App");
      expect(event.properties.name).toBe("TestApp");
      expect(event.id).toBeTruthy();
      expect(event.timestamp).toBeTruthy();
    });
  });

  describe(".gitignore", () => {
    it("ignores correct transient files", async () => {
      await runInit(tmpDir, defaultAnswers);

      const gitignore = fs.readFileSync(
        path.join(tmpDir, ".whygraph", ".gitignore"),
        "utf-8",
      );

      expect(gitignore).toContain("staging/");
      expect(gitignore).toContain("sessions.json");
      expect(gitignore).toContain("errors.jsonl");
      expect(gitignore).toContain(".lock");
      expect(gitignore).toContain(".sessions-lock");
    });
  });

  describe("idempotency", () => {
    it("repairs missing files without destroying existing data", async () => {
      // First init
      await runInit(tmpDir, defaultAnswers);

      // Read original events
      const originalEvents = fs.readFileSync(
        path.join(tmpDir, ".whygraph", "events.jsonl"),
        "utf-8",
      );

      // Modify config to have different value
      const configPath = path.join(tmpDir, ".whygraph", "config.json");
      const originalConfig = fs.readFileSync(configPath, "utf-8");

      // Delete some files to simulate corruption
      fs.unlinkSync(path.join(tmpDir, ".whygraph", "sessions.json"));
      fs.rmSync(path.join(tmpDir, ".whygraph", "viz"), { recursive: true });

      // Second init
      const result = await runInit(tmpDir, defaultAnswers);

      // events.jsonl should NOT be overwritten
      const afterEvents = fs.readFileSync(
        path.join(tmpDir, ".whygraph", "events.jsonl"),
        "utf-8",
      );
      expect(afterEvents).toBe(originalEvents);

      // config.json should NOT be overwritten
      const afterConfig = fs.readFileSync(configPath, "utf-8");
      expect(afterConfig).toBe(originalConfig);

      // Missing files should be repaired
      expect(fs.existsSync(path.join(tmpDir, ".whygraph", "sessions.json"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".whygraph", "viz"))).toBe(true);

      expect(result.repaired.length).toBeGreaterThan(0);
    });

    it("does not duplicate App event on re-init", async () => {
      await runInit(tmpDir, defaultAnswers);
      await runInit(tmpDir, defaultAnswers);

      const content = fs.readFileSync(
        path.join(tmpDir, ".whygraph", "events.jsonl"),
        "utf-8",
      );
      const lines = content.trim().split("\n");
      expect(lines).toHaveLength(1);
    });
  });

  describe("--json output", () => {
    it("returns structured result object", async () => {
      const result = await runInit(tmpDir, defaultAnswers);

      expect(result).toHaveProperty("created");
      expect(result).toHaveProperty("repaired");
      expect(result).toHaveProperty("skipped");
      expect(Array.isArray(result.created)).toBe(true);
      expect(Array.isArray(result.repaired)).toBe(true);
      expect(Array.isArray(result.skipped)).toBe(true);
    });

    it("reports all created files on fresh init", async () => {
      const result = await runInit(tmpDir, defaultAnswers);

      expect(result.created.length).toBeGreaterThan(0);
      expect(result.repaired).toHaveLength(0);
    });

    it("reports repaired and skipped on re-init", async () => {
      await runInit(tmpDir, defaultAnswers);

      // Delete one file
      fs.unlinkSync(path.join(tmpDir, ".whygraph", "sessions.json"));

      const result = await runInit(tmpDir, defaultAnswers);

      expect(result.repaired).toContain("sessions.json");
      expect(result.skipped.length).toBeGreaterThan(0);
    });
  });

  describe("different config values", () => {
    it("accepts cursor environment", async () => {
      const answers = { ...defaultAnswers, environment: "cursor" as const };
      await runInit(tmpDir, answers);

      const config: WhygraphConfig = JSON.parse(
        fs.readFileSync(path.join(tmpDir, ".whygraph", "config.json"), "utf-8"),
      );
      expect(config.environment).toBe("cursor");
    });

    it("accepts manual sync trigger", async () => {
      const answers = { ...defaultAnswers, syncTrigger: "manual" as const };
      await runInit(tmpDir, answers);

      const config: WhygraphConfig = JSON.parse(
        fs.readFileSync(path.join(tmpDir, ".whygraph", "config.json"), "utf-8"),
      );
      expect(config.syncTrigger).toBe("manual");
    });
  });
});
