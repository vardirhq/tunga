import path from "node:path";
import { loadConfig } from "../core/config.js";
import { loadManifest, saveManifest } from "../core/manifest.js";
import { scanProject } from "../core/scanner.js";
import { applyCommand } from "./apply.js";
import { extractCommand } from "./extract.js";
import { applySelection, buildChecklist } from "../interactive/checklist.js";
import { reviewCandidates } from "../interactive/review.js";
import { printJson } from "../output/json.js";
import { createSpinner, endTui, nextStepMenu, reviewChecklist, showNote, startTui, success } from "../output/tui.js";
import { formatScan } from "../output/summary.js";

export async function scanCommand(target: string | undefined, opts: { json?: boolean; include?: string; interactive?: boolean; step?: boolean }) {
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

  if (opts.interactive || opts.step) {
    startTui("Tunga review");
    const manifestPath = path.resolve(config.manifest);
    const manifest = loadManifest(manifestPath);

    if (opts.step) {
      const reviewed = await reviewCandidates(candidates, manifest);
      saveManifest(manifestPath, manifest);
      showNote(formatScan(reviewed), "Accepted candidates");
      success(`Decisions saved to ${config.manifest} — extract and apply will use them.`);
      endTui(`${reviewed.length} accepted, ${candidates.length - reviewed.length} skipped`);
      return;
    }

    const { groups, initialValues } = buildChecklist(candidates, manifest);
    const selected = await reviewChecklist(groups, initialValues);
    if (selected === null) {
      endTui("Nothing saved.");
      return;
    }

    const { accepted, rejected } = applySelection(candidates, new Set(selected), manifest);
    const action = await nextStepMenu(`${accepted} accepted, ${rejected} rejected`);
    if (action === null) {
      endTui("Nothing saved.");
      return;
    }

    saveManifest(manifestPath, manifest);
    success(`Decisions saved to ${config.manifest} — extract and apply will use them.`);
    endTui(`${accepted} accepted, ${rejected} rejected`);

    if (action === "extract" || action === "dry-run" || action === "apply") await extractCommand({});
    if (action === "dry-run") await applyCommand({ dryRun: true });
    if (action === "apply") await applyCommand({});
    return;
  }

  showNote(formatScan(candidates), "Scan results");
  success("Run `tunga extract --dry-run` to preview locale updates.");
}
