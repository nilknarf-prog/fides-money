---
phase: 10-corre-o-fatura-cart-o-hardening-de-importa-o
reviewed: 2026-07-04T19:53:47Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - assets/fides-data.jsx
  - assets/fides-store.jsx
  - assets/fides-transacoes.jsx
findings:
  critical: 1
  warning: 3
  info: 5
  total: 9
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-07-04T19:53:47Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the three source files changed since `5a404b5` for the fatura-date correction and
import-hardening phase. The `computeFaturaDates` refactor in `fides-data.jsx` is **correct** and is
a genuine fix: it derives `dtFechamento` in the closing month (the meaning of `mesFatura` per
`mesFaturaFor`) and rolls `dtVencimento` into the next month only when `diaVencimento < diaFechamento`,
using native `Date` arithmetic that handles the December→January year rollover cleanly. The old code
placed `dtFechamento` in `mes-1` when `diaF > diaV`, which was off by a full cycle; both consumers
(`faturasDoCartao`, `faturasDoCartaoCompleto`) now call the shared helper consistently. Rules of Hooks
are respected: `importPreview` and `activeSlice` `useState` are declared unconditionally at the top of
`Transacoes`, and `ImportPreviewModal`/`Donut` hooks are top-level within their components — the
parse-then-preview flow and the conditional `{rangeMode && <Donut .../>}` render do not gate any hook.

The remaining risk is concentrated in the **CSV parsing layer**, not the dedupe/preview orchestration
(which is sound). One BLOCKER: monetary values with Brazilian thousand separators are silently
corrupted on import. Three WARNINGs cover a year-rollover date-reconstruction gap that can defeat the
new dedupe, quote-unaware CSV column splitting, and an account-blind dedupe key.

## Critical Issues

### CR-01: CSV amount parsing corrupts values with thousand separators

**File:** `assets/fides-transacoes.jsx:135` (and `:176` for OFX)
**Issue:** `parseFloat(valStr.replace(',', '.'))` only replaces the **first** comma and does not strip
thousand-group dots. For a real Brazilian bank CSV cell like `1.450,00`, the transform yields
`1.450.00`, and `parseFloat` stops at the second dot → `1.45`. Any imported amount ≥ R$ 1.000 written
with dot grouping is silently persisted three orders of magnitude too small. This is direct financial
data corruption on the primary intended input for an "import hardening" feature (bank statements). The
app's own CSV export happens to emit amounts without grouping (`5417,00`), so round-tripping the
export is unaffected — which masks the bug in self-tests while breaking real statements.
**Fix:**
```js
// Strip thousand separators before normalizing the decimal comma.
function parseBRNumber(s) {
  var str = String(s == null ? '' : s).trim();
  // If both '.' and ',' present, '.' is the thousands sep and ',' the decimal.
  if (str.indexOf('.') >= 0 && str.indexOf(',') >= 0) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else {
    str = str.replace(',', '.'); // only decimal comma, or already dot-decimal
  }
  return parseFloat(str);
}
var valRaw = parseBRNumber(valStr);
if (isNaN(valRaw)) { errors++; return; }
```

## Warnings

### WR-01: Card transactions crossing a year boundary get a wrong stored `date`, defeating dedupe on re-import

**File:** `assets/fides-store.jsx:205` (`txToRow` date reconstruction) interacting with
`assets/fides-transacoes.jsx:724` (`handleImportConfirm`)
**Issue:** `resolveRowForImport` correctly computes the purchase `date` (`YYYY-MM-DD` from the file)
and the fatura `mes`, and `handleImportConfirm` puts both in the payload. But `addTransactions →
txToRow` **discards `tx.date`** and rebuilds it as `` `${yyyy}-${mm}-${dd}` `` where `yyyy` comes from
`tx.mes` (the fatura month) and `mm`/`dd` come from `tx.d` (the purchase day/month). For a card, the
fatura month can be the following year: a purchase on `28/12/2025` whose invoice closes `2026-01` has
`tx.mes='2026-01'`, `tx.d='28/12'`, so the stored date becomes `2026-12-28` — wrong year and wrong
month-vs-year pairing. Because `dedupeKey` uses `date.slice(0,10)`, the stored key (`2026-12-28`) no
longer matches the file's parsed key (`2025-12-28`), so a re-import of the same statement is **not**
flagged as duplicate and creates a second copy — exactly the class of failure behind the 196-duplicate
incident, now narrowed to the Dec→Jan card case.
**Fix:** Prefer the explicitly resolved `date` when present instead of rebuilding it from `mes`:
```js
// txToRow
date: tx.date && /^\d{4}-\d{2}-\d{2}$/.test(tx.date)
        ? tx.date
        : `${yyyy}-${mm}-${dd}`,
```
Keep `month` (fatura) decoupled from `date` (purchase) — they legitimately differ for cards.

### WR-02: CSV parser splits on the separator without honoring quoted fields

**File:** `assets/fides-transacoes.jsx:132`
**Issue:** `line.split(sep)` then strips surrounding quotes per cell. It does not treat a quoted field
as atomic, so any field containing the separator shifts every subsequent column. The app's own export
wraps `desc` in quotes precisely because it may contain `;` (`line 669`), yet import splits on `;`
first — so re-importing an exported row whose description contains a semicolon mis-parses `val`,
`status`, and `recur`. Real bank statements with delimiter characters inside memos corrupt the same
way (wrong amount/category/account, not just description).
**Fix:** Parse with a quote-aware tokenizer instead of `split`:
```js
function splitCsvLine(line, sep) {
  var out = [], cur = '', inQ = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === sep && !inQ) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(function (c) { return c.trim(); });
}
```

### WR-03: `dedupeKey` ignores the account, causing cross-account false-positive skips

**File:** `assets/fides-transacoes.jsx:86`
**Issue:** The dedupe key is `desc|cents|day` with no account/card component and with the sign dropped
(`Math.abs`). Two legitimately distinct transactions — same description, amount, and day but on
different cards/accounts (e.g. an Uber charged to two cards, or a +R$100 refund vs a −R$100 charge) —
collapse to the same key. In `handleImport` these incoming rows are pre-unchecked as "já importada" and
skipped by default, so a real transaction is silently dropped. Erring toward skipping is safer than the
196-duplicate incident, but the false-positive is still user-visible data loss.
**Fix:** Include the resolved destination account and preserve the sign in the key. Because the
destination account is only chosen at confirm time, compute the key against the selected `destAcctId`
in the preview (or include `acct` once resolved) rather than at parse time:
```js
function dedupeKey(tx) {
  var desc = String((tx && tx.desc) || '').trim().toLowerCase().replace(/\s+/g, ' ');
  var cents = Math.round(Number(tx && tx.val) * 100);           // keep sign
  var day = String((tx && tx.date) || '').slice(0, 10);
  var acct = String((tx && tx.acct) || '');                     // include account
  return desc + '|' + cents + '|' + day + '|' + acct;
}
```

## Info

### IN-01: CSV import always drops the first line as a header

**File:** `assets/fides-transacoes.jsx:131`
**Issue:** `lines.slice(1)` unconditionally treats line 0 as a header, and separator autodetect
(`lines[0].includes(';')`) only inspects that first line. A headerless bank export loses its first
transaction, and a file whose header uses `,` while data uses `;` mis-detects the separator.
**Fix:** Detect a header by checking whether line 0 parses to a valid amount in the value column; skip
it only when it does not. Detect the separator from a data line, or by counting occurrences.

### IN-02: Files are read as UTF-8 despite the export declaring CHARSET:1252

**File:** `assets/fides-transacoes.jsx:715`
**Issue:** `reader.readAsText(file, 'UTF-8')` decodes every import as UTF-8, but the OFX export writes
`ENCODING:UTF-8 / CHARSET:1252` and many Brazilian bank OFX/CSV files are Windows-1252. Accented memos
(`Alimentação`, `Educação`) get mojibake on import.
**Fix:** Sniff the OFX `CHARSET`/`ENCODING` header (or a BOM) and pass the matching label to
`readAsText`, falling back to UTF-8.

### IN-03: `'agendado'` status is flattened to `'pendente'` on import

**File:** `assets/fides-transacoes.jsx:155`
**Issue:** `status === 'pago' ? 'pago' : 'pendente'` collapses the exported `agendado` value into
`pendente`, so exporting then importing loses the scheduled state.
**Fix:** Map explicitly: `var status = row5 === 'pago' ? 'pago' : row5 === 'agendado' ? 'agendado' : 'pendente';`

### IN-04: `computeFaturaDates` is not exported on `window`, unlike its sibling helpers

**File:** `assets/fides-data.jsx:344` (Object.assign) vs `:72` (definition)
**Issue:** `mesFaturaFor`, `txMonth`, `isCardId` are attached to `window`, and consumers mix bare and
`window.`-qualified access (`window.mesFaturaFor` in `txToRow`/`resolveRowForImport`, bare
`mesFaturaFor` in `faturasPorCartao`). `computeFaturaDates` is only reachable as a bare global, so it
works inside these scripts by hoisting but is `undefined` for any `window.computeFaturaDates` caller
(e.g. the assistant surface or future modules). Inconsistent and fragile.
**Fix:** Add `computeFaturaDates` to the `Object.assign(window, { ... })` export list and standardize
on one access style.

### IN-05: Reopening the import picker while the preview is still mounted reuses stale selection keys

**File:** `assets/fides-transacoes.jsx:1439`
**Issue:** `selected` and `destAcct` use lazy `useState` initializers that run only on first mount.
`ImportPreviewModal` stays mounted as long as `importPreview` is truthy, so if a second file is chosen
without cancelling first, `setImportPreview` swaps the `preview` prop but the `selected` Set still holds
the previous file's `_key` indices, producing an incorrect default selection.
**Fix:** Key the modal by file identity (`<ImportPreviewModal key={importPreview.fmt + rows.length} ...>`)
or reset `selected`/`destAcct` in an effect on `preview` change so a new file re-initializes cleanly.

---

_Reviewed: 2026-07-04T19:53:47Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
