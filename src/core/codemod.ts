import { parse } from "@babel/parser";
import generateModule from "@babel/generator";
import traverseModule from "@babel/traverse";
import * as t from "@babel/types";
import type { CandidateString, TungaConfig } from "../types/index.js";
import { ensureImport } from "./imports.js";
import { interpolationObject, simpleExpression, uniquePlaceholder } from "./interpolation.js";
import { isExistingLocalization, isJsxAttributeValue } from "./scanner.js";

const traverse = (traverseModule as any).default ?? traverseModule;
const generate = (generateModule as any).default ?? generateModule;

type ReplacementCandidate = Pick<CandidateString, "text" | "keySuggestion" | "confidence" | "interpolations"> &
  Partial<Pick<CandidateString, "line" | "column" | "type">>;

export function applyCodemod(opts: {
  source: string;
  candidates: ReplacementCandidate[];
  config: TungaConfig;
  skipImport?: boolean;
  includeLowConfidence?: boolean;
}) {
  const ast = parse(opts.source, { sourceType: "module", plugins: ["jsx", "typescript"] });
  const candidates = opts.candidates.filter((candidate) => candidate.confidence !== "low" || opts.includeLowConfidence);
  const byLocation = new Map(candidates.filter(hasLocation).map((candidate) => [locationKey(candidate), candidate]));
  const byText = new Map(candidates.filter((candidate) => !hasLocation(candidate)).map((candidate) => [candidate.text, candidate]));
  let changed = false;

  function call(candidate: ReplacementCandidate) {
    const args: t.Expression[] = [t.stringLiteral(candidate.keySuggestion)];
    if (candidate.interpolations?.length) args.push(interpolationObject(candidate.interpolations));
    return t.callExpression(t.identifier(opts.config.functionName), args);
  }

  function match(node: t.Node, text: string, type: CandidateString["type"]) {
    const loc = node.loc?.start;
    const cleanText = text.replace(/\s+/g, " ").trim();

    if (loc) {
      const located = byLocation.get(`${loc.line}:${loc.column}:${type}`);
      if (located?.text === cleanText) return located;
    }

    return byText.get(cleanText);
  }

  traverse(ast, {
    JSXElement(nodePath: any) {
      const text = mixedJsxText(nodePath.node.children);
      if (!text) return;
      const candidate = match(nodePath.node, text, "jsx-mixed");
      if (!candidate) return;
      nodePath.node.children = [t.jsxExpressionContainer(call(candidate))];
      changed = true;
    },
    JSXFragment(nodePath: any) {
      const text = mixedJsxText(nodePath.node.children);
      if (!text) return;
      const candidate = match(nodePath.node, text, "jsx-mixed");
      if (!candidate) return;
      nodePath.node.children = [t.jsxExpressionContainer(call(candidate))];
      changed = true;
    },
    JSXText(nodePath: any) {
      const candidate = match(nodePath.node, nodePath.node.value, "jsx-text");
      if (!candidate) return;
      const replacement = [t.jsxExpressionContainer(call(candidate))];
      const siblings: t.Node[] = nodePath.parent.children ?? [];
      const index = siblings.indexOf(nodePath.node);
      // The candidate text was trimmed at scan time; keep edge whitespace that
      // separated the text from an adjacent sibling (JSX drops newline edges itself).
      if (index > 0 && significantEdgeSpace(nodePath.node.value, "start")) replacement.unshift(jsxSpace());
      if (index !== -1 && index < siblings.length - 1 && significantEdgeSpace(nodePath.node.value, "end")) replacement.push(jsxSpace());
      if (replacement.length === 1) nodePath.replaceWith(replacement[0]);
      else nodePath.replaceWithMultiple(replacement);
      changed = true;
    },
    JSXAttribute(nodePath: any) {
      if (!t.isStringLiteral(nodePath.node.value)) return;
      const candidate = match(nodePath.node.value, nodePath.node.value.value, "jsx-attribute");
      if (!candidate) return;
      nodePath.node.value = t.jsxExpressionContainer(call(candidate));
      changed = true;
    },
    StringLiteral(nodePath: any) {
      if (nodePath.parentPath.isImportDeclaration() || isExistingLocalization(nodePath, opts.config)) return;
      if (isJsxAttributeValue(nodePath)) return;

      const candidate = match(nodePath.node, nodePath.node.value, "string-literal");
      if (!candidate) return;
      nodePath.replaceWith(call(candidate));
      changed = true;
    },
    TemplateLiteral(nodePath: any) {
      const templateText = templateCandidateText(nodePath.node);
      if (!templateText) return;
      const candidate = match(nodePath.node, templateText, "template-literal");
      if (!candidate) return;
      nodePath.replaceWith(call(candidate));
      changed = true;
    },
  });

  if (changed && !opts.skipImport) ensureImport(ast.program, opts.config);
  return { code: generate(ast, { jsescOption: { minimal: true } }).code, changed };
}

function jsxSpace() {
  return t.jsxExpressionContainer(t.stringLiteral(" "));
}

function significantEdgeSpace(value: string, edge: "start" | "end") {
  const match = edge === "start" ? value.match(/^\s+/) : value.match(/\s+$/);
  return match !== null && !match[0].includes("\n");
}

function hasLocation(candidate: ReplacementCandidate) {
  return candidate.line !== undefined && candidate.column !== undefined && candidate.type !== undefined;
}

function locationKey(candidate: ReplacementCandidate) {
  return `${candidate.line}:${candidate.column}:${candidate.type}`;
}

function templateCandidateText(node: t.TemplateLiteral) {
  if (node.expressions.length === 0) return node.quasis[0]?.value.cooked ?? "";
  const used = new Set<string>();
  let text = node.quasis[0]?.value.cooked ?? "";
  for (let i = 0; i < node.expressions.length; i++) {
    const expression = simpleExpression(node.expressions[i]);
    if (!expression) return undefined;
    const name = uniquePlaceholder(expression.preferredName, used);
    text += `{{${name}}}${node.quasis[i + 1]?.value.cooked ?? ""}`;
  }
  return text;
}

function mixedJsxText(children: t.JSXElement["children"]) {
  const meaningful = children.filter((child) => !(t.isJSXText(child) && child.value.replace(/\s+/g, " ").trim() === ""));
  if (meaningful.length < 2 || !meaningful.some((child) => t.isJSXExpressionContainer(child))) return undefined;
  const used = new Set<string>();
  let text = "";
  for (const child of children) {
    if (t.isJSXText(child)) text += child.value.replace(/\s+/g, " ");
    else if (t.isJSXExpressionContainer(child) && !t.isJSXEmptyExpression(child.expression)) {
      const expression = simpleExpression(child.expression);
      if (!expression) return undefined;
      text += `{{${uniquePlaceholder(expression.preferredName, used)}}}`;
    }
    else return undefined;
  }
  return text.trim();
}
