#!/usr/bin/env node

import { Command } from "commander";
import { registerInitCommand } from "./commands/init.js";
import { registerValidateCommand } from "./commands/validate.js";

const program = new Command();

program
  .name("whygraph")
  .description("The graph of why — so your agent knows before it touches anything.")
  .version("0.2.0");

registerInitCommand(program);
registerValidateCommand(program);

program.parse();
