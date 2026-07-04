---
phase: 10-corre-o-fatura-cart-o-hardening-de-importa-o
fixed_at: 2026-07-04T20:30:00Z
review_path: .planning/phases/10-corre-o-fatura-cart-o-hardening-de-importa-o/10-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-07-04T20:30:00Z
**Source review:** .planning/phases/10-corre-o-fatura-cart-o-hardening-de-importa-o/10-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (CR-01, WR-01, WR-02, WR-03)
- Fixed: 4
- Skipped: 0

Info findings (IN-01..IN-05) were out of scope for this pass and were not touched.

## Fixed Issues

### CR-01: CSV amount parsing corrupts values with thousand separators

**Files modified:** `assets/fides-transacoes.jsx`
**Commit:** 953f6e8
**Applied fix:** Added a `parseBRNumber(s)` helper and routed both the CSV
(`parseCsvRows`) and OFX (`parseOfxRows`) amount parsing through it, replacing
the naive `parseFloat(str.replace(',', '.'))`. The helper strips thousand-group
dots **only when both `.` and `,` are present** (`1.450,00` → `1450.00`,
`-1.450,00` → `-1450.00`), otherwise just normalizes a decimal comma. This
preserves the negative sign and leaves the app's own ungrouped export format
(`5417,00`) and OFX dot-decimal amounts (`-54.17`) intact, while fixing the
silent 3-orders-of-magnitude corruption of grouped Brazilian bank amounts.

### WR-01: Card transactions crossing a year boundary get a wrong stored `date`

**Files modified:** `assets/fides-store.jsx`
**Commit:** 1d2a311
**Applied fix:** In `txToRow`, the `date` field now prefers the already-resolved
purchase `tx.date` when it is a valid `YYYY-MM-DD` string, falling back to the
rebuilt `${yyyy}-${mm}-${dd}` only when no valid date is present. This keeps the
purchase `date` decoupled from the fatura `month` (which still derives from
`mesFaturaFor`), so a Dec-2025 purchase billed to the 2026-01 fatura keeps its
`2025-12-28` stored date and the `dedupeKey` matches on re-import.
**Note — requires human verification:** this is a date-reconstruction logic
change on the exact path behind the 196-duplicate incident. Recommend confirming
with a Dec-purchase / Jan-fatura re-import that no second copy is created.

### WR-02: CSV parser splits on the separator without honoring quoted fields

**Files modified:** `assets/fides-transacoes.jsx`
**Commit:** 835dade
**Applied fix:** Added a quote-aware `splitCsvLine(line, sep)` tokenizer and used
it in `parseCsvRows` in place of `line.split(sep).map(...)`. It treats a quoted
field as atomic (a separator inside quotes no longer shifts columns) and
unescapes `""` → `"`, matching the app's own export which wraps `desc` in quotes
because it can contain `;`.

### WR-03: `dedupeKey` ignores the account and drops the sign

**Files modified:** `assets/fides-transacoes.jsx`
**Commit:** a205721
**Applied fix:** `dedupeKey` now preserves the amount sign (removed `Math.abs`)
and appends the account identity (`tx.acct`), so `+R$100` refund vs `−R$100`
charge, and the same lançamento on two different cards, no longer collapse.
Because the destination account is only known at confirm time, the parse-time
duplicate flag was removed: `handleImport` now passes the existing-transaction
key index (`existingKeys`) into the preview, and `ImportPreviewModal` recomputes
the duplicate set (`dupKeys`) per-row via `resolveRowForImport(row, destAcct)` in
a `useMemo` keyed on `destAcct`. `destAcct` was reordered above `selected` so the
initial selection resolves duplicates against the destination; the "já importada"
badge and initial selection both read from `dupKeys`. Existing transactions carry
`acct` as `card_id || account_id || account` (fides-store), which matches the
resolved `destAcctId`, and their stored `date` matches the import row date after
WR-01 — so the acct-inclusive key lines up on both sides.
**Note — requires human verification:** this is dedupe logic on the re-import
path. Recommend confirming (a) re-importing the same file to the same account
still flags all rows as duplicates, and (b) importing to a different card does
not.

## Skipped Issues

None — all in-scope findings were fixed.

## Verification notes

- This is a build-less project (React via Babel-standalone, JSX in the browser),
  so no `@babel/parser`/`tsc`/`node -c` JSX syntax checker is available in the
  environment (Tier 2). Verification fell back to Tier 1: re-reading each edited
  region and grepping to confirm every reference (`parseBRNumber`, `splitCsvLine`,
  `dupKeys`, `existingKeys`) is consistent and no stale `_isDuplicate` reference
  remains.
- WR-01 and WR-03 are logic changes on the dedupe/date paths and are flagged
  above as requiring human verification before the phase proceeds.

---

_Fixed: 2026-07-04T20:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
