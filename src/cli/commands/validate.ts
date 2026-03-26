import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import { parseEntity } from "../../entity/parser.js";
import { validateEntity, validateEntityRefs } from "../../entity/validate.js";
import type { ValidationError } from "../../entity/validate.js";
import type { Entity } from "../../entity/types.js";

// ============================================================
// Types
// ============================================================

export interface FileError {
  file: string;
  field?: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidateResult {
  filesChecked: number;
  entitiesParsed: number;
  errors: FileError[];
}

// ============================================================
// Core Logic
// ============================================================

export async function runValidate(whygraphDir: string): Promise<ValidateResult> {
  const graphDir = join(whygraphDir, ".whygraph", "graph");

  if (!existsSync(graphDir)) {
    return { filesChecked: 0, entitiesParsed: 0, errors: [] };
  }

  const files = readdirSync(graphDir).filter((f) => f.endsWith(".md"));
  const errors: FileError[] = [];
  const entityMap = new Map<string, Entity>();
  const filePathMap = new Map<string, string>(); // entity id → file path

  // First pass: parse all entities into a map
  for (const file of files) {
    const filePath = join(graphDir, file);
    const content = readFileSync(filePath, "utf-8");
    const entity = parseEntity(content);

    if (entity === null) {
      errors.push({
        file: filePath,
        message: "Failed to parse entity from file",
        severity: "error",
      });
      continue;
    }

    entityMap.set(entity.id, entity);
    filePathMap.set(entity.id, filePath);
  }

  // Second pass: schema + cross-reference validation
  for (const [id, entity] of entityMap) {
    const filePath = filePathMap.get(id)!;

    const schemaResult = validateEntity(entity);
    for (const err of schemaResult.errors) {
      errors.push({ file: filePath, field: err.field, message: err.message, severity: err.severity });
    }

    const refErrors = validateEntityRefs(entity, entityMap);
    for (const err of refErrors) {
      errors.push({ file: filePath, field: err.field, message: err.message, severity: err.severity });
    }
  }

  return {
    filesChecked: files.length,
    entitiesParsed: entityMap.size,
    errors,
  };
}

// ============================================================
// CLI Wiring
// ============================================================

function formatTable(result: ValidateResult): string {
  const lines: string[] = [];

  if (result.errors.length === 0) {
    lines.push(
      `Checked ${result.filesChecked} file(s), ${result.entitiesParsed} entity(ies) parsed. No errors found.`,
    );
    return lines.join("\n");
  }

  lines.push("FILE                           FIELD        SEVERITY  MESSAGE");
  lines.push("─".repeat(90));

  for (const err of result.errors) {
    const fileName = err.file.split("/").pop() ?? err.file;
    const field = err.field ?? "-";
    lines.push(
      `${fileName.padEnd(30)} ${field.padEnd(12)} ${err.severity.padEnd(9)} ${err.message}`,
    );
  }

  lines.push("");
  lines.push(
    `Checked ${result.filesChecked} file(s), ${result.entitiesParsed} entity(ies) parsed. ${result.errors.length} error(s) found.`,
  );

  return lines.join("\n");
}

export function registerValidateCommand(program: Command): void {
  program
    .command("validate")
    .description("Validate all entity files in .whygraph/graph/")
    .option("--json", "Output results as JSON")
    .action(async (opts: { json?: boolean }) => {
      const result = await runValidate(process.cwd());

      if (opts.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      } else {
        process.stdout.write(formatTable(result) + "\n");
      }

      const hasErrors = result.errors.some((e) => e.severity === "error");
      process.exitCode = hasErrors ? 1 : 0;
    });
}
