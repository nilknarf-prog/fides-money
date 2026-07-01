# Phase 1: Veracidade do Dashboard — Specification

**Created:** 2026-06-28
**Ambiguity score:** 0.18 (gate: ≤ 0.20)
**Requirements:** 3 locked

## Goal

O `DashboardStudio` passa a refletir a verdade financeira do usuário em três pontos hoje quebrados: o card de orçamento 50-30-20 mostra os limites reais definidos no Planejamento (não R$0/0%), cada fatia do donut é identificável (categoria + valor + %), e o número de fechamento do mês passa de "fluxo isolado" para "saldo projetado real" que incorpora o saldo atual das contas.

## Background

Estado atual (verificado no código):

- **Issue #1** — [fides-store.jsx:1058-1079](assets/fides-store.jsx#L1058) `budgetGroups` lê o limite de cada categoria de `plannedOverrides[id] ?? 0`. Mas `setPlanned` ([fides-store.jsx:722](assets/fides-store.jsx#L722)) **nunca é chamado** em lugar nenhum (`plannedOverrides` permanece `{}`). Os limites reais vivem em `categoryLimits`, carregado da tabela `category_limits` ([fides-store.jsx:201, 229-236](assets/fides-store.jsx#L201)) e persistido pelo Planejamento via `setCategoryLimit`. Resultado: o card "Para onde foi" sempre exibe limite R$0 e 0%. A leitura correta (prioridade `byMonth[selectedMonth]` → `default` → null) já existe em `categoryUsage` ([fides-store.jsx:1023-1056](assets/fides-store.jsx#L1023)) e serve de molde.
- **Issue #2** — [fides-charts.jsx:116-151](assets/fides-charts.jsx#L116) `Donut` renderiza um `<path>` puro por fatia ([linha 147](assets/fides-charts.jsx#L147)). Sem `<title>`, sem handler de hover/tap, sem tooltip. Os dados `label` e `val` já existem no array `arcs` mas não alimentam nenhuma interação. Usuário não consegue saber que categoria é a fatia vermelha dominante, nem no desktop nem no mobile.
- **Issue #3** — [fides-studio.jsx:652](assets/fides-studio.jsx#L652) `saldoFinal = receitaTotal − despesas − pendentes`. É puro fluxo do mês; ignora `accounts.balance`. Por isso o hero anuncia "Você fechará Junho com −R$655 no vermelho" mesmo o usuário tendo saldo positivo em contas correntes + Reserva 99Pay (~R$7.346). O saldo das contas (`balance`) está disponível via `useFides()` ([fides-studio.jsx:625](assets/fides-studio.jsx#L625)).

## Requirements

1. **Orçamento 50-30-20 lê limites reais**: `budgetGroups` deriva o limite de cada categoria de `categoryLimits`, não de `plannedOverrides`.
   - Current: `budgetGroups` lê `plannedOverrides[id] ?? 0`; `setPlanned` nunca é invocado → limite sempre 0, % sempre 0.
   - Target: o limite por categoria vem de `categoryLimits` com a regra de prioridade `byMonth[selectedMonth]` → `default` → `null` (mesma de `categoryUsage`). O limite do macro-grupo é a soma dos limites efetivos das categorias-filhas no mês selecionado.
   - Acceptance: com limites definidos no Planejamento para o mês corrente, o card "Para onde foi" exibe o limite somado por grupo (Essencial/Estilo de vida/Dívidas) e o % = gasto/limite real, ambos diferentes de 0 quando há limite.

2. **Fatias do donut identificáveis**: cada fatia revela sua categoria por hover (desktop) e tap (mobile).
   - Current: `Donut` desenha `<path>` sem `<title>`, sem evento, sem tooltip — fatia anônima.
   - Target: hover no desktop e tap no mobile exibem um tooltip com label da categoria, valor (BRL) e percentual do total; tocar/clicar fora fecha o tooltip. No mobile a identificação é por tap (não depende de hover).
   - Acceptance: passar o mouse sobre uma fatia no desktop mostra "{categoria} · {R$ valor} · {%}"; tocar a fatia no mobile mostra a mesma info; tocar fora a oculta.

3. **Saldo projetado incorpora saldo atual (Opção A)**: o número de fechamento do hero deixa de ser fluxo isolado.
   - Current: `saldoFinal = receitaTotal − despesas − pendentes` — ignora saldo das contas.
   - Target: `saldoProjetado = Σ(balance de todas as contas, excluindo cartões) + receitas previstas ainda NÃO recebidas − despesas previstas ainda EM ABERTO`, para o mês selecionado. Transações já liquidadas (que já alteraram `balance`) NÃO são recontadas. "Contas" inclui correntes + Reserva/Poupança 99Pay; cartões ficam de fora.
   - Acceptance: para um mês com saldo de contas positivo suficiente, o hero mostra valor positivo ("terminará … livre") em vez de negativo; o número equivale a saldo_contas + pendentes_a_receber − pendentes_a_pagar, sem dupla contagem das transações `settled`.

## Boundaries

**In scope:**
- Corrigir a fonte de dados de `budgetGroups` (categoryLimits, soma por grupo).
- Tooltip interativo de fatia no `Donut` (hover desktop + tap mobile + dismiss).
- Novo cálculo de saldo projetado no hero (Opção A) e ajuste da headline ("terminará livre" vs "fechará no vermelho") conforme o sinal do novo número.
- Manter visível o fluxo mensal negativo quando existir (ver Prohibitions P1).

**Out of scope:**
- Migração Babel→Vite/Next, CI/CD Staging — backlog B11/B12, estratégico, não bloqueia esta fase.
- GTM, pricing, gamificação, onboarding — backlog C6–C9, negócio.
- Refatorar `plannedOverrides`/`setPlanned` para outro uso — apenas trocar a fonte de `budgetGroups`; remoção do estado morto é limpeza opcional, não requisito.
- Redesenhar o donut ou o card de orçamento visualmente — só corrigir dados e interação.
- Projeção por média histórica (B6) — depende de 3+ meses de dados.

## Constraints

- React via Babel standalone no navegador (sem build/bundler) — sem libs de tooltip externas; o tooltip deve ser implementado com estado React + SVG/HTML inline.
- A regra de leitura de limite DEVE casar exatamente com `categoryUsage` (`byMonth[selectedMonth]` → `default` → `null`) para não divergir do Planejamento.
- O cálculo do saldo projetado depende da distinção `settled`/pendente já existente no store; só a parcela pendente é aplicada sobre `balance` para evitar dupla contagem.
- Sem suíte de testes automatizados no projeto — aceitação verificada por observação no app pós-deploy Vercel.

## Acceptance Criteria

- [ ] Card "Para onde foi" exibe limite por grupo > 0 e % real quando há limites definidos no Planejamento para o mês.
- [ ] O limite de grupo é a soma dos limites efetivos das categorias-filhas no mês selecionado (regra byMonth→default→null).
- [ ] Hover sobre uma fatia do donut (desktop) mostra categoria + valor + %.
- [ ] Tap sobre uma fatia do donut (mobile) mostra a mesma identificação; tap fora a fecha.
- [ ] O hero usa saldo projetado = saldo das contas (correntes + Reserva, excl. cartões) + pendentes a receber − pendentes a pagar.
- [ ] Transações já liquidadas não são contadas duas vezes no saldo projetado.
- [ ] A headline alterna corretamente entre "terminará … livre" (≥0) e "fechará … no vermelho" (<0) com base no novo número.
- [ ] O fluxo mensal negativo (receitas − despesas < 0) continua visível em algum ponto do hero (não é ocultado pelo saldo projetado positivo).

## Edge Coverage

**Coverage:** 3/4 applicable edges resolved · 0 unresolved (1 dismissed)

| Category | Requirement | Status | Resolution / Reason |
|----------|-------------|--------|---------------------|
| unclassified | R1 | ✅ covered | Categoria sem limite efetivo contribui 0 ao grupo; se a soma do grupo for 0, exibir estado "sem limite definido" em vez de "0%" enganoso (AC linha de orçamento). |
| empty | R2 | ✅ covered | Donut com 1 fatia (100%) ainda mostra tooltip; mês sem despesas já é tratado pelo empty state existente ([fides-studio.jsx:701](assets/fides-studio.jsx#L701)). |
| encoding | R2 | ⛔ dismissed | Requisito não envolve comprimento/igualdade de string nem normalização — bytes vs grapheme não se aplica a tooltip de fatia. |
| unclassified | R3 | ✅ covered | Sem contas / saldo negativo / mês 100% liquidado (sem pendentes) → projeção = saldo atual das contas; nunca quebra nem reconta. |

## Prohibitions (must-NOT)

**Coverage:** 1/1 applicable prohibitions resolved · 0 unresolved

| Prohibition (must-NOT statement) | Requirement | Status | Verification / Reason |
|----------------------------------|-------------|--------|------------------------|
| NÃO apresentar o saldo projetado positivo de forma que esconda um fluxo mensal genuinamente negativo (receitas − despesas < 0) — o diferencial declarado do produto é "sem projeções enganosas". O fluxo negativo deve permanecer visível. | R3 | resolved | verification: judgment — revisão humana confirma que, com saldo projetado positivo mas fluxo do mês negativo, o hero ainda comunica o déficit do fluxo (ex: nas métricas Receitas/Despesas ou em texto). |

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                        |
|--------------------|-------|------|--------|--------------------------------------------------------------|
| Goal Clarity       | 0.88  | 0.75 | ✓      | 3 resultados concretos e mensuráveis                         |
| Boundary Clarity   | 0.80  | 0.70 | ✓      | Docs estratégicos e refactor de estado morto explicitamente fora |
| Constraint Clarity | 0.78  | 0.65 | ✓      | Dupla contagem, contas incluídas e tap mobile resolvidos     |
| Acceptance Criteria| 0.80  | 0.70 | ✓      | 8 critérios pass/fail                                        |
| **Ambiguity**      | 0.18  | ≤0.20| ✓      |                                                              |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

| Round | Perspective    | Question summary                                  | Decision locked                                                        |
|-------|----------------|---------------------------------------------------|-----------------------------------------------------------------------|
| 0     | Pré-fase       | Estratégia do issue #3 (projeção vs saldo)        | Opção A — saldo projetado incorpora saldo atual das contas (locked)   |
| 1     | Failure Analyst| Como evitar dupla contagem no saldo projetado?    | Saldo atual + só pendentes (a receber − a pagar); settled não reconta |
| 1     | Boundary Keeper| Quais contas entram no número de fechamento?      | Correntes + Reserva/Poupança; cartões excluídos                       |
| 1     | Researcher     | Como identificar a fatia do donut em mobile?      | Hover desktop + tap mobile, com dismiss ao tocar fora                  |

---

*Phase: 01-veracidade-do-dashboard*
*Spec created: 2026-06-28*
*Next step: /gsd-discuss-phase 1 — decisões de implementação (onde calcular pendentes a receber/pagar, layout do tooltip, etc.)*
