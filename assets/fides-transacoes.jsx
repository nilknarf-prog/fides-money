// fides-transacoes.jsx — Transações list + filters + Nova Transação modal

// Distingue tap de scroll em listas tocaveis (iOS): so dispara onTap se o
// ponteiro nao se moveu mais que 8px entre pointerdown e pointerup. Sem isso,
// rolar a lista de categorias acaba selecionando um item por engano.
function makeTapHandler(onTap) {
  var startX = 0;
  var startY = 0;
  var moved = false;
  return {
    onPointerDown: function (e) {
      startX = e.clientX;
      startY = e.clientY;
      moved = false;
    },
    onPointerMove: function (e) {
      var dx = Math.abs(e.clientX - startX);
      var dy = Math.abs(e.clientY - startY);
      if (dx > 8 || dy > 8) moved = true;
    },
    onPointerUp: function (e) {
      if (!moved) onTap(e);
    }
  };
}

// ─── Helpers locais ─────────────────────────────────────────────
var TX_MONTHS_LBL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function txDateToNum(d) {
  var parts = String(d || '').split('/');
  var day = parseInt(parts[0], 10) || 0;
  var month = parseInt(parts[1], 10) || 0;
  return month * 100 + day;
}

function acctNameOf(id, accounts, cards) {
  var a = accounts.find(function(x) { return x.id === id; });
  if (a) return { name: a.name, color: a.color, kind: 'conta' };
  var c = cards.find(function(x) { return x.id === id; });
  if (c) return { name: c.name, color: c.color || 'var(--ink-3)', kind: 'cartao' };
  return null;
}

// ─── Modal de filtros avancados (bottom sheet) ──────────────────
function TxAdvFiltersModal({ open, onClose, filters, onApply, categories, accounts, cards }) {
  var initial = filters || { categoriasSelected: [], contasSelected: [], recurring: 'all' };
  var [draft, setDraft] = React.useState(initial);

  React.useEffect(function() {
    if (open) setDraft(filters || { categoriasSelected: [], contasSelected: [], recurring: 'all' });
  }, [open]);

  if (!open) return null;

  function toggleCat(id) {
    var list = draft.categoriasSelected.indexOf(id) >= 0
      ? draft.categoriasSelected.filter(function(x) { return x !== id; })
      : draft.categoriasSelected.concat([id]);
    setDraft(Object.assign({}, draft, { categoriasSelected: list }));
  }
  function toggleAcct(id) {
    var list = draft.contasSelected.indexOf(id) >= 0
      ? draft.contasSelected.filter(function(x) { return x !== id; })
      : draft.contasSelected.concat([id]);
    setDraft(Object.assign({}, draft, { contasSelected: list }));
  }
  function clearAll() {
    var cleared = { categoriasSelected: [], contasSelected: [], recurring: 'all' };
    setDraft(cleared);
    onApply(cleared);
  }

  var catEntries = Object.entries(categories);
  var allAccts = (accounts || []).concat(cards || []);

  return (
    <div className="fds-tx-adv-backdrop" onClick={onClose}>
      <div className="fds-tx-adv-sheet" onClick={function(e) { e.stopPropagation(); }}>
        <header className="fds-tx-adv-head">
          <h2 className="fds-tx-adv-title">Filtros avançados</h2>
          <button className="fds-tx-adv-close" onClick={onClose} aria-label="Fechar">
            <Icon.X size={16}/>
          </button>
        </header>

        <div className="fds-tx-adv-body">
          <section className="fds-tx-adv-section">
            <h3 className="fds-tx-adv-label">Categorias</h3>
            <div className="fds-tx-adv-chips">
              {catEntries.map(function(entry) {
                var k = entry[0], c = entry[1];
                var on = draft.categoriasSelected.indexOf(k) >= 0;
                return (
                  <button key={k} type="button"
                          className={'fds-chip' + (on ? ' on' : '')}
                          onClick={function() { toggleCat(k); }}>
                    <span className="fds-tx-adv-cat-emoji">{c.emoji || '·'}</span>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </section>

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

          <section className="fds-tx-adv-section">
            <h3 className="fds-tx-adv-label">Recorrência</h3>
            <div className="fds-tx-adv-radio-group">
              {[
                { value: 'all', label: 'Todas' },
                { value: 'recurring', label: 'Apenas recorrentes' },
                { value: 'oneTime', label: 'Apenas únicas' },
              ].map(function(opt) {
                return (
                  <label key={opt.value} className="fds-tx-adv-radio">
                    <input type="radio" name="tx-adv-recur" value={opt.value}
                           checked={draft.recurring === opt.value}
                           onChange={function() {
                             setDraft(Object.assign({}, draft, { recurring: opt.value }));
                           }}/>
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        <footer className="fds-tx-adv-foot">
          <button type="button" className="fds-btn-ghost" onClick={clearAll}>
            Limpar filtros
          </button>
          <button type="button" className="fds-btn-primary"
                  onClick={function() { onApply(draft); onClose(); }}>
            <Icon.Check size={14}/> Aplicar
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────
function Transacoes({ variant, onAdd }) {
  const { monthTransactions, transactions, categories, selectedMonth, setSelectedMonth, monthLabel, addTransaction, updateTransaction, deleteTransaction, accounts, cards } = useFides();
  const [sortBy, setSortBy] = React.useState('data');         // data | categoria | conta | valor
  const [sortOrder, setSortOrder] = React.useState('desc');    // desc | asc
  const [filterType, setFilterType] = React.useState('todas'); // todas | receitas | despesas | pendentes
  const [search, setSearch] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState(new Set()); // Set<tx._id>
  const [advFilterOpen, setAdvFilterOpen] = React.useState(false);
  const [advFilters, setAdvFilters] = React.useState({
    categoriasSelected: [],
    contasSelected: [],
    recurring: 'all',
  });
  const [bulkCatPicker, setBulkCatPicker] = React.useState(false);
  const [editingTx, setEditingTx] = React.useState(null);
  const refConfirm = window.FidesUI.useConfirm();
  const confirmAction = refConfirm.confirm;
  const ConfirmHost = refConfirm.ConfirmHost;

  const safeAccounts = accounts || [];
  const safeCards = cards || [];

  const lblRaw = monthLabel(selectedMonth);
  const lbl = (lblRaw && typeof lblRaw === 'object')
    ? lblRaw
    : { short: String(lblRaw || selectedMonth), long: String(lblRaw || selectedMonth) };

  const currentMonthIdx = parseInt(selectedMonth.split('-')[1], 10) - 1;

  const baseList = monthTransactions;
  const flow = baseList.filter(function(t) { return !t.isTransfer; });

  // ─── Filtragem ─────────────────────────────────────────────
  const filtered = React.useMemo(function() {
    var result = baseList.slice();

    if (filterType === 'receitas') {
      result = result.filter(function(t) { return !t.isTransfer && t.val > 0; });
    } else if (filterType === 'despesas') {
      result = result.filter(function(t) { return !t.isTransfer && t.val < 0; });
    } else if (filterType === 'pendentes') {
      result = result.filter(function(t) { return !t.isTransfer && t.status === 'pendente'; });
    }

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

    if (advFilters.categoriasSelected.length > 0) {
      result = result.filter(function(t) {
        return advFilters.categoriasSelected.indexOf(t.cat) >= 0;
      });
    }
    if (advFilters.contasSelected.length > 0) {
      result = result.filter(function(t) {
        return advFilters.contasSelected.indexOf(t.acct) >= 0;
      });
    }
    if (advFilters.recurring === 'recurring') {
      result = result.filter(function(t) { return !!t.recur; });
    } else if (advFilters.recurring === 'oneTime') {
      result = result.filter(function(t) { return !t.recur; });
    }

    return result;
  }, [baseList, filterType, search, advFilters, categories]);

  // ─── Ordenacao ─────────────────────────────────────────────
  const sorted = React.useMemo(function() {
    var copy = filtered.slice();
    var dir = sortOrder === 'desc' ? -1 : 1;

    if (sortBy === 'data') {
      copy.sort(function(a, b) {
        var diff = txDateToNum(a.d) - txDateToNum(b.d);
        return diff * dir;
      });
    } else if (sortBy === 'categoria') {
      copy.sort(function(a, b) {
        var la = (categories[a.cat] && categories[a.cat].label) || a.cat || '';
        var lb = (categories[b.cat] && categories[b.cat].label) || b.cat || '';
        return la.localeCompare(lb, 'pt-BR') * dir;
      });
    } else if (sortBy === 'conta') {
      copy.sort(function(a, b) {
        var na = acctNameOf(a.acct, safeAccounts, safeCards);
        var nb = acctNameOf(b.acct, safeAccounts, safeCards);
        var sa = na ? na.name : 'zzz';
        var sb = nb ? nb.name : 'zzz';
        return sa.localeCompare(sb, 'pt-BR') * dir;
      });
    } else if (sortBy === 'valor') {
      copy.sort(function(a, b) {
        return (Math.abs(a.val) - Math.abs(b.val)) * dir;
      });
    }

    return copy;
  }, [filtered, sortBy, sortOrder, categories, safeAccounts, safeCards]);

  // ─── Agrupamento por categoria ou conta ────────────────────
  const grouped = React.useMemo(function() {
    if (sortBy === 'data' || sortBy === 'valor') {
      return sorted.map(function(t) { return { type: 'tx', data: t }; });
    }

    var groups = {};
    var order = [];
    sorted.forEach(function(t) {
      var key;
      if (sortBy === 'categoria') {
        key = (categories[t.cat] && categories[t.cat].label) || t.cat || 'Outros';
      } else if (sortBy === 'conta') {
        var info = acctNameOf(t.acct, safeAccounts, safeCards);
        key = info ? info.name : 'Outros';
      } else {
        key = 'Outros';
      }
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(t);
    });

    var result = [];
    order.forEach(function(key) {
      result.push({ type: 'header', groupName: key, txs: groups[key] });
      groups[key].forEach(function(t) {
        result.push({ type: 'tx', data: t });
      });
    });
    return result;
  }, [sorted, sortBy, categories, safeAccounts, safeCards]);

  // ── Exportar extrato (CSV ou OFX) ────────────────────────────
  const handleExport = React.useCallback((fmt = 'csv') => {
    if (fmt === 'ofx') {
      const now = new Date();
      const dtNow = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}120000`;
      const txLines = filtered.map(t => {
        const trnType = t.val >= 0 ? 'CREDIT' : 'DEBIT';
        const parts = (t.d || '01/01').split('/');
        const dd = (parts[0] || '01').padStart(2,'0');
        const mm = (parts[1] || '01').padStart(2,'0');
        const yyyy = selectedMonth.split('-')[0] || '2026';
        const dtPosted = `${yyyy}${mm}${dd}120000`;
        const amt = t.val.toFixed(2);
        const memo = (t.desc || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const fitid = t._id || `${dtPosted}-${Math.random().toString(36).slice(2,8)}`;
        return `<STMTTRN>\n<TRNTYPE>${trnType}\n<DTPOSTED>${dtPosted}\n<TRNAMT>${amt}\n<FITID>${fitid}\n<MEMO>${memo}\n</STMTTRN>`;
      }).join('\n');
      const ofx = [
        'OFXHEADER:100','DATA:OFXSGML','VERSION:102','SECURITY:NONE',
        'ENCODING:UTF-8','CHARSET:1252','COMPRESSION:NONE',
        'OLDFILEUID:NONE','NEWFILEUID:NONE','',
        '<OFX>','<SIGNONMSGSRSV1>','<SONRS>','<STATUS>',
        '<CODE>0','<SEVERITY>INFO','</STATUS>',
        `<DTSERVER>${dtNow}`,'<LANGUAGE>POR','</SONRS>','</SIGNONMSGSRSV1>',
        '<BANKMSGSRSV1>','<STMTTRNRS>','<TRNUID>1','<STATUS>',
        '<CODE>0','<SEVERITY>INFO','</STATUS>','<STMTRS>','<CURDEF>BRL',
        '<BANKACCTFROM>','<BANKID>0000','<ACCTID>Fides','<ACCTTYPE>CHECKING','</BANKACCTFROM>',
        '<BANKTRANLIST>',`<DTSTART>${dtNow}`,`<DTEND>${dtNow}`,
        txLines,
        '</BANKTRANLIST>','<LEDGERBAL>','<BALAMT>0.00',`<DTASOF>${dtNow}`,'</LEDGERBAL>',
        '</STMTRS>','</STMTTRNRS>','</BANKMSGSRSV1>','</OFX>',
      ].join('\n');
      const blob = new Blob([ofx], { type: 'application/x-ofx;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `fides-extrato-${selectedMonth}.ofx`; a.click();
      URL.revokeObjectURL(url);
    } else {
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
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `fides-extrato-${selectedMonth}.csv`; a.click();
      URL.revokeObjectURL(url);
    }
  }, [filtered, categories, selectedMonth]);

  // ── Importar extrato (CSV ou OFX) ────────────────────────────
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
        if (fmt === 'ofx') {
          const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
          if (blocks.length === 0) { window.FidesUI.toast.error('Nenhuma transação encontrada no arquivo OFX.'); return; }
          const getTag = (block, tag) => {
            const m = block.match(new RegExp(`<${tag}>([^<\n\r]+)`, 'i'));
            return m ? m[1].trim() : '';
          };
          let imported = 0, errors = 0;
          blocks.forEach(block => {
            const memo   = getTag(block, 'MEMO') || getTag(block, 'NAME') || '';
            const amtStr = getTag(block, 'TRNAMT');
            const dtRaw  = getTag(block, 'DTPOSTED');
            if (!memo || !amtStr) { errors++; return; }
            const amt = parseFloat(amtStr.replace(',', '.'));
            if (isNaN(amt)) { errors++; return; }
            const yyyy = dtRaw.slice(0, 4) || selectedMonth.split('-')[0];
            const mm   = dtRaw.slice(4, 6) || selectedMonth.split('-')[1] || '01';
            const dd   = dtRaw.slice(6, 8) || '01';
            addTransaction({
              desc: memo, val: amt, cat: 'outros',
              acct: safeAccounts[0]?.id,
              d: `${dd}/${mm}`,
              status: 'pendente', recur: null,
              mes: `${yyyy}-${mm}`,
            });
            imported++;
          });
          window.FidesUI.toast.success(`${imported} transação(ões) importada(s)${errors > 0 ? `, ${errors} bloco(s) ignorado(s)` : ''}.`);
        } else {
          const lines = text.split(/\r?\n/).filter(Boolean);
          if (lines.length < 2) { window.FidesUI.toast.error('CSV vazio ou sem dados.'); return; }
          const sep = lines[0].includes(';') ? ';' : ',';
          let imported = 0, errors = 0;
          lines.slice(1).forEach(line => {
            const cols = line.split(sep).map(c => c.replace(/^"|"$/g, '').trim());
            const [d, desc, cat, acctName, valStr, status, recur] = cols;
            if (!desc || !valStr) { errors++; return; }
            const valRaw = parseFloat(valStr.replace(',', '.'));
            if (isNaN(valRaw)) { errors++; return; }
            const acctObj = safeAccounts.find(a => a.name.toLowerCase() === (acctName || '').toLowerCase());
            const catKey  = Object.entries(categories).find(
              ([, v]) => v.label.toLowerCase() === (cat || '').toLowerCase()
            )?.[0] || 'outros';
            addTransaction({
              desc, val: valRaw, cat: catKey,
              acct: acctObj?.id || safeAccounts[0]?.id,
              d: d || new Date().toLocaleDateString('pt-BR'),
              status: status === 'pago' ? 'pago' : 'pendente',
              recur: recur || null, mes: selectedMonth,
            });
            imported++;
          });
          window.FidesUI.toast.success(`${imported} transação(ões) importada(s)${errors > 0 ? `, ${errors} linha(s) ignorada(s)` : ''}.`);
        }
      };
      reader.readAsText(file, 'UTF-8');
    };
    input.click();
  }, [categories, addTransaction, selectedMonth]);

  // ─── Totais (sobre 'filtered') ────────────────────────────
  const totals = React.useMemo(function() {
    var nonTransfer = filtered.filter(function(t) { return !t.isTransfer; });
    return {
      receitas: nonTransfer.filter(function(t) { return t.val > 0; })
                           .reduce(function(s, t) { return s + t.val; }, 0),
      despesas: -nonTransfer.filter(function(t) { return t.val < 0; })
                            .reduce(function(s, t) { return s + t.val; }, 0),
      saldo: nonTransfer.reduce(function(s, t) { return s + t.val; }, 0),
    };
  }, [filtered]);

  // ─── Contagens dos chips (sobre baseList, exclui transferencia) ─
  const chipCounts = React.useMemo(function() {
    var nt = baseList.filter(function(t) { return !t.isTransfer; });
    return {
      todas: baseList.length,
      receitas: nt.filter(function(t) { return t.val > 0; }).length,
      despesas: nt.filter(function(t) { return t.val < 0; }).length,
      pendentes: nt.filter(function(t) { return t.status === 'pendente'; }).length,
    };
  }, [baseList]);

  // ─── Selecao por tx._id (estavel a reordenacao) ───────────
  const toggleSelect = React.useCallback(function(txId) {
    setSelectedIds(function(prev) {
      var s = new Set(prev);
      if (s.has(txId)) s.delete(txId); else s.add(txId);
      return s;
    });
  }, []);

  const toggleSelectAll = React.useCallback(function() {
    setSelectedIds(function(prev) {
      if (prev.size === sorted.length && sorted.length > 0) return new Set();
      return new Set(sorted.map(function(t) { return t._id; }));
    });
  }, [sorted]);

  const clearSel = React.useCallback(function() {
    setSelectedIds(new Set());
    setBulkCatPicker(false);
  }, []);

  function selTxs() {
    var byId = {};
    sorted.forEach(function(t) { byId[t._id] = t; });
    var out = [];
    selectedIds.forEach(function(id) { if (byId[id]) out.push(byId[id]); });
    return out;
  }

  const bulkMarkPaid = function() {
    var txs = selTxs();
    var n = txs.length;
    if (n === 0) return;
    txs.forEach(function(t) { updateTransaction(t._id, { status: 'pago' }); });
    clearSel();
    window.FidesUI.toast.success(n > 1 ? (n + ' transações marcadas como pagas') : '1 transação marcada como paga');
  };

  const bulkDelete = async function() {
    var txs = selTxs();
    var n = txs.length;
    if (n === 0) return;
    var ok = await confirmAction({
      title: n > 1 ? ('Excluir ' + n + ' transações?') : 'Excluir transação?',
      message: 'Esta ação não pode ser desfeita.',
      destructive: true,
      confirmLabel: 'Excluir'
    });
    if (!ok) return;
    txs.forEach(function(t) { deleteTransaction(t._id); });
    clearSel();
    window.FidesUI.toast.success(n > 1 ? (n + ' transações excluídas') : '1 transação excluída');
  };

  const bulkCategorize = function(catKey) {
    var txs = selTxs();
    var n = txs.length;
    if (n === 0) return;
    txs.forEach(function(t) { updateTransaction(t._id, { cat: catKey }); });
    clearSel();
    var catLbl = (categories[catKey] && categories[catKey].label) || catKey;
    window.FidesUI.toast.success((n > 1 ? (n + ' transações movidas') : '1 transação movida') + ' para ' + catLbl);
  };

  const allCats = Object.entries(categories).sort(function(a, b) {
    return ((a[1].label || a[0])).localeCompare((b[1].label || b[0]), 'pt-BR');
  });

  function handleSortClick(by) {
    if (sortBy === by) {
      setSortOrder(function(o) { return o === 'desc' ? 'asc' : 'desc'; });
    } else {
      setSortBy(by);
      setSortOrder('desc');
    }
  }

  function clearAllFilters() {
    setFilterType('todas');
    setSearch('');
    setAdvFilters({ categoriasSelected: [], contasSelected: [], recurring: 'all' });
  }

  const advCount = advFilters.categoriasSelected.length + advFilters.contasSelected.length
                 + (advFilters.recurring !== 'all' ? 1 : 0);
  const hasAnyFilter = filterType !== 'todas' || !!search || advCount > 0;

  // Sort labels para a UI
  const SORT_LABELS = { data: 'Data', categoria: 'Categoria', conta: 'Conta', valor: 'Valor' };

  return (
    <div className="fds-page fds-tx-v2" data-od-id="transacoes">
      {/* ─── Header: ano + meses + acoes ─── */}
      <section className="fds-card fds-tx-v2-header" data-od-id="tx-cabecalho">
        <div className="fds-tx-v2-monthrow">
          <div className="fds-tx-v2-year" aria-label="Ano selecionado">
            <span>{selectedMonth.split('-')[0]}</span>
            <Icon.Down size={13}/>
          </div>
          <div className="fds-tx-v2-months" role="tablist" aria-label="Meses">
            {TX_MONTHS_LBL.map(function(m, i) {
              var on = i === currentMonthIdx;
              return (
                <button key={m} type="button"
                        role="tab" aria-selected={on}
                        className={'fds-tx-v2-month' + (on ? ' on' : '')}
                        onClick={function() {
                          var yr = selectedMonth.split('-')[0];
                          setSelectedMonth(yr + '-' + String(i + 1).padStart(2, '0'));
                        }}>
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        <div className="fds-tx-v2-actions">
          <button type="button" className="fds-btn-ghost fds-tx-v2-action"
                  onPointerUp={function() { handleImport('csv'); }}>
            <Icon.Import size={14}/> Importar
          </button>
          <button type="button" className="fds-btn-ghost fds-tx-v2-action"
                  onPointerUp={function() { handleExport('csv'); }}>
            <Icon.Export size={14}/> Exportar
          </button>
        </div>
      </section>

      {/* ─── Organizacao (sort pills) ─── */}
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
                {on && (
                  <span className="fds-tx-v2-sort-arrow" aria-hidden="true">
                    {sortOrder === 'desc' ? '↓' : '↑'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ─── Filtros (chips + busca + adv) ─── */}
      <section className="fds-card fds-tx-v2-filters" data-od-id="tx-filtros">
        <div className="fds-tx-v2-chips">
          {[
            { k: 'todas',     l: 'Todas',     c: chipCounts.todas },
            { k: 'receitas',  l: 'Receitas',  c: chipCounts.receitas },
            { k: 'despesas',  l: 'Despesas',  c: chipCounts.despesas },
            { k: 'pendentes', l: 'Pendentes', c: chipCounts.pendentes },
          ].map(function(f) {
            var on = filterType === f.k;
            return (
              <button key={f.k} type="button"
                      className={'fds-chip' + (on ? ' on' : '')}
                      onClick={function() { setFilterType(f.k); }}>
                {f.l}
                <span className="fds-chip-count">{f.c}</span>
              </button>
            );
          })}
          <span className="fds-chip-sep" aria-hidden="true"/>
          <button type="button"
                  className={'fds-chip fds-tx-v2-chip-adv' + (advCount > 0 ? ' on' : '')}
                  onClick={function() { setAdvFilterOpen(true); }}>
            <Icon.Filter size={13}/> Filtros avançados
            {advCount > 0 && <span className="fds-chip-count">{advCount}</span>}
          </button>
        </div>

        <div className="fds-tx-v2-search">
          <Icon.Search size={14} style={{ opacity: 0.5 }}/>
          <input className="fds-tx-v2-search-input"
                 placeholder="Buscar descrição, valor, categoria…"
                 value={search}
                 onChange={function(e) { setSearch(e.target.value); }}/>
          {search && (
            <button type="button" className="fds-tx-v2-search-clear"
                    aria-label="Limpar busca"
                    onClick={function() { setSearch(''); }}>
              <Icon.X size={13}/>
            </button>
          )}
        </div>
      </section>

      {/* ─── Lista ─── */}
      {sorted.length === 0 ? (
        <section className="fds-card fds-tx-v2-empty" data-od-id="tx-vazio">
          <div className="fds-tx-v2-empty-icon" aria-hidden="true">📭</div>
          <h3 className="fds-tx-v2-empty-title">Nenhuma transação encontrada</h3>
          <p className="fds-tx-v2-empty-desc">
            {hasAnyFilter
              ? 'Ajuste seus filtros ou crie sua primeira transação no mês.'
              : 'Lance sua primeira transação para começar a acompanhar o mês.'}
          </p>
          <div className="fds-tx-v2-empty-actions">
            {hasAnyFilter && (
              <button type="button" className="fds-btn-ghost" onClick={clearAllFilters}>
                Limpar filtros
              </button>
            )}
            <button type="button" className="fds-btn-primary" onClick={onAdd}>
              <Icon.Plus size={14}/> Nova transação
            </button>
          </div>
        </section>
      ) : (
        <section className="fds-card fds-tx-v2-list" data-od-id="tx-lista">
          <div className="fds-tx-v2-list-head">
            <div className="fds-tx-v2-list-head-left">
              <input type="checkbox" className="fds-cbx"
                     aria-label="Selecionar todas"
                     checked={selectedIds.size === sorted.length && sorted.length > 0}
                     onChange={toggleSelectAll}/>
              {selectedIds.size > 0 ? (
                <span className="fds-tx-v2-bulk">
                  <span className="fds-tx-v2-bulk-count">
                    {selectedIds.size} selecionada{selectedIds.size > 1 ? 's' : ''}
                  </span>
                  <button type="button" className="fds-tx-v2-bulk-act"
                          onPointerUp={bulkMarkPaid}>
                    <Icon.Check size={12}/> Marcar pago
                  </button>
                  <button type="button" className="fds-tx-v2-bulk-act"
                          onPointerUp={function(e) {
                            e.stopPropagation();
                            setBulkCatPicker(function(v) { return !v; });
                          }}>
                    <Icon.Tag size={12}/> Categorizar
                  </button>
                  <button type="button" className="fds-tx-v2-bulk-act fds-tx-v2-bulk-act-danger"
                          onPointerUp={bulkDelete}>
                    <Icon.X size={12}/> Excluir
                  </button>
                  <button type="button" className="fds-tx-v2-bulk-clear"
                          aria-label="Limpar seleção"
                          onPointerUp={clearSel}>×</button>
                </span>
              ) : (
                <span className="fds-tx-v2-list-count">
                  <strong>{filtered.length}</strong> de {baseList.length} em {lbl.long}
                </span>
              )}
            </div>
            <div className="fds-tx-v2-list-head-right">
              Saldo:&nbsp;
              <strong style={{ color: totals.saldo >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
                {fmtBRL(totals.saldo)}
              </strong>
            </div>
          </div>

          {/* Picker de categoria do bulk (inline) */}
          {bulkCatPicker && selectedIds.size > 0 && (
            <React.Fragment>
              <div className="fds-tx-v2-bulk-cat-back"
                   {...makeTapHandler(function(e) {
                     if (e.target === e.currentTarget) setBulkCatPicker(false);
                   })}/>
              <div className="fds-tx-v2-bulk-cat" onPointerUp={function(e) { e.stopPropagation(); }}>
                <div className="fds-tx-v2-bulk-cat-head">Mover para categoria</div>
                <div className="fds-tx-v2-bulk-cat-list">
                  {allCats.map(function(entry) {
                    var k = entry[0], c = entry[1];
                    var tap = makeTapHandler(function() { bulkCategorize(k); });
                    return (
                      <button key={k} type="button" className="fds-tx-v2-bulk-cat-item" {...tap}>
                        <CategoryAvatar cat={k} size={20}/>
                        <span>{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </React.Fragment>
          )}

          <div className="fds-tx-v2-cards">
            {grouped.map(function(item, idx) {
              if (item.type === 'header') {
                var groupTotal = item.txs.reduce(function(s, t) { return s + t.val; }, 0);
                return (
                  <div key={'g-' + item.groupName + '-' + idx} className="fds-tx-v2-group">
                    <div className="fds-tx-v2-group-left">
                      <span className="fds-tx-v2-group-name">{item.groupName}</span>
                      <span className="fds-tx-v2-group-count">
                        {item.txs.length} transaç{item.txs.length === 1 ? 'ão' : 'ões'}
                      </span>
                    </div>
                    <div className="fds-tx-v2-group-total"
                         style={{ color: groupTotal >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
                      {fmtBRL(groupTotal)}
                    </div>
                  </div>
                );
              }

              var t = item.data;
              var c = categories[t.cat] || { label: t.cat, tint: 'var(--muted-2)', emoji: '🏷️' };
              var acctInfo = acctNameOf(t.acct, safeAccounts, safeCards);
              var isSelected = selectedIds.has(t._id);
              var neg = t.val < 0;
              var pos = t.val > 0;
              var isTransfer = !!t.isTransfer;
              var amtClass = 'fds-tx-v2-card-amt' + (neg ? ' neg' : pos ? ' pos' : '');

              return (
                <div key={'tx-' + (t._id || idx)}
                     className={'fds-tx-v2-card'
                                + (isSelected ? ' selected' : '')
                                + (isTransfer ? ' transfer' : '')
                                + (t._new ? ' is-new' : '')}
                     onClick={function(e) {
                       if (e.target.closest('.fds-tx-v2-card-check')) return;
                       if (e.target.closest('.fds-tx-v2-card-menu')) return;
                       setEditingTx(Object.assign({}, t));
                     }}>
                  <label className="fds-tx-v2-card-check"
                         onClick={function(e) { e.stopPropagation(); }}>
                    <input type="checkbox" className="fds-cbx"
                           checked={isSelected}
                           onChange={function() { toggleSelect(t._id); }}
                           aria-label={'Selecionar ' + (t.desc || 'transação')}/>
                  </label>

                  <div className="fds-tx-v2-card-avatar"
                       style={{ background: 'color-mix(in oklab, ' + (c.tint || 'var(--muted-2)') + ' 18%, transparent)' }}>
                    <CategoryAvatar cat={t.cat} size={28}/>
                  </div>

                  <div className="fds-tx-v2-card-main">
                    <div className="fds-tx-v2-card-row1">
                      <span className="fds-tx-v2-card-desc">{t.desc}</span>
                      <span className={amtClass}>
                        {pos ? '+' : neg ? '−' : '↔'} R$&nbsp;
                        {Math.abs(t.val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="fds-tx-v2-card-row2">
                      <span className="fds-tx-v2-card-meta">
                        <span className="fds-tx-v2-card-dot" style={{ background: c.tint || 'var(--muted-2)' }}/>
                        {c.label}
                      </span>

                      {acctInfo && (
                        <span className="fds-tx-v2-card-meta">
                          {acctInfo.kind === 'cartao'
                            ? <Icon.Card size={11}/>
                            : <span className="fds-tx-v2-card-dot" style={{ background: acctInfo.color }}/>}
                          {acctInfo.name}
                        </span>
                      )}

                      <span className="fds-tx-v2-card-meta fds-tx-v2-card-date">{t.d}</span>

                      {t.status === 'pago' && (
                        <span className="fds-tx-v2-badge status-pago">
                          <Icon.Check size={10}/> Pago
                        </span>
                      )}
                      {t.status === 'pendente' && (
                        <span className="fds-tx-v2-badge status-pendente">
                          <Icon.Clock size={10}/> Pendente
                        </span>
                      )}
                      {t.status === 'agendado' && (
                        <span className="fds-tx-v2-badge status-agendado">
                          <Icon.Calendar size={10}/> Agendado
                        </span>
                      )}
                      {t.recur && (
                        <span className="fds-tx-v2-badge recur">
                          <Icon.Refresh size={10}/> {t.recur}
                        </span>
                      )}
                      {t.sub && <span className="fds-tx-v2-badge sub">{t.sub}</span>}
                    </div>
                  </div>

                  <button type="button" className="fds-tx-v2-card-menu"
                          aria-label="Editar transação"
                          onClick={function(e) {
                            e.stopPropagation();
                            setEditingTx(Object.assign({}, t));
                          }}>
                    <Icon.Dots size={15}/>
                  </button>
                </div>
              );
            })}
          </div>

          {hasAnyFilter && filtered.length < baseList.length && (
            <div className="fds-tx-v2-list-foot">
              <span className="fds-muted">
                Mostrando <strong>{filtered.length}</strong> de {baseList.length} em {lbl.long}
              </span>
              <button type="button" className="fds-tx-v2-clear-link" onClick={clearAllFilters}>
                Limpar filtros
              </button>
            </div>
          )}
        </section>
      )}

      <TxAdvFiltersModal open={advFilterOpen}
                         onClose={function() { setAdvFilterOpen(false); }}
                         filters={advFilters}
                         onApply={setAdvFilters}
                         categories={categories}
                         accounts={safeAccounts}
                         cards={safeCards}/>

      <ConfirmHost />

      {editingTx && <EditTxModal tx={editingTx} onClose={function() { setEditingTx(null); }}/>}
    </div>
  );
}


// ─── TX KPI tile (compact) ────────────────────────────────────
function TxKpi({ label, value, accent, delta, spark, kind, variant, pendingCount, onSeePending }) {
  return (
    <div className="fds-card fds-tx-kpi">
      <div className="fds-tx-kpi-head">
        <span className="fds-kpi-label">{label}</span>
        {delta != null && (
          <span className={`fds-kpi-delta ${delta >= 0 ? 'up' : 'down'}`}>
            {delta >= 0 ? <Icon.ArrowUp size={11}/> : <Icon.ArrowDown size={11}/>}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {kind === 'pending' && <span className="fds-tag warn"><Icon.Clock size={11}/> {pendingCount ?? 0} {(pendingCount ?? 0) === 1 ? 'item' : 'itens'}</span>}
      </div>
      <div className="fds-tx-kpi-amt" style={{ color: value < 0 ? 'var(--bad)' : 'var(--ink)' }}>
        {fmtBRL(value)}
      </div>
      {spark && <Sparkline values={spark} width={180} height={26} accent={accent} glow={variant === 'v3'}/>}
      {kind === 'pending' && (
        <div className="fds-tx-kpi-pending">
          <span><Icon.Clock size={11}/> {pendingCount ?? 0} {(pendingCount ?? 0) === 1 ? 'item em aberto' : 'itens em aberto'}</span>
          <button type="button" className="fds-link-sm" onClick={onSeePending} style={{ background:'none', border:'none', padding:'8px 4px', minHeight:44, touchAction:'manipulation', WebkitTapHighlightColor:'transparent', color:'var(--accent)', cursor:'pointer' }}>Ver →</button>
        </div>
      )}
    </div>
  );
}

// ─── Modal: Editar Transação ──────────────────────────────────
function EditTxModal({ tx, onClose }) {
  const { categories, updateTransaction, deleteTransaction, accounts, cards } = useFides();
  const { confirm: confirmDelete, ConfirmHost } = window.FidesUI.useConfirm();

  const parseVal = (s) => {
    const clean = String(s).replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  };

  // Inferir pay da tx existente — cartão UUID → credito, conta → debito
  const _cardIds = new Set((cards || []).map(c => c.id));
  const [pay,    setPay]    = React.useState(_cardIds.has(tx.acct) ? 'credito' : 'debito');
  const [kind,   setKind]   = React.useState(tx.val >= 0 ? 'receita' : 'despesa');
  const [desc,   setDesc]   = React.useState(tx.desc  || '');
  const [val,    setVal]    = React.useState(Math.abs(tx.val).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  const [date,   setDate]   = React.useState(tx.date  || '');
  const [cat,    setCat]    = React.useState(tx.cat   || '');
  const [acct,   setAcct]   = React.useState(tx.acct  || '');
  React.useEffect(() => {
    if (!acct && accounts.length > 0) setAcct(accounts[0].id);
  }, [accounts]);
  const [status, setStatus] = React.useState(tx.status || 'pago');

  const handleSave = () => {
    const numVal = parseVal(val);
    updateTransaction(tx._id, {
      desc,
      val:    kind === 'despesa' ? -numVal : numVal,
      cat,
      acct,
      status,
      date,
    });
    onClose();
  };

  const handleDelete = async () => {
    const ok = await confirmDelete({ title: `Excluir "${tx.desc}"?`, destructive: true });
    if (ok) {
      deleteTransaction(tx._id);
      onClose();
    }
  };

  const catEntries = Object.entries(categories);
  const canSave = desc.trim().length > 0 && parseVal(val) > 0;

  return (
    <div className="fds-modal-backdrop" onClick={onClose}>
      <div className="fds-modal" onClick={(e) => e.stopPropagation()}>
        <header className="fds-modal-head">
          <h2 className="fds-modal-title">Editar transação</h2>
          <button className="fds-modal-close" onClick={onClose}><Icon.X size={16}/></button>
        </header>

        <div className="fds-modal-body">
          {/* Tipo: Despesa / Receita */}
          <div className="fds-field">
            <label className="fds-label">Tipo</label>
            <div className="fds-seg">
              <button type="button" className={kind === 'despesa' ? 'on' : ''} onClick={() => setKind('despesa')}>Despesa</button>
              <button type="button" className={kind === 'receita' ? 'on' : ''} onClick={() => setKind('receita')}>Receita</button>
            </div>
          </div>

          {/* Pagamento: Débito / Crédito */}
          <div className="fds-field">
            <label className="fds-label">Forma de pagamento</label>
            <div className="fds-seg">
              <button type="button" className={pay === 'debito' ? 'on' : ''} onClick={() => {
                setPay('debito');
                setAcct(accounts[0]?.id || '');
              }}>Débito</button>
              <button type="button" className={pay === 'credito' ? 'on' : ''} onClick={() => {
                setPay('credito');
                setAcct(cards[0]?.id || '');
              }}>Crédito</button>
            </div>
          </div>

          {/* Descrição */}
          <div className="fds-field">
            <label className="fds-label">Descrição</label>
            <input className="fds-input" value={desc}
                   onChange={(e) => setDesc(e.target.value)}
                   placeholder="Ex: Supermercado"/>
          </div>

          {/* Valor */}
          <div className="fds-field">
            <label className="fds-label">Valor (R$)</label>
            <input className="fds-input" value={val}
                   onChange={(e) => setVal(e.target.value)}
                   placeholder="0,00" inputMode="decimal"/>
          </div>

          {/* Data */}
          <div className="fds-field">
            <label className="fds-label">Data</label>
            <input className="fds-input" type="date" value={date}
                   onChange={(e) => setDate(e.target.value)}/>
          </div>

          {/* Categoria */}
          <div className="fds-field">
            <label className="fds-label">Categoria</label>
            <select className="fds-select" value={cat} onChange={(e) => setCat(e.target.value)}>
              {catEntries.map(([k, v]) => (
                <option key={k} value={k}>{v.emoji} {v.label}</option>
              ))}
            </select>
          </div>

          {/* Conta / Cartão */}
          <div className="fds-field">
            <label className="fds-label">{pay === 'credito' ? 'Cartão' : 'Conta'}</label>
            <select className="fds-select" value={acct} onChange={(e) => setAcct(e.target.value)}>
              {pay === 'credito'
                ? cards.map(c => <option key={c.id} value={c.id}>{c.name} {c.tag}</option>)
                : accounts.map(a => <option key={a.id} value={a.id}>{a.name} ·· {a.tag}</option>)}
            </select>
          </div>

          {/* Status */}
          <div className="fds-field">
            <label className="fds-label">Status</label>
            <div className="fds-seg">
              <button type="button" className={status === 'pago' ? 'on' : ''} onClick={() => setStatus('pago')}>Pago</button>
              <button type="button" className={status === 'pendente' ? 'on' : ''} onClick={() => setStatus('pendente')}>Pendente</button>
            </div>
          </div>
        </div>

        <footer className="fds-modal-foot">
          <button className="fds-btn-ghost danger" onClick={handleDelete}>
            <Icon.X size={13}/> Excluir
          </button>
          <div className="fds-modal-foot-actions">
            <button className="fds-btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="fds-btn-primary" onClick={handleSave} disabled={!canSave}>
              <Icon.Check size={14}/> Salvar alterações
            </button>
          </div>
        </footer>
      </div>
      <ConfirmHost />
    </div>
  );
}

// ─── Modal: Nova Transação ────────────────────────────────────
function NovaTransacaoModal({ open, onClose, onSave, variant }) {
  const { categories, openCategoryModal, accounts, cards, transferFunds, addTransaction, addTransactions } = useFides();
  const toast = window.FidesUI.useToast();
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;

  const [kind, setKind] = React.useState('despesa');
  const [pay, setPay] = React.useState('debito');
  const [acct, setAcct] = React.useState('');
  const [toAcct, setToAcct] = React.useState('');
  const [card, setCard] = React.useState('');
  React.useEffect(() => {
    if (!acct || !accounts.find(a => a.id === acct)) setAcct(accounts[0]?.id || '');
  }, [accounts]);
  React.useEffect(() => {
    if (!card || !cards.find(c => c.id === card)) setCard(cards[0]?.id || '');
  }, [cards]);
  const [cat, setCat] = React.useState('mercado');
  const [paid, setPaid] = React.useState(true);
  const [recur, setRecur] = React.useState(false);
  const [recurMode, setRecurMode] = React.useState('fixo'); // 'fixo' | number of months
  const [parcelas, setParcelas] = React.useState(1);
  const [desc, setDesc] = React.useState('');
  const [val, setVal] = React.useState('');
  const [date, setDate] = React.useState(todayStr);

  // Parcelamento só faz sentido em despesas no crédito
  const canParcelar = pay === 'credito' && kind === 'despesa';
  React.useEffect(() => { if (!canParcelar) setParcelas(1); }, [canParcelar]);

  // derivado — true quando a conta selecionada for um cartão de crédito
  const isCard = pay === 'credito';
  React.useEffect(() => {
    if (isCard) setPaid(false);
  }, [isCard]);

  // When user switches kind, pick a sensible default category
  React.useEffect(() => {
    if (kind === 'receita' && categories[cat]?.group !== 'receita') {
      const first = Object.entries(categories).find(([, c]) => c.group === 'receita');
      if (first) setCat(first[0]);
    } else if (kind !== 'receita' && categories[cat]?.group === 'receita') {
      setCat('mercado');
    }
  }, [kind]);

  if (!open) return null;
  const accentByKind = kind === 'despesa' ? 'var(--bad)' : kind === 'receita' ? 'var(--ok)' : 'var(--info)';

  // Parse "1.234,56" or "1234.56" or "1234,56" into number
  const parseVal = (s) => {
    if (!s) return 0;
    const cleaned = String(s).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  };
  // Normalize date dd/mm/yyyy → dd/mm (matches existing TRANSACTIONS shape)
  const shortDate = (d) => {
    const parts = String(d).split('/');
    return parts[0] && parts[1] ? `${parts[0].padStart(2,'0')}/${parts[1].padStart(2,'0')}` : todayStr.slice(0,5);
  };

  const canSave = kind === 'transferencia'
    ? (acct && toAcct && acct !== toAcct && parseVal(val) > 0)
    : (desc.trim() && parseVal(val) > 0 && (pay !== 'debito' || accounts.length > 0));

  // Build a list of transactions — one per parcela (crédito) ou por mês de recorrência (débito), ou apenas 1
  const buildTxs = () => {
    const numeric = parseVal(val);
    let N = 1;
    let modo = 'unica';
    if (canParcelar && parcelas > 1) { N = parcelas; modo = 'parcela'; }
    else if (recur && pay === 'debito' && typeof recurMode === 'number' && recurMode > 1) { N = recurMode; modo = 'recur'; }

    // Para parcelamento: divide o valor pelas parcelas; para recorrência débito: cada mês mantém o valor completo
    const each = modo === 'parcela' ? numeric / N : numeric;
    const signed = kind === 'receita' ? Math.abs(each)
                  : kind === 'despesa' ? -Math.abs(each)
                  : 0;
    const acctId = pay === 'debito' ? acct : (cards.find(c => c.id === card)?.id || acct);
    const groupId = N > 1 ? 'g' + Date.now() : null;
    // Parse date dd/mm[/yyyy]
    const parts = String(date).split('/').map(s => parseInt(s, 10));
    const baseDay = parts[0] || today.getDate();
    const baseMonth = (parts[1] || (today.getMonth() + 1)) - 1; // 0-indexed
    const baseYear = parts[2] || today.getFullYear();
    return Array.from({ length: N }, (_, i) => {
      const dt = new Date(baseYear, baseMonth + i, 1);
      const last = new Date(baseYear, baseMonth + i + 1, 0).getDate();
      dt.setDate(Math.min(baseDay, last));
      const dStr = `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
      const mesStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
      return {
        d: dStr,
        mes: mesStr,
        desc: desc.trim(),
        cat,
        acct: acctId,
        val: signed,
        status: i === 0 && paid ? 'pago' : 'pendente',
        // Único caso "fixo" também marca recur, sem gerar mais transações
        ...((recur && (modo === 'unica' || modo === 'recur')) ? { recur: 'mensal' } : {}),
        ...(modo === 'parcela' ? { sub: `${i+1}/${N}`, grupo: groupId } : {}),
        ...(modo === 'recur' ? { sub: `${i+1}/${N}`, grupo: groupId } : {}),
      };
    });
  };

  const resetForm = () => {
    setKind('despesa');
    setPay('debito');
    setCat('mercado');
    setPaid(true);
    setRecur(false);
    setRecurMode('fixo');
    setParcelas(1);
    setDesc('');
    setVal('');
    setDate(todayStr);
    setToAcct('');
  };

  const handleSave = async (keepOpen = false) => {
    if (!canSave) return;
    if (kind === 'transferencia') {
      const p = String(date).split('/');
      const iso = (p[0] && p[1])
        ? `${p[2] || new Date().getFullYear()}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`
        : null;
      const ok = await transferFunds({ from: acct, to: toAcct, val: parseVal(val), date: iso, desc: desc.trim() });
      if (ok) {
        toast.success('Transferencia lancada');
        if (keepOpen) { resetForm(); } else { onClose?.(); }
      }
      return;
    }
    const txs = buildTxs();
    if (keepOpen) {
      if (txs.length === 1) await addTransaction(txs[0]);
      else await addTransactions(txs);
      toast.success('Transacao lancada');
      resetForm();
    } else {
      onSave?.(txs.length === 1 ? txs[0] : txs);
    }
  };

  return (
    <div className="fds-modal-backdrop" onClick={onClose}>
      <div className="fds-modal" onClick={(e) => e.stopPropagation()}>
        <header className="fds-modal-head">
          <div>
            <div className="fds-modal-eyebrow">Lançar</div>
            <h2 className="fds-modal-title">Nova transação</h2>
          </div>
          <button className="fds-icon-btn" onClick={onClose}><Icon.X size={16}/></button>
        </header>

        {/* Type segmented */}
        <div className="fds-seg fds-seg-3" data-accent={accentByKind}>
          {[
            ['despesa','Despesa', Icon.TrendDown],
            ['receita','Receita', Icon.TrendUp],
            ['transferencia','Transferência', Icon.Arrow],
          ].map(([k,l,Ic]) => (
            <button key={k} className={`${kind===k?'on':''}`} onClick={() => { setKind(k); if (k !== 'despesa') setPay('debito'); }}>
              <Ic size={14}/> {l}
            </button>
          ))}
        </div>

        <div className="fds-modal-body">
          <div className="fds-modal-row two">
            <label className="fds-field">
              <span>{kind === 'transferencia' ? 'Descrição (opcional)' : 'Descrição'}</span>
              <input className="fds-input" placeholder="ex: Mercado Atacadão"
                     value={desc} onChange={(e) => setDesc(e.target.value)}/>
            </label>
            <label className="fds-field">
              <span>Valor</span>
              <div className="fds-input-money">
                <span className="prefix">R$</span>
                <input className="fds-input" placeholder="0,00"
                       value={val} onChange={(e) => setVal(e.target.value)}
                       style={{ color: kind === 'despesa' ? 'var(--bad)' : kind === 'receita' ? 'var(--ok)' : 'var(--ink)' }}/>
              </div>
            </label>
          </div>

          <div className={`fds-modal-row${kind === 'transferencia' ? '' : ' two'}`}>
            <label className="fds-field">
              <span>Data</span>
              <div className="fds-input-icon">
                <Icon.Calendar size={14} style={{ opacity: 0.5 }}/>
                <input className="fds-input" value={date} onChange={(e) => setDate(e.target.value)}/>
              </div>
            </label>
            {kind !== 'transferencia' && (
            <label className="fds-field">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Categoria
                <button
                  type="button"
                  onClick={openCategoryModal}
                  style={{
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '0 10px',
                    minHeight: 44,
                    fontFamily: 'inherit',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <Icon.Plus size={12}/> Gerenciar
                </button>
              </span>
              <div className="fds-input-select">
                <CategoryAvatar cat={cat} size={20}/>
                <select className="fds-select" value={cat} onChange={(e) => setCat(e.target.value)}>
                  {kind === 'receita' ? (
                    <optgroup label="Receitas">
                      {Object.entries(categories).filter(([,c]) => c.group === 'receita').map(([k,c]) => (
                        <option key={k} value={k}>{c.emoji ? c.emoji + '  ' : ''}{c.label}</option>
                      ))}
                    </optgroup>
                  ) : (
                    <>
                      <optgroup label="Essencial">
                        {Object.entries(categories).filter(([,c]) => c.group === 'essencial').map(([k,c]) => (
                          <option key={k} value={k}>{c.emoji ? c.emoji + '  ' : ''}{c.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Estilo de vida">
                        {Object.entries(categories).filter(([,c]) => c.group === 'estilo').map(([k,c]) => (
                          <option key={k} value={k}>{c.emoji ? c.emoji + '  ' : ''}{c.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Dívidas & investimentos">
                        {Object.entries(categories).filter(([,c]) => c.group === 'divida').map(([k,c]) => (
                          <option key={k} value={k}>{c.emoji ? c.emoji + '  ' : ''}{c.label}</option>
                        ))}
                      </optgroup>
                    </>
                  )}
                </select>
                <Icon.Down size={13} style={{ opacity: 0.5 }}/>
              </div>
            </label>
            )}
          </div>

          {/* Transferência: contas de origem e destino */}
          {kind === 'transferencia' && (
            <>
              <label className="fds-field">
                <span>Conta de origem</span>
                <div className="fds-input-select">
                  <select className="fds-select" value={acct} onChange={(e) => setAcct(e.target.value)} style={{ minHeight: 44, touchAction: 'manipulation' }}>
                    <option value="">Selecione</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ·· {a.tag}</option>)}
                  </select>
                </div>
              </label>
              <label className="fds-field">
                <span>Conta de destino</span>
                <div className="fds-input-select">
                  <select className="fds-select" value={toAcct} onChange={(e) => setToAcct(e.target.value)} style={{ minHeight: 44, touchAction: 'manipulation' }}>
                    <option value="">Selecione</option>
                    {accounts.filter(a => a.id !== acct).map(a => <option key={a.id} value={a.id}>{a.name} ·· {a.tag}</option>)}
                  </select>
                </div>
              </label>
            </>
          )}

          {/* Pagamento segmented */}
          {kind === 'despesa' && (
          <div className="fds-field">
            <span>Forma de pagamento</span>
            <div className="fds-seg fds-seg-2">
              <button className={pay==='debito'?'on':''} onClick={() => setPay('debito')}>
                <Icon.Bank size={14}/> Débito
              </button>
              <button className={pay==='credito'?'on':''} onClick={() => setPay('credito')}>
                <Icon.Card size={14}/> Crédito
              </button>
            </div>
          </div>
          )}

          {kind !== 'transferencia' && (
          <div className="fds-modal-row two">
            <label className="fds-field">
              <span>{pay === 'debito' ? 'Conta' : 'Cartão'}</span>
              <div className="fds-input-select">
                {pay === 'debito' ? (
                  accounts.length === 0 ? (
                    <span style={{ color: 'var(--warn)', fontSize: 13, padding: '0 4px', minHeight: 44, display: 'flex', alignItems: 'center', touchAction: 'manipulation' }}>
                      Nenhuma conta cadastrada. Adicione uma conta primeiro.
                    </span>
                  ) : (
                    <>
                      <span className="fds-acct-mark-sm" style={{ background: accounts.find(a => a.id === acct)?.color }}/>
                      <select className="fds-select" value={acct} onChange={(e) => setAcct(e.target.value)}>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ·· {a.tag}</option>)}
                      </select>
                    </>
                  )
                ) : (
                  <>
                    <Icon.Card size={14}/>
                    <select className="fds-select" value={card} onChange={(e) => setCard(e.target.value)}>
                      {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </>
                )}
                <Icon.Down size={13} style={{ opacity: 0.5 }}/>
              </div>
            </label>
            <label className="fds-field">
              <span>Etiqueta</span>
              <div className="fds-input-icon">
                <Icon.Tag size={14} style={{ opacity: 0.5 }}/>
                <input className="fds-input" placeholder="Opcional"/>
              </div>
            </label>
          </div>
          )}

          {/* Parcelamento — apenas para despesa no crédito */}
          {canParcelar && (
            <div className="fds-field parc-field">
              <span>
                Parcelamento
                {parcelas > 1 && <span className="parc-active-tag">{parcelas}×</span>}
              </span>
              <div className="parc-row">
                <div className="parc-chips">
                  {[1,2,3,6,10,12,18,24].map(n => (
                    <button key={n} type="button"
                            className={`parc-chip${parcelas === n ? ' on' : ''}`}
                            onClick={() => setParcelas(n)}>
                      {n}<span className="parc-chip-x">x</span>
                    </button>
                  ))}
                  <div className="parc-stepper">
                    <button type="button" className="parc-step-btn"
                            onClick={() => setParcelas(p => Math.max(1, p - 1))}
                            disabled={parcelas <= 1}>−</button>
                    <span className="parc-step-val">{parcelas}</span>
                    <button type="button" className="parc-step-btn"
                            onClick={() => setParcelas(p => Math.min(48, p + 1))}
                            disabled={parcelas >= 48}>+</button>
                  </div>
                </div>
                {parcelas > 1 ? (
                  <div className="parc-preview">
                    <div className="parc-preview-amt">
                      <span className="parc-preview-n">{parcelas}×</span>
                      <strong>{fmtBRL(parseVal(val) / parcelas)}</strong>
                    </div>
                    <div className="parc-preview-meta">
                      Total {fmtBRL(parseVal(val))} · 1ª em {shortDate(date)} · última em {(() => {
                        const parts = String(date).split('/').map(s => parseInt(s, 10));
                        const last = new Date(parts[2] || today.getFullYear(), (parts[1] || 1) - 1 + (parcelas - 1), 1);
                        const lastDay = new Date(last.getFullYear(), last.getMonth() + 1, 0).getDate();
                        last.setDate(Math.min(parts[0] || 1, lastDay));
                        return `${String(last.getDate()).padStart(2,'0')}/${String(last.getMonth()+1).padStart(2,'0')}/${last.getFullYear()}`;
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="parc-preview parc-preview-empty">
                    <span>À vista · cobrado integral na fatura</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {kind !== 'transferencia' && (
          <div className="fds-toggles">
            <label className={`fds-toggle${isCard ? ' toggle-disabled' : ''}`}>
              <input type="checkbox" checked={paid} disabled={isCard} onChange={(e) => setPaid(e.target.checked)}/>
              <span className="fds-toggle-sw"/>
              <span>Marcar como pago</span>
            </label>
            {isCard && (
              <p className="tx-credit-notice">
                Compras no crédito são pagas ao quitar a fatura
              </p>
            )}
            <label className="fds-toggle">
              <input type="checkbox" checked={recur} onChange={(e) => setRecur(e.target.checked)}/>
              <span className="fds-toggle-sw"/>
              <span>Transação recorrente</span>
              {recur && (
                <span className="fds-mini-tag soft">
                  {pay === 'debito'
                    ? (recurMode === 'fixo' ? 'gasto fixo' : `${recurMode} meses`)
                    : 'mensal'}
                </span>
              )}
            </label>
          </div>
          )}

          {/* Sub-controle de recorrência — só quando ligada e em débito */}
          {kind !== 'transferencia' && recur && pay === 'debito' && (
            <div className="fds-field parc-field">
              <span>
                Duração da recorrência
                <span className="parc-active-tag" style={{ background: 'var(--accent-2)' }}>
                  {recurMode === 'fixo' ? '∞' : `${recurMode}m`}
                </span>
              </span>
              <div className="parc-row">
                <div className="parc-chips">
                  <button type="button"
                          className={`parc-chip${recurMode === 'fixo' ? ' on' : ''}`}
                          onClick={() => setRecurMode('fixo')}>
                    Fixo <span className="parc-chip-x">∞</span>
                  </button>
                  {[3, 6, 12, 24, 48].map(n => (
                    <button key={n} type="button"
                            className={`parc-chip${recurMode === n ? ' on' : ''}`}
                            onClick={() => setRecurMode(n)}>
                      {n}<span className="parc-chip-x">m</span>
                    </button>
                  ))}
                  {typeof recurMode === 'number' && (
                    <div className="parc-stepper">
                      <button type="button" className="parc-step-btn"
                              onClick={() => setRecurMode(p => Math.max(2, p - 1))}
                              disabled={recurMode <= 2}>−</button>
                      <span className="parc-step-val">{recurMode}</span>
                      <button type="button" className="parc-step-btn"
                              onClick={() => setRecurMode(p => Math.min(120, p + 1))}
                              disabled={recurMode >= 120}>+</button>
                    </div>
                  )}
                </div>
                <div className={`parc-preview${recurMode === 'fixo' ? ' parc-preview-empty' : ''}`}>
                  {recurMode === 'fixo' ? (
                    <span>Renova todo mês até você cancelar · 1 lançamento por mês</span>
                  ) : (
                    <>
                      <div className="parc-preview-amt">
                        <span className="parc-preview-n">{recurMode}×</span>
                        <strong>{fmtBRL(parseVal(val))}/mês</strong>
                      </div>
                      <div className="parc-preview-meta">
                        Total {fmtBRL(parseVal(val) * recurMode)} · {recurMode} lançamentos a partir de {shortDate(date)}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="fds-modal-preview">
            <div className="fds-preview-eyebrow">
              Preview
              {parcelas > 1 && <span className="fds-mini-tag soft" style={{ marginLeft: 8 }}>1/{parcelas}</span>}
            </div>
            <div className="fds-preview-row">
              <CategoryAvatar cat={cat} size={36}/>
              <div className="fds-recent-meta">
                <div className="fds-recent-desc">{desc || 'Sua transação aparecerá aqui'}</div>
                <div className="fds-recent-sub">
                  {shortDate(date)} <span className="fds-bullet">·</span> {categories[cat]?.label || cat}
                  {parcelas > 1 && <span className="fds-mini-tag soft">{parcelas}× parcelada</span>}
                  {!paid && <span className="fds-mini-tag warn">pendente</span>}
                </div>
              </div>
              <div className={`fds-recent-amt ${kind==='receita'?'pos':kind==='despesa'?'neg':''}`}>
                {kind === 'receita' ? '+' : kind === 'despesa' ? '−' : ''}R$&nbsp;{parcelas > 1 && parseVal(val) > 0
                  ? (parseVal(val) / parcelas).toLocaleString('pt-BR',{minimumFractionDigits:2})
                  : (val || '0,00')}
              </div>
            </div>
          </div>
        </div>

        <footer className="fds-modal-foot">
          <button className="fds-btn-ghost" onClick={onClose}>Cancelar</button>
          <div className="fds-modal-foot-actions">
            <button className="fds-btn-secondary" onClick={() => handleSave(true)} disabled={!canSave}>Salvar e novo</button>
            <button className="fds-btn-primary" onClick={() => handleSave(false)} disabled={!canSave}>
              <Icon.Check size={14}/> Lançar transação
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

Object.assign(window, { Transacoes, EditTxModal, NovaTransacaoModal });
