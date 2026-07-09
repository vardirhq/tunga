import type { CandidateString } from "../types/index.js";
import { decisionFor, recordDecision, type ReviewManifest } from "../core/manifest.js";
import { reviewCandidate } from "../output/tui.js";

export async function reviewCandidates(candidates: CandidateString[], manifest?: ReviewManifest) {
  const accepted: CandidateString[] = [];

  for (const candidate of candidates) {
    const existing = manifest ? decisionFor(manifest, candidate) : undefined;
    if (existing) {
      if (existing.status === "accepted") accepted.push({ ...candidate, keySuggestion: existing.key ?? candidate.keySuggestion });
      continue;
    }

    const decision = await reviewCandidate(candidate);

    if (decision.action === "accept") {
      accepted.push({ ...candidate, keySuggestion: decision.key });
      if (manifest) recordDecision(manifest, candidate, "accepted", decision.key === candidate.keySuggestion ? undefined : decision.key);
    } else if (decision.action === "reject" && manifest) {
      recordDecision(manifest, candidate, "rejected");
    }
  }

  return accepted;
}
