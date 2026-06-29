# Phase 01: Veracidade do Dashboard — Research

**Researched:** 2026-06-28
**Domain:** React Babel standalone · in-place data fixes · inline SVG interaction
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: Arquivo protegido liberado.** `fides-charts.jsx` é arquivo protegido (PROJECT.md §4). O usuário aprovou explicitamente editar o `Donut` nesta fase. Exceção registrada — executor NÃO precisa pedir aval de novo, mas o toque deve ficar restrito ao necessário para o tooltip.
- **D-02: Estado + handlers dentro do `Donut`.** A interação (estado da fatia ativa + handlers hover/tap) vive dentro do componente `Donut` em `fides-charts.jsx`, não no consumidor. Razão: `Donut` é exportado global e usado por 2 consumidores (fides-studio.jsx + fides-dashboard.jsx). Centralizar evita duplicar a interação.
- **D-03: Exibição reusa o centro do donut.** Ao selecionar uma fatia, o centro (hoje "Total / R$x") troca para `{categoria} · {R$ valor} · {%}` da fatia ativa; ao sair, volta a "Total". Tooltip flutuante posicionado na fatia foi rejeitado por risco de overflow na borda.
- **D-04: Interação.** Desktop = hover sobre a cor revela; mobile = tap na cor revela. Dismiss: tap fora fecha (mobile) / hover-out volta a "Total" (desktop).
- **D-05: % do total.** O percentual = `val / total` da fatia; `total` já é computado dentro do `Donut` (fides-charts.jsx:117).

### Claude's Discretion

- **Issue #1 (budgetGroups):** trocar fonte de `plannedOverrides` para `categoryLimits` com regra `byMonth[selectedMonth]` → `default` → `null` (molde em `categoryUsage` fides-store.jsx:1023-1056); limite do grupo = soma dos limites efetivos das filhas. Edge R1: grupo com soma 0 → estado "sem limite definido" em vez de 0% enganoso (texto/visual a critério do planner).
- **Issue #3 (saldo projetado):** onde calcular (selector no store vs inline) e como derivar pendentes a receber/pagar fica a critério do planner, respeitando: `saldoProjetado = Σ(balance contas excl. cartões) + receitas previstas não recebidas − despesas previstas em aberto`; não recontar `settled`.
- **Hero + fluxo negativo (P1):** como manter o fluxo mensal negativo visível junto do saldo projetado positivo (métricas Receitas/Despesas existentes vs texto) a critério do planner.

### Deferred Ideas (OUT OF SCOPE)

None — discussão ficou dentro do escopo da fase.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R1 | Orçamento 50-30-20 lê limites reais: `budgetGroups` deriva limite de `categoryLimits`, não de `plannedOverrides`. Limite do grupo = soma dos limites efetivos das filhas. Grupo com soma 0 mostra estado "sem limite definido". | Molde exato em `categoryUsage` (fides-store.jsx:1023-1056); `budgetGroups` alvo em fides-store.jsx:1058-1079. |
| R2 | Fatias do donut identificáveis: hover (desktop) e tap (mobile) mostram categoria + valor + %; tap fora fecha. Tooltip implementado como estado React + SVG/HTML inline (sem lib externa). | `Donut` em fides-charts.jsx:116-151; dados `label`/`val` já existem em `arcs`; centro do donut (fides-studio.jsx:828-830) é a superfície de exibição. |
| R3 | Saldo projetado incorpora saldo atual: `saldoProjetado = Σ(balance contas excl. cartões) + receitas previstas não recebidas − despesas previstas em aberto`. Não recontar `settled`. Headline alterna "terminará livre" / "fechará no vermelho". Fluxo mensal negativo permanece visível. | `saldoFinal` atual em fides-studio.jsx:652; `accounts` via `useFides()` (fides-studio.jsx:625); distinção `settled`/pendente em fides-store.jsx:55. |
</phase_requirements>

---

## Summary

Esta fase corrige três pontos de "mentira" no DashboardStudio sem redesenhar nada. Toda a pesquisa é sobre o codebase existente — não há bibliotecas externas a instalar, não há schema novo a criar.

**R1 (budgetGroups)** é uma troca cirúrgica de uma linha de leitura de limite em `fides-store.jsx`. O padrão correto já existe ao lado, em `categoryUsage` (mesma função, mesma regra de prioridade). O único work além da troca é o edge case: grupos com soma 0 precisam de texto "sem limite" ao invés de "0%", porque `pct = 0/0 = NaN` ou `0/0 = 0` e exibir "0%" seria enganoso.

**R2 (tooltip do donut)** é a única mudança em `fides-charts.jsx` (arquivo protegido, edição aprovada). A decisão D-03 já resolveu o risco de overflow: a exibição é no centro do donut existente, não em tooltip flutuante. O `Donut` ganha `activeIdx` em state + handlers `onMouseEnter`/`onMouseLeave` nas paths + `onPointerDown` para mobile. O centro é controlado via prop callback ou — mais simples — via prop `activeSlice` que o consumidor já renderiza separadamente. A análise do código revela que o centro `.fds-donut-center` é renderizado pelo CONSUMIDOR (fides-studio.jsx:828-830 e fides-dashboard.jsx:250-252), não dentro do SVG. Isso cria uma decisão de arquitetura: o `Donut` precisa expor a fatia ativa para o consumidor pintar o centro, OU o `Donut` precisa renderizar o centro junto.

**R3 (saldo projetado)** é uma troca de fórmula inline em `DashboardStudio` (fides-studio.jsx:652). `accounts` já está disponível via `useFides()` (linha 625). A exclusão de cartões é feita construindo `cardIdSet` a partir de `cards` (padrão já usado no store). A distinção settled/pendente usa `t.settled` no modo live e `t.status === 'pago'` no mock — exatamente como nas funções existentes no store.

**Primary recommendation:** Implementar as três correções como edições cirúrgicas independentes nos três arquivos alvos, nesta ordem: R1 (store) → R2 (charts) → R3 (studio). Cada correção é autossuficiente; erros numa não bloqueiam as outras.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Leitura de limite por categoria (R1) | Store (`fides-store.jsx`) | — | `budgetGroups` é um `useMemo` no store; a troca de fonte de dados (`plannedOverrides` → `categoryLimits`) é uma mudança de lógica de derivação, não de UI |
| Interação de tooltip (R2) | Componente `Donut` (`fides-charts.jsx`) | Consumidor pinta centro | D-02 locked: estado + handlers vivem no `Donut`; o centro é HTML no consumidor |
| Cálculo do saldo projetado (R3) | `DashboardStudio` (`fides-studio.jsx`) | Store (opcional) | A fórmula inline atual (`saldoFinal`) é derivada localmente de `useFides()`; a nova fórmula segue o mesmo padrão inline — mover para o store seria refatoração além do escopo |
| Visibilidade do fluxo negativo (P1) | `DashboardStudio` hero | Métricas existentes | As métricas "Receitas / Despesas pagas / Em aberto" já mostram o fluxo — basta não as remover ao introduzir saldo projetado |

---

## Standard Stack

### Core (já instalado — sem instalação necessária)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 18 via Babel standalone | 18.x | Componentes, state, memos | Stack imutável do projeto [VERIFIED: PROJECT.md §3] |
| CSS puro | — | Estilos por componente | Sem CSS-in-JS; tokens em `tokens.css` [VERIFIED: PROJECT.md §3] |

### Nenhum pacote externo necessário

Esta fase não instala nenhuma dependência nova. Todos os mecanismos necessários (estado React, SVG inline, evento de pointer) estão disponíveis no runtime existente. [VERIFIED: PROJECT.md §3 + SPEC.md Constraints]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Centro do donut (D-03) | Tooltip flutuante SVG posicionado na fatia | Flutuante: risco de overflow na borda 400px; centro: zero risco, já existente |
| Inline em DashboardStudio (R3) | Novo selector em useFides() | Selector no store: mais reutilizável mas fora do escopo; inline: mínima mudança, segura |
| Edição em `fides-charts.jsx` (R2) | Reimplementar Donut no studio | Reimplementar: quebraria /teste; editar o original: 1 lugar, cobre 2 consumidores |

---

## Package Legitimacy Audit

> Nenhum pacote externo será instalado nesta fase.

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious (SUS):** none

---

## Architecture Patterns

### System Architecture Diagram

```
[Supabase: category_limits] ──load──▶ categoryLimits (state)
                                              │
                                     budgetGroups (useMemo)  ← CHANGE R1
                                              │
                                     DashboardStudio JSX ──▶ card "Para onde foi"

[Supabase: transactions] ──load──▶ monthTransactions (state)
                                              │
                              ┌───────────────┼────────────────┐
                              ▼               ▼                ▼
                         receitas        despesas          pendentes
                              │               │                │
                              └───────────────▼────────────────┘
                                      saldoFinal  ← CHANGE R3 → saldoProjetado
                                              │
                                    [accounts.balance] ←── ADDED (excludes cards)
                                              │
                                       EditorialHero headline

[spendByCategory] ──▶ Donut (fides-charts.jsx) ← CHANGE R2
                              │                        │
                      activeIdx (state)        arc paths (SVG)
                              │                   onMouseEnter/Leave
                              │                   onPointerDown
                              ▼
                    activeSlice callback/prop
                              │
                    fds-donut-center (HTML, in consumer)
                    shows: label · R$val · pct%
```

### Recommended Project Structure

Sem mudanças estruturais — arquivos existentes:

```
assets/
├── fides-store.jsx     # R1: budgetGroups (linha ~1066)
├── fides-charts.jsx    # R2: Donut tooltip (linhas 116-151) — protegido, edição aprovada
└── fides-studio.jsx    # R3: saldoProjetado (linha ~652) + hero headline (linha ~725)
```

### Pattern 1: Leitura de limite com prioridade byMonth → default → null

O padrão já existe em `categoryUsage` (fides-store.jsx:1023-1056) e deve ser COPIADO exatamente em `budgetGroups`:

```javascript
// Source: fides-store.jsx:1028-1033 [VERIFIED: codebase grep]
const lim = categoryLimits[cat_key];
const limit = lim
  ? (lim.byMonth && lim.byMonth[selectedMonth] != null
      ? lim.byMonth[selectedMonth]
      : (lim.default != null ? lim.default : null))
  : null;
```

O `budgetGroups` atual usa `plannedOverrides[id] ?? 0` (fides-store.jsx:1066) — trocar para o padrão acima por `cat_key` da categoria.

### Pattern 2: Tooltip via estado React no Donut (sem lib externa)

O componente `Donut` ganha um `activeIdx` em `useState`. Cada `<path>` recebe handlers de ponteiro. A fatia ativa é exposta para o consumidor via prop callback:

```javascript
// Source: decisão D-02/D-03 [ASSUMED — pattern estabelecido no codebase]
function Donut({ data, size, thickness, gap, accent, glow, onActiveSlice }) {
  const [activeIdx, setActiveIdx] = React.useState(null);
  // ...arcs computation mantida igual...
  
  const handleEnter = (i) => { setActiveIdx(i); onActiveSlice?.(arcs[i]); };
  const handleLeave = ()  => { setActiveIdx(null); onActiveSlice?.(null); };
  const handleTap   = (i, e) => { e.stopPropagation(); setActiveIdx(i); onActiveSlice?.(arcs[i]); };
  
  return (
    <svg ...>
      <g ...>
        {arcs.map((a, i) => (
          <path key={i} d={a.d} fill={a.tint}
            onMouseEnter={() => handleEnter(i)}
            onMouseLeave={handleLeave}
            onPointerDown={(e) => handleTap(i, e)}
            style={{ cursor: 'pointer' }}
          />
        ))}
      </g>
    </svg>
  );
}
```

O consumidor recebe `onActiveSlice` e controla o conteúdo do `.fds-donut-center`:

```javascript
// Source: padrão de composição React — centro é HTML no consumidor [ASSUMED]
const [activeSlice, setActiveSlice] = React.useState(null);
// ...
<div className="fds-donut-wrap"
     onPointerDown={e => { if (e.target === e.currentTarget) setActiveSlice(null); }}>
  <Donut data={spendByCategory} size={184} thickness={24} glow
         onActiveSlice={setActiveSlice}/>
  <div className="fds-donut-center" style={{ pointerEvents: 'none' }}>
    {activeSlice ? (
      <>
        <div className="fds-donut-label">{activeSlice.label}</div>
        <div className="fds-donut-value">{fmtBRL(activeSlice.val, { compact: true })}</div>
        <div className="fds-donut-label">{Math.round((activeSlice.val / totalSpend) * 100)}%</div>
      </>
    ) : (
      <>
        <div className="fds-donut-label">Total</div>
        <div className="fds-donut-value">{fmtBRL(totalSpend, { compact: true })}</div>
      </>
    )}
  </div>
</div>
```

**Nota crítica sobre dismiss no mobile:** o `onPointerDown` no `fds-donut-wrap` só funciona se `pointer-events: none` NÃO estiver no centro. O CSS atual tem `pointer-events: none` no `.fds-donut-center` (fides.css:613) — isso é correto para não bloquear eventos no SVG, mas o dismiss "tap fora" precisa de um listener no wrapper que não seja `pointer-events: none`. Alternativa mais robusta: listener global no `document` via `useEffect` que fecha em qualquer tap fora do SVG.

### Pattern 3: saldoProjetado — derivação inline

```javascript
// Source: análise de fides-studio.jsx:625-652 + PROJECT.md §4 [VERIFIED: codebase grep]
// accounts vem de useFides(); cards também.
const cardIdSet = new Set(cards.map(c => c.id));

// Saldo das contas correntes/poupança (exclui cartões)
const saldoContas = accounts.reduce((s, a) => s + (a.balance || 0), 0);
// accounts NÃO inclui cartões — accounts e cards são arrays separados no store.
// normalizeAccount não tem campo 'type' que precise ser filtrado para excluir cartões;
// a exclusão já é estrutural: accounts = contas, cards = cartões (dois arrays distintos).

// Pendentes do mês: só transações não-settled do mês selecionado, excluindo transferências
const flowPending = monthTransactions.filter(t => !t.isTransfer && !t.settled);
// No mock, 'settled' é false por default; usar t.status === 'pendente' como fallback
// Mas para uniformidade com o padrão do store: usar t.settled no live, t.status no mock.
// SIMPLIFICAÇÃO: o flow já está filtrado por monthTransactions (mês corrente);
// a distinção live/mock para settled é implícita via normalizeTx (linha 55: settled: !!row.settled)

const receitasPendentes = flowPending.filter(t => t.val > 0).reduce((s, t) => s + t.val, 0);
const despesasPendentes = flowPending.filter(t => t.val < 0).reduce((s, t) => s + Math.abs(t.val), 0);

const saldoProjetado = saldoContas + receitasPendentes - despesasPendentes;
```

**Atenção sobre `accounts` vs `cards`:** na normalização do store, `accounts` são linhas de `accounts` (correntes, poupança, reserva) e `cards` são linhas de `cards` (cartões). São arrays completamente separados em `useFides()`. Não há cartões no array `accounts`. A exclusão de cartões no R3 é portanto automática — basta somar `accounts.reduce(sum balance)` sem filtro adicional.

**Atenção sobre dupla contagem:** transações `settled` já entraram no `balance` via `recalc_account_balance`. Logo, só `!t.settled` (pendentes) devem ser aplicadas sobre `saldoContas`. No mock, `settled` é sempre `false` por `!!row.settled` quando a coluna não existe, então a lógica funciona nos dois modos.

### Anti-Patterns to Avoid

- **Filtrar `accounts` por tipo para excluir cartões:** ERRADO. No Fides, `accounts` e `cards` são arrays separados desde a query (fides-store.jsx:195-204). Não há `type === 'cartão'` em accounts.
- **Recontar transações `pago`/`settled` no saldo projetado:** ERRADO. `balance` já as incorpora via RPC. Somar `settled` novamente seria dupla contagem.
- **Tooltip flutuante posicionado via getBoundingClientRect:** REJEITADO (D-03). Regra de ouro 400×512px iOS Safari — borda esquerda/direita corta tooltip.
- **Usar `plannedOverrides` em budgetGroups:** é o bug que estamos corrigindo. `setPlanned` nunca é chamado; `plannedOverrides` sempre é `{}`.
- **Exportar `activeSlice` do Donut via window:** ERRADO. A comunicação entre Donut e consumidor é via prop callback (`onActiveSlice`), seguindo o padrão React local.
- **Remover as métricas Receitas/Despesas do hero ao introduzir saldo projetado:** viola Prohibition P1. O fluxo mensal negativo deve continuar visível.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exibição de valor em BRL | Formatter manual | `fmtBRL()` já existe no projeto | Função utilitária global no projeto |
| Cálculo de % da fatia | Divisão manual | `val / total` (total já computado em Donut) | `total` já está na linha 117 do Donut |
| Identificação de cartão vs conta | Filtro por tipo em accounts | Arrays separados `accounts` vs `cards` | Estrutura do store já separa os dois |
| Tooltip lib (Tippy, Radix, etc.) | Qualquer lib externa | Estado React + JSX inline | Stack Babel standalone — sem bundler/npm |

**Key insight:** Este projeto usa zero libs de UI. Toda interação é implementada com primitivos React + DOM events + CSS. A tentação de "instalar uma lib de tooltip" deve ser resistida — não existe npm install neste stack.

---

## Common Pitfalls

### Pitfall 1: Filtro de visibilidade em budgetGroups quebrando o display

**What goes wrong:** O `budgetGroups` atual tem um filtro `.filter(c => c._custom || plannedOverrides[c.cat] != null || c.spent > 0)` (linha 1073). Com a troca para `categoryLimits`, a condição de visibilidade muda: uma categoria com limite definido mas sem gasto deve aparecer. Se o filtro não for atualizado, categorias com limite mas sem gasto ficam invisíveis e o grupo parece ter limite menor.

**Why it happens:** O filtro foi escrito para `plannedOverrides` (que era sempre `{}`, então só `c.spent > 0` era verdadeiro). Com `categoryLimits` preenchido, a condição `plannedOverrides[c.cat] != null` sempre era falsa.

**How to avoid:** Atualizar o filtro para incluir categorias com limite efetivo: `c._custom || limit != null || c.spent > 0`, onde `limit` é o valor derivado da regra byMonth→default→null.

**Warning signs:** Grupo mostra limite somado diferente do Planejamento; % estranha; soma dos limites das filhas ≠ limite do grupo exibido.

### Pitfall 2: Centro do donut com pointer-events: none bloqueando dismiss

**What goes wrong:** `.fds-donut-center` tem `pointer-events: none` (fides.css:613). O dismiss "tap fora" baseado em `onPointerDown` no wrapper não propaga se o usuário tocar exatamente sobre o centro (que fica sobre o buraco do donut). No mobile, a área central visível tem ~60×60px de zona morta para dismiss.

**Why it happens:** `pointer-events: none` foi colocado para que cliques passem através do label central e cheguem ao SVG. O dismiss no mesmo elemento fica sem receptor.

**How to avoid:** Implementar dismiss via `useEffect` que adiciona um listener `pointerdown` no `document` e fecha a fatia ativa quando o target não é o SVG do donut. Limpar o listener no cleanup. Alternativamente, adicionar um elemento invisível cobrindo o centro com `pointer-events: auto` que ao ser clicado fecha a fatia.

**Warning signs:** No iOS Safari, tocar no número central não fecha a fatia ativa.

### Pitfall 3: saldoProjetado com NaN quando accounts está vazio

**What goes wrong:** `accounts.reduce((s, a) => s + a.balance, 0)` retorna `NaN` se `a.balance` for `undefined` (conta sem saldo inicializado).

**Why it happens:** `normalizeAccount` faz `balance: Number(row.balance)` — se `row.balance` for `null` ou ausente, `Number(null) = 0` (seguro), mas vale confirmar.

**How to avoid:** Usar `(a.balance || 0)` como guarda extra: `accounts.reduce((s, a) => s + (a.balance || 0), 0)`.

**Warning signs:** Hero exibe "NaN" ou "R$" sem número.

### Pitfall 4: `monthTransactions` inclui transações de cartão no saldo projetado

**What goes wrong:** `monthTransactions` contém todas as transações do mês, incluindo as de cartão (onde `t.acct` é o id de um cartão). Se somar receitas e despesas pendentes sem excluir transferências, pode distorcer o saldo projetado.

**Why it happens:** O flag `isTransfer` é o filtro padrão do projeto para excluir movimentações internas do agregado de gastos. Pagamento de fatura de cartão tem `isTransfer = true`.

**How to avoid:** Manter o filtro `!t.isTransfer` nos pendentes, exatamente como no `flow` existente (fides-studio.jsx:645).

**Warning signs:** Saldo projetado difere do esperado em meses com pagamento de fatura.

### Pitfall 5: Regressão no consumidor fides-dashboard.jsx

**What goes wrong:** `fides-dashboard.jsx` (rota `/teste`) também usa `<Donut>` (linha 249). Se o `Donut` ganhar `onActiveSlice` como prop e o consumidor não passar o callback, a interação simplesmente não funcionará lá — o que é aceitável. Mas se o Donut renderizar o centro internamente (alternativa rejeitada), vai conflitar com o centro HTML existente em fides-dashboard.jsx:250-252.

**Why it happens:** Dois consumidores independentes para o mesmo componente compartilhado.

**How to avoid:** Confirmar que `onActiveSlice` é prop opcional (`onActiveSlice?.(...)`). O Donut nunca renderiza o centro — o consumidor mantém total controle do `.fds-donut-center`. Testar visualmente no `/teste` após a mudança.

**Warning signs:** Centro do donut no `/teste` duplicado ou sobreposto.

---

## Code Examples

### Leitura de limite exata (molde categoryUsage)

```javascript
// Source: fides-store.jsx:1028-1033 [VERIFIED: codebase grep]
const lim = categoryLimits[cat_key];
const limit = lim
  ? (lim.byMonth && lim.byMonth[selectedMonth] != null
      ? lim.byMonth[selectedMonth]
      : (lim.default != null ? lim.default : null))
  : null;
```

### budgetGroups — diff conceitual para R1

```javascript
// ANTES (linha 1066):
const limit = plannedOverrides[id] ?? 0;

// DEPOIS — usar regra byMonth→default→null igual a categoryUsage:
const lim = categoryLimits[id];
const limit = lim
  ? (lim.byMonth && lim.byMonth[selectedMonth] != null
      ? lim.byMonth[selectedMonth]
      : (lim.default != null ? lim.default : null))
  : null;
// limite do grupo = soma dos limites efetivos das filhas (null contribui 0):
// na linha 1075: const limit = cats.reduce((s, c) => s + (c.limit || 0), 0);
```

### Donut — assinatura alterada para R2

```javascript
// Source: fides-charts.jsx:116 [VERIFIED: codebase grep] — assinatura atual
function Donut({ data, size = 200, thickness = 22, gap = 0.012, accent = '#B45309', glow = false }) {

// DEPOIS — adicionar prop opcional:
function Donut({ data, size = 200, thickness = 22, gap = 0.012, accent = '#B45309', glow = false, onActiveSlice }) {
  const [activeIdx, setActiveIdx] = React.useState(null);
  // ... manter total e arcs sem mudança ...
  // Nos paths, adicionar handlers:
  // onMouseEnter={() => { setActiveIdx(i); onActiveSlice?.(arcs[i]); }}
  // onMouseLeave={() => { setActiveIdx(null); onActiveSlice?.(null); }}
  // onPointerDown={(e) => { e.stopPropagation(); setActiveIdx(i); onActiveSlice?.(arcs[i]); }}
```

### saldoProjetado — fórmula para R3

```javascript
// Source: análise fides-studio.jsx:625-652 + fides-store.jsx:61-71 [VERIFIED: codebase grep]
// Disponível via: const { ..., accounts, cards, ... } = useFides();
const saldoContas = accounts.reduce((s, a) => s + (a.balance || 0), 0);
// accounts e cards são arrays SEPARADOS — accounts nunca contém cartões.

const flowPending = monthTransactions.filter(t => !t.isTransfer && !t.settled);
const receitasPendentes = flowPending.filter(t => t.val > 0).reduce((s, t) => s + t.val, 0);
const despesasPendentes = flowPending.filter(t => t.val < 0).reduce((s, t) => s + Math.abs(t.val), 0);

const saldoProjetado = saldoContas + receitasPendentes - despesasPendentes;
// fluxoMensal = receitaTotal - despesas - pendentes  (mantém para P1)
```

### Estado "sem limite definido" para R1 edge case

```javascript
// Source: raciocínio aplicado ao budgetGroups [ASSUMED]
// Quando g.limit === null (nenhuma filha tem limite), mostrar estado neutro:
const pct = g.limit != null ? g.spent / g.limit : null;
// Na renderização:
// {pct === null ? 'Sem limite' : `${Math.round(pct * 100)}%`}
// ProgressBar value={pct ?? 0}  — barra vazia quando sem limite
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `plannedOverrides[id] ?? 0` em budgetGroups | Mesma regra de `categoryUsage` usando `categoryLimits` | Esta fase | Limites reais aparecem no card |
| `saldoFinal = receitaTotal − despesas − pendentes` | `saldoProjetado = saldoContas + pendentes_receber − pendentes_pagar` | Esta fase | Hero reflete realidade financeira |
| Donut sem interação | Donut com `onActiveSlice` + centro dinâmico | Esta fase | Fatias identificáveis |

**Deprecated/outdated:**
- `plannedOverrides` / `setPlanned`: nunca foi chamado em produção; após R1 a fonte de dados é `categoryLimits`. `setPlanned` pode ser removido como limpeza opcional.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `onActiveSlice` como prop callback é a melhor interface para comunicar fatia ativa do Donut ao consumidor | Architecture Patterns / Pattern 2 | Alternativa: Donut renderiza o centro internamente — exigiria mais mudança no SVG e conflitaria com HTML existente nos consumidores |
| A2 | Dismiss global via `document.addEventListener('pointerdown', ...)` em `useEffect` é a forma mais robusta de fechar no mobile | Architecture Patterns / Pattern 2 | Alternativa: `onPointerDown` no wrapper pode ser suficiente se `pointer-events` do center não interferir |
| A3 | `flowPending = monthTransactions.filter(!isTransfer && !settled)` captura exatamente as receitas/despesas pendentes sem dupla contagem | Code Examples / R3 | Se `!t.settled` não está correto no mock (onde `settled` pode ser `false` em transações pagas), usar fallback: `mode === 'live' ? !t.settled : t.status !== 'pago'` |
| A4 | Edge case de grupo com `limit === null`: exibir "Sem limite" é suficiente como estado neutro | Common Pitfalls / Pattern budgetGroups | Visual alternativo (barra cinza, texto diferente) fica a critério do planner; o critério de não mostrar "0%" é o requisito |

**Se esta tabela não estiver vazia:** claims A1–A4 precisam de confirmação do planner antes de serem decisions travadas. A1 e A2 são escolhas de implementação de R2; A3 é detalhe de R3; A4 é visual do edge case R1.

---

## Open Questions

1. **Visibilidade do fluxo negativo (P1) — como comunicar no hero**
   - What we know: o hero atual mostra `saldoFinal` na headline + as métricas "Receitas / Despesas pagas / Em aberto" no grid de métricas (fides-studio.jsx:748-781).
   - What's unclear: quando `saldoProjetado > 0` mas `(receitaTotal - despesas - pendentes) < 0`, onde exatamente aparece o aviso de fluxo negativo? As métricas existentes mostram os valores individuais, mas não somam "fluxo = X" explicitamente.
   - Recommendation: manter as métricas existentes (elas já mostram Receitas e Despesas separadamente). Adicionar texto no `lede` do hero quando `fluxoMensal < 0 && saldoProjetado >= 0`: ex. "Apesar do saldo positivo, o fluxo do mês é negativo (−R$X)". Decisão de texto fica com o planner.

2. **Dismiss no mobile: listener de documento vs wrapper**
   - What we know: `.fds-donut-center` tem `pointer-events: none` (fides.css:613); o dismiss "tap fora" precisa funcionar fora do SVG.
   - What's unclear: qual área específica deve fechar? Qualquer tap na página? Tap no card wrapper?
   - Recommendation: `useEffect` com `document.addEventListener('pointerdown', handler)` é o mais previsível. O handler checa se `event.target` está dentro do SVG do donut (usando `ref`) e, se não, chama `onActiveSlice(null)`.

---

## Environment Availability

> Skip: fase é puramente code/config — sem dependências externas além do stack existente.

---

## Validation Architecture

> Sem suíte de testes automatizados no projeto (SPEC.md: "Sem suíte de testes automatizados — aceitação verificada por observação no app pós-deploy Vercel"). Seção de automação não aplicável.

### Acceptance Verification (manual)

| AC | Behavior | Verification Method |
|----|----------|---------------------|
| AC-R1a | Card "Para onde foi" exibe limite > 0 quando há limites no Planejamento | Abrir Dashboard com mês que tem limites; verificar coluna "limite" no card |
| AC-R1b | Limite do grupo = soma dos limites das filhas | Conferir no Planejamento: soma manual das categorias do grupo |
| AC-R1c | Grupo sem limite mostra estado neutro (não "0%") | Verificar grupo sem nenhuma categoria com limite |
| AC-R2a | Hover em fatia no desktop mostra label + valor + % | Chrome DevTools em desktop |
| AC-R2b | Tap em fatia no mobile mostra mesma info | iPhone Safari 400px (ou DevTools mobile emulation) |
| AC-R2c | Tap fora fecha a exibição | Tocar fora do SVG enquanto fatia ativa |
| AC-R3a | Hero positivo quando saldo de contas cobre o fluxo negativo | Verificar com contas reais (~R$7.346 de saldo) |
| AC-R3b | Sem dupla contagem: conferir com mês 100% liquidado | Mês onde tudo está settled; projeção = saldo das contas |
| AC-R3c | Headline alterna corretamente (livre / no vermelho) | Verificar nos dois sentidos |
| AC-P1 | Fluxo mensal negativo visível quando `receitaTotal < despesas+pendentes` | Verificar Junho (mês em uso real do usuário) |

**Deploy:** push em `main` → Vercel (~2 min) → verificação em https://fides-money.vercel.app

---

## Security Domain

> Nenhuma mudança de autenticação, sessão, acesso a dados, ou criptografia. Fase é read-only sobre dados já carregados em memória. Nenhuma categoria ASVS aplicável.

---

## Sources

### Primary (HIGH confidence — verificado via codebase)

- `assets/fides-store.jsx:1023-1056` — `categoryUsage`: molde exato da regra byMonth→default→null [VERIFIED: codebase grep]
- `assets/fides-store.jsx:1058-1079` — `budgetGroups`: código atual a ser corrigido [VERIFIED: codebase grep]
- `assets/fides-charts.jsx:115-151` — `Donut`: componente alvo do R2 [VERIFIED: codebase grep]
- `assets/fides-studio.jsx:624-652` — `DashboardStudio` + `saldoFinal`: alvo do R3 [VERIFIED: codebase grep]
- `assets/fides-studio.jsx:718-782` — hero, métricas, estrutura JSX [VERIFIED: codebase grep]
- `assets/fides-studio.jsx:826-832` — `fds-donut-wrap` + centro: superfície de exibição do tooltip [VERIFIED: codebase grep]
- `assets/fides.css:608-621` — `.fds-donut-center` CSS: `pointer-events: none` + layout [VERIFIED: codebase grep]
- `assets/fides-store.jsx:61-71` — `normalizeAccount`: `balance: Number(row.balance)` [VERIFIED: codebase grep]
- `assets/fides-store.jsx:55` — `settled: !!row.settled` [VERIFIED: codebase grep]
- `.planning/PROJECT.md §3-4` — stack imutável, regra de ouro 400px [VERIFIED: file read]
- `.planning/phases/01-veracidade-do-dashboard/01-SPEC.md` — 3 requisitos, boundaries, AC [VERIFIED: file read]
- `.planning/phases/01-veracidade-do-dashboard/01-CONTEXT.md` — D-01 a D-05 locked [VERIFIED: file read]

### Tertiary (LOW confidence — raciocínio local)

- Estratégia de dismiss via `document.addEventListener` — baseada em padrão React comum [ASSUMED A2]
- Edge visual "Sem limite" — texto/cor a definir pelo planner [ASSUMED A4]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — stack imutável definido em PROJECT.md, sem nada novo
- Architecture R1: HIGH — molde exato existe em categoryUsage, linha a linha
- Architecture R2: HIGH (lógica) / MEDIUM (dismiss mobile) — interação com pointer-events no centro cria um pitfall real que A2 trata como assumption
- Architecture R3: HIGH — fórmula direta, arrays accounts/cards são separados desde o schema
- Pitfalls: HIGH — todos derivados de leitura direta do código existente

**Research date:** 2026-06-28
**Valid until:** 2026-07-28 (stack estável, sem libs externas, código não muda sem commits)
