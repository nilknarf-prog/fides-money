---
phase: 09-transacoes-power-tools-analytics
plan: 04
subsystem: ui
tags: [react, babel-standalone, cross-month-analytics, transacoes]

# Dependency graph
requires:
  - phase: 09-01
    provides: "spendByCategoryRange(fromYM,toYM) e rangeTransactions(fromYM,toYM) expostas via useFides()"
  - phase: 09-03
    provides: "pagedSorted/pageSize/page (paginação client-side) e filtro avançado Contas/Cartões, já derivados de baseList"
provides:
  - "rangeFromPreset(selectedMonth, preset) helper de módulo em fides-transacoes.jsx"
  - "Estado [fromYM, toYM] elevado a Transacoes (lazy useState + único useEffect de sync)"
  - "baseList alternável entre monthTransactions (mês único) e rangeTransactions (período), TX-04"
  - "Painel de analytics cross-month via spendByCategoryRange reusando Donut/CategoryChart, TX-03"
affects: [09-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fromYM/toYM sempre React.useState com lazy initializer via rangeFromPreset — nunca undefined no 1o render, protegendo monthsInRange(fromYM.split('-')) do store"
    - "Um único useEffect com deps [rangePreset, selectedMonth] é o único writer de fromYM/toYM em presets não-custom; em custom o usuário escreve via setFromYM/setToYM direto — evita hooks condicionais/loops de sync"
    - "rangeList/rangeSpend memoizados no consumidor via React.useMemo(deps=[fn, fromYM, toYM]) porque o store expõe rangeTransactions/spendByCategoryRange como React.useCallback (não useMemo)"
    - "baseList alternável (rangeMode ? rangeList : monthTransactions) — toda a cadeia filtered/sorted/pagedSorted/grouped/totals/chipCounts já deriva de baseList, então a troca de escopo propaga sem duplicar lógica"

key-files:
  created: []
  modified:
    - assets/fides-transacoes.jsx
    - assets/fides-transacoes.css

key-decisions:
  - "Card 'Escopo' (Mês único/Período) inserido entre o header de mês/ano e o card de organização (sort pills), como extensão natural da seleção de mês"
  - "Painel de analytics (Donut + CategoryChart) só renderiza quando rangeMode está ativo, logo abaixo do card de Escopo"
  - "Custom range usa <input type=month> nativo (não pills customizados) — já entrega o formato YYYY-MM e picker nativo sem lib extra"
  - "Ordenação from<=to em custom feita via onChange (empurra o outro extremo se necessário), não via validação pós-submit"
  - "scopeLabel (rangeLabel em modo range, lbl.long em modo mês único) substitui lbl.long nos dois contadores da lista (linha de contagem e linha de filtro ativo)"

patterns-established:
  - "ymShortLabel(ym): helper de módulo que reusa TX_MONTHS_LBL para formatar 'YYYY-MM' -> 'Mmm YYYY', usado para exibir o intervalo de range sem depender do monthLabel do store (que exige objeto {short,long})"

requirements-completed: [TX-03, TX-04]

# Metrics
duration: ~12min
completed: 2026-07-03
status: complete
---

# Phase 09 Plan 04: Range Analytics UI (TX-03/TX-04) Summary

**`fides-transacoes.jsx` ganha um controle de escopo Mês único/Período (3m/6m/12m/Ano/Custom) que alimenta tanto a lista de transações (superset multi-mês via `rangeTransactions`) quanto um novo painel de gasto por categoria cross-month (via `spendByCategoryRange`, reusando `Donut`/`CategoryChart` do Dashboard sem editá-los).**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-07-03
- **Tasks:** 3/3
- **Files modified:** 2

## Accomplishments
- Helper de módulo `rangeFromPreset(selectedMonth, preset)` deriva `[fromYM, toYM]` para `3m`/`6m`/`12m` (recua 2/5/11 meses a partir do mês âncora, com rollover de ano) e `ano` (`YYYY-01`..`YYYY-12`); `custom` não usa o helper.
- `Transacoes` ganhou `rangeMode`, `rangePreset`, `fromYM`, `toYM` — os dois últimos **sempre** `React.useState` com lazy initializer via `rangeFromPreset(selectedMonth, '3m')`, garantindo que nunca sejam `undefined` no primeiro render (proteção contra o `undefined.split('-')` de `monthsInRange` no store, finding #3 do 09-REVIEWS).
- Um único `React.useEffect` (deps `[rangePreset, selectedMonth]`) sincroniza `fromYM`/`toYM` para presets não-custom; em modo `custom` o usuário edita os dois `<input type="month">` diretamente, com auto-ordenação (`from<=to`) no próprio `onChange`.
- Novo card "Escopo" (`.fds-tx-v2-range`) com toggle Mês único/Período e pills de preset, posicionado entre o header de mês/ano e o card de organização.
- `baseList` passou a ser `rangeMode ? rangeList : monthTransactions` — `rangeList` é `React.useMemo(() => rangeTransactions(fromYM, toYM), [rangeTransactions, fromYM, toYM])`, memoizado no consumidor porque o store expõe a derivação como `useCallback`. Toda a cadeia existente (`filtered`/`sorted`/`pagedSorted`/`grouped`/`totals`/`chipCounts`, incluindo a paginação do Plan 09-03) propaga automaticamente sem duplicação.
- Contadores da lista (`fds-tx-v2-list-count` e o rodapé de filtro ativo) agora mostram `scopeLabel` (intervalo formatado em modo range, `lbl.long` em modo mês único) em vez de sempre `lbl.long`.
- Novo painel `.fds-tx-v2-analytics` (visível só em modo range) mostra o intervalo + total do período no cabeçalho e renderiza `<Donut data={rangeSpend}/>` + `<CategoryChart data={rangeSpend}/>` — ambos componentes de `fides-charts.jsx` reusados sem qualquer edição. `rangeSpend` é `React.useMemo(() => spendByCategoryRange(fromYM, toYM), [...])`, já excluindo `is_transfer`/receitas via derivação do store.
- Novas classes CSS `.fds-tx-v2-range*` e `.fds-tx-v2-analytics*` em `fides-transacoes.css`, reusando tokens existentes e as classes globais `.fds-donut-wrap`/`.fds-muted` de `fides.css`.

## Task Commits

Each task was committed atomically:

1. **Task 1: estado de range + preset picker (3m/6m/12m/ano/custom)** - `3df7bad` (feat)
2. **Task 2: TX-04 — baseList alternável entre monthTransactions e rangeTransactions** - `38fae88` (feat)
3. **Task 3: TX-03 — widget de gasto por categoria cross-month (Donut/CategoryChart)** - `040c260` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `assets/fides-transacoes.jsx` - `rangeFromPreset`/`ymShortLabel` helpers; estado de range (`rangeMode`/`rangePreset`/`fromYM`/`toYM`) com lazy init e único effect de sync; `rangeList`/`rangeSpend` memoizados; `baseList` alternável; card "Escopo" e painel de analytics cross-month; contadores de lista usando `scopeLabel`.
- `assets/fides-transacoes.css` - Classes `.fds-tx-v2-range*` (card de escopo, toggle, presets, custom inputs) e `.fds-tx-v2-analytics*` (painel de gasto por categoria), com regras responsivas em `@media (min-width: 768px)`.

## Decisions Made
- Card de Escopo posicionado logo após o header de mês/ano (extensão natural da navegação de mês), antes do card de organização (sort pills) — decisão de layout do executor, plano deixava livre.
- Painel de analytics renderiza condicionalmente a `rangeMode` (não sempre visível), evitando poluir a tela em modo mês único, que já tem seu próprio contexto (KPIs do Dashboard).
- `<input type="month">` nativo para o modo custom em vez de um seletor de mês customizado — já entrega o formato `YYYY-MM` exato usado internamente e picker nativo cross-browser, sem dependência nova.
- Ordenação `from<=to` em custom resolvida inline no `onChange` de cada input (empurra o outro extremo quando necessário), evitando um botão de "confirmar" extra.

## Deviations from Plan

None - plan executado exatamente como escrito. Os três tasks corresponderam ao `<action>`/`<acceptance_criteria>` do plano; a única adaptação foi de layout/posicionamento de UI (deixado explicitamente a critério do executor pelo próprio plano) e o uso de `<input type="month">` nativo em vez de um componente custom, ambos dentro do espaço de decisão do plano ("inputs simples YYYY-MM").

## Issues Encountered

Nenhum bloqueio. Como não há build/lint local (Babel-standalone via CDN, per CLAUDE.md), a verificação estática seguiu o mesmo idioma do Plan 09-01: leitura completa das regiões modificadas + checagem de balanceamento de chaves/parênteses do arquivo inteiro antes e depois de cada edição (0 de diferença em ambos os casos, nos três commits). Verificação funcional completa em navegador (per os passos `<verify>` do plano) fica para a UAT humana, como de costume neste codebase client-only.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- `[fromYM, toYM]` está elevado em `Transacoes`, com lazy init seguro e sync único — Plan 09-05 pode ler/persistir esse estado (ex.: via `readTxState()`) reusando o mesmo `rangeFromPreset` como fallback, sem conflito com o effect de sync já existente aqui.
- `baseList` alternável e `rangeSpend` cross-month estão prontos para qualquer consumo adicional futuro (ex.: export CSV/OFX em modo range, fora do escopo deste plano).
- Nenhum bloqueio para os demais planos da Fase 09.

---
*Phase: 09-transacoes-power-tools-analytics*
*Completed: 2026-07-03*

## Self-Check: PASSED

- FOUND: assets/fides-transacoes.jsx
- FOUND: assets/fides-transacoes.css
- FOUND: .planning/phases/09-transacoes-power-tools-analytics/09-04-SUMMARY.md
- FOUND: 3df7bad (Task 1 commit)
- FOUND: 38fae88 (Task 2 commit)
- FOUND: 040c260 (Task 3 commit)
