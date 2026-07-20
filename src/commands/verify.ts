import path from "node:path";
import { loadConfig } from "../core/config.js";
import { loadLocale } from "../core/localeFile.js";
import { findSourceFiles } from "../core/scanner.js";
import { collectProjectReferences, findOrphanedKeys, flattenLocaleKeys, verifyReference, type VerifyIssue } from "../core/verify.js";
import { printJson } from "../output/json.js";
import { createSpinner, failure, info, showNote, success, warning } from "../output/tui.js";

export async function verifyCommand(opts: { json?: boolean; strict?: boolean; locale?: string } = {}) {
  const loaded = await loadConfig();
  const config = { ...loaded, locale: opts.locale ?? loaded.locale };
  const cwd = process.cwd();

  const spinner = !opts.json ? createSpinner("Verifying translation calls against the locale file") : undefined;

  const files = await findSourceFiles(config, cwd);
  const locale = loadLocale(path.resolve(config.locale));
  const project = collectProjectReferences(files, cwd, config);
  const { references, referencedKeys, dynamicKeys, unreadable } = project;
  const referenceCount = references.length;

  const issues: VerifyIssue[] = [];
  for (const reference of references) {
    issues.push(...verifyReference(reference, locale, config.functionName));
  }

  issues.push(...findOrphanedKeys(locale, referencedKeys, config.functionName));

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const failed = errors.length > 0 || (opts.strict === true && warnings.length > 0);

  if (opts.json) {
    console.log(
      printJson({
        ok: !failed,
        checked: { files: files.length, references: referenceCount, keys: flattenLocaleKeys(locale).length },
        summary: { error: errors.length, warning: warnings.length, dynamicKeys, unreadable: unreadable.length },
        issues,
        unreadable,
      }),
    );
    process.exitCode = failed ? 1 : 0;
    return;
  }

  spinner?.stop(`Verified ${referenceCount} translation call${referenceCount === 1 ? "" : "s"} across ${files.length} file${files.length === 1 ? "" : "s"}`);

  if (errors.length > 0) showNote(renderIssues(errors), "Errors");
  if (warnings.length > 0) showNote(renderIssues(warnings), "Warnings");
  if (dynamicKeys > 0) info(`${dynamicKeys} call${dynamicKeys === 1 ? "" : "s"} use a dynamic key and could not be verified statically.`);
  if (unreadable.length > 0) warning(`${unreadable.length} file${unreadable.length === 1 ? "" : "s"} could not be parsed and were skipped.`);

  if (failed) {
    failure(`Verification failed: ${errors.length} error${errors.length === 1 ? "" : "s"}${opts.strict && warnings.length > 0 ? ` and ${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : ""}.`);
    process.exitCode = 1;
    return;
  }

  if (warnings.length > 0) {
    warning(`Every translation call resolves, with ${warnings.length} warning${warnings.length === 1 ? "" : "s"} (pass --strict to fail on them).`);
    return;
  }

  success("Every translation call resolves against the locale file.");
}

function renderIssues(issues: VerifyIssue[]) {
  return issues
    .map((issue) => {
      const where = issue.file ? `${issue.file}${issue.line ? `:${issue.line}` : ""}  ` : "";
      return `${where}[${issue.type}] ${issue.message}`;
    })
    .join("\n");
}
