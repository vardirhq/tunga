# CLAUDE.md

Guidance for AI assistants working in this repository.

## What Tunga is

Tunga is a **CLI tool that migrates hardcoded UI strings in a TypeScript/React
codebase into a structured i18n workflow**. It scans source files for localizable
strings, generates stable translation keys, updates a locale JSON file, and
rewrites the source with `t("key")`-style calls using Babel codemods.

It is *not* a translation service, a runtime i18n framework, or a SaaS product.
It is a one-time (and repeatable) migration/codemod tool. The guiding philosophy
is **"boring in the best way": predictable, inspectable, reviewable, and easy to
revert.** Every change Tunga makes should be visible in a git diff. When adding
features, preserve that property — avoid magic, prefer dry-run-able and
reviewable behavior.

Read `README.md` for the full user-facing product description and
`FEEDBACK.md` for a real-world field report (the Geyma migration) that documents
known sharp edges and the reasoning behind several heuristics.

## Tech stack

- **Language:** TypeScript, strict mode, ESM (`"type": "module"`).
- **Module system:** `NodeNext`. Relative imports **must use `.js` extensions**
  even though the source files are `.ts` (e.g. `import { scanProject } from "../core/scanner.js"`). This is required — do not drop the extension.
- **AST engine:** Babel (`@babel/parser`, `@babel/traverse`, `@babel/generator`,
  `@babel/types`) with the `jsx` and `typescript` plugins. All scanning and
  rewriting is AST-based, never regex-on-source (regex is only used for
  *classifying* already-extracted string text in `filters.ts`).
- **CLI:** `commander`.
- **Interactive TUI:** `@clack/prompts`.
- **File discovery:** `fast-glob`.
- **Output formatting:** `prettier` (applied to rewritten files after codemods).
- **Build:** `tsup` (bundles `src/cli.ts` to `dist/cli.js`, ESM + d.ts).
- **Tests:** `vitest`.

Note: `@babel/traverse` and `@babel/generator` are CommonJS-interop modules; the
code accesses `.default` defensively — see the
`const traverse = (traverseModule as any).default ?? traverseModule;` pattern in
`scanner.ts` and `codemod.ts`. Reuse this pattern if you import them elsewhere.

## Commands

```bash
npm install          # install dependencies (node_modules is gitignored)
npm test             # run the vitest suite (vitest run)
npm run typecheck    # tsc --noEmit
npm run build        # tsup bundle to dist/
```

There is no lint step and no CI config in the repo. **Before committing, run both
`npm test` and `npm run typecheck`** — both must pass. The suite is fast (~1s).

The built CLI is exposed as the `tunga` binary (`bin` → `dist/cli.js`). The user
workflow is `tunga scan` → `tunga extract` → `tunga apply`, plus `tunga check`
and `tunga verify` (CI gates) and `tunga report`.

## Architecture

The data flows in one direction through clearly separated layers:

```
cli.ts (commander wiring)
  → commands/*.ts   (orchestration per subcommand)
    → core/*.ts     (pure logic: scanning, keygen, codemods, locale, manifest)
    → interactive/  (TUI review models)
    → output/       (rendering: TUI notes, tables, JSON)
```

### `src/cli.ts`
Thin entry point. Defines the seven subcommands and their flags with `commander`,
then delegates to a handler in `src/commands/`. Keep it thin — logic lives in
commands and core.

### `src/commands/` — one file per subcommand
- `init.ts` — writes a starter `tunga.config.ts` from `configTemplate()`.
- `scan.ts` — scans and prints candidates; `--interactive`/`--step` open the TUI
  review and can chain straight into extract/apply.
- `extract.ts` — scans, selects candidates via the manifest, writes locale keys.
- `apply.ts` — scans, selects candidates, rewrites source files with codemods.
- `check.ts` — scans; exits non-zero if any candidate remains (CI gate).
- `verify.ts` — scans the *rewritten* source for translation calls and asserts
  each resolves against the locale file (missing/empty keys, placeholder
  mismatches, orphaned keys). CI gate; `--json` for machine output.
- `report.ts` — summary counts (several metrics are still stubbed at `0`).

Commands are the only place that touches the filesystem for user files, loads
config, and drives the TUI. Core modules stay pure/testable.

### `src/core/` — the engine (most logic lives here)
- `config.ts` — `defaultConfig`, `mergeConfig` (deep-merges the nested
  `scan`/`deny`/`filters` objects), and `loadConfig` (looks for
  `tunga.config.{ts,js,json}`).
- `scanner.ts` — the heart of detection. Parses each file, traverses the AST, and
  emits `CandidateString[]`. Handles JSX text, mixed JSX text+interpolation, JSX
  attributes (allowlist-gated), string literals (with object-key/callee denial),
  and template literals. Also collects **semantic values** (strings used in
  `===`/`!==`, `switch` cases, `new Set/Map`) and downgrades matching candidates
  to low confidence because translating them would break logic.
- `filters.ts` — `shouldIgnoreString` (regex-based classification of non-UI text:
  routes, URLs, CSS values, class names, SVG paths, MIME types, env vars, etc.)
  and `confidenceFor` (assigns high/medium/low).
- `keygen.ts` — `slugify` and `generateKey` for the `path`/`text`/`component`
  strategies; `uniqueKey` for collision suffixing.
- `localeFile.ts` — load/write locale JSON; `addCandidates` writes nested keys and
  **mutates each candidate's `keySuggestion` to the collision-resolved key**.
- `codemod.ts` — `applyCodemod`: re-parses a file and replaces matched nodes with
  `t(...)` calls. Matches candidates first by exact location (`line:column:type`),
  then falls back to text — see the invariant note below.
- `manifest.ts` — the review manifest (`.tunga/review.json`). Decisions are keyed
  by a **content hash** (`file` + `text` + `context`), not position, so they
  survive edits. `selectCandidates` is the shared accept/reject/confidence rule
  used by extract, apply, and check.
- `verify.ts` — `collectReferences` reads static `t("key", { params })` calls
  from source; `verifyReference` checks one call against the locale (missing key,
  empty value, unpassed placeholder); `findOrphanedKeys`/`flattenLocaleKeys`
  handle unreferenced locale leaves. Pure and framework-agnostic (uses
  `functionName`), like the rest of core.
- `imports.ts` — `ensureImport` inserts/merges the `t` import.
- `interpolation.ts` — extracts simple `${ident}` / `${a.b}` interpolations into
  `{{name}}` placeholders and rebuilds the argument object.
- `objectKeys.ts` — technical vs. UI object-property key classification.
- `formatter.ts` — Prettier pass over rewritten code (falls back to raw on error).
- `paths.ts` — path helpers.

### `src/interactive/`
- `checklist.ts` — builds the grouped-by-confidence checklist model and applies
  the user's selection to the manifest (`--interactive`).
- `review.ts` — one-at-a-time review flow with key editing (`--step`).

### `src/output/`
- `tui.ts` — all `@clack/prompts` wrappers (spinners, notes, menus, checklists).
- `summary.ts`, `table.ts` — human-readable candidate rendering.
- `json.ts` — `--json` output.

### `src/types/index.ts`
Central types: `CandidateString`, `TungaConfig`, `Confidence`, `CandidateType`,
`KeyStrategy`, etc. Update these when changing the candidate or config shape.

## Key invariants — do not break these

1. **`extract` and `apply` must agree on keys.** Both re-scan from scratch and run
   the same `selectCandidates(...)` + `addCandidates(loadLocale(...))` sequence so
   that collision-suffixed keys match. If you touch key generation, selection, or
   collision handling, change it in a way that keeps these two paths identical, or
   you reintroduce the "silent wrong text at runtime" bug documented in
   `FEEDBACK.md`. `apply` calls `addCandidates` purely to resolve keys against the
   existing locale — it must **not** write the locale file.

2. **Low-confidence candidates are excluded by default** everywhere (extract,
   apply, check, codemod), unless `--include-low-confidence` is passed or the
   manifest explicitly accepts them. Keep the locale file and the rewritten source
   in agreement about which candidates are included.

3. **The manifest is the source of truth over confidence.** In `selectCandidates`,
   an explicit `accepted`/`rejected` decision always wins; only undecided
   candidates fall back to the confidence threshold. Accepted decisions may carry a
   custom key that must be honored.

4. **Codemod matching is location-first, text-second.** `applyCodemod` matches by
   `line:column:type` when location metadata is present, then falls back to text.
   This prevents blindly replacing every identical string. Preserve both paths.

5. **Existing localization is never re-wrapped.** `isExistingLocalization` skips
   strings already inside `t(...)`, `translate(...)`, `i18n.t(...)`,
   `intl.formatMessage(...)`, `formatMessage(...)`, `t.rich(...)`,
   `useTranslations(...)`, and the configured `functionName`. Both scanner and
   codemod rely on this — keep them consistent.

6. **Confidence semantics** (`filters.ts:confidenceFor`): JSX text and JSX
   attributes are `high`; mixed JSX / interpolated templates are `medium`; a
   string that is `strongUi` or Capitalized or long is `medium`; everything else
   is `low`. Semantic values (compared/collected/switched strings) are forcibly
   downgraded to `low` with a `reason`.

## Coding conventions

- **Two coexisting formatting styles.** Some core files (`config.ts`,
  `keygen.ts`, `localeFile.ts`, `imports.ts`, `formatter.ts`, `json.ts`) are
  written in a deliberately **dense, single-line** style. Others (`scanner.ts`,
  `codemod.ts`, `manifest.ts`, `filters.ts`, commands, interactive, output) use
  **conventional multi-line formatting with explanatory comments**. Match the
  style of the file you are editing rather than reformatting it.
- **Comments explain *why*, not *what*.** The valuable comments in this codebase
  (e.g. the semantic-value downgrade, the location-first matching rationale, the
  edge-whitespace handling in JSX codemods) document non-obvious reasoning. Add
  comments in the same spirit; don't narrate obvious code.
- **Keep core modules pure and side-effect-free** except for the explicit
  file-IO helpers (`loadLocale`/`writeLocale`, `loadManifest`/`saveManifest`,
  `readFileSync`/`writeFileSync` in commands). This is what makes them testable
  with plain string inputs.
- **Framework-agnostic output.** The codemod emits the *configured*
  `functionName` and `importSource` — never hardcode `t` or `@/i18n` in new code.
- **False-positive filtering is conservative on purpose.** When in doubt, a
  string should be downgraded to low confidence (surfaced but not auto-applied)
  rather than silently dropped or auto-rewritten. Prefer visibility + review over
  aggressive automation.

## Tests

Tests live in `tests/` and mirror core modules (`scanner`, `codemod`, `keygen`,
`localeFile`, `manifest`, `checklist`). They use `vitest` globals and exercise
core functions directly with **inline source strings** — e.g.
`scanSource(source, { file, config })` and `applyCodemod({ source, ... })`. This
is the preferred testing style: pass a snippet of code, assert on the resulting
candidates or rewritten output. No fixtures-on-disk, no snapshot files.

When adding a scanning/codemod behavior, add a `tests/*.test.ts` case with a
minimal source snippet demonstrating both the positive case and any relevant
false-positive it should *not* trigger on.

## Configuration

Users configure via `tunga.config.ts` (or `.js`/`.json`). The repo's own
`tunga.config.ts` just re-exports `defaultConfig`. The full shape is
`TungaConfig` in `src/types/index.ts`; defaults live in `src/core/config.ts`.
Notable knobs: `scan.attributeAllowlist` (array or `false` for broad scanning),
`deny.{patterns,objectKeys,callees}`, the `filters.*` toggles, `keyStrategy`
(`path`/`text`/`component`), `functionName`, `importSource`, `importKind`,
`namespace`, `locale`, and `manifest`. The `// tunga-ignore-next-line` comment
suppresses candidates on the following line.

## Git workflow

- `node_modules/`, `dist/`, `coverage/`, and `.env` are gitignored.
- Make changes on a feature branch, keep commits focused, and ensure
  `npm test` + `npm run typecheck` are green before committing.
- Do not create pull requests unless explicitly asked.
