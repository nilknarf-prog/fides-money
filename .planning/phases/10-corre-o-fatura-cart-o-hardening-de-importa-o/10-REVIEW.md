---
phase: 10-corre-o-fatura-cart-o-hardening-de-importa-o
reviewed: 2026-07-05T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - assets/fides-transacoes.jsx
  - assets/fides-store.jsx
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-07-05
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed the gap-closure work for plans 10-04 (import dedupe / destination / status:
`resolveRowForImport`, `ImportPreviewModal`), 10-05 (onAuthStateChange user-id guard),
and 10-06 (Período analytics scope-to-month + legend removal).

The 10-05 auth guard is correct and well-reasoned; the 10-06 analytics change is a clean
refactor (dead `spendByCategoryRange` removed from the destructure). No Rules-of-Hooks
violations were found — every hook in `ImportPreviewModal` and `Transacoes` is declared
unconditionally at the top.

However, the CSV export/import round-trip has a genuine correctness defect that directly
reintroduces the duplicate-import class this phase set out to eliminate: **the CSV export
never writes the transaction year**, so re-importing any transaction whose purchase year is
not the current calendar year both corrupts the stored date and defeats the dedupe key. This
is a BLOCKER. Three warnings follow, chief among them that the preview's initial `selected`
set is never reconciled with `dupKeys` when the destination dropdown changes, allowing
duplicate rows to be re-imported.

## Structural Findings (fallow)

No `<structural_findings>` block was provided for this review. All findings below are
narrative (direct code review).

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: CSV export omits the year → re-import corrupts date and defeats dedupe (duplicate imports)

**File:** `assets/fides-transacoes.jsx:747` (export) and `assets/fides-transacoes.jsx:217-229` (import)
**Issue:**
The CSV export writes the `Data` column as `t.d`, which `normalizeTx` produces as `DD/MM`
only — no year (`fides-store.jsx:40-42`: `dateStr.slice(8,10) + '/' + dateStr.slice(5,7)`):

```js
// handleExport, CSV branch
return [
  t.d || '',            // <-- "28/12" — year is lost here
  `"${csvSafeCell(t.desc || '').replace(/"/g, '""')}"`,
  catLabel, acctName, valFmt, t.status || '', t.recur || ''
].join(';');
```

On re-import, `parseCsvRows` has no year to read, so it falls back to the current year:

```js
var parts = String(d || '').split('/'); // ['28','12']
var ano = parseInt(parts[2], 10) || nowY; // parts[2] undefined -> nowY (2026)
date: ano + '-' + mm + '-' + dd,          // "2026-12-28" for a 2025 purchase
mesFromCsv: ano + '-' + mm,
```

Consequences for any transaction not from the current calendar year (e.g. a Dec/2025 card
purchase re-imported in 2026, or any range/multi-year export):
1. **Wrong date stored** — `2026-12-28` instead of `2025-12-28`. `txToRow`'s WR-01 fix
   faithfully *preserves* this already-wrong `tx.date`, so the corruption ships to the DB
   and lands the tx in the wrong month/fatura.
2. **Dedupe miss → duplicate.** `dedupeKey` includes `day = date.slice(0,10)`. The existing
   tx keys on `2025-12-28`; the re-import keys on `2026-12-28`. They never collide, so the
   row is not flagged "já importada" and is re-inserted — exactly the 196-duplicate incident
   class this phase targets. Dedupe only works when purchase year == current year.

**Fix:** Carry the year through the round-trip. Preferred: export the full ISO date the
store already holds (`t.date`), and have `parseCsvRows` read it directly:

```js
// export — write the full date the store already has
return [
  t.date || t.d || '',   // "2025-12-28"
  ...
].join(';');

// parseCsvRows — accept YYYY-MM-DD (fall back to legacy DD/MM only if needed)
var raw = String(d || '').trim();
var dd, mm, ano;
if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
  var isoParts = raw.split('-');
  ano = parseInt(isoParts[0], 10); mm = isoParts[1]; dd = isoParts[2];
} else {
  var parts = raw.split('/');
  dd = String(parts[0] || new Date().getDate()).padStart(2, '0');
  mm = String(parts[1] || (new Date().getMonth() + 1)).padStart(2, '0');
  ano = parseInt(parts[2], 10) || nowY;
}
```

(Alternatively keep `DD/MM/YYYY` in the export column, but a full ISO date is the least
ambiguous and matches the store's own `t.date` field.)

## Warnings

### WR-01: `selected` set is never reconciled with `dupKeys` when the destination changes → duplicate re-import

**File:** `assets/fides-transacoes.jsx:1527-1541`
**Issue:**
`dupKeys` is a `useMemo` that recomputes when `destAcct` changes, but `selected` is seeded
**once** via a lazy `useState` initializer against the *initial* destination
(`IMPORT_DEST_ORIGEM`) and is never updated afterward:

```js
const dupKeys = React.useMemo(() => { /* recomputed on destAcct change */ }, [rows, destAcct, ...]);
const [selected, setSelected] = React.useState(() => new Set(
  rows.filter(r => !dupKeys.has(r._key)).map(r => r._key)  // runs only on mount
));
```

If the user opens the modal (default "Da origem do arquivo"), then switches the "Importar
para" dropdown to a specific account/card that makes previously-new rows resolve to existing
transactions, the "já importada" badge appears (`dupKeys` updated) but those rows stay
**checked** (`selected` unchanged). Clicking Import then re-inserts duplicates — the same
class CR-01 describes, this time reachable purely through the UI even with a correct file.
The visible badge is only a partial mitigation.

**Fix:** Reconcile selection when `dupKeys` changes — deselect rows that have become
duplicates (without clobbering the user's manual choices on still-new rows):

```js
React.useEffect(() => {
  setSelected(prev => {
    const next = new Set(prev);
    dupKeys.forEach(key => next.delete(key));
    return next;
  });
}, [dupKeys]);
```

### WR-02: OFX export stamps every row with `selectedMonth`'s year, not the transaction's own year

**File:** `assets/fides-transacoes.jsx:706`
**Issue:**
`const yyyy = selectedMonth.split('-')[0] || String(new Date().getFullYear());` uses the
*viewed* month's year for the `DTPOSTED` of every exported row, combined with `mm`/`dd` taken
from `t.d`. In range mode `filtered` spans multiple months/years, and for card transactions
the fatura month (`selectedMonth`) can differ from the purchase year (Dec/2025 purchase on
the 2026-01 invoice). The exported `DTPOSTED` then carries the wrong year, so an OFX
round-trip re-import (`parseOfxRows` reads the full year back) records a wrong date — same
failure mode as CR-01, on the OFX path.

**Fix:** Derive the year per row from the transaction's own resolved date (e.g. store/emit
`t.date`) rather than from `selectedMonth`.

### WR-03: Auth bootstrap can double-load on cold start (getAuthUser().then has no `loadedUid` guard)

**File:** `assets/fides-store.jsx:320-347` vs `349-379`
**Issue:**
Both `getAuthUser().then(...)` and the `onAuthStateChange('INITIAL_SESSION')` handler perform
the same full reset+refetch (`setUserId`, `setTransactions([])`, `refreshData(user.id)`, profile
fetch). The 10-05 guard (`if (user.id === loadedUid) return;`) protects the *handler*, but the
`.then` block has no equivalent guard. Because both are async, ordering is not guaranteed: if
`INITIAL_SESSION` fires first (loadedUid still `null`), it does a full load and sets
`loadedUid`; the later-resolving `.then` then unconditionally clears state and re-fetches
again. Result is a redundant double refresh (and a brief data clear) on cold start — wasteful
and a possible flash, though not a correctness break.

**Fix:** Apply the same guard in the promise block, e.g. skip the reset/refetch when
`loadedUid === user.id` (set by the handler), or gate the initial bootstrap on a single code
path rather than duplicating it across `.then` and the listener.

## Info

### IN-01: `parseBRNumber` misreads thousand-only values like "1.450"

**File:** `assets/fides-transacoes.jsx:166-174`
**Issue:** When a value has a `.` but no `,` (e.g. `"1.450"` meaning R$ 1.450), the else branch
treats `.` as a decimal point → `parseFloat("1.450") = 1.45`. The app's own export always emits
comma decimals (`toFixed(2).replace('.', ',')`), so self round-trips are safe, but
externally-produced CSVs with grouped-but-decimal-less amounts will be under-read by ~1000×.
The heuristic is documented; flagging as a known ambiguity for external files.
**Fix:** If treating `.` as thousands is intended for external files, disambiguate on the
number of digits after the last separator (3 digits after `.` with no `,` ⇒ thousands).

### IN-02: Período analytics widget is labeled with a single month while the list shows the whole range

**File:** `assets/fides-transacoes.jsx:1071-1109`
**Issue:** In Período mode the transaction list is range-scoped (`rangeList`) but the analytics
card (Donut + total + `CategoryChart`) is scoped to `selectedMonth` (`spendByCategory`,
`monthTotal`) and titled with `lbl.long`. This is the deliberate G5 decision, but the header
"Gasto por categoria / {mês}" sitting above a multi-month list is a likely source of user
confusion. Consider an explicit sublabel (e.g. "mês selecionado — a lista abaixo cobre o
período") to make the scope split obvious.

### IN-03: Dead variable `flow`

**File:** `assets/fides-transacoes.jsx:575`
**Issue:** `const flow = baseList.filter(function(t) { return !t.isTransfer; });` is declared but
never referenced anywhere in the component.
**Fix:** Remove the line.

---

_Reviewed: 2026-07-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
