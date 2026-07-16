---
phase: 13-ia-3-gating-premium-in-app
plan: 04
subsystem: ui
tags: [react, paywall, gating, premium, babel-standalone]

# Dependency graph
requires:
  - phase: 13-ia-3-gating-premium-in-app (Plan 01)
    provides: userPlan/isPremium via useFides() (fides-store.jsx)
  - phase: 13-ia-3-gating-premium-in-app (Plan 03)
    provides: server error codes FREE_MONTHLY_LIMIT (429) / PREMIUM_REQUIRED (403) in api/assistant.js
provides:
  - Chat (fides-claude.jsx) paywall copy for FREE_MONTHLY_LIMIT/PREMIUM_REQUIRED
  - Análise da IA (fides-orcamento.jsx) paywall copy + button gated by isPremium
  - PerfilView (fides-studio.jsx) tier badge + upgrade CTA + UpgradeModal placeholder
affects: [14-ia-4-bot-whatsapp, M6-comercial]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two independent client error maps (friendlyError in fides-claude.jsx, friendlyAiError in fides-orcamento.jsx) must be edited together for any new server error code (Pitfall 4)"
    - "UI-layer tier gating is convenience only — server (Plan 13-03) is the authoritative gate (D-01, second layer)"

key-files:
  created: []
  modified:
    - assets/fides-claude.jsx
    - assets/fides-orcamento.jsx
    - assets/fides-orcamento.css
    - assets/fides-studio.jsx
    - assets/fides-studio.css

key-decisions:
  - "PlnMesInsights receives isPremium as a prop from FidesOrcamento's useFides() call, not its own window.useFides() call — avoids adding a second store subscription in a component that doesn't otherwise read the store"
  - "Análise da IA upsell CTA is static text (no navigation link) — the app has no hash/URL routing (state-based SPA nav via onNav), and PlnMesInsights has no onNav prop threaded to it; a dead '#/perfil' anchor would be misleading, so scope was kept to text pointing the user to the Perfil tab manually"
  - "UpgradeModal written in React.createElement (not JSX) to match PerfilView's existing ES5 style in fides-studio.jsx — avoids introducing JSX into a file that doesn't use Babel JSX sugar in this region (history: Phase 07 Rules of Hooks bug in this app)"

requirements-completed: [GATE-03, PAYWALL-01]

coverage:
  - id: D1
    description: "Chat (fides-claude.jsx) friendlyError map + 429 dispatch ladder handle FREE_MONTHLY_LIMIT/PREMIUM_REQUIRED with upgrade-pointing copy, not generic fallback"
    requirement: "PAYWALL-01"
    verification:
      - kind: other
        ref: "grep -c FREE_MONTHLY_LIMIT/PREMIUM_REQUIRED assets/fides-claude.jsx (3/1 hits) + grep -c window.confirm(/alert( == 0"
        status: pass
    human_judgment: true
    rationale: "Grep confirms the codes/copy exist and no native dialogs were introduced, but whether the copy renders correctly after a real 11th free-tier message (429 FREE_MONTHLY_LIMIT round-trip from the live server) requires human verification in the running app."
  - id: D2
    description: "Análise da IA (fides-orcamento.jsx) friendlyAiError map has the 2 codes; the AI button renders inactive (upsell block) instead of clickable when !isPremium"
    requirement: "GATE-03"
    verification:
      - kind: other
        ref: "grep -c FREE_MONTHLY_LIMIT/PREMIUM_REQUIRED/isPremium assets/fides-orcamento.jsx (1/1/3 hits) + grep -c window.confirm(/alert( == 0"
        status: pass
    human_judgment: true
    rationale: "Grep confirms wiring exists; whether the button is visually hidden/replaced correctly for a real free user vs a real pro user (and that the 403 defense-in-depth path still works if forced) requires human verification in the running app."
  - id: D3
    description: "PerfilView shows a Premium/Free tier badge and, when free, a CTA that opens a new UpgradeModal (React.createElement, EmBreveModal-style, checkout placeholder 'em breve' for M6)"
    requirement: "PAYWALL-01"
    verification:
      - kind: other
        ref: "grep -c 'function UpgradeModal'/useModalClose/prf-badge assets/fides-studio.jsx (1/1/1 hits) + grep -c window.confirm(/alert( == 0 + brace/paren balance check (node -e) == 0/0"
        status: pass
    human_judgment: true
    rationale: "Static checks confirm the code is syntactically balanced and wired to useModalClose/isPremium, but only running the app in Babel-standalone confirms it parses/renders without error and that the badge/CTA/modal look correct for free vs. pro accounts (T-13-08 in the plan's threat model explicitly calls for this human-check)."

duration: ~8min
completed: 2026-07-16
status: complete
---

# Phase 13 Plan 04: Paywall UI (chat + Análise da IA + Perfil) Summary

**As 3 superfícies de IA/perfil (chat, Análise da IA, Perfil) passam a reagir ao tier do usuário: copy de upgrade nos 2 mapas de erro independentes, botão de Análise gateado por isPremium, e um badge+CTA+UpgradeModal placeholder no Perfil — tudo com React.createElement em fides-studio.jsx (zero JSX novo) e zero diálogo nativo do browser.**

## Performance

- **Duration:** ~8min
- **Completed:** 2026-07-16
- **Tasks:** 3
- **Files modified:** 5 (3 planned .jsx + 2 companion .css for visual consistency)

## Accomplishments
- Chat (`fides-claude.jsx`): `friendlyError` map gains `FREE_MONTHLY_LIMIT`/`PREMIUM_REQUIRED` with upgrade-pointing copy; 429 dispatch ladder gets a `FREE_MONTHLY_LIMIT` branch parallel to the existing `USER_DAILY_LIMIT` branch (same cooldown/rateLimitMode shape), instead of falling through to the generic `RATE_LIMIT` copy.
- Análise da IA (`fides-orcamento.jsx`): `friendlyAiError` map (separate ES5-`var` copy, Pitfall 4) gains the same 2 codes with its own upgrade copy; `PlnMesInsights` now receives `isPremium` as a prop from `FidesOrcamento`'s `store.isPremium` and renders a static upsell block (`.pln-mi-ai-upsell`) instead of the active AI button when the user is free. The server 403 remains the real defense-in-depth for a forced call.
- PerfilView (`fides-studio.jsx`): destructures `userPlan`/`isPremium` from `useFides()`, renders a `prf-badge` ("Premium"/"Free"), and — when free — a CTA button that opens a new `UpgradeModal` component. `UpgradeModal` mirrors `EmBreveModal`'s shape (`window.FidesUI.useModalClose`, backdrop/head/body/foot) but is written entirely in `React.createElement` to match the file's local ES5 convention (no JSX introduced).

## Task Commits

Each task was committed atomically:

1. **Task 1: Chat — copy de paywall para FREE_MONTHLY_LIMIT/PREMIUM_REQUIRED** - `977cc99` (feat)
2. **Task 2: Análise da IA — copy de paywall + gate do botão por isPremium** - `bfdb61c` (feat)
3. **Task 3: PerfilView — badge de tier + CTA de upgrade + UpgradeModal** - `87b51dc` (feat)

_No TDD tasks in this plan — pure UI composition per the pattern map (all analogs in-file/self-referential)._

## Files Created/Modified
- `assets/fides-claude.jsx` - `friendlyError` map + 429 dispatch ladder gain `FREE_MONTHLY_LIMIT`/`PREMIUM_REQUIRED`
- `assets/fides-orcamento.jsx` - `friendlyAiError` map gains the 2 codes; `PlnMesInsights` gates the AI button by `isPremium` prop; call site passes `isPremium: !!store.isPremium`
- `assets/fides-orcamento.css` - `.pln-mi-ai-upsell` style for the free-tier upsell block (visual parity with `.pln-mi-ai-btn`)
- `assets/fides-studio.jsx` - `PerfilView` gains tier badge + upgrade CTA + local `upgradeOpen` state; new `UpgradeModal` component (React.createElement, EmBreveModal-style)
- `assets/fides-studio.css` - `.prf-badge`/`.prf-badge--free`/`.prf-badge--premium`/`.prf-upgrade-btn` styles reusing `tokens.css` vars (`--accent-soft`, `--radius-pill`)

## Decisions Made
- `PlnMesInsights` receives `isPremium` as a prop (not its own `window.useFides()` call) — the parent `FidesOrcamento` already reads the store; adding a second subscription in the child was unnecessary and diverges from how `groups`/`totals`/`prevTxs` are already threaded down.
- Análise da IA's free-tier upsell is plain text (no clickable link) — the app has no hash/URL router (`DashboardStudio` uses state-based `onNav`, not threaded to `PlnMesInsights`); a non-functional `#/perfil` anchor would be a broken/misleading affordance, so the CTA just tells the user where to go ("veja os planos no seu Perfil") without a dead link.
- `UpgradeModal` is React.createElement, not JSX, specifically to avoid introducing a second markup syntax into `fides-studio.jsx`'s `PerfilView` region — this file has no bundler/build step (Babel-standalone in-browser), and the project has a documented Rules-of-Hooks/parse regression history (Phase 07) that the plan explicitly flagged to avoid repeating.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added companion CSS for new markup**
- **Found during:** Task 2 and Task 3
- **Issue:** The plan's `files_modified` frontmatter listed only the 3 `.jsx` files, but the new upsell block (`fides-orcamento.jsx`) and tier badge/CTA (`fides-studio.jsx`) had no existing CSS classes to inherit from — shipping them unstyled would be a visible regression against the app's existing design system (every other `pln-mi-*`/`prf-*` element has a matching CSS rule).
- **Fix:** Added `.pln-mi-ai-upsell` to `assets/fides-orcamento.css` and `.prf-badge`/`.prf-badge--free`/`.prf-badge--premium`/`.prf-upgrade-btn` to `assets/fides-studio.css`, reusing existing `tokens.css` variables and mirroring the visual weight of sibling elements (`.pln-mi-ai-btn`, `.prf-hint`).
- **Files modified:** assets/fides-orcamento.css, assets/fides-studio.css
- **Verification:** Read against existing class definitions in both CSS files to confirm no name collisions; all custom properties referenced (`--accent-soft`, `--radius-pill`, `--card-soft`, `--border-strong`, `--ink-3`) already exist in `tokens.css`.
- **Committed in:** bfdb61c (Task 2 commit), 87b51dc (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical — companion CSS), applied across 2 commits
**Impact on plan:** Necessary for visual correctness (the plan's own file list undersized the styling surface for genuinely new UI elements). No scope creep into unrelated files or features.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The 3 paywall surfaces (chat, Análise da IA, Perfil) are fully wired to `isPremium`/the new server error codes; UAT batch (`/gsd-verify-work 13`) should cover: free user hits the 11th-message chat paywall, free user sees the Análise upsell (and a forced call still 403s), free vs. pro Perfil badge/CTA, and — per the plan's own threat register (T-13-08) — confirm the app still parses/loads without a Babel-standalone error after these `React.createElement` additions.
- `UpgradeModal`'s checkout is an intentional placeholder ("em breve") — M6 (Comercial) is the phase that will wire a real checkout; this plan does not block on that dependency, per the phase CONTEXT.
- Phase 13 (GATE-01/02/03, PAYWALL-01) is now fully implemented across its 4 plans (13-01 store, 13-02 SQL privilege lock, 13-03 server gate, 13-04 UI paywall) — human UAT for Phase 12 (WRITE in-app) remains a separate, still-open item per STATE.md.

---
*Phase: 13-ia-3-gating-premium-in-app*
*Completed: 2026-07-16*
