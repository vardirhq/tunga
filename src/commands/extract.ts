import path from "node:path";
import { loadConfig } from "../core/config.js";
import { loadManifest, selectCandidates } from "../core/manifest.js";
import { scanProject } from "../core/scanner.js";
import { addCandidates, loadLocale, writeLocale } from "../core/localeFile.js";
import { createSpinner, endTui, renderDryRunList, showNote, startTui, success } from "../output/tui.js";

export async function extractCommand(opts: {
  out?: string;
  dryRun?: boolean;
  overwrite?: boolean;
  namespace?: string;
  keyStrategy?: "path" | "text" | "component";
  includeLowConfidence?: boolean;
}) {
  startTui(opts.dryRun ? "Tunga extract preview" : "Tunga extract");

  const loadedConfig = await loadConfig();
  const config = {
    ...loadedConfig,
    namespace: opts.namespace ?? loadedConfig.namespace,
    keyStrategy: opts.keyStrategy ?? loadedConfig.keyStrategy,
  };
  const localePath = path.resolve(opts.out ?? config.locale);
  const scanSpinner = createSpinner("Finding localizable strings");
  const scanned = await scanProject(config);
  // Same selection as apply, so extract never writes keys apply will not use.
  const candidates = selectCandidates(scanned, loadManifest(path.resolve(config.manifest)), opts.includeLowConfidence);
  scanSpinner.stop(`Found ${candidates.length} candidate string${candidates.length === 1 ? "" : "s"}`);

  const locale = loadLocale(localePath);
  const result = addCandidates(locale, candidates, Boolean(opts.overwrite));

  if (opts.dryRun) {
    showNote(renderDryRunList("Would update:", [localePath]), "Files");
    showNote(
      renderDryRunList(
        "Would add:",
        result.added.map((item) => `${item.key} = "${item.value}"`),
      ),
      "Locale keys",
    );
    endTui("Dry run complete. No files changed.");
    return;
  }

  writeLocale(localePath, result.locale);
  success(`Updated ${localePath}`);
  endTui(`${result.added.length} key${result.added.length === 1 ? "" : "s"} added`);
}
