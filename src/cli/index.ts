#!/usr/bin/env node

import { Command } from "commander";
import { runPrime } from "./prime.js";
import { runInit, promptForAnswers, printNextSteps } from "./commands/init.js";

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

program
  .command("init")
  .description("Initialize .whygraph/ directory and configuration")
  .option("--json", "Output structured JSON instead of human-readable text")
  .action(async (opts: { json?: boolean }) => {
    const answers = await promptForAnswers();
    if (!answers) {
      if (opts.json) {
        process.stdout.write(JSON.stringify({ error: "Cancelled" }) + "\n");
      } else {
        console.log("Init cancelled.");
      }
      process.exitCode = 1;
      return;
    }

    const result = await runInit(process.cwd(), answers);
    printNextSteps(result, opts.json ?? false);
  });

program
  .command("sync")
  .description("Process staging entries into the decision graph")
  .option("--json", "Output structured JSON instead of human-readable text")
  .action((_opts: { json?: boolean }) => {
    console.log("Not yet implemented. See whygraph-kwi.11.");
  });

program
  .command("viz")
  .description("Generate and open a visualization of the decision graph")
  .option("--json", "Output structured JSON instead of human-readable text")
  .action((_opts: { json?: boolean }) => {
    console.log("Not yet implemented. See whygraph-kwi.12.");
  });

program
  .command("config")
  .description("View or update whygraph configuration")
  .option("--json", "Output structured JSON instead of human-readable text")
  .action((_opts: { json?: boolean }) => {
    console.log("Not yet implemented.");
  });

program.parse();
