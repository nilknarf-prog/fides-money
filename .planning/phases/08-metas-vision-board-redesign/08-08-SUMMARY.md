---
phase: 08-metas-vision-board-redesign
plan: 08
subsystem: database
tags: [supabase, rls, postgres, schema-drift, react, goals, conclusao]

# Dependency graph
requires:
  - phase: 08-01
    provides: public.goals table + owner-scoped RLS policy ("goals: próprio usuário")
  - phase: 08-07
    provides: fides-metas.jsx UI polish (wave 1, same file — overlap dependency only)
provides:
  - "Diagnosed and closed the metas completion blocker (Teste 7/8 of 08-UAT)"
  - "Self-healing schema.sql (idempotent ALTERs for completed/completed_at)"
  - "Client auto-conclusão on aporte/atualizar-saldo reaching target"
affects: [09-transacoes-anexos, future-goals-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standalone `alter table ... add column if not exists` after every column declared inside `create table if not exists` — a pre-existing table never gets new CREATE-block columns; this is the second time this bit us (image_url in 08-01, completed/completed_at here)"
    - "patchComAutoConclusao(meta, novoAtual) helper pattern: build the updateGoal patch conditionally, never emit the 'unset' value (no completed:false) — marco/evento fields are monotonic, not derived"

key-files:
  created:
    - supabase/goals-completed-fix.sql
  modified:
    - supabase/schema.sql
    - assets/fides-metas.jsx

key-decisions:
  - "Root cause = (a-schema), already healed live: create table if not exists is a no-op against a pre-existing table, so completed/completed_at (declared only in the CREATE block) never reached the live goals table; only image_url got a standalone ALTER + migration in 08-01"
  - "No live database write in this plan (checkpoint decision: No-op live + harden SQL) — completed/completed_at already exist live (confirmed via Supabase MCP introspection), added out-of-band after the UAT that reported the blocker"
  - "RLS UPDATE policy (goals: próprio usuário, owner-scoped) intentionally left unchanged — already correct"
  - "Manual 'Marcar como concluída' menu path required NO client code change — verified no-op, client was already correct end-to-end"
  - "Auto-conclusão helper never sets completed:false — no auto-reopen when balance drops below target after completion (locked decision)"

patterns-established:
  - "Pattern 1: Every column added to an existing Postgres table via `create table if not exists` must ALSO get a standalone idempotent ALTER — the CREATE block only helps genuinely-new tables"
  - "Pattern 2: Auto-derived boolean 'completed' state fields must only ever be set to true by helpers, never reset to false, to avoid unintended auto-reopen semantics"

requirements-completed: [GAP-CONCLUSAO]

# Metrics
duration: 20min
completed: 2026-07-03
status: complete
---

# Phase 08 Plan 08: Metas Completion Blocker Summary

**Diagnosed a schema-drift root cause (create-table-if-not-exists never adds columns to a pre-existing table), hardened schema.sql with defensive idempotent ALTERs, and added client-side auto-conclusão when a goal's balance reaches its target.**

## Performance

- **Duration:** ~20 min (continuation from orchestrator-resolved Task 1 + checkpoint)
- **Completed:** 2026-07-03T04:31:13Z
- **Tasks:** 3 (Task 1 diagnosis done by orchestrator pre-spawn; Task 2 + Task 3 executed here)
- **Files modified:** 3 (supabase/schema.sql, supabase/goals-completed-fix.sql created, assets/fides-metas.jsx)

## Accomplishments
- Closed the completion blocker from 08-UAT (Teste 7 manual conclusion, Teste 8 Capítulo III) by confirming the live schema already has `completed`/`completed_at` and hardening schema.sql so the drift that caused the original bug cannot recur
- Added `patchComAutoConclusao(meta, novoAtual)` helper wired into both balance-write sites (AportarModal, SaldoInlineEditor) — a goal auto-completes when its saved balance reaches/exceeds target, without ever auto-reopening on a later balance drop
- Verified the manual "Marcar como concluída" client path required zero code changes — it was always correct; the blocker was purely a live-data gap that has since healed

## Task 1: Diagnosis (completed by orchestrator before this executor was spawned)

Recorded verbatim per orchestrator handoff:

- LIVE `public.goals` columns: `completed` boolean NOT NULL default false — PRESENT; `completed_at` timestamptz nullable — PRESENT; `image_url` text nullable — PRESENT.
- RLS on `public.goals`: ENABLED. Policy `goals: próprio usuário` = `FOR ALL USING (auth.uid() = user_id)`, with_check null (falls back to USING for UPDATE) → owner-scoped UPDATE is PERMITTED. Policy is correct and remains unchanged.
- Data: 2 goals total, 0 completed, 0 with completed_at at diagnosis time (no completion had ever persisted).
- Migration history: `phase08_goals_image_url` applied 2026-07-03 01:56; NO tracked migration for completed/completed_at.
- **Root cause = hypothesis (a-schema), already healed live:** `schema.sql` declares `completed`/`completed_at` ONLY inside `create table if not exists public.goals (...)` (lines 86-87). Against the pre-existing goals table, `create table if not exists` is a no-op and never added those columns — only `image_url` got a standalone `ALTER` (line 94) + migration in Phase 08-01, so only `image_url` reached live at UAT time. Completion code (08-03 normalizeGoal, 08-05 menu) predates the UAT commit `325fb56` (2026-07-02 23:30), so UAT tested real code whose `PATCH /goals` hit missing columns → `updateGoal` caught the error, skipped `refreshData` → pill stayed "Ativa", nothing entered Concluídas/Cap III. Columns exist live now (added out-of-band since UAT), so the LIVE fix is already in place; the residual risk was the `schema.sql` drift trap, closed by Task 2.
- Client code at HEAD was verified correct end-to-end (normalizeGoal maps completed/completedAt; updateGoal `.update(patch).eq('id')` + refreshData; computed spreads `...m` preserving completed; filter/pill/Cap III read `m.completed`). Task 3's manual-completion branch was therefore a confirmed no-op — no client change needed for the manual path.

No production files were touched during Task 1 (diagnostic only, per plan prohibition).

## Task 2: Harden SQL (no live apply)

- Checkpoint (blocking-human, gate=`blocking-human`) was resolved by the user with decision **"No-op live + harden SQL"** — no `apply_migration`, no Supabase MCP write, no Dashboard SQL Editor action taken. Only local `supabase/*.sql` files edited.
- `supabase/schema.sql`: added two standalone idempotent ALTERs immediately after the existing `image_url` ALTER (line 94), mirroring its exact style:
  ```sql
  alter table public.goals add column if not exists completed    boolean not null default false;
  alter table public.goals add column if not exists completed_at  timestamptz;
  ```
- Created `supabase/goals-completed-fix.sql`: documents the drift root cause in a header comment (mirroring `goal-covers-storage.sql` style), carries the same two idempotent ALTERs, and explicitly notes the RLS UPDATE policy is already owner-scoped and intentionally left unchanged — no policy statement in the file.
- RLS was not touched. No DROP/DELETE statements. No live database write occurred.

## Task 3: Client auto-conclusão

- Added `patchComAutoConclusao(meta, novoAtual)` as a module-level helper next to `mesesLabel` in `assets/fides-metas.jsx` (line ~67). Builds `{ current: novoAtual }` and additionally sets `{ completed: true, completed_at: new Date().toISOString() }` only when `novoAtual >= meta.alvo && !meta.completed`. Never emits `completed: false`.
- Wired into both balance-write mount sites:
  - `AportarModal` `onConfirm` (~line 1163): `updateGoal(aportarTarget.id, patchComAutoConclusao(aportarTarget, aportarTarget.atual + valor))`
  - `SaldoInlineEditor` `onConfirm` (~line 1372): `updateGoal(m.id, patchComAutoConclusao(m, novoValor))`
- Manual "Marcar como concluída" menu (~line 1317) left unchanged — confirmed no-op per diagnosis; already calls `updateGoal(m.id, { completed: true, completed_at: new Date().toISOString() })` correctly.
- `AjustarPlanoModal` Status toggle (manual reactivation path) untouched, as required.
- No `confirm()`/`alert()` used. No hooks added — helper is module-level, Rules of Hooks preserved.
- `assets/fides-store.jsx` untouched (confirmed via `git status --porcelain` — clean throughout).

## Task Commits

Each task was committed atomically:

1. **Task 2: Harden goals schema (idempotent ALTERs, no live apply)** - `fde5b81` (fix)
2. **Task 3: Auto-conclusão on aporte/atualizar saldo** - `7bde9b7` (feat)

_Task 1 was diagnostic-only (no files modified) and produced no commit, per plan design._

## Files Created/Modified
- `supabase/schema.sql` - Added standalone idempotent `completed`/`completed_at` ALTERs after the `image_url` ALTER, closing the create-table-if-not-exists drift trap
- `supabase/goals-completed-fix.sql` (new) - Documents the drift root cause + carries the same idempotent ALTERs; explicitly notes RLS UPDATE policy unchanged
- `assets/fides-metas.jsx` - Added `patchComAutoConclusao` helper; wired into AportarModal and SaldoInlineEditor `onConfirm` mounts

## Decisions Made
- Root cause conclusively identified as (a-schema): `create table if not exists` never adds columns to a pre-existing table — this is a structural schema.sql authoring trap, and the same defensive-ALTER pattern established for `image_url` in 08-01 was applied to `completed`/`completed_at`.
- No live database write performed in this plan — the checkpoint's resolved decision ("No-op live + harden SQL") was honored exactly; live columns and RLS were only inspected (Task 1, via Supabase MCP), never written to.
- Auto-conclusão helper design locks in "no auto-reopen": once `completed` flips true via the helper, no code path in this plan can flip it back to false — reactivation remains exclusively the manual `AjustarPlanoModal` Status toggle.

## Deviations from Plan

None - plan executed exactly as written. Task 1 diagnosis and the Task 2 checkpoint resolution were completed by the orchestrator prior to this executor's spawn and are documented above verbatim per the continuation instructions; Task 2 and Task 3 were executed here exactly per the plan's action/acceptance-criteria, including the manual-path no-op documentation required by the plan's own branching logic.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. No live database changes were made in this plan; the live `completed`/`completed_at` columns and RLS policy were already correctly in place as confirmed by Task 1's Supabase MCP introspection.

## Verification

- `grep -c "patchComAutoConclusao" assets/fides-metas.jsx` → 3 (definition + AportarModal use + SaldoInlineEditor use)
- `grep -c "completed_at" assets/fides-metas.jsx` → 4 (comment + manual menu + helper definition + helper body)
- No `completed: false` / `completed:false` assignment anywhere in the file — the only match is the explanatory comment ("NUNCA seta completed:false")
- `git status --porcelain assets/fides-store.jsx` → empty (untouched, as required)
- Both commits (`fde5b81`, `7bde9b7`) staged files individually (no `git add -A`), matched their declared `files_modified` scope

## Next Phase Readiness
- The metas completion blocker (Teste 7/8 of 08-UAT) is closed at the code+schema level. A follow-up UAT re-run (manual conclusion + auto-conclusão-by-aporte + no-auto-reopen-on-balance-drop) is recommended before closing Phase 08, but is out of scope for this executor per its instructions (STATE.md/ROADMAP.md tracking only).
- `supabase/schema.sql` is now self-healing for any future replay against a pre-existing `goals` table — the same defensive-ALTER pattern should be applied proactively for any future column added inside a `create table if not exists` block.

---
*Phase: 08-metas-vision-board-redesign*
*Completed: 2026-07-03*

## Self-Check: PASSED

- FOUND: supabase/goals-completed-fix.sql
- FOUND: .planning/phases/08-metas-vision-board-redesign/08-08-SUMMARY.md
- FOUND: fde5b81 (Task 2 commit)
- FOUND: 7bde9b7 (Task 3 commit)
