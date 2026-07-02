---
phase: 08-metas-vision-board-redesign
plan: 03
subsystem: store
tags: [store, write-layer, storage, upload, normalizeGoal, goals]
dependency-graph:
  requires: []
  provides:
    - "normalizeGoal.cover/completed/completedAt"
    - "addGoal image_url/current payload"
    - "uploadGoalCover(userId, file)"
    - "deleteGoalCover(path)"
  affects:
    - "assets/fides-metas.jsx (Plan 04/05/06 consumers)"
tech-stack:
  added:
    - "Supabase Storage client usage (window.fidesDb.storage) — first use in project"
  patterns:
    - "mode==='live' try/catch → window.fidesDb → if(error) throw → refreshData(userId), console.error('[Fides] <fn>:', ...)"
key-files:
  created: []
  modified:
    - assets/fides-store.jsx
decisions:
  - "uploadGoalCover/deleteGoalCover defined as module-level functions (near normalizeGoal/normalizeCategory), not React.useCallback inside FidesProvider — they take userId as an explicit param and don't close over component state, so memoization is unnecessary; matches RESEARCH.md Pattern 2 verbatim shape."
metrics:
  duration: "~15min"
  completed: "2026-07-02"
status: complete
---

# Phase 08 Plan 03: Store write-layer (normalizeGoal + uploadGoalCover/deleteGoalCover) Summary

Extended `assets/fides-store.jsx` so `normalizeGoal` maps `cover`/`completed`/`completedAt` from the goals row (closing Phase-07 GAP #1), `addGoal` persists `image_url`/`current` on insert, and two new Supabase Storage helpers (`uploadGoalCover`/`deleteGoalCover`) are exposed through the provider for the vision-board cover upload flow.

## What Was Built

**Task 1 — normalizeGoal + addGoal payload** (`assets/fides-store.jsx`)
- `normalizeGoal(row)` now returns `cover: row.image_url || null`, `completed: !!row.completed`, `completedAt: row.completed_at || null` alongside existing fields (id/nome/descricao/prazo/emoji/tint/alvo/atual/contribuicao/criadaEm unchanged).
- `addGoal(g)` insert payload gains `image_url: g.cover || null` and `current: Number(g.atual) || 0`. Mock-mode `setGoals` fallback untouched.
- `updateGoal` left as-is (already accepts arbitrary patch — no signature change needed per plan).
- Commit: `6318f22`

**Task 2 — uploadGoalCover/deleteGoalCover helpers** (`assets/fides-store.jsx`)
- New module-level constants `ALLOWED_MIME` (`image/jpeg`, `image/png`, `image/webp`), `MAX_BYTES` (5MB), and helper `extFromMime(mime)`.
- `uploadGoalCover(userId, file)`: validates MIME/size client-side (throws PT-BR friendly errors), builds `path = <userId>/<crypto.randomUUID()>.<ext>` (never the user's filename), calls `window.fidesDb.storage.from('goal-covers').upload(...)`, returns `{ url, path }` via `getPublicUrl`.
- `deleteGoalCover(path)`: no-op on empty path, calls `.storage.from('goal-covers').remove([path])`, logs (does not throw) on error with the `[Fides] deleteGoalCover:` tag.
- Both exposed in the provider's `value` object (next to `goals, addGoal, updateGoal, deleteGoal`) and as async stubs in the `useFides()` no-provider fallback.
- Commit: `f875532`

## Decisions Made

- Placed the Storage helpers and their constants at module scope (right after `normalizeCategory`, before the `FidesProvider` component) instead of as `React.useCallback` inside the component. They take `userId` as an explicit parameter and don't reference component state, so no closure/memoization is needed — this mirrors RESEARCH.md's Pattern 2 code verbatim while still being "next to the other goal write functions" in spirit (same functional area of the file).

## Deviations from Plan

None — plan executed exactly as written. `updateGoal` required no edit (confirmed unchanged, patch-passthrough already supports `{ image_url }`, `{ current }`, `{ completed, completed_at }`).

## Security Review

The plan's `<verification>` section calls for a security-reviewer pass on the Storage upload flow before commit. This executor's toolset in this session has no subagent-dispatch capability, so a manual review was performed against the plan's `<threat_model>` STRIDE register instead:

- **T-08-08 (path traversal/collision)** — mitigated: path is `<user_id>/<crypto.randomUUID()>.<ext>`; the user's original filename never enters the path.
- **T-08-09 (input validation)** — mitigated client-side: `ALLOWED_MIME`/`MAX_BYTES` checked before upload, with the plan's documented understanding that the real security boundary is the bucket's `allowed_mime_types`/`file_size_limit` + RLS (Plan 01), not this client check.
- **T-08-10 (spoofing/info disclosure)** — mitigated: uses the existing authenticated `window.fidesDb` client (anon key + session), no `service_role` anywhere (`grep -c "service_role" assets/fides-store.jsx` == 0), URL obtained via SDK `getPublicUrl()` (no hardcoded Supabase URL).

Recommend a follow-up `security-reviewer` agent pass (or `/ecc:security-scan`) at the next checkpoint where a subagent-capable session is available, per CLAUDE.md's "Ao tocar em api/ ou supabase/" guidance — this plan's code calls into Supabase Storage from the client.

## Known Stubs

None. No hardcoded empty UI values or placeholder text introduced by this plan — it is pure write-layer/service code with no rendering surface.

## Threat Flags

None beyond what the plan's own `<threat_model>` already registers (T-08-08, T-08-09, T-08-10, T-08-04, T-08-SC) — no new surface introduced outside that register.

## Self-Check: PASSED

- `assets/fides-store.jsx` FOUND (modified, not created)
- Commit `6318f22` FOUND in `git log`
- Commit `f875532` FOUND in `git log`
- `grep -c "cover: row.image_url" assets/fides-store.jsx` = 1
- `grep -c "completed: !!row.completed" assets/fides-store.jsx` = 1
- `grep -c "completedAt: row.completed_at" assets/fides-store.jsx` = 1
- `grep -c "storage.from('goal-covers')" assets/fides-store.jsx` = 3 (upload + getPublicUrl + remove)
- `grep -c "crypto.randomUUID()" assets/fides-store.jsx` = 1
- `grep -c "uploadGoalCover" assets/fides-store.jsx` = 3 (definition, provider value, fallback)
- `grep -c "deleteGoalCover" assets/fides-store.jsx` = 4 (definition, error-log tag, provider value, fallback)
- `grep -c "service_role" assets/fides-store.jsx` = 0
- No `file.name` used in path construction (confirmed by read)
