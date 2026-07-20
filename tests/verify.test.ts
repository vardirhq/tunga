import { expect, it } from "vitest";
import { defaultConfig } from "../src/core/config.js";
import { collectReferences, findOrphanedKeys, flattenLocaleKeys, placeholdersIn, verifyReference } from "../src/core/verify.js";

const config = defaultConfig;

function collect(source: string) {
  return collectReferences({ source, file: "src/App.tsx", config });
}

it("collects static translation calls with and without params", () => {
  const { references, dynamicKeys } = collect(
    `export function A(){return <><h1>{t("ui.title")}</h1><p>{t("ui.hello", { name })}</p></>}`,
  );

  expect(dynamicKeys).toBe(0);
  expect(references.map((reference) => reference.key)).toEqual(["ui.title", "ui.hello"]);
  expect(references[1].params).toEqual(["name"]);
  expect(references[1].hasParamsArg).toBe(true);
});

it("matches the member form and respects the configured function name", () => {
  const bare = collect(`const a = i18n.t("ui.save");`);
  expect(bare.references.map((reference) => reference.key)).toEqual(["ui.save"]);

  const renamed = collectReferences({ source: `const a = tr("ui.save");`, file: "x.ts", config: { ...config, functionName: "tr" } });
  expect(renamed.references).toHaveLength(1);
  // `t` is not the configured function here, so it must be ignored.
  expect(collectReferences({ source: `const a = t("ui.save");`, file: "x.ts", config: { ...config, functionName: "tr" } }).references).toHaveLength(0);
});

it("counts dynamic keys instead of reporting them as calls", () => {
  const { references, dynamicKeys } = collect(`const a = t(key); const b = t(\`ui.\${x}\`);`);
  expect(references).toHaveLength(0);
  expect(dynamicKeys).toBe(2);
});

it("marks non-enumerable param objects as unknown", () => {
  const { references } = collect(`const a = t("ui.hello", props); const b = t("ui.hi", { ...rest });`);
  expect(references[0].paramsKnown).toBe(false);
  expect(references[1].paramsKnown).toBe(false);
  expect(references[0].hasParamsArg).toBe(true);
});

it("flags a key that is missing from the locale", () => {
  const [reference] = collect(`const a = t("ui.missing");`).references;
  const issues = verifyReference(reference, { ui: { present: "Hi" } }, "t");
  expect(issues).toHaveLength(1);
  expect(issues[0].type).toBe("missing-key");
  expect(issues[0].severity).toBe("error");
});

it("flags a key that resolves to a group instead of a string", () => {
  const [reference] = collect(`const a = t("ui.header");`).references;
  const issues = verifyReference(reference, { ui: { header: { save: "Save" } } }, "t");
  expect(issues[0].type).toBe("missing-key");
});

it("flags empty locale values", () => {
  const [reference] = collect(`const a = t("ui.empty");`).references;
  const issues = verifyReference(reference, { ui: { empty: "   " } }, "t");
  expect(issues[0].type).toBe("empty-value");
});

it("flags placeholders that the call never passes", () => {
  const [noArgs] = collect(`const a = t("ui.hello");`).references;
  expect(verifyReference(noArgs, { ui: { hello: "Hello {{name}}" } }, "t")[0].type).toBe("placeholder-mismatch");

  const [wrongArgs] = collect(`const a = t("ui.hello", { other });`).references;
  const issues = verifyReference(wrongArgs, { ui: { hello: "Hello {{name}}" } }, "t");
  expect(issues[0].type).toBe("placeholder-mismatch");
  expect(issues[0].message).toContain("{{name}}");
});

it("accepts a call that passes every required placeholder", () => {
  const [reference] = collect(`const a = t("ui.summary", { name, count });`).references;
  const issues = verifyReference(reference, { ui: { summary: "Hi {{name}}, {{count}} left" } }, "t");
  expect(issues).toHaveLength(0);
});

it("does not guess at placeholders when the param object is dynamic", () => {
  const [reference] = collect(`const a = t("ui.hello", props);`).references;
  const issues = verifyReference(reference, { ui: { hello: "Hello {{name}}" } }, "t");
  expect(issues).toHaveLength(0);
});

it("extracts unique placeholder names", () => {
  expect(placeholdersIn("Hi {{name}}, you have {{count}} of {{count}}")).toEqual(["name", "count"]);
  expect(placeholdersIn("No placeholders here")).toEqual([]);
});

it("flattens only string-leaf locale keys", () => {
  expect(flattenLocaleKeys({ ui: { a: "A", nested: { b: "B" } }, top: "T" }).sort()).toEqual(["top", "ui.a", "ui.nested.b"]);
});

it("reports locale keys that nothing references as warnings", () => {
  const orphans = findOrphanedKeys({ ui: { used: "U", unused: "X" } }, new Set(["ui.used"]), "t");
  expect(orphans).toHaveLength(1);
  expect(orphans[0]).toMatchObject({ type: "orphaned-key", severity: "warning", key: "ui.unused" });
});
