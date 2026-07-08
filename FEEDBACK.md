# Field report: migrating a real app with Tunga

This is feedback from running Tunga end-to-end on **Geyma**, a mid-sized React + TypeScript
codebase (~37 rewritten files, ~600 final locale keys). The workflow used was the one the
README prescribes: `scan` → `extract` → `apply --dry-run` → `apply` → review the git diff.

**Short version:** the architecture is right, it did real work (about 360 of the ~600 final
keys came from its extraction), and every failure we hit was a fixable engineering gap rather
than a design flaw. But there are three genuine bugs, one of which silently corrupts UI text
at runtime.

## What worked

- **The AST approach paid off.** Zero syntax breakage across 37 rewritten files.
  Interpolation extraction (`` `Rename ${oldName}` `` → `t("key", { oldName })`) worked
  correctly every time it fired.
- **The config surface is right.** When `t` collided with this codebase's
  `const t = useTheme()` convention, `--fn` / `functionName` + `importSource` made the
  recovery a one-line config change. The attribute allowlist is the correct default posture.
- **The low-confidence bucket is well calibrated** — it correctly caught CSS values, DOM
  tokens, and ids. The pipeline around it is what leaks (see below).

## Bugs (in descending severity)

### 1. `extract` and `apply` disagree on keys when collisions happen — silent wrong text at runtime

`extract` de-duplicates through `uniqueKey()` (`src/core/localeFile.ts:4` →
`src/core/keygen.ts:5`): when `ui.details.folder` already holds `"[folder]"`, the display
string `"Folder"` becomes `folder_2`. But `apply` re-scans from scratch
(`src/commands/apply.ts:28`) and emits the raw `keySuggestion`
(`src/core/codemod.ts:29`) without ever loading the locale file — the `--locale` flag is
accepted (`src/commands/apply.ts:14`) and merged into config, but nothing reads it.

Result in Geyma: the Details panel rendered `"[folder]"` where `"Folder"` belonged, and
showed the literal word `"Folders"` where a count belonged (`` `${folders}` `` →
`tr("ui.details.folders")`, which is the *label's* key). It typechecks, it runs, it's just
wrong — the worst failure class.

**Fix:** `apply` must resolve keys against the locale file before rewriting, or better,
`extract` and `apply` should both consume one persisted scan manifest (see
[recommendations](#keeping-strings-out-of-the-selection-before-apply)).

### 2. The JSX-attribute guard swallows inline handler bodies — the biggest false-negative source

In the scanner's `StringLiteral` visitor, the guard

```ts
if (nodePath.findParent((parent) => parent.isJSXAttribute())) return;
```

(`src/core/scanner.ts:113`, same pattern in `src/core/codemod.ts:78`) is meant to skip
attribute *values*, but `findParent` walks unbounded — so every string anywhere inside
`onClick={() => ...}` or `onContextMenu={(e) => ...}` is invisible to the scanner.

In Geyma this hid entire context menus (three of four menu-heavy files), `showToast(...)`
calls, and `options={[{ label: "..." }]}` arrays passed as props. The fourth file survived
only because its menu builder happened to be a standalone function outside JSX.

**Fix:** stop the upward walk at the first function boundary, or only reject strings in
direct value position (`nodePath.parentPath.isJSXAttribute()`).

### 3. Trimmed JSXText replacement fuses words

When mixed JSX contains one unsupported expression — and the common
`{n === 1 ? "" : "s"}` plural hack guarantees it does — the `jsx-mixed` candidate is
rejected (good, `simpleExpression` returns undefined), but each sibling `JSXText` node is
then matched and rewritten individually (`src/core/codemod.ts:63-67`) using the extracted
value that was whitespace-collapsed and trimmed at scan time (`src/core/scanner.ts:48`).
The edge whitespace that separated the text from the adjacent expression evaporates.

Geyma got `"Ollamais running"`, `"297 GBused"`, `"5items"`, `"Radius:14px"` — about ten
sites.

**Fix:** when replacing a `JSXText` whose original had significant edge whitespace next to
a non-text sibling, emit `{" "}` or keep the space in the extracted value.

## Smaller issues

- **`extract` applies no confidence filter while `apply` does** — `applyCodemod` drops
  low-confidence candidates (`src/core/codemod.ts:23`) but `extractCommand` writes every
  candidate to the locale (`src/commands/extract.ts:24-28`). That produced 91 orphaned keys
  in Geyma, guaranteed by design. Same filter both sides.
- **CSS-in-JS template literals score medium.** Any template whose expressions are "simple"
  becomes a medium-confidence candidate (`src/core/filters.ts:43`), so
  `` `1px solid ${t.border}` `` was applied ~30 times across ~20 files. Even SVG path data
  scored medium.
- **The 48-char key slug truncates mid-word** (`src/core/keygen.ts:2`, `.slice(0, 48)`) —
  keys like `...zero_padde`. Truncate at a word boundary.
- **Whole-file regeneration + Prettier reformats every touched file**
  (`src/core/codemod.ts:96` + `src/core/formatter.ts`). The Geyma diff was ~6,700 lines for
  ~450 real changes, which makes the "review the git diff" workflow the README correctly
  prescribes much harder. Recast-style format preservation (or Babel's `retainLines`) would
  be the single biggest reviewer-QoL win.
- **Reverting a rewrite leaves a dangling import** of `functionName` (`noUnusedLocals`
  catches it). Worth handling, since supervised use implies partial reverts.

## Keeping strings out of the selection before apply

This is where investment would pay off most, because everything hand-reverted in Geyma
(83 call sites) falls into knowable categories:

1. **A persistent review manifest.** `scan --interactive` currently displays decisions and
   throws them away; `extract` and `apply` re-scan independently. Have it write
   accept/reject records keyed by content hash (file + candidate text + context), and make
   `extract`/`apply` consume the manifest. That single change turns three disconnected
   commands into a pipeline — and fixes bug #1 for free.
2. **Config denylists beyond the attribute allowlist:**
   - by value regex (kills CSS, URLs, `{{name}}.zip` patterns);
   - by object-property key (`sub`, `kind`, `value` — Geyma's path-segment trap was `sub:`);
   - by enclosing callee (`classNames(...)`, `analytics.track(...)`, `new Set([...])`).
3. **Inline directives** — `// tunga-ignore-next-line` — for one-off cases where config
   rules are overkill.
4. **A "semantic value" heuristic:** if the identical string literal also appears in an
   `===`/`!==` comparison or inside a `Set`/`Map` literal anywhere in the project,
   downgrade it hard. That one rule would have caught Geyma's persisted event actions
   (`"Renamed"`, `"Moved here"`) and its `UNDOABLE_ACTIONS` set — the most dangerous
   category, because translating a compared-and-persisted value only breaks after a second
   language exists.
5. **A CSS grammar sniff for template literals** (units, `solid`, color functions) — the
   cheapest fix for the largest junk class.

## Bottom line

Tunga saved roughly the easy 60% of the migration, and its dry-run-and-review posture is
honest about the rest. Fix #1 and #2 and it's genuinely production-useful for supervised
migrations. The Geyma repo's migration commits show before/after examples of every category
above and would make a good integration fixture.
