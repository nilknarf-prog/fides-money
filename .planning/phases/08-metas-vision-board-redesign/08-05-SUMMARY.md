---
phase: 08-metas-vision-board-redesign
plan: 05
subsystem: ui
tags: [react, babel-standalone, css, hero, vcard, cover-resolver, aportar-modal, rules-of-hooks]

# Dependency graph
requires:
  - phase: 08-metas-vision-board-redesign (plan 02)
    provides: 16 SVG covers em assets/covers/<id>.svg
  - phase: 08-metas-vision-board-redesign (plan 03)
    provides: normalizeGoal mapeando cover/completed/completedAt; updateGoal(id, patch) genérico
  - phase: 08-metas-vision-board-redesign (plan 04)
    provides: barra de controles (busca/filtro status) + Capítulo III populado + metasFiltradas
provides:
  - "met-hero: identidade visual própria do hero de Metas (D3), hero da home intocado"
  - "vcard: card de meta redesenhado (capa/scrim/overlay/corpo/ações hover) substituindo met-card"
  - "COVER_PRESETS + resolveCoverUrl: resolução de preset:<id> vs URL de Storage vs fallback tint"
  - "AportarModal montado e funcional (fecha GAP Phase-07 #2)"
  - "SaldoInlineEditor: quick 'Atualizar saldo' inline sem reload (D6)"
  - "Marcar como concluída ligado a updateGoal (D5)"
affects: [08-06-modal-cover-picker, ui-review, uat-metas]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "resolveCoverUrl(cover): null → null; preset:<id> → COVER_PRESETS[id]; senão → URL direta (Storage)"
    - "Sub-componente com hooks-antes-de-early-return (SaldoInlineEditor) para toggle inline sem tocar estado do pai"
    - "Overrides de mobile em fides-responsive.css devem acompanhar renomeações de classe feitas em fides-metas.jsx/css (lição desta plan)"

key-files:
  created: []
  modified:
    - assets/fides-metas.jsx
    - assets/fides-metas.css
    - assets/fides-responsive.css

key-decisions:
  - "Backdrop do met-hero implementado como colagem mask-image de 4 SVGs de capa reais (não decorativo genérico), rotacionado e com baixa opacidade — visualmente distinto do glow radial do stu-hero da home"
  - "vcard reaproveita as classes .met-card-amounts/-bar*/-stats/.met-stat* já existentes (não duplicadas) — só capa/scrim/overlay/ações ganharam classes novas (.vcard-*)"
  - "Corpo do vcard mostra sempre 2 stats (não 3): Aporte mensal/Chega em para metas ativas, Guardado/Concluída em para metas completed — .met-card-stats mudou de 3 para 2 colunas"
  - "Ações (Aportar/Ajustar plano/Atualizar saldo) reveladas no hover via opacity+transform; fallback sempre visível em @media (hover: none) para touch/mobile"
  - "Dots-menu (editar/concluir/excluir) mantido sempre visível no canto da capa — não fica atrás do hover, garante acessibilidade tap-first"

requirements-completed: [UAT-4, UAT-6, UAT-7]

# Metrics
duration: ~35min
completed: 2026-07-02
status: complete
---

# Phase 08 Plan 05: Vision-board vcard + met-hero + Aportar/Atualizar saldo/Concluir Summary

**Hero de Metas com identidade própria (met-hero, backdrop de colagem das capas) e cards redesenhados em vcard (capa/scrim/overlay/corpo) via resolveCoverUrl; AportarModal (antes dead code) e a ação "Atualizar saldo" inline agora escrevem de verdade via updateGoal, fechando o GAP Phase-07 #2.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-02
- **Tasks:** 3/3
- **Files modified:** 3 (`assets/fides-metas.jsx`, `assets/fides-metas.css`, `assets/fides-responsive.css`)

## Accomplishments
- Hero de Metas renomeado para `met-hero` com bloco CSS próprio (backdrop de colagem mask-image das capas), sem tocar `fides-studio.css` — hero de Dashboard/Contas permanece intacto
- Card de meta reconstruído como `vcard`: capa 186px (preset SVG ou URL de Storage via `resolveCoverUrl`, com scrim gradiente para legibilidade; fallback gradiente no tint quando sem capa), overlay com pill Ativa/Concluída + chip emoji + nome + descrição, corpo com valor/barra/2-stats
- `COVER_PRESETS` (16 ids → `assets/covers/<id>.svg`) + `resolveCoverUrl` implementados e usados no render — nunca `dangerouslySetInnerHTML`
- `AportarModal` (dead code desde a Phase 07) agora montado; botão "Aportar" abre o modal com preview/projeção e confirma via `updateGoal(id, { current: atual + valor })`
- Novo `SaldoInlineEditor` (toggle → input inline) permite ajustar `current` direto no card, sem reload, sem `confirm()`/`alert()`
- "Marcar como concluída" (dots-menu) ligado a `updateGoal(id, { completed: true, completed_at: <ISO> })`; "Ajustar plano" volta a abrir `AjustarPlanoModal`

## Task Commits

Each task was committed atomically:

1. **Task 1: Renomear o wrapper do hero para met-hero + novo bloco CSS distinto (D3)** - `432e278` (feat)
2. **Task 2: Render vcard (capa/scrim/overlay/corpo) + COVER_PRESETS/resolveCoverUrl** - `e18482f` (feat)
3. **Task 3: Montar AportarModal + inline Atualizar saldo + Marcar como concluída (D6/D5)** - `b0fc048` (feat)
4. **Deviation fix (Rule 1): reconecta overrides mobile órfãos** - `b652475` (fix)

_No plan-metadata commit — orchestrator owns STATE.md/ROADMAP.md updates per runtime constraints._

## Files Created/Modified
- `assets/fides-metas.jsx` — met-hero wrapper, COVER_PRESETS/resolveCoverUrl, vcard render, SaldoInlineEditor, AportarModal mount, dots-menu/Aportar/Ajustar-plano rewiring
- `assets/fides-metas.css` — `.met-hero` block (colagem backdrop), `.vcard*` blocks (capa/scrim/overlay/corpo/ações), `.vcard-saldo-*` (inline editor), `.met-card-stats` 3→2 cols
- `assets/fides-responsive.css` — reconecta overrides de mobile (`.stu-hero`/`.met-card`) que ficaram órfãos após o rename, apontando também/só para `.met-hero`/`.vcard`

## Decisions Made
- Backdrop do hero: colagem real (mask-image de 4 SVGs de capa existentes), não um gradiente genérico — reforça a identidade "vision board" sem inventar novo asset
- Dots-menu de editar/concluir/excluir ficou sempre visível (não escondido atrás de hover) por segurança de acessibilidade tap-first em mobile; só as ações Aportar/Ajustar-plano/Atualizar-saldo são reveladas no hover (com fallback sempre-visível em touch via `@media (hover: none)`)
- Stats do vcard reduzidos de 3 para 2 (removida "Aderência" que existia no met-card antigo) — segue literalmente a especificação do CONTEXT.md/PATTERNS.md para o corpo do vcard

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Overrides mobile em `fides-responsive.css` ficaram órfãos após o rename das classes**
- **Found during:** Task 1/2 (rename `stu-hero`→`met-hero`, `met-card`→`vcard`)
- **Issue:** `assets/fides-responsive.css` (fora do `files_modified` do plano) tinha regras de mobile (`≤768px`/`≤480px`) escritas contra `.stu-hero` e `.met-card`. Após o rename, essas regras deixaram de casar com o markup de Metas — o hero e o vcard voltariam a usar o box model desktop em telas estreitas, quebrando diretamente o critério de aceite "sem regressão de layout em 400×512 iOS Safari" das Tasks 1 e 2.
- **Fix:** Adicionado `.met-hero` como seletor irmão de `.stu-hero` nos dois breakpoints que ajustam padding/border-radius/overflow do hero; `.met-card` trocado por `.vcard` (overflow ≤1024px, border-radius ≤768px), com o padding do card migrado para `.vcard-body` (onde o padding realmente vive após a capa 186px sair da área com padding)
- **Files modified:** `assets/fides-responsive.css`
- **Verification:** Grep confirma zero seletores `.met-card` remanescentes no arquivo; brace-balance check (`node -e`) confirma CSS sintaticamente válido
- **Committed in:** `b652475`

---

**Total deviations:** 1 auto-fixed (1 bug/Rule 1)
**Impact on plan:** Fix necessário para não regredir o critério de aceite explícito de mobile das Tasks 1/2; sem scope creep — tocou apenas os seletores diretamente quebrados pelo rename desta plan.

## Issues Encountered
None além do deviation acima.

## Known Stubs
None — os dois fluxos de update inline (Aportar, Atualizar saldo) e a conclusão de meta escrevem de verdade via `updateGoal`, sem placeholder.

## Threat Flags
None — capa segue via `background-image` (nunca `dangerouslySetInnerHTML`), conforme mitigação T-08-04 do threat_model da plan; nenhuma nova superfície de rede/auth introduzida.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Vision-board visual (hero + vcards) e as ações de update inline (Aportar/Atualizar saldo/Concluir) estão funcionais sobre a base de dados/controls dos planos 08-02/03/04
- Pendente (fora de escopo desta plan, cf. `prohibitions`): fluxo completo de troféu/conquista ao concluir meta; crop/drag-reorder de capa; seletor de capa nos modais Criar/Ajustar (Plan 08-06)
- `.met-stat-val.pos`/`.warn` (CSS) ficaram sem uso após a remoção da stat "Aderência" do vcard — dead CSS de baixo risco, não removido nesta plan (fora de escopo; não quebra nada)

---
*Phase: 08-metas-vision-board-redesign*
*Completed: 2026-07-02*

## Self-Check: PASSED

- FOUND: assets/fides-metas.jsx
- FOUND: assets/fides-metas.css
- FOUND: assets/fides-responsive.css
- FOUND: commit 432e278
- FOUND: commit e18482f
- FOUND: commit b0fc048
- FOUND: commit b652475
