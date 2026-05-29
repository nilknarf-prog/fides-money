// fides-transacoes.jsx — Transações list + filters + Nova Transação modal

function Transacoes({ variant, onAdd }) {
  const { monthTransactions, transactions, categories, selectedMonth, setSelectedMonth, monthLabel, addTransaction, updateTransaction, deleteTransaction, accounts } = useFides();
  const [selectedMonthChip, setSelectedMonthChip] = React.useState(null);
  const [filter, setFilter] = React.useState('todas');
  const [catFilter, setCatFilter] = React.useState(null);    // category key or null
  const [catDropdownOpen, setCatDropdownOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState(new Set());
  const [hoverRow, setHoverRow] = React.useState(null);
  const [visibleCount, setVisibleCount] = React.useState(20);
  const [rowMenu, setRowMenu] = React.useState(null);         // index of open row menu
  const [rowCatPicker, setRowCatPicker] = React.useState(null); // tx _id being re-categorised
  const [bulkCatPicker, setBulkCatPicker] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [editingTx, setEditingTx] = React.useState(null);
  const [acctFilter, setAcctFilter] = React.useState(null);
  const [acctDropdownOpen, setAcctDropdownOpen] = React.useState(false);
  const [recurFilter, setRecurFilter] = React.useState(null);
  const [recurDropdownOpen, setRecurDropdownOpen] = React.useState(false);

  // Refs para fechar apenas o dropdown cujo toque foi fora
  const catDdRef   = React.useRef(null);
  const acctDdRef  = React.useRef(null);
  const recurDdRef = React.useRef(null);

  const lbl = monthLabel(selectedMonth);

  // Fecha dropdown somente se o toque/click foi FORA dele
  React.useEffect(() => {
    // iOS: e.target pode ser <path> interno de SVG — usar closest() para subir ao elemento com ref
    const inside = (ref, t) =>
      ref.current && (ref.current.contains(t) ||
        (t.closest && ref.current.contains(t.closest('button,[data-dd]') || t)));

    const handler = (e) => {
      const t = e.target;
      setRowMenu(null);
      if (catDdRef.current     && !inside(catDdRef,     t)) setCatDropdownOpen(false);
      if (acctDdRef.current    && !inside(acctDdRef,    t)) setAcctDropdownOpen(false);
      if (recurDdRef.current   && !inside(recurDdRef,   t)) setRecurDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const currentMonthIdx = parseInt(selectedMonth.split('-')[1], 10) - 1;

  // Mostra as do mês corrente (a chip de mês na barra é redundante mas mantida visualmente)
  const baseList = monthTransactions;

  const filtered = baseList.filter(t => {
    if (filter === 'receitas' && t.val < 0) return false;
    if (filter === 'despesas' && t.val > 0) return false;
    if (filter === 'pendentes' && t.status !== 'pendente') return false;
    if (catFilter  && t.cat  !== catFilter)  return false;
    if (acctFilter && t.acct !== acctFilter) return false;
    if (recurFilter && t.recur !== recurFilter) return false;
    if (search && !t.desc.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visible.length < filtered.length && visibleCount < 100;

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
          if (blocks.length === 0) { alert('Nenhuma transação encontrada no arquivo OFX.'); return; }
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
              acct: ACCOUNTS[0]?.id,
              d: `${dd}/${mm}`,
              status: 'pendente', recur: null,
              mes: `${yyyy}-${mm}`,
            });
            imported++;
          });
          alert(`${imported} transação(ões) importada(s)${errors > 0 ? `, ${errors} bloco(s) ignorado(s)` : ''}.`);
        } else {
          const lines = text.split(/\r?\n/).filter(Boolean);
          if (lines.length < 2) { alert('CSV vazio ou sem dados.'); return; }
          const sep = lines[0].includes(';') ? ';' : ',';
          let imported = 0, errors = 0;
          lines.slice(1).forEach(line => {
            const cols = line.split(sep).map(c => c.replace(/^"|"$/g, '').trim());
            const [d, desc, cat, acctName, valStr, status, recur] = cols;
            if (!desc || !valStr) { errors++; return; }
            const valRaw = parseFloat(valStr.replace(',', '.'));
            if (isNaN(valRaw)) { errors++; return; }
            const acctObj = ACCOUNTS.find(a => a.name.toLowerCase() === (acctName || '').toLowerCase());
            const catKey  = Object.entries(categories).find(
              ([, v]) => v.label.toLowerCase() === (cat || '').toLowerCase()
            )?.[0] || 'outros';
            addTransaction({
              desc, val: valRaw, cat: catKey,
              acct: acctObj?.id || ACCOUNTS[0]?.id,
              d: d || new Date().toLocaleDateString('pt-BR'),
              status: status === 'pago' ? 'pago' : 'pendente',
              recur: recur || null, mes: selectedMonth,
            });
            imported++;
          });
          alert(`${imported} transação(ões) importada(s)${errors > 0 ? `, ${errors} linha(s) ignorada(s)` : ''}.`);
        }
      };
      reader.readAsText(file, 'UTF-8');
    };
    input.click();
  }, [categories, addTransaction, selectedMonth]);

  const tot = {
    receitas: baseList.filter(t => t.val > 0).reduce((s,t) => s + t.val, 0),
    despesas: -baseList.filter(t => t.val < 0 && t.status === 'pago').reduce((s,t) => s + t.val, 0),
    pendentes: -baseList.filter(t => t.val < 0 && t.status === 'pendente').reduce((s,t) => s + t.val, 0),
  };
  const saldo = tot.receitas - tot.despesas;

  const toggleSel = (i) => {
    const s = new Set(selected);
    s.has(i) ? s.delete(i) : s.add(i);
    setSelected(s);
  };

  // ── Bulk action helpers ───────────────────────────────────────
  const selTxs = () => [...selected].map(i => filtered[i]).filter(Boolean);

  const bulkMarkPaid = () => {
    selTxs().forEach(t => updateTransaction(t._id, { status: 'pago' }));
    setSelected(new Set());
    setConfirmDelete(false);
  };
  const bulkDelete = () => {
    selTxs().forEach(t => deleteTransaction(t._id));
    setSelected(new Set());
    setConfirmDelete(false);
  };
  const bulkCategorize = (catKey) => {
    selTxs().forEach(t => updateTransaction(t._id, { cat: catKey }));
    setSelected(new Set());
    setBulkCatPicker(false);
  };

  // Unique categories present in the current month list (for the dropdown)
  const catsInList = [...new Set(baseList.map(t => t.cat))].sort((a, b) => {
    const la = categories[a]?.label || a;
    const lb = categories[b]?.label || b;
    return la.localeCompare(lb, 'pt-BR');
  });

  return (
    <div className="fds-page" data-od-id="transacoes">
      {/* KPI Strip */}
      <section className="fds-tx-kpis" data-od-id="tx-kpis">
        <TxKpi label="Saldo do mês"    value={saldo}        accent="var(--ink)"  variant={variant}/>
        <TxKpi label="Receitas"        value={tot.receitas} accent="var(--ok)"   delta={+8.2} variant={variant} spark={[6,8,7,9,10,11,12]}/>
        <TxKpi label="Despesas pagas"  value={-tot.despesas} accent="var(--bad)" delta={-6.3} variant={variant} spark={[10,9,11,8,9,7,6]}/>
        <TxKpi label="Pendentes"       value={-tot.pendentes} accent="var(--warn)" kind="pending" pendingCount={transactions.filter(t=>t.status==='pendente').length} variant={variant}/>
      </section>

      {/* Filter Bar */}
      <section className="fds-card fds-tx-filters" data-od-id="tx-filtros">
        <div className="fds-tx-filter-row">
          <div className="fds-tx-year">
            <span>{selectedMonth.split('-')[0]}</span>
            <Icon.Down size={13}/>
          </div>
          <div className="fds-tx-months">
            {months.map((m, i) => (
              <button key={m} className={`fds-month${i === currentMonthIdx ? ' on' : ''}`}
                      onClick={() => {
                        const yr = selectedMonth.split('-')[0];
                        setSelectedMonth(`${yr}-${String(i + 1).padStart(2,'0')}`);
                      }}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="fds-tx-filter-row">
          <div className="fds-tx-chips">
            {[
              ['todas','Todas',baseList.length],
              ['receitas','Receitas',baseList.filter(t=>t.val>0).length],
              ['despesas','Despesas',baseList.filter(t=>t.val<0).length],
              ['pendentes','Pendentes',baseList.filter(t=>t.status==='pendente').length],
            ].map(([k,l,c]) => (
              <button key={k} className={`fds-chip${filter === k ? ' on' : ''}`} onClick={() => setFilter(k)}>
                {l} <span className="fds-chip-count">{c}</span>
              </button>
            ))}
            <span className="fds-chip-sep"/>
            <div ref={catDdRef} style={{ position: 'relative', display: 'inline-flex' }}>
              <button className={`fds-chip${catFilter ? ' on' : ''}`}
                      onClick={(e) => { e.stopPropagation(); setCatDropdownOpen(v => !v); }}>
                <Icon.Filter size={13}/>
                {catFilter ? (categories[catFilter]?.label || catFilter) : 'Categoria'}
                {catFilter && (
                  <span style={{ marginLeft: 4, opacity: 0.7, lineHeight: 1 }}
                        onClick={(e) => { e.stopPropagation(); setCatFilter(null); setCatDropdownOpen(false); }}>
                    ×
                  </span>
                )}
              </button>
              {catDropdownOpen && (
                <div className="fds-cat-picker-dd"
                     onClick={(e) => e.stopPropagation()}
                     onTouchStart={(e) => e.stopPropagation()}>
                  <div className="fds-cat-picker-head">Filtrar por categoria</div>
                  <button className={`fds-cat-picker-item${!catFilter ? ' on' : ''}`}
                          onClick={() => { setCatFilter(null); setCatDropdownOpen(false); }}
                          onTouchEnd={(e) => { e.preventDefault(); e.currentTarget.click(); }}>
                    <span style={{ width: 18, height: 18, display: 'inline-block' }}/>
                    <span>Todas as categorias</span>
                    <span className="fds-chip-count">{baseList.length}</span>
                  </button>
                  {catsInList.map(k => {
                    const c = categories[k] || { label: k, tint: '#888' };
                    const cnt = baseList.filter(t => t.cat === k).length;
                    return (
                      <button key={k} className={`fds-cat-picker-item${catFilter === k ? ' on' : ''}`}
                              onClick={() => { setCatFilter(k); setCatDropdownOpen(false); }}
                              onTouchEnd={(e) => { e.preventDefault(); e.currentTarget.click(); }}>
                        <CategoryAvatar cat={k} size={18}/>
                        <span>{c.label}</span>
                        <span className="fds-chip-count">{cnt}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {/* ── Filtro de Conta ── */}
            <div ref={acctDdRef} style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                className={`fds-chip${acctFilter ? ' on' : ''}`}
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                onClick={(e) => { e.stopPropagation(); setAcctDropdownOpen(v => !v); setRecurDropdownOpen(false); }}>
                <Icon.Wallet size={13}/>
                {acctFilter
                  ? (accounts.find(a => a.id === acctFilter)?.name || acctFilter)
                  : 'Conta'}
                {acctFilter && (
                  <span
                    style={{ marginLeft: 4, opacity: 0.7, lineHeight: 1 }}
                    onClick={(e) => { e.stopPropagation(); setAcctFilter(null); setAcctDropdownOpen(false); }}>
                    ×
                  </span>
                )}
              </button>
              {acctDropdownOpen && (
                <div className="fds-cat-picker-dd"
                     onClick={(e) => e.stopPropagation()}
                     onTouchStart={(e) => e.stopPropagation()}>
                  <div className="fds-cat-picker-head">Filtrar por conta</div>
                  <button
                    className={`fds-cat-picker-item${!acctFilter ? ' on' : ''}`}
                    style={{ minHeight: 44, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                    onClick={() => { setAcctFilter(null); setAcctDropdownOpen(false); }}
                    onTouchEnd={(e) => { e.preventDefault(); e.currentTarget.click(); }}>
                    <span style={{ width: 18, height: 18, display: 'inline-block' }}/>
                    <span>Todas as contas</span>
                    <span className="fds-chip-count">{baseList.length}</span>
                  </button>
                  {accounts.map(a => {
                    const cnt = baseList.filter(t => t.acct === a.id).length;
                    if (cnt === 0) return null;
                    return (
                      <button
                        key={a.id}
                        className={`fds-cat-picker-item${acctFilter === a.id ? ' on' : ''}`}
                        style={{ minHeight: 44, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                        onClick={() => { setAcctFilter(a.id); setAcctDropdownOpen(false); }}
                        onTouchEnd={(e) => { e.preventDefault(); e.currentTarget.click(); }}>
                        <span style={{
                          width: 14, height: 14, borderRadius: '50%',
                          background: a.color, display: 'inline-block', flexShrink: 0
                        }}/>
                        <span>{a.name}</span>
                        <span className="fds-chip-count">{cnt}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Filtro de Recorrência ── */}
            <div ref={recurDdRef} style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                className={`fds-chip${recurFilter ? ' on' : ''}`}
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                onClick={(e) => { e.stopPropagation(); setRecurDropdownOpen(v => !v); setAcctDropdownOpen(false); }}>
                <Icon.Tag size={13}/>
                {recurFilter || 'Recorrência'}
                {recurFilter && (
                  <span
                    style={{ marginLeft: 4, opacity: 0.7, lineHeight: 1 }}
                    onClick={(e) => { e.stopPropagation(); setRecurFilter(null); setRecurDropdownOpen(false); }}>
                    ×
                  </span>
                )}
              </button>
              {recurDropdownOpen && (
                <div className="fds-cat-picker-dd"
                     onClick={(e) => e.stopPropagation()}
                     onTouchStart={(e) => e.stopPropagation()}>
                  <div className="fds-cat-picker-head">Filtrar por recorrência</div>
                  <button
                    className={`fds-cat-picker-item${!recurFilter ? ' on' : ''}`}
                    style={{ minHeight: 44, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                    onClick={() => { setRecurFilter(null); setRecurDropdownOpen(false); }}
                    onTouchEnd={(e) => { e.preventDefault(); e.currentTarget.click(); }}>
                    <span style={{ width: 18, height: 18, display: 'inline-block' }}/>
                    <span>Todas</span>
                    <span className="fds-chip-count">{baseList.length}</span>
                  </button>
                  {['mensal','semanal','anual','quinzenal'].map(r => {
                    const cnt = baseList.filter(t => t.recur === r).length;
                    if (cnt === 0) return null;
                    return (
                      <button
                        key={r}
                        className={`fds-cat-picker-item${recurFilter === r ? ' on' : ''}`}
                        style={{ minHeight: 44, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                        onClick={() => { setRecurFilter(r); setRecurDropdownOpen(false); }}
                        onTouchEnd={(e) => { e.preventDefault(); e.currentTarget.click(); }}>
                        <Icon.Refresh size={14}/>
                        <span style={{ textTransform: 'capitalize' }}>{r}</span>
                        <span className="fds-chip-count">{cnt}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="fds-tx-search" style={{ order: 2 }}>
            <Icon.Search size={14} style={{ opacity: 0.5 }}/>
            <input placeholder="Buscar descrição, valor, categoria…"
                   value={search} onChange={(e) => setSearch(e.target.value)}/>
            {search && <button onClick={() => setSearch('')}><Icon.X size={13}/></button>}
          </div>

          {/* ── Importar / Exportar ── */}
          <div style={{
            display: 'flex', gap: 8,
            width: '100%',
            order: 3,
            borderTop: '1px solid var(--border)',
            paddingTop: 10, marginTop: 2
          }}>
            <button
              onPointerUp={() => handleImport('csv')}
              style={{
                flex: 1,
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                minHeight: 44,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                cursor: 'pointer',
                color: 'var(--ink-2)',
                fontSize: 13, fontFamily: 'inherit', fontWeight: 500
              }}>
              <Icon.Import size={15}/> Importar
            </button>
            <button
              onPointerUp={() => handleExport('csv')}
              style={{
                flex: 1,
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                minHeight: 44,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                cursor: 'pointer',
                color: 'var(--ink-2)',
                fontSize: 13, fontFamily: 'inherit', fontWeight: 500
              }}>
              <Icon.Export size={15}/> Exportar
            </button>
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="fds-card fds-tx-table-card" data-od-id="tx-tabela">
        <div className="fds-tx-table-head">
          <div className="fds-tx-bulk">
            <input type="checkbox" className="fds-cbx"
                   checked={selected.size === filtered.length && filtered.length > 0}
                   onChange={() => {
                     if (selected.size === filtered.length) setSelected(new Set());
                     else setSelected(new Set(filtered.map((_,i) => i)));
                   }}/>
            {selected.size > 0 ? (
              <span className="fds-tx-bulk-info" style={{ position: 'relative' }}>
                {selected.size} selecionada{selected.size>1?'s':''}
                {selected.size === 1 && (
                  <button className="fds-tx-bulk-act" onClick={() => {
                    const idx = [...selected][0];
                    const tx = filtered[idx];
                    if (tx) setEditingTx({ ...tx });
                  }}>✏️ Editar</button>
                )}
                <button className="fds-tx-bulk-act" onClick={bulkMarkPaid}>Marcar pago</button>
                <button className="fds-tx-bulk-act" onClick={(e) => { e.stopPropagation(); setBulkCatPicker(v => !v); setConfirmDelete(false); }}>
                  Categorizar
                </button>
                {bulkCatPicker && (
                  <div className="fds-cat-picker-dd" onClick={(e) => e.stopPropagation()}>
                    <div className="fds-cat-picker-head">Selecionar categoria</div>
                    {catsInList.map(k => {
                      const c = categories[k] || { label: k, tint: '#888' };
                      return (
                        <button key={k} className="fds-cat-picker-item" onClick={() => bulkCategorize(k)}>
                          <CategoryAvatar cat={k} size={18}/>
                          <span>{c.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {!confirmDelete ? (
                  <button className="fds-tx-bulk-act danger" onClick={() => { setConfirmDelete(true); setBulkCatPicker(false); }}>Excluir</button>
                ) : (
                  <>
                    <span style={{ color: 'var(--bad)', fontSize: 12 }}>Excluir {selected.size}?</span>
                    <button className="fds-tx-bulk-act danger" onClick={bulkDelete}>Confirmar</button>
                    <button className="fds-tx-bulk-act" onClick={() => setConfirmDelete(false)}>Cancelar</button>
                  </>
                )}
              </span>
            ) : (
              <span className="fds-tx-count">
                <span className="fds-strong">{filtered.length}</span> de {baseList.length} em {lbl.long}
              </span>
            )}
          </div>
          <div className="fds-tx-sum">
            Saldo: <span className="fds-strong" style={{ color: saldo >= 0 ? 'var(--ok)' : 'var(--bad)' }}>{fmtBRL(saldo)}</span>
          </div>
        </div>
        <table className="fds-tx-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}></th>
              <th style={{ width: 110 }}>Data</th>
              <th>Descrição</th>
              <th style={{ width: 160 }}>Categoria</th>
              <th style={{ width: 130 }}>Conta</th>
              <th style={{ width: 130 }}>Status</th>
              <th style={{ width: 140, textAlign: 'right' }}>Valor</th>
              <th style={{ width: 30 }}></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t, i) => {
              const c = categories[t.cat] || { label: t.cat, tint: '#888', emoji: '🏷️' };
              const a = accounts.find(x => x.id === t.acct);
              const neg = t.val < 0;
              const isSel = selected.has(i);
              return (
                <tr key={t._id || i} className={`${isSel ? 'sel' : ''} ${hoverRow === i ? 'hov' : ''} ${t._new ? 'fds-tx-new' : ''}`}
                    onMouseEnter={() => setHoverRow(i)} onMouseLeave={() => setHoverRow(null)}>
                  <td><input type="checkbox" className="fds-cbx" checked={isSel} onChange={() => toggleSel(i)}/></td>
                  <td className="fds-tx-date">
                    <div>{t.d}</div>
                    <div className="fds-muted fds-tx-year-small">2026</div>
                  </td>
                  <td>
                    <div className="fds-tx-desc">
                      <CategoryAvatar cat={t.cat} size={26}/>
                      <span className="fds-tx-desc-main">{t.desc}</span>
                      {t.recur && <span className="fds-mini-tag soft"><Icon.Refresh size={10}/> {t.recur}</span>}
                      {t.sub && <span className="fds-mini-tag soft">{t.sub}</span>}
                    </div>
                  </td>
                  <td>
                    <span className="fds-cat-pill">
                      <span className="fds-cat-dot" style={{ background: c.tint }}/>
                      {c.label}
                    </span>
                  </td>
                  <td>
                    <span className="fds-acct-pill">
                      <span className="fds-acct-mark-sm" style={{ background: a?.color }}/>
                      {a?.name || '—'}
                    </span>
                  </td>
                  <td>
                    {t.status === 'pago' ? (
                      <span className="fds-status pago"><Icon.Check size={11}/>Pago</span>
                    ) : (
                      <span className="fds-status pendente"><Icon.Clock size={11}/>Pendente</span>
                    )}
                  </td>
                  <td className={`fds-tx-amt ${neg ? 'neg' : 'pos'}`}>
                    {neg ? '−' : '+'}R$&nbsp;{Math.abs(t.val).toLocaleString('pt-BR', {minimumFractionDigits:2})}
                  </td>
                  <td style={{ position: 'relative' }}>
                    <button className="fds-tx-row-act"
                            onClick={(e) => { e.stopPropagation(); setEditingTx({...t}); }}>
                      <Icon.Dots size={15}/>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="fds-tx-foot">
          <div className="fds-muted">
            Mostrando <span className="fds-strong">{visible.length}</span> de {filtered.length}
            {filtered.length !== baseList.length && <> · {baseList.length} total em {lbl.long}</>}
            {(acctFilter || recurFilter || catFilter || filter !== 'todas' || search) && (
              <button
                onClick={() => {
                  setFilter('todas');
                  setCatFilter(null);
                  setAcctFilter(null);
                  setRecurFilter(null);
                  setSearch('');
                }}
                style={{
                  marginLeft: 8, fontSize: 11, color: 'var(--muted)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  textDecoration: 'underline', touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent', padding: '2px 4px',
                }}>
                Limpar filtros
              </button>
            )}
          </div>
          <div className="fds-tx-pager">
            {hasMore ? (
              <button className="fds-btn-ghost fds-tx-more"
                      onClick={() => setVisibleCount(c => Math.min(100, c + 20))}>
                <Icon.Down size={13}/> Ver mais
                <span className="fds-muted" style={{ marginLeft: 6, fontWeight: 500 }}>
                  +{Math.min(20, Math.min(100, filtered.length) - visible.length)}
                </span>
              </button>
            ) : visibleCount > 20 ? (
              <button className="fds-btn-ghost" onClick={() => setVisibleCount(20)}>
                <Icon.Up size={13}/> Recolher
              </button>
            ) : null}
            {visibleCount < filtered.length && filtered.length > 100 && (
              <span className="fds-muted" style={{ fontSize: 11 }}>
                limite de 100 por página
              </span>
            )}
          </div>
        </div>
      </section>

      {editingTx && <EditTxModal tx={editingTx} onClose={() => setEditingTx(null)}/>}
    </div>
  );
}

// ─── TX KPI tile (compact) ────────────────────────────────────
function TxKpi({ label, value, accent, delta, spark, kind, variant, pendingCount }) {
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
          <span className="fds-link-sm">Ver →</span>
        </div>
      )}
    </div>
  );
}

// ─── Modal: Editar Transação ──────────────────────────────────
function EditTxModal({ tx, onClose }) {
  const { categories, updateTransaction, deleteTransaction, accounts } = useFides();

  const parseVal = (s) => {
    const clean = String(s).replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  };

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

  const handleDelete = () => {
    if (window.confirm(`Excluir "${tx.desc}"?`)) {
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

          {/* Conta */}
          <div className="fds-field">
            <label className="fds-label">Conta</label>
            <select className="fds-select" value={acct} onChange={(e) => setAcct(e.target.value)}>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} ·· {a.tag}</option>
              ))}
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
    </div>
  );
}

// ─── Modal: Nova Transação ────────────────────────────────────
function NovaTransacaoModal({ open, onClose, onSave, variant }) {
  const { categories, openCategoryModal, accounts, cards } = useFides();
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;

  const [kind, setKind] = React.useState('despesa');
  const [pay, setPay] = React.useState('debito');
  const [acct, setAcct] = React.useState('');
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

  const canSave = desc.trim() && parseVal(val) > 0 && (pay !== 'debito' || accounts.length > 0);

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

  const handleSave = (keepOpen = false) => {
    if (!canSave) return;
    const txs = buildTxs();
    onSave?.(txs.length === 1 ? txs[0] : txs);
    if (keepOpen) {
      setDesc(''); setVal('');
    } else {
      setDesc(''); setVal('');
      onClose?.();
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
            <button key={k} className={`${kind===k?'on':''}`} onClick={() => setKind(k)}>
              <Ic size={14}/> {l}
            </button>
          ))}
        </div>

        <div className="fds-modal-body">
          <div className="fds-modal-row two">
            <label className="fds-field">
              <span>Descrição</span>
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

          <div className="fds-modal-row two">
            <label className="fds-field">
              <span>Data</span>
              <div className="fds-input-icon">
                <Icon.Calendar size={14} style={{ opacity: 0.5 }}/>
                <input className="fds-input" value={date} onChange={(e) => setDate(e.target.value)}/>
              </div>
            </label>
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
          </div>

          {/* Pagamento segmented */}
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

          <div className="fds-toggles">
            <label className="fds-toggle">
              <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)}/>
              <span className="fds-toggle-sw"/>
              <span>Marcar como pago</span>
            </label>
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

          {/* Sub-controle de recorrência — só quando ligada e em débito */}
          {recur && pay === 'debito' && (
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
