---
phase: 08-metas-vision-board-redesign
plan: 04
subsystem: ui
tags: [react, babel-standalone, search, segmented-filter, goals]

# Dependency graph
requires:
  - phase: 08-metas-vision-board-redesign (plan 03)
    provides: normalizeGoal mapeando completed/completedAt no goal
provides:
  - Barra de controles .met-controls em MetasStudio (busca + filtro Todas/Ativas/Concluídas + Nova meta)
  - Filtro client-side do grid do Capítulo I por nome/descrição e por completed
  - Capítulo III "Já atingidas" populado com metas reais (completed=true)
affects: [08-05-vcard-hero, 08-06-cover-picker]

# Tech tracking
tech-stack:
  added: []
  patterns: ["reuso de .fds-tx-v2-search/.fds-seg-3 fora de fides-transacoes.jsx", "hooks locais declarados no bloco único antes do early return isEmpty"]

key-files:
  created: []
  modified:
    - assets/fides-metas.jsx
    - assets/fides-metas.css

key-decisions:
  - "search/statusFilter declarados junto dos demais useState de MetasStudio, antes do early return isEmpty (Rules of Hooks, precedente Phase 07)"
  - "Reuso literal de .fds-tx-v2-search e .fds-seg/.fds-seg-3 (chrome global) — CSS novo limitado a layout/espaçonamento (.met-controls*)"
  - "Capítulo III reutiliza CSS pré-existente e não usado (.met-done-list/.met-done-row/...) já presente em fides-metas.css"
  - "Grid vazio por busca sem match usa a mesma caixa .stu-card.met-done + .met-done-empty (reuso de padrão, não novo componente)"

patterns-established:
  - "Filtro client-side sobre computed: statusFilter deriva de m.completed (todas/ativas/concluidas), busca compara nome+descricao em lowercase"

requirements-completed: [UAT-3, UAT-7]

# Metrics
duration: 5min
completed: 2026-07-02
status: complete
---

# Phase 08 Plan 04: Barra de controles + Capítulo III vivo Summary

**Busca client-side + filtro segmentado Todas/Ativas/Concluídas (derivado de `completed`) na tela de Metas, com o Capítulo III "Já atingidas" agora listando metas concluídas reais em vez do texto vazio hardcoded.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-02T14:42:00-04:00
- **Completed:** 2026-07-02T14:45:13-04:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Barra `.met-controls` (busca `.fds-tx-v2-search` + segmentado `.fds-seg fds-seg-3` + botão "Nova meta") acima do Capítulo I, reusando chrome global sem reinventar CSS.
- Grid do Capítulo I filtrado por `statusFilter` (todas/ativas/concluidas, derivado de `m.completed`) e por `search` (nome/descrição, case-insensitive), com estado vazio dedicado quando a busca não retorna nada.
- Capítulo III "Já atingidas" renderiza lista real de metas `completed` (emoji, valor guardado, "Concluída em" via `completedAt`), mantendo a mensagem vazia apenas quando não há nenhuma concluída.

## Task Commits

Each task was committed atomically:

1. **Task 1: Estado local + barra de controles (busca + filtro segmentado + Nova meta)** - `09ade51` (feat)
2. **Task 2: Aplicar filtro client-side ao grid + popular Capítulo III por completed** - `f460682` (feat)

**Plan metadata:** (this commit, docs)

## Files Created/Modified
- `assets/fides-metas.jsx` - Novo state `search`/`statusFilter` no topo de `MetasStudio`; barra `.met-controls`; `metasFiltradas`/`metasConcluidas` derivadas de `computed`; grid do Capítulo I mapeia `metasFiltradas`; Capítulo III mapeia `metasConcluidas`.
- `assets/fides-metas.css` - Bloco `.met-controls*` (flex/gap/wrap responsivo, ≤640px empilha busca/segmentado/botão).

## Decisions Made
- `search`/`statusFilter` foram colocados no mesmo bloco de `useState` já existente em `MetasStudio` (junto de `emBreve`/`criarOpen`/etc.), preservando a ordem de hooks exigida pelo React antes do `if (isEmpty) return`.
- O CSS de Capítulo III (`.met-done-list`, `.met-done-row`, `.met-done-emoji`, `.met-done-name`, `.met-done-val`, `.met-done-date`, `.met-done-tag`) já existia em `fides-metas.css` sem uso no JSX (provavelmente preparado antecipadamente) — foi reaproveitado integralmente, sem alterar CSS.
- Adicionado `data-status-filter={statusFilter}` no wrapper `.met-controls` como hook de debug/e2e leve, sem impacto visual.

## Deviations from Plan

None - plan executado exatamente como escrito. Nenhum novo hook fora do bloco de topo; nenhuma coluna/enum de status nova (status deriva de `completed`); `.fds-seg`/`.fds-tx-v2-search` não foram redefinidos, apenas reusados.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 05 (vcard/hero redesign) e Plan 06 (seletor de capa) não foram tocados nesta plan, conforme `prohibitions` do plano.
- `statusFilter`/`search` ficam disponíveis para os próximos plans caso precisem coexistir com o novo vcard.
- Verificação manual em browser (digitar na busca, alternar segmentado, marcar meta como concluída via Plan 05 e ver refletido no Capítulo III) ainda pendente de UAT humano — sem ambiente de browser neste executor.

---
*Phase: 08-metas-vision-board-redesign*
*Completed: 2026-07-02*

## Self-Check: PASSED

- FOUND: assets/fides-metas.jsx
- FOUND: assets/fides-metas.css
- FOUND: .planning/phases/08-metas-vision-board-redesign/08-04-SUMMARY.md
- FOUND commit: 09ade51 (Task 1)
- FOUND commit: f460682 (Task 2)
