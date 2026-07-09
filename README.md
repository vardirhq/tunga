# Tunga

Hardcoded UI strings feel harmless — until the day your product needs translations.

```tsx
<button>Save</button>
<input placeholder="Search products" />
```

Then every developer on the project has to slow down and do careful, repetitive work:

- find every user-facing string
- invent stable translation keys
- update locale JSON by hand
- rewrite JSX without breaking the UI
- avoid touching routes, class names, API paths, event names, and other false positives
- keep doing this every time new strings are added

**Tunga automates that migration.**

It scans a TypeScript / React codebase, finds strings that look localizable, generates predictable i18n keys, updates locale files, and rewrites source code with reviewable codemods.

Tunga is not a translation platform. It is not SaaS. It is not an AI translation service. It is not a runtime i18n framework.

**Tunga is an i18n migration tool.**

---

## The 30-second version

Run this:

```bash
tunga scan
tunga extract
tunga apply
```

Turn this:

```tsx
export function Header() {
  return <button>Save</button>;
}
```

Into this:

```tsx
import { t } from "@/i18n";

export function Header() {
  return <button>{t("ui.header.save")}</button>;
}
```

And this locale file:

```json
{
  "ui": {
    "header": {
      "save": "Save"
    }
  }
}
```

---

## Why Tunga exists

Most applications do not begin life fully internationalized.

They begin with straightforward product work:

```tsx
<h1>Account settings</h1>
<button>Save changes</button>
<input placeholder="Search products" />
```

Months later someone says:

> We need translations.

At that point, migration is tedious and risky. The work is not conceptually hard, but it is easy to do inconsistently:

```tsx
<h1>{t("ui.settings.title")}</h1>
<button>{t("ui.settings.save_changes")}</button>
<input placeholder={t("ui.products.search")} />
```

Tunga exists to remove that repetitive migration work while keeping the developer in control.

---

## What Tunga finds

Tunga scans common UI string locations.

### JSX text

```tsx
<button>Save</button>
```

Candidate:

```text
src/components/Header.tsx:12  "Save"  →  ui.header.save
```

### JSX attributes

By default, JSX attribute scanning is limited to likely user-facing attributes: `title`, `placeholder`, `alt`, `aria-label`, and `label`. Set `scan.attributeAllowlist` to your own list, or to `false` to restore broad attribute scanning.

```tsx
<input placeholder="Search products" aria-label="Search" data-testid="search-input" />
```

Candidates:

```text
src/components/SearchBox.tsx:8  "Search products"  →  ui.search_box.search_products
src/components/SearchBox.tsx:8  "Search"           →  ui.search_box.search
```

### String literals

```ts
const emptyMessage = "No results found";
```

Candidate:

```text
src/components/SearchResults.tsx:4  "No results found"  →  ui.search_results.no_results_found
```

### Template literals and simple interpolation

```ts
const title = `Settings`;
const message = `Hello ${name}`;
const profile = `Hello ${user.name}`;
```

Candidates:

```text
src/pages/Settings.tsx:3  "Settings"          →  ui.settings.settings
src/pages/Settings.tsx:4  "Hello {{name}}"    →  ui.settings.hello
src/pages/Settings.tsx:5  "Hello {{name}}"    →  ui.settings.hello
```

The codemod keeps Tunga framework-agnostic and emits your configured function name, for example `t("ui.settings.hello", { name })` or `t("ui.settings.hello", { name: user.name })`. Tunga currently supports identifier and member-expression interpolations, and skips complex expressions such as function calls, arithmetic, and ternaries.


### Mixed JSX text interpolation

Tunga can combine simple JSX text and expression children into a single candidate:

```tsx
<p>Hello {user.name}, you have {count} messages</p>
```

Locale value:

```json
{
  "ui": {
    "profile": {
      "summary": "Hello {{name}}, you have {{count}} messages"
    }
  }
}
```

Codemod output:

```tsx
<p>{t("ui.profile.summary", { name: user.name, count })}</p>
```

Nested JSX and complex expressions are skipped initially so the migration stays predictable and reviewable.

---

## Example workflow

### 1. Scan

```bash
tunga scan
```

Example output:

```text
Found 3 candidate strings

src/components/Header.tsx:12  JSX text       "Save"
src/components/Header.tsx:15  JSX attribute  "Search products"
src/pages/Settings.tsx:8      JSX text       "Account settings"
```

To review candidates, run:

```bash
tunga scan --interactive
```

This opens a scrollable checklist grouped by confidence (high and medium are
preselected, low is not). `Space` toggles a candidate in or out — toggling a group
header flips the whole confidence bucket — and `Enter` opens the next-step menu:
save the review, save and extract, preview the apply, or run the full pipeline.

For one-at-a-time review with key editing, use `tunga scan --step`.

Either way, decisions are persisted to a review manifest (`.tunga/review.json` by
default, configurable via `manifest`), keyed by the candidate's content rather than
its position so they survive unrelated edits.
`extract`, `apply`, and `check` all consume the manifest: rejected strings are never
extracted or rewritten, and accepted strings are included even at low confidence,
using the key you chose. Re-running `scan --interactive` only prompts for candidates
you have not decided yet, so a large review can be done in several sittings. Commit
the manifest alongside your code.

### 2. Extract locale keys

```bash
tunga extract --dry-run
```

Preview:

```text
Would update:
  locales/en.json

Would add:
  ui.header.save = "Save"
  ui.header.search_products = "Search products"
  ui.settings.account_settings = "Account settings"
```

Then write the locale file:

```bash
tunga extract
```

Low-confidence candidates are skipped by both `extract` and `apply`, so the locale file
and the rewritten source always agree. Pass `--include-low-confidence` to either command
to include them.

### 3. Apply codemods

```bash
tunga apply --dry-run
```

Preview:

```text
Would modify:
  src/components/Header.tsx
  src/pages/Settings.tsx

Would replace:
  src/components/Header.tsx:12
  "Save"
  → t("ui.header.save")
```

Then rewrite source files:

```bash
tunga apply
```

---

## Architecture

Tunga is intentionally simple and inspectable.

```text
Scan source files
      ↓
Find candidate strings
      ↓
Generate stable keys
      ↓
Update locale files
      ↓
Rewrite source code
      ↓
Check future changes
      ↓
Report project health
```

The core workflow is exposed as CLI commands:

| Command | Purpose |
| --- | --- |
| `tunga scan` | Find candidate user-facing strings. |
| `tunga extract` | Generate locale keys and update locale JSON. |
| `tunga apply` | Rewrite source code with i18n function calls. |
| `tunga check` | Detect remaining hardcoded strings. |
| `tunga report` | Summarize localization health. |
| `tunga init` | Create a starter configuration. |

---

## Key generation

Tunga can generate keys from file paths, text, or component names.

### Path strategy

```tsx
// src/components/Header.tsx
<button>Save</button>
```

```text
ui.header.save
```

### Component strategy

```tsx
export function ProductCard() {
  return <button>Add to cart</button>;
}
```

```text
ui.product_card.add_to_cart
```

### Text strategy

```tsx
<button>Save changes</button>
```

```text
ui.save_changes
```

---

## Safety guarantees

Tunga edits code, so trust matters.

- **Dry runs are available** for previewing source and locale changes before writing files.
- **Codemods are reviewable** because Tunga rewrites normal source files instead of hiding changes behind a service.
- **Locale values are not silently overwritten** unless overwrite behavior is explicitly requested.
- **Location-aware codemod matching** uses file position metadata when available to avoid replacing every identical string blindly.
- **Git is strongly recommended**. Run Tunga on a clean branch and review the diff before merging.

Recommended workflow:

```bash
git checkout -b i18n-migration
tunga extract --dry-run
tunga apply --dry-run
tunga extract
tunga apply
git diff
npm test
```

---

## What Tunga is not

Tunga deliberately avoids becoming too magical.

It is not:

- a translation management platform
- a SaaS product
- an AI translation service
- a runtime i18n framework
- a replacement for `react-i18next`, `next-intl`, FormatJS, or your existing i18n layer

It is:

> **A developer tool for migrating hardcoded strings into an i18n workflow.**

---

## Configuration

Create a config file with:

```bash
tunga init
```

Example:

```ts
export default {
  include: ["src/**/*.{ts,tsx}"],
  ignore: ["node_modules/**", "dist/**"],
  locale: "locales/en.json",
  manifest: ".tunga/review.json",
  functionName: "t",
  importSource: "@/i18n",
  importKind: "named",
  keyStrategy: "path",
  namespace: "ui",
  scan: {
    attributeAllowlist: ["title", "placeholder", "alt", "aria-label", "label"],
  },
  deny: {
    patterns: ["\\.zip$", "^--"],
    objectKeys: ["sub", "kind", "value"],
    callees: ["classNames", "analytics.track", "Set"],
  },
  filters: {
    ignoreCodeLike: true,
    ignoreShortLowercase: true,
  },
};
```

---

## False-positive filtering

Tunga tries to avoid strings that are usually not user-facing copy, including:

- routes and file paths
- technical JSX attributes outside the default allowlist
- technical object properties such as `href`, `src`, `route`, `method`, `icon`, `variant`, and `handler`
- code-like snippets containing patterns such as `=>`, `window.`, `==`, `);`, or function-shaped calls
- short lowercase strings with one or two words unless the surrounding context strongly suggests UI copy
- Tailwind-style class strings
- CSS-like utility classes
- CSS values such as `1px solid ${theme.border}` or `0 2px 8px rgba(0,0,0,0.2)`
- SVG path data
- URLs and email addresses
- API endpoints
- HTTP methods
- event names
- MIME types
- environment variables
- existing localization keys
- strings that also appear in a `===`/`!==` comparison, a `switch` case, or a
  `new Set(...)`/`new Map(...)` literal anywhere in the project — these are usually
  persisted or branched-on values, so they are downgraded to low confidence

Beyond the built-in heuristics you can deny candidates explicitly:

- `deny.patterns` — regexes tested against the candidate text
- `deny.objectKeys` — object property keys whose string values are never candidates
- `deny.callees` — call or constructor names whose arguments are never candidates
  (e.g. `classNames`, `analytics.track`, `Set`)
- `// tunga-ignore-next-line` — suppresses all candidates on the following line

No scanner is perfect. Tunga is designed to make candidates visible so you can review them before applying changes.

---

## Existing localization detection

Tunga avoids strings that are already part of common localization workflows, including:

```ts
t("ui.save");
translate("ui.save");
i18n.t("ui.save");
intl.formatMessage({ id: "ui.save" });
formatMessage({ id: "ui.save" });
t.rich("ui.save");
useTranslations("Settings");
```

---

## Roadmap

### Current MVP

- React
- TypeScript
- JSX text scanning
- JSX attribute scanning
- string literal scanning
- template literal scanning without interpolation
- locale JSON generation
- Babel-powered codemods
- dry-run previews
- configurable key strategies
- interactive review with a persisted review manifest
- config denylists and inline ignore directives

### Future improvements

- grouped duplicate string review
- framework presets
- stronger component and route awareness
- more i18n providers
- `next-intl` presets
- `react-i18next` presets
- FormatJS presets
- format-preserving codemods (recast-style) for smaller diffs
- HTML reports
- Markdown reports

---

## Philosophy

Tunga should not be magical.

Every change should be visible.

Every modification should be explainable.

Tunga exists to remove repetitive work, not take control away from the developer.

A good migration tool should feel boring in the best way: predictable, inspectable, and easy to revert.
