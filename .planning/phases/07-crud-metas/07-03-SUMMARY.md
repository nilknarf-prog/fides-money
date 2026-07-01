---
phase: 07-crud-metas
plan: 03
subsystem: ui
tags: [react, jsx, modal, crud, metas, forms]

# Dependency graph
requires:
  - phase: 07-crud-metas (plan 01)
    provides: goals.target_date and goals.description columns (live schema + supabase/schema.sql mirror)
  - phase: 07-crud-metas (plan 02)
    provides: addGoal/updateGoal/deleteGoal mutations on FidesProvider; normalizeGoal emitting prazo/descricao
provides:
  - CriarMetaModal (new modal component) for creating goals
  - AjustarPlanoModal edited to be the goal-edit modal (atual/contribuicao removed, prazo added)
  - MetasStudio wired end-to-end: Nova/Editar/Excluir meta open real modals and call addGoal/updateGoal/deleteGoal
  - Fixed Rules-of-Hooks violation and mis-wired onAdd prop in the top-level isEmpty empty state
affects: [any future Metas UI work, M5+ aportes/progress features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UI->DB key translation happens in the MetasStudio onConfirm wrapper (not inside the modal), keeping updateGoal(id, patch) DB-shaped like updateAccount"
    - "React hooks (useState) must be declared before any conditional early return in a component — moved MetasStudio's local state above the isEmpty guard"

key-files:
  created: []
  modified:
    - assets/fides-metas.jsx

key-decisions:
  - "CriarMetaModal payload is UI-shaped (nome/alvo/prazo/emoji/tint/descricao); addGoal (from Plan 02) does the UI->DB mapping on insert"
  - "AjustarPlanoModal's onConfirm now emits UI-shaped payload (nome/descricao/emoji/alvo/prazo/tint, no atual/contribuicao); the MetasStudio mount-site onConfirm wrapper translates to DB-shaped patch (name/target/target_date/description/emoji/tint) before calling updateGoal(id, patch)"
  - "Concluir dots-menu item and Aportar/Ajustar-plano card buttons intentionally left on setEmBreve(true) — deferred to M5+ (aportes/progress)"

patterns-established:
  - "Value-or-null useState (editTarget/deleteTarget) mirrors the existing simularDivida pattern: null = closed, object = open with payload"

requirements-completed: [META-01, META-02, META-03, META-04]

# Metrics
duration: 12min
completed: 2026-07-01
status: complete
---

# Phase 07 Plan 03: CRUD Metas UI Wiring Summary

**Metas view goes from read-only to fully writable: CriarMetaModal (new), edited AjustarPlanoModal, and all Nova/Editar/Excluir entry points in MetasStudio now call addGoal/updateGoal/deleteGoal instead of opening the EmBreveModal placeholder.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-01T19:33:00Z
- **Completed:** 2026-07-01T19:45:38Z
- **Tasks:** 3 completed
- **Files modified:** 1 (`assets/fides-metas.jsx`)

## Accomplishments
- New `CriarMetaModal({ open, onConfirm, onClose })` — full creation form (nome/alvo/prazo/emoji/tint/descricao), no atual/contribuicao, prazo `min={today}`, uses `useModalClose`
- `AjustarPlanoModal` converted into the goal-edit modal: `atual`/`contribuicao` fields and payload keys removed; `prazo` (type=date, min=today) added; `descricao` unchanged
- `MetasStudio` fully wired: destructures `addGoal`/`updateGoal`/`deleteGoal`; new `criarOpen`/`editTarget`/`deleteTarget` state; all three modals mounted with UI->DB translation happening in the edit `onConfirm` wrapper
- All Nova/Editar/Excluir meta entry points (empty-state CTA, chapter action link, per-card dots menu, and the top-level `isEmpty` "Criar primeira meta" CTA) now open the real modals — none open `EmBreveModal` or the Nova Transação modal anymore
- Fixed a pre-existing Rules-of-Hooks violation: `MetasStudio`'s `useState` calls were declared after the conditional `isEmpty` early return; moved them above it so hooks always run unconditionally
- Fixed the mis-wired top-of-page empty-state CTA, which invoked the parent-supplied `onAdd` prop (opening `fides-studio.jsx`'s Nova Transação modal by accident) — now calls `setCriarOpen(true)` directly and mounts `CriarMetaModal` on that code path

## Task Commits

Each task was committed atomically:

1. **Task 1: Criar CriarMetaModal e ajustar AjustarPlanoModal** - `b495660` (feat)
2. **Task 2: Reconectar MetasStudio — estado, mount, mutations** - `6ee355b` (feat)
3. **Task 3: Corrigir onAdd mal-cabeado e Rules of Hooks** - `49e4bfb` (fix)

**Plan metadata:** (pending — final docs commit below)

## Files Created/Modified
- `assets/fides-metas.jsx` - Added `CriarMetaModal`; edited `AjustarPlanoModal` (removed atual/contribuicao, added prazo); wired `MetasStudio` state/mounts/handlers to `addGoal`/`updateGoal`/`deleteGoal`; moved hooks above the `isEmpty` guard; fixed top empty-state CTA

## Decisions Made
- UI→DB translation for edit lives in the `MetasStudio` mount-site `onConfirm` wrapper (per D-12 / plan instruction), not inside `AjustarPlanoModal` or inside `updateGoal` itself — keeps `updateGoal(id, patch)` symmetric with `updateAccount`.
- `CriarMetaModal`'s payload stays UI-shaped; `addGoal` (built in Plan 02) does its own UI→DB mapping on insert, so no translation wrapper was needed at that call site.
- Preserved all deferred CTAs (`concluir` dots item, `Aportar`, `Ajustar plano` card buttons, and the unrelated "Configurar" tip in the "Como acelerar" panel) exactly as `setEmBreve(true)` — out of scope per CONTEXT.md D-11 scope boundary.

## Deviations from Plan

None - plan executed exactly as written. Task 3's Rules-of-Hooks fix and onAdd rewiring were explicitly specified in the plan's task 3 action, not an unplanned discovery.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. This plan only edits `assets/fides-metas.jsx`; no build step exists (no bundler/npm on the front per PROJECT.md §3), so correctness was verified via grep-based acceptance criteria and code inspection rather than a typecheck/build.

## Next Phase Readiness

- All 3 META CRUD flows (create/edit/delete) are wired end-to-end to the Plan 02 store mutations, closing META-01/02/03/04.
- Human verification still needed at 400×512px iOS Safari (checkpoint deferred to user per plan's `autonomous: false` / human-check items in each task's `<verify>` block): confirm the native date picker blocks past dates, confirm no horizontal scroll in the modals, and confirm each entry point opens the correct modal instead of "Em breve" or the transaction modal.
- Deferred M5+ scope (aportes, progress tracking, ajuste de plano as calculator, cover image) remains untouched and still routes through `EmBreveModal` as expected.

---
*Phase: 07-crud-metas*
*Completed: 2026-07-01*

## Self-Check: PASSED

- FOUND: .planning/phases/07-crud-metas/07-03-SUMMARY.md
- FOUND: b495660 (Task 1 commit)
- FOUND: 6ee355b (Task 2 commit)
- FOUND: 49e4bfb (Task 3 commit)
