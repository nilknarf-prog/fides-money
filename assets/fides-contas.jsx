// fides-contas.jsx — Studio "Contas & cartões" page

// ─── Modal: Nova Conta ────────────────────────────────────────
function NovaContaModal({ open, onClose }) {
  const { addAccount } = useFides();
  const [nome, setNome]     = React.useState('');
  const [tipo, setTipo]     = React.useState('corrente');
  const [banco, setBanco]   = React.useState('');
  const [saldo, setSaldo]   = React.useState('');

  if (!open) return null;

  const parseVal = (s) => {
    if (!s) return 0;
    return parseFloat(String(s).replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.')) || 0;
  };

  const canSave = nome.trim() && banco.trim();

  const handleSave = () => {
    if (!canSave) return;
    const colors = ['#10B981','#0EA5E9','#8B5CF6','#F59E0B','#EF4444','#3B82F6'];
    addAccount({
      name: nome.trim(),
      type: tipo,
      bank: banco.trim(),
      balance: parseVal(saldo),
      color: colors[Math.floor(Math.random() * colors.length)],
      tag: '••••',
    });
    setNome(''); setTipo('corrente'); setBanco(''); setSaldo('');
    onClose?.();
  };

  return (
    <div className="fds-modal-backdrop" onClick={onClose}>
      <div className="fds-modal" onClick={(e) => e.stopPropagation()}>
        <header className="fds-modal-head">
          <div>
            <div className="fds-modal-eyebrow">Nova</div>
            <h2 className="fds-modal-title">Adicionar conta</h2>
          </div>
          <button className="fds-icon-btn" onClick={onClose}><Icon.X size={16}/></button>
        </header>
        <div className="fds-modal-body">
          <div className="fds-modal-row two">
            <label className="fds-field">
              <span>Nome da conta</span>
              <input className="fds-input" placeholder="ex: Nubank Conta" value={nome} onChange={(e) => setNome(e.target.value)}/>
            </label>
            <label className="fds-field">
              <span>Banco</span>
              <input className="fds-input" placeholder="ex: Nubank" value={banco} onChange={(e) => setBanco(e.target.value)}/>
            </label>
          </div>
          <div className="fds-modal-row two">
            <label className="fds-field">
              <span>Tipo</span>
              <div className="fds-input-select">
                <select className="fds-select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  <option value="corrente">Corrente</option>
                  <option value="poupança">Poupança</option>
                  <option value="digital">Digital</option>
                  <option value="investimento">Investimento</option>
                </select>
                <Icon.Down size={13} style={{ opacity: 0.5 }}/>
              </div>
            </label>
            <label className="fds-field">
              <span>Saldo inicial</span>
              <div className="fds-input-money">
                <span className="prefix">R$</span>
                <input className="fds-input" placeholder="0,00" value={saldo} onChange={(e) => setSaldo(e.target.value)}/>
              </div>
            </label>
          </div>
        </div>
        <footer className="fds-modal-foot">
          <button className="fds-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="fds-btn-primary" onClick={handleSave} disabled={!canSave}>
            <Icon.Check size={14}/> Adicionar conta
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Modal: Novo Cartão ───────────────────────────────────────
function NovoCartaoModal({ open, onClose }) {
  const { addCard } = useFides();
  const [nome, setNome]           = React.useState('');
  const [bandeira, setBandeira]   = React.useState('Visa');
  const [limite, setLimite]       = React.useState('');
  const [diaVenc, setDiaVenc]     = React.useState('');
  const [diaFech, setDiaFech]     = React.useState('');

  if (!open) return null;

  const parseVal = (s) => parseFloat(String(s).replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.')) || 0;

  // Melhor data de compra = dia seguinte ao fechamento
  const melhorCompra = diaFech ? ((parseInt(diaFech, 10) % 30) + 1) : null;

  const canSave = nome.trim() && diaVenc && diaFech;

  const handleSave = () => {
    if (!canSave) return;
    addCard({
      name: nome.trim(),
      brand: bandeira,
      limit: parseVal(limite),
      due: `dia ${diaVenc}`,
      diaFechamento: parseInt(diaFech, 10),
      diaVencimento: parseInt(diaVenc, 10),
      tag: bandeira,
    });
    setNome(''); setBandeira('Visa'); setLimite(''); setDiaVenc(''); setDiaFech('');
    onClose?.();
  };

  return (
    <div className="fds-modal-backdrop" onClick={onClose}>
      <div className="fds-modal" onClick={(e) => e.stopPropagation()}>
        <header className="fds-modal-head">
          <div>
            <div className="fds-modal-eyebrow">Novo</div>
            <h2 className="fds-modal-title">Adicionar cartão</h2>
          </div>
          <button className="fds-icon-btn" onClick={onClose}><Icon.X size={16}/></button>
        </header>
        <div className="fds-modal-body">
          <div className="fds-modal-row two">
            <label className="fds-field">
              <span>Nome do cartão</span>
              <input className="fds-input" placeholder="ex: Nubank Ultravioleta" value={nome} onChange={(e) => setNome(e.target.value)}/>
            </label>
            <label className="fds-field">
              <span>Bandeira</span>
              <div className="fds-input-select">
                <select className="fds-select" value={bandeira} onChange={(e) => setBandeira(e.target.value)}>
                  <option value="Visa">Visa</option>
                  <option value="Mastercard">Mastercard</option>
                  <option value="Elo">Elo</option>
                  <option value="Amex">Amex</option>
                </select>
                <Icon.Down size={13} style={{ opacity: 0.5 }}/>
              </div>
            </label>
          </div>
          <div className="fds-modal-row two">
            <label className="fds-field">
              <span>Limite total</span>
              <div className="fds-input-money">
                <span className="prefix">R$</span>
                <input className="fds-input" placeholder="0,00" value={limite} onChange={(e) => setLimite(e.target.value)}/>
              </div>
            </label>
            <div className="fds-field" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label className="fds-field" style={{ margin: 0 }}>
                <span>Dia vencimento</span>
                <input className="fds-input" type="number" min={1} max={31} placeholder="1–31" value={diaVenc} onChange={(e) => setDiaVenc(e.target.value)}/>
              </label>
              <label className="fds-field" style={{ margin: 0 }}>
                <span>Dia fechamento</span>
                <input className="fds-input" type="number" min={1} max={31} placeholder="1–31" value={diaFech} onChange={(e) => setDiaFech(e.target.value)}/>
              </label>
            </div>
          </div>
          {melhorCompra && (
            <div className="pln-info-banner" style={{ marginTop: 4 }}>
              <div className="pln-info-icon"><Icon.Calendar size={14}/></div>
              <div className="pln-info-body">
                <div className="pln-info-title">
                  Melhor data de compra: <strong>dia {melhorCompra}</strong>
                  <span className="fds-muted" style={{ marginLeft: 8, fontWeight: 400, fontSize: 12 }}>
                    (dia seguinte ao fechamento)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        <footer className="fds-modal-foot">
          <button className="fds-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="fds-btn-primary" onClick={handleSave} disabled={!canSave}>
            <Icon.Check size={14}/> Adicionar cartão
          </button>
        </footer>
      </div>
    </div>
  );
}

function ContasStudio({ onAdd }) {
  const { transactions, accounts, cards, payCartaoFatura, faturasPorCartao, selectedMonth, monthLabel } = useFides();
  const lbl = monthLabel(selectedMonth);
  const [novaContaOpen, setNovaContaOpen]   = React.useState(false);
  const [novoCartaoOpen, setNovoCartaoOpen] = React.useState(false);

  // Totals from mock + computed sparkline data per account
  const totalContas = accounts.reduce((s, a) => s + a.balance, 0);
  const totalUsadoCartoes = cards.reduce((s, c) => s + c.used, 0);
  const totalLimiteCartoes = cards.reduce((s, c) => s + c.limit, 0);
  const proximaFatura = cards.reduce((m, c) =>
    (!m || c.due < m.due) ? c : m, null);

  // Account sparklines — fabricated stable historical balances
  const acctHistory = {
    bradesco: [4830, 4612, 4925, 5106, 4720, 4318, 4218.30],
    nubank:   [1420, 1680, 1530, 1890, 2105, 1985, 1892.44],
    infinity: [0, 0, 200, 450, 380, 520, 700.12],
  };

  const lastByAcct = id => transactions.find(t => t.acct === id);

  // ─── Hero ────────────────────────────────────────────────
  const { int, dec } = splitBRL(totalContas);
  const txByAcct = (id) => transactions.filter(t => t.acct === id);
  const txByCard = (id) => transactions.filter(t => t.acct === id);

  return (
    <div className="fds-page stu-page">
      <section className="stu-hero">
        <div className="stu-hero-eyebrow">
          <Icon.Wallet size={11}/>
          patrimônio líquido · maio · 2026
        </div>
        <h2 className="stu-hero-headline">
          Você tem{' '}
          <span className="stu-hero-amt">
            <span className="cur">R$</span>
            <span className="int">{int}</span>
            <span className="dec">,{dec}</span>
          </span>{' '}
          distribuídos.
        </h2>
        <p className="stu-hero-lede">
          <strong className="stu-num">{accounts.length} contas</strong> ativas e{' '}
          <strong className="stu-num">{cards.length} cartões</strong> abertos. Você comprometeu{' '}
          <strong className="stu-num">{fmtBRL(totalUsadoCartoes)}</strong> de{' '}
          <strong className="stu-num">{fmtBRL(totalLimiteCartoes)}</strong> em limite — {((totalUsadoCartoes/totalLimiteCartoes)*100).toFixed(0)}%.
          {proximaFatura && <> Próxima fatura: <strong className="stu-num">{proximaFatura.name}</strong> vence em <em>{proximaFatura.due}</em>.</>}
        </p>

        <div className="stu-hero-strip">
          <div className="stu-metric">
            <div className="stu-metric-lbl">Saldo em contas</div>
            <div className="stu-metric-val pos">{fmtBRL(totalContas)}</div>
            <div className="stu-metric-tag" style={{ color: 'var(--muted)' }}>
              <Icon.Bank size={11}/> {ACCOUNTS.length} contas
            </div>
          </div>
          <div className="stu-metric-sep"/>
          <div className="stu-metric">
            <div className="stu-metric-lbl">Usado em crédito</div>
            <div className="stu-metric-val">−{fmtBRL(totalUsadoCartoes)}</div>
            <ProgressBar value={totalUsadoCartoes/totalLimiteCartoes} tint="var(--accent)" glow/>
          </div>
          <div className="stu-metric-sep"/>
          <div className="stu-metric">
            <div className="stu-metric-lbl">Limite disponível</div>
            <div className="stu-metric-val pos">{fmtBRL(totalLimiteCartoes - totalUsadoCartoes)}</div>
            <div className="stu-metric-tag" style={{ color: 'var(--muted)' }}>
              <Icon.Card size={11}/> de {fmtBRL(totalLimiteCartoes)}
            </div>
          </div>
          <div className="stu-metric-sep"/>
          <div className="stu-metric">
            <div className="stu-metric-lbl">Patrimônio líquido</div>
            <div className="stu-metric-val">{fmtBRL(totalContas - totalUsadoCartoes)}</div>
            <div className="stu-metric-tag" style={{ color: 'var(--accent-bright)' }}>
              <Icon.TrendUp size={11}/> contas − cartões
            </div>
          </div>
        </div>
      </section>

      {/* ─── Capítulo I · Contas ─── */}
      <ChapterMark roman="I" title="Contas"
                   caption={`${accounts.length} contas correntes e digitais`}
                   action={<button className="stu-link" onClick={() => setNovaContaOpen(true)}><Icon.Plus size={12}/> Adicionar conta</button>}/>
      <div className="ctn-accounts">
        {accounts.map(a => {
          const txs = txByAcct(a.id);
          const last = lastByAcct(a.id);
          const last7 = acctHistory[a.id] || [a.balance];
          const delta = last7[last7.length - 1] - last7[0];
          const deltaPct = last7[0] ? (delta / last7[0]) * 100 : 0;
          return (
            <div className="ctn-account" key={a.id}>
              <div className="ctn-account-head">
                <div className="ctn-account-mark" style={{ background: a.color }}>
                  <Icon.Bank size={20}/>
                </div>
                <div className="ctn-account-meta">
                  <div className="ctn-account-name">{a.name}</div>
                  <div className="ctn-account-tag">
                    Conta {a.type === 'digital' ? 'digital' : 'corrente'} · ••{a.tag}
                  </div>
                </div>
                <button className="fds-icon-btn"><Icon.Dots size={16}/></button>
              </div>

              <div className="ctn-account-bal-row">
                <div>
                  <div className="ctn-account-bal-lbl">Saldo atual</div>
                  <div className="ctn-account-bal">{fmtBRL(a.balance)}</div>
                  <div className={`ctn-account-delta ${delta >= 0 ? 'pos' : 'neg'}`}>
                    {delta >= 0 ? <Icon.ArrowUp size={11}/> : <Icon.ArrowDown size={11}/>}
                    {fmtBRL(Math.abs(delta))} ({deltaPct >= 0 ? '+' : '−'}{Math.abs(deltaPct).toFixed(1)}%) · 7 dias
                  </div>
                </div>
                <div className="ctn-account-spark">
                  <Sparkline values={last7} width={180} height={56} accent={a.color} glow fill/>
                </div>
              </div>

              <div className="ctn-account-stats">
                <div>
                  <div className="ctn-stat-lbl">Movimentos no mês</div>
                  <div className="ctn-stat-val">{txs.length}</div>
                </div>
                <div>
                  <div className="ctn-stat-lbl">Entradas</div>
                  <div className="ctn-stat-val pos">+{fmtBRL(txs.filter(t => t.val > 0).reduce((s,t) => s + t.val, 0))}</div>
                </div>
                <div>
                  <div className="ctn-stat-lbl">Saídas</div>
                  <div className="ctn-stat-val neg">−{fmtBRL(Math.abs(txs.filter(t => t.val < 0).reduce((s,t) => s + t.val, 0)))}</div>
                </div>
              </div>

              {last && (
                <div className="ctn-account-last">
                  <span className="ctn-stat-lbl">Último lançamento</span>
                  <div className="ctn-account-last-row">
                    <CategoryAvatar cat={last.cat} size={28}/>
                    <span className="ctn-account-last-desc">{last.desc}</span>
                    <span className="fds-muted" style={{ fontSize: 11 }}>{last.d}</span>
                    <span className={`ctn-account-last-val ${last.val < 0 ? 'neg' : 'pos'}`}>
                      {last.val < 0 ? '−' : '+'}R$ {Math.abs(last.val).toLocaleString('pt-BR',{minimumFractionDigits:2})}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Capítulo II · Cartões ─── */}
      <ChapterMark roman="II" title="Cartões de crédito"
                   caption={`${cards.length} cartões · ${fmtBRL(totalUsadoCartoes)} de fatura aberta`}
                   action={<button className="stu-link" onClick={() => setNovoCartaoOpen(true)}><Icon.Plus size={12}/> Adicionar cartão</button>}/>
      <div className="ctn-cards">
        {cards.map(c => {
          const pct = c.used / c.limit;
          const over = pct > 0.85;
          // Encontra a fatura corrente para este cartão (mês de fatura = selectedMonth)
          const fatKey = `${c.id}|${selectedMonth}`;
          const faturaCorrente = faturasPorCartao[fatKey];
          const faturaValor = faturaCorrente?.total || c.used;
          const faturaTxs = faturaCorrente?.txs || [];
          const handlePay = () => {
            if (faturaCorrente && faturaTxs.length > 0) {
              payCartaoFatura(c.id, selectedMonth);
            }
          };
          return (
            <div className="ctn-card" key={c.id}>
              <div className="ctn-card-visual" style={{
                background: c.id === 'nu'
                  ? 'linear-gradient(135deg, #820AD1 0%, #4C0B7E 100%)'
                  : 'linear-gradient(135deg, #FF7A00 0%, #B25700 100%)',
              }}>
                <div className="ctn-card-visual-top">
                  <div className="ctn-card-visual-brand">
                    <Icon.Card size={18}/>
                    <span>{c.name}</span>
                  </div>
                  <Icon.Wifi size={16}/>
                </div>
                <div className="ctn-card-visual-num">•••• •••• •••• {c.tag.replace(/[^\d]/g,'').slice(-4) || '0000'}</div>
                <div className="ctn-card-visual-foot">
                  <div>
                    <div className="ctn-card-visual-lbl">Titular</div>
                    <div className="ctn-card-visual-val">{USER.name.toUpperCase()}</div>
                  </div>
                  <div>
                    <div className="ctn-card-visual-lbl">Vence</div>
                    <div className="ctn-card-visual-val">{c.due}</div>
                  </div>
                </div>
              </div>

              <div className="ctn-card-info">
                <div className="ctn-card-fatura">
                  <div className="ctn-card-fatura-l">
                    <div className="ctn-stat-lbl">Fatura de {lbl.short.toLowerCase()}</div>
                    <div className="ctn-card-fatura-val">{fmtBRL(faturaValor)}</div>
                    <div className="ctn-card-fatura-meta">
                      {faturaTxs.length > 0
                        ? `${faturaTxs.length} ${faturaTxs.length === 1 ? 'lançamento' : 'lançamentos'} · vence ${c.due}`
                        : `Fatura paga · próxima fecha dia ${c.diaFechamento}`}
                    </div>
                  </div>
                  {faturaTxs.length > 0 ? (
                    <button className="fds-btn-primary" onClick={handlePay}>
                      <Icon.Check size={13}/> Pagar
                    </button>
                  ) : (
                    <span className="fds-status pago" style={{ padding: '7px 12px' }}>
                      <Icon.Check size={11}/> Paga
                    </span>
                  )}
                </div>

                <div className="ctn-card-limit">
                  <div className="ctn-card-limit-track">
                    <div className={`ctn-card-limit-fill ${over ? 'near' : ''}`}
                         style={{ width: `${Math.min(pct*100, 100)}%` }}/>
                  </div>
                  <div className="ctn-card-limit-meta">
                    <span><strong>{fmtBRL(c.limit - c.used)}</strong> disponíveis</span>
                    <span className="fds-muted">limite {fmtBRL(c.limit)}</span>
                  </div>
                </div>

                {faturaTxs.length > 0 && (
                  <details className="ctn-card-txs">
                    <summary>
                      Ver {faturaTxs.length} {faturaTxs.length === 1 ? 'lançamento' : 'lançamentos'} desta fatura
                    </summary>
                    <div className="ctn-card-txs-list">
                      {faturaTxs.slice(0, 8).map((t, i) => (
                        <div className="ctn-card-tx" key={t._id || i}>
                          <CategoryAvatar cat={t.cat} size={22}/>
                          <span className="ctn-card-tx-desc">{t.desc}</span>
                          {t.sub && <span className="fds-mini-tag soft">{t.sub}</span>}
                          <span className="ctn-card-tx-d">{t.d}</span>
                          <span className="ctn-card-tx-val">−R$ {Math.abs(t.val).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                        </div>
                      ))}
                      {faturaTxs.length > 8 && (
                        <div className="ctn-card-tx-more">+ {faturaTxs.length - 8} mais</div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Capítulo III · Distribuição ─── */}
      <ChapterMark roman="III" title="Distribuição"
                   caption="Como seu dinheiro está dividido entre as contas"/>
      <div className="stu-card ctn-dist">
        <div className="ctn-dist-bar">
          {accounts.map(a => {
            const w = (a.balance / totalContas) * 100;
            return (
              <div key={a.id} className="ctn-dist-seg"
                   style={{ width: `${w}%`, background: a.color }}
                   title={`${a.name}: ${w.toFixed(1)}%`}/>
            );
          })}
        </div>
        <div className="ctn-dist-rows">
          {accounts.map(a => {
            const pct = (a.balance / totalContas) * 100;
            return (
              <div className="ctn-dist-row" key={a.id}>
                <span className="ctn-dist-dot" style={{ background: a.color }}/>
                <span className="ctn-dist-name">{a.name}</span>
                <div className="ctn-dist-track">
                  <div className="ctn-dist-fill" style={{ width: `${pct}%`, background: a.color }}/>
                </div>
                <span className="ctn-dist-pct">{pct.toFixed(1)}%</span>
                <span className="ctn-dist-val">{fmtBRL(a.balance)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <NovaContaModal  open={novaContaOpen}  onClose={() => setNovaContaOpen(false)}/>
      <NovoCartaoModal open={novoCartaoOpen} onClose={() => setNovoCartaoOpen(false)}/>
    </div>
  );
}

Object.assign(window, { ContasStudio, NovaContaModal, NovoCartaoModal });
