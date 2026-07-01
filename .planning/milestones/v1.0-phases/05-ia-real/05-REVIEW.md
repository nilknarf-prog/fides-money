---
phase: 05-ia-real
reviewed: 2026-06-30T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - assets/fides-orcamento.jsx
  - assets/fides-orcamento.css
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-06-30
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed the Phase 05 (IA Real) changes to `PlnMesInsights` — the reworked handler that fires a single-shot `fetch('/api/assistant')` Gemini call — plus the two new CSS surfaces (`.pln-mi-ai-result`, `.pln-mi-ai-error`) and the `prefers-reduced-motion` gate. Cross-referenced against the server endpoint (`api/assistant.js`) and the existing sibling implementation (`assets/fides-claude.jsx`), which shares the same auth/fetch contract.

Security posture on the two named risks is sound: the model output is rendered as React text nodes via `aiResult.split('\n').map(...)` (no `dangerouslySetInnerHTML`, no `innerHTML`), so the flagged XSS-via-model-output vector is not exploitable. JWT is obtained fresh from `window.fidesAuth.getSession()` per click and null-guarded before the request — matching the established pattern.

The material problems are correctness and robustness, not injection. One block of the AI-context builder is dead (reads fields that never exist on `totals`), so the model is fed a weaker prompt than intended. The handler also dropped the client-side throttle/cooldown that the sibling component and the server's own header comment mandate, and it fails closed whenever the model chooses to call a tool — which the system prompt actively encourages.

## Critical Issues

### CR-01: `buildAiContext` reads `totals.receitas` / `totals.despesas`, which never exist — receita/despesa context is dead code and never sent

**File:** `assets/fides-orcamento.jsx:1019-1029`
**Issue:** `buildAiContext` gates its first (and richest) context line on `totals.receitas` / `totals.despesas`:

```js
if (totals && (totals.receitas != null || totals.despesas != null)) {
  var receitas = totals.receitas != null ? fmtVal(totals.receitas) : null;
  var despesas = totals.despesas != null ? fmtVal(Math.abs(totals.despesas)) : null;
  ...
}
```

But the `totals` object passed to `PlnMesInsights` (render site `fides-orcamento.jsx:1539`) is the memoized object built at `fides-orcamento.jsx:1266-1282`, whose only keys are `planned`, `realized`, `projection`, `catsWithLimit`, and `catsInLimit`. There is no `receitas` and no `despesas` anywhere on it. Both conditions are permanently `undefined`, so this entire block never executes. The Gemini call goes out with the income/expense summary silently missing — the analysis is built on a degraded prompt, which is the whole point of Phase 05 ("IA Real"). This is a logic error that defeats the feature's core value, not a cosmetic one.

**Fix:** Either populate `totals` with the real figures, or read from fields that actually exist. `receita` is already computed in `FidesOrcamento` (`fides-orcamento.jsx:1231-1235`) and `realized`/`planned` exist on `totals`. Map to the real data:

```js
// In buildAiContext — use fields that exist on the totals object:
if (totals && (totals.realized != null || totals.planned != null)) {
  var realizado = totals.realized != null ? fmtVal(totals.realized) : null;
  var planejado = totals.planned != null ? fmtVal(totals.planned) : null;
  if (realizado != null && planejado != null) {
    parts.push('Realizado do mês: ' + realizado + '. Planejado: ' + planejado + '.');
  }
}
```

If income/expense specifically are wanted, pass `receita` (and a despesas total) into `PlnMesInsights` as an explicit prop and read them by their real names. Verify the field names against the props actually supplied at the render site before shipping.

## Warnings

### WR-01: No client-side throttle/cooldown — button re-enables immediately, letting users burn the 100/day server quota

**File:** `assets/fides-orcamento.jsx:1047-1108`, `1139-1149`
**Issue:** The button is disabled only while `aiLoading` is true (`disabled: aiLoading`). The moment a response (success or error) resolves, `setAiLoading(false)` runs and the button is immediately clickable again. There is no cooldown. The sibling implementation (`assets/fides-claude.jsx`) enforces a `cooldown` after every response (`setCooldown(COOLDOWN_NORMAL_SEC)` on success/error paths), and the server file header explicitly documents this as a required protection: *"MANTÉM proteções... throttle 4s no cliente, rate limit 100 msg/dia/usuário"* (`api/assistant.js:3`). Each click inserts a row into `assistant_usage` and counts against `USER_DAILY_LIMIT = 100`. A user (or an accidental double-tap on mobile, the target platform) can rapidly exhaust their daily analyses. The client-side throttle that the rest of the system relies on is missing here.

**Fix:** Add a cooldown timer mirroring `fides-claude.jsx`. Minimal version:

```js
var stCooldown = React.useState(0);
var cooldown = stCooldown[0]; var setCooldown = stCooldown[1];

React.useEffect(function () {
  if (cooldown <= 0) return;
  var id = setTimeout(function () { setCooldown(cooldown - 1); }, 1000);
  return function () { clearTimeout(id); };
}, [cooldown]);

// in handleAiClick guard:
if (aiLoading || cooldown > 0) return;
// on every terminal path (success + each error): setCooldown(4);
// button: disabled: aiLoading || cooldown > 0
```

### WR-02: Single-shot handler fails closed on any `tool_calls` response — the system prompt actively pushes the model toward tools, so this will trigger often

**File:** `assets/fides-orcamento.jsx:1086-1092`
**Issue:** When Gemini returns `tool_calls`, the handler surfaces a generic "temporarily unavailable" error (`friendlyAiError('GEMINI_ERROR')`) and stops. The comment acknowledges this is intentional (no `executeTools` in single-shot mode). The problem: the server's `SYSTEM_PROMPT` explicitly instructs the model to prefer tools — *"Quando o usuário pedir dados específicos... USE as ferramentas... Não invente valores nem confie só no contexto inicial"* (`api/assistant.js:26`) — and the fixed user message ("Analise meu orçamento deste mês e aponte os principais pontos de atenção") is exactly the kind of data-grounded request that steers the model toward `consultar_saldo` / `consultar_extrato`. So a non-trivial fraction of clicks will hit this path, show a misleading "assistant unavailable" message, and count against the daily quota with no analysis produced. This is a foreseeable, frequent failure mode presented to the user as a transient server fault.

**Fix:** At minimum, give this path a distinct, honest message (not `GEMINI_ERROR`, which implies a server outage). Better: for the analysis use case, request a text-only answer — either omit `tools` from this specific call server-side for an "analysis mode", or steer the prompt to answer from the provided `context` without tool calls. If tools must stay enabled, the message should communicate that the analysis needs richer data and suggest the full chat assistant.

### WR-03: JWT transmitted in JSON request body rather than the `Authorization` header

**File:** `assets/fides-orcamento.jsx:1070-1075`
**Issue:** The access token is placed in the POST body (`jwt: jwt`). Tokens in request bodies are more likely to be captured by request-logging/analytics middleware and proxies than an `Authorization` header, and the value is a live Supabase session token. This matches the pre-existing convention in `fides-claude.jsx` and the server reads `req.body.jwt` (`api/assistant.js:100-108`), so it is not a regression introduced by this phase — but the phase is explicitly the point where this endpoint gets exercised from a new surface, so it is worth flagging. It is a consistency/hardening item, not an exploit.

**Fix:** Non-blocking, but preferred: send the token as `headers: { 'Authorization': 'Bearer ' + jwt }` and update the server to read `req.headers.authorization`. If kept in the body for parity with the existing component, ensure no request-body logging is enabled on the `/api/assistant` route in production.

### WR-04: `friendlyAiError(data && data.error)` can pass a non-string/`undefined` on non-error responses; error mapping silently degrades

**File:** `assets/fides-orcamento.jsx:1080-1081`
**Issue:** On `!res.ok`, `data` comes from `res.json().catch(function () { return {}; })`. If the error response body is not JSON (e.g. a plain-text gateway 502/504 from the platform edge), `data` is `{}` and `data.error` is `undefined`, so the user gets the generic fallback string. That is acceptable, but the same `data` object is also read as `data.tool_calls` (line 1086) and `data.reply` (line 1094) on the success path; if a 200 arrives with a non-JSON body, `data` is `{}`, `reply` is falsy, and the user sees `EMPTY_REPLY` even though the real failure was a malformed/HTML success response. The handler cannot distinguish "empty analysis" from "response wasn't JSON."

**Fix:** Capture whether JSON parsing succeeded and branch on it:

```js
var parsedOk = true;
var data = await res.json().catch(function () { parsedOk = false; return {}; });
if (!parsedOk) { setAiError(friendlyAiError('INTERNAL_ERROR')); setAiLoading(false); return; }
```

## Info

### IN-01: `setAiLoading(false)` duplicated across seven return paths — refactor to a single cleanup

**File:** `assets/fides-orcamento.jsx:1063, 1082, 1090, 1097, 1102, 1105` (and the guard at 1048)
**Issue:** Every terminal branch of `handleAiClick` repeats `setAiLoading(false)`. This is error-prone: WR-01's cooldown fix would need to be added to each site too, and it is easy to miss one and leave the spinner stuck. A `finally` block on the async IIFE (or a small `finish(err, result)` helper) would centralize `setAiLoading(false)` and any future cooldown/cleanup.
**Fix:** Wrap the body in `try/catch/finally` and set `aiLoading` false once in `finally`; set result/error in the try/catch.

### IN-02: Fixed analysis prompt is a magic string duplicated inline

**File:** `assets/fides-orcamento.jsx:1071`
**Issue:** The user message `'Analise meu orçamento deste mês e aponte os principais pontos de atenção.'` is hardcoded inline in the fetch body. Hoisting it to a named constant near the top of the component (alongside `PLN_MONTHS`) makes it discoverable and editable without hunting through the handler.
**Fix:** `var AI_ANALYSIS_PROMPT = 'Analise meu orçamento...';` and reference it.

### IN-03: `prefers-reduced-motion` gate covers the spinner but not the result/error entrance

**File:** `assets/fides-orcamento.css:852-854`
**Issue:** The new `@media (prefers-reduced-motion: reduce)` block correctly neutralizes `.pln-mi-spin`. It is scoped only to the spinner, which is the only new animation in the AI surface, so this is complete for the changed code. Noted for completeness: the reduced-motion block elsewhere in this file does not cover pre-existing animations (`pln-expand`, `pln-sheet-up`, `pln-fade`, `pln-toast-in`), but those are out of Phase 05 scope.
**Fix:** None required for this phase. If a global reduced-motion pass is desired later, extend the media query to the sheet/toast/expand keyframes.

---

_Reviewed: 2026-06-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
