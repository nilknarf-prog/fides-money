// fides-studio.jsx — Evolved V3: gold/glow base + editorial signature
// Differentiates from PlannerFin template by:
//   • Icon-only slim sidebar (52px)
//   • Editorial hero (narrative headline, not KPI tile grid)
//   • Serif italic section headings ("Capítulo I · Fluxo")
//   • Monthly masthead at top instead of "Olá, [name]"

function FidesStudio({ page = 'dashboard' }) {
  return (
    <FidesProvider>
      <FidesStudioShell initialPage={page}/>
    </FidesProvider>
  );
}

function FidesStudioShell({ initialPage = 'dashboard' }) {
  const [active, setActive] = React.useState(initialPage);
  const [modalOpen, setModalOpen] = React.useState(false);
  const { addTransaction, addTransactions, categoryModalOpen, closeCategoryModal } = useFides();

  React.useEffect(() => { setActive(initialPage); }, [initialPage]);

  return (
    <div className="fds-app fds-studio" data-variant="studio">
      <div className="fds-shell">
        <SidebarSlim active={active} onNav={setActive}/>
        <main className="fds-main">
          <StudioMasthead onAdd={() => setModalOpen(true)}/>
          {active === 'dashboard'  && <DashboardStudio onAdd={() => setModalOpen(true)} onNav={setActive}/>}
          {active === 'transacoes' && <TransacoesStudio onAdd={() => setModalOpen(true)}/>}
          {active === 'orcamento'  && <OrcamentoStudio onAdd={() => setModalOpen(true)}/>}
          {active === 'contas'     && <ContasStudio onAdd={() => setModalOpen(true)}/>}
          {active === 'metas'      && <MetasStudio onAdd={() => setModalOpen(true)}/>}
          {!['dashboard','transacoes','orcamento','contas','metas'].includes(active) && <StudioStub page={active}/>}
        </main>
      </div>
      <NovaTransacaoModal open={modalOpen}
                          onClose={() => setModalOpen(false)}
                          onSave={(tx) => {
                            if (Array.isArray(tx)) addTransactions(tx);
                            else addTransaction(tx);
                            setModalOpen(false);
                          }}
                          variant="v3"/>
      <CategoriaModal open={categoryModalOpen} onClose={closeCategoryModal}/>
      <FidesAssistant/>
      <FidesAssistantFAB/>
    </div>
  );
}

// ─── Transacoes wrapped with editorial insight banner + chapter ────
function TransacoesStudio({ onAdd }) {
  const { monthTransactions, prevMonthTransactions, selectedMonth, monthLabel, prevMonth } = useFides();
  const lbl = monthLabel(selectedMonth);
  const prevLbl = monthLabel(prevMonth(selectedMonth));
  const rec = monthTransactions.filter(t => t.val > 0).length;
  const des = monthTransactions.filter(t => t.val < 0).length;
  const delta = monthTransactions.length - prevMonthTransactions.length;
  const maior = monthTransactions
    .filter(t => t.val < 0)
    .reduce((m, t) => Math.abs(t.val) > Math.abs(m.val) ? t : m, { val: 0, desc: '—' });
  const pend = monthTransactions.filter(t => t.status === 'pendente');
  const pendSoma = pend.reduce((s, t) => s + Math.abs(t.val), 0);
  const empty = monthTransactions.length === 0;
  return (
    <div className="fds-page stu-page">
      {/* Editorial hero (compact) */}
      <section className="stu-hero" style={{ paddingBottom: 22 }}>
        <div className="stu-hero-eyebrow">
          <Icon.Receipt size={11}/>
          movimento · {lbl.long.toLowerCase()}
        </div>
        {empty ? (
          <>
            <h2 className="stu-hero-headline" style={{ fontSize: 32, maxWidth: 820 }}>
              Nenhum lançamento em {lbl.long.split(' de ')[0]}.
            </h2>
            <p className="stu-hero-lede">
              Adicione uma transação clicando em <strong>Lançar transação</strong> ou troque o mês no topo da página.
            </p>
          </>
        ) : (
          <>
            <h2 className="stu-hero-headline" style={{ fontSize: 32, maxWidth: 820 }}>
              {monthTransactions.length} lançamentos em {lbl.long.split(' de ')[0]}
              {prevMonthTransactions.length > 0 && (
                <>, <span className={delta >= 0 ? 'stu-pos' : 'stu-pos'}>
                  {Math.abs(delta)} {delta >= 0 ? 'acima' : 'abaixo'}
                </span> de {prevLbl.long.split(' de ')[0]}</>
              )}.
            </h2>
            <p className="stu-hero-lede">
              Foram <strong className="stu-num">{rec} receitas</strong> e <strong className="stu-num">{des} despesas</strong>.
              {maior.val !== 0 && <> O maior lançamento do mês foi <strong className="stu-num">{maior.desc}</strong>{' '}
              em <em>R$&nbsp;{Math.abs(maior.val).toLocaleString('pt-BR',{minimumFractionDigits:2})}</em>.</>}
              {pend.length > 0 && <> {pend.length} {pend.length === 1 ? 'item ainda pendente, somando' : 'itens ainda pendentes, somando'}{' '}
              <strong className="stu-num">{fmtBRL(pendSoma)}</strong>.</>}
            </p>
          </>
        )}
      </section>

      {/* Chapter mark + universal Transacoes table */}
      <ChapterMark roman="I" title="Todos os lançamentos"
                   caption="Filtre, busque e edite em massa · clique numa linha para ver detalhes"
                   action={<button className="stu-link" onClick={onAdd}><Icon.Plus size={12}/> Lançar transação</button>}/>
      <div className="orc-tx-wrap">
        <Transacoes variant="v3" onAdd={onAdd}/>
      </div>
    </div>
  );
}

// ─── Stubs for pages we haven't built yet ──────────────────────────
function StudioStub({ page }) {
  const titles = {
    contas:   ['Contas & cartões',  'Bradesco · Nubank · InfinityPay · Nubank Ultravioleta · Inter Black'],
    metas:    ['Metas',             'Suas reservas, sonhos e objetivos de longo prazo'],
    dividas:  ['Dívidas',           'Empréstimos, financiamentos e renegociações em andamento'],
    familia:  ['Família',           'Compartilhe contas e responsabilidades'],
  };
  const [title, caption] = titles[page] || ['Em construção', 'Esta tela está sendo desenhada'];
  return (
    <div className="fds-page stu-page">
      <section className="stu-hero">
        <div className="stu-hero-eyebrow">
          <span className="fds-pulse-dot"/>
          em construção
        </div>
        <h2 className="stu-hero-headline" style={{ maxWidth: 640 }}>{title}</h2>
        <p className="stu-hero-lede">{caption}. Esta página está sendo desenhada — em breve no idioma Studio.</p>
      </section>
    </div>
  );
}

// ─── Studio Logo ──────────────────────────────────────────────
// Rounded squircle in deep green with a soft "F" formed by pill strokes,
// plus a subtle upward tick at the base of the stem suggesting growth.
function StudioMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" style={{ display: 'block', flex: 'none' }}>
      <defs>
        <linearGradient id="stu-mark-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"  stopColor="#3B7350"/>
          <stop offset="100%" stopColor="#1F4029"/>
        </linearGradient>
      </defs>
      {/* squircle background */}
      <path d="M 0 14 C 0 4, 4 0, 14 0 L 22 0 C 32 0, 36 4, 36 14 L 36 22 C 36 32, 32 36, 22 36 L 14 36 C 4 36, 0 32, 0 22 Z"
            fill="url(#stu-mark-bg)"/>
      {/* F: vertical stem (rounded pill) */}
      <rect x="11" y="9" width="4" height="18" rx="2" fill="#FFFFFF"/>
      {/* F: top arm */}
      <rect x="11" y="9" width="15" height="4" rx="2" fill="#FFFFFF"/>
      {/* F: middle arm */}
      <rect x="11" y="16" width="11" height="4" rx="2" fill="#FFFFFF"/>
      {/* growth tick at the bottom of the stem */}
      <path d="M 13 26.5 L 17 22.5" stroke="#86E0A0" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.9"/>
    </svg>
  );
}

function StudioLogo({ size = 30 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <StudioMark size={size}/>
      <span style={{
        fontFamily: 'Manrope, ui-sans-serif, system-ui',
        fontWeight: 700,
        fontSize: size * 0.72,
        letterSpacing: '-0.035em',
        color: 'var(--ink)',
        lineHeight: 1,
      }}>
        Fides
      </span>
    </div>
  );
}
// ─── Slim icon-only sidebar ───────────────────────────────────
function SidebarSlim({ active, onNav }) {
  return (
    <aside className="fds-sb-slim">
      <div className="fds-sb-slim-head">
        <StudioMark size={30}/>
      </div>
      <nav className="fds-sb-slim-nav">
        {NAV.map((n) => {
          const Ic = n.icon;
          const on = active === n.id;
          return (
            <button key={n.id}
                    className={`fds-sb-slim-item${on ? ' on' : ''}`}
                    onClick={() => onNav?.(n.id)}
                    title={n.label}>
              <Ic size={18}/>
              {n.badge != null && <span className="fds-sb-slim-badge">{n.badge}</span>}
              <span className="fds-sb-slim-tip">{n.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="fds-sb-slim-foot">
        <button className="fds-sb-slim-item" title="Configurações">
          <Icon.Settings size={18}/>
          <span className="fds-sb-slim-tip">Configurações</span>
        </button>
        <button className="fds-sb-slim-avatar" title={USER.name}>
          {USER.initials}
        </button>
      </div>
    </aside>
  );
}

// ─── Editorial masthead ───────────────────────────────────────
function StudioMasthead({ onAdd }) {
  const { selectedMonth, setSelectedMonth, prevMonth, monthLabel, openAssistant } = useFides();
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const lbl = monthLabel(selectedMonth);
  const [y, m] = selectedMonth.split('-').map(s => parseInt(s, 10));
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const monthsLong = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  // Próximo mês (avançar)
  const nextOf = (ym) => {
    const [yy, mm] = ym.split('-').map(s => parseInt(s, 10));
    if (mm === 12) return `${yy + 1}-01`;
    return `${yy}-${String(mm + 1).padStart(2, '0')}`;
  };

  // Issue numero: posição do mês (Jan = 01)
  const issueN = String(m).padStart(2, '0');
  const semanaOfMonth = Math.ceil(((new Date(y, m - 1, 1).getDay() + 16) / 7)); // mock estável

  return (
    <header className="stu-mast">
      <div className="stu-mast-l">
        <div className="stu-mast-brand">
          <StudioLogo size={30}/>
          <div className="stu-mast-divider"/>
          <div className="stu-mast-period">
            <div className="stu-mast-eyebrow">
              <span>Edição de {monthsLong[m - 1]}</span>
              <span className="stu-mast-sep"/>
              <span>{y} · semana {semanaOfMonth + 16}</span>
              <span className="stu-mast-sep"/>
              <span className="stu-mast-issue">№ {issueN}</span>
            </div>
            <div className="stu-mast-picker">
              <button className="stu-mast-nav"
                      onClick={() => setSelectedMonth(prevMonth(selectedMonth))}
                      title="Mês anterior">
                <Icon.Left size={16}/>
              </button>
              <button className="stu-mast-title-btn" onClick={() => setPickerOpen(v => !v)}>
                <h1 className="stu-mast-title">{monthsLong[m - 1]} · {y}</h1>
                <Icon.Down size={16} style={{ opacity: 0.45 }}/>
              </button>
              <button className="stu-mast-nav"
                      onClick={() => setSelectedMonth(nextOf(selectedMonth))}
                      title="Próximo mês">
                <Icon.Right size={16}/>
              </button>
              {pickerOpen && (
                <div className="stu-mast-picker-dd" onMouseLeave={() => setPickerOpen(false)}>
                  <div className="stu-mast-picker-yr">
                    <button onClick={() => setSelectedMonth(`${y - 1}-${String(m).padStart(2,'0')}`)}>
                      <Icon.Left size={14}/>
                    </button>
                    <span>{y}</span>
                    <button onClick={() => setSelectedMonth(`${y + 1}-${String(m).padStart(2,'0')}`)}>
                      <Icon.Right size={14}/>
                    </button>
                  </div>
                  <div className="stu-mast-picker-grid">
                    {meses.map((mn, i) => {
                      const target = `${y}-${String(i + 1).padStart(2,'0')}`;
                      return (
                        <button key={mn}
                                className={`stu-mast-picker-cell${target === selectedMonth ? ' on' : ''}`}
                                onClick={() => { setSelectedMonth(target); setPickerOpen(false); }}>
                          {mn}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="stu-mast-r">
        <div className="stu-mast-search">
          <Icon.Search size={14} style={{ opacity: 0.5 }}/>
          <input placeholder="Buscar transações, contas, categorias…" readOnly/>
          <kbd className="fds-kbd">⌘K</kbd>
        </div>
        <button className="fds-icon-btn" title="Conversar com o Fides" onClick={openAssistant}>
          <FidesMark size={16}/>
        </button>
        <button className="fds-icon-btn"><Icon.Bell size={16}/><span className="fds-dot"/></button>
        <button className="stu-mast-add" onClick={onAdd}>
          <Icon.Plus size={14}/> Lançar
        </button>
      </div>
    </header>
  );
}

// ─── Studio dashboard ─────────────────────────────────────────
function DashboardStudio({ onAdd, onNav }) {
  const { monthTransactions, prevMonthTransactions, categories, spendByCategory, budgetGroups, openCategoryModal, selectedMonth, monthLabel, prevMonth, accounts, cards } = useFides();
  const lbl = monthLabel(selectedMonth);
  const prevLbl = monthLabel(prevMonth(selectedMonth));

  // Live totals derived from current monthTransactions
  const receitas  = monthTransactions.filter(t => t.val > 0).reduce((s,t) => s + t.val, 0);
  const despesas  = monthTransactions.filter(t => t.val < 0 && t.status === 'pago').reduce((s,t) => s + Math.abs(t.val), 0);
  const pendentes = monthTransactions.filter(t => t.val < 0 && t.status === 'pendente').reduce((s,t) => s + Math.abs(t.val), 0);
  const saldoFinal = receitas - despesas - pendentes;
  const pendCount = monthTransactions.filter(t => t.status === 'pendente').length;

  // Comparativo com mês anterior
  const prevReceitas = prevMonthTransactions.filter(t => t.val > 0).reduce((s,t) => s + t.val, 0);
  const prevDespesas = prevMonthTransactions.filter(t => t.val < 0).reduce((s,t) => s + Math.abs(t.val), 0);
  const prevSaldo = prevReceitas - prevDespesas;
  const deltaSaldo = saldoFinal - prevSaldo;
  const deltaReceitas = receitas - prevReceitas;
  const deltaDespesas = (despesas + pendentes) - prevDespesas;

  const { int, dec } = splitBRL(Math.abs(saldoFinal));
  const top5 = spendByCategory.slice(0, 5);
  const totalSpend = spendByCategory.reduce((s,d) => s + d.val, 0);

  // Salários do mês — destacar quando há vários (caso do usuário)
  const salarios = monthTransactions.filter(t => t.cat === 'salario');
  const salarioInfo = salarios.length > 1
    ? <>Você recebe <strong className="stu-num">{salarios.length} salários</strong> em {lbl.long.split(' de ')[0]} — um em {salarios[salarios.length-1].d.split('/')[0]} e outro em {salarios[0].d.split('/')[0]}.</>
    : null;

  // Recent list (sorted: new first, then by date desc — mocks are already date-desc)
  const recent = monthTransactions.slice(0, 8);
  const empty = monthTransactions.length === 0;

  return (
    <div className="fds-page stu-page">
      {/* ─── Editorial hero ─── */}
      <section className="stu-hero">
        <div className="stu-hero-eyebrow">
          <span className="fds-pulse-dot"/>
          {empty ? 'sem movimento' : `${monthTransactions.length} lançamentos · ${lbl.long}`}
        </div>
        {empty ? (
          <>
            <h2 className="stu-hero-headline">
              {lbl.long} ainda está em branco.
            </h2>
            <p className="stu-hero-lede">
              Lance sua primeira transação clicando em <strong>Lançar</strong> no topo,
              ou navegue por outro mês usando as setas ao lado do título.
            </p>
          </>
        ) : (
          <>
            <h2 className="stu-hero-headline">
              {saldoFinal >= 0 ? 'Você terminará' : 'Você fechará'} {lbl.long.split(' de ')[0]} com{' '}
              <span className="stu-hero-amt" style={{ color: saldoFinal < 0 ? 'var(--bad)' : 'var(--accent)' }}>
                <span className="cur">{saldoFinal < 0 ? '−R$' : 'R$'}</span>
                <span className="int">{int}</span>
                <span className="dec">,{dec}</span>
              </span>{' '}
              {saldoFinal >= 0 ? 'livre' : 'no vermelho'}.
            </h2>
            <p className="stu-hero-lede">
              Chegam <strong className="stu-num">{fmtBRL(receitas, { compact: true })}</strong> em receitas. {salarioInfo}
              {' '}Saem <strong className="stu-num">{fmtBRL(despesas + pendentes, { compact: true })}</strong> em despesas previstas, sendo{' '}
              <em>{fmtBRL(pendentes)} ainda em aberto</em>.
              {prevReceitas > 0 && <> {prevLbl.long.split(' de ')[0]} fechou em <strong className="stu-num">{fmtBRL(prevSaldo, { compact: true })}</strong> — você está{' '}
                <span className="stu-pos">{deltaSaldo >= 0 ? '+' : '−'}{fmtBRL(Math.abs(deltaSaldo), { compact: true })}</span> em relação ao mês passado.</>}
            </p>
          </>
        )}

        {/* Inline metrics — single horizontal strip, not isolated tiles */}
        <div className="stu-hero-strip">
          <div className="stu-metric">
            <div className="stu-metric-lbl">Receitas</div>
            <div className="stu-metric-val pos">+{fmtBRL(receitas)}</div>
            {prevReceitas > 0 && (
              <div className="stu-metric-tag" style={{ color: deltaReceitas >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
                {deltaReceitas >= 0 ? <Icon.ArrowUp size={11}/> : <Icon.ArrowDown size={11}/>}
                {fmtBRL(Math.abs(deltaReceitas))} vs. mês passado
              </div>
            )}
          </div>
          <div className="stu-metric-sep"/>
          <div className="stu-metric">
            <div className="stu-metric-lbl">Despesas pagas</div>
            <div className="stu-metric-val">−{fmtBRL(despesas)}</div>
            {prevDespesas > 0 && (
              <div className="stu-metric-tag" style={{ color: deltaDespesas <= 0 ? 'var(--ok)' : 'var(--warn)' }}>
                {deltaDespesas <= 0 ? <Icon.ArrowDown size={11}/> : <Icon.ArrowUp size={11}/>}
                {fmtBRL(Math.abs(deltaDespesas))} vs. mês passado
              </div>
            )}
          </div>
          <div className="stu-metric-sep"/>
          <div className="stu-metric">
            <div className="stu-metric-lbl">Em aberto</div>
            <div className="stu-metric-val warn">−{fmtBRL(pendentes)}</div>
            <div className="stu-metric-tag"><Icon.Clock size={11}/> {pendCount} {pendCount === 1 ? 'item' : 'itens'}</div>
          </div>
          <div className="stu-metric-sep"/>
          <div className="stu-metric">
            <div className="stu-metric-lbl">Meta poupança</div>
            <div className="stu-metric-val">R$ 668 <span className="stu-metric-of">/ 1.560</span></div>
            <ProgressBar value={668/1560} tint="var(--accent)" glow/>
          </div>
        </div>
      </section>

      {/* ─── Capítulo I · Fluxo do mês ─── */}
      <ChapterMark roman="I" title="Fluxo do mês" caption={`Receitas vs. despesas · últimos 7 meses · 2026`}/>
      <div className="stu-card stu-flow">
        <div className="stu-flow-head">
          <div className="fds-legend">
            <span className="lg"><span className="dot" style={{ background: 'var(--accent)' }}/>Receitas <span className="lg-v">{fmtBRL(receitas)}</span></span>
            <span className="lg"><span className="dot" style={{ background: '#0F172A', opacity: 0.55 }}/>Despesas <span className="lg-v">{fmtBRL(despesas)}</span></span>
            <span className="lg lg-future"><span className="dot"/>Projeção</span>
          </div>
          <div className="fds-tabs">
            <button className="on">Fluxo</button>
            <button>Saldo acumulado</button>
            <button>Por categoria</button>
          </div>
        </div>
        <AreaChart data={MONTHLY} height={240} accent="var(--accent)" glow/>
      </div>

      {/* ─── Capítulo II · Para onde foi ─── */}
      <ChapterMark roman="II" title="Para onde foi"
                   caption={`${fmtBRL(totalSpend)} distribuídos em maio`}
                   action={<button className="stu-link" onClick={openCategoryModal}><Icon.Settings size={12}/> Categorias</button>}/>
      <div className="stu-2col">
        <div className="stu-card stu-cats">
          <div className="stu-cats-body">
            <div className="fds-donut-wrap">
              <Donut data={spendByCategory} size={184} thickness={24} glow/>
              <div className="fds-donut-center">
                <div className="fds-donut-label">Total</div>
                <div className="fds-donut-value">{fmtBRL(totalSpend, { compact: true })}</div>
              </div>
            </div>
            <div className="fds-cats-list">
              {top5.map((c) => (
                <div className="fds-cat-row" key={c.key}>
                  <CategoryAvatar cat={c.key} size={22}/>
                  <span className="fds-cat-lbl">{c.label}</span>
                  <span className="fds-cat-pct">{((c.val/totalSpend)*100).toFixed(0)}%</span>
                  <span className="fds-cat-val">{fmtBRL(c.val)}</span>
                </div>
              ))}
              {spendByCategory.length > 5 && (
                <button className="stu-link">+ {spendByCategory.length - 5} categorias <Icon.Right size={12}/></button>
              )}
            </div>
          </div>
        </div>

        <div className="stu-card stu-budget">
          <div className="stu-budget-bar">
            <BudgetBar segments={budgetGroups.map(g => ({ target: g.target, spent: g.spent, limit: g.limit, tint: g.id === 'essencial' ? 'var(--ok)' : g.id === 'estilo' ? 'var(--info)' : 'var(--bad)' }))}/>
          </div>
          <div className="stu-budget-list">
            {budgetGroups.map(g => {
              const pct = g.limit ? g.spent / g.limit : 0;
              const over = pct > 1;
              const tint = g.id === 'essencial' ? 'var(--ok)' : g.id === 'estilo' ? 'var(--info)' : 'var(--bad)';
              return (
                <div className="stu-budget-row" key={g.id}>
                  <div className="stu-budget-row-h">
                    <span className="fds-cat-dot" style={{ background: tint }}/>
                    <span className="stu-budget-lbl">{g.label}</span>
                    <span className="stu-budget-target">{Math.round(g.target*100)}%</span>
                    <span className={`fds-budget-pct ${over ? 'over' : pct > 0.85 ? 'near' : 'ok'}`}>
                      {Math.round(pct*100)}%
                    </span>
                  </div>
                  <ProgressBar value={pct} tint={tint} glow/>
                  <div className="stu-budget-meta">
                    <span><strong>{fmtBRL(g.spent)}</strong></span>
                    <span className="fds-muted">limite {fmtBRL(g.limit)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Capítulo III · Recente ─── */}
      <ChapterMark roman="III" title="Movimento recente"
                   caption={`Últimas ${recent.length} de ${monthTransactions.length} transações de ${lbl.long.split(' de ')[0]}`}
                   action={<button className="stu-link" onClick={() => onNav?.('transacoes')}>Ver todas <Icon.Right size={12}/></button>}/>
      <div className="stu-card stu-recent">
        <div className="stu-recent-list">
          {recent.map((t, i) => {
            const c = categories[t.cat] || { label: t.cat, tint: '#888', emoji: '🏷️' };
            const a = ACCOUNTS.find(x => x.id === t.acct);
            const neg = t.val < 0;
            return (
              <div className={`stu-tx${t._new ? ' stu-tx-new' : ''}`} key={t._id || i}>
                <div className="stu-tx-date">{t.d.split('/')[0]}</div>
                <CategoryAvatar cat={t.cat} size={36}/>
                <div className="stu-tx-meta">
                  <div className="stu-tx-desc">
                    {t.desc}
                    {t.recur && <span className="fds-mini-tag soft"><Icon.Refresh size={10}/> {t.recur}</span>}
                    {t.sub && <span className="fds-mini-tag soft">{t.sub}</span>}
                  </div>
                  <div className="stu-tx-sub">
                    <span className="fds-cat-pill">
                      <span className="fds-cat-dot" style={{ background: c.tint }}/>
                      {c.label}
                    </span>
                    <span className="fds-acct-pill">
                      <span className="fds-acct-mark-sm" style={{ background: a?.color }}/>
                      {a?.name || '—'}
                    </span>
                    {t.status === 'pendente'
                      ? <span className="fds-status pendente"><Icon.Clock size={11}/>Pendente</span>
                      : <span className="fds-status pago"><Icon.Check size={11}/>Pago</span>}
                  </div>
                </div>
                <div className={`stu-tx-amt ${neg ? 'neg' : 'pos'}`}>
                  {neg ? '−' : '+'}R$&nbsp;{Math.abs(t.val).toLocaleString('pt-BR', {minimumFractionDigits:2})}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Capítulo IV · Contas & cartões ─── */}
      <ChapterMark roman="IV" title="Contas & cartões"
                   caption={`${accounts.length} contas conectadas · ${cards.length} cartões abertos`}
                   action={<button className="stu-link" onClick={() => onNav?.('contas')}>Ver tudo <Icon.Right size={12}/></button>}/>
      <div className="stu-accounts-strip">
        {accounts.map(a => (
          <div className="stu-acct" key={a.id}>
            <div className="stu-acct-h">
              <div className="stu-acct-mark" style={{ background: a.color }}>
                <Icon.Bank size={14}/>
              </div>
              <div className="stu-acct-meta">
                <div className="stu-acct-name">{a.name}</div>
                <div className="stu-acct-tag">•• {a.tag}</div>
              </div>
            </div>
            <div className="stu-acct-bal">{fmtBRL(a.balance)}</div>
            <Sparkline values={[3,4,3.5,4.2,5,4.7,5.3]} width={180} height={32} accent="var(--accent)" glow fill={false}/>
          </div>
        ))}
        {cards.map(c => {
          const pct = c.used / c.limit;
          return (
            <div className="stu-acct stu-cc" key={c.id}>
              <div className="stu-acct-h">
                <div className="stu-acct-mark" style={{ background: 'var(--ink)' }}>
                  <Icon.Card size={14}/>
                </div>
                <div className="stu-acct-meta">
                  <div className="stu-acct-name">{c.name}</div>
                  <div className="stu-acct-tag">{c.tag}</div>
                </div>
              </div>
              <div className="stu-acct-bal">{fmtBRL(c.used)}</div>
              <ProgressBar value={pct} tint="var(--accent)" glow/>
              <div className="stu-cc-meta">
                <span>{(pct*100).toFixed(0)}% de R$ {c.limit.toLocaleString('pt-BR')}</span>
                <span>vence {c.due}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Chapter mark — editorial section header ──────────────────
function ChapterMark({ roman, title, caption, action }) {
  return (
    <div className="stu-chapter">
      <div className="stu-chapter-l">
        <span className="stu-chapter-roman">{roman}</span>
        <div className="stu-chapter-text">
          <h3 className="stu-chapter-title">{title}</h3>
          {caption && <span className="stu-chapter-caption">{caption}</span>}
        </div>
      </div>
      {action && <div className="stu-chapter-r">{action}</div>}
    </div>
  );
}

Object.assign(window, { FidesStudio, DashboardStudio, TransacoesStudio, StudioStub, StudioMark, StudioLogo, ChapterMark });
