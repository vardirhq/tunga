import path from "node:path";
import { loadConfig } from "../core/config.js";
import { loadLocale } from "../core/localeFile.js";
import { loadManifest, selectCandidates } from "../core/manifest.js";
import { findSourceFiles, scanProject } from "../core/scanner.js";
import { buildReport, collectProjectReferences } from "../core/verify.js";
import { printJson } from "../output/json.js";
import { createSpinner, endTui, showNote, startTui } from "../output/tui.js";

export async function reportCommand(opts: { json?: boolean }) {
  const config = await loadConfig();
  const cwd = process.cwd();
  const spinner = !opts.json ? createSpinner("Building localization report") : undefined;

  const files = await findSourceFiles(config, cwd);
  const scanned = await scanProject(config);
  const hardcoded = selectCandidates(scanned, loadManifest(path.resolve(config.manifest)));

  const report = buildReport({
    filesScanned: files.length,
    localeFile: config.locale,
    references: collectProjectReferences(files, cwd, config),
    hardcodedCandidates: hardcoded.length,
    locale: loadLocale(path.resolve(config.locale)),
  });

  spinner?.stop("Report ready");

  if (opts.json) {
    console.log(printJson(report));
    return;
  }

  startTui("Tunga report");
  showNote(
    [
      `Files scanned: ${report.filesScanned}`,
      `Localization coverage: ${(report.coverage * 100).toFixed(1)}%`,
      `Localized strings: ${report.localizedStrings}`,
      `Hardcoded candidates: ${report.hardcodedCandidates}`,
      `Locale keys: ${report.localeKeys}`,
      `Missing locale keys: ${report.missingLocaleKeys}`,
      `Unused locale keys: ${report.unusedLocaleKeys}`,
      ...(report.dynamicKeys > 0 ? [`Dynamic (unverifiable) keys: ${report.dynamicKeys}`] : []),
      ...(report.unreadableFiles > 0 ? [`Unreadable files: ${report.unreadableFiles}`] : []),
    ].join("\n"),
    "Localization report",
  );
  endTui("Report complete.");
}
