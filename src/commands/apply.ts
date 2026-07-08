import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadConfig } from "../core/config.js";
import { scanProject } from "../core/scanner.js";
import { addCandidates, loadLocale } from "../core/localeFile.js";
import { applyCodemod } from "../core/codemod.js";
import { formatCode } from "../core/formatter.js";
import { createSpinner, endTui, renderDryRunList, showNote, startTui, success } from "../output/tui.js";

export async function applyCommand(opts: {
  dryRun?: boolean;
  fn?: string;
  import?: string;
  skipImport?: boolean;
  locale?: string;
  includeLowConfidence?: boolean;
}) {
  startTui(opts.dryRun ? "Tunga apply preview" : "Tunga apply");

  const loadedConfig = await loadConfig();
  const config = {
    ...loadedConfig,
    functionName: opts.fn ?? loadedConfig.functionName,
    importSource: opts.import ?? loadedConfig.importSource,
    locale: opts.locale ?? loadedConfig.locale,
  };

  const scanSpinner = createSpinner("Finding replacement candidates");
  const scanned = await scanProject(config);
  const candidates = scanned.filter((candidate) => candidate.confidence !== "low" || opts.includeLowConfidence);
  scanSpinner.stop(`Found ${candidates.length} candidate string${candidates.length === 1 ? "" : "s"}`);

  // Resolve keys against the locale file so apply uses the same collision-suffixed
  // keys extract wrote (or would write); the locale itself is not written here.
  addCandidates(loadLocale(path.resolve(config.locale)), candidates);

  const byFile = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    const fileCandidates = byFile.get(candidate.file) ?? [];
    fileCandidates.push(candidate);
    byFile.set(candidate.file, fileCandidates);
  }

  const changed: string[] = [];
  const replaceLines: string[] = [];

  for (const [file, items] of byFile) {
    const absoluteFile = path.resolve(file);
    const source = readFileSync(absoluteFile, "utf8");
    const result = applyCodemod({
      source,
      candidates: items,
      config,
      skipImport: opts.skipImport,
      includeLowConfidence: opts.includeLowConfidence,
    });

    if (!result.changed) continue;

    changed.push(file);
    replaceLines.push(...items.map((item) => `${item.file}:${item.line} "${item.text}" -> ${config.functionName}("${item.keySuggestion}")`));

    if (!opts.dryRun) {
      const formatted = await formatCode(result.code, absoluteFile);
      writeFileSync(absoluteFile, formatted);
    }
  }

  showNote(renderDryRunList(opts.dryRun ? "Would update:" : "Updated:", changed), "Files");
  if (replaceLines.length > 0) {
    showNote(renderDryRunList(opts.dryRun ? "Would replace:" : "Replaced:", replaceLines), "Replacements");
  }
  success(opts.dryRun ? "Dry run complete. No files changed." : "Source rewrite complete.");
  endTui(`${changed.length} file${changed.length === 1 ? "" : "s"} ${opts.dryRun ? "would change" : "changed"}`);
}
