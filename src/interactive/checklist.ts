import type { CandidateString, Confidence } from "../types/index.js";
import { decisionFor, recordDecision, type ReviewManifest } from "../core/manifest.js";

export type ChecklistOption = { value: string; label: string; hint?: string };
export type ChecklistGroups = Record<string, ChecklistOption[]>;

const order: Confidence[] = ["high", "medium", "low"];
const groupTitles: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

// Builds the checklist model: candidates grouped by confidence (high first),
// sorted by file and line within each group. Initial selection comes from the
// manifest where a decision exists; undecided candidates default to selected
// for high/medium and deselected for low — the same split extract/apply use.
export function buildChecklist(candidates: CandidateString[], manifest: ReviewManifest) {
  const groups: ChecklistGroups = {};
  const initialValues: string[] = [];

  for (const confidence of order) {
    const bucket = candidates
      .filter((candidate) => candidate.confidence === confidence)
      .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column);
    if (bucket.length === 0) continue;

    groups[`${groupTitles[confidence]} (${bucket.length})`] = bucket.map((candidate) => ({
      value: candidate.id,
      label: `${candidate.file}:${candidate.line}  ${clip(candidate.text, 44)}`,
      hint: candidate.reason ? `${candidate.keySuggestion} — ${candidate.reason}` : candidate.keySuggestion,
    }));

    for (const candidate of bucket) {
      const decision = decisionFor(manifest, candidate);
      const selected = decision ? decision.status === "accepted" : confidence !== "low";
      if (selected) initialValues.push(candidate.id);
    }
  }

  return { groups, initialValues };
}

// Records a decision for every listed candidate: selected -> accepted
// (keeping any custom key from an earlier review), deselected -> rejected.
export function applySelection(candidates: CandidateString[], selectedIds: Set<string>, manifest: ReviewManifest) {
  let accepted = 0;
  let rejected = 0;

  for (const candidate of candidates) {
    if (selectedIds.has(candidate.id)) {
      const existing = decisionFor(manifest, candidate);
      recordDecision(manifest, candidate, "accepted", existing?.status === "accepted" ? existing.key : undefined);
      accepted++;
    } else {
      recordDecision(manifest, candidate, "rejected");
      rejected++;
    }
  }

  return { accepted, rejected };
}

function clip(value: string, maxLength: number) {
  return `"${value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value}"`;
}
