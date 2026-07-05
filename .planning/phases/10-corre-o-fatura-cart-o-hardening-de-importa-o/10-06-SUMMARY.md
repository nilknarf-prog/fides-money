---
phase: 10-corre-o-fatura-cart-o-hardening-de-importa-o
plan: 06
subsystem: transacoes-analytics
tags: [ux, analytics, periodo, donut, categoria, gap-closure]
requires:
  - spendByCategory (fides-store.jsx, escopado a monthTransactions/selectedMonth)
  - CategoryChart slice(0,7) (fides-charts.jsx — legenda visual top-7)
  - activeSlice/setActiveSlice (10-03)
provides:
  - "widget 'Gasto por categoria' do modo Período escopado ao MÊS selecionado (spendByCategory + monthTotal), não ao range agregado"
  - "quebra por categoria = top-7 do CategoryChart, sem legenda textual redundante"
affects:
  - assets/fides-transacoes.jsx
tech-stack:
  added: []
  patterns:
    - "Widget de analytics do modo Período reflete o mês do masthead (spendByCategory); a LISTA continua no escopo range (rangeList)"
    - "CategoryChart (slice 0,7 + rótulo/R$/% por barra) É a legenda visual — Donut compartilha as cores (tint); sem lista textual paralela"
key-files:
  created: []
  modified:
    - assets/fides-transacoes.jsx
decisions:
  - "Escopar o widget ao mês (spendByCategory) resolve G4+G5 juntos: quebra = top-7 do mês selecionado"
  - "monthTotal (useMemo sobre spendByCategory) substitui rangeTotal; rangeSpend/rangeTotal e spendByCategoryRange removidos (dead code)"
  - "% da fatia ativa e centro do Donut relativos a monthTotal (mês), não ao range"
metrics:
  duration: ~5min
  completed: 2026-07-05
  tasks: 1
  files: 1
status: complete
---

# Phase 10 Plan 06: Analytics do modo Período escopado ao mês (G4/G5) Summary

Fecha G4 (legenda longa/repetida/sem barra) e G5 (donut/total mostravam o total do range, não o mês do masthead) do teste 8 do 10-UAT — ambos regressões da mudança "legenda completa" do 10-03 — escopando o widget "Gasto por categoria" do modo Período ao MÊS selecionado e removendo a legenda textual redundante, editando apenas `assets/fides-transacoes.jsx`.

## What Was Built

- **G5 (donut/total = total do range → mês):** o bloco de analytics do modo Período trocou a fonte de dados de `rangeSpend`/`rangeTotal` (`spendByCategoryRange(fromYM, toYM)`, todo o intervalo) para `spendByCategory`/`monthTotal` (escopado ao `selectedMonth` no store). Com o masthead em Julho, o donut e o total do header passam a refletir Julho, não os ~19k de Mai–Jul.
  - Header: `<span className="fds-muted">{rangeLabel}</span>` → `{lbl.long}` (rótulo do mês selecionado); total `{fmtBRL(rangeTotal)}` → `{fmtBRL(monthTotal)}`.
  - Condição de conteúdo `rangeSpend.length > 0` → `spendByCategory.length > 0`; `<Donut data={rangeSpend}>` → `data={spendByCategory}`; `<CategoryChart data={rangeSpend}>` → `data={spendByCategory}`.
  - Centro do Donut: `%` da fatia ativa e "Total" agora relativos a `monthTotal`.
  - Mensagem de vazio: "Nenhuma despesa no período selecionado." → "Nenhuma despesa em {lbl.long}.".

- **G4 (legenda longa/repetida/sem barra → top-7):** removido por completo o bloco `.fds-cats-list` (que iterava `rangeSpend.map` e listava TODAS as categorias com `.fds-cat-row`, incluindo o comentário acima dele). O `CategoryChart` já faz `slice(0,7)` e desenha rótulo + R$ + % por barra — é a legenda visual (top-7 do mês), e o Donut compartilha as mesmas cores (`tint`). Sem a lista extra, a quebra por categoria termina no top-7, sem duplicação nem categorias sem barra.

- **Limpeza de código morto:** `monthTotal` (`React.useMemo` sobre `spendByCategory`, deps `[spendByCategory]`) substitui os useMemos `rangeSpend` e `rangeTotal`, que ficaram sem uso e foram removidos. `spendByCategoryRange` — antes consumido só por `rangeSpend` — foi removido do destructure de `useFides()` por ficar totalmente morto.

## Key Implementation Details

- `spendByCategory` adicionado ao destructure de `useFides()` (já exposto pelo store, fides-store.jsx:1399, escopado a `monthTransactions`/`selectedMonth`).
- `rangeList`/`baseList` NÃO foram tocados: a LISTA de transações continua respeitando o escopo Período (range). Apenas o widget de analytics passou a refletir o mês.
- `activeSlice`/`setActiveSlice` (10-03) preservados — hover/tap numa fatia do Donut continua funcionando, agora com % relativo ao mês; sai da fatia → volta a "Total".
- Nenhum CSS novo — todas as classes reusadas já existiam.

## Deviations from Plan

Nenhuma deviation de comportamento. Um item além do texto literal do plano: além de remover os useMemos `rangeSpend`/`rangeTotal` (pedido no passo 5), removi também `spendByCategoryRange` do destructure de `useFides()`, pois ficou totalmente sem referência após a remoção do `rangeSpend` — alinhado à instrução de "limpeza de código morto" do próprio passo 5.

## Verification

- Guard automatizado do plano: `destructure true monthTotal true donut true chart true legendGone true braces true` (exit 0).
- Balanceamento no arquivo inteiro: braces 1052/1052, parens 1457/1457, brackets 247/247.
- Grep confirmou zero referências remanescentes a `rangeSpend`, `rangeTotal`, `spendByCategoryRange`, `fds-cat-row` e `fds-cats-list`.

## Runtime UAT pendente (precisa do app deployado + sessão logada)

1. Entrar no modo Período (3m/6m/12m/Ano) com o masthead em Julho → "Gasto por categoria" mostra o total e o donut de Julho (não os ~19k de Mai–Jul); header mostra o mês.
2. A quebra por categoria termina no top-7 (Restaurante/Delivery); sem categorias sem barra abaixo; sem categorias repetidas.
3. Hover/tap numa fatia do Donut → centro muda para categoria + valor + % (do mês); sair → volta a "Total".
4. A LISTA de transações continua respeitando o escopo Período (range) — só o widget de analytics reflete o mês.

## Commits

- `7bd2e58` fix(10-06): escopar analytics do modo Período ao mês selecionado (G5) e remover legenda redundante (G4)

## Self-Check: PASSED
