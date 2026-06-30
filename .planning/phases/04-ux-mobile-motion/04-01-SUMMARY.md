---
phase: 04-ux-mobile-motion
plan: "01"
subsystem: ui-motion
status: complete
tags: [motion, modal, hook, css, animation, reduced-motion]
dependency_graph:
  requires: []
  provides:
    - "window.FidesUI.useModalClose (hook)"
    - "fds-fadeOut / fds-slideDown keyframes"
    - ".is-closing CSS rules"
    - "prefers-reduced-motion gate"
  affects:
    - assets/fides-ui.jsx
    - assets/fides.css
tech_stack:
  added: []
  patterns:
    - "Deferred unmount via setTimeout (CLOSE_MS=180ms)"
    - "Race-condition cancel via clearTimeout on re-open"
    - "prefers-reduced-motion runtime detection (window.matchMedia)"
    - "GPU hint via will-change: transform, opacity"
    - "animation-fill-mode: forwards on exit keyframes"
key_files:
  created: []
  modified:
    - assets/fides-ui.jsx
    - assets/fides.css
decisions:
  - "CLOSE_MS=180ms alinhado com duração CSS 0.18s (hook e CSS são consistentes)"
  - "will-change aplicado em .fds-modal e .fds-modal.is-closing para GPU hint"
  - "Nenhum modal alterado nesta plan — isolamento para Wave 2"
metrics:
  duration: "~8 min"
  completed: "2026-06-30T14:40:20Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 04 Plan 01: Modal Exit Motion Foundation Summary

Hook `useModalClose(open, onClose)` com deferred unmount de 180ms e keyframes CSS de saída (`fds-fadeOut` / `fds-slideDown`) + gate `prefers-reduced-motion` — fundação que a Wave 2 conecta nos 3 modais.

## What Was Built

### Task 1 — Hook `useModalClose` em `assets/fides-ui.jsx`

- Adicionada a função `useModalClose(open, onClose)` dentro do IIFE existente, seguindo o padrão `var`/funções nomeadas dos hooks `useToast`/`useConfirm`.
- Retorna `{ rendered, closing, requestClose }` via `React.useState` + `React.useRef` + `React.useCallback`.
- `requestClose`: detecta `prefers-reduced-motion` via `window.matchMedia` com guard — se reduzido, desmonta imediatamente sem setar `closing`; caso contrário seta `closing=true` e agenda unmount via `setTimeout(CLOSE_MS)` (180ms).
- `useEffect([open])`: quando `open→true`, limpa `timerRef.current` (cancela race de re-open), seta `closing=false` e `rendered=true`. Cleanup: `clearTimeout(timerRef.current)`.
- Exposto em `window.FidesUI.useModalClose`.
- Commit: `72a94b2`

### Task 2 — Keyframes + regras `.is-closing` em `assets/fides.css`

- `@keyframes fds-fadeOut`: `opacity 1→0` (espelho de `fds-fadeIn`).
- `@keyframes fds-slideDown`: `translateY(0)→translateY(12px) + opacity 1→0` (espelho invertido de `fds-slideUp`).
- `.fds-modal-backdrop.is-closing`: `animation: fds-fadeOut 0.18s ease forwards`.
- `.fds-modal.is-closing`: `animation: fds-slideDown 0.18s cubic-bezier(.2,.7,.2,1) forwards; pointer-events: none` (D-04 — bloqueia clique acidental durante saída).
- `will-change: transform, opacity` em `.fds-modal` e `.fds-modal.is-closing` (GPU hint / MOTION-PERF).
- `@media (prefers-reduced-motion: reduce)` zerando `animation: none !important` para todos os seletores de entrada e saída do modal.
- Commit: `8f0efaa`

## Verification

- `useModalClose` existe e exportado: PASS
- `rendered`, `closing`, `requestClose` no retorno do hook: PASS
- `matchMedia` + `prefers-reduced-motion` no hook: PASS
- `setTimeout` + `clearTimeout` presentes: PASS
- Nenhuma referência a `addTransaction`, `pay_card_invoice`, `useFides`, `fidesDb`, `api/` no hook (T-04-01): PASS
- `@keyframes fds-fadeOut` e `@keyframes fds-slideDown` no CSS: PASS
- `.fds-modal-backdrop.is-closing` e `.fds-modal.is-closing` com regras: PASS
- `pointer-events: none` em `.fds-modal.is-closing`: PASS
- `will-change: transform, opacity` GPU hint: PASS
- `@media (prefers-reduced-motion: reduce)` gate CSS: PASS
- Todas as durações de animação ≤ 300ms (entrada 0.2/0.25s, saída 0.18s): PASS
- Nenhum modal alterado (isolamento para Wave 2): PASS

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced.
Hook is render-timing only (confirmed by prohibition check in verification).

## Known Stubs

None. Esta plan não entrega UI visível — produz fundação para Wave 2.

## Self-Check: PASSED

- `assets/fides-ui.jsx` modified and committed: `72a94b2` FOUND
- `assets/fides.css` modified and committed: `8f0efaa` FOUND
- `function useModalClose` in fides-ui.jsx: FOUND (line 238)
- `useModalClose:` in window.FidesUI export: FOUND (line 292)
- `@keyframes fds-fadeOut` in fides.css: FOUND (line 1023)
- `@keyframes fds-slideDown` in fides.css: FOUND (line 1024)
- `.is-closing` rules in fides.css: FOUND (lines 1026, 1032, 1042, 1043)
