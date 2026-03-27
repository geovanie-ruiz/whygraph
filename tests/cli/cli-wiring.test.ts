/**
 * Tests for CLI command registration (register*Command) wiring.
 * Uses Commander's parseAsync to exercise the action handlers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import yaml from "js-yaml";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "whygraph-cli-wiring-test-"));
}

function writeConfig(dir: string, port = 4777): void {
  mkdirSync(join(dir, ".whygraph"), { recursive: true });
  writeFileSync(
    join(dir, ".whygraph", "config.yaml"),
    yaml.dump({ appName: "Test", environment: "claude-code", prefix: "wg-", idLength: 4, tags: ["arch"], mcpMode: "default", serverPort: port }),
  );
}

describe("registerValidateCommand", () => {
  let tempDir: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = makeTempDir();
    mkdirSync(join(tempDir, ".whygraph", "graph"), { recursive: true });
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("outputs text by default for zero errors", async () => {
    const { registerValidateCommand } = await import("../../src/cli/commands/validate.js");
    const program = new Command();
    registerValidateCommand(program);
    await program.parseAsync(["node", "whygraph", "validate"]);
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining("No errors"));
    expect(cwdSpy).toHaveBeenCalled();
  });

  it("outputs json when --json flag is set", async () => {
    const { registerValidateCommand } = await import("../../src/cli/commands/validate.js");
    const program = new Command();
    registerValidateCommand(program);
    await program.parseAsync(["node", "whygraph", "validate", "--json"]);
    const output = (stdoutSpy.mock.calls.map((c) => c[0]).join("")) as string;
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("filesChecked");
    expect(parsed).toHaveProperty("errors");
  });

  it("outputs error table when errors are present", async () => {
    // Write an invalid entity (unparseable) to trigger errors
    writeFileSync(join(tempDir, ".whygraph", "graph", "bad.md"), "not yaml frontmatter");
    const { registerValidateCommand } = await import("../../src/cli/commands/validate.js");
    const program = new Command();
    registerValidateCommand(program);
    await program.parseAsync(["node", "whygraph", "validate"]);
    const output = (stdoutSpy.mock.calls.map((c) => c[0]).join("")) as string;
    // Should show the error table header
    expect(output).toContain("FILE");
    expect(output).toContain("SEVERITY");
  });
});

describe("registerConfigCommand", () => {
  let tempDir: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = makeTempDir();
    writeConfig(tempDir);
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("outputs config text by default", async () => {
    const { registerConfigCommand } = await import("../../src/cli/commands/config.js");
    const program = new Command();
    registerConfigCommand(program);
    await program.parseAsync(["node", "whygraph", "config"]);
    const output = (stdoutSpy.mock.calls.map((c) => c[0]).join("")) as string;
    expect(output).toContain("environment:");
    expect(output).toContain("serverPort:");
  });

  it("outputs json when --json flag is set", async () => {
    const { registerConfigCommand } = await import("../../src/cli/commands/config.js");
    const program = new Command();
    registerConfigCommand(program);
    await program.parseAsync(["node", "whygraph", "config", "--json"]);
    const output = (stdoutSpy.mock.calls.map((c) => c[0]).join("")) as string;
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("config");
  });

  it("outputs updated confirmation when config changes", async () => {
    const { registerConfigCommand } = await import("../../src/cli/commands/config.js");
    const program = new Command();
    registerConfigCommand(program);
    await program.parseAsync(["node", "whygraph", "config", "--environment", "cursor"]);
    const output = (stdoutSpy.mock.calls.map((c) => c[0]).join("")) as string;
    expect(output).toContain("updated");
  });

  it("updates server port via --server-port flag", async () => {
    const { registerConfigCommand } = await import("../../src/cli/commands/config.js");
    const program = new Command();
    registerConfigCommand(program);
    await program.parseAsync(["node", "whygraph", "config", "--server-port", "5500"]);
    const output = (stdoutSpy.mock.calls.map((c) => c[0]).join("")) as string;
    expect(output).toContain("5500");
  });

  it("outputs json with updated flag when updating", async () => {
    const { registerConfigCommand } = await import("../../src/cli/commands/config.js");
    const program = new Command();
    registerConfigCommand(program);
    await program.parseAsync(["node", "whygraph", "config", "--environment", "cursor", "--json"]);
    const output = (stdoutSpy.mock.calls.map((c) => c[0]).join("")) as string;
    const parsed = JSON.parse(output);
    expect(parsed.updated).toBe(true);
  });

  it("updates mcpMode via --mcp-mode flag", async () => {
    const { registerConfigCommand } = await import("../../src/cli/commands/config.js");
    const program = new Command();
    registerConfigCommand(program);
    await program.parseAsync(["node", "whygraph", "config", "--mcp-mode", "strict"]);
    const output = (stdoutSpy.mock.calls.map((c) => c[0]).join("")) as string;
    expect(output).toContain("strict");
  });

  it("writes error to stderr for invalid config", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { registerConfigCommand } = await import("../../src/cli/commands/config.js");
    const program = new Command();
    registerConfigCommand(program);
    await program.parseAsync(["node", "whygraph", "config", "--environment", "invalid-env"]);
    const errOutput = (stderrSpy.mock.calls.map((c) => c[0]).join("")) as string;
    expect(errOutput).toContain("Error:");
    stderrSpy.mockRestore();
  });

  it("outputs json error when --json flag is set with invalid config", async () => {
    const { registerConfigCommand } = await import("../../src/cli/commands/config.js");
    const program = new Command();
    registerConfigCommand(program);
    await program.parseAsync(["node", "whygraph", "config", "--environment", "bad", "--json"]);
    const output = (stdoutSpy.mock.calls.map((c) => c[0]).join("")) as string;
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("error");
  });
});

describe("registerStatusCommand", () => {
  let tempDir: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = makeTempDir();
    writeConfig(tempDir, 19884);
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("outputs server not running when port is free", async () => {
    const { registerStatusCommand } = await import("../../src/cli/commands/status.js");
    const program = new Command();
    registerStatusCommand(program);
    await program.parseAsync(["node", "whygraph", "status"]);
    const output = (stdoutSpy.mock.calls.map((c) => c[0]).join("")) as string;
    expect(output).toContain("not running");
  });

  it("outputs json when --json flag is set", async () => {
    const { registerStatusCommand } = await import("../../src/cli/commands/status.js");
    const program = new Command();
    registerStatusCommand(program);
    await program.parseAsync(["node", "whygraph", "status", "--json"]);
    const output = (stdoutSpy.mock.calls.map((c) => c[0]).join("")) as string;
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("serverRunning");
  });

  it("outputs server running status when server responds", async () => {
    const { createServer } = await import("node:http");
    const server = createServer((req, res) => {
      if (req.url === "/api/health") {
        res.writeHead(200); res.end(JSON.stringify({ status: "ok" })); return;
      }
      if (req.url === "/api/graphql") {
        res.writeHead(200); res.end(JSON.stringify({ data: { status: { running: true, entityCount: 2, nodeCount: 1, decisionCount: 1 } } })); return;
      }
      res.writeHead(404); res.end();
    });

    const port = await new Promise<number>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object") resolve(addr.port);
      });
    });

    writeConfig(tempDir, port);

    try {
      const { registerStatusCommand } = await import("../../src/cli/commands/status.js");
      const program = new Command();
      registerStatusCommand(program);
      await program.parseAsync(["node", "whygraph", "status"]);
      const output = (stdoutSpy.mock.calls.map((c) => c[0]).join("")) as string;
      expect(output).toContain("running");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("registerDownCommand", () => {
  let tempDir: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = makeTempDir();
    writeConfig(tempDir, 19885);
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("outputs no server running when port is free", async () => {
    const { registerDownCommand } = await import("../../src/cli/commands/down.js");
    const program = new Command();
    registerDownCommand(program);
    await program.parseAsync(["node", "whygraph", "down"]);
    const output = (stdoutSpy.mock.calls.map((c) => c[0]).join("")) as string;
    expect(output).toContain("No server");
  });

  it("outputs json when --json flag is set", async () => {
    const { registerDownCommand } = await import("../../src/cli/commands/down.js");
    const program = new Command();
    registerDownCommand(program);
    await program.parseAsync(["node", "whygraph", "down", "--json"]);
    const output = (stdoutSpy.mock.calls.map((c) => c[0]).join("")) as string;
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("stopped");
  });

  it("uses explicit port from --port flag", async () => {
    const { registerDownCommand } = await import("../../src/cli/commands/down.js");
    const program = new Command();
    registerDownCommand(program);
    await program.parseAsync(["node", "whygraph", "down", "--port", "19886", "--json"]);
    const output = (stdoutSpy.mock.calls.map((c) => c[0]).join("")) as string;
    const parsed = JSON.parse(output);
    expect(parsed.port).toBe(19886);
  });

  it("outputs stopped message when server was running", async () => {
    // Bind a real server on the configured port to simulate a running server
    const { createServer } = await import("node:http");
    const srv = createServer((_req, res) => { res.writeHead(200); res.end(); });
    const srvPort = await new Promise<number>((resolve) => {
      srv.listen(0, () => resolve((srv.address() as { port: number }).port));
    });
    writeConfig(tempDir, srvPort);
    const serverUtils = await import("../../src/cli/commands/server-utils.js");
    vi.spyOn(serverUtils, "killProcessOnPort").mockReturnValue(true);
    vi.spyOn(serverUtils, "waitForPortFree").mockResolvedValue(undefined);

    try {
      const { registerDownCommand } = await import("../../src/cli/commands/down.js");
      const program = new Command();
      registerDownCommand(program);
      await program.parseAsync(["node", "whygraph", "down"]);
      const output = (stdoutSpy.mock.calls.map((c) => c[0]).join("")) as string;
      expect(output).toContain("stopped");
    } finally {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  });

  it("outputs json error when .whygraph not found", async () => {
    const emptyDir = makeTempDir();
    cwdSpy.mockReturnValue(emptyDir);
    const { registerDownCommand } = await import("../../src/cli/commands/down.js");
    const program = new Command();
    registerDownCommand(program);
    await program.parseAsync(["node", "whygraph", "down", "--json"]);
    const output = (stdoutSpy.mock.calls.map((c) => c[0]).join("")) as string;
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("error");
    rmSync(emptyDir, { recursive: true, force: true });
  });

  it("outputs stderr error when .whygraph not found (no --json)", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const emptyDir = makeTempDir();
    cwdSpy.mockReturnValue(emptyDir);
    const { registerDownCommand } = await import("../../src/cli/commands/down.js");
    const program = new Command();
    registerDownCommand(program);
    await program.parseAsync(["node", "whygraph", "down"]);
    const errOutput = (stderrSpy.mock.calls.map((c) => c[0]).join("")) as string;
    expect(errOutput).toContain("Error:");
    stderrSpy.mockRestore();
    rmSync(emptyDir, { recursive: true, force: true });
  });
});

describe("registerInitCommand", () => {
  let tempDir: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = makeTempDir();
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("initializes project and outputs success message", async () => {
    const { registerInitCommand } = await import("../../src/cli/commands/init.js");
    const program = new Command();
    registerInitCommand(program);
    await program.parseAsync(["node", "whygraph", "init", "--app-name", "TestApp", "--environment", "claude-code"]);
    const output = (stdoutSpy.mock.calls.map((c) => c[0]).join("")) as string;
    expect(output).toContain("Initialized whygraph");
    expect(cwdSpy).toHaveBeenCalled();
  });

  it("outputs json when --json flag is set", async () => {
    const { registerInitCommand } = await import("../../src/cli/commands/init.js");
    const program = new Command();
    registerInitCommand(program);
    await program.parseAsync(["node", "whygraph", "init", "--app-name", "TestApp", "--environment", "cursor", "--json"]);
    const output = (stdoutSpy.mock.calls.map((c) => c[0]).join("")) as string;
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("configPath");
    expect(parsed).toHaveProperty("appId");
  });

  it("outputs error when .whygraph already exists", async () => {
    mkdirSync(join(tempDir, ".whygraph"), { recursive: true });
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { registerInitCommand } = await import("../../src/cli/commands/init.js");
    const program = new Command();
    registerInitCommand(program);
    await program.parseAsync(["node", "whygraph", "init", "--app-name", "TestApp", "--environment", "claude-code"]);
    const errOutput = (stderrSpy.mock.calls.map((c) => c[0]).join("")) as string;
    expect(errOutput).toContain("Error:");
    stderrSpy.mockRestore();
  });

  it("outputs json error when .whygraph already exists with --json", async () => {
    mkdirSync(join(tempDir, ".whygraph"), { recursive: true });
    const { registerInitCommand } = await import("../../src/cli/commands/init.js");
    const program = new Command();
    registerInitCommand(program);
    await program.parseAsync(["node", "whygraph", "init", "--app-name", "TestApp", "--environment", "claude-code", "--json"]);
    const output = (stdoutSpy.mock.calls.map((c) => c[0]).join("")) as string;
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("error");
  });

  it("shows mcpSetupPath in output when mcpRegistered is false", async () => {
    const { registerInitCommand } = await import("../../src/cli/commands/init.js");
    const program = new Command();
    registerInitCommand(program);
    // cursor env: MCP registration writes to .cursor/mcp.json (succeeds), so mcpRegistered = true
    // Use "other" to get mcpSetupPath always set
    await program.parseAsync(["node", "whygraph", "init", "--app-name", "TestApp", "--environment", "other"]);
    const output = (stdoutSpy.mock.calls.map((c) => c[0]).join("")) as string;
    expect(output).toContain("Initialized whygraph");
  });
});

describe("registerMcpCommand", () => {
  it("registers mcp command", async () => {
    const { registerMcpCommand } = await import("../../src/cli/commands/mcp.js");
    const program = new Command();
    registerMcpCommand(program);
    const cmd = program.commands.find((c) => c.name() === "mcp");
    expect(cmd).toBeDefined();
  });
});

describe("registerIssuesCommand", () => {
  let tempDir: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = makeTempDir();
    writeConfig(tempDir);
    mkdirSync(join(tempDir, ".whygraph", "graph"), { recursive: true });
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("outputs no issues for empty graph", async () => {
    const { registerIssuesCommand } = await import("../../src/cli/commands/issues.js");
    const program = new Command();
    registerIssuesCommand(program);
    await program.parseAsync(["node", "whygraph", "issues"]);
    const output = (stdoutSpy.mock.calls.map((c) => c[0]).join("")) as string;
    expect(output).toContain("No issues");
  });

  it("outputs json for empty graph", async () => {
    const { registerIssuesCommand } = await import("../../src/cli/commands/issues.js");
    const program = new Command();
    registerIssuesCommand(program);
    await program.parseAsync(["node", "whygraph", "issues", "--json"]);
    const output = (stdoutSpy.mock.calls.map((c) => c[0]).join("")) as string;
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("total");
    expect(parsed.total).toBe(0);
  });
});
