# Phase 9: Transações — power tools + analytics — Research

**Researched:** 2026-07-02
**Domain:** React (Babel-standalone, sem build step) + Supabase client-side aggregation + browser-native export/persistência
**Confidence:** HIGH

## Summary

Phase 9 não tem CONTEXT.md — o bloco de escopo do ROADMAP (datado 2026-07-02) faz esse papel. A leitura completa de `fides-transacoes.jsx` (1653 linhas) e `fides-store.jsx` (1688 linhas) mudou a forma de abordar 2 dos 8 itens do escopo:

1. **Export CSV/OFX e Import CSV/OFX já existem e estão em produção** (`handleExport`/`handleImport`, `fides-transacoes.jsx:314-440`, commits `2910c2d`/`21e7632`, anteriores ao próprio REQUIREMENTS.md v1.1). CSV export já honra filtros ativos (usa `filtered`), já tem BOM UTF-8 para Excel PT-BR (`'﻿' + csv`), já escapa aspas na descrição. **Não reconstruir — auditar e estender** (ordem de export vs. sort ativo; comportamento quando "ver range" estiver ligado).
2. **`categoryUsage`** (limite × gasto por categoria no mês, `fides-store.jsx:1120-1153`) já existe no store e não é usado em `fides-transacoes.jsx`. É a base pronta para UX-02 (preview de limite no modal Nova Transação) — não precisa de novo cálculo, só wiring.

Os demais 6 itens são trabalho novo genuíno: filtro "Cartões" dedicado, paginação client-side, `spendByCategory` cross-month (hoje travado em `selectedMonth`), visão de range na lista, persistência de filtro/sort/mês via `localStorage`, e o command palette ⌘K (o masthead já tem o afordance visual pronto — input `readOnly` com `<kbd>⌘K</kbd>` em `fides-studio.jsx:481-484` — só falta o comportamento).

Todo o trabalho é client-only: `transactions` já vem inteiro (sem paginação, sem filtro de mês) do Supabase em `refreshData` (`fides-store.jsx:234`, `select('*').eq('user_id', uid)`), então range cross-month e paginação não precisam de novas queries — é reprocessamento em memória do que já está carregado.

**Primary recommendation:** Trate o export CSV como item de auditoria/extensão (não greenfield); implemente `spendByCategoryRange` como uma NOVA derivação no store (não altere a assinatura de `spendByCategory`, que é consumida por `DashboardStudio` e `fides-claude.jsx`); centralize filtro+sort+mês+range num único objeto de estado persistido em `localStorage` sob o prefixo `fides:tx.*` (convenção já usada em `fides-orcamento.jsx:809`); monte o ⌘K no `FidesStudioShell` (que já tem `setActive` para navegação) e ligue-o ao input existente do masthead.

<phase_requirements>
## Phase Requirements

Não há REQ-IDs formais (ROADMAP: "Sem REQ-IDs formais até /gsd-plan-phase"). Proponho os seguintes sub-requisitos plantáveis, derivados do bloco de escopo do ROADMAP + REQUIREMENTS.md (UX-01/UX-02 formais). O planner deve promovê-los a IDs reais no PLAN.md.

| ID proposto | Descrição | Suporte da pesquisa |
|----|-------------|------------------|
| TX-01 | Filtro "Cartões" dedicado em `TxAdvFiltersModal` | `cards` já vem no contexto (`useFides().cards`); `acctNameOf()` já distingue `kind: 'cartao'` vs `'conta'` (`fides-transacoes.jsx:37-43`) — ver Pattern 1 |
| TX-02 | Paginação da lista + seletor de qtd 20/50/100 | `grouped.map` hoje renderiza tudo (`fides-transacoes.jsx:753-882`); dados já estão 100% em memória — ver Pattern 2 e Pitfall 1 |
| TX-03 | `spendByCategory` cross-month com range (3m/6m/12m/ano/custom), honrando `is_transfer` | `spendByCategory` hoje trava em `monthTransactions` (`fides-store.jsx:1106-1115`); `transactions` completo já está em memória — ver Pattern 3 |
| TX-04 | Ver range/múltiplos meses na lista de transações (desbloqueia TX-03) | Requer nova derivação `rangeTransactions` paralela a `monthTransactions`; mesmo dado-fonte — ver Pattern 3 |
| TX-05 | Export CSV honra filtros+range ativos; auditoria do que já existe | **Já implementado** (`fides-transacoes.jsx:350-369`) — ver Summary achado #1 |
| TX-06 | Persistir filtro/sort/mês (e range) no reload via `localStorage` | Convenção já usada em `fides-orcamento.jsx:809-819` — ver Pattern 5 |
| TX-07 (absorve UX-01/B7) | Command palette ⌘K global | Afordance visual já existe e está morta em `fides-studio.jsx:481-484`; shell tem `setActive` — ver Pattern 6 |
| TX-08 (absorve UX-02/B2) | Preview de limite de categoria no modal Nova Transação ("após esta transação: X restante") | `categoryUsage` já existe pronto no store (`fides-store.jsx:1120-1153`), não usado em `NovaTransacaoModal` hoje — ver Pattern 7 |

**Nota de nomenclatura:** REQUIREMENTS.md UX-02 diz "preview de limite da **categoria** selecionada" — não limite de cartão de crédito. O bloco de escopo do ROADMAP fala em termos ambíguos ("preview de limite no modal"); tratei REQUIREMENTS.md como fonte de verdade por ser o documento formal de rastreabilidade.
</phase_requirements>

## Architectural Responsibility Map

Projeto de uma camada só: browser (React via Babel-standalone) fala direto com Supabase via `fidesDb`/`fidesAuth`. Não há servidor de aplicação intermediário para estas features — `api/assistant.js` é só o assistente IA e não participa desta fase.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Filtro Cartões | Browser/Client | — | `cards`/`accounts` já carregados; filtragem é `.filter()` em memória, sem query nova |
| Paginação + seletor qtd | Browser/Client | — | `transactions` já é 100% client-side (sem paginação de servidor); slice puro |
| `spendByCategory` cross-month | Browser/Client | Database (leitura já feita) | Agregação sobre `transactions` já carregado; nenhuma nova query Supabase necessária |
| Ver range na lista | Browser/Client | — | Mesmo dado-fonte de `transactions`; novo filtro de datas client-side |
| Export CSV | Browser/Client | — | Já é `Blob`+`<a download>` puro, zero dependência (existente) |
| Persistência filtro/sort/mês | Browser/Client (`localStorage`) | — | Client-only por decisão explícita do escopo (sem migração este phase) |
| Command palette ⌘K | Browser/Client | — | Navegação client-side (`setActive`) + busca sobre dados já em memória |
| Preview limite categoria | Browser/Client | Database (leitura já feita) | `categoryUsage` já deriva de `categoryLimits` (Supabase) + `spendByCategory`, ambos já carregados |

## Standard Stack

### Core

Nenhuma biblioteca nova. Stack já fixado pelo CLAUDE.md: React 18.3.1 UMD + Babel-standalone 7.29.0 (CDN, `index.html:118-120`), sem bundler, sem npm install em runtime. Todo código desta fase deve ser JS executável direto pelo Babel in-browser (`<script type="text/babel">`).

| Recurso | Fonte | Propósito | Por que é o padrão aqui |
|---------|-------|-----------|--------------|
| `Blob` + `URL.createObjectURL` | Browser nativo | Export CSV/OFX | Já em uso (`fides-transacoes.jsx:345-349`, `363-367`) — zero-dependência, funciona em todos navegadores modernos |
| `localStorage` | Browser nativo | Persistência filtro/sort/mês | Já em uso no projeto (`fides-orcamento.jsx:809-819`, `design-canvas.jsx:281-291`) — convenção estabelecida `try{}catch(_){}`+ `useState(() => ...)` |
| `document.addEventListener('keydown', ...)` | Browser nativo | Atalho ⌘K global | Padrão já usado em `fides-ui.jsx:126-127` (Escape/Enter no ConfirmDialog) e `design-canvas.jsx:224/848` |
| `Array.prototype.slice` | JS nativo | Paginação client-side | Todo o dado já está em `transactions` (state React); não há API de paginação de servidor a chamar |

### Supporting

Nenhuma. Nenhum novo componente de UI de terceiros é necessário — `fds-chip`, `fds-seg`, `parc-chip`/`parc-stepper` (já existentes em `fides-transacoes.jsx:1474-1490`) cobrem os padrões visuais de seletor de quantidade e range de chips.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `localStorage` puro | `IndexedDB` | Overkill para poucos KB de preferências de filtro; sem justificativa dado o volume de dado |
| Paginação client-side (slice) | Paginação de servidor (Supabase `.range()`) | `refreshData` já busca tudo de uma vez (`fides-store.jsx:234`); mudar para paginação de servidor quebraria `spendByCategory`/`budgetGroups`/`faturasPorCartao`, que dependem do dataset completo em memória. Fora de escopo desta fase. |
| Biblioteca de command palette (ex: `cmdk`) | Componente próprio em ~100 linhas | CDN global script seria necessário (sem npm); dado o escopo pequeno (navegar entre 6 páginas + buscar transações), componente próprio é mais simples e sem dependência externa |

**Installation:** N/A — zero pacotes novos. Nenhum `npm install` necessário (projeto não tem build step; `package.json` só declara `@supabase/supabase-js`, que já está em uso e é carregado via CDN em `index.html:14`).

## Package Legitimacy Audit

**N/A para esta fase.** Nenhum pacote novo será instalado — todas as features usam APIs nativas do browser (`Blob`, `localStorage`, `document.addEventListener`) já em uso no projeto. Gate de legitimidade de pacotes pulado por ausência de instalação.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ Browser (React 18 UMD + Babel-standalone, sem bundler)               │
│                                                                       │
│  App() ──renders──> FidesStudio ──wraps──> FidesProvider (context)   │
│                                                  │                    │
│                                                  ▼                    │
│                                        FidesStudioGuard               │
│                                                  │                    │
│                                                  ▼                    │
│                                    FidesStudioShell (active, setActive)│
│                          ┌───────────────────────┼──────────────┐    │
│                          │                        │              │    │
│                    StudioMasthead          TransacoesStudio   [Cmd K  │
│              (input readOnly + ⌘K kbd)    (wraps <Transacoes/>) palette│
│                          │                        │           NEW]   │
│                    [wire onClick──────►    ┌──────┴───────┐    │    │
│                     abre palette]           │  Transacoes  │◄───┘    │
│                                              │  (filtered/  │         │
│                                              │  sorted/     │         │
│                                              │  grouped/    │         │
│                                              │  PAGED[NEW]) │         │
│                                              └──────┬───────┘         │
│                                                     │                 │
│                          ┌──────────────────────────┼──────────┐     │
│                          ▼                          ▼          ▼     │
│                 TxAdvFiltersModal          handleExport   localStorage│
│              (+ seção Cartões [NEW])       (já existe)    (filtro/   │
│                                                             sort/mês  │
│                                                             [NEW])    │
└─────────────────────────────────────────────────────┬───────────────┘
                                                        │
                                                        ▼
                                        FidesProvider (fides-store.jsx)
                                          state: transactions (TODO já
                                          carregado — sem paginação de
                                          servidor), accounts, cards,
                                          categoryLimits
                                          derived: monthTransactions,
                                          spendByCategory (mês único),
                                          spendByCategoryRange [NEW —
                                          reusa `transactions` completo],
                                          categoryUsage (já existe,
                                          não usado em Transações)
                                                        │
                                                        ▼
                                          Supabase (select * já feito em
                                          refreshData — sem query nova
                                          nesta fase)
```

### Recommended Project Structure

Sem novos arquivos — projeto usa scripts `.jsx` carregados via `<script type="text/babel">` em `index.html` (sem módulos ES). Toda mudança entra nos 2 arquivos já mapeados pelo escopo:

```
assets/
├── fides-store.jsx        # + spendByCategoryRange, + monthsInRange helper
├── fides-transacoes.jsx   # + paginação, + filtro Cartões, + range picker,
│                          #   + localStorage wiring, + preview de limite
└── fides-studio.jsx       # + Command palette ⌘K (novo componente local),
                            #   wiring do input readOnly existente
```

### Pattern 1: Filtro "Cartões" dedicado (TX-01)

**What:** Hoje `TxAdvFiltersModal` mistura contas e cartões num único array `draft.contasSelected` (`fides-transacoes.jsx:62-67`, `107-121`). A distinção cartão-vs-conta já existe via `acctNameOf()`:

```jsx
// Source: fides-transacoes.jsx:37-43 (já existe)
function acctNameOf(id, accounts, cards) {
  var a = accounts.find(function(x) { return x.id === id; });
  if (a) return { name: a.name, color: a.color, kind: 'conta' };
  var c = cards.find(function(x) { return x.id === id; });
  if (c) return { name: c.name, color: c.color || 'var(--ink-3)', kind: 'cartao' };
  return null;
}
```

**When to use:** Separar visualmente a seção "Contas e cartões" do modal em duas subseções rotuladas ("Contas" / "Cartões"), mantendo o mesmo array `contasSelected` (IDs já são únicos entre as duas coleções — não há colisão). Adicionar um atalho "Selecionar todos os cartões" que popula `contasSelected` com `cards.map(c => c.id)`.

**Nota de performance:** `acctNameOf` faz `.find()` linear por transação a cada render — aceitável no volume atual, mas se o filtro "Cartões" precisar checar "é transação de cartão" em massa (ex.: pré-computar contagem de cartão vs conta), prefira montar um `Set` uma vez via `React.useMemo(() => new Set(cards.map(c => c.id)), [cards])`, no mesmo espírito do `cardIdSet` que já existe em 5 lugares dentro de `fides-store.jsx` (linhas 197, 449, 1188, 1209, 1266) — é um padrão local recorrente no projeto, não uma função exportada única.

### Pattern 2: Paginação client-side (TX-02)

**What:** `grouped` (`fides-transacoes.jsx:282-311`) transforma `sorted` num array plano de `{type:'header'|'tx', ...}` para renderizar grupos colapsáveis. Paginar **depois** do agrupamento quebra a contagem/soma do grupo (mostraria só os itens da página, não do grupo inteiro); paginar **antes** do agrupamento (sobre `sorted`) preserva a semântica de "grupo = tudo daquela categoria/conta no filtro atual" mas description do cabeçalho.

**Recomendação:** paginar sobre `sorted` (a lista plana ordenada) e só então rodar o agrupamento sobre a fatia paginada — mesma função `grouped`, input trocado de `sorted` para `pagedSorted`. Isso significa que ao ordenar por Categoria/Conta com paginação ativa, o card do grupo mostra soma/contagem só do que está naquela página, não do total do filtro — **flagar isso explicitamente na UI** (ex.: "12 de 340 transações" já existe em `fides-tx-v2-list-count`, `fides-transacoes.jsx:715-717`, reaproveitar o padrão).

```jsx
// Padrão recomendado — inserir entre `sorted` (já existe, linha 244) e `grouped` (linha 282)
const [pageSize, setPageSize] = React.useState(20); // 20 | 50 | 100
const [page, setPage] = React.useState(0);
React.useEffect(() => { setPage(0); }, [filtered, sortBy, sortOrder, pageSize]); // reset ao mudar filtro/sort

const pagedSorted = React.useMemo(() =>
  sorted.slice(page * pageSize, (page + 1) * pageSize),
[sorted, page, pageSize]);

// `grouped` (fides-transacoes.jsx:282) passa a receber `pagedSorted` em vez de `sorted`
```

**Pitfall relacionado:** o checkbox "Selecionar todas" (`toggleSelectAll`, linha 474-479) hoje itera sobre `sorted` inteiro. Se não for ajustado, "selecionar todas" após paginação seleciona TODAS as páginas silenciosamente — decisão de produto a expor claramente na UI (ex.: "selecionar todas as 340" vs "selecionar as 20 desta página").

### Pattern 3: `spendByCategory` cross-month com range (TX-03/TX-04)

**What:** hoje travado em `monthTransactions` (que filtra `transactions` por `txMonth(t) === selectedMonth`):

```jsx
// Source: fides-store.jsx:1106-1115 (implementação atual — NÃO alterar assinatura,
// é consumida por DashboardStudio (fides-studio.jsx:646/691-692/857/869/890-891)
// e por fides-claude.jsx:24/107 para contexto da IA)
const spendByCategory = React.useMemo(() => {
  const map = {};
  monthTransactions.forEach(t => {
    if (t.val < 0 && !t.isTransfer) map[t.cat] = (map[t.cat] || 0) + Math.abs(t.val);
  });
  return Object.entries(map).map(([key, val]) => {
    const c = categories[key] || { label: key, tint: '#888', emoji: '🏷️' };
    return { key, val, label: c.label, tint: c.tint, emoji: c.emoji };
  }).sort((a, b) => b.val - a.val);
}, [monthTransactions, categories]);
```

**Recomendação:** adicionar uma NOVA derivação `spendByCategoryRange` que aceite `fromYM`/`toYM` (strings `YYYY-MM`) e itere sobre `transactions` (o array completo, já em memória — não `monthTransactions`), mesma lógica de `is_transfer`:

```jsx
// Novo helper de range, ao lado de prevMonth (fides-store.jsx:1049)
function monthsInRange(fromYM, toYM) {
  const out = [];
  let [y, m] = fromYM.split('-').map(Number);
  const [ey, em] = toYM.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

// Novo — não substitui spendByCategory (usado por Dashboard/IA)
const spendByCategoryRange = React.useCallback((fromYM, toYM) => {
  const months = new Set(monthsInRange(fromYM, toYM));
  const map = {};
  transactions.forEach(t => {
    if (t.val < 0 && !t.isTransfer && months.has(t.mes)) {
      map[t.cat] = (map[t.cat] || 0) + Math.abs(t.val);
    }
  });
  return Object.entries(map).map(([key, val]) => {
    const c = categories[key] || { label: key, tint: '#888', emoji: '🏷️' };
    return { key, val, label: c.label, tint: c.tint, emoji: c.emoji };
  }).sort((a, b) => b.val - a.val);
}, [transactions, categories]);
```

Expor `spendByCategoryRange` (e opcionalmente `monthsInRange`) no `value` do provider (`fides-store.jsx:1342-1379`) e no fallback de `useFides()` (linha 1392-1424), sem remover `spendByCategory`.

**Reuso de chart:** `Donut` (`fides-charts.jsx:116`) e `CategoryChart` (`fides-charts.jsx:253`) já aceitam qualquer array `{key,val,label,tint,emoji}` — o mesmo componente do Dashboard pode ser reaproveitado em Transações alimentado por `spendByCategoryRange(...)`, sem alterar os componentes de chart.

**"Ver range" na lista (TX-04):** a lista hoje usa `baseList = monthTransactions` (linha 198). Para suportar múltiplos meses na visualização, criar uma segunda derivação `rangeTransactions` no store (mesmo padrão do range acima, mas sem filtrar `is_transfer`/`val<0`, pois a lista mostra tudo), e trocar `baseList` em `Transacoes` por uma escolha entre `monthTransactions` (modo mês único, atual) e `rangeTransactions` (modo range), controlada por um toggle de UI.

### Pattern 4: Filtragem sobre `is_transfer`

**What:** convenção já estabelecida em todo o arquivo — `is_transfer` (mapeado para `t.isTransfer` em `normalizeTx`, `fides-store.jsx:57`) sempre exclui de somas de receita/despesa/gasto por categoria, mas **não** é excluído da lista de transações em si (aparece com badge/ícone `↔`, `fides-transacoes.jsx:793/824`). Qualquer novo cálculo de analytics cross-month deve replicar exatamente o padrão `t.val < 0 && !t.isTransfer` já usado em `spendByCategory`, `budgetGroups` (linha 1170) e `totals` do componente `Transacoes` (linha 444).

### Pattern 5: Persistência filtro/sort/mês via `localStorage` (TX-06)

**What:** convenção já estabelecida no projeto:

```jsx
// Source: fides-orcamento.jsx:807-819 (padrão já em produção — replicar)
var stCollapsed = React.useState(function () {
  try { return localStorage.getItem('fides:collapsed_503020_card') === '1'; }
  catch (_) { return false; }
});
// ...
function handleToggle() {
  var next = !collapsed;
  try { localStorage.setItem('fides:collapsed_503020_card', next ? '1' : '0'); } catch (_) {}
  setCollapsed(next);
}
```

**Recomendação:** consolidar filtro+sort+mês+range num único objeto serializado sob uma chave (`fides:tx.state`), lido uma vez em `useState(() => { try {...} catch(_) { return DEFAULT } })` e persistido via `React.useEffect` com `JSON.stringify` a cada mudança relevante (debounce não é necessário — volume de escrita é baixo). Isso evita hydration flicker porque o `useState` lazy-initializer roda antes do primeiro paint (sem SSR neste projeto — CSR puro — então não há divergência servidor/cliente a temer, só o "flash" de estado default antes do parse; como o parse é síncrono no `useState` initializer, não há flash).

```jsx
// Padrão recomendado
const TX_STATE_KEY = 'fides:tx.state';
const [txState, setTxState] = React.useState(() => {
  try {
    const raw = localStorage.getItem(TX_STATE_KEY);
    return raw ? JSON.parse(raw) : { sortBy: 'data', sortOrder: 'desc', filterType: 'todas', pageSize: 20, selectedMonth: null };
  } catch (_) { return { sortBy: 'data', sortOrder: 'desc', filterType: 'todas', pageSize: 20, selectedMonth: null }; }
});
React.useEffect(() => {
  try { localStorage.setItem(TX_STATE_KEY, JSON.stringify(txState)); } catch (_) {}
}, [txState]);
```

**Cuidado com Rules of Hooks:** `Transacoes` já tem 8+ `useState` sequenciais (linhas 163-183) — inserir o novo estado consolidado no MESMO nível (não dentro de condicional/loop), seguindo o padrão que já existe. A Phase 07 teve um bug de Rules of Hooks por declarar hooks depois de um `return` condicional (`07-03: moved MetasStudio useState declarations above the isEmpty early return`, ver STATE.md linha 105) — `Transacoes` já declara todos os hooks antes de qualquer `return` condicional (linha 662 é o primeiro branch), então seguir esse mesmo posicionamento.

### Pattern 6: Command palette ⌘K (TX-07 / absorve UX-01)

**What:** o afordance visual já existe e está morto:

```jsx
// Source: fides-studio.jsx:480-485 (JÁ EXISTE — input é readOnly, sem handler)
<div className="stu-mast-r">
  <div className="stu-mast-search">
    <Icon.Search size={14} style={{ opacity: 0.5 }}/>
    <input placeholder="Buscar transações, contas, categorias…" readOnly/>
    <kbd className="fds-kbd">⌘K</kbd>
  </div>
```

**Onde montar:** `StudioMasthead` (`fides-studio.jsx:312`) hoje só recebe `{ onAdd, onGear, active }` — não tem `setActive`. O componente pai `FidesStudioShell` (linha 40-85) já tem `active`/`setActive` e monta `StudioMasthead` na linha 62. Recomendação: manter o estado do palette (`open`) em `FidesStudioShell`, passar um novo prop `onOpenSearch` para `StudioMasthead` (troca o `readOnly` por `onClick={onOpenSearch}` ou `onFocus`), e montar o componente `CommandPalette` como irmão de `NovaTransacaoModal`/`CategoriaModal` (linhas 72-82), recebendo `onNav={setActive}`.

**Atalho de teclado global:** seguir o padrão já usado em `fides-ui.jsx:120-128` (listener em `document`, cleanup no `useEffect`):

```jsx
// Padrão recomendado, em FidesStudioShell
React.useEffect(() => {
  function onKey(e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      setPaletteOpen(true);
    }
  }
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}, []);
```

**Dados a buscar:** `useFides()` já expõe `transactions`, `accounts`, `cards`, `categories`, `goals` no mesmo contexto — filtrar em memória (mesmo padrão de busca já usado em `Transacoes`, linha 213-222) é suficiente; nenhuma nova query.

**Navegação:** `setActive` (de `FidesStudioShell`) já aceita as 6 chaves válidas (`dashboard, transacoes, orcamento, contas, metas, perfil` — linha 69). O palette pode navegar chamando `onNav(page)` + fechar.

### Pattern 7: Preview de limite de categoria no modal (TX-08 / absorve UX-02)

**What:** `categoryUsage` já existe pronto no store e cobre exatamente o que UX-02 pede ("preview de limite da categoria selecionada"):

```jsx
// Source: fides-store.jsx:1120-1153 (JÁ EXISTE, não usado em NovaTransacaoModal hoje)
const categoryUsage = React.useMemo(() => {
  const spentByKey = {};
  spendByCategory.forEach(s => { spentByKey[s.key] = Math.abs(s.val || 0); });
  // ...
  return Object.entries(categories).map(([cat_key, c]) => {
    const lim = categoryLimits[cat_key];
    const limit = lim ? (lim.byMonth?.[selectedMonth] ?? lim.default ?? null) : null;
    const spent = spentByKey[cat_key] || 0;
    // pct, status: 'over' | 'warn' | 'ok' | null (sem limite)
    return { cat_key, label: c.label, emoji: c.emoji, grp: c.group, spent, limit, pct, status };
  })...
}, [categoryLimits, spendByCategory, selectedMonth, categories]);
```

**Recomendação:** em `NovaTransacaoModal` (`fides-transacoes.jsx:1118`), destructure `categoryUsage` de `useFides()` (linha 1119 já faz destructure de outros campos do contexto). Ao usuário escolher `cat` e digitar `val`, calcular:

```jsx
const usage = categoryUsage.find(u => u.cat_key === cat);
const numVal = parseVal(val);
const projectedSpent = (usage?.spent || 0) + (kind === 'despesa' ? numVal : 0);
const projectedRemaining = usage?.limit != null ? usage.limit - projectedSpent : null;
```

**Cuidado:** `categoryUsage` é calculado sobre `selectedMonth` (mês selecionado no store, NÃO necessariamente o `date` escolhido no formulário do modal — o usuário pode lançar uma transação retroativa/futura em outro mês). Para transações no mês atual, `selectedMonth` e a data do formulário coincidem na maioria dos casos, mas para parcelamento/recorrência (que geram transações em meses futuros, `buildTxs()`, linha 1185-1224) o preview de limite do mês atual **não reflete** o mês real de cada parcela. Documentar essa limitação conhecida na UI (ex.: "limite do mês atual — parcelas futuras não avaliadas") em vez de tentar resolver `categoryUsage` por mês arbitrário nesta fase (exigiria generalizar `categoryUsage` para aceitar um parâmetro de mês, fora do escopo declarado).

### Anti-Patterns to Avoid

- **Reescrever `handleExport`/`handleImport` do zero:** já existem, funcionam, e têm BOM+escaping corretos. Estender, não substituir.
- **Mudar a assinatura de `spendByCategory`:** quebra `DashboardStudio` (donut, top5, CategoryChart) e `fides-claude.jsx` (contexto da IA). Sempre adicionar uma nova derivação paralela.
- **Paginar client-side chamando Supabase de novo por página:** os dados já estão 100% carregados em `transactions`; paginação aqui é puramente de renderização (`Array.slice`), não uma nova query `.range()`.
- **Persistir estado de filtro em `sessionStorage`:** o escopo pede persistência "no reload" — `sessionStorage` não sobrevive a fechar a aba/navegador; `localStorage` é o correto (mesma convenção já usada no projeto).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| CSV export/escaping | Novo gerador de CSV | `handleExport('csv')` já existente (`fides-transacoes.jsx:350-369`) | Já cobre BOM, escaping de aspas, honra filtro ativo |
| Cálculo de mês de fatura (transações de cartão) | Nova lógica de "que mês essa compra de cartão cai" | `window.mesFaturaFor` (já usado em `fides-store.jsx:213`/`EditTxModal`, linha 977) | Lógica de ciclo de fatura já corrigida na Fase 6 (M4) — reimplementar reintroduziria o bug que aquela fase corrigiu |
| Parsing de valores BRL ("1.234,56") | Novo parser | `parseVal` já existe em 2 lugares (`EditTxModal` linha 946-949, `NovaTransacaoModal` linha 1169-1173) — considerar extrair para helper compartilhado se TX-08 precisar dele num terceiro lugar | Edge cases de milhar/decimal PT-BR já tratados |
| Debounce de busca client-side | Nova lib de debounce | Nenhuma — o dataset já está em memória (não é chamada de rede), filtrar em cada keystroke via `useMemo` é suficiente (mesmo padrão já usado no `search` de `Transacoes`, linha 213-222) | Sem I/O de rede, debounce só adicionaria latência perceptível sem ganho de performance real |

**Key insight:** Quase todo "problema difícil" desta fase (parsing de data/valor, ciclo de fatura, exclusão de `is_transfer`, export) já tem solução madura no código existente. O trabalho real é **composição** (novo filtro usando dado já classificado, nova agregação reaproveitando `transactions` já carregado, novo componente wireando a um afordance visual já desenhado) — não invenção de algoritmo novo.

## Common Pitfalls

### Pitfall 1: Paginação quebra semântica de "grupo" ao ordenar por Categoria/Conta
**What goes wrong:** se a paginação for aplicada depois de `grouped` (sobre a lista já expandida com headers), o cabeçalho do grupo mostra soma/contagem só dos itens visíveis na página atual, não do grupo inteiro no filtro ativo — parece bug ("por que a categoria Mercado só mostra 3 transações e R$ 45, se eu sei que gastei R$ 300?").
**Why it happens:** `grouped` (linha 282-311) itera `sorted` inteiro para computar `groupTotal`; se `sorted` já estiver fatiado pela página, o total também fica fatiado.
**How to avoid:** paginar sobre `sorted` (não sobre `grouped`) e deixar `grouped` rodar só na fatia paginada; comunicar claramente na UI que o total do grupo reflete só a página atual quando paginação + agrupamento por categoria/conta estiverem ativos juntos.
**Warning signs:** somas de grupo que não batem com o total do card do filtro (`fds-tx-v2-list-head-right`, linha 720-725).

### Pitfall 2: "Selecionar todas" com paginação ativa seleciona além da página visível
**What goes wrong:** `toggleSelectAll` (linha 474-479) e `selTxs()` (linha 486-492) operam sobre `sorted` (todo o filtro), não sobre a página atual. Se paginação for adicionada sem revisar esse comportamento, o checkbox "selecionar todas" no cabeçalho da lista seleciona TODAS as transações do filtro (não as 20/50/100 visíveis), o que pode ser desejável (bulk actions em massa) ou surpreendente, dependendo da expectativa do usuário.
**Why it happens:** o dataset de seleção (`sorted`) é desacoplado do dataset de exibição (que passará a ser `pagedSorted`).
**How to avoid:** decisão explícita de produto — recomendo manter "selecionar todas" operando sobre `sorted` completo (comportamento de bulk-action mais útil), mas adicionar um segundo controle "selecionar só esta página" e deixar o contador de seleção (`fds-tx-v2-bulk-count`, linha 692) explícito sobre quantas estão selecionadas vs. quantas estão visíveis.
**Warning signs:** usuário clica "excluir selecionadas" esperando apagar 20 e apaga 340.

### Pitfall 3: Preview de limite de categoria não reflete o mês real de parcelas/recorrência futuras
**What goes wrong:** `categoryUsage` é calculado sobre `selectedMonth` (o mês visível no store), mas `NovaTransacaoModal` pode lançar transações em meses futuros via parcelamento (`buildTxs`, linha 1185-1224) ou o usuário pode simplesmente escolher uma `date` diferente do mês corrente. O preview mostraria o limite do mês errado.
**Why it happens:** `categoryUsage` não aceita parâmetro de mês — está fixado no `selectedMonth` global do store.
**How to avoid:** documentado no Pattern 7 — escopo desta fase deve deixar claro que o preview é "limite do mês selecionado no momento" e não tentar generalizar `categoryUsage` para mês arbitrário (mudança maior, não pedida explicitamente pelo escopo).
**Warning signs:** usuário lança compra parcelada em 12x e o preview de limite mostra o mesmo valor em todas as parcelas, ignorando que cada parcela cai num mês diferente.

### Pitfall 4: `spendByCategoryRange` recalculando sobre array crescente sem memoização por range
**What goes wrong:** se implementado como `useCallback` que sempre refaz o `forEach` sobre `transactions` inteiro a cada chamada (sem cache por `fromYM`/`toYM`), trocar o range no seletor (3m→6m→12m) dispara reprocessamento completo a cada clique — aceitável no volume atual (centenas de transações), mas vale usar `useMemo` com dependência no range escolhido (não `useCallback` genérico) se o range for um estado fixo da tela, não um parâmetro livre chamado em múltiplos lugares.
**Why it happens:** dataset cresce com o tempo de uso do usuário; sem paginação de servidor (Pattern 3), tudo fica em memória e é reprocessado no client.
**How to avoid:** se o range selecionado vira estado da tela (não uma função chamada ad-hoc), prefira `const spendByCategoryRangeData = React.useMemo(() => computeRange(transactions, fromYM, toYM), [transactions, fromYM, toYM])` dentro do componente `Transacoes`, chamando uma função pura exportada pelo store, em vez de expor só um `useCallback` recalculado a cada render.
**Warning signs:** nenhum perceptível no volume atual do projeto — flagado preventivamente, não é um problema observado.

### Pitfall 5: Export CSV citado como "novo" no ROADMAP pode levar a reimplementação duplicada
**What goes wrong:** o bloco de escopo do ROADMAP lista "Export CSV" como item do phase; o código já tem export CSV+OFX completo e funcional desde a Fase 5 (commits `2910c2d`/`21e7632`, antes de existir o v1.1 REQUIREMENTS.md). Um planner que não ler o código-fonte pode gerar uma tarefa de "criar handleExport" que duplica/sobrescreve o que já existe.
**Why it happens:** o ROADMAP foi escrito com uma leitura de alto nível do backlog (B2/B7 + itens novos), sem necessariamente conferir linha a linha o estado atual do arquivo.
**How to avoid:** a tarefa de planejamento para "export CSV" deve ser enquadrada como auditoria + extensão (garantir que honra range/paginação novos, não como implementação do zero).
**Warning signs:** PLAN.md descrevendo "criar função de export CSV" do zero.

## Code Examples

### Filtrar transações por range de meses (base para TX-03/TX-04)

```jsx
// Novo helper — mesma pasta de prevMonth/monthLabel, fides-store.jsx (~linha 1047)
function monthsInRange(fromYM, toYM) {
  const out = [];
  let [y, m] = fromYM.split('-').map(Number);
  const [ey, em] = toYM.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}
```

### Presets de range (3m/6m/12m/ano/custom) a partir do mês selecionado

```jsx
function rangeFromPreset(selectedMonth, preset) {
  const [y, m] = selectedMonth.split('-').map(Number);
  if (preset === 'ano') return [`${y}-01`, `${y}-12`];
  const monthsBack = { '3m': 2, '6m': 5, '12m': 11 }[preset] ?? 2; // inclui o mês atual
  let ry = y, rm = m - monthsBack;
  while (rm < 1) { rm += 12; ry--; }
  return [`${ry}-${String(rm).padStart(2, '0')}`, selectedMonth];
}
```

### Export CSV atual (referência — já em produção, não recriar)

```jsx
// Source: fides-transacoes.jsx:350-369 (JÁ EXISTE)
const headers = ['Data','Descrição','Categoria','Conta','Valor','Status','Recorrência'];
const rows = filtered.map(t => {
  const catLabel = categories[t.cat]?.label || t.cat || '';
  const acctName = accounts.find(a => a.id === t.acct)?.name || t.acct || '';
  const valFmt = t.val.toFixed(2).replace('.', ',');
  return [t.d || '', `"${(t.desc || '').replace(/"/g, '""')}"`, catLabel, acctName, valFmt, t.status || '', t.recur || ''].join(';');
});
const csv = [headers.join(';'), ...rows].join('\n');
const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM já presente
```

## State of the Art

Não há mudança de "estado da arte" externa a rastrear aqui — todas as APIs usadas (`Blob`, `localStorage`, `Array.slice`, `keydown` listener) são estáveis há anos e já estão em uso no próprio projeto. A única "evolução" relevante é interna ao projeto:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `window.confirm()`/`alert()` nativos | `ConfirmDialog`/`Toast` (`fides-ui.jsx`) | Fase "Lote 1" (`a83bd9d`) | Qualquer novo fluxo de confirmação (ex.: "limpar filtros salvos") deve usar `useConfirm()`, não `window.confirm` — `NovaTransacaoModal` ainda tem 1 resíduo de `window.confirm` na transferência com saldo negativo (linha 1247), fora do escopo desta fase mas documentado como débito conhecido (ROADMAP B9) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | "Cartões filter" deve ser implementado como subseção dentro de `TxAdvFiltersModal` (não como novo chip no filtro rápido) | Pattern 1 | Se o usuário/planner preferir um chip rápido separado (like `filterType`), a UI muda de lugar mas a lógica de dados (Set de IDs de cartão) é a mesma — impacto baixo, é decisão de layout |
| A2 | Paginação deve ocorrer sobre `sorted` (pré-agrupamento), não sobre `grouped` | Pattern 2, Pitfall 1 | Se o time decidir paginar por "página = N grupos" em vez de "página = N transações", a implementação muda; recomendação é uma escolha de design razoável mas não a única válida |
| A3 | `spendByCategoryRange` deve ser exposto como `useCallback(fromYM, toYM) => data`, não como `useMemo` fixo | Pattern 3 | Se a UI só precisar de UM range por vez (não vários simultâneos), um `useMemo` parametrizado por estado local do componente é mais simples — ver Pitfall 4 |
| A4 | Preview de limite de categoria (UX-02) usa `categoryUsage` do `selectedMonth` do store, sem generalizar para mês arbitrário da transação sendo criada | Pattern 7, Pitfall 3 | Risco baixo — está documentado como limitação conhecida; só vira problema se o UAT exigir preview correto por parcela |
| A5 | Persistência via `localStorage` deve consolidar filtro+sort+mês+range num único objeto JSON sob uma chave (`fides:tx.state`), não chaves separadas por campo | Pattern 5 | Se o time preferir seguir o padrão exato já existente (uma chave por campo, como `fides:collapsed_503020_card`), a implementação muda de "um JSON.parse" para "vários getItem" — impacto baixo, ambos batem a convenção `fides:` do projeto |

**Nenhuma claim tagueada `[ASSUMED]` no sentido de "não verificado no código"** — todas as claims técnicas desta pesquisa foram confirmadas lendo o código-fonte real (`fides-transacoes.jsx`, `fides-store.jsx`, `fides-studio.jsx`, `fides-ui.jsx`, `fides-charts.jsx`, `index.html`) e o histórico de commits (`git log`). As 5 entradas acima são decisões de design razoáveis onde múltiplas abordagens válidas existem — não fatos incertos.

## Open Questions

1. **Onde exatamente montar o range picker (3m/6m/12m/ano/custom) na UI de Transações?**
   - What we know: precisa alimentar tanto a lista (TX-04) quanto o widget de analytics cross-month (TX-03); ambos compartilham o mesmo `[fromYM, toYM]`.
   - What's unclear: se deve ser um novo card no topo da página (como `fds-tx-v2-sort`, linha 595-615) ou um controle dentro de um novo painel de "Analytics" separado da lista.
   - Recommendation: planner decide layout; tecnicamente ambos consomem o mesmo estado `[fromYM, toYM]` elevado a `Transacoes` (ou a `TransacoesStudio`, que já orquestra o wrapper editorial).

2. **A paginação deve resetar ao trocar de mês (tabs Jan-Dez) ou manter a página/tamanho escolhidos?**
   - What we know: `pageSize` (20/50/100) é preferência de UI persistida (`localStorage`); `page` (número da página atual) é efêmero.
   - What's unclear: se trocar de mês deve resetar `page` para 0 (razoável, dataset muda) — recomendo sim, mas não está no escopo explícito.
   - Recommendation: resetar `page` para 0 em qualquer mudança de `filtered` (já é o gatilho natural via `useEffect`), manter `pageSize` persistido.

3. **Command palette ⌘K: busca só transações, ou também navega entre páginas (Dashboard/Orçamento/Contas/Metas)?**
   - What we know: REQUIREMENTS.md UX-01 diz "busca transações via ⌘K"; o placeholder do input já diz "Buscar transações, contas, categorias…" (`fides-studio.jsx:483`), sugerindo escopo mais amplo que só transações.
   - What's unclear: se resultados de busca devem incluir contas/cartões/categorias como itens navegáveis (iria além do texto literal de UX-01).
   - Recommendation: seguir o placeholder existente (contas + categorias + transações) já que foi desenhado antes desta fase e reflete a intenção original do afordance — mas confirmar com o usuário antes de implementar o escopo mais amplo.

## Environment Availability

Sem dependências externas novas nesta fase — todas as APIs usadas (`Blob`, `localStorage`, `document.addEventListener`) são nativas do browser e já estão em uso no projeto (ver Standard Stack). Seção de auditoria de ambiente pulada por não haver ferramenta/serviço/runtime novo a verificar.

## Validation Architecture

**Sem framework de teste automatizado no projeto** — `package.json` só declara `@supabase/supabase-js` como dependência; não há `pytest`/`jest`/`vitest` configurado, nem diretório `test/`/`__tests__/`. Isso é consistente com o débito arquitetural já documentado (`CLAUDE.md`: "Sem bundler/lint/types hoje... ROADMAP B11 → migrar p/ Vite/Next"; introduzir um test runner real exigiria um bundler, que é explicitamente fora de escopo até B11).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Nenhum |
| Config file | — |
| Quick run command | — |
| Full suite command | — |

### Estratégia de validação recomendada para esta fase

Dado o débito B11 (sem bundler = sem test runner real), a validação desta fase segue o padrão já usado nas Phases 06-08: **UAT conversacional via `/gsd-verify-work`** dirigindo o app real no browser, não testes automatizados. Recomendo ao planner mapear cada sub-requisito (TX-01..TX-08) a um roteiro de UAT manual explícito (ex.: "abrir filtro avançado → marcar 2 cartões → confirmar que só transações desses 2 cartões aparecem"), não a comandos de teste automatizado.

### Phase Requirements → Roteiro de UAT manual

| ID | Comportamento | Como verificar |
|--------|----------|-------------------|
| TX-01 | Filtro Cartões isola transações de cartão de crédito | Abrir filtro avançado, marcar só cartões, conferir que lista só mostra `acctInfo.kind === 'cartao'` |
| TX-02 | Paginação 20/50/100 + navegação de página | Trocar seletor de qtd, confirmar contagem de itens renderizados muda; avançar/voltar página |
| TX-03 | Gasto por categoria cross-month reflete range escolhido, exclui `is_transfer` | Escolher range 3m, conferir soma bate com soma manual das 3 mensalidades, sem incluir pagamentos de fatura |
| TX-04 | Lista em modo range mostra transações de múltiplos meses | Ativar range, conferir transações de mais de 1 mês aparecem juntas |
| TX-05 | Export CSV reflete filtro/range ativo | Aplicar filtro, exportar, abrir CSV, conferir linhas batem com o filtro |
| TX-06 | Reload preserva filtro/sort/mês | Aplicar filtro+sort, dar F5, conferir estado preservado |
| TX-07 | ⌘K abre palette e navega/busca | `Cmd+K` (Mac) / `Ctrl+K` (Windows), digitar termo, navegar via resultado |
| TX-08 | Preview de limite aparece ao escolher categoria com limite definido | Abrir Nova Transação, escolher categoria com limite configurado, digitar valor, conferir "restante" atualiza |

### Wave 0 Gaps
- Nenhum arquivo de teste a criar — projeto não usa test runner (ver nota acima). Validação via roteiro de UAT manual listado acima, executado por `/gsd-verify-work 09` ao final da fase.

## Security Domain

### Applicable ASVS Categories

Fase client-only, sem novo endpoint de API, sem mudança de auth/RLS/schema. Superfície de risco é baixa e concentrada em input handling client-side.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | Não | Nenhuma mudança de auth nesta fase |
| V3 Session Management | Não | Nenhuma mudança de sessão |
| V4 Access Control | Não | Nenhum novo endpoint/RLS — leitura usa dados já carregados sob RLS existente (`user_id` já filtrado em `refreshData`) |
| V5 Input Validation | Sim | CSV export já escapa aspas (`replace(/"/g, '""')`, `fides-transacoes.jsx:358`); qualquer novo campo de busca/filtro no ⌘K deve tratar input como texto puro (sem `dangerouslySetInnerHTML`), seguindo o padrão já usado no campo de busca existente (`fides-transacoes.jsx:647-650`, `value`/`onChange` controlado, sem interpolação HTML) |
| V6 Cryptography | Não | Nenhum dado sensível novo persistido — `localStorage` armazenará apenas preferências de UI (filtro/sort/mês), não dados financeiros nem tokens |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| CSV injection (célula iniciando com `=`, `+`, `-`, `@` interpretada como fórmula por Excel) | Tampering | `handleExport` atual NÃO neutraliza esse padrão — descrição de transação vinda do usuário (`t.desc`) é escrita crua no CSV além do escaping de aspas. Recomendo, ao tocar em `handleExport` nesta fase (TX-05), adicionar prefixo neutralizador (`'` ou espaço) em campos que comecem com `=+-@` antes de exportar. Achado NOVO desta pesquisa — não estava no escopo original do ROADMAP, mas é uma correção de baixo custo dado que o código já será tocado. |
| XSS via dado de transação renderizado sem sanitização | Tampering/Info disclosure | React já escapa por padrão (`{t.desc}` em JSX não usa `dangerouslySetInnerHTML` em nenhum lugar do arquivo) — manter esse padrão em qualquer novo componente (ex.: resultados do ⌘K palette) |
| `localStorage` poluído por dado malformado (JSON.parse falha) | Denial of Service (local) | Sempre envolver `JSON.parse`/`localStorage.getItem` em `try{}catch(_){}` com fallback para default — convenção já seguida em todo o projeto (ver Pattern 5) |

## Sources

### Primary (HIGH confidence — leitura direta do código-fonte)
- `assets/fides-transacoes.jsx` (1653 linhas, lido integralmente) — `TxAdvFiltersModal`, `Transacoes`, `handleExport`/`handleImport`, `EditTxModal`, `NovaTransacaoModal`
- `assets/fides-store.jsx` (linhas 1-220, 1040-1430 lidas em detalhe) — `spendByCategory`, `categoryUsage`, `budgetGroups`, `cardIdSet` (5 ocorrências), `refreshData`, `prevMonth`/`monthLabel`
- `assets/fides-studio.jsx` (linhas 1-500+ lidas) — `FidesStudio`, `FidesStudioShell`, `StudioMasthead` (afordance ⌘K morto), `TransacoesStudio`
- `assets/fides-ui.jsx` (295 linhas, lido integralmente) — `useToast`, `useConfirm`, `useModalClose`, padrão de `document.addEventListener('keydown', ...)`
- `assets/fides-charts.jsx` (assinaturas de `Donut`/`CategoryChart`/`Sparkline`/`AccumulatedChart` verificadas via grep)
- `index.html` (linhas 100-163) — versões CDN de React/ReactDOM/Babel-standalone, mount da `<App/>`
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — histórico de decisões e escopo formal
- `git log` sobre `fides-transacoes.jsx` — confirmação de que export/import CSV/OFX já existem desde commits anteriores ao v1.1

### Secondary (MEDIUM confidence)
- Nenhuma fonte externa consultada — pesquisa 100% baseada em código-fonte do próprio repositório, pois a fase não introduz nenhuma tecnologia nova além do que já está em produção.

### Tertiary (LOW confidence)
- Nenhuma.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero pacotes novos, tudo API nativa já em uso comprovado no código
- Architecture: HIGH — todos os pontos de integração (spendByCategory, categoryUsage, TxAdvFiltersModal, masthead ⌘K afordance) foram lidos diretamente no código-fonte, não inferidos
- Pitfalls: HIGH — derivados de leitura direta do comportamento atual do código (não hipotéticos), mais 1 achado de segurança novo (CSV injection) fora do escopo original mas relevante por tocar o mesmo arquivo

**Research date:** 2026-07-02
**Valid until:** válido enquanto `fides-transacoes.jsx`/`fides-store.jsx` não sofrerem refactor maior fora desta fase — não há dependência de versão externa a expirar (sem pacotes novos). Recomenda-se re-verificar linhas citadas se Phase 8 (ainda bloqueada, aguardando apply LIVE) alterar `fides-store.jsx` antes do planejamento desta fase iniciar.
