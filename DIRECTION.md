# Direction: making Tunga the default i18n-migration tool

This is a forward-looking design document, not a description of current behavior
(see `README.md` for that). It records *where Tunga is headed and why*, so the
plan survives across contributors and sessions. Update it as items ship.

## The thesis

A developer — or an AI coding agent that could just grep for strings itself —
skips a codemod tool and does the work by hand for three reasons:

1. **Fear of misses** — "did it silently skip a string I'll have to hunt for anyway?"
2. **Fear of breakage** — "did it translate a value that's compared, persisted, or routed on?"
3. **Friction** — "wiring up and second-guessing the tool costs more than doing it."

Tunga has largely beaten #2 (semantic-value downgrade, denylists, location-first
codemod matching). The path to being the *default* — the tool an agent reaches
for reflexively — is beating #1 and #3. The key insight: you beat #1 not by
scanning harder, but by making the tool **prove its own work**. A tool you can
trust without re-checking is one you reach for without thinking.

Everything below serves that goal.

## The five moves, in priority order

### 1. Self-proving correctness — `tunga verify` ✅ shipped

A command that, after `apply`, re-parses the rewritten source and asserts the
**code ↔ locale contract**: every `t("key", …)` call resolves to a non-empty
locale string, and every `{{placeholder}}` the value expects is actually passed.
This is what lets an agent apply Tunga and *not* re-read the whole diff — if
`verify` is green, every rendered string resolves.

Implemented in `src/core/verify.ts` + `src/commands/verify.ts`. Reports
`missing-key`, `empty-value`, `placeholder-mismatch` (errors) and `orphaned-key`
(warning). `--strict` fails on warnings; `--json` emits a machine-readable report.

### 5. Legible health — `tunga report` ✅ shipped

Real localization coverage (localized calls over localized plus still-hardcoded
strings) plus missing/unused locale-key counts, via `buildReport` in
`core/verify.ts`. `--json` for machine output. (Numbered 5 in the original plan;
shipped early because `report` was previously stubbed at `0` and actively
misleading.)

### 2. Machine-native interface — 🔜 partially done, biggest remaining lever

**Done:** `scan`, `verify`, and `report` all emit structured `--json`.

**Remaining — the highest-value unbuilt work:**

- **Stabilize the JSON contract.** Give every `--json` payload a consistent
  envelope (a `tunga` version field, a top-level `ok`/status where meaningful,
  and stable field names) so an agent can program against it without guessing.
  `scan --json` currently returns a bare candidate array while `verify`/`report`
  return objects — reconcile these. Treat the shape as an API: document it and
  avoid silent breaking changes.
- **Machine-readable dry-runs.** `extract --dry-run` and `apply --dry-run` print
  human text only. Add `--json` so an agent can preview the exact locale
  additions and source replacements as data before committing.
- **Ship Tunga as an MCP server / agent skill.** This is the literal answer to
  "so AI would default to using it": an agent *discovers* `tunga.scan`,
  `tunga.verify`, etc. as tools and gets structured candidates with provenance,
  instead of inventing its own regex. Keep it a thin wrapper over the existing
  commands — the CLI stays the source of truth; the MCP layer just exposes it.
  Note: this adds a runtime dependency and a new surface, so weigh it against the
  "boring, inspectable" philosophy before committing.

### 3. Format-preserving codemods — 🔜 not started, biggest reviewer-QoL win

Today `apply` regenerates the whole file via `@babel/generator` and runs
Prettier over it (`core/codemod.ts`, `core/formatter.ts`). The Geyma field report
(`FEEDBACK.md`) measured ~6,700 diff lines for ~450 real changes. A tool whose
diffs are mostly noise erodes the "every change is visible in a git diff" promise
that is Tunga's whole reason to exist.

Move to `recast`-style output (or Babel `retainLines`) so only changed nodes are
touched. Smaller diffs help humans *and* make an agent's verification cheaper.
This is a focused change to the generate step in `codemod.ts` — the matching and
replacement logic stays the same.

### 4. Coverage that kills the false-negative fear — 🔜 not started

An agent won't trust a tool it suspects is incomplete. Two threads:

- **Framework presets** for `next-intl`, `react-i18next`, and FormatJS, so Tunga
  is correct on their call shapes out of the box (config presets over
  `functionName`/`importSource`/`importKind`, plus matching detection in
  `isExistingLocalization`). Already on the README roadmap; still unbuilt.
- **Universal provenance.** Every candidate already carries an optional `reason`
  for downgrades; extend a `reason` to *every* candidate and, ideally, to
  skipped strings too ("why didn't it flag this?"). Explainability is what turns
  "I'd better double-check" into "I trust the output." Surface it in `--json`.

## Smaller follow-ups (from `FEEDBACK.md`, not yet addressed)

- **Dangling-import cleanup on revert.** Reverting a rewrite by hand leaves an
  unused `functionName` import (`noUnusedLocals` catches it). Supervised use
  implies partial reverts, so this is worth handling.
- **CSS-in-JS template literals still score `medium`** (`filters.ts`). A CSS
  grammar sniff (units, `solid`, color functions, SVG path data) would demote the
  largest remaining junk class. `deny.patterns` is the current workaround.

## Guardrails for whoever picks this up

- Preserve the two load-bearing invariants in `CLAUDE.md`: `extract`/`apply` must
  agree on keys, and low-confidence candidates stay excluded by default.
- Keep `src/core/*` pure and testable with inline-source snippets. New logic
  gets a `tests/*.test.ts` case showing the positive result and any
  false-positive it must *not* trigger.
- Prefer visibility + review over aggressive automation. When in doubt, downgrade
  to low confidence rather than silently drop or auto-rewrite.
