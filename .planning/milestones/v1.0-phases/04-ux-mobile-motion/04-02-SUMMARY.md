---
phase: 04-ux-mobile-motion
plan: "02"
subsystem: ui-motion
tags: [motion, modal, react, hook, animation, reduced-motion]

requires:
  - phase: 04-ux-mobile-motion (plan 01)
    provides: "window.FidesUI.useModalClose hook + is-closing CSS keyframes"
provides:
  - "NovaTransacaoModal (fides-transacoes.jsx) wired to useModalClose"
  - "CategoriaModal (fides-store.jsx) wired to useModalClose"
  - "ConfirmDeleteModal de contas (fides-contas.jsx) wired to useModalClose"
affects: [motion-02, future-modal-migrations]

tech-stack:
  added: []
  patterns:
    - "requestClose replaces onClose/onCancel in all dismiss handlers of a modal (backdrop click, X button, footer close/cancel button)"
    - "Confirm/destructive actions call the data mutation callback first, then requestClose(), so the exit animates instead of an abrupt unmount"
    - "Render gate moved from `if (!open) return null` to `if (!rendered) return null`; is-closing class conditionally appended to backdrop and modal root classNames"

key-files:
  created: []
  modified:
    - assets/fides-transacoes.jsx
    - assets/fides-store.jsx
    - assets/fides-contas.jsx

key-decisions:
  - "CategoriaModal footer 'Fechar' button (line 1581) was still calling onClose directly in the uncommitted in-progress diff — completed by routing it through requestClose so all 3 dismiss paths (backdrop, X, Fechar) animate consistently"
  - "ConfirmDeleteModal Excluir button now calls onConfirm() then requestClose() via a local handleConfirm wrapper — delete mutation logic untouched, only the close orchestration changed"
  - "TxAdvFiltersModal (fides-transacoes.jsx:46) and PagarFaturaModal/editConta/editCartao/addModal (fides-contas.jsx) intentionally left untouched — out of scope for this plan"

requirements-completed: [MOTION-01]

duration: "~15min (continuation session)"
completed: 2026-06-30
status: complete
---

# Phase 04 Plan 02: Modal Exit Motion Wiring Summary

**3 modais (NovaTransacao, Categoria, ConfirmDelete de contas) migrados de `onClose` direto para `useModalClose`, com saída animada real, cancelamento de race no re-open, e travamento de clique durante o fade-out.**

## Performance

- **Duration:** ~15 min (continuation — Task 1 was already committed by a prior session)
- **Tasks:** 3/3 completed
- **Files modified:** 3

## Accomplishments
- NovaTransacaoModal (fides-transacoes.jsx): já wired em sessão anterior (commit `7176f0c`), verificado e confirmado íntegro nesta sessão.
- CategoriaModal (fides-store.jsx): completado o wiring parcial encontrado no working tree — footer "Fechar" agora usa `requestClose` (faltava nesse handler).
- ConfirmDeleteModal (fides-contas.jsx): implementado do zero — `useModalClose(open, onCancel)`, gate por `rendered`, classe `is-closing`, e `handleConfirm` que chama `onConfirm()` seguido de `requestClose()` para a saída do delete também animar.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire NovaTransacaoModal (fides-transacoes.jsx)** - `7176f0c` (feat) — completed in prior session, verified intact this session.
2. **Task 2: Wire CategoriaModal (fides-store.jsx)** - `793cd1d` (feat) — completed the in-progress uncommitted diff (footer Fechar button was missed).
3. **Task 3: Wire ConfirmDeleteModal de contas (fides-contas.jsx)** - `c77c4b7` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `assets/fides-transacoes.jsx` - NovaTransacaoModal: `useModalClose`, `rendered` gate, `is-closing` classes, `requestClose` on backdrop/X/save-close path (prior session)
- `assets/fides-store.jsx` - CategoriaModal: `useModalClose`, `rendered` gate, `is-closing` classes, `requestClose` on backdrop/X/footer Fechar
- `assets/fides-contas.jsx` - ConfirmDeleteModal: `useModalClose(open, onCancel)`, `rendered` gate, `is-closing` classes, `requestClose` on backdrop/X/Cancelar, `handleConfirm` wrapper on Excluir

## Decisions Made
- Footer "Fechar" button in CategoriaModal was still calling `onClose` in the uncommitted working-tree diff inherited from the interrupted session — treated as an incomplete Task 2, not a deviation, and finished per plan (all dismiss paths must route through `requestClose`).
- ConfirmDeleteModal's Excluir button needed a small wrapper (`handleConfirm`) to call `onConfirm()` then `requestClose()` — this was explicitly specified in the plan's Task 3 action text, not a new architectural decision.

## Deviations from Plan

None - plan executed exactly as written. The only "gap" found (CategoriaModal footer close button) was part of finishing the plan's own Task 2 acceptance criteria (all close handlers route through `requestClose`), not an out-of-plan fix.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- MOTION-01 fully implemented across the 3 in-scope modais.
- Boundary respected: TxAdvFiltersModal (fides-transacoes.jsx) and PagarFaturaModal/editConta/editCartao/addModal (fides-contas.jsx) remain on the old `open`/`onClose` pattern — candidates for a future motion phase if desired.
- Manual verification recommended at 400×512 iOS Safari per plan's observable acceptance criteria (fade-out + slide-down on close, clean re-open, instant close under prefers-reduced-motion) — not automated in this text-only environment.

---
*Phase: 04-ux-mobile-motion*
*Completed: 2026-06-30*

## Self-Check: PASSED

- `.planning/phases/04-ux-mobile-motion/04-02-SUMMARY.md` created: FOUND
- Commit `7176f0c` (Task 1, NovaTransacaoModal): FOUND
- Commit `793cd1d` (Task 2, CategoriaModal): FOUND
- Commit `c77c4b7` (Task 3, ConfirmDeleteModal): FOUND
