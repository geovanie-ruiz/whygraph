#!/usr/bin/env node

import { Command } from "commander";
import { runPrime } from "./prime.js";

const program = new Command();

program
  .name("whygraph")
  .description("The graph of why. So your agent knows before it touches anything.")
  .version("0.1.0");

program
  .command("prime")
  .description("Print decision capture directive to stdout")
  .action(() => {
    runPrime();
  });

program.parse();
