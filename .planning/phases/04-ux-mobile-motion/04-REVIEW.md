---
phase: 04-ux-mobile-motion
reviewed: 2026-06-30T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - assets/fides-contas.jsx
  - assets/fides-responsive.css
  - assets/fides-store.css
  - assets/fides-store.jsx
  - assets/fides-studio.css
  - assets/fides-studio.jsx
  - assets/fides-transacoes.jsx
  - assets/fides-ui.jsx
  - assets/fides.css
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-06-30
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Scope was the phase-04 UX/mobile/motion work: the `useModalClose(open, onClose)` hook + exit-animation CSS, the 3 modals wired to it (NovaTransacao, PagarFatura/ConfirmDelete in contas, CategoriaModal in store), the mobile masthead gear + perfil toggle, and pure-CSS card micro-feedback.

The exit-animation CSS and reduced-motion gating are correct and well-formed (`@keyframes fds-fadeOut`/`fds-slideDown` behind `.is-closing`, all disabled under `prefers-reduced-motion`; the `:active` scale feedback on `.cat-card`, `.stu-acct` is gated too). The hook itself handles the reduced-motion branch and re-open cancellation correctly.

The blocking problem is a **contract mismatch between the hook and how `NovaTransacaoModal`'s primary save path closes**. The hook deliberately ignores `open → false` and relies on the modal calling `requestClose()`. But the main "Lançar transação → Salvar" flow closes by having the parent flip `open` to false (via `onSave`), never calling `requestClose()`. Result: after saving a transaction, the modal stays mounted and visible. See CR-01.

## Critical Issues

### CR-01: NovaTransacaoModal save-and-close path leaves the modal stuck open

**File:** `assets/fides-transacoes.jsx:1240-1272` (save handler) + `assets/fides-studio.jsx:71-78` (parent wiring) + `assets/fides-ui.jsx:269-281` (hook effect)

**Issue:**
`useModalClose`'s `open`-effect is intentionally one-directional — it only reacts when `open` becomes **true** (remount + cancel any in-flight close). When `open` goes **false** it does nothing, by design, because closing is supposed to be driven by the modal calling `requestClose()`:

```js
// fides-ui.jsx:269
React.useEffect(function () {
  if (open) { /* remount */ setClosing(false); setRendered(true); }
  // Quando open vira false: não desmontar direto; ...requestClose()...
  return function () { clearTimeout(timerRef.current); };
}, [open]);
```

But the primary save path never calls `requestClose()`. In `NovaTransacaoModal.handleSave`, the non-transfer, non-`keepOpen` branch does:

```js
// fides-transacoes.jsx:1269
} else {
  onSave?.(txs.length === 1 ? txs[0] : txs);   // no requestClose()
}
```

and the parent's `onSave` just flips the state:

```js
// fides-studio.jsx:73
onSave={(tx) => {
  if (Array.isArray(tx)) addTransactions(tx);
  else addTransaction(tx);
  setModalOpen(false);          // open → false, but hook ignores it
}}
```

So after a normal "Salvar", `open` becomes false while `rendered` stays `true`. `if (!rendered) return null` (line 1165) never fires, and the modal remains on screen. The user sees the save succeed (toast/data update) but the dialog does not dismiss — they must click X or the backdrop. This breaks the single most common flow the phase touched.

Note the asymmetry that hides the bug in review: the **transfer** branch closes correctly because it calls `requestClose()` directly (line 1259), and `CategoriaModal`/`ConfirmDeleteModal` also always close through `requestClose()`. Only the NovaTransacao save-through-parent path is broken.

**Fix (pick one):**

Option A — close through the hook from inside the modal (preferred; keeps the exit animation):
```js
// fides-transacoes.jsx handleSave, else-branch
} else {
  onSave?.(txs.length === 1 ? txs[0] : txs);
  requestClose();
}
```
and change the parent so `onSave` does NOT also flip `open` (let `requestClose`'s onClose do it), otherwise you re-introduce a double-close:
```js
// fides-studio.jsx
onSave={(tx) => { Array.isArray(tx) ? addTransactions(tx) : addTransaction(tx); }}
// onClose={() => setModalOpen(false)} stays; requestClose() → onClose() closes it
```

Option B — make the hook honor an external `open → false` by animating out from the effect:
```js
React.useEffect(function () {
  if (open) {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setClosing(false); setRendered(true);
  } else if (rendered) {
    requestClose();   // drive the exit animation when parent closes us
  }
  return function () { clearTimeout(timerRef.current); };
}, [open]);
```
Option B fixes every consumer at once and removes the fragile "must remember to call requestClose()" contract, but re-runs `requestClose` on unmount edge cases — guard with `rendered` as shown.

## Warnings

### WR-01: `goPerfil` calls `setLastView` inside the `setActive` updater (impure updater)

**File:** `assets/fides-studio.jsx:48-54`

**Issue:**
```js
const goPerfil = React.useCallback(() => {
  setActive(a => {
    if (a === 'perfil') return lastView || 'dashboard';
    setLastView(a);            // side effect inside a state updater
    return 'perfil';
  });
}, [lastView]);
```
Calling one state setter (`setLastView`) from inside another setter's updater function is an anti-pattern: updater functions must be pure. Under React StrictMode (dev double-invocation) the updater runs twice, so `setLastView(a)` fires twice — harmless here because the value is the same, but it is exactly the class of code that produces "works in prod, misbehaves in dev / breaks after an upgrade" bugs. It also reads `a` (the true current `active`) for `setLastView` but reads `lastView` from the stale closure for the toggle-back, so the two halves of the toggle use two different consistency models.

**Fix:** derive both from `active` without nesting setters:
```js
const goPerfil = React.useCallback(() => {
  if (active === 'perfil') { setActive(lastView || 'dashboard'); }
  else { setLastView(active); setActive('perfil'); }
}, [active, lastView]);
```

### WR-02: `pickerYear` state initialized from `y` before `y` is declared (masthead)

**File:** `assets/fides-studio.jsx:319` vs `assets/fides-studio.jsx:322`

**Issue:**
```js
const [pickerYear, setPickerYear] = React.useState(y);   // line 319
...
const [y, m] = selectedMonth.split('-').map(s => parseInt(s, 10)); // line 322
```
`y` is a `const` referenced before its declaration. This is a temporal-dead-zone `ReferenceError` under real ES modules. It does not crash today only because Babel-standalone transpiles `const → var` (hoisted), so `y` reads as `undefined` and `pickerYear` initializes to `undefined` on first render. The year picker therefore shows `undefined` until `setPickerYear` runs (the picker's open handler does `setPickerYear(y)`, masking it). This is latent — if the build ever moves to a real bundler / strict ESM, or Babel config changes, the whole masthead throws and the studio shell fails to render. This code sits directly under the phase-04 masthead-gear change, so it is worth fixing while here.

**Fix:** move the `const [y, m] = ...` line above line 319, and initialize `React.useState(() => parseInt(selectedMonth.split('-')[0], 10))`.

### WR-03: Reduced-motion close path in `useModalClose` still lands on animated CSS class briefly

**File:** `assets/fides-ui.jsx:247-267`

**Issue:** In the reduced-motion branch `requestClose()` sets `setRendered(false)` and calls `onClose()` synchronously (good — no animation). But it reads `prefers-reduced-motion` fresh on every `requestClose` via `window.matchMedia(...)`. If `window.matchMedia` is unavailable (`window.matchMedia && ...` short-circuits to `undefined`/falsy), the code falls into the **animated** branch and sets a 180ms `setTimeout` before unmount. In an environment without `matchMedia` that is acceptable, but the same falsy-guard means a user who *does* prefer reduced motion but is in a browser where `matchMedia` throws would get the animated path. Low severity, but the guard conflates "no matchMedia" with "motion allowed." Consider defaulting the no-`matchMedia` case to the immediate (reduced) path, or cache the query once.

**Fix:**
```js
var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
var prefersReduced = mq ? mq.matches : false; // explicit default
```
(No behavior change for the common case; documents the intent.)

## Info

### IN-01: `handleLogout` defined in masthead render body but `openAssistant` shadow-free — dead/duplicated close helpers

**File:** `assets/fides-studio.jsx:315-317`

**Issue:** `handleLogout` is declared as a nested `async function` inside `StudioMasthead` on every render. Minor; not a bug. Consider hoisting or wrapping in `useCallback` for consistency with the rest of the file's handler style. Non-blocking.

### IN-02: `PagarFaturaModal` list items carry both `onClick` and a no-op `onPointerUp`

**File:** `assets/fides-contas.jsx:292-294`

**Issue:**
```js
onClick={() => toggle(t._id)}
onPointerUp={() => {}}
```
The empty `onPointerUp={() => {}}` is dead code (a placeholder that does nothing). It adds a listener with no effect and is confusing next to the real `onClick`. Remove it. Non-blocking.

---

_Reviewed: 2026-06-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
