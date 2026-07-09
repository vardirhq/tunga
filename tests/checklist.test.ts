import { describe, expect, it } from "vitest";
import { applySelection, buildChecklist } from "../src/interactive/checklist.js";
import { decisionFor, recordDecision, type ReviewManifest } from "../src/core/manifest.js";
import type { CandidateString, Confidence } from "../src/types/index.js";

let counter = 0;
const candidate = (text: string, confidence: Confidence, overrides: Partial<CandidateString> = {}): CandidateString => ({
  id: `src/A.tsx:${++counter}:0:jsx-text`,
  text,
  file: "src/A.tsx",
  line: counter,
  column: 0,
  context: "JSX text",
  type: "jsx-text",
  keySuggestion: `ui.a.${text.toLowerCase().replace(/\W+/g, "_")}`,
  confidence,
  ...overrides,
});

const emptyManifest = (): ReviewManifest => ({ version: 1, decisions: {} });

describe("checklist review", () => {
  it("groups by confidence and preselects high/medium but not low", () => {
    const candidates = [candidate("Low one", "low"), candidate("Save", "high"), candidate("Hello {{name}}", "medium")];
    const { groups, initialValues } = buildChecklist(candidates, emptyManifest());

    expect(Object.keys(groups)).toEqual(["High confidence (1)", "Medium confidence (1)", "Low confidence (1)"]);
    const ids = (title: string) => groups[title]!.map((option) => option.value);
    expect(initialValues).toEqual([...ids("High confidence (1)"), ...ids("Medium confidence (1)")]);
  });

  it("uses manifest decisions for the initial selection when present", () => {
    const rejectedHigh = candidate("Save", "high");
    const acceptedLow = candidate("beta badge", "low");
    const manifest = emptyManifest();
    recordDecision(manifest, rejectedHigh, "rejected");
    recordDecision(manifest, acceptedLow, "accepted");

    const { initialValues } = buildChecklist([rejectedHigh, acceptedLow], manifest);
    expect(initialValues).toEqual([acceptedLow.id]);
  });

  it("records accepted/rejected for every candidate, preserving custom keys", () => {
    const kept = candidate("Save", "high");
    const dropped = candidate("Renamed", "medium");
    const manifest = emptyManifest();
    recordDecision(manifest, kept, "accepted", "ui.custom.save");

    const counts = applySelection([kept, dropped], new Set([kept.id]), manifest);
    expect(counts).toEqual({ accepted: 1, rejected: 1 });
    expect(decisionFor(manifest, kept)).toMatchObject({ status: "accepted", key: "ui.custom.save" });
    expect(decisionFor(manifest, dropped)).toMatchObject({ status: "rejected" });
  });
});
