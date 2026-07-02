# Phase 9: Transações — power tools + analytics — Pattern Map

**Mapeado:** 2026-07-02
**Arquivos analisados:** 3 (`assets/fides-transacoes.jsx`, `assets/fides-store.jsx`, `assets/fides-studio.jsx`) — modificados, nenhum novo (projeto sem build step, scripts `.jsx` carregados via `<script type="text/babel">`)
**Analogs encontrados:** 8 / 8 sub-requisitos (TX-01..TX-08)

Nota de precisão: os números de linha abaixo foram reconferidos lendo o código-fonte atual (2026-07-02) — divergem em ±1-3 linhas dos números citados em `09-RESEARCH.md` (o arquivo teve pequenas edições desde a pesquisa), mas a estrutura/conteúdo dos trechos é a mesma.

## File Classification

| Item | Arquivo tocado | Role | Data Flow | Analog mais próximo | Match Quality |
|------|----------------|------|-----------|----------------------|----------------|
| TX-01 Filtro Cartões | `assets/fides-transacoes.jsx` (`TxAdvFiltersModal`, linhas 46-158) | component (modal) | request-response (draft local → onApply) | seção "Contas e cartões" já existente no próprio `TxAdvFiltersModal` (linhas 106-121) | exact — mesmo componente, adicionar subseção |
| TX-02 Paginação + seletor 20/50/100 | `assets/fides-transacoes.jsx` (`Transacoes`, `sorted`→`grouped`, linhas 244-311) | component (list render) | transform (client-side slice) | `filtered`/`sorted` `useMemo` chain já existente (linhas 202-279) | exact — mesmo padrão `useMemo` encadeado |
| TX-03 `spendByCategoryRange` | `assets/fides-store.jsx` (perto de `spendByCategory`, linhas 1106-1115) | service (derived state / selector) | transform (aggregation) | `spendByCategory` (linhas 1106-1115) — NÃO alterar assinatura, adicionar derivação paralela | exact — mesmo shape de output `{key,val,label,tint,emoji}` |
| TX-04 `rangeTransactions` / modo range na lista | `assets/fides-store.jsx` (perto de `monthTransactions`, linhas 1063-1065) + `assets/fides-transacoes.jsx` (`baseList`, linha 198) | service + component | transform | `monthTransactions` `useMemo` (linhas 1063-1065) | exact — mesmo padrão de filtro sobre `transactions` |
| TX-05 Export CSV audit/extend | `assets/fides-transacoes.jsx` (`handleExport`, linhas 314-369) | utility (file I/O / export) | file-I/O | o próprio `handleExport` já existente | exact — auditar/estender, não recriar |
| TX-06 Persistência localStorage | `assets/fides-transacoes.jsx` (novo estado consolidado perto das linhas 163-183) | utility (persistence) | event-driven (side-effect on state change) | `fides-orcamento.jsx:807-819` `RuleInfoCard` (`stCollapsed`/`handleToggle`) | role-match — mesma convenção `try{}catch(_){}`, mas lá é 1 boolean; aqui é 1 objeto JSON |
| TX-07 Command palette ⌘K | `assets/fides-studio.jsx` (`FidesStudioShell` linhas 40-85, `StudioMasthead` linhas 312+) | component + hook (global keydown) | event-driven | `fides-ui.jsx:120-128` (`ConfirmDialog` `document.addEventListener('keydown', onKey)`) | role-match — mesmo padrão de listener global com cleanup |
| TX-08 Preview de limite no modal | `assets/fides-transacoes.jsx` (`NovaTransacaoModal`, linhas 1118+) | component (form) | request-response (derived UI state) | `categoryUsage` já pronto em `fides-store.jsx:1120-1153` | exact — só wiring, sem novo cálculo |

## Pattern Assignments

### TX-01 — Filtro "Cartões" dedicado

**Analog:** `assets/fides-transacoes.jsx` — `TxAdvFiltersModal` (linhas 46-158), especificamente a seção "Contas e cartões" (linhas 106-121) e o helper `acctNameOf` (linhas 37-43).

**Imports/contexto** — `TxAdvFiltersModal` já recebe `accounts`/`cards` via props do componente pai (não via `useFides()` direto):
```jsx
// fides-transacoes.jsx:46
function TxAdvFiltersModal({ open, onClose, filters, onApply, categories, accounts, cards }) {
```

**Distinção conta vs. cartão** (linhas 37-43, já existe, reaproveitar sem alterar):
```jsx
function acctNameOf(id, accounts, cards) {
  var a = accounts.find(function(x) { return x.id === id; });
  if (a) return { name: a.name, color: a.color, kind: 'conta' };
  var c = cards.find(function(x) { return x.id === id; });
  if (c) return { name: c.name, color: c.color || 'var(--ink-3)', kind: 'cartao' };
  return null;
}
```

**Core pattern a copiar** — a seção existente mistura contas+cartões num único array `contasSelected` (linhas 106-121):
```jsx
// fides-transacoes.jsx:106-121 (estado atual — separar em 2 subseções "Contas"/"Cartões",
// mantendo o MESMO array contasSelected — IDs não colidem entre accounts e cards)
<section className="fds-tx-adv-section">
  <h3 className="fds-tx-adv-label">Contas e cartões</h3>
  <div className="fds-tx-adv-chips">
    {allAccts.map(function(a) {
      var on = draft.contasSelected.indexOf(a.id) >= 0;
      return (
        <button key={a.id} type="button"
                className={'fds-chip' + (on ? ' on' : '')}
                onClick={function() { toggleAcct(a.id); }}>
          <span className="fds-tx-adv-acct-dot" style={{ background: a.color || 'var(--ink-3)' }}/>
          {a.name}
        </button>
      );
    })}
  </div>
</section>
```

**Toggle helper a reaproveitar** (linhas 62-67, mesma função serve para o novo "selecionar todos os cartões" atalho):
```jsx
function toggleAcct(id) {
  var list = draft.contasSelected.indexOf(id) >= 0
    ? draft.contasSelected.filter(function(x) { return x !== id; })
    : draft.contasSelected.concat([id]);
  setDraft(Object.assign({}, draft, { contasSelected: list }));
}
```

**Padrão local de `Set` de IDs de cartão** (recorrente em `fides-store.jsx`, linhas 197, 449, 1188, 1209, 1266 — usar o mesmo idioma se precisar checar "é cartão" em massa em vez de `.find()` linear):
```jsx
// fides-store.jsx:197 (um dos 5 usos do mesmo idioma no arquivo)
const cardIdSet = new Set((liveCards || []).map(c => c.id));
const isCard    = cardIdSet.has(tx.acct);
```

---

### TX-02 — Paginação client-side + seletor 20/50/100

**Analog:** cadeia `filtered` → `sorted` → `grouped` em `assets/fides-transacoes.jsx` (linhas 202-311), mesmo arquivo, `Transacoes`.

**Core pattern** — inserir `pagedSorted` entre `sorted` (linha 244) e `grouped` (linha 282), mesmo idioma de `useMemo` encadeado já usado no arquivo:
```jsx
// Padrão já usado no arquivo para useMemo encadeado (ex.: sorted, fides-transacoes.jsx:244-279)
const sorted = React.useMemo(function() {
  var copy = filtered.slice();
  // ...
  return copy;
}, [filtered, sortBy, sortOrder, categories, safeAccounts, safeCards]);

// NOVO — mesmo idioma, inserir entre sorted e grouped
const [pageSize, setPageSize] = React.useState(20); // 20 | 50 | 100
const [page, setPage] = React.useState(0);
React.useEffect(function() { setPage(0); }, [filtered, sortBy, sortOrder, pageSize]);
const pagedSorted = React.useMemo(function() {
  return sorted.slice(page * pageSize, (page + 1) * pageSize);
}, [sorted, page, pageSize]);

// grouped (fides-transacoes.jsx:282) passa a receber pagedSorted em vez de sorted
```

**Seletor de quantidade — reaproveitar o idioma de pill/chip já usado no sort** (linhas 595-615, `fds-tx-v2-sort-pill`):
```jsx
// fides-transacoes.jsx:595-615 — mesmo card/pill idiom a copiar para o seletor 20/50/100
<section className="fds-card fds-tx-v2-sort" data-od-id="tx-organizar">
  <span className="fds-tx-v2-sort-label">Organizar por</span>
  <div className="fds-tx-v2-sort-pills" role="group" aria-label="Organizar por">
    {['data', 'categoria', 'conta', 'valor'].map(function(by) {
      var on = sortBy === by;
      return (
        <button key={by} type="button"
                className={'fds-tx-v2-sort-pill' + (on ? ' on' : '')}
                aria-pressed={on}
                onClick={function() { handleSortClick(by); }}>
          {SORT_LABELS[by]}
        </button>
      );
    })}
  </div>
</section>
```

**Cuidado (Pitfall 1 e 2 do RESEARCH.md, confirmados no código atual):**
- `grouped` (linhas 282-311) soma/conta por grupo iterando `sorted` inteiro — se `grouped` receber `pagedSorted`, o total do grupo passa a refletir só a página. Sinalizar isso na UI.
- `toggleSelectAll` (linhas 474-479) e `selTxs()` (linhas 486-492) operam sobre `sorted` completo, não sobre a página. Comportamento de "selecionar todas" deve ser decidido explicitamente (manter sobre `sorted` inteiro é o mais útil para bulk actions, mas precisa ficar claro na UI):
```jsx
// fides-transacoes.jsx:474-479 (referência do escopo do dataset de seleção hoje)
const toggleSelectAll = React.useCallback(function() {
  setSelectedIds(function(prev) {
    if (prev.size === sorted.length && sorted.length > 0) return new Set();
    return new Set(sorted.map(function(t) { return t._id; }));
  });
}, [sorted]);
```

---

### TX-03/TX-04 — `spendByCategoryRange` cross-month + `rangeTransactions`

**Analog:** `spendByCategory` e `monthTransactions` em `assets/fides-store.jsx` (linhas 1106-1115 e 1063-1065). **Não alterar a assinatura de `spendByCategory`** — é consumida por `DashboardStudio` e `fides-claude.jsx`.

**Core pattern — `spendByCategory` atual (NÃO editar, só copiar o idioma):**
```jsx
// fides-store.jsx:1106-1115
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

**`monthTransactions` — molde para a nova `rangeTransactions`:**
```jsx
// fides-store.jsx:1063-1065
const monthTransactions = React.useMemo(() =>
  transactions.filter(t => txMonth(t) === selectedMonth),
[transactions, selectedMonth]);
```

**Novo helper `monthsInRange` — inserir perto de `prevMonth`/`monthLabel` (fides-store.jsx:1049-1059, mesmo bloco "Month helpers"):**
```jsx
// fides-store.jsx:1049 — mesmo bloco "── Month helpers ──" onde vivem prevMonth/monthLabel
const prevMonth = (ym) => {
  const [y, m] = ym.split('-').map(s => parseInt(s, 10));
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
};
```

**Nova derivação `spendByCategoryRange` — mesmo shape de saída de `spendByCategory`, expor ao lado dela no `value` do provider (linhas 1360-1414, onde `spendByCategory`/`categoryUsage` já são expostos):**
```jsx
// fides-store.jsx:1360-1414 — value exposto pelo provider (onde adicionar spendByCategoryRange)
categoryLimits, categoryUsage, setCategoryLimit, removeCategoryLimit,
// ...
spendByCategory, budgetGroups, faturasPorCartao, faturaAbertaPorCartao, faturasDoCartao, faturasDoCartaoCompleto,
```
E no fallback de contexto (linhas ~1408-1414):
```jsx
categoryLimits: {}, categoryUsage: [],
// ...
spendByCategory: SPEND_BY_CATEGORY,
```

**Regra de exclusão `is_transfer` — replicar exatamente (Pattern 4 do RESEARCH, confirmado em 3 lugares do arquivo: `spendByCategory` linha 1109, `budgetGroups` linha 1170, `totals` de `Transacoes` em `fides-transacoes.jsx:448-450`):**
```jsx
// fides-transacoes.jsx:443-450 — mesmo idioma de exclusão de is_transfer em totais
const totals = React.useMemo(function() {
  var nonTransfer = filtered.filter(function(t) { return !t.isTransfer; });
  return {
    receitas: nonTransfer.filter(function(t) { return t.val > 0; })
                         .reduce(function(s, t) { return s + t.val; }, 0),
    despesas: -nonTransfer.filter(function(t) { return t.val < 0; })
                          .reduce(function(s, t) { return s + t.val; }, 0),
    saldo: nonTransfer.reduce(function(s, t) { return s + t.val; }, 0),
```

---

### TX-05 — Export CSV: auditoria + extensão (NÃO reescrever)

**Analog:** o próprio `handleExport` já existente e em produção, `assets/fides-transacoes.jsx` linhas 314-369.

**Trecho CSV atual (branch `else`, linhas 351-368) — ponto de extensão para neutralizar CSV-injection:**
```jsx
// fides-transacoes.jsx:351-368 (JÁ EXISTE — não recriar, só estender)
const headers = ['Data','Descrição','Categoria','Conta','Valor','Status','Recorrência'];
const rows = filtered.map(t => {
  const catLabel = categories[t.cat]?.label || t.cat || '';
  const acctName = accounts.find(a => a.id === t.acct)?.name || t.acct || '';
  const valFmt = t.val.toFixed(2).replace('.', ',');
  return [
    t.d || '',
    `"${(t.desc || '').replace(/"/g, '""')}"`,
    catLabel, acctName, valFmt, t.status || '', t.recur || ''
  ].join(';');
});
const csv = [headers.join(';'), ...rows].join('\n');
const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM já presente
```

**Achado de segurança (V5 Input Validation, do RESEARCH.md):** o campo `t.desc` é escrito cru no CSV além do escaping de aspas — Excel interpreta células iniciando com `=`, `+`, `-`, `@` como fórmula. Ao tocar em `handleExport` nesta fase, adicionar neutralização (prefixar com `'` ou espaço) apenas em `t.desc` (o único campo de texto livre do usuário no CSV) antes do `.replace(/"/g, '""')`:
```jsx
// Padrão recomendado a inserir ANTES do escaping de aspas existente:
function csvSafeCell(s) {
  var str = String(s || '');
  return /^[=+\-@]/.test(str) ? "'" + str : str;
}
// então: `"${csvSafeCell(t.desc).replace(/"/g, '""')}"`
```

**Dependência de `handleExport` já em `useCallback` com deps `[filtered, categories, selectedMonth]` (linha 369)** — se `filtered` passar a considerar range (TX-04), export automaticamente honra o novo escopo sem mudança adicional de dependência, desde que `filtered` continue sendo a fonte usada aqui.

---

### TX-06 — Persistência filtro/sort/mês via `localStorage`

**Analog:** `assets/fides-orcamento.jsx` linhas 807-819 (`RuleInfoCard`, convenção `try{}catch(_){}` + `useState` lazy initializer).

**Core pattern (fonte, já em produção):**
```jsx
// fides-orcamento.jsx:807-819
function RuleInfoCard() {
  var stCollapsed = React.useState(function () {
    try { return localStorage.getItem('fides:collapsed_503020_card') === '1'; }
    catch (_) { return false; }
  });
  var collapsed = stCollapsed[0];
  var setCollapsed = stCollapsed[1];

  function handleToggle() {
    var next = !collapsed;
    try { localStorage.setItem('fides:collapsed_503020_card', next ? '1' : '0'); } catch (_) {}
    setCollapsed(next);
  }
```

**Adaptação recomendada para Transações (objeto único em vez de boolean único) — inserir no MESMO nível dos outros `useState` de `Transacoes` (linhas 163-183), antes de qualquer `return` condicional (linha 662 é o primeiro branch — ver nota Rules of Hooks abaixo):**
```jsx
const TX_STATE_KEY = 'fides:tx.state';
const [txState, setTxState] = React.useState(function() {
  try {
    var raw = localStorage.getItem(TX_STATE_KEY);
    return raw ? JSON.parse(raw) : { sortBy: 'data', sortOrder: 'desc', filterType: 'todas', pageSize: 20 };
  } catch (_) { return { sortBy: 'data', sortOrder: 'desc', filterType: 'todas', pageSize: 20 }; }
});
React.useEffect(function() {
  try { localStorage.setItem(TX_STATE_KEY, JSON.stringify(txState)); } catch (_) {}
}, [txState]);
```

**Cuidado — Rules of Hooks (débito conhecido, já causou bug na Phase 07, ver STATE.md):** `Transacoes` já declara 8+ `useState` sequenciais nas linhas 163-186 antes do primeiro `return` condicional (linha 662). O novo estado consolidado deve entrar nesse MESMO bloco, nunca depois de um `if`/`return` antecipado.

---

### TX-07 — Command palette ⌘K

**Analog:** listener global de teclado em `assets/fides-ui.jsx` (`ConfirmDialog`, linhas 120-128) + afordance visual morto em `assets/fides-studio.jsx` (`StudioMasthead`, linhas 481-484).

**Padrão de listener global com cleanup (fonte):**
```jsx
// fides-ui.jsx:120-128
React.useEffect(function () {
  if (!open) return;
  function onKey(e) {
    if (e.key === 'Escape' && props.onCancel) props.onCancel();
    if (e.key === 'Enter' && props.onConfirm) props.onConfirm();
  }
  document.addEventListener('keydown', onKey);
  return function () { document.removeEventListener('keydown', onKey); };
}, [open, props.onCancel, props.onConfirm]);
```

**Adaptação para ⌘K global — montar em `FidesStudioShell` (linhas 40-85, já tem `active`/`setActive`):**
```jsx
// Padrão recomendado, em FidesStudioShell (fides-studio.jsx:40-85)
const [paletteOpen, setPaletteOpen] = React.useState(false);
React.useEffect(function() {
  function onKey(e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      setPaletteOpen(true);
    }
  }
  document.addEventListener('keydown', onKey);
  return function() { document.removeEventListener('keydown', onKey); };
}, []);
```

**Afordance visual já existente e morto (trocar `readOnly` por `onClick`):**
```jsx
// fides-studio.jsx:312-313 (props atuais do masthead — NÃO recebe setActive hoje)
function StudioMasthead({ onAdd, onGear, active }) {
  const { selectedMonth, setSelectedMonth, prevMonth, monthLabel, openAssistant, monthTransactions, mode } = useFides();
```
```jsx
// fides-studio.jsx:481-484 (JÁ EXISTE — input readOnly, sem handler; trocar por onClick={onOpenSearch})
<div className="stu-mast-search">
  <Icon.Search size={14} style={{ opacity: 0.5 }}/>
  <input placeholder="Buscar transações, contas, categorias…" readOnly/>
  <kbd className="fds-kbd">⌘K</kbd>
</div>
```

**Montagem em `FidesStudioShell` — mesmo bloco onde `NovaTransacaoModal`/`CategoriaModal` já são montados como irmãos (linhas 72-83):**
```jsx
// fides-studio.jsx:57-84 — inserir CommandPalette como irmão de NovaTransacaoModal/CategoriaModal
<StudioMasthead onAdd={() => setModalOpen(true)} onGear={goPerfil} active={active} onOpenSearch={() => setPaletteOpen(true)}/>
{/* ... */}
<NovaTransacaoModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={...} variant="v3"/>
<CategoriaModal open={categoryModalOpen} onClose={closeCategoryModal}/>
{/* NOVO */}
<CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNav={setActive}/>
```

**Dados a buscar** — mesmo `useFides()` já usado no componente, sem query nova; filtro em memória seguindo o mesmo idioma de busca já usado em `Transacoes` (linhas 213-222):
```jsx
// fides-transacoes.jsx:213-222 (padrão de busca em memória a replicar dentro do CommandPalette)
if (search) {
  var q = search.toLowerCase();
  result = result.filter(function(t) {
    var inDesc = (t.desc || '').toLowerCase().indexOf(q) >= 0;
    var inVal = String(t.val).indexOf(q) >= 0;
    var catLbl = (categories[t.cat] && categories[t.cat].label) || t.cat || '';
    var inCat = catLbl.toLowerCase().indexOf(q) >= 0;
    return inDesc || inVal || inCat;
  });
}
```

**Segurança (V5, RESEARCH.md):** input controlado sem `dangerouslySetInnerHTML`, mesmo padrão do campo de busca existente (`fides-transacoes.jsx:645-650`, `value`/`onChange` controlado).

---

### TX-08 — Preview de limite de categoria no modal Nova Transação

**Analog:** `categoryUsage` já pronto em `assets/fides-store.jsx` linhas 1120-1153; consumidor a modificar: `NovaTransacaoModal` em `assets/fides-transacoes.jsx` linha 1118+.

**Fonte de dado — `categoryUsage` (JÁ EXISTE, não usado hoje em `NovaTransacaoModal`, não alterar):**
```jsx
// fides-store.jsx:1120-1153
const categoryUsage = React.useMemo(() => {
  const spentByKey = {};
  spendByCategory.forEach(s => { spentByKey[s.key] = Math.abs(s.val || 0); });
  const rank = { over: 0, warn: 1, ok: 2 };
  return Object.entries(categories).map(([cat_key, c]) => {
    const lim = categoryLimits[cat_key];
    const limit = lim
      ? (lim.byMonth && lim.byMonth[selectedMonth] != null
          ? lim.byMonth[selectedMonth]
          : (lim.default != null ? lim.default : null))
      : null;
    const spent = spentByKey[cat_key] || 0;
    const pct = limit ? Math.round((spent / limit) * 100) : null;
    const status = !limit ? null
      : pct >= 100 ? 'over'
      : pct >= 80 ? 'warn'
      : 'ok';
    return { cat_key, label: c.label, emoji: c.emoji, grp: c.group, spent, limit, pct, status };
  }).sort(/* ... */);
}, [categoryLimits, spendByCategory, selectedMonth, categories]);
```

**Consumidor — `NovaTransacaoModal` já faz destructure de `useFides()` na linha 1119, adicionar `categoryUsage` ao mesmo destructure:**
```jsx
// fides-transacoes.jsx:1118-1119 (destructure atual — adicionar categoryUsage aqui)
function NovaTransacaoModal({ open, onClose, onSave, variant }) {
  const { categories, openCategoryModal, accounts, cards, transferFunds, addTransaction, addTransactions } = useFides();
```

**`parseVal` já existe no mesmo componente (linhas 1169-1173) — reaproveitar para o cálculo do preview:**
```jsx
// fides-transacoes.jsx:1169-1173 (JÁ EXISTE — reusar, não duplicar)
const parseVal = (s) => {
  if (!s) return 0;
  const cleaned = String(s).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};
```

**Cálculo do preview a adicionar, usando `cat`/`val`/`kind` (state já existente, linhas 1136/1142/1125):**
```jsx
const usage = categoryUsage.find(function(u) { return u.cat_key === cat; });
const numVal = parseVal(val);
const projectedSpent = (usage?.spent || 0) + (kind === 'despesa' ? numVal : 0);
const projectedRemaining = usage?.limit != null ? usage.limit - projectedSpent : null;
```

**Limitação conhecida a documentar na UI (Pitfall 3 do RESEARCH):** `categoryUsage` é calculado sobre `selectedMonth` do store (global), não sobre o `date` escolhido no formulário — parcelas futuras (`buildTxs`, linhas 1185+) não são refletidas corretamente no preview. Não generalizar `categoryUsage` para mês arbitrário nesta fase (fora de escopo) — só rotular como "limite do mês atual".

## Shared Patterns

### `try{}catch(_){}` em torno de `localStorage`
**Fonte:** `assets/fides-orcamento.jsx:809/817`
**Aplicar em:** TX-06 (persistência) e qualquer novo uso de `localStorage.getItem`/`setItem`/`JSON.parse`. Nunca deixar `JSON.parse` sem try/catch — dado malformado quebra o app inteiro (DoS local).

### `document.addEventListener('keydown', ...)` com cleanup em `useEffect`
**Fonte:** `assets/fides-ui.jsx:120-128`
**Aplicar em:** TX-07 (⌘K global). Sempre retornar a função de cleanup (`removeEventListener`) no `useEffect`.

### Exclusão de `is_transfer` em somas/agregações
**Fonte:** `assets/fides-store.jsx:1109` (`spendByCategory`), `:1170` (`budgetGroups`); `assets/fides-transacoes.jsx:444-450` (`totals`)
**Aplicar em:** TX-03/TX-04 (`spendByCategoryRange`, `rangeTransactions`). Sempre `t.val < 0 && !t.isTransfer` para despesas; nunca excluir `is_transfer` da lista de exibição em si (só das somas).

### `useMemo` encadeado sobre `transactions`/`filtered`/`sorted`
**Fonte:** `assets/fides-transacoes.jsx:202-311`
**Aplicar em:** TX-02 (paginação), TX-03/04 (range). Inserir novas derivações no MESMO estilo funcional (`function() { ... return ...; }`, não arrow terse) para consistência com o resto do arquivo — o arquivo mistura estilo ES5-function (na maior parte de `Transacoes`) com arrow functions (na maior parte de `fides-store.jsx`); seguir a convenção local de cada arquivo, não misturar.

### `React.useCallback`/`useMemo` com array de dependências explícito
**Fonte:** `assets/fides-transacoes.jsx:314-369` (`handleExport`), `assets/fides-store.jsx:1106-1153` (`spendByCategory`/`categoryUsage`)
**Aplicar em:** todas as novas derivações — nunca omitir dependência (ex.: `spendByCategoryRange` deve depender de `[transactions, categories]` + parâmetros de range).

## No Analog Found

Nenhum item ficou sem analog — todos os 8 sub-requisitos (TX-01..TX-08) têm um ponto de partida direto no código já existente, conforme mapeado acima. O único componente genuinamente novo é `CommandPalette` (TX-07), mas seu comportamento (listener global + busca em memória + navegação via `setActive`) é 100% composição de padrões já existentes (`fides-ui.jsx` keydown + busca de `Transacoes` + `setActive` de `FidesStudioShell`) — não há analog de "componente inteiro" a copiar porque nenhum command palette existe hoje, mas não há lacuna de padrão a resolver.

## Metadata

**Escopo de busca de analogs:** `assets/fides-transacoes.jsx`, `assets/fides-store.jsx`, `assets/fides-studio.jsx`, `assets/fides-ui.jsx`, `assets/fides-orcamento.jsx`
**Arquivos escaneados:** 5 (todos já identificados por `09-RESEARCH.md`; nenhuma busca adicional de codebase foi necessária — a pesquisa já cita analogs exatos com número de linha)
**Data de extração:** 2026-07-02
