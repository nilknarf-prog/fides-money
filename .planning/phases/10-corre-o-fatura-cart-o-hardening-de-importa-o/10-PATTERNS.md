# Phase 10: Correção fatura cartão + hardening de importação - Mapa de Padrões

**Mapeado em:** 2026-07-04
**Arquivos analisados:** 8 (3 modificados existentes + import reescrito com 1 componente novo + 4 pontos de UX)
**Analogs encontrados:** 8 / 8 (nenhum sem analog — fase 100% reaproveitamento de padrões já em produção)

## File Classification

| Arquivo (novo/modificado) | Papel | Data Flow | Analog mais próximo | Qualidade do match |
|---|---|---|---|---|
| `assets/fides-store.jsx` — `faturasDoCartao` (:1255-1293) | service (useCallback derivador) | transform | `assets/fides-data.jsx` `mesFaturaFor` (:52-64) | role-match (mesma responsabilidade: derivar mês/data de fatura) |
| `assets/fides-store.jsx` — `faturasDoCartaoCompleto` (:1324-1365) | service (useCallback derivador) | transform | `faturasDoCartao` (mesmo arquivo, :1255-1293) | exact (código gêmeo, mesmo bug duplicado) |
| `assets/fides-data.jsx` (novo helper `computeFaturaDates`, opcional) | utility (função pura) | transform | `mesFaturaFor` (:52-64, mesmo arquivo) | exact (mesma vizinhança, mesma responsabilidade) |
| `assets/fides-transacoes.jsx` — `handleImport` reescrito (:554-622) | controller/handler (evento de UI) | file-I/O → CRUD (bulk) | `EditTxModal.handleSave` (:1299-1321) | role-match (resolução conta/mês antes de gravar) |
| `assets/fides-transacoes.jsx` — `ImportPreviewModal` (componente novo) | component (modal) | request-response (seleção local, sem I/O até confirmar) | `PagarFaturaModal` (`assets/fides-contas.jsx` :179-330) | role-match (checklist + selecionar-todos + confirmar) |
| `assets/fides-transacoes.jsx` — botão "Cartão" no masthead (UX-03) | component (chip de filtro) | event-driven | `TxAdvFiltersModal.toggleAllCards` (:126-141, mesmo arquivo) | exact (mesma lógica de toggle, só exposta fora do modal) |
| `assets/fides-transacoes.jsx` — Donut modo Período + hover/tap (UX-04) | component (chart wiring) | event-driven | `DashboardStudio` bloco Donut (`assets/fides-studio.jsx` :1005-1017) | exact (mesmo componente `Donut`, mesmo padrão de centro dinâmico) |
| `assets/fides-transacoes.jsx` — dedupe (`dedupeKey`/`buildDedupeIndex`, novo) | utility (função pura) | transform | nenhum analog direto no código (padrão vem 100% do CONTEXT.md D-09/D-10) | sem analog — ver seção "Sem Analog" |

## Pattern Assignments

### `assets/fides-store.jsx` — `faturasDoCartao` / `faturasDoCartaoCompleto` (FAT-01, D-02/D-03)

**Analog canônico da convenção correta:** `assets/fides-data.jsx` `mesFaturaFor` (linhas 52-64)

**Trecho real (convenção "mês que fecha", já correto — NÃO reescrever, só espelhar a lógica de derivação de data a partir dela):**
```javascript
// assets/fides-data.jsx:50-64
// Dada uma data dd/mm e um cartão, devolve o YYYY-MM do mês em que
// a fatura VENCE. Leva em conta diaFechamento + diaVencimento.
function mesFaturaFor(dStr, card, year = 2026) {
  if (!card) return null;
  const [dd, mm] = String(dStr).split('/').map(s => parseInt(s, 10));
  if (!dd || !mm) return null;
  const fechamento = card.diaFechamento || 5;
  // mês em que a fatura fecha (= mês da fatura, convencao BR)
  // dia exato do fechamento ja pertence ao proximo ciclo, portanto >=
  let monthClose = mm;
  if (dd >= fechamento) monthClose = mm + 1;
  let y = year;
  while (monthClose > 12) { monthClose -= 12; y += 1; }
  return ymOf(y, monthClose);
}
```

**Código-alvo do bug (as DUAS ocorrências gêmeas a corrigir — idênticas byte-a-byte, ambas precisam do fix):**
```javascript
// assets/fides-store.jsx:1265-1289 (faturasDoCartao) — bug
const mapped = faturas.map(fat => {
  const [yy, mm] = fat.mesFatura.split('-');
  const ano = parseInt(yy, 10);
  const mes = parseInt(mm, 10) - 1; // 0-based index

  const diaF = parseInt(card.diaFechamento, 10) || 5;
  const diaV = parseInt(card.diaVencimento, 10) || parseInt(card.due, 10) || 10;

  let mesF = mes;
  if (diaF > diaV) {                 // ❌ REMOVER — diverge da convenção do grupo (D-02)
    mesF = mes - 1;
  }

  const dtFechamento = new Date(ano, mesF, diaF);   // ❌ usa mesF errado
  const dtVencimento = new Date(ano, mes, diaV);     // ❌ nunca avança de mês

  let status = 'aberta';
  if (hoje > dtVencimento) {
    status = 'vencida';
  } else if (hoje > dtFechamento || hoje.getTime() === dtFechamento.getTime()) {
    status = 'fechada';
  }

  return { ...fat, dtFechamento, dtVencimento, status };
});
```
```javascript
// assets/fides-store.jsx:1334-1360 (faturasDoCartaoCompleto) — MESMO bug + campo extra `paga`
const mapped = faturas.map(fat => {
  const [yy, mm] = fat.mesFatura.split('-');
  const ano = parseInt(yy, 10);
  const mes = parseInt(mm, 10) - 1;

  const diaF = parseInt(card.diaFechamento, 10) || 5;
  const diaV = parseInt(card.diaVencimento, 10) || parseInt(card.due, 10) || 10;

  let mesF = mes;
  if (diaF > diaV) {                 // ❌ REMOVER (mesmo branch, segunda cópia)
    mesF = mes - 1;
  }

  const dtFechamento = new Date(ano, mesF, diaF);
  const dtVencimento = new Date(ano, mes, diaV);

  const paga = fat.txsAbertas.length === 0;
  let status = 'aberta';
  if (paga) {
    status = 'paga';
  } else if (hoje > dtVencimento) {
    status = 'vencida';
  } else if (hoje > dtFechamento || hoje.getTime() === dtFechamento.getTime()) {
    status = 'fechada';
  }

  return { ...fat, dtFechamento, dtVencimento, status, paga };
});
```

**Fix a aplicar (extrair helper compartilhado — Pitfall 1 do RESEARCH.md: corrigir só uma das duas funções gêmeas é o erro mais provável):**
```javascript
// Novo — colocar em assets/fides-data.jsx, logo após mesFaturaFor (ordem de script importa —
// fides-data.jsx carrega ANTES de fides-store.jsx, ver Pitfall 5 do RESEARCH.md)
function computeFaturaDates(mesFatura, card) {
  const [yy, mm] = mesFatura.split('-');
  const ano = parseInt(yy, 10);
  const mes = parseInt(mm, 10) - 1; // 0-based — mês em que a fatura FECHA (D-02)

  const diaF = parseInt(card.diaFechamento, 10) || 5;
  const diaV = parseInt(card.diaVencimento, 10) || parseInt(card.due, 10) || 10;

  const dtFechamento = new Date(ano, mes, diaF);
  // D-03: vence no mesmo mês do fechamento se diaV >= diaF, senão mês seguinte
  const dtVencimento = diaV >= diaF
    ? new Date(ano, mes, diaV)
    : new Date(ano, mes + 1, diaV);

  return { dtFechamento, dtVencimento };
}
```

Uso nas duas funções (substitui o bloco `mesF`/`dtFechamento`/`dtVencimento` acima):
```javascript
const { dtFechamento, dtVencimento } = computeFaturaDates(fat.mesFatura, card);
let status = 'aberta';
if (hoje > dtVencimento) status = 'vencida';
else if (hoje > dtFechamento || hoje.getTime() === dtFechamento.getTime()) status = 'fechada';
// faturasDoCartaoCompleto ainda soma: `if (paga) status = 'paga';` antes do else-if acima
```

**Fixtures de verificação (já existem como mocks — usar para regressão D-05):**
```javascript
// assets/fides-data.jsx:40-43
{ id: 'nu', diaFechamento: 5, diaVencimento: 15, ... }    // fecha < vence — regressão D-05
{ id: 'inter', diaFechamento: 22, diaVencimento: 2, ... } // fecha > vence — caso Bradesco-like
```

---

### `assets/fides-transacoes.jsx` — `handleImport` (IMP-01/IMP-02, D-06..D-12)

**Analog do fluxo atual a substituir (grava direto, sem preview):**
```javascript
// assets/fides-transacoes.jsx:554-622 (handleImport atual — CSV branch relevante)
const handleImport = React.useCallback((fmt = 'csv') => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = fmt === 'ofx' ? '.ofx,.qfx' : '.csv,text/csv';
  input.onchange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      // ... parse CSV/OFX ...
      lines.slice(1).forEach(line => {
        const cols = line.split(sep).map(c => c.replace(/^"|"$/g, '').trim());
        const [d, desc, cat, acctName, valStr, status, recur] = cols;
        // ...
        const acctObj = safeAccounts.find(a => a.name.toLowerCase() === (acctName || '').toLowerCase()); // ❌ D-12: nunca busca em `cards`
        addTransaction({
          desc, val: valRaw, cat: catKey,
          acct: acctObj?.id || safeAccounts[0]?.id,  // ❌ fallback silencioso p/ conta errada
          d: d || new Date().toLocaleDateString('pt-BR'),
          status: status === 'pago' ? 'pago' : 'pendente',
          recur: recur || null, mes: selectedMonth,  // ❌ D-11: força selectedMonth em vez da data da linha
        });
        imported++;
      });
      window.FidesUI.toast.success(`${imported} transação(ões) importada(s)...`);
    };
    reader.readAsText(file, 'UTF-8');
  };
  input.click();
}, [categories, addTransaction, selectedMonth]);
```

**Padrão de gravação em lote a reaproveitar no confirm (já existe, não reinventar):**
```javascript
// assets/fides-store.jsx:411-431
const addTransactions = React.useCallback(async (txs) => {
  if (mode === 'live' && userId) {
    try {
      const rows = txs.map(tx => txToRow(ensureMes(tx), userId, cards));
      const { error } = await window.fidesDb.from('transactions').insert(rows);
      if (error) throw error;
      await refreshData(userId);
    } catch (err) {
      console.error('[Fides] addTransactions:', err.message);
    }
    return;
  }
  const stamp = Date.now();
  setTransactions(prev => [
    ...txs.map((tx, i) => ({
      ...ensureMes(tx), _new: true,
      _id: tx._id ?? (stamp + i / 1000),
    })),
    ...prev,
  ]);
}, [mode, userId, cards, refreshData]);
```
Nota Pitfall 6 (RESEARCH.md): `ensureMes`/`txToRow` só recalculam mês via `mesFaturaFor` em modo `live` — o novo `handleImport` deve calcular `mes` explicitamente por linha ANTES de chamar `addTransactions` (não depender desse fallback, que não existe em modo `mock`).

**Padrão de resolução conta/cartão + mês por linha (D-11/D-12) — replicar, já em produção para edição manual:**
```javascript
// assets/fides-transacoes.jsx:1299-1321 (EditTxModal.handleSave — FIX-EDIT-MES)
const handleSave = () => {
  const numVal = parseVal(val);
  // FIX-EDIT-MES: recalcular mes de fatura se for cartao de credito
  let mesFinal;
  if (pay === 'credito' && acct && date) {
    const card = (cards || []).find(c => c.id === acct);
    if (card) {
      const [yr, mm, dd] = String(date).split('-');
      const mesCalc = window.mesFaturaFor(dd + '/' + mm, card, parseInt(yr));
      if (mesCalc) mesFinal = mesCalc;
    }
  }
  updateTransaction(tx._id, {
    desc, val: kind === 'despesa' ? -numVal : numVal, cat, acct, status, date,
    ...(mesFinal !== undefined ? { month: mesFinal } : {}),
  });
  onClose();
};
```
Toggle Conta/Cartão que alimenta esse `pay`/`acct` (mesmo componente, contexto de estado — replicar no seletor do preview):
```javascript
// assets/fides-transacoes.jsx:1281-1284
const _cardIds = new Set((cards || []).map(c => c.id));
const [pay, setPay] = React.useState(_cardIds.has(tx.acct) ? 'credito' : 'debito');
// ...
const isCard = pay === 'credito';
```

**Adaptação para lote (import), por linha, no confirm do preview modal:**
```javascript
// Padrão a escrever — combina FIX-EDIT-MES (por linha) com D-12 (destino explícito, não por nome)
function resolveRowForImport(row, destAcctId, cards) {
  const cardIdSet = new Set((cards || []).map(c => c.id));
  const isCard = cardIdSet.has(destAcctId);
  let mes = row.mesFromCsv; // fallback: `${yyyy}-${mm}` calendário da própria data da linha
  if (isCard) {
    const card = cards.find(c => c.id === destAcctId);
    if (card) {
      const mesCalc = window.mesFaturaFor(row.d, card, row.ano); // row.d = 'dd/mm'
      if (mesCalc) mes = mesCalc;
    }
  }
  return { ...row, acct: destAcctId, mes, card_id: isCard ? destAcctId : undefined };
}
```

**Dedupe normalizado (D-09/D-10) — função nova, sem analog direto no código, derivada só das decisões:**
```javascript
function dedupeKey(tx) {
  const desc = String(tx.desc || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const cents = Math.round(Math.abs(Number(tx.val)) * 100);
  const day = String(tx.date || '').slice(0, 10); // YYYY-MM-DD, sem tolerância (D-10)
  return `${desc}|${cents}|${day}`;
}
function buildDedupeIndex(transactions) {
  return new Set(transactions.map(dedupeKey));
}
```

---

### `assets/fides-transacoes.jsx` — `ImportPreviewModal` (componente novo, IMP-01, D-06/D-07/D-08)

**Analog de checklist + selecionar-todos (copiar estrutura de estado, não reinventar):**
```javascript
// assets/fides-contas.jsx:179-221 (PagarFaturaModal)
const [selected, setSelected] = React.useState(() => new Set(txs.map(t => t._id)));
const [selectedAccount, setSelectedAccount] = React.useState(accounts[0]?.id || '');

const toggle = (id) => setSelected(prev => {
  const next = new Set(prev);
  next.has(id) ? next.delete(id) : next.add(id);
  return next;
});

const toggleAll = () => {
  if (selected.size === txs.length) {
    setSelected(new Set());
  } else {
    setSelected(new Set(txs.map(t => t._id)));
  }
};

const totalSelecionado = txs
  .filter(t => selected.has(t._id))
  .reduce((sum, t) => sum + Math.abs(t.val), 0);

const allSelected = selected.size === txs.length;
const noneSelected = selected.size === 0;
```
**Diferença para `ImportPreviewModal` (D-07/D-08):** o `Set` inicial NÃO é "todas" nem "vazio" — é calculado uma única vez na abertura: `new Set(rows.filter(r => !r._isDuplicate).map(r => r._key))` (linhas novas marcadas, duplicatas desmarcadas).

**Shell de modal a reaproveitar (mesmo arquivo `fides-contas.jsx`, JSX de `PagarFaturaModal`):**
```jsx
// assets/fides-contas.jsx:234-260 (esqueleto de shell, cabeçalho com navegação)
<div className="fds-modal-backdrop" onClick={onClose}
     style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
  <div className="fds-modal" style={{ maxWidth: 480 }}
       onClick={e => e.stopPropagation()}>
    <div className="fds-modal-head">
      <div>
        <div className="fds-modal-eyebrow">{/* ... */}</div>
        <div className="fds-modal-title">{/* ... */}</div>
      </div>
      <button className="fds-icon-btn" onClick={onClose}><Icon.X size={16}/></button>
    </div>
    <div className="fds-modal-body">{/* linhas + checkboxes */}</div>
  </div>
</div>
```

**ATENÇÃO Rules of Hooks (Pitfall 3, RESEARCH.md — já causou bug real na Phase 07/MetasStudio):** `ImportPreviewModal` terá N linhas de tamanho variável. Todo `useState` (seleção, conta destino) deve ficar **um único hook no componente pai do modal**, indexado por `_key`/índice — nunca um `useState` dentro do `.map()` de renderização, e nenhum `if (rows.length === 0) return null` antes de todos os hooks estarem declarados.

**Confirmação/cancelamento sem `confirm()`/`alert()` — usar `fides-ui`:**
```javascript
// assets/fides-ui.jsx:186-225 (useConfirm — já usado em EditTxModal.handleDelete)
const confirm = React.useCallback(function (opts) {
  return new Promise(function (resolve) {
    setState({
      title: (opts && opts.title) || 'Confirmar',
      message: opts && opts.message,
      confirmLabel: opts && opts.confirmLabel,
      cancelLabel: opts && opts.cancelLabel,
      destructive: !!(opts && opts.destructive),
      resolve: resolve
    });
  });
}, []);
```
Uso real já em produção (mesmo arquivo, `EditTxModal.handleDelete`):
```javascript
// assets/fides-transacoes.jsx:1323-1324
const handleDelete = async () => {
  const ok = await confirmDelete({ title: `Excluir "${tx.desc}"?`, destructive: true });
```
**Nota:** o `ImportPreviewModal` em si (tabela de linhas + checkboxes + seletor de conta) precisa de shell próprio (`.fds-modal`), pois `ConfirmDialog` não suporta tabela — usar `ConfirmDialog`/`useConfirm` só se quiser um segundo passo de "confirmar resumo" opcional; o cancelamento (D-06, "cancelar não grava nada") é satisfeito simplesmente fechando o modal sem chamar `addTransactions`.

Toast de resumo pós-confirmação (padrão já usado no `handleImport` atual, manter):
```javascript
window.FidesUI.toast.success(`${imported} transação(ões) importada(s)...`);
```

---

### `assets/fides-transacoes.jsx` — botão "Cartão" no masthead (UX-03)

**Analog exato — mesma lógica de toggle, hoje presa dentro do modal de filtros avançados:**
```javascript
// assets/fides-transacoes.jsx:126-141 (TxAdvFiltersModal.toggleAllCards)
function toggleAllCards() {
  var cardIds = (cards || []).map(function(c) { return c.id; });
  var allOn = cardIds.length > 0 && cardIds.every(function(id) {
    return draft.contasSelected.indexOf(id) >= 0;
  });
  var list;
  if (allOn) {
    list = draft.contasSelected.filter(function(id) { return cardIds.indexOf(id) < 0; });
  } else {
    list = draft.contasSelected.slice();
    cardIds.forEach(function(id) {
      if (list.indexOf(id) < 0) list.push(id);
    });
  }
  setDraft(Object.assign({}, draft, { contasSelected: list }));
}
```
**Adaptação para chip fora do modal (opera direto sobre `advFilters`, não sobre `draft` local):**
```jsx
const cardIds = safeCards.map(c => c.id);
const allCardsActive = cardIds.length > 0 && cardIds.every(id => advFilters.contasSelected.includes(id));
<button type="button"
        className={'fds-chip' + (allCardsActive ? ' on' : '')}
        onClick={() => {
          setAdvFilters(prev => ({
            ...prev,
            contasSelected: allCardsActive
              ? prev.contasSelected.filter(id => !cardIds.includes(id))
              : Array.from(new Set([...prev.contasSelected, ...cardIds])),
          }));
        }}>
  <Icon.Card size={13}/> Cartão
</button>
```
Local recomendado: dentro de `fds-tx-v2-chips` (linha de chips Todas/Receitas/Despesas/Pendentes já ativa).

---

### `assets/fides-transacoes.jsx` — Donut modo Período + hover/tap (UX-04)

**Analog exato (mesmo componente `Donut`, já com `onActiveSlice`, padrão "centro dinâmico" já em produção):**
```jsx
// assets/fides-studio.jsx:1005-1017 (DashboardStudio)
<div className="fds-donut-wrap" ref={donutWrapRef}>
  <Donut data={spendByCategory} size={184} thickness={24} glow onActiveSlice={setActiveSlice}/>
  <div className="fds-donut-center">
    {activeSlice ? <>
      <div className="fds-donut-label">{activeSlice.label}</div>
      <div className="fds-donut-value">{fmtBRL(activeSlice.val, { compact: true })}</div>
      <div className="fds-donut-label">{Math.round((activeSlice.val / totalSpend) * 100)}%</div>
    </> : <>
      <div className="fds-donut-label">Total</div>
      <div className="fds-donut-value">{fmtBRL(totalSpend, { compact: true })}</div>
    </>}
  </div>
</div>
```
**Assinatura de `Donut` (interface a respeitar, `assets/fides-charts.jsx:116-143`):**
```javascript
function Donut({ data, size = 200, thickness = 22, gap = 0.012, accent = '#B45309', glow = false, onActiveSlice }) {
  const [activeIdx, setActiveIdx] = React.useState(null);
  // ...
  const handleEnter = (i) => { setActiveIdx(i); onActiveSlice?.(arcs[i]); };
  const handleLeave = () => { setActiveIdx(null); onActiveSlice?.(null); };
  const handleTap = (i, e) => {
    e.stopPropagation();
    if (i === activeIdx) { setActiveIdx(null); onActiveSlice?.(null); }
    else { setActiveIdx(i); onActiveSlice?.(arcs[i]); }
  };
```
**Estado a adicionar no componente `Transacoes` (topo, incondicional — Rules of Hooks):** `const [activeSlice, setActiveSlice] = React.useState(null);` — nunca dentro do bloco condicional `{rangeMode && (...)}`.

**Pitfall 4 (mismatch top-7 vs todas as fatias):**
```javascript
// assets/fides-charts.jsx:253-256 (CategoryChart — trunca)
function CategoryChart({ data, height = 240 }) {
  // ...
  const sorted = [...data].sort((a, b) => b.val - a.val).slice(0, 7);
```
`Donut` (linha 124, mesmo arquivo) desenha `data.map(...)` sem truncar — se houver 8+ categorias no período, o Donut mostra fatia sem barra correspondente no `CategoryChart`. Opção recomendada pelo RESEARCH.md (mais barata, menor risco): adicionar legenda textual completa ao lado do Donut, no padrão `fds-cats-list` já usado em `DashboardStudio` (linha 1018), sem alterar `CategoryChart`.

---

## Shared Patterns

### Confirmação / Toast (fides-ui)
**Fonte:** `assets/fides-ui.jsx` — `useConfirm` (linhas 186-225), `window.FidesUI.toast` (usado em `handleImport` atual, linha 591/616)
**Aplicar a:** `ImportPreviewModal` (cancelamento/confirmação, resumo pós-import), qualquer outro fluxo que hoje use `confirm()`/`alert()` nativo (nenhum encontrado no import atual — já está limpo, manter).

### Convenção única de mês-fatura
**Fonte:** `assets/fides-data.jsx` `mesFaturaFor` (linhas 52-64) — única fonte de verdade.
**Aplicar a:** `faturasDoCartao`, `faturasDoCartaoCompleto` (fix FAT-01), `resolveRowForImport` (import, D-11), `EditTxModal.handleSave` (já aplica, não mexer).
**Regra:** nenhum outro lugar do código deve redemonstrar `mesF`/`monthClose` com lógica própria — sempre chamar `mesFaturaFor` ou o novo `computeFaturaDates`.

### Bulk insert de transações
**Fonte:** `assets/fides-store.jsx` `addTransactions` (linhas 411-431) — já existe, já trata `mode === 'live'` vs mock.
**Aplicar a:** confirm do `ImportPreviewModal` — substituir o loop atual de `addTransaction` (linha a linha) por uma única chamada de `addTransactions([...linhas selecionadas])`.

### Resolução conta/cartão + mês por transação
**Fonte:** `assets/fides-transacoes.jsx` `EditTxModal.handleSave` (linhas 1299-1321, comentário `FIX-EDIT-MES`).
**Aplicar a:** cada linha selecionada no import (D-11/D-12) — via `resolveRowForImport` (ver acima).

## Sem Analog

| Arquivo/função | Papel | Data Flow | Motivo |
|---|---|---|---|
| `dedupeKey`/`buildDedupeIndex` (novo, `fides-transacoes.jsx`) | utility | transform | Nenhum dedupe client-side existe hoje no código — padrão vem inteiramente das decisões D-09/D-10 do CONTEXT.md, não de um analog existente. Implementação é trivial (função pura de string), baixo risco. |

## Metadata

**Escopo de busca de analogs:** `assets/fides-store.jsx`, `assets/fides-data.jsx`, `assets/fides-transacoes.jsx`, `assets/fides-contas.jsx`, `assets/fides-charts.jsx`, `assets/fides-studio.jsx`, `assets/fides-ui.jsx`.
**Arquivos lidos:** 7
**Data de extração:** 2026-07-04
