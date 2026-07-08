import { expect, it } from "vitest";
import { applyCodemod } from "../src/core/codemod.js";
import { defaultConfig } from "../src/core/config.js";

it("wraps JSX text with t call and import", () => {
  const result = applyCodemod({
    source: `export function A(){return <button>Save</button>}`,
    config: defaultConfig,
    candidates: [{ text: "Save", keySuggestion: "ui.save", confidence: "high" }],
  });

  expect(result.code).toContain(`import { t } from "@/i18n"`);
  expect(result.code).toContain(`<button>{t("ui.save")}</button>`);
});

it("rewrites JSX attributes", () => {
  const result = applyCodemod({
    source: `const x=<input placeholder="Search" />`,
    config: defaultConfig,
    candidates: [{ text: "Search", keySuggestion: "ui.search", confidence: "high" }],
    skipImport: true,
  });

  expect(result.code).toContain(`placeholder={t("ui.search")}`);
});

it("uses location-aware matching when locations are available", () => {
  const source = `export function A(){return <><button>Open</button><h1>Open</h1></>}`;
  const result = applyCodemod({
    source,
    config: defaultConfig,
    skipImport: true,
    candidates: [{ text: "Open", keySuggestion: "ui.heading.open", confidence: "high", line: 1, column: 54, type: "jsx-text" }],
  });

  expect(result.code).toContain(`<button>Open</button>`);
  expect(result.code).toContain(`<h1>{t("ui.heading.open")}</h1>`);
});

it("rewrites template literals with interpolation variables", () => {
  const result = applyCodemod({
    source: "const message = `Hello ${user.name}`;",
    config: defaultConfig,
    skipImport: true,
    candidates: [
      { text: "Hello {{name}}", keySuggestion: "ui.hello", confidence: "medium", interpolations: [{ name: "name", expression: "user.name" }] },
    ],
  });

  expect(result.code).toContain('const message = t("ui.hello", {');
  expect(result.code).toContain('name: user.name');
});

it("preserves edge whitespace when replacing JSX text next to an expression", () => {
  const result = applyCodemod({
    source: "const el=<p>{ollamaName} is running</p>;",
    config: defaultConfig,
    skipImport: true,
    candidates: [{ text: "is running", keySuggestion: "ui.status.is_running", confidence: "high" }],
  });

  expect(result.code).toContain(`{ollamaName}{" "}{t("ui.status.is_running")}`);
});

it("keeps whitespace on both sides of JSX text between expressions", () => {
  const result = applyCodemod({
    source: "const el=<p>{used} used of {total}</p>;",
    config: defaultConfig,
    skipImport: true,
    candidates: [{ text: "used of", keySuggestion: "ui.storage.used_of", confidence: "high" }],
  });

  expect(result.code).toContain(`{used}{" "}{t("ui.storage.used_of")}{" "}{total}`);
});

it("rewrites strings inside inline handlers without touching localization calls", () => {
  const result = applyCodemod({
    source: `const el=<button onClick={() => showToast("Copied", t("ui.existing"))}>Go</button>;`,
    config: defaultConfig,
    skipImport: true,
    candidates: [{ text: "Copied", keySuggestion: "ui.copied", confidence: "medium" }],
  });

  expect(result.code).toContain(`showToast(t("ui.copied"), t("ui.existing"))`);
});

it("rewrites mixed JSX children as one translation", () => {
  const result = applyCodemod({
    source: "const el=<p>Hello {user.name}, you have {count} messages</p>;",
    config: defaultConfig,
    skipImport: true,
    candidates: [
      {
        text: "Hello {{name}}, you have {{count}} messages",
        keySuggestion: "ui.profile.summary",
        confidence: "medium",
        interpolations: [
          { name: "name", expression: "user.name" },
          { name: "count", expression: "count" },
        ],
      },
    ],
  });

  expect(result.code).toContain('<p>{t("ui.profile.summary", {');
  expect(result.code).toContain('name: user.name');
  expect(result.code).toContain('count');
});
