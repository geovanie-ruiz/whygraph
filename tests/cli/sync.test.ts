import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runSync, findWhygraphDir, flushSessions } from "../../src/cli/commands/sync.js";
import { register } from "../../src/staging/sessions.js";
import type { Session, WhygraphConfig } from "../../src/core/types.js";

function makeWhygraphDir(tmpDir: string, configOverrides?: Partial<WhygraphConfig>): string {
  const whygraphDir = path.join(tmpDir, ".whygraph");
  fs.mkdirSync(whygraphDir, { recursive: true });
  fs.mkdirSync(path.join(whygraphDir, "staging"), { recursive: true });

  const config: WhygraphConfig = {
    appName: "test-app",
    environment: "claude-code",
    syncTrigger: "manual",
    contextInjection: "always",
    autonomy: "full",
    ...configOverrides,
  };
  fs.writeFileSync(
    path.join(whygraphDir, "config.json"),
    JSON.stringify(config),
  );
  return whygraphDir;
}

function makeSession(overrides?: Partial<Session>): Session {
  return {
    id: "session-1",
    startedAt: "2026-03-22T10:00:00.000Z",
    platform: "claude-code",
    ...overrides,
  };
}

describe("sync command", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "whygraph-sync-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("findWhygraphDir", () => {
    it("returns null when no .whygraph directory exists", () => {
      expect(findWhygraphDir(tmpDir)).toBeNull();
    });

    it("finds .whygraph in current directory", () => {
      const whygraphDir = makeWhygraphDir(tmpDir);
      expect(findWhygraphDir(tmpDir)).toBe(whygraphDir);
    });

    it("finds .whygraph in parent directory", () => {
      const whygraphDir = makeWhygraphDir(tmpDir);
      const nested = path.join(tmpDir, "a", "b", "c");
      fs.mkdirSync(nested, { recursive: true });
      expect(findWhygraphDir(nested)).toBe(whygraphDir);
    });
  });

  describe("flushSessions", () => {
    it("deregisters all active sessions", async () => {
      const whygraphDir = makeWhygraphDir(tmpDir);
      await register(whygraphDir, makeSession({ id: "s1" }));
      await register(whygraphDir, makeSession({ id: "s2" }));

      await flushSessions(whygraphDir);

      const sessionsContent = fs.readFileSync(
        path.join(whygraphDir, "sessions.json"),
        "utf-8",
      );
      const data = JSON.parse(sessionsContent);
      expect(data.active).toEqual([]);
    });
  });

  describe("runSync", () => {
    it("reports no .whygraph directory found", async () => {
      const logs: string[] = [];
      const output = await runSync(tmpDir, {}, {
        log: (msg) => logs.push(msg),
      });

      expect(output.success).toBe(false);
      expect(output.message).toBe("No .whygraph directory found.");
      expect(logs).toContain("No .whygraph directory found.");
    });

    it("outputs JSON when --json flag is set and no directory found", async () => {
      const jsonOutput: unknown[] = [];
      const output = await runSync(tmpDir, { json: true }, {
        logJson: (obj) => jsonOutput.push(obj),
        log: () => {},
      });

      expect(output.success).toBe(false);
      expect(jsonOutput).toHaveLength(1);
      expect(jsonOutput[0]).toMatchObject({ success: false });
    });

    it("exits cleanly when no staging files to process", async () => {
      makeWhygraphDir(tmpDir);
      const logs: string[] = [];
      const output = await runSync(tmpDir, {}, {
        log: (msg) => logs.push(msg),
      });

      expect(output.success).toBe(true);
      expect(output.filesProcessed).toBe(0);
      expect(output.message).toBe("No staging files to process.");
      expect(logs).toContain("No staging files to process.");
    });

    it("processes staging files and reports results", async () => {
      const whygraphDir = makeWhygraphDir(tmpDir);

      // Write a minimal staging file with a feature entry
      const stagingContent = `## [feature] Test Feature\ndescription: A test feature\n`;
      fs.writeFileSync(
        path.join(whygraphDir, "staging", "test.md"),
        stagingContent,
      );

      // Need an events.jsonl with an App node for feature to attach to
      const appEvent = JSON.stringify({
        type: "node_added",
        timestamp: "2026-03-01T00:00:00.000Z",
        id: "app-1",
        label: "App",
        properties: { name: "test-app" },
      });
      fs.writeFileSync(path.join(whygraphDir, "events.jsonl"), appEvent + "\n");

      const logs: string[] = [];
      const output = await runSync(tmpDir, {}, {
        log: (msg) => logs.push(msg),
      });

      expect(output.success).toBe(true);
      expect(output.filesProcessed).toBe(1);
      expect(output.eventsAppended).toBeGreaterThan(0);
      expect(logs[0]).toMatch(/Processed 1 staging file/);
    });

    it("prompts about active sessions in manual mode", async () => {
      const whygraphDir = makeWhygraphDir(tmpDir, { syncTrigger: "manual" });
      await register(whygraphDir, makeSession());

      const mockPrompt = vi.fn().mockResolvedValue({ action: "skip" });
      const logs: string[] = [];

      const output = await runSync(tmpDir, {}, {
        prompt: mockPrompt as unknown as typeof import("prompts").default,
        log: (msg) => logs.push(msg),
      });

      expect(mockPrompt).toHaveBeenCalledTimes(1);
      expect(mockPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "select",
          name: "action",
        }),
      );
      expect(output.message).toBe("Sync skipped — active sessions remain.");
    });

    it("proceeds when user chooses flush in prompt", async () => {
      const whygraphDir = makeWhygraphDir(tmpDir, { syncTrigger: "manual" });
      await register(whygraphDir, makeSession());

      const mockPrompt = vi.fn().mockResolvedValue({ action: "flush" });
      const logs: string[] = [];

      const output = await runSync(tmpDir, {}, {
        prompt: mockPrompt as unknown as typeof import("prompts").default,
        log: (msg) => logs.push(msg),
      });

      expect(mockPrompt).toHaveBeenCalledTimes(1);
      expect(output.message).toBe("No staging files to process.");
    });

    it("handles prompt cancellation (Ctrl-C) as skip", async () => {
      const whygraphDir = makeWhygraphDir(tmpDir, { syncTrigger: "manual" });
      await register(whygraphDir, makeSession());

      // prompts returns {} on Ctrl-C
      const mockPrompt = vi.fn().mockResolvedValue({});
      const logs: string[] = [];

      const output = await runSync(tmpDir, {}, {
        prompt: mockPrompt as unknown as typeof import("prompts").default,
        log: (msg) => logs.push(msg),
      });

      expect(output.message).toBe("Sync skipped — active sessions remain.");
    });

    it("--flush clears sessions and proceeds without prompt", async () => {
      const whygraphDir = makeWhygraphDir(tmpDir, { syncTrigger: "manual" });
      await register(whygraphDir, makeSession({ id: "s1" }));
      await register(whygraphDir, makeSession({ id: "s2" }));

      const mockPrompt = vi.fn();
      const logs: string[] = [];

      const output = await runSync(tmpDir, { flush: true }, {
        prompt: mockPrompt as unknown as typeof import("prompts").default,
        log: (msg) => logs.push(msg),
      });

      // Should NOT have prompted
      expect(mockPrompt).not.toHaveBeenCalled();
      expect(output.success).toBe(true);

      // Sessions should be flushed
      const sessionsContent = fs.readFileSync(
        path.join(whygraphDir, "sessions.json"),
        "utf-8",
      );
      const data = JSON.parse(sessionsContent);
      expect(data.active).toEqual([]);
    });

    it("does not prompt when syncTrigger is not manual", async () => {
      const whygraphDir = makeWhygraphDir(tmpDir, { syncTrigger: "hook" });
      await register(whygraphDir, makeSession());

      const mockPrompt = vi.fn();
      const logs: string[] = [];

      const output = await runSync(tmpDir, {}, {
        prompt: mockPrompt as unknown as typeof import("prompts").default,
        log: (msg) => logs.push(msg),
      });

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(output.success).toBe(true);
    });

    it("--json outputs structured JSON with results", async () => {
      makeWhygraphDir(tmpDir);
      const jsonOutput: unknown[] = [];

      const output = await runSync(tmpDir, { json: true }, {
        logJson: (obj) => jsonOutput.push(obj),
        log: () => {},
      });

      expect(jsonOutput).toHaveLength(1);
      const json = jsonOutput[0] as Record<string, unknown>;
      expect(json).toMatchObject({
        success: true,
        eventsAppended: 0,
        errorsFound: 0,
        reviewsCreated: 0,
        filesProcessed: 0,
        message: "No staging files to process.",
      });
    });

    it("reports errors in output", async () => {
      const whygraphDir = makeWhygraphDir(tmpDir);

      // Write an invalid staging file that will produce errors
      const stagingContent = `## [component] OrphanComponent
timestamp: 2026-03-23T10:00:00.000Z
name: Orphan
parent: nonexistent-uuid
description: This parent does not exist
`;
      fs.writeFileSync(
        path.join(whygraphDir, "staging", "broken.md"),
        stagingContent,
      );

      const logs: string[] = [];
      const output = await runSync(tmpDir, {}, {
        log: (msg) => logs.push(msg),
      });

      expect(output.filesProcessed).toBe(1);
      // Should report errors for the invalid parent reference
      expect(output.errorsFound).toBeGreaterThan(0);
    });
  });
});
