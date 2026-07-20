#!/usr/bin/env node
import { Command } from "commander";
import { applyCommand } from "./commands/apply.js";
import { checkCommand } from "./commands/check.js";
import { extractCommand } from "./commands/extract.js";
import { initCommand } from "./commands/init.js";
import { reportCommand } from "./commands/report.js";
import { scanCommand } from "./commands/scan.js";
import { verifyCommand } from "./commands/verify.js";
import { failure } from "./output/tui.js";

const program = new Command();

program.name("tunga").description("Find strings. Generate keys. Rewrite code.").version("0.1.0");

program.command("init").description("Create a default config file").action(initCommand);

program
  .command("scan")
  .argument("[path]")
  .option("--json", "Print machine-readable JSON")
  .option("--include <glob>", "Override configured include glob")
  .option("-i, --interactive", "Review candidates in a scrollable checklist grouped by confidence")
  .option("--step", "Review candidates one at a time (allows editing keys)")
  .action(scanCommand);

program
  .command("extract")
  .option("--out <file>", "Locale JSON file to update")
  .option("--dry-run", "Preview locale changes without writing files")
  .option("--overwrite", "Overwrite existing locale values")
  .option("--namespace <name>", "Translation namespace")
  .option("--key-strategy <strategy>", "Key strategy: path, text, or component")
  .option("--include-low-confidence", "Also extract low-confidence candidates")
  .action(extractCommand);

program
  .command("apply")
  .option("--dry-run", "Preview source rewrites without writing files")
  .option("--fn <name>", "Translation function name")
  .option("--import <source>", "Translation import source")
  .option("--skip-import", "Do not add translation imports")
  .option("--locale <file>", "Locale file used for key lookup")
  .option("--include-low-confidence", "Also rewrite low-confidence candidates")
  .action(applyCommand);

program.command("check").description("Fail if hardcoded candidate strings are found").action(checkCommand);

program
  .command("verify")
  .description("Fail if any translation call does not resolve against the locale file")
  .option("--json", "Print machine-readable JSON")
  .option("--strict", "Also fail on warnings (e.g. orphaned locale keys)")
  .option("--locale <file>", "Locale file used for key lookup")
  .action(verifyCommand);

program.command("report").option("--json", "Print machine-readable JSON").action(reportCommand);

program.parseAsync().catch((error) => {
  failure(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
