import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import * as t from "@babel/types";
import type { TungaConfig } from "../types/index.js";
import { getNested } from "./keygen.js";

const traverse = (traverseModule as any).default ?? traverseModule;

export type VerifySeverity = "error" | "warning";
export type VerifyIssueType = "missing-key" | "empty-value" | "placeholder-mismatch" | "orphaned-key";

export type VerifyIssue = {
  type: VerifyIssueType;
  severity: VerifySeverity;
  key: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
};

// A statically resolvable translation call: `fn("key")` or `fn("key", { a, b })`.
// `paramsKnown` is false when the argument object cannot be read literally
// (a spread, a computed key, or a non-object second argument), which means the
// placeholder check must be skipped rather than guessed at.
export type TranslationReference = {
  key: string;
  params: string[];
  paramsKnown: boolean;
  hasParamsArg: boolean;
  file?: string;
  line?: number;
  column?: number;
};

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_$]+)\s*\}\}/g;

// The `{{name}}` tokens a locale value expects to be interpolated at runtime.
export function placeholdersIn(value: string): string[] {
  const names = new Set<string>();
  for (const match of value.matchAll(PLACEHOLDER)) names.add(match[1]);
  return [...names];
}

// Find every call to the configured translation function and read its static
// key + params. Matches both a bare `t(...)` and a member form `i18n.t(...)`,
// mirroring the shapes the codemod emits and that real i18n layers use.
// Calls whose key is not a plain string literal are unverifiable and counted
// separately instead of being reported as errors.
export function collectReferences(opts: { source: string; file?: string; config: TungaConfig }): {
  references: TranslationReference[];
  dynamicKeys: number;
} {
  const ast = parse(opts.source, { sourceType: "module", plugins: ["jsx", "typescript"] });
  const references: TranslationReference[] = [];
  let dynamicKeys = 0;

  traverse(ast, {
    CallExpression(nodePath: any) {
      if (calleeName(nodePath.node.callee) !== opts.config.functionName) return;

      const [first, second] = nodePath.node.arguments as t.Node[];
      if (!first) return;
      if (!t.isStringLiteral(first)) {
        dynamicKeys++;
        return;
      }

      const loc = first.loc?.start;
      const reference: TranslationReference = {
        key: first.value,
        params: [],
        paramsKnown: true,
        hasParamsArg: second !== undefined,
        file: opts.file,
        line: loc?.line,
        column: loc?.column,
      };

      if (second) readParams(second, reference);
      references.push(reference);
    },
  });

  return { references, dynamicKeys };
}

export type ProjectReferences = {
  references: TranslationReference[];
  referencedKeys: Set<string>;
  dynamicKeys: number;
  unreadable: string[];
};

// Walk the resolved source files once and gather every static translation call
// across the project. Reads files here (like `scanFileMeta` in the scanner) so
// the two commands that need this — verify and report — share one code path and
// one parse-error policy: an unreadable/unparseable file is recorded, not fatal.
export function collectProjectReferences(files: string[], cwd: string, config: TungaConfig): ProjectReferences {
  const references: TranslationReference[] = [];
  const referencedKeys = new Set<string>();
  const unreadable: string[] = [];
  let dynamicKeys = 0;

  for (const absoluteFile of files) {
    const file = path.relative(cwd, absoluteFile);
    let collected;
    try {
      collected = collectReferences({ source: readFileSync(absoluteFile, "utf8"), file, config });
    } catch {
      unreadable.push(file);
      continue;
    }
    dynamicKeys += collected.dynamicKeys;
    for (const reference of collected.references) {
      references.push(reference);
      referencedKeys.add(reference.key);
    }
  }

  return { references, referencedKeys, dynamicKeys, unreadable };
}

// The translation-function name, whether called bare (`t`) or as a member
// (`i18n.t`). Anything else is not a translation call we can verify.
function calleeName(callee: t.Node): string | undefined {
  if (t.isIdentifier(callee)) return callee.name;
  if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.property)) return callee.property.name;
  return undefined;
}

function readParams(node: t.Node, reference: TranslationReference) {
  if (!t.isObjectExpression(node)) {
    // e.g. `t("k", props)` — the values exist but we cannot enumerate them, so
    // we record the argument as present but its contents as unknown.
    reference.paramsKnown = false;
    return;
  }
  for (const property of node.properties) {
    if (t.isObjectProperty(property) && !property.computed) {
      if (t.isIdentifier(property.key)) reference.params.push(property.key.name);
      else if (t.isStringLiteral(property.key)) reference.params.push(property.key.value);
      else reference.paramsKnown = false;
    } else {
      // spread element or computed/method property — cannot enumerate reliably.
      reference.paramsKnown = false;
    }
  }
}

// The code ↔ locale contract for a single call: the key must resolve to a
// non-empty string, and every placeholder that string expects must be passed.
export function verifyReference(reference: TranslationReference, locale: unknown, functionName: string): VerifyIssue[] {
  const issues: VerifyIssue[] = [];
  const anchor = { key: reference.key, file: reference.file, line: reference.line, column: reference.column };
  const value = getNested(locale, reference.key);

  if (value === undefined) {
    return [{ ...anchor, type: "missing-key", severity: "error", message: `${functionName}("${reference.key}") has no matching key in the locale file` }];
  }
  if (typeof value !== "string") {
    return [{ ...anchor, type: "missing-key", severity: "error", message: `${functionName}("${reference.key}") resolves to a group of keys, not a translation string` }];
  }
  if (value.trim() === "") {
    issues.push({ ...anchor, type: "empty-value", severity: "error", message: `${functionName}("${reference.key}") resolves to an empty string` });
  }

  const required = placeholdersIn(value);
  if (required.length > 0) {
    if (!reference.hasParamsArg) {
      issues.push({ ...anchor, type: "placeholder-mismatch", severity: "error", message: `"${reference.key}" expects ${formatPlaceholders(required)} but ${functionName}("${reference.key}") passes no interpolation values` });
    } else if (reference.paramsKnown) {
      const missing = required.filter((name) => !reference.params.includes(name));
      if (missing.length > 0) {
        issues.push({ ...anchor, type: "placeholder-mismatch", severity: "error", message: `"${reference.key}" expects ${formatPlaceholders(missing)} but ${functionName}("${reference.key}") does not pass ${missing.length === 1 ? "it" : "them"}` });
      }
    }
    // paramsKnown === false: the argument object is dynamic, so we cannot prove
    // a mismatch either way and stay silent rather than raise a false positive.
  }

  return issues;
}

// Every string-leaf key in the locale, as dotted paths.
export function flattenLocaleKeys(locale: unknown, prefix = ""): string[] {
  if (!locale || typeof locale !== "object") return [];
  const keys: string[] = [];
  for (const [name, value] of Object.entries(locale)) {
    const dotted = prefix ? `${prefix}.${name}` : name;
    if (value && typeof value === "object") keys.push(...flattenLocaleKeys(value, dotted));
    else if (typeof value === "string") keys.push(dotted);
  }
  return keys;
}

// Locale leaves that no translation call points at. A warning, not an error:
// an unused key is harmless at runtime, unlike a dangling call.
export function findOrphanedKeys(locale: unknown, referenced: Set<string>, functionName: string): VerifyIssue[] {
  return flattenLocaleKeys(locale)
    .filter((key) => !referenced.has(key))
    .map((key) => ({ type: "orphaned-key", severity: "warning", key, message: `locale key "${key}" is never referenced by a ${functionName}() call` }));
}

function formatPlaceholders(names: string[]): string {
  return names.map((name) => `{{${name}}}`).join(", ");
}

export type LocalizationReport = {
  filesScanned: number;
  localeFile: string;
  localizedStrings: number;
  hardcodedCandidates: number;
  coverage: number;
  localeKeys: number;
  missingLocaleKeys: number;
  unusedLocaleKeys: number;
  dynamicKeys: number;
  unreadableFiles: number;
};

// Turn the raw project scan into an honest health snapshot. `coverage` is the
// share of user-facing strings already localized — localized calls over
// localized calls plus the hardcoded strings still awaiting migration — and is
// 1 when there is nothing left to localize.
export function buildReport(input: {
  filesScanned: number;
  localeFile: string;
  references: ProjectReferences;
  hardcodedCandidates: number;
  locale: unknown;
}): LocalizationReport {
  const localizedStrings = input.references.references.length;
  const leafKeys = flattenLocaleKeys(input.locale);
  const missingLocaleKeys = [...input.references.referencedKeys].filter((key) => typeof getNested(input.locale, key) !== "string").length;
  const unusedLocaleKeys = leafKeys.filter((key) => !input.references.referencedKeys.has(key)).length;
  const total = localizedStrings + input.hardcodedCandidates;

  return {
    filesScanned: input.filesScanned,
    localeFile: input.localeFile,
    localizedStrings,
    hardcodedCandidates: input.hardcodedCandidates,
    coverage: total === 0 ? 1 : Math.round((localizedStrings / total) * 10000) / 10000,
    localeKeys: leafKeys.length,
    missingLocaleKeys,
    unusedLocaleKeys,
    dynamicKeys: input.references.dynamicKeys,
    unreadableFiles: input.references.unreadable.length,
  };
}
