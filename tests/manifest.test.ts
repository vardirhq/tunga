import { describe, expect, it } from "vitest";
import { candidateHash, recordDecision, selectCandidates, type ReviewManifest } from "../src/core/manifest.js";
import type { CandidateString } from "../src/types/index.js";

const candidate = (overrides: Partial<CandidateString>): CandidateString => ({
  id: "src/A.tsx:1:0:jsx-text",
  text: "Save",
  file: "src/A.tsx",
  line: 1,
  column: 0,
  context: "JSX text",
  type: "jsx-text",
  keySuggestion: "ui.a.save",
  confidence: "high",
  ...overrides,
});

const emptyManifest = (): ReviewManifest => ({ version: 1, decisions: {} });

describe("review manifest", () => {
  it("hashes by content, not position", () => {
    expect(candidateHash(candidate({ line: 1 }))).toBe(candidateHash(candidate({ line: 99, column: 7 })));
    expect(candidateHash(candidate({ text: "Save" }))).not.toBe(candidateHash(candidate({ text: "Cancel" })));
  });

  it("drops rejected candidates and keeps accepted ones regardless of confidence", () => {
    const manifest = emptyManifest();
    const rejected = candidate({ text: "Renamed", keySuggestion: "ui.a.renamed" });
    const acceptedLow = candidate({ text: "beta badge", keySuggestion: "ui.a.beta_badge", confidence: "low" });
    recordDecision(manifest, rejected, "rejected");
    recordDecision(manifest, acceptedLow, "accepted", "ui.badges.beta");

    const selected = selectCandidates([rejected, acceptedLow, candidate({ confidence: "low", text: "undecided low" })], manifest);
    expect(selected.map((c) => c.text)).toEqual(["beta badge"]);
    expect(selected[0]?.keySuggestion).toBe("ui.badges.beta");
  });

  it("falls back to the confidence filter for undecided candidates", () => {
    const low = candidate({ confidence: "low", text: "maybe" });
    expect(selectCandidates([candidate({}), low], emptyManifest()).map((c) => c.text)).toEqual(["Save"]);
    expect(selectCandidates([candidate({}), low], emptyManifest(), true).map((c) => c.text)).toEqual(["Save", "maybe"]);
  });
});
