// fides-transacoes.jsx — Transações list + filters + Nova Transação modal

function Transacoes({ variant, onAdd }) {
  const { monthTransactions, transactions, categories, selectedMonth, setSelectedMonth, monthLabel } = useFides();
  const [selectedMonthChip, setSelectedMonthChip] = React.useState(null); // local filter (sobrepõe global se setado)
  const [filter, setFilter] = React.useState('todas');
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState(new Set());
  const [hoverRow, setHoverRow] = React.useState(null);
  const [visibleCount, setVisibleCount] = React.useState(20);
  const lbl = monthLabel(selectedMonth);

  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const currentMonthIdx = parseInt(selectedMonth.split('-')[1], 10) - 1;

  // Mostra as do mês corrente (a chip de mês na barra é redundante mas mantida visualmente)
  const baseList = monthTransactions;

  const filtered = baseList.filter(t => {
    if (filter === 'receitas' && t.val < 0) return false;
    if (filter === 'despesas' && t.val > 0) return false;
    if (filter === 'pendentes' && t.status !== 'pendente') return false;
    if (search && !t.desc.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visible.length < filtered.length && visibleCount < 100;

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

  return (
    <div className="fds-page">
      {/* KPI Strip */}
      <section className="fds-tx-kpis">
        <TxKpi label="Saldo do mês"    value={saldo}        accent="var(--ink)"  variant={variant}/>
        <TxKpi label="Receitas"        value={tot.receitas} accent="var(--ok)"   delta={+8.2} variant={variant} spark={[6,8,7,9,10,11,12]}/>
        <TxKpi label="Despesas pagas"  value={-tot.despesas} accent="var(--bad)" delta={-6.3} variant={variant} spark={[10,9,11,8,9,7,6]}/>
        <TxKpi label="Pendentes"       value={-tot.pendentes} accent="var(--warn)" kind="pending" pendingCount={transactions.filter(t=>t.status==='pendente').length} variant={variant}/>
      </section>

      {/* Filter Bar */}
      <section className="fds-card fds-tx-filters">
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
          <div className="fds-tx-actions">
            <button className="fds-btn-ghost"><Icon.Import size={14}/> Importar</button>
            <button className="fds-btn-ghost"><Icon.Export size={14}/> Exportar</button>
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
            <button className="fds-chip"><Icon.Filter size={13}/> Categoria</button>
            <button className="fds-chip"><Icon.Wallet size={13}/> Conta</button>
            <button className="fds-chip"><Icon.Tag size={13}/> Etiquetas</button>
          </div>
          <div className="fds-tx-search">
            <Icon.Search size={14} style={{ opacity: 0.5 }}/>
            <input placeholder="Buscar descrição, valor, categoria…"
                   value={search} onChange={(e) => setSearch(e.target.value)}/>
            {search && <button onClick={() => setSearch('')}><Icon.X size={13}/></button>}
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="fds-card fds-tx-table-card">
        <div className="fds-tx-table-head">
          <div className="fds-tx-bulk">
            <input type="checkbox" className="fds-cbx"
                   checked={selected.size === filtered.length && filtered.length > 0}
                   onChange={() => {
                     if (selected.size === filtered.length) setSelected(new Set());
                     else setSelected(new Set(filtered.map((_,i) => i)));
                   }}/>
            {selected.size > 0 ? (
              <span className="fds-tx-bulk-info">
                {selected.size} selecionada{selected.size>1?'s':''}
                <button className="fds-tx-bulk-act">Marcar pago</button>
                <button className="fds-tx-bulk-act">Categorizar</button>
                <button className="fds-tx-bulk-act danger">Excluir</button>
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
              const a = ACCOUNTS.find(x => x.id === t.acct);
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
                  <td>
                    <button className="fds-tx-row-act"><Icon.Dots size={15}/></button>
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

// ─── Modal: Nova Transação ────────────────────────────────────
function NovaTransacaoModal({ open, onClose, onSave, variant }) {
  const { categories, openCategoryModal } = useFides();
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;

  const [kind, setKind] = React.useState('despesa');
  const [pay, setPay] = React.useState('debito');
  const [acct, setAcct] = React.useState('bradesco');
  const [card, setCard] = React.useState(CARDS[0]?.id || '');
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

  const canSave = desc.trim() && parseVal(val) > 0;

  // Build a list of transactions — one per parcela (crédito) ou por mês de recorrência (débito), ou apenas 1
  const buildTxs = () => {
    const numeric = parseVal(val);
    let N = 1;
    let modo = 'unica';
    if (canParcelar && parcelas > 1) {
      N = parcelas; modo = 'parcela';
    } else if (recur && pay === 'debito') {
      if (recurMode === 'fixo') {
        N = 120; modo = 'fixo'; // teto de 120 meses para não explodir o array
      } else if (typeof recurMode === 'number' && recurMode >= 1) {
        N = recurMode; modo = 'recur';
      }
    }

    // Para parcelamento: divide o valor pelas parcelas; para recorrência débito: cada mês mantém o valor completo
    const each = modo === 'parcela' ? numeric / N : numeric;
    const signed = kind === 'receita' ? Math.abs(each)
                  : kind === 'despesa' ? -Math.abs(each)
                  : 0;
    const acctId = pay === 'debito' ? acct : (CARDS.find(c => c.id === card)?.id || acct);
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
        // fixo e recur: marca recur: 'mensal' em cada transação
        ...((modo === 'fixo' || modo === 'recur') ? { recur: 'mensal' } : {}),
        // unica com toggle recur ligado: marca sem gerar múltiplas
        ...(modo === 'unica' && recur ? { recur: 'mensal' } : {}),
        ...(modo === 'parcela' ? { sub: `${i+1}/${N}`, grupo: groupId } : {}),
        ...(modo === 'recur'   ? { sub: `${i+1}/${N}`, grupo: groupId } : {}),
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
              <span>Categoria
                <button type="button" className="fds-field-link" onClick={openCategoryModal}>
                  <Icon.Plus size={11}/> Gerenciar
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
                  <>
                    <span className="fds-acct-mark-sm" style={{ background: ACCOUNTS.find(a => a.id === acct)?.color }}/>
                    <select className="fds-select" value={acct} onChange={(e) => setAcct(e.target.value)}>
                      {ACCOUNTS.map(a => <option key={a.id} value={a.id}>{a.name} ·· {a.tag}</option>)}
                    </select>
                  </>
                ) : (
                  <>
                    <Icon.Card size={14}/>
                    <select className="fds-select" value={card} onChange={(e) => setCard(e.target.value)}>
                      {CARDS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                  {[3, 6, 12, 24].map(n => (
                    <button key={n} type="button"
                            className={`parc-chip${recurMode === n ? ' on' : ''}`}
                            onClick={() => setRecurMode(n)}>
                      {n}<span className="parc-chip-x">m</span>
                    </button>
                  ))}
                  <div className="parc-stepper">
                    <button type="button" className="parc-step-btn"
                            onClick={() => setRecurMode(p => typeof p === 'number' ? Math.max(1, p - 1) : 12)}
                            disabled={typeof recurMode === 'number' && recurMode <= 1}>−</button>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      className="parc-step-val"
                      style={{ width: 42, textAlign: 'center', border: 'none', background: 'transparent', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}
                      value={typeof recurMode === 'number' ? recurMode : ''}
                      placeholder="—"
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v >= 1) setRecurMode(Math.min(120, v));
                        else if (e.target.value === '') setRecurMode('fixo');
                      }}
                      onClick={(e) => { if (recurMode === 'fixo') { setRecurMode(12); e.target.select(); } }}
                    />
                    <button type="button" className="parc-step-btn"
                            onClick={() => setRecurMode(p => typeof p === 'number' ? Math.min(120, p + 1) : 12)}
                            disabled={typeof recurMode === 'number' && recurMode >= 120}>+</button>
                  </div>
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

Object.assign(window, { Transacoes, NovaTransacaoModal });
