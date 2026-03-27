import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import * as yaml from "js-yaml";
import type { ChildProcess } from "node:child_process";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(tmpdir(), "whygraph-up-test-"));
}

function setupProject(dir: string, port = 4777): void {
  const whygraphDir = path.join(dir, ".whygraph");
  fs.mkdirSync(whygraphDir, { recursive: true });
  fs.writeFileSync(
    path.join(whygraphDir, "config.yaml"),
    yaml.dump({ serverPort: port }),
  );
}

function makeSpawner(pid = 99999) {
  const fakeChild = {
    pid,
    unref: vi.fn(),
  } as unknown as ChildProcess;
  return vi.fn().mockReturnValue(fakeChild);
}

const noopWaitForReady = vi.fn().mockResolvedValue(undefined);

describe("runUp", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    noopWaitForReady.mockReset();
    noopWaitForReady.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("throws when .whygraph not found", async () => {
    const { runUp } = await import("../../src/cli/commands/up.js");
    await expect(runUp(tempDir)).rejects.toThrow(/not found/);
  });

  it("throws when server is already running on the port", async () => {
    setupProject(tempDir, 19880);
    const serverUtils = await import("../../src/cli/commands/server-utils.js");
    vi.spyOn(serverUtils, "isServerRunning").mockReturnValue(true);

    const { runUp } = await import("../../src/cli/commands/up.js");
    await expect(runUp(tempDir, { port: 19880 })).rejects.toThrow(/already running/);
  });

  it("spawns serve process and returns url/port/pid", async () => {
    setupProject(tempDir, 19881);
    const serverUtils = await import("../../src/cli/commands/server-utils.js");
    vi.spyOn(serverUtils, "isServerRunning").mockReturnValue(false);

    const spawner = makeSpawner(54321);
    const { runUp } = await import("../../src/cli/commands/up.js");
    const result = await runUp(tempDir, {
      port: 19881,
      spawner,
      waitForReady: noopWaitForReady,
    });

    expect(spawner).toHaveBeenCalledOnce();
    expect(result.pid).toBe(54321);
    expect(result.port).toBe(19881);
    expect(result.url).toBe("http://localhost:19881");
  });

  it("uses configured port from config.yaml when no port option given", async () => {
    setupProject(tempDir, 19882);
    const serverUtils = await import("../../src/cli/commands/server-utils.js");
    vi.spyOn(serverUtils, "isServerRunning").mockReturnValue(false);

    const spawner = makeSpawner(11111);
    const { runUp } = await import("../../src/cli/commands/up.js");
    const result = await runUp(tempDir, { spawner, waitForReady: noopWaitForReady });

    expect(result.port).toBe(19882);
  });

  it("calls unref on spawned child process", async () => {
    setupProject(tempDir, 19883);
    const serverUtils = await import("../../src/cli/commands/server-utils.js");
    vi.spyOn(serverUtils, "isServerRunning").mockReturnValue(false);

    const fakeChild = { pid: 22222, unref: vi.fn() } as unknown as ChildProcess;
    const spawner = vi.fn().mockReturnValue(fakeChild);

    const { runUp } = await import("../../src/cli/commands/up.js");
    await runUp(tempDir, { port: 19883, spawner, waitForReady: noopWaitForReady });

    expect(fakeChild.unref).toHaveBeenCalledOnce();
  });
});
