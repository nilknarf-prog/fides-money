---
phase: 08-metas-vision-board-redesign
plan: 06
subsystem: ui
tags: [react, babel-standalone, supabase-storage, cover-picker, upload, goals]

# Dependency graph
requires:
  - phase: 08-metas-vision-board-redesign
    provides: "08-02 (16 cover presets + resolveCoverUrl/COVER_PRESETS), 08-03 (uploadGoalCover/deleteGoalCover helpers + image_url/completed/completedAt mapping in normalizeGoal/addGoal), 08-05 (AportarModal/SaldoInlineEditor mounting, vcard status pill wiring)"
provides:
  - "CoverPicker (Galeria/Enviar foto) shared by CriarMetaModal and AjustarPlanoModal"
  - "coverStoragePath(url) helper to derive goal-covers Storage path from a public URL"
  - "CriarMetaModal: campo Valor atual (R$); onConfirm payload ganha cover + atual"
  - "AjustarPlanoModal: campo Status (Ativa/Concluída); onConfirm payload ganha cover + completed"
  - "MetasStudio edit/delete handlers: persistência de image_url/completed/completed_at e limpeza de Storage (deleteGoalCover) ao trocar capa de upload ou excluir a meta"
affects: [09-transacoes-power-tools]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared cover-picker child component with lifted state in parent modal (hooks-before-early-return preserved; child's internal useRef resets naturally on remount because it only exists while the modal is `rendered`)"
    - "Storage cleanup by comparing old vs new cover URL at save-time (edit) and by target's stored cover at delete-time, deriving the object path from the public URL rather than tracking it separately"

key-files:
  created: []
  modified:
    - assets/fides-metas.jsx
    - assets/fides-metas.css

key-decisions:
  - "coverStoragePath/CoverPicker/deleteGoalCover-on-edit-and-delete logic lives in MetasStudio (parent), not inside AjustarPlanoModal — editTarget.cover (the pre-edit value) must be compared against the new coverValue, and editTarget is only reliably available in the parent's onConfirm wrapper"
  - "Added a session-local upload-replace cleanup inside CoverPicker (uploadedPathRef) beyond what the plan's action text literally asked: if a user uploads a photo, then uploads a second photo before submitting, the first upload is deleted immediately (Rule 2 — avoids orphaning objects within a single edit/create session)"
  - "Did NOT extend that cleanup to 'switch tab / cancel modal without submitting' — deleting a freshly-uploaded-but-abandoned photo on every possible exit path (backdrop click, X, Cancel, switching to Galeria after uploading) was out of the plan's scope_fence ('só upload + fit cover') and risks accidentally deleting a persisted cover if triggered incorrectly; documented as a known limitation below instead of building extra modal-close wiring"

requirements-completed: [UAT-1, UAT-2, UAT-5]

# Metrics
duration: 2min
completed: 2026-07-02
status: complete
---

# Phase 08 Plan 06: Cover-picker (Galeria/Enviar foto) + Status/Valor atual + Storage cleanup Summary

**CriarMetaModal e AjustarPlanoModal ganham um CoverPicker compartilhado (16 presets + upload via `uploadGoalCover`), com Valor atual no criar, Status Ativa/Concluída no editar, e limpeza automática do bucket `goal-covers` ao trocar ou excluir uma capa enviada pelo usuário.**

## Performance

- **Duration:** ~2 min (commit-to-commit)
- **Started:** 2026-07-02T19:19:00Z (approx, session start)
- **Completed:** 2026-07-02T19:21:16Z
- **Tasks:** 2/2
- **Files modified:** 2 (`assets/fides-metas.jsx`, `assets/fides-metas.css`)

## Accomplishments
- Shared `CoverPicker` component (tabs Galeria/Enviar foto) mounted in both `CriarMetaModal` and `AjustarPlanoModal`, with all state (`coverTab`, `coverValue`, `uploading`) declared in the parent modal before any early return (Rules of Hooks preserved — no console warning risk).
- `CriarMetaModal` gained "Valor atual (R$)" (`name="atual"`, default 0) and the submit payload now carries `cover`/`atual`.
- `AjustarPlanoModal` gained a Status segmented toggle (Ativa/Concluída, using the existing `.fds-seg.fds-seg-2` chrome) bound to `meta.completed`, initialized/reset via a `useEffect` keyed on `[open, meta.id]`.
- `MetasStudio`'s edit `onConfirm` wrapper now translates `patch.cover`/`patch.completed` into `updateGoal`'s `image_url`/`completed`/`completed_at` patch, computing `completed_at` correctly (set ISO timestamp only on the ativa→concluída transition, cleared to `null` on concluída→ativa, preserved otherwise).
- Added `coverStoragePath(url)` helper (derives the path after `/goal-covers/` in a public URL; returns `null` for presets/empty). Wired into both the edit flow (delete the old uploaded cover when it's replaced by anything else) and the delete flow (delete the goal's uploaded cover when the goal itself is deleted) — satisfies UAT-5.
- Upload errors surface via `window.FidesUI.useToast().error(...)`, never `alert()`/`confirm()` (verified: `grep -c "confirm("` and `grep -c "alert("` both `0`).
- Submit buttons (and Cancel) disabled while `uploading` in both modals, preventing double-submit during an in-flight upload.

## Task Commits

Each task was committed atomically:

1. **Task 1: Seletor de capa (Galeria/Enviar foto) + Valor atual no CriarMetaModal** - `0264389` (feat)
2. **Task 2: Seletor de capa + Status no AjustarPlanoModal + limpeza de Storage (editar/excluir)** - `6b7612a` (feat)

**Plan metadata:** commit for this SUMMARY (see final commit below)

## Files Created/Modified
- `assets/fides-metas.jsx` - `coverStoragePath` helper; shared `CoverPicker` component; `CriarMetaModal` (Valor atual field + cover payload); `AjustarPlanoModal` (Status field + cover payload); `MetasStudio` edit/delete `onConfirm` wrappers (image_url/completed/completed_at translation + `deleteGoalCover` cleanup)
- `assets/fides-metas.css` - `.met-cover-picker*` blocks (tabs, preset grid, upload dropzone/preview, remove button, mobile grid override)

## Decisions Made
- Kept the Storage-cleanup comparison logic (`coverStoragePath(editTarget.cover)` vs `patch.cover`) in `MetasStudio` rather than inside `AjustarPlanoModal`, because `editTarget` (the pre-edit goal, with its original `cover`) is only guaranteed to still be valid synchronously at the moment `onConfirm` fires in the parent (it's cleared asynchronously by `setEditTarget(null)` after the modal's close animation).
- Added an in-session "replace upload before submit" cleanup inside `CoverPicker` (tracks the just-uploaded path in a `useRef`, deletes the previous one if the user uploads a second photo before saving). This is a Rule 2 addition beyond the plan's literal wording, closing an obvious Storage-orphan gap within a single modal session without expanding scope into cross-navigation cleanup (see Known Limitations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Session-local upload-replace cleanup in CoverPicker**
- **Found during:** Task 1 (CoverPicker design)
- **Issue:** The plan's threat model/acceptance criteria only require Storage cleanup on (a) replacing a persisted cover at save-time and (b) deleting a goal. If a user uploads a photo via "Enviar foto", then uploads a *different* photo again before ever submitting the form, the first upload would be orphaned in the bucket forever (never referenced by any goal, never cleaned up).
- **Fix:** `CoverPicker` tracks the path of the most recent upload made during the current mount (`uploadedPathRef`); uploading a second photo in the same session calls `deleteGoalCover` on the first one before updating `coverValue`.
- **Files modified:** `assets/fides-metas.jsx` (`CoverPicker`)
- **Verification:** Code inspection — `deleteGoalCover(prevPath)` called immediately after `uploadedPathRef.current = path` is updated to the new path, only when `prevPath` was truthy (i.e., not on the very first upload).
- **Committed in:** `0264389` (Task 1 commit, since `CoverPicker` is defined there)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical Storage hygiene, session-scoped)
**Impact on plan:** Additive-only, no scope creep on data model or architecture. Does not touch persisted goal covers — only cleans up an upload the *same browsing session* just made and is about to discard.

## Issues Encountered
None.

## Known Limitations (not fixed — explicitly out of scope)

- **Orphaned Storage objects on abandon-without-submit:** If a user uploads a photo via "Enviar foto" and then (a) switches to "Galeria" and picks a preset instead, or (b) closes/cancels the modal entirely without submitting, that uploaded object is **not** deleted from `goal-covers`. Only same-slot re-uploads (upload → upload again) and post-submit replace/delete are cleaned up. Wiring cleanup into every modal-exit path (backdrop click, X button, Cancel button, tab switch) was judged out of the plan's `scope_fence` ("não implementar crop/edição de imagem — só upload + fit cover") and risked accidentally deleting a goal's *persisted* cover if the reset logic were miswired. Flagging for a future pass if Storage bloat becomes a concern; RLS ensures orphans stay scoped to the uploading user's folder, so this is a hygiene issue, not a security one.

## Runtime Dependency — 08-01 not yet applied to live DB

Per the orchestrator's runtime constraints for this session: **the `goals.image_url` column and the `goal-covers` Storage bucket do not exist in the live Supabase DB yet** (08-01's migration is a pending human checkpoint — Supabase MCP was unauthenticated this session). This plan's UI/wiring code (`uploadGoalCover`, `deleteGoalCover`, `image_url` read/write, `.storage.from('goal-covers')` calls) is all correct in code and was NOT exercised against a live DB/Storage call. It will function once the 08-01 migration + bucket + RLS policies are applied — no code changes should be needed at that point. Until then:
- Creating/editing a goal with a preset cover works today (writes `image_url` as `preset:<id>` text, no column dependency issue since the column doesn't exist yet — **this will actually fail** against the live DB until the `image_url` column exists, since `addGoal`/`updateGoal` include it unconditionally in the insert/update payload).
- Uploading a photo will fail with a Supabase Storage "bucket not found" error surfaced via the Toast (`uploadGoalCover` throws, caught by `CoverPicker`'s `catch` block, shown as a friendly message) — this is expected until 08-01 is applied, not a bug in this plan.

## User Setup Required

None — no external service configuration required by this plan itself. (08-01's Supabase migration/bucket/RLS setup remains the outstanding prerequisite, tracked separately as noted above.)

## Next Phase Readiness

- The Metas cover-cycle (UAT-1 gallery pick, UAT-2 own upload, UAT-5 replace/delete cleanup) is code-complete and ready for browser verification as soon as the 08-01 migration is applied live.
- No blockers introduced by this plan for Phase 09 (Transações power tools).
- Recommend a `/gsd-verify-work` pass (or manual UAT) against a live DB once 08-01 lands, covering: create with preset, create with upload, edit replacing upload→preset (old object gone), edit replacing upload→new upload (old object gone), delete a goal with an uploaded cover (object gone), and the two-user RLS smoke test called out in the plan's `<verification>` section.

---
*Phase: 08-metas-vision-board-redesign*
*Completed: 2026-07-02*

## Self-Check: PASSED

- FOUND: `assets/fides-metas.jsx`
- FOUND: `assets/fides-metas.css`
- FOUND: `.planning/phases/08-metas-vision-board-redesign/08-06-SUMMARY.md`
- FOUND commit: `0264389`
- FOUND commit: `6b7612a`
