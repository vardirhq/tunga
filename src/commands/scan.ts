import path from "node:path";
import { loadConfig } from "../core/config.js";
import { loadManifest, saveManifest } from "../core/manifest.js";
import { scanProject } from "../core/scanner.js";
import { reviewCandidates } from "../interactive/review.js";
import { printJson } from "../output/json.js";
import { createSpinner, endTui, showNote, startTui, success } from "../output/tui.js";
import { formatScan } from "../output/summary.js";

export async function scanCommand(target: string | undefined, opts: { json?: boolean; include?: string; interactive?: boolean }) {
  const config = await loadConfig();
  const spinner = !opts.json ? createSpinner("Scanning source files") : undefined;
  const candidates = await scanProject({
    ...config,
    paths: target ? [target] : undefined,
    include: opts.include ? [opts.include] : config.include,
  });

  spinner?.stop(`Found ${candidates.length} candidate string${candidates.length === 1 ? "" : "s"}`);

  if (opts.json) {
    console.log(printJson(candidates));
    return;
  }

  if (opts.interactive) {
    startTui("Tunga review");
    const manifestPath = path.resolve(config.manifest);
    const manifest = loadManifest(manifestPath);
    const reviewed = await reviewCandidates(candidates, manifest);
    saveManifest(manifestPath, manifest);
    showNote(formatScan(reviewed), "Accepted candidates");
    success(`Decisions saved to ${config.manifest} — extract and apply will use them.`);
    endTui(`${reviewed.length} accepted, ${candidates.length - reviewed.length} skipped`);
    return;
  }

  showNote(formatScan(candidates), "Scan results");
  success("Run `tunga extract --dry-run` to preview locale updates.");
}
