---
phase: 07-crud-metas
plan: 02
subsystem: state-store
tags: [react-context, supabase, crud, goals]

# Dependency graph
requires:
  - phase: 07-crud-metas (plan 01)
    provides: "goals.target_date and goals.description columns (live schema + supabase/schema.sql mirror)"
provides:
  - "addGoal/updateGoal/deleteGoal mutations on FidesProvider, mirroring the addAccount/updateAccount/deleteAccount trio"
  - "normalizeGoal mapping target_date -> prazo and description -> descricao"
  - "goal mutations exposed via useFides() context value and no-op fallback"
affects: [07-crud-metas (plan 03 — MetasStudio modals wiring)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Store CRUD trio: live insert/update/delete + refreshData(userId) refetch; mock branch mutates local state optimistically; try/catch with console.error('[Fides] <fn>:', err.message) tag"

key-files:
  created: []
  modified:
    - assets/fides-store.jsx

key-decisions:
  - "normalizeGoal maps target_date/description directly (DATE string passthrough, no Date parsing) per D-02/D-05/D-10"
  - "addGoal payload omits current/monthly_contrib entirely — left to schema defaults (0), per D-07/D-08"
  - "updateGoal takes DB-shaped patch (no UI-key translation in the store, unlike updateAccount's __targetBal special-case) since goals has no derived-balance RPC"

patterns-established:
  - "Goals CRUD trio placed in a new '// ─── Goals ───' block directly after Accounts, before Cards"

requirements-completed: [META-01, META-02, META-03, META-04]

# Metrics
duration: 6min
completed: 2026-07-01
status: complete
---

# Phase 07 Plan 02: Goals Write Layer Summary

**addGoal/updateGoal/deleteGoal added to FidesProvider mirroring the accounts CRUD trio, plus normalizeGoal extended to read target_date/description from the Plan 01 schema columns**

## Performance

- **Duration:** 6 min
- **Tasks:** 3 completed
- **Files modified:** 1 (`assets/fides-store.jsx`)

## Accomplishments
- `normalizeGoal` now maps `prazo ← row.target_date` (null-safe, no `Date` parsing — passes `YYYY-MM-DD` through as-is) and `descricao ← row.description || ''`, replacing the previous hardcoded `descricao: ''`
- New `// ─── Goals ───` block adds `addGoal`, `updateGoal`, `deleteGoal` as `React.useCallback`s with `[mode, userId, refreshData]` deps, structurally identical to the existing `addAccount`/`updateAccount`/`deleteAccount` trio (live insert/update/delete + `await refreshData(userId)`; mock branch mutates `goals` state optimistically)
- `addGoal` insert payload follows D-12 UI→DB mapping (`name`, `target`, `target_date`, `description`, `emoji`, `tint`) and deliberately omits `current`/`monthly_contrib` so they stay at schema defaults (D-07/D-08)
- `updateGoal`/`deleteGoal` operate by `id`, protected by the `goals` RLS policy (`auth.uid() = user_id`); `updateGoal` has no `set_account_balance`-style RPC branch since goals has no derived-balance concept
- All three mutations exposed in the `FidesProvider` context `value` object (next to `goals,`) and as no-op fallbacks in the provider-less `useFides()` branch (next to `goals: [],`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend normalizeGoal to map target_date and description** - `b0652e1` (feat)
2. **Task 2: Add addGoal/updateGoal/deleteGoal mirroring the accounts trio** - `43b3ab0` (feat)
3. **Task 3: Expose goal mutations in context value and useFides fallback** - `154e4a7` (feat)

_Note: no TDD tasks in this plan (tdd="false" on all three)._

## Files Created/Modified
- `assets/fides-store.jsx` - `normalizeGoal` extended (prazo/descricao mapping); new `addGoal`/`updateGoal`/`deleteGoal` callbacks added after the Accounts block; both exposed via context value and `useFides()` fallback

## Decisions Made
- `prazo`/`descricao` mapped with the same `row.field || default` idiom used by `normalizeAccount`, no custom date parsing (D-02) — required since the native `<input type="date">` consumed by Plan 03's modals produces/expects a raw `YYYY-MM-DD` string
- `updateGoal(id, patch)` stays DB-shaped, matching `updateAccount`'s non-balance path; the UI→DB key translation is left to the calling modal in Plan 03 (as noted as an open planner decision in `07-PATTERNS.md`) — the store function itself makes no assumption about which keys arrive, it just forwards `patch` to `.update()`
- No RPC branch added to `updateGoal` — goals has no equivalent of `set_account_balance`, confirmed against the schema and the plan's explicit instruction not to reproduce that branch

## Deviations from Plan

None - plan executed exactly as written. All three tasks' acceptance criteria (grep-based) passed on first implementation; no auto-fixes, no blocking issues, no architectural questions arose.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. No DB migration in this plan (Plan 01 already applied `target_date`/`description` to the live `goals` table and `supabase/schema.sql`).

## Next Phase Readiness
- `useFides().addGoal/updateGoal/deleteGoal` are now available for Plan 03 to wire into `CriarMetaModal` (new), `AjustarPlanoModal` (modify), and `MetConfirmDeleteModal` (wiring only) in `assets/fides-metas.jsx`
- `normalizeGoal` already surfaces `prazo`/`descricao` so Plan 03's edit modal can prefill `defaultValue={meta.prazo || ''}` / `defaultValue={meta.descricao}` without further store changes
- No blockers for Plan 03

---
*Phase: 07-crud-metas*
*Completed: 2026-07-01*

## Self-Check: PASSED

- FOUND: `.planning/phases/07-crud-metas/07-02-SUMMARY.md`
- FOUND: `b0652e1` (Task 1 commit)
- FOUND: `43b3ab0` (Task 2 commit)
- FOUND: `154e4a7` (Task 3 commit)
