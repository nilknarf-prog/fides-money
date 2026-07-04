---
phase: 10-corre-o-fatura-cart-o-hardening-de-importa-o
plan: 03
subsystem: ui
tags: [react, donut, chart, transacoes, ux]

# Dependency graph
requires:
  - phase: 10-02-hardening-de-importacao
    provides: fides-transacoes.jsx (arquivo compartilhado, mesmo escopo de edicao — sem overlap de linhas tocadas)
  - phase: 09-transacoes-filtros-avancados
    provides: TxAdvFiltersModal.toggleAllCards (analog do chip), advFilters/contasSelected, rangeMode/rangeSpend/spendByCategoryRange
provides:
  - "Chip 'Cartao' no masthead de Transacoes — filtra credito reusando advFilters.contasSelected, sem abrir Filtros avancados"
  - "Donut do modo Periodo com onActiveSlice + .fds-donut-center (centro dinamico categoria/valor/%), replicando o padrao ja em producao do DashboardStudio"
  - "Legenda textual completa (.fds-cats-list) para o Donut do modo Periodo, cobrindo TODAS as categorias de rangeSpend (nao apenas o top-7 do CategoryChart)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Centro dinamico de Donut (onActiveSlice + .fds-donut-center) replicado do padrao ja em producao em DashboardStudio (fides-studio.jsx) para qualquer outro Donut futuro"
    - "Mismatch top-7 vs todas-as-fatias do Donut resolvido via legenda textual completa ao lado, sem tocar em CategoryChart (menor risco)"

key-files:
  created: []
  modified:
    - assets/fides-transacoes.jsx

key-decisions:
  - "Chip Cartao inserido dentro do bloco fds-tx-v2-chips, antes do separador fds-chip-sep e do botao Filtros avancados — agrupado com os outros toggles de tipo"
  - "rangeTotal extraido para useMemo proprio (derivado de rangeSpend) e reusado no cabecalho da secao de analytics, no centro do Donut e no % de cada linha da legenda — elimina o reduce inline duplicado"
  - "Legenda completa usa o mesmo padrao fds-cats-list/fds-cat-row ja em producao no DashboardStudio, sem limitar a N itens (ao contrario do top5 do DashboardStudio) para realmente cobrir todas as fatias do Donut do modo Periodo"

requirements-completed: [UX-03, UX-04]

# Metrics
duration: ~15min
completed: 2026-07-04
status: complete
---

# Phase 10 Plan 03: Chip "Cartão" + Donut com hover/legenda completa no modo Período Summary

**Chip "Cartão" no masthead de Transações que reusa `advFilters.contasSelected` para filtrar crédito sem abrir o modal de Filtros avançados, e Donut do modo Período com centro dinâmico (`onActiveSlice`/`.fds-donut-center`) + legenda textual completa que corrige o mismatch "nem toda cor tem barra" do `CategoryChart` (top-7).**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-04T19:30:00Z
- **Completed:** 2026-07-04T19:45:00Z
- **Tasks:** 2 completed
- **Files modified:** 1

## Accomplishments
- Chip "Cartão" (`fds-tx-v2-chips`): calcula `cardIds`/`allCardsActive` a partir de `safeCards`/`advFilters.contasSelected` e alterna todos os ids de cartão via `setAdvFilters` — reusa exatamente o mesmo filtro por conta já existente (nenhum estado novo, nenhum campo novo tipo `cardOnly`). O filtro efetivo (`filtered`) já reflete `advFilters.contasSelected`, então a lista muda imediatamente ao clicar no chip, sem abrir "Filtros avançados".
- `activeSlice`/`setActiveSlice` — novo `useState(null)` declarado incondicional no topo do componente `Transacoes` (junto a `pageSize`/`page`), nunca dentro do bloco `{rangeMode && ...}` (Rules of Hooks).
- `rangeTotal` — extraído para `React.useMemo` (derivado de `rangeSpend`), substituindo o `reduce` inline que só existia no cabeçalho; agora também alimenta o centro do Donut e o `%` de cada linha da legenda.
- Donut do modo Período (`fides-transacoes.jsx`, bloco `{rangeMode && ...}` de analytics) passa a receber `onActiveSlice={setActiveSlice}` e ganha um `.fds-donut-center` irmão — mostra categoria/valor/% da fatia ativa no hover/tap, ou "Total" + valor do período quando nenhuma fatia está ativa. Replica ponto a ponto o padrão já em produção em `DashboardStudio` (`fides-studio.jsx:1005-1017`).
- Legenda textual completa (`.fds-cats-list`/`.fds-cat-row`, mesmo padrão do `DashboardStudio`) adicionada ao lado do `CategoryChart`, listando **todas** as categorias de `rangeSpend` (sem truncar em 7 como o `CategoryChart` faz internamente) — resolve o mismatch "nem toda cor tem barra" sem alterar `CategoryChart`.
- CSS reusado integralmente (`.fds-donut-wrap`, `.fds-donut-center`, `.fds-donut-label`, `.fds-donut-value`, `.fds-cats-list`, `.fds-cat-row`, `.fds-cat-lbl`, `.fds-cat-pct`, `.fds-cat-val`, `Icon.Card`) — todas as classes/ícones já existiam em `fides.css`/`fides-data.jsx` antes deste plano; nenhum CSS novo foi criado.

## Task Commits

Each task was committed atomically:

1. **Task 1: Chip "Cartão" no masthead (UX-03)** - `03dc13a` (feat)
2. **Task 2: Donut do modo Período — hover/tap (centro dinâmico) + legenda completa (UX-04)** - `7b0f324` (feat)

**Plan metadata:** pending (docs: complete plan — committed after this summary)

## Files Created/Modified
- `assets/fides-transacoes.jsx` — Adiciona `cardIds`/`allCardsActive`/`toggleCardChip` + chip "Cartão" no bloco `fds-tx-v2-chips`; adiciona estado `activeSlice`/`setActiveSlice` incondicional; extrai `rangeTotal` para `useMemo`; liga `onActiveSlice`/`.fds-donut-center` ao `Donut` do modo Período; adiciona legenda `.fds-cats-list` completa ao lado do `CategoryChart`.

## Decisions Made
Ver `key-decisions` no frontmatter: posicionamento do chip dentro de `fds-tx-v2-chips`; `rangeTotal` centralizado em `useMemo` único; legenda sem limite de itens (diferente do `top5` do `DashboardStudio`) para cobrir de fato todas as fatias do Donut.

## Deviations from Plan

None - plano executado exatamente como especificado (Task 1 e Task 2 seguiram a ação e os acceptance criteria do PLAN.md ponto a ponto). O único ajuste de implementação (extrair `rangeTotal` para `useMemo` em vez de manter o `reduce` inline duplicado em 3 lugares) é uma consequência direta da própria ação do Task 2 ("Calcular `rangeTotal = rangeSpend.reduce(...)`... reutilizar/derivar"), não uma mudança de escopo.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Verification Status

- **Automatizado (executado nesta sessão):**
  - Task 1: `grep -c "allCardsActive"` → 4; `grep -c "Icon.Card"` → 4; `grep -c "setAdvFilters("` → 2 (clearAllFilters + toggleCardChip); `grep -c "contasSelected"` → 24 (mesmo campo, sem `cardOnly`/flags novas) → gate `UX03_OK` (implícito pelos greps individuais >=1) passou.
  - Task 2: `grep -c "onActiveSlice"` → 1; `grep -c "setActiveSlice"` → 2; `grep -c "fds-donut-center"` → 1; `grep -c "fds-cats-list"` → 1; `grep -c "slice(0, 7)\|slice(0,7)"` em `fides-charts.jsx` → 1 (inalterado, `CategoryChart` intacto); `grep -c "const \[activeSlice"` → 1 (declarado uma única vez) → gate `UX04_OK` passou.
  - Sanidade estrutural do arquivo inteiro pós-edição (sem build/lint no projeto — Babel-standalone no browser): contagem de chaves `{`/`}` (1030/1030) e parênteses `(`/`)` (1388/1388) balanceada após ambos os commits; revisão manual linha a linha de ambos os diffs.
  - Confirmado via leitura direta do código: `fmtBRL(n, opts)` suporta `{ compact: true }` (`assets/fides-data.jsx:5`); `CategoryAvatar` já é usado em outros pontos do mesmo arquivo (componente global disponível no escopo); `Donut` (`assets/fides-charts.jsx:116`) expõe `onActiveSlice` e `arcs[i]` com `{ label, val, tint }` — shape compatível com `activeSlice.label`/`activeSlice.val` usados no centro dinâmico; classes CSS `.fds-donut-wrap` (`position: relative`), `.fds-donut-center` (`position: absolute; inset: 0`) e `.fds-cats-list`/`.fds-cat-row`/`.fds-cat-lbl`/`.fds-cat-pct`/`.fds-cat-val` já existiam em `assets/fides.css` antes deste plano — nenhum CSS novo necessário.
- **Domínio sensível (CLAUDE.md):** plano é UI-only (filtro client-side + chart), sem escrita no Supabase, sem nova fronteira de trust boundary — não aciona a recomendação de revisão de segurança do CLAUDE.md (que é para `api/`/`supabase/`). Ameaça T-10-03-01 (XSS refletido na legenda) mitigada: `{c.label}` renderizado como texto React puro (sem `dangerouslySetInnerHTML`, `grep -c "dangerouslySetInnerHTML" assets/fides-transacoes.jsx` inalterado em relação ao plano 10-02, que já confirmou 0).
- **Pendente (human-check, não bloqueante — plano é `autonomous: true`):**
  1. No app, tela de Transações: clicar o chip "Cartão" → lista mostra só transações de crédito, chip fica `on`, modal de Filtros avançados NÃO abre; clicar de novo desliga.
  2. Entrar no modo Período (3m/6m/12m/Ano) com várias categorias: passar mouse/tocar uma fatia do Donut → centro muda para categoria + valor + %; sair → volta a "Total"; conferir que toda categoria da legenda completa tem representação (mesmo além das 7 barras do `CategoryChart`).
  - Ambos os itens ficam para `/gsd-verify-work 10`, junto com os itens pendentes dos planos 10-01/10-02.

## Next Phase Readiness
- Fase 10 (correção fatura cartão + hardening de importação) tem seus 3 planos (10-01, 10-02, 10-03) code-complete.
- UAT humano consolidado (roteiro de fatura/ciclo do 10-01, dedupe/card_id/cancelar-não-grava do 10-02, chip Cartão + Donut hover/legenda do 10-03) fica para `/gsd-verify-work 10` após deploy.
- Nenhum símbolo novo deste plano é consumido por trabalho futuro conhecido — plano é puramente de polish de UX (UX-03/UX-04), fechando os itens P3a/P3b do `09-FOLLOWUPS.md`.

---
*Phase: 10-corre-o-fatura-cart-o-hardening-de-importa-o*
*Completed: 2026-07-04*

## Self-Check: PASSED

- FOUND: assets/fides-transacoes.jsx
- FOUND: .planning/phases/10-corre-o-fatura-cart-o-hardening-de-importa-o/10-03-SUMMARY.md
- FOUND: 03dc13a
- FOUND: 7b0f324
