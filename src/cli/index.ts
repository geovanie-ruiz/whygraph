#!/usr/bin/env node

import { Command } from "commander";
import { registerConfigCommand } from "./commands/config.js";
import { registerInitCommand } from "./commands/init.js";
import { registerPrimeCommand } from "./commands/prime.js";
import { registerServeCommand } from "./commands/serve.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerValidateCommand } from "./commands/validate.js";

const program = new Command();

program
  .name("whygraph")
  .description("The graph of why — so your agent knows before it touches anything.")
  .version("0.2.0");

registerConfigCommand(program);
registerInitCommand(program);
registerPrimeCommand(program);
registerServeCommand(program);
registerStatusCommand(program);
registerValidateCommand(program);

program.parse();
