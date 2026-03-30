#!/usr/bin/env node

import { createRequire } from "node:module";
import { Command } from "commander";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json") as { version: string };
import { registerConfigCommand } from "./commands/config.js";
import { registerCrossrefCommand } from "./commands/crossref.js";
import { registerDownCommand } from "./commands/down.js";
import { registerInitCommand } from "./commands/init.js";
import { registerIssuesCommand } from "./commands/issues.js";
import { registerMcpCommand } from "./commands/mcp.js";
import { registerOnboardCommand } from "./commands/onboard.js";
import { registerRestartCommand } from "./commands/restart.js";
import { registerServeCommand } from "./commands/serve.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerUpCommand } from "./commands/up.js";
import { registerValidateCommand } from "./commands/validate.js";
import { registerVizCommand } from "./commands/viz.js";

const program = new Command();

program
  .name("whygraph")
  .description("The graph of why — so your agent knows before it touches anything.")
  .version(version);

registerConfigCommand(program);
registerCrossrefCommand(program);
registerDownCommand(program);
registerInitCommand(program);
registerIssuesCommand(program);
registerMcpCommand(program);
registerOnboardCommand(program);
registerRestartCommand(program);
registerServeCommand(program);
registerStatusCommand(program);
registerUpCommand(program);
registerValidateCommand(program);
registerVizCommand(program);

program.parse();
