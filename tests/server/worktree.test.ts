import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseWorktreeList, detectWorktrees } from "../../src/server/worktree.js";
import type { WorktreeInfo } from "../../src/server/worktree.js";

describe("parseWorktreeList", () => {
  it("parses porcelain output with multiple worktrees", () => {
    const output = [
      "worktree /Users/geo/project",
      "HEAD abc1234567890abcdef1234567890abcdef123456",
      "branch refs/heads/main",
      "",
      "worktree /Users/geo/project/.claude/worktrees/agent-abc",
      "HEAD def4567890abcdef1234567890abcdef1234567890",
      "branch refs/heads/feature-branch",
      "",
    ].join("\n");

    const result = parseWorktreeList(output);

    expect(result).toEqual([
      {
        path: "/Users/geo/project",
        branch: "main",
        isMain: true,
      },
      {
        path: "/Users/geo/project/.claude/worktrees/agent-abc",
        branch: "feature-branch",
        isMain: false,
      },
    ]);
  });

  it("returns empty array when no worktrees exist", () => {
    const result = parseWorktreeList("");
    expect(result).toEqual([]);
  });

  it("handles detached HEAD worktrees gracefully", () => {
    const output = [
      "worktree /Users/geo/project",
      "HEAD abc1234567890abcdef1234567890abcdef123456",
      "branch refs/heads/main",
      "",
      "worktree /Users/geo/project/.claude/worktrees/agent-xyz",
      "HEAD def4567890abcdef1234567890abcdef1234567890",
      "detached",
      "",
    ].join("\n");

    const result = parseWorktreeList(output);

    expect(result).toEqual([
      {
        path: "/Users/geo/project",
        branch: "main",
        isMain: true,
      },
      {
        path: "/Users/geo/project/.claude/worktrees/agent-xyz",
        branch: null,
        isMain: false,
      },
    ]);
  });

  it("marks only the first worktree as main", () => {
    const output = [
      "worktree /Users/geo/project",
      "HEAD abc1234567890abcdef1234567890abcdef123456",
      "branch refs/heads/main",
      "",
      "worktree /tmp/wt-1",
      "HEAD 1111111111111111111111111111111111111111",
      "branch refs/heads/feat-a",
      "",
      "worktree /tmp/wt-2",
      "HEAD 2222222222222222222222222222222222222222",
      "branch refs/heads/feat-b",
      "",
    ].join("\n");

    const result = parseWorktreeList(output);

    expect(result[0].isMain).toBe(true);
    expect(result[1].isMain).toBe(false);
    expect(result[2].isMain).toBe(false);
  });
});

describe("detectWorktrees", () => {
  const mockExecFile = vi.fn();
  const mockAccess = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns worktrees that have .whygraph/graph/", async () => {
    const porcelainOutput = [
      "worktree /Users/geo/project",
      "HEAD abc1234567890abcdef1234567890abcdef123456",
      "branch refs/heads/main",
      "",
      "worktree /tmp/wt-agent-1",
      "HEAD 1111111111111111111111111111111111111111",
      "branch refs/heads/feat-a",
      "",
      "worktree /tmp/wt-agent-2",
      "HEAD 2222222222222222222222222222222222222222",
      "branch refs/heads/feat-b",
      "",
    ].join("\n");

    mockExecFile.mockResolvedValue({ stdout: porcelainOutput, stderr: "" });
    // wt-agent-1 has .whygraph/graph/, wt-agent-2 does not
    mockAccess
      .mockResolvedValueOnce(undefined) // /tmp/wt-agent-1/.whygraph/graph/ exists
      .mockRejectedValueOnce(new Error("ENOENT")); // /tmp/wt-agent-2/.whygraph/graph/ missing

    const result = await detectWorktrees("/Users/geo/project", {
      execFile: mockExecFile,
      access: mockAccess,
    });

    expect(result).toEqual([
      {
        path: "/tmp/wt-agent-1",
        branch: "feat-a",
        graphDir: "/tmp/wt-agent-1/.whygraph/graph",
      },
    ]);
  });

  it("excludes the main worktree", async () => {
    const porcelainOutput = [
      "worktree /Users/geo/project",
      "HEAD abc1234567890abcdef1234567890abcdef123456",
      "branch refs/heads/main",
      "",
    ].join("\n");

    mockExecFile.mockResolvedValue({ stdout: porcelainOutput, stderr: "" });

    const result = await detectWorktrees("/Users/geo/project", {
      execFile: mockExecFile,
      access: mockAccess,
    });

    expect(result).toEqual([]);
    expect(mockAccess).not.toHaveBeenCalled();
  });

  it("returns empty array when git command fails", async () => {
    mockExecFile.mockRejectedValue(new Error("not a git repository"));

    const result = await detectWorktrees("/tmp/not-a-repo", {
      execFile: mockExecFile,
      access: mockAccess,
    });

    expect(result).toEqual([]);
  });

  it("skips detached HEAD worktrees", async () => {
    const porcelainOutput = [
      "worktree /Users/geo/project",
      "HEAD abc1234567890abcdef1234567890abcdef123456",
      "branch refs/heads/main",
      "",
      "worktree /tmp/wt-detached",
      "HEAD 1111111111111111111111111111111111111111",
      "detached",
      "",
    ].join("\n");

    mockExecFile.mockResolvedValue({ stdout: porcelainOutput, stderr: "" });

    const result = await detectWorktrees("/Users/geo/project", {
      execFile: mockExecFile,
      access: mockAccess,
    });

    expect(result).toEqual([]);
    expect(mockAccess).not.toHaveBeenCalled();
  });

  it("returns empty array when no worktrees have .whygraph/graph/", async () => {
    const porcelainOutput = [
      "worktree /Users/geo/project",
      "HEAD abc1234567890abcdef1234567890abcdef123456",
      "branch refs/heads/main",
      "",
      "worktree /tmp/wt-no-graph",
      "HEAD 1111111111111111111111111111111111111111",
      "branch refs/heads/feat-a",
      "",
    ].join("\n");

    mockExecFile.mockResolvedValue({ stdout: porcelainOutput, stderr: "" });
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const result = await detectWorktrees("/Users/geo/project", {
      execFile: mockExecFile,
      access: mockAccess,
    });

    expect(result).toEqual([]);
  });
});
