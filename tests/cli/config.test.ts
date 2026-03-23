import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runConfig } from "../../src/cli/commands/config.js";
import type { WhygraphConfig } from "../../src/core/types.js";

function makeWhygraphDir(
  tmpDir: string,
  configOverrides?: Partial<WhygraphConfig>,
): string {
  const whygraphDir = path.join(tmpDir, ".whygraph");
  fs.mkdirSync(whygraphDir, { recursive: true });

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
    JSON.stringify(config, null, 2) + "\n",
  );
  return whygraphDir;
}

function readConfig(whygraphDir: string): WhygraphConfig {
  return JSON.parse(
    fs.readFileSync(path.join(whygraphDir, "config.json"), "utf-8"),
  );
}

describe("config command", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "whygraph-config-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("no .whygraph directory", () => {
    it("returns error when no .whygraph directory exists", async () => {
      const output = await runConfig(tmpDir, {});
      expect(output.success).toBe(false);
      expect(output.message).toBe("No .whygraph directory found. Run `whygraph init` first.");
    });

    it("outputs JSON error when --json flag is set", async () => {
      const jsonOutput: unknown[] = [];
      const output = await runConfig(tmpDir, { json: true }, {
        logJson: (obj) => jsonOutput.push(obj),
      });

      expect(output.success).toBe(false);
      expect(jsonOutput).toHaveLength(1);
      expect(jsonOutput[0]).toMatchObject({ success: false });
    });
  });

  describe("view current config (no flags)", () => {
    it("returns current config when no update flags provided", async () => {
      makeWhygraphDir(tmpDir);
      const logs: string[] = [];
      const output = await runConfig(tmpDir, {}, {
        log: (msg) => logs.push(msg),
      });

      expect(output.success).toBe(true);
      expect(output.config).toBeDefined();
      expect(output.config!.environment).toBe("claude-code");
      expect(output.config!.syncTrigger).toBe("manual");
      expect(output.config!.contextInjection).toBe("always");
      expect(output.config!.autonomy).toBe("full");
      expect(output.changes).toEqual({});
    });

    it("prints human-readable output", async () => {
      makeWhygraphDir(tmpDir);
      const logs: string[] = [];
      await runConfig(tmpDir, {}, { log: (msg) => logs.push(msg) });

      const joined = logs.join("\n");
      expect(joined).toContain("environment");
      expect(joined).toContain("claude-code");
    });

    it("prints JSON output with --json", async () => {
      makeWhygraphDir(tmpDir);
      const jsonOutput: unknown[] = [];
      const output = await runConfig(tmpDir, { json: true }, {
        logJson: (obj) => jsonOutput.push(obj),
      });

      expect(jsonOutput).toHaveLength(1);
      expect(output.success).toBe(true);
    });
  });

  describe("update --context-injection", () => {
    it("updates context injection to always", async () => {
      const whygraphDir = makeWhygraphDir(tmpDir, { contextInjection: "never" });
      const output = await runConfig(tmpDir, { contextInjection: "always" });

      expect(output.success).toBe(true);
      expect(output.changes).toEqual({ contextInjection: { from: "never", to: "always" } });
      expect(readConfig(whygraphDir).contextInjection).toBe("always");
    });

    it("updates context injection to ask", async () => {
      const whygraphDir = makeWhygraphDir(tmpDir, { contextInjection: "always" });
      const output = await runConfig(tmpDir, { contextInjection: "ask" });

      expect(output.success).toBe(true);
      expect(readConfig(whygraphDir).contextInjection).toBe("ask");
    });

    it("updates context injection to never", async () => {
      const whygraphDir = makeWhygraphDir(tmpDir, { contextInjection: "always" });
      const output = await runConfig(tmpDir, { contextInjection: "never" });

      expect(output.success).toBe(true);
      expect(readConfig(whygraphDir).contextInjection).toBe("never");
    });

    it("rejects invalid context injection value", async () => {
      makeWhygraphDir(tmpDir);
      const output = await runConfig(tmpDir, { contextInjection: "bogus" as any });

      expect(output.success).toBe(false);
      expect(output.message).toContain("context-injection");
      expect(output.message).toContain("always");
    });
  });

  describe("update --autonomy", () => {
    it("updates autonomy to supervised", async () => {
      const whygraphDir = makeWhygraphDir(tmpDir, { autonomy: "full" });
      const output = await runConfig(tmpDir, { autonomy: "supervised" });

      expect(output.success).toBe(true);
      expect(output.changes).toEqual({ autonomy: { from: "full", to: "supervised" } });
      expect(readConfig(whygraphDir).autonomy).toBe("supervised");
    });

    it("rejects invalid autonomy value", async () => {
      makeWhygraphDir(tmpDir);
      const output = await runConfig(tmpDir, { autonomy: "bogus" as any });

      expect(output.success).toBe(false);
      expect(output.message).toContain("autonomy");
    });
  });

  describe("update --sync-trigger", () => {
    it("updates sync trigger to git-hook", async () => {
      const whygraphDir = makeWhygraphDir(tmpDir, { syncTrigger: "manual" });
      const output = await runConfig(tmpDir, { syncTrigger: "git-hook" });

      expect(output.success).toBe(true);
      expect(output.changes).toEqual({ syncTrigger: { from: "manual", to: "git-hook" } });
      expect(readConfig(whygraphDir).syncTrigger).toBe("git-hook");
    });

    it("rejects invalid sync trigger value", async () => {
      makeWhygraphDir(tmpDir);
      const output = await runConfig(tmpDir, { syncTrigger: "bogus" as any });

      expect(output.success).toBe(false);
      expect(output.message).toContain("sync-trigger");
    });
  });

  describe("update --environment", () => {
    it("updates environment to cursor", async () => {
      const whygraphDir = makeWhygraphDir(tmpDir, { environment: "claude-code" });
      const output = await runConfig(tmpDir, { environment: "cursor" });

      expect(output.success).toBe(true);
      expect(output.changes).toEqual({ environment: { from: "claude-code", to: "cursor" } });
      expect(readConfig(whygraphDir).environment).toBe("cursor");
    });

    it("rejects invalid environment value", async () => {
      makeWhygraphDir(tmpDir);
      const output = await runConfig(tmpDir, { environment: "bogus" as any });

      expect(output.success).toBe(false);
      expect(output.message).toContain("environment");
    });
  });

  describe("multiple flags", () => {
    it("updates multiple settings at once", async () => {
      const whygraphDir = makeWhygraphDir(tmpDir);
      const output = await runConfig(tmpDir, {
        autonomy: "manual",
        syncTrigger: "hook",
      });

      expect(output.success).toBe(true);
      expect(output.changes).toEqual({
        autonomy: { from: "full", to: "manual" },
        syncTrigger: { from: "manual", to: "hook" },
      });
      const config = readConfig(whygraphDir);
      expect(config.autonomy).toBe("manual");
      expect(config.syncTrigger).toBe("hook");
    });

    it("fails entirely if any flag value is invalid", async () => {
      const whygraphDir = makeWhygraphDir(tmpDir);
      const output = await runConfig(tmpDir, {
        autonomy: "manual",
        syncTrigger: "bogus" as any,
      });

      expect(output.success).toBe(false);
      // Config should NOT have been modified
      const config = readConfig(whygraphDir);
      expect(config.autonomy).toBe("full");
    });
  });

  describe("no-op changes", () => {
    it("reports no changes when value is already set", async () => {
      makeWhygraphDir(tmpDir, { autonomy: "full" });
      const output = await runConfig(tmpDir, { autonomy: "full" });

      expect(output.success).toBe(true);
      expect(output.changes).toEqual({});
      expect(output.message).toContain("No changes");
    });
  });

  describe("preserves other config fields", () => {
    it("does not alter appName or other fields when updating", async () => {
      const whygraphDir = makeWhygraphDir(tmpDir, { appName: "my-project" } as any);
      await runConfig(tmpDir, { autonomy: "supervised" });

      const config = readConfig(whygraphDir);
      expect(config.appName).toBe("my-project");
      expect(config.autonomy).toBe("supervised");
    });
  });
});
