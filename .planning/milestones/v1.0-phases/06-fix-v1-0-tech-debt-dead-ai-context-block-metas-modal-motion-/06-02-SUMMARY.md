---
phase: 06-fix-v1-0-tech-debt-dead-ai-context-block-metas-modal-motion-
plan: 02
subsystem: ui
tags: [react, jsx, motion, useModalClose, fides-metas]

# Dependency graph
requires:
  - phase: 04-ux-mobile-motion
    provides: "hook window.FidesUI.useModalClose (rendered/closing/requestClose) e keyframes de saída fds-fadeOut/fds-slideDown + gate prefers-reduced-motion em fides.css"
provides:
  - "Os 8 modais fds-modal-backdrop de fides-metas.jsx (SimularPanel, RevisarPanel, AplicarPanel, EmBreveModal, AportarModal, AjustarPlanoModal, MetConfirmDeleteModal, ConfigurarModal) consumindo useModalClose com saída animada consistente"
affects: [metas, ux-motion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Painéis condicionalmente montados via {cond && <X/>} migram para mount sempre + prop open, com o gate de existência controlado internamente por useModalClose(open, onClose) → if (!rendered) return null"
    - "Ações de confirmação de dados (onConfirm/onSubmit) mantêm o payload intacto e passam a chamar requestClose() logo em seguida para animar a saída no confirmar"

key-files:
  created: []
  modified:
    - assets/fides-metas.jsx

key-decisions:
  - "Overlay inline 'Em breve' extraído para componente EmBreveModal para poder consumir o hook (não era trivial aplicar useModalClose em JSX condicional inline)"
  - "Os 4 modais placeholder (AportarModal, AjustarPlanoModal, MetConfirmDeleteModal, ConfigurarModal) recebem o wiring completo mas seguem sem mount site — Metas continua read-only"

patterns-established:
  - "Pattern de wiring de fechamento animado replicado da fase 04: is-closing condicional no backdrop e no .fds-modal, handlers de fechar via requestClose, ações de dados via onConfirm()+requestClose()"

requirements-completed: [DEBT-02]

# Metrics
duration: ~10min
completed: 2026-06-30
status: complete
---

# Phase 06 Plan 02: Motion dos modais de Metas Summary

**Todos os 8 modais `fds-modal-backdrop` de `fides-metas.jsx` agora fecham com fade-out + slide-down via `window.FidesUI.useModalClose`, replicando exatamente o padrão da fase 04 — fechando WARN-3/DEBT-02 do audit v1.0.**

## Performance

- **Duration:** ~10min
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Os 4 painéis realmente montados na tela (SimularPanel, RevisarPanel, AplicarPanel e o novo componente EmBreveModal) passaram a montar sempre via prop `open`, permitindo a saída animar antes do unmount
- Os 4 modais placeholder (AportarModal, AjustarPlanoModal, MetConfirmDeleteModal, ConfigurarModal) receberam o mesmo wiring por consistência (D-04), sem ganhar mount site novo — Metas permanece read-only
- Nenhum CSS de animação novo: reaproveitados os keyframes `fds-fadeOut`/`fds-slideDown` e o gate `prefers-reduced-motion` já existentes em `fides.css:1022-1044`

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire os 4 painéis montados (SimularPanel, RevisarPanel, AplicarPanel, overlay Em breve)** - `307366d` (feat)
2. **Task 2: Wire os 4 modais definidos-mas-não-montados (AportarModal, AjustarPlanoModal, MetConfirmDeleteModal, ConfigurarModal)** - `3f48207` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `assets/fides-metas.jsx` - Todos os 8 `fds-modal-backdrop` (SimularPanel, RevisarPanel, AplicarPanel, EmBreveModal extraído do overlay inline, AportarModal, AjustarPlanoModal, MetConfirmDeleteModal, ConfigurarModal) consomem `useModalClose`, renderizam por `rendered`, aplicam `is-closing` e fecham via `requestClose`

## Decisions Made
- Extraído o overlay inline "Em breve" em um componente `EmBreveModal({ open, onClose })` para poder aplicar o hook (JSX condicional inline não permitia usar hooks diretamente sem extração)
- Os 3 painéis + EmBreveModal passaram de mount condicional pelo pai (`{cond && <X/>}`) para mount sempre + prop `open`, controlando existência via `rendered` interno — necessário porque CSS puro não anima um nó já removido pelo React
- Nos 4 modais placeholder, ações de dados (`onConfirm(v)`, `onSubmit`, `onConfirm(dist)`, "Excluir") mantiveram lógica/payload 100% intactos; apenas `requestClose()` foi adicionado em sequência para orquestrar o fechar animado
- `MetConfirmDeleteModal` já tinha prop `open`; o hook foi conectado passando `onCancel` como callback de fechar (não `onClose`), replicando o padrão do `ConfirmDeleteModal` de contas na fase 04-02

## Deviations from Plan

None - plan executado exatamente como escrito. A extração do `EmBreveModal` já estava prevista no próprio plano como "Claude's Discretion" para o overlay inline.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness

- WARN-3/DEBT-02 do `v1.0-MILESTONE-AUDIT.md` está fechada: os 8 modais de Metas têm motion de saída consistente com o restante do app
- Verificação por grep confirmada: `useModalClose` = 8, `is-closing` = 16, `requestClose` = 37, `@keyframes` = 0 no JSX, nenhum mount site novo para os 4 placeholders, nenhum gate `if (!open) return null` remanescente no `MetConfirmDeleteModal`
- Verificação visual manual (400×512 iOS Safari) recomendada antes do ship v1.0, mas fora do escopo de automação deste plano (fase é autonomous, sem checkpoint de human-verify)
- Fase 06 (Fix v1.0 tech debt) agora tem os 4 warnings do audit endereçadas (06-01: DEBT-01/03/04; 06-02: DEBT-02)

---
*Phase: 06-fix-v1-0-tech-debt-dead-ai-context-block-metas-modal-motion-*
*Completed: 2026-06-30*

## Self-Check: PASSED

- FOUND: assets/fides-metas.jsx
- FOUND: .planning/phases/06-fix-v1-0-tech-debt-dead-ai-context-block-metas-modal-motion-/06-02-SUMMARY.md
- FOUND commit: 307366d
- FOUND commit: 3f48207
