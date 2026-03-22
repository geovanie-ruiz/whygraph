import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  register,
  deregister,
  getActive,
} from "../../src/staging/sessions.js";
import type { Session, SessionsFile } from "../../src/core/types.js";

describe("sessions", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "whygraph-sessions-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const makeSession = (overrides?: Partial<Session>): Session => ({
    id: "session-1",
    startedAt: "2026-03-22T10:00:00.000Z",
    platform: "claude-code",
    ...overrides,
  });

  describe("register", () => {
    it("adds session to sessions.json when file does not exist", async () => {
      const session = makeSession();
      await register(tmpDir, session);

      const content = fs.readFileSync(
        path.join(tmpDir, "sessions.json"),
        "utf-8",
      );
      const data: SessionsFile = JSON.parse(content);
      expect(data.active).toHaveLength(1);
      expect(data.active[0]).toEqual(session);
    });

    it("adds session to existing sessions.json", async () => {
      const session1 = makeSession({ id: "session-1" });
      const session2 = makeSession({ id: "session-2" });

      await register(tmpDir, session1);
      await register(tmpDir, session2);

      const content = fs.readFileSync(
        path.join(tmpDir, "sessions.json"),
        "utf-8",
      );
      const data: SessionsFile = JSON.parse(content);
      expect(data.active).toHaveLength(2);
      expect(data.active[0].id).toBe("session-1");
      expect(data.active[1].id).toBe("session-2");
    });

    it("handles corrupt sessions.json by treating as empty", async () => {
      fs.writeFileSync(path.join(tmpDir, "sessions.json"), "not valid json{{{");
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const session = makeSession();
      await register(tmpDir, session);

      const content = fs.readFileSync(
        path.join(tmpDir, "sessions.json"),
        "utf-8",
      );
      const data: SessionsFile = JSON.parse(content);
      expect(data.active).toHaveLength(1);
      expect(data.active[0]).toEqual(session);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("deregister", () => {
    it("removes session by id", async () => {
      const session1 = makeSession({ id: "session-1" });
      const session2 = makeSession({ id: "session-2" });

      await register(tmpDir, session1);
      await register(tmpDir, session2);
      await deregister(tmpDir, "session-1");

      const content = fs.readFileSync(
        path.join(tmpDir, "sessions.json"),
        "utf-8",
      );
      const data: SessionsFile = JSON.parse(content);
      expect(data.active).toHaveLength(1);
      expect(data.active[0].id).toBe("session-2");
    });

    it("does nothing when session id not found", async () => {
      const session = makeSession();
      await register(tmpDir, session);
      await deregister(tmpDir, "nonexistent");

      const data: SessionsFile = JSON.parse(
        fs.readFileSync(path.join(tmpDir, "sessions.json"), "utf-8"),
      );
      expect(data.active).toHaveLength(1);
    });

    it("handles missing file gracefully", async () => {
      await deregister(tmpDir, "session-1");
      // Should create the file with empty sessions
      const content = fs.readFileSync(
        path.join(tmpDir, "sessions.json"),
        "utf-8",
      );
      const data: SessionsFile = JSON.parse(content);
      expect(data.active).toEqual([]);
    });
  });

  describe("getActive", () => {
    it("returns empty array when file does not exist", async () => {
      const result = await getActive(tmpDir);
      expect(result).toEqual([]);
    });

    it("returns active sessions", async () => {
      const session1 = makeSession({ id: "session-1" });
      const session2 = makeSession({ id: "session-2" });

      await register(tmpDir, session1);
      await register(tmpDir, session2);

      const result = await getActive(tmpDir);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("session-1");
      expect(result[1].id).toBe("session-2");
    });

    it("handles corrupt sessions.json by returning empty array", async () => {
      fs.writeFileSync(path.join(tmpDir, "sessions.json"), "corrupt data");
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await getActive(tmpDir);
      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
