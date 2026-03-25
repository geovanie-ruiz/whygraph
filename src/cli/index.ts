#!/usr/bin/env node

import { Command } from "commander";
import { registerConfigCommand } from "./commands/config.js";
import { registerDownCommand } from "./commands/down.js";
import { registerInitCommand } from "./commands/init.js";
import { registerIssuesCommand } from "./commands/issues.js";
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
  .version("0.2.0");

registerConfigCommand(program);
registerDownCommand(program);
registerInitCommand(program);
registerIssuesCommand(program);
registerRestartCommand(program);
registerServeCommand(program);
registerStatusCommand(program);
registerUpCommand(program);
registerValidateCommand(program);
registerVizCommand(program);

program.parse();
