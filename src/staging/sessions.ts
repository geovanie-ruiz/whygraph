import * as fs from "node:fs/promises";
import * as path from "node:path";
import lockfile from "proper-lockfile";
import type { Session, SessionsFile } from "../core/types.js";

const SESSIONS_FILE = "sessions.json";
const LOCK_STALE = 10_000;
const LOCK_RETRIES = 3;

function sessionsPath(whygraphDir: string): string {
  return path.join(whygraphDir, SESSIONS_FILE);
}

function lockPath(whygraphDir: string): string {
  return path.join(whygraphDir, ".sessions-lock");
}

async function ensureLockTarget(whygraphDir: string): Promise<void> {
  const target = lockPath(whygraphDir);
  try {
    await fs.access(target);
  } catch {
    await fs.writeFile(target, "", "utf-8");
  }
}

async function readSessions(whygraphDir: string): Promise<SessionsFile> {
  const filePath = sessionsPath(whygraphDir);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as SessionsFile;
  } catch (err: unknown) {
    if (err instanceof SyntaxError) {
      console.error(
        "whygraph: sessions.json parse failure, treating as empty:",
        (err as Error).message,
      );
    }
    return { active: [] };
  }
}

async function writeSessions(
  whygraphDir: string,
  data: SessionsFile,
): Promise<void> {
  const filePath = sessionsPath(whygraphDir);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

async function withLock<T>(
  whygraphDir: string,
  fn: () => Promise<T>,
): Promise<T> {
  await ensureLockTarget(whygraphDir);
  const target = lockPath(whygraphDir);
  const release = await lockfile.lock(target, {
    stale: LOCK_STALE,
    retries: LOCK_RETRIES,
  });
  try {
    return await fn();
  } finally {
    await release();
  }
}

export async function register(
  whygraphDir: string,
  session: Session,
): Promise<void> {
  await withLock(whygraphDir, async () => {
    const data = await readSessions(whygraphDir);
    data.active.push(session);
    await writeSessions(whygraphDir, data);
  });
}

export async function deregister(
  whygraphDir: string,
  sessionId: string,
): Promise<void> {
  await withLock(whygraphDir, async () => {
    const data = await readSessions(whygraphDir);
    data.active = data.active.filter((s) => s.id !== sessionId);
    await writeSessions(whygraphDir, data);
  });
}

export async function getActive(whygraphDir: string): Promise<Session[]> {
  const data = await readSessions(whygraphDir);
  return data.active;
}
