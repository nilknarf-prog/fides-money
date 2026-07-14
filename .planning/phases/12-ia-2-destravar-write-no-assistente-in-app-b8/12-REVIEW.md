---
phase: 12-ia-2-destravar-write-no-assistente-in-app-b8
reviewed: 2026-07-14T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - api/assistant.js
  - assets/fides-claude.jsx
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-07-14
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Scope: the phase-12 gap-closure diff (`90332de..HEAD`) over `api/assistant.js` and `assets/fides-claude.jsx` — the 12-06 WRITE-mirror cleanup (writeOutcome tagging, history filter, STORAGE_KEY bump, anti-mirror guard, removal of the cancellation-acknowledgement SYSTEM_PROMPT line) and the 12-07 `tipo_destino` discriminator + `resolveWriteToolArgs` rewrite.

Security posture check (B8 gate): the diff does **not** touch the JWT/Bearer flow, the nonce anti-replay, the daily rate-limit counting, or the WRITE confirmation gate. `tipo_destino` is a client-resolved hint; the backend still only relays tool calls. No weakening of the B8 posture. **Rules of Hooks:** no hooks were added or moved — all `React.use*` calls remain above the `if (!assistantOpen) return null` early return (line 122), and the new helpers (`isSyntheticWriteOutcome`, `synthesizeWriteReply`) are plain functions. Clean on that axis.

The homonym fail-closed rewrite is a genuine correctness improvement (explicit disambiguation instead of account-first precedence). However, the anti-mirror guard introduced in the same phase has an over-broad prefix match that silently discards legitimate assistant output, and the malformed-`tipo` path can lose the explicit-type safety.

## Critical Issues

### CR-01: Anti-mirror guard's `startsWith('Pronto! ')` suppresses legitimate replies

**File:** `assets/fides-claude.jsx:609-616` (guard) and `assets/fides-claude.jsx:725-734` (call site)
**Issue:** `isSyntheticWriteOutcome` returns `true` for **any** Gemini text reply that begins with the prefix `WRITE_OUTCOME_SUCCESS_PREFIX = 'Pronto! '`. "Pronto!" is one of the most common conversational openers in Brazilian Portuguese, and the system prompt explicitly asks for short, direct prose. Any legitimate reply that opens with "Pronto! ..." is caught by the guard, discarded (not shown, not persisted), and replaced with a hardcoded, write-only recovery line: *"Não fiquei certo do que já foi feito — pode repetir o que você quer lançar?"*

This fires on legitimate flows that have nothing to do with a WRITE:
- A pure conversational turn where Gemini answers "Pronto! Aqui está o resumo..." — suppressed.
- The second turn after a **READ** tool (`consultar_saldo`/`consultar_extrato`): `allWrite` is false, so the flow reaches the text-reply branch; a reply like "Pronto! Você gastou R$ 500 essa semana..." is discarded and the user instead sees a "pode repetir o que você quer lançar?" message that is nonsensical in a read/analysis context.

The two exact-string checks (`=== WRITE_OUTCOME_CANCEL`, `=== WRITE_OUTCOME_SUCCESS_NO_PARTS`) are appropriately narrow; only the prefix check is the problem. A real mirror always reproduces the synthesized text verbatim (it includes the specific `parts.join(' ')` sentences like "Lancei R$ 50,00 (Mercado) em Nubank."), so matching the whole synthesized string — not just the generic prefix — preserves the anti-mirror intent without the false positives.

**Fix:**
```js
// Track the exact synthesized success strings produced this session and match those,
// instead of the generic "Pronto! " opener. Minimal change: only treat as synthetic
// when the WHOLE text equals a previously-synthesized outcome.
const isSyntheticWriteOutcome = (text, lastSynthesized) => {
  const t = String(text || '').trim();
  if (!t) return false;
  if (t === WRITE_OUTCOME_CANCEL) return true;
  if (t === WRITE_OUTCOME_SUCCESS_NO_PARTS) return true;
  // exact match against what we actually synthesized (verbatim mirror), not a prefix
  return !!lastSynthesized && t === String(lastSynthesized).trim();
};
```
Pass the string returned by the most recent `synthesizeWriteReply(toolResults)` call in this turn as `lastSynthesized`. If keeping a prefix heuristic, at minimum require the reply to contain a synthesized `parts` sentence (e.g. `t.includes('Lancei ') || t.includes('Categoria atualizada') || ...`) rather than matching the bare "Pronto! " opener.

## Warnings

### WR-01: Malformed `tipo_destino` value silently loses the explicit-type safety and can route to the wrong destination

**File:** `assets/fides-claude.jsx:310-338`
**Issue:** The branch logic only trusts `tipo` when it is exactly `'cartao'` or `'conta'`. Any other value (e.g. Gemini emitting `'cartão'` with accent, `'credito'`, `'card'`, or an empty string) falls through to the positional branches (`accMatch && cardMatch` → disambiguate, `accMatch` → account, `cardMatch` → card). The enum in the tool schema (`api/assistant.js:118`) is a hint, not a hard guarantee — Gemini can and occasionally does emit off-enum strings.

Concrete wrong-destination case: the user says "lança no **cartão** X", only an **account** named X exists (no card X), and Gemini emits a malformed `tipo_destino`. With a correct `tipo === 'cartao'`, the code would return *"Não encontrei um cartão chamado X"* (fail-closed, honest). With a malformed value it silently falls to `else if (accMatch)` and books the transaction to the **account** — the exact silent wrong-destination the phase set out to eliminate. Because there is no homonym, the fail-closed guard does not catch it.

**Fix:** Validate `tipo_destino` explicitly and fail closed on a present-but-unrecognized value instead of silently degrading:
```js
const rawTipo = args.tipo_destino;
const tipo = rawTipo == null || rawTipo === '' ? undefined : String(rawTipo).toLowerCase().trim();
if (tipo && tipo !== 'conta' && tipo !== 'cartao') {
  return { error: `Não entendi o tipo de destino "${rawTipo}". Diga "conta ${ref}" ou "cartão ${ref}".` };
}
```

### WR-02: Removing the cancellation honesty addendum weakens the guarantee for mixed READ+WRITE batches

**File:** `api/assistant.js:48` (line removed by 12-06)
**Issue:** The removed SYSTEM_PROMPT line instructed the model: on `cancelled: true`, acknowledge the cancellation and do **not** claim the action was completed. For the all-WRITE case this is now handled locally (the `allWrite && allTerminal` short-circuit at `fides-claude.jsx:705` never sends the cancellation to Gemini), so removal is fine there. But the assistant permits up to 2 tool calls per response; a **mixed batch** (one WRITE cancelled + one READ succeeding) leaves `allWrite === false`, so the turn still round-trips to Gemini with a `functionResponse` carrying `{ cancelled: true }`. Without the explicit honesty instruction, the model is more likely to narrate the cancelled write as done.

Partial mitigation exists: the cancelled result still carries `message: 'Usuário cancelou a operação.'` (`fides-claude.jsx:511`), so the model sees Portuguese text stating the cancellation. The guardrail was belt-and-suspenders, but this is a security-sensitive honesty path (CLAUDE.md), and the belt was removed while the suspenders (the message) are only implicit.

**Fix:** Re-add a compact honesty clause scoped to cancellation so it survives mixed batches, e.g. append to the WRITE honesty block:
```
• Se um functionResponse indicar cancelamento (cancelled: true ou "Usuário cancelou"), diga que a ação foi cancelada — NUNCA afirme que foi concluída.
```

## Info

### IN-01: Old sessionStorage keys are orphaned after the v2 bump

**File:** `assets/fides-claude.jsx:20-21`
**Issue:** Bumping to `fides_assistant_messages_v2` / `..._last_activity_v2` leaves the v1 keys resident until the tab closes. Because this is `sessionStorage` (not `localStorage`), the orphan is short-lived and low-impact, but there is no cleanup. Note the code comment on line 18 says "chave de sessão" / "sem esperar HISTORY_TIMEOUT_MS" — accurate, but a one-line removal of the stale keys would keep the store tidy.
**Fix:** Optionally, in `initState`, `sessionStorage.removeItem('fides_assistant_messages'); sessionStorage.removeItem('fides_assistant_last_activity');` once.

### IN-02: Recovery message is write-specific but the guard can fire in non-write contexts

**File:** `assets/fides-claude.jsx:729`
**Issue:** The neutral replacement text ("pode repetir o que você quer **lançar**?") assumes the suppressed turn was a lançamento. As detailed in CR-01, the guard can trigger after a READ or in general conversation, where a launch-oriented recovery prompt is misleading. If CR-01 is fixed by matching verbatim synthesized strings, the guard will only fire on genuine write mirrors and this message becomes appropriate; otherwise the wording should be context-neutral.
**Fix:** Fold into the CR-01 fix; if a standalone guard remains, use a neutral line such as "Desculpe, me perdi aqui — pode repetir o que você precisa?".

---

_Reviewed: 2026-07-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
