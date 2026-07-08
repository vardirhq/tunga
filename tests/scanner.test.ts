import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/core/config.js";
import { scanSource } from "../src/core/scanner.js";

describe("scanner", () => {
  it("detects UI strings and ignores noisy values", () => {
    const candidates = scanSource(
      `const el=<><button>Save</button><input placeholder="Search products" className="text-sm font-bold" /></>;
const title="Dashboard"; const route="/settings"; const label=\`Settings\`; t("ui.save")`,
      { file: "src/Header.tsx", config: defaultConfig },
    );

    expect(candidates.map((candidate) => candidate.text)).toEqual(["Save", "Search products", "Dashboard", "Settings"]);
  });

  it("detects component names for component key generation", () => {
    const candidates = scanSource(`export function ProductCard(){return <button>Add to cart</button>}`, {
      file: "src/ProductCard.tsx",
      config: { ...defaultConfig, keyStrategy: "component" },
    });

    expect(candidates[0]?.componentName).toBe("ProductCard");
    expect(candidates[0]?.keySuggestion).toBe("ui.product_card.add_to_cart");
  });

  it("ignores strings already handled by common localization APIs", () => {
    const candidates = scanSource(
      `t("ui.save"); translate("ui.cancel"); i18n.t("ui.open"); intl.formatMessage({ id: "ui.close" }); formatMessage({ id: "ui.next" }); t.rich("ui.bold"); useTranslations("Settings"); const label = "Visible";`,
      { file: "src/Header.tsx", config: defaultConfig },
    );

    expect(candidates.map((candidate) => candidate.text)).toEqual(["Visible"]);
  });

  it("filters JSX attributes with the default allowlist and supports broad scanning", () => {
    const source = `const el=<img alt="Product photo" data-testid="hero-image" title="Hero" />`;
    expect(scanSource(source, { file: "src/App.tsx", config: defaultConfig }).map((c) => c.text)).toEqual(["Product photo", "Hero"]);
    expect(
      scanSource(source, { file: "src/App.tsx", config: { ...defaultConfig, scan: { ...defaultConfig.scan, attributeAllowlist: false } } }).map((c) => c.text),
    ).toEqual(["Product photo", "hero-image", "Hero"]);
  });

  it("skips technical object properties while keeping UI-looking properties", () => {
    const candidates = scanSource(
      `const nav={label:"Settings", href:"/settings", icon:"gear", title:"Account settings", variant:"ghost", emptyState:"No projects yet"};`,
      { file: "src/nav.ts", config: defaultConfig },
    );
    expect(candidates.map((c) => c.text)).toEqual(["Settings", "Account settings", "No projects yet"]);
  });

  it("extracts simple template literal interpolation and skips complex interpolation", () => {
    const candidates = scanSource("const a = `Hello ${name}`; const b = `Hi ${user.name}`; const c = `Hi ${getName()}`;", {
      file: "src/messages.ts",
      config: defaultConfig,
    });
    expect(candidates.map((c) => c.text)).toEqual(["Hello {{name}}", "Hi {{name}}"]);
    expect(candidates[1]?.interpolations).toEqual([{ name: "name", expression: "user.name" }]);
  });

  it("sees strings inside inline JSX handlers and object props, but not attribute values", () => {
    const candidates = scanSource(
      `const el = <div
        onClick={() => showToast("Copied to clipboard")}
        onContextMenu={() => openMenu([{ label: "Rename item" }])}
        options={[{ label: "Sort by name" }]}
        placeholder="Skipped here"
        title={"Also skipped"}
      />;`,
      { file: "src/Menu.tsx", config: defaultConfig },
    );
    expect(candidates.filter((c) => c.type === "string-literal").map((c) => c.text)).toEqual([
      "Copied to clipboard",
      "Rename item",
      "Sort by name",
    ]);
    // attribute values still go through the JSXAttribute allowlist path only
    expect(candidates.filter((c) => c.type === "jsx-attribute").map((c) => c.text)).toEqual(["Skipped here"]);
  });

  it("ignores CSS values and SVG path data", () => {
    const candidates = scanSource(
      "const s = `1px solid ${theme.border}`; const sh = `0 2px 8px rgba(0,0,0,0.2)`; const p = <path d=\"M4 4h16v16H4z\" />; const d = \"M4 4h16v16H4z\"; const ok = `Renaming ${name} now`;",
      { file: "src/Card.tsx", config: { ...defaultConfig, scan: { ...defaultConfig.scan, attributeAllowlist: false } } },
    );
    expect(candidates.map((c) => c.text)).toEqual(["Renaming {{name}} now"]);
  });

  it("combines mixed JSX text with simple expressions and skips nested elements", () => {
    const candidates = scanSource(`const el=<><p>Hello {user.name}, you have {count} messages</p><p>Hello <strong>friend</strong></p></>;`, {
      file: "src/Profile.tsx",
      config: defaultConfig,
    });
    expect(candidates.map((c) => c.text)).toContain("Hello {{name}}, you have {{count}} messages");
    expect(candidates.map((c) => c.text)).not.toContain("Hello friend");
  });
});
