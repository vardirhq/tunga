import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { CandidateString } from "../types/index.js";

export type ReviewStatus = "accepted" | "rejected";

export type ReviewRecord = {
  file: string;
  text: string;
  context: string;
  status: ReviewStatus;
  key?: string;
};

export type ReviewManifest = {
  version: 1;
  decisions: Record<string, ReviewRecord>;
};

// Decisions are keyed by content, not position, so they survive edits that
// move a string around inside its file.
export function candidateHash(candidate: Pick<CandidateString, "file" | "text" | "context">) {
  return createHash("sha1").update(`${candidate.file}\u0000${candidate.text}\u0000${candidate.context}`).digest("hex").slice(0, 16);
}

export function loadManifest(file: string): ReviewManifest {
  if (!existsSync(file)) return { version: 1, decisions: {} };
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  return { version: 1, decisions: parsed.decisions ?? {} };
}

export function saveManifest(file: string, manifest: ReviewManifest) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n");
}

export function decisionFor(manifest: ReviewManifest, candidate: Pick<CandidateString, "file" | "text" | "context">) {
  return manifest.decisions[candidateHash(candidate)];
}

export function recordDecision(
  manifest: ReviewManifest,
  candidate: Pick<CandidateString, "file" | "text" | "context">,
  status: ReviewStatus,
  key?: string,
) {
  manifest.decisions[candidateHash(candidate)] = {
    file: candidate.file,
    text: candidate.text,
    context: candidate.context,
    status,
    ...(key ? { key } : {}),
  };
}

// The one selection rule shared by extract and apply: manifest decisions win
// (an accepted candidate is kept even at low confidence, a rejected one is
// always dropped), undecided candidates fall back to the confidence filter.
export function selectCandidates(candidates: CandidateString[], manifest: ReviewManifest, includeLowConfidence?: boolean) {
  const selected: CandidateString[] = [];
  for (const candidate of candidates) {
    const decision = decisionFor(manifest, candidate);
    if (decision?.status === "rejected") continue;
    if (decision?.status === "accepted") {
      if (decision.key) candidate.keySuggestion = decision.key;
      selected.push(candidate);
      continue;
    }
    if (candidate.confidence !== "low" || includeLowConfidence) selected.push(candidate);
  }
  return selected;
}
