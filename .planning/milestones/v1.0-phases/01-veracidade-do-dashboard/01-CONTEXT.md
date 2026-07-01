# Phase 1: Veracidade do Dashboard - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning

<domain>
## Phase Boundary

O `DashboardStudio` ([fides-studio.jsx](../../../assets/fides-studio.jsx)) passa a refletir a verdade financeira em três pontos hoje quebrados: (1) card de orçamento 50-30-20 lê limites reais de `categoryLimits`, (2) cada fatia do donut é identificável (categoria + valor + %), (3) número de fechamento do hero vira saldo projetado real (incorpora `accounts.balance`). Apenas correção de dados e interação — sem redesenho visual.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**3 requirements are locked.** See `01-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `01-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Corrigir a fonte de dados de `budgetGroups` (categoryLimits, soma por grupo).
- Tooltip interativo de fatia no `Donut` (hover desktop + tap mobile + dismiss).
- Novo cálculo de saldo projetado no hero (Opção A) e ajuste da headline ("terminará livre" vs "fechará no vermelho") conforme o sinal do novo número.
- Manter visível o fluxo mensal negativo quando existir (Prohibition P1).

**Out of scope (from SPEC.md):**
- Migração Babel→Vite/Next, CI/CD Staging (backlog B11/B12).
- GTM, pricing, gamificação, onboarding (backlog C6–C9).
- Refatorar `plannedOverrides`/`setPlanned` para outro uso — só trocar a fonte de `budgetGroups`; remover estado morto é limpeza opcional, não requisito.
- Redesenhar donut ou card de orçamento visualmente.
- Projeção por média histórica (B6).

</spec_lock>

<decisions>
## Implementation Decisions

### Tooltip do donut (Issue #2 / R2)

- **D-01: Arquivo protegido liberado.** [fides-charts.jsx](../../../assets/fides-charts.jsx) é arquivo protegido (PROJECT.md §4 "não tocar sem aprovação explícita"). O usuário **aprovou explicitamente** editar o `Donut` nesta fase. Registrar como exceção aprovada — o executor não precisa pedir aval de novo, mas o toque deve ficar restrito ao necessário para o tooltip.
- **D-02: Estado + handlers dentro do `Donut`.** A interação (estado da fatia ativa + handlers hover/tap) vive dentro do componente `Donut` em fides-charts.jsx, não no consumidor. Razão: `Donut` é exportado global ([fides-charts.jsx:280](../../../assets/fides-charts.jsx#L280)) e usado por 2 consumidores — [fides-studio.jsx:827](../../../assets/fides-studio.jsx#L827) (live) e [fides-dashboard.jsx:249](../../../assets/fides-dashboard.jsx#L249) (fallback /teste). Centralizar evita duplicar a interação. A geometria das fatias (`arcs`, com `label` e `val`) já existe dentro do `Donut`.
- **D-03: Exibição reusa o centro do donut.** Ao selecionar uma fatia, o centro (hoje "Total / R$x" — [fides-studio.jsx:828-830](../../../assets/fides-studio.jsx#L828)) troca para `{categoria} · {R$ valor} · {%}` da fatia ativa; ao sair, volta a "Total". **Escolhido por zero risco de corte na borda em 400px** (regra de ouro: funcionar em 400×512px iOS Safari). Tooltip flutuante posicionado na fatia foi rejeitado por risco de overflow na borda.
- **D-04: Interação.** Desktop = hover sobre a cor revela; mobile = tap na cor revela. Dismiss: tap fora fecha (mobile) / hover-out volta a "Total" (desktop). Conforme SPEC R2.
- **D-05: % do total.** O percentual = `val / total` da fatia; `total` já é computado dentro do `Donut` ([fides-charts.jsx:117](../../../assets/fides-charts.jsx#L117)).

### Claude's Discretion
- Áreas NÃO discutidas — resolver com base no SPEC durante research/planning:
  - **Issue #1 (budgetGroups):** trocar fonte de `plannedOverrides` para `categoryLimits` com regra `byMonth[selectedMonth]` → `default` → `null` (molde em `categoryUsage` [fides-store.jsx:1023-1056](../../../assets/fides-store.jsx#L1023)); limite do grupo = soma dos limites efetivos das filhas. Edge R1: grupo com soma 0 → estado "sem limite definido" em vez de 0% enganoso (texto/visual a critério do planner).
  - **Issue #3 (saldo projetado):** onde calcular (selector no store vs inline) e como derivar pendentes a receber/pagar fica a critério do planner, respeitando: `saldoProjetado = Σ(balance contas excl. cartões) + receitas previstas não recebidas − despesas previstas em aberto`; não recontar `settled`.
  - **Hero + fluxo negativo (P1):** como manter o fluxo mensal negativo visível junto do saldo projetado positivo (métricas Receitas/Despesas existentes vs texto) a critério do planner.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos travados
- `.planning/phases/01-veracidade-do-dashboard/01-SPEC.md` — 3 requisitos, boundaries, acceptance criteria, edge coverage, Prohibition P1. **Ler antes de planejar.**

### Invariantes de projeto
- `.planning/PROJECT.md` §3-4 — stack imutável (React Babel standalone, sem bundler/libs externas), arquivos protegidos (fides-charts.jsx incluído), regra de ouro 400×512px, "projeção ingênua proibida na UI", saldo derivado (`balance = opening_balance + SUM cleared`; pendente nunca afeta saldo).

### Código relevante (alvos da fase)
- `assets/fides-charts.jsx` §115-151 — `Donut` (alvo do tooltip; protegido, edição aprovada).
- `assets/fides-studio.jsx` §624-652 — `DashboardStudio`, cálculo de `saldoFinal` (alvo Issue #3) e consumo do `Donut` (§827).
- `assets/fides-store.jsx` §1058-1079 — `budgetGroups` (alvo Issue #1); §1023-1056 — `categoryUsage` (molde da regra de limite).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `categoryUsage` ([fides-store.jsx:1023-1056](../../../assets/fides-store.jsx#L1023)): molde exato da regra de leitura de limite (`byMonth[selectedMonth]` → `default` → `null`) que `budgetGroups` deve copiar.
- Centro do donut ("Total / R$x" — [fides-studio.jsx:828-830](../../../assets/fides-studio.jsx#L828)): superfície reusada para exibir a fatia ativa (D-03).
- `arcs` dentro do `Donut`: já carrega `label`, `val`, geometria por fatia — só falta wire de interação.
- `accounts.balance` via `useFides()` ([fides-studio.jsx:625](../../../assets/fides-studio.jsx#L625)): fonte do saldo para Issue #3.

### Established Patterns
- Donut exportado em `window` e consumido por 2 telas → mudança no `Donut` propaga p/ live e /teste (cuidar de regressão no fallback).
- Distinção `settled`/pendente já existe no store ([fides-store.jsx:1087](../../../assets/fides-store.jsx#L1087)) — base p/ evitar dupla contagem no saldo projetado.
- Tokens/CSS por componente; sem libs externas (tooltip = estado React + SVG/HTML inline).

### Integration Points
- `Donut` (fides-charts.jsx) ↔ centro do donut (fides-studio.jsx + fides-dashboard.jsx): o estado da fatia ativa precisa alimentar o conteúdo do centro. Decidir se o `Donut` renderiza o próprio centro ou expõe a fatia ativa via callback p/ o consumidor pintar o centro existente.

</code_context>

<specifics>
## Specific Ideas

- Usuário priorizou **robustez sobre estética** no tooltip: "não quero correr o risco de o texto cortar a borda de 400px" → centro do donut escolhido como solução zero-risco.

</specifics>

<deferred>
## Deferred Ideas

None — discussão ficou dentro do escopo da fase. Áreas não discutidas (Issue #1, Issue #3, hero+P1, estado "sem limite") permanecem no escopo da fase mas com decisões delegadas a research/planning sob as travas do SPEC.

</deferred>

---

*Phase: 1-veracidade-do-dashboard*
*Context gathered: 2026-06-28*
