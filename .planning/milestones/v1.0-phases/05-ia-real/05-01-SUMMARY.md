---
phase: 05-ia-real
plan: 01
subsystem: ui
tags: [gemini, fetch, react-createelement, error-handling, accessibility]

# Dependency graph
requires:
  - phase: 03-limpeza-tokens
    provides: CSS token consistency (--card-soft, --border-strong, --ink-3, --bad-soft, --bad) reused by the new panels
provides:
  - Real single-shot Gemini fetch replacing the 2.2s setTimeout stub in PlnMesInsights
  - .pln-mi-ai-result / .pln-mi-ai-error inline render surfaces, mutually exclusive
  - prefers-reduced-motion gate on .pln-mi-spin (static ring instead of rotation)
  - friendlyAiError error-code map (JWT_MISSING/JWT_INVALID, USER_DAILY_LIMIT, RATE_LIMIT, EMPTY_REPLY, GEMINI_ERROR family, NETWORK, default)
  - buildAiContext budget-context string builder (groups/totals/prevTxs only)
affects: [ia-real, api-assistant, fides-orcamento]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-shot AI fetch with never-hang guarantee: every branch (!res.ok, empty reply, unexpected tool_calls, network catch) resets aiLoading=false before returning"
    - "Untrusted model text rendered strictly as React text children (split('\\n').map -> <p>), never dangerouslySetInnerHTML"
    - "Fail-closed on unexpected tool_calls response instead of implementing a tool round-trip loop"

key-files:
  created: []
  modified:
    - assets/fides-orcamento.css
    - assets/fides-orcamento.jsx

key-decisions:
  - "Single-shot analysis intentionally does NOT execute READ tool_calls returned by api/assistant.js. If the endpoint ever responds with a non-empty tool_calls array for this prompt, the handler fails closed with friendlyAiError('GEMINI_ERROR') rather than looping or hanging. To add tool round-trips later, port the executeTools implementation and the tool_calls loop from assets/fides-claude.jsx (~lines 522-528)."
  - "Error copy is a dedicated map (friendlyAiError) distinct from fides-claude.jsx's friendlyError, reworded for the budget-analysis context per the UI-SPEC Copywriting Contract."
  - "buildAiContext reads only groups/totals/prevTxs (props already in scope for PlnMesInsights) — no accounts/cards/goals data, since this component does not receive them."

patterns-established:
  - "Reduced-motion gate convention: @media (prefers-reduced-motion: reduce) sets animation: none and a static border-top-color, mirroring the existing fides.css convention, applied here to .pln-mi-spin."

requirements-completed: [AI-01, AI-02]

# Metrics
duration: ~20min (across 2 sessions, paused at human-verify checkpoint)
completed: 2026-07-01
status: complete
---

# Phase 05 Plan 01: IA Real (single-shot Gemini call) Summary

**Replaced the 2.2s `setTimeout` stub in `PlnMesInsights` with a real single-shot fetch to `/api/assistant`, rendering Gemini's reply in a new `.pln-mi-ai-result` panel or a friendly `.pln-mi-ai-error` message, with a `prefers-reduced-motion` gate on the loading spinner.**

## Performance

- **Duration:** ~20 min of active execution (Tasks 1-3), plus a human-verification pause (Task 4) that spanned across sessions
- **Started:** 2026-07-01 (approx, per STATE.md session record)
- **Completed:** 2026-07-01
- **Tasks:** 4 (3 auto + 1 checkpoint:human-verify, approved)
- **Files modified:** 2 (`assets/fides-orcamento.css`, `assets/fides-orcamento.jsx`)

## Accomplishments
- "Análise da IA" button now calls the real Gemini 2.5 Flash-Lite endpoint (`api/assistant.js`) instead of a fake 2.2s delay
- Loading state is synchronous on click (spinner + "Analisando…" + disabled button) — never silent
- Success renders the analysis inline in `.pln-mi-ai-result`, split into paragraphs, without a page reload
- Failure (network, 4xx/5xx, empty reply, unexpected tool_calls) renders a friendly `.pln-mi-ai-error` message and always resets loading — never an infinite spinner
- `prefers-reduced-motion: reduce` users get a static ring instead of a spinning indicator
- Human verification (Task 4) confirmed all of the above live in the app — approved

## Task Commits

Each task was committed atomically:

1. **Task 1: Add result/error CSS surfaces + reduced-motion gate for the spinner** - `5de963f` (feat)
2. **Task 2: Add error-map, context builder, and result/error state to PlnMesInsights** - `8a36650` (feat)
3. **Task 3: Replace the stub with a real single-shot Gemini fetch + render result/error panels** - `21ac30e` (feat)
4. **Task 4: Human verification of the real IA analysis flow** - checkpoint (no code commit) — **approved** by human, all 7 verification steps confirmed live (immediate spinner, inline result panel, click-again clears previous result, offline error message, reduced-motion static ring, no main-thread freeze)

**Progress record (Tasks 1-3):** `18489b2` (docs: record execution progress, paused at checkpoint)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified
- `assets/fides-orcamento.css` - Added `.pln-mi-ai-result`, `.pln-mi-ai-result p`, `.pln-mi-ai-error` rules (all using existing tokens: `--card-soft`, `--border-strong`, `--ink-3`, `--bad-soft`, `--bad`) and a `@media (prefers-reduced-motion: reduce)` gate on `.pln-mi-spin`
- `assets/fides-orcamento.jsx` - Added `aiResult`/`setAiResult`, `aiError`/`setAiError` state; `friendlyAiError(errCode)` copy map; `buildAiContext()` budget-context builder; rewrote `handleAiClick` as an async single-shot fetch handler with never-hang guarantee; extended the footer render with mutually-exclusive result/error panels

## Decisions Made
- **Tool-call round-trip intentionally out of scope:** the single-shot analysis prompt does not implement `executeTools`. If `api/assistant.js` ever returns a non-empty `tool_calls` array for this budget-analysis request, the handler fails closed with `friendlyAiError('GEMINI_ERROR')` ("O assistente está temporariamente indisponível. Tente novamente em instantes.") rather than attempting a round-trip or hanging. **To add tool round-trips later:** port the `executeTools` implementation and the `tool_calls` loop from `assets/fides-claude.jsx` (~lines 522-528), which already has the pattern for the chat assistant.
- Error copy uses a dedicated `friendlyAiError` map (not reused from `fides-claude.jsx`'s `friendlyError`) since the UI-SPEC intentionally rewords copy for the budget-analysis context.
- `buildAiContext` is scoped strictly to `groups`/`totals`/`prevTxs` (the props `PlnMesInsights` already receives) — no `accounts`/`cards`/`goals`, which this component does not have access to.

## Deviations from Plan

None - plan executed exactly as written. Tasks 1-3 matched their acceptance criteria on first pass; Task 4 (human-verify) was approved without any reported failures.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required (Gemini API key and Supabase JWT auth were already configured by the pre-existing `api/assistant.js` backend from Phase 3).

## Self-Check

**Files exist:**
- FOUND: assets/fides-orcamento.css (`.pln-mi-ai-result` at line 825, `.pln-mi-ai-error` at line 839, `prefers-reduced-motion` gate at line 852)
- FOUND: assets/fides-orcamento.jsx (`friendlyAiError`, `buildAiContext`, `setAiResult`, `setAiError`, `fidesAuth.getSession` all present; stub `2200`/`setTimeout` count is 0 — confirmed removed)

**Commits exist:**
- FOUND: 5de963f
- FOUND: 8a36650
- FOUND: 21ac30e
- FOUND: 18489b2

**Phase-level automated verification (from PLAN.md `<verification>` block):**
- `grep -c dangerouslySetInnerHTML assets/fides-orcamento.jsx` → 0 — PASS (no HTML injection of model output)
- `grep -Eq 'import |export ' api/assistant.js` → no match — PASS (api/assistant.js remains CommonJS, no ESM introduced)
- `grep -Eq 'module.exports' api/assistant.js` → match — PASS (backend contract intact)
- `grep -c 'setTimeout' assets/fides-orcamento.jsx` → 0 — PASS (2.2s stub fully removed)
- Manual checkpoint (Task 4) → **approved** — immediate loading, inline result, friendly error on failure, no infinite spinner, no main-thread freeze, all confirmed live by human reviewer

**Render logic confirmed:** result panel renders only when `aiResult && !aiError`; error panel renders whenever `aiError` is truthy — mutually exclusive as required.

## Next Phase Readiness
- Phase 05 (IA Real) is the last active phase of milestone v1.0 (Polish pré-lançamento) — all 3 phases (03, 04, 05) are now complete
- No blockers for milestone completion
- Future enhancement path documented: tool round-trip support (`executeTools`) can be ported from `fides-claude.jsx` if budget-analysis prompts need to call READ tools

---
*Phase: 05-ia-real*
*Completed: 2026-07-01*
