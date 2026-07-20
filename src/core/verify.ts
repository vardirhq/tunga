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
