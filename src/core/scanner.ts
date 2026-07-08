import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import fg from "fast-glob";
import type { CandidateString, TungaConfig } from "../types/index.js";
import { mergeConfig } from "./config.js";
import { confidenceFor, shouldIgnoreString } from "./filters.js";
import { generateKey } from "./keygen.js";
import { simpleExpression, uniquePlaceholder, type Interpolation } from "./interpolation.js";
import { isTechnicalObjectPropertyKey, isUiObjectPropertyKey, objectPropertyKeyName } from "./objectKeys.js";

const traverse = (traverseModule as any).default ?? traverseModule;
const LOCALIZATION_FUNCTIONS = new Set([
  "t",
  "translate",
  "formatMessage",
  "useTranslations",
]);
const LOCALIZATION_METHODS = new Set(["t", "rich", "formatMessage"]);

export async function findSourceFiles(config: TungaConfig, cwd = process.cwd(), paths?: string[]) {
  const patterns = paths?.length ? paths : config.include;
  return fg(patterns, { cwd, absolute: true, ignore: config.ignore, onlyFiles: true });
}

export async function scanProject(input: Partial<TungaConfig> & { cwd?: string; paths?: string[] } = {}) {
  const config = mergeConfig(input);
  const cwd = input.cwd ?? process.cwd();
  const files = await findSourceFiles(config, cwd, input.paths);
  return (await Promise.all(files.map((file) => scanFile(file, config, cwd)))).flat();
}

export function scanFile(file: string, config: TungaConfig, cwd = process.cwd()): CandidateString[] {
  const source = readFileSync(file, "utf8");
  return scanSource(source, { file: path.relative(cwd, file), config });
}

export function scanSource(source: string, { file, config }: { file: string; config: TungaConfig }) {
  const ast = parse(source, { sourceType: "module", plugins: ["jsx", "typescript"] });
  const candidates: CandidateString[] = [];

  const mixedJsxText = new WeakSet<t.JSXText>();

  function addCandidate(node: t.Node, text: string, type: CandidateString["type"], context: string, nodePath: NodePath, meta: { interpolations?: Interpolation[]; strongUi?: boolean; reason?: string } = {}) {
    const cleanText = text.replace(/\s+/g, " ").trim();
    const reason = shouldIgnoreString(cleanText, config, { strongUi: meta.strongUi });
    if (reason) return;

    const loc = node.loc?.start ?? { line: 1, column: 0 };
    const componentName = findComponentName(nodePath);

    candidates.push({
      id: `${file}:${loc.line}:${loc.column}:${type}`,
      text: cleanText,
      file,
      line: loc.line,
      column: loc.column,
      context,
      type,
      componentName,
      keySuggestion: generateKey(cleanText, {
        file,
        namespace: config.namespace,
        strategy: config.keyStrategy,
        componentName,
      }),
      confidence: confidenceFor(cleanText, { type, strongUi: meta.strongUi, hasInterpolation: Boolean(meta.interpolations?.length) }),
      reason: meta.reason,
      interpolations: meta.interpolations,
    });
  }

  traverse(ast, {
    JSXElement(nodePath: NodePath<t.JSXElement>) {
      if (!config.scan.jsxText) return;
      const mixed = collectJsxMixed(nodePath.node.children);
      if (!mixed) return;
      for (const child of nodePath.node.children) if (t.isJSXText(child)) mixedJsxText.add(child);
      addCandidate(nodePath.node, mixed.text, "jsx-mixed", "Mixed JSX text", nodePath, { interpolations: mixed.interpolations, strongUi: true });
    },
    JSXFragment(nodePath: NodePath<t.JSXFragment>) {
      if (!config.scan.jsxText) return;
      const mixed = collectJsxMixed(nodePath.node.children);
      if (!mixed) return;
      for (const child of nodePath.node.children) if (t.isJSXText(child)) mixedJsxText.add(child);
      addCandidate(nodePath.node, mixed.text, "jsx-mixed", "Mixed JSX text", nodePath, { interpolations: mixed.interpolations, strongUi: true });
    },
    JSXText(nodePath: NodePath<t.JSXText>) {
      if (config.scan.jsxText && !mixedJsxText.has(nodePath.node)) {
        addCandidate(nodePath.node, nodePath.node.value, "jsx-text", "JSX text", nodePath, { strongUi: true });
      }
    },
    JSXAttribute(nodePath: NodePath<t.JSXAttribute>) {
      if (config.scan.jsxAttributes && t.isStringLiteral(nodePath.node.value)) {
        const attr = String(nodePath.node.name.name);
        if (Array.isArray(config.scan.attributeAllowlist) && !config.scan.attributeAllowlist.includes(attr)) return;
        addCandidate(
          nodePath.node.value,
          nodePath.node.value.value,
          "jsx-attribute",
          `JSX attribute ${attr}`,
          nodePath,
          { strongUi: true },
        );
      }
    },
    StringLiteral(nodePath: NodePath<t.StringLiteral>) {
      if (!config.scan.stringLiterals || isExistingLocalization(nodePath, config)) return;
      if (nodePath.parentPath.isImportDeclaration() || nodePath.parentPath.isExportNamedDeclaration()) return;
      if (isJsxAttributeValue(nodePath)) return;
      const prop = nodePath.parentPath.isObjectProperty() ? nodePath.parentPath.node : undefined;
      const key = prop ? objectPropertyKeyName(prop) : undefined;
      if (key && isTechnicalObjectPropertyKey(key)) return;
      addCandidate(nodePath.node, nodePath.node.value, "string-literal", key ? `Object property ${key}` : "String literal", nodePath, { strongUi: key ? isUiObjectPropertyKey(key) : false });
    },
    TemplateLiteral(nodePath: NodePath<t.TemplateLiteral>) {
      if (!config.scan.templateLiterals) return;
      if (isExistingLocalization(nodePath, config)) return;
      const template = templateCandidate(nodePath.node);
      if (!template) return;
      addCandidate(nodePath.node, template.text, "template-literal", "Template literal", nodePath, { interpolations: template.interpolations, strongUi: Boolean(template.interpolations.length) });
    },
  });

  return candidates;
}

// Only strings in direct attribute value position (`attr="..."` or `attr={"..."}`)
// belong to the JSXAttribute visitor; strings inside handler bodies, arrays, or
// objects passed as props are regular string literals.
export function isJsxAttributeValue(nodePath: NodePath) {
  if (nodePath.parentPath?.isJSXAttribute()) return true;
  return Boolean(nodePath.parentPath?.isJSXExpressionContainer() && nodePath.parentPath.parentPath?.isJSXAttribute());
}

export function isExistingLocalization(nodePath: NodePath, config: TungaConfig) {
  const callExpression = nodePath.findParent((parent) => parent.isCallExpression()) as NodePath<t.CallExpression> | null;
  if (!callExpression) return false;

  const callee = callExpression.node.callee;
  if (t.isIdentifier(callee)) {
    return callee.name === config.functionName || LOCALIZATION_FUNCTIONS.has(callee.name);
  }

  if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
    if (LOCALIZATION_METHODS.has(callee.property.name)) return true;
    return t.isIdentifier(callee.object, { name: "intl" }) && callee.property.name === "formatMessage";
  }

  return false;
}

function findComponentName(nodePath: NodePath) {
  const functionParent = nodePath.findParent(
    (parent) => parent.isFunctionDeclaration() || parent.isFunctionExpression() || parent.isArrowFunctionExpression(),
  );

  if (!functionParent) return undefined;
  const node = functionParent.node;

  if ((t.isFunctionDeclaration(node) || t.isFunctionExpression(node)) && node.id?.name) {
    return node.id.name;
  }

  const parent = functionParent.parentPath;
  if (parent?.isVariableDeclarator() && t.isIdentifier(parent.node.id)) {
    return parent.node.id.name;
  }

  return undefined;
}

function templateCandidate(node: t.TemplateLiteral): { text: string; interpolations: Interpolation[] } | undefined {
  if (node.expressions.length === 0) return { text: node.quasis[0]?.value.cooked ?? "", interpolations: [] };
  const used = new Set<string>();
  const interpolations: Interpolation[] = [];
  let text = node.quasis[0]?.value.cooked ?? "";
  for (let i = 0; i < node.expressions.length; i++) {
    const expression = simpleExpression(node.expressions[i]);
    if (!expression) return undefined;
    const name = uniquePlaceholder(expression.preferredName, used);
    interpolations.push({ name, expression: expression.expression });
    text += `{{${name}}}${node.quasis[i + 1]?.value.cooked ?? ""}`;
  }
  return { text, interpolations };
}

function collectJsxMixed(children: t.JSXElement["children"]): { text: string; interpolations: Interpolation[] } | undefined {
  const meaningful = children.filter((child) => !(t.isJSXText(child) && child.value.replace(/\s+/g, " ").trim() === ""));
  if (meaningful.length < 2 || !meaningful.some((child) => t.isJSXExpressionContainer(child))) return undefined;
  const used = new Set<string>();
  const interpolations: Interpolation[] = [];
  let text = "";
  for (const child of children) {
    if (t.isJSXText(child)) {
      text += child.value.replace(/\s+/g, " ");
      continue;
    }
    if (t.isJSXExpressionContainer(child) && !t.isJSXEmptyExpression(child.expression)) {
      const expression = simpleExpression(child.expression);
      if (!expression) return undefined;
      const name = uniquePlaceholder(expression.preferredName, used);
      interpolations.push({ name, expression: expression.expression });
      text += `{{${name}}}`;
      continue;
    }
    return undefined;
  }
  return { text: text.trim(), interpolations };
}
