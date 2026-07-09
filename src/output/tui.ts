import { cancel, groupMultiselect, intro, outro, spinner, note, log, select, text, isCancel } from "@clack/prompts";
import type { ChecklistGroups } from "../interactive/checklist.js";
import type { CandidateString } from "../types/index.js";

export type CandidateDecision =
  | { action: "accept"; key: string }
  | { action: "reject" }
  | { action: "skip" };

export function startTui(title: string) {
  intro(`🌍 ${title}`);
}

export function endTui(message: string) {
  outro(message);
}

export function createSpinner(message: string) {
  const s = spinner();
  s.start(message);
  return s;
}

export function info(message: string) {
  log.info(message);
}

export function success(message: string) {
  log.success(message);
}

export function warning(message: string) {
  log.warn(message);
}

export function failure(message: string) {
  log.error(message);
}

export function showNote(message: string, title?: string) {
  note(message, title);
}

export function renderCandidateTable(candidates: CandidateString[]) {
  if (candidates.length === 0) {
    return "No candidate strings found.";
  }

  const grouped = groupByFile(candidates);
  const lines = [`Found ${candidates.length} candidate string${candidates.length === 1 ? "" : "s"}`];

  for (const [file, items] of grouped) {
    lines.push("", file);
    for (const item of items) {
      lines.push(
        `  ${pad(`${item.line}:${item.column}`, 8)} ${pad(item.type, 15)} ${quote(item.text, 34)} ${item.keySuggestion}`,
      );
    }
  }

  return lines.join("\n");
}

export function renderDryRunList(title: string, rows: string[]) {
  return [title, ...rows.map((row) => `  ${row}`)].join("\n");
}

export type NextStep = "save" | "extract" | "dry-run" | "apply";

// Full-list review: scroll with arrows, Space toggles a candidate (or a whole
// confidence group), Enter confirms. Returns null when the user cancels.
export async function reviewChecklist(groups: ChecklistGroups, initialValues: string[]): Promise<string[] | null> {
  const selected = await groupMultiselect({
    message: "Select the strings to localize (Space toggles, Enter confirms)",
    options: groups,
    initialValues,
    required: false,
    maxItems: Math.max(8, (process.stdout.rows ?? 24) - 8),
    groupSpacing: 1,
  });

  if (isCancel(selected)) {
    cancel("Review cancelled. No decisions were saved.");
    return null;
  }

  return selected as string[];
}

export async function nextStepMenu(summary: string): Promise<NextStep | null> {
  const action = await select({
    message: `${summary} — what next?`,
    options: [
      { value: "save", label: "Save review", hint: "Write the manifest and stop" },
      { value: "extract", label: "Save and extract", hint: "Write the manifest and update the locale file" },
      { value: "dry-run", label: "Save, extract, and preview apply", hint: "Show the rewrites without changing files" },
      { value: "apply", label: "Save, extract, and apply", hint: "Rewrite source files" },
    ],
  });

  if (isCancel(action)) {
    cancel("Review cancelled. No decisions were saved.");
    return null;
  }

  return action as NextStep;
}

export async function reviewCandidate(candidate: CandidateString): Promise<CandidateDecision> {
  showNote(
    [`File: ${candidate.file}:${candidate.line}:${candidate.column}`, `Text: "${candidate.text}"`, `Suggested key: ${candidate.keySuggestion}`, `Confidence: ${candidate.confidence}`].join("\n"),
    "Review candidate",
  );

  const action = await select({
    message: "What should Tunga do with this string?",
    options: [
      { value: "accept", label: "Accept", hint: "Use the suggested key" },
      { value: "edit", label: "Edit key", hint: "Accept with a custom key" },
      { value: "reject", label: "Reject", hint: "Never localize this string (remembered)" },
      { value: "skip", label: "Skip", hint: "Decide later" },
    ],
  });

  if (isCancel(action)) {
    cancel("Review cancelled.");
    return { action: "skip" };
  }

  if (action === "skip" || action === "reject") {
    return { action };
  }

  if (action === "edit") {
    const key = await text({
      message: "Translation key",
      placeholder: candidate.keySuggestion,
      defaultValue: candidate.keySuggestion,
      validate(value) {
        if (!value?.trim()) return "Enter a translation key.";
      },
    });

    if (isCancel(key)) {
      cancel("Review cancelled.");
      return { action: "skip" };
    }

    return { action: "accept", key: String(key).trim() };
  }

  return { action: "accept", key: candidate.keySuggestion };
}

function groupByFile(candidates: CandidateString[]) {
  const grouped = new Map<string, CandidateString[]>();

  for (const candidate of candidates) {
    const fileCandidates = grouped.get(candidate.file) ?? [];
    fileCandidates.push(candidate);
    grouped.set(candidate.file, fileCandidates);
  }

  return grouped;
}

function pad(value: string, width: number) {
  return value.padEnd(width, " ");
}

function quote(value: string, maxLength: number) {
  const clipped = value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
  return `"${clipped}"`.padEnd(maxLength + 2, " ");
}
