import path from "node:path";
import { loadConfig } from "../core/config.js";
import { loadManifest, selectCandidates } from "../core/manifest.js";
import { scanProject } from "../core/scanner.js";
import { createSpinner, failure, showNote, success } from "../output/tui.js";

export async function checkCommand() {
  const config = await loadConfig();
  const spinner = createSpinner("Checking for hardcoded strings");
  const scanned = await scanProject(config);
  const candidates = selectCandidates(scanned, loadManifest(path.resolve(config.manifest)));
  spinner.stop(`Checked project and found ${candidates.length} candidate string${candidates.length === 1 ? "" : "s"}`);

  if (candidates.length > 0) {
    failure(`Found ${candidates.length} hardcoded string${candidates.length === 1 ? "" : "s"}.`);
    showNote("Run:\n  tunga scan\n  tunga extract\n  tunga apply", "Suggested workflow");
    process.exitCode = 1;
    return;
  }

  success("No hardcoded strings found.");
}
