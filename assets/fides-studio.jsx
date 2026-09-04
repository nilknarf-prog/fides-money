// fides-studio.jsx — Evolved V3: gold/glow base + editorial signature
// Differentiates from PlannerFin template by:
//   • Icon-only slim sidebar (52px)
//   • Editorial hero (narrative headline, not KPI tile grid)
//   • Serif italic section headings ("Capítulo I · Fluxo")
//   • Monthly masthead at top instead of "Olá, [name]"

function FidesStudio({ page = 'dashboard' }) {
  return (
    <FidesProvider>
      <FidesStudioGuard initialPage={page}/>
    </FidesProvider>
  );
}

function FidesStudioGuard({ initialPage }) {
  const { mode, isLoading, handleLoginSuccess } = useFides();

  if (isLoading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', flexDirection: 'column', gap: '16px',
    }}>
      <div style={{
        width: '32px', height: '32px',
        border: '2px solid var(--border)',
        borderTop: '2px solid var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (mode === 'mock') {
    return (
      <FidesAuth onAuthenticated={(session) => {
        if (typeof handleLoginSuccess === 'function') {
          handleLoginSuccess(session);
        }
        // Salvaguarda: se em 800ms o estado React não transicionar, recarrega
        setTimeout(() => {
          if (window.fidesAuth) {
            window.fidesAuth.getUser().then(({ data }) => {
              if (data?.user) window.location.reload();
            }).catch(() => {});
          }
        }, 800);
      }}/>
    );
  }

  return <FidesStudioShell initialPage={initialPage}/>;
}

function FidesStudioShell({ initialPage = 'dashboard' }) {
  const [active, setActive] = React.useState(initialPage);
  const [lastView, setLastView] = React.useState('dashboard');
  const [modalOpen, setModalOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const { addTransaction, addTransactions, categoryModalOpen, closeCategoryModal } = useFides();

  React.useEffect(() => { setActive(initialPage); }, [initialPage]);

  // Atalho global Cmd/Ctrl+K — abre o palette de qualquer página do studio.
  React.useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        if (window.__fidesWriteConfirmPending) return;
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Auto-fecha o palette em QUALQUER navegação (sidebar, masthead, back, ou o
  // próprio onNav do palette) — finding #4 do 09-REVIEWS.
  React.useEffect(() => { setPaletteOpen(false); }, [active]);

  const goPerfil = React.useCallback(() => {
    if (active === 'perfil') {
      setActive(lastView || 'dashboard');
    } else {
      setLastView(active);
      setActive('perfil');
    }
  }, [active, lastView]);

  return (
    <div className="fds-app fds-studio" data-variant="studio">
      <div className="fds-shell">
        <SidebarSlim active={active} onNav={setActive} onGear={goPerfil}/>
        <main className="fds-main">
          <StudioMasthead onAdd={() => setModalOpen(true)} onGear={goPerfil} active={active}
                          onOpenSearch={() => setPaletteOpen(true)}/>
          {active === 'dashboard'  && <DashboardStudio onAdd={() => setModalOpen(true)} onNav={setActive}/>}
          {active === 'transacoes' && <TransacoesStudio onAdd={() => setModalOpen(true)}/>}
          {active === 'orcamento'  && <OrcamentoStudio onAdd={() => setModalOpen(true)}/>}
          {active === 'contas'     && <ContasStudio onAdd={() => setModalOpen(true)}/>}
          {active === 'metas'      && <MetasStudio onAdd={() => setModalOpen(true)} onNav={setActive}/>}
          {active === 'perfil'     && <PerfilView onNav={setActive}/>}
          {!['dashboard','transacoes','orcamento','contas','metas','perfil'].includes(active) && <StudioStub page={active}/>}
        </main>
      </div>
      <NovaTransacaoModal open={modalOpen}
                          onClose={() => setModalOpen(false)}
                          onSave={(tx) => {
                            if (Array.isArray(tx)) addTransactions(tx);
                            else addTransaction(tx);
                          }}
                          variant="v3"/>
      <CategoriaModal open={categoryModalOpen} onClose={closeCategoryModal}/>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNav={setActive}/>
      <FidesAssistant/>
      <FidesAssistantFAB/>
      <window.FidesUI.ToastViewport />
    </div>
  );
}

// ─── Transacoes wrapped with editorial insight banner + chapter ────
function TransacoesStudio({ onAdd }) {
  const { monthTransactions, prevMonthTransactions, selectedMonth, monthLabel, prevMonth } = useFides();
  const lbl = monthLabel(selectedMonth);
  const prevLbl = monthLabel(prevMonth(selectedMonth));
  // Aggregations excluem movimentações (is_transfer): pagamento de fatura não conta como receita/despesa.
  const flow     = monthTransactions.filter(t => !t.isTransfer);
  const flowPrev = prevMonthTransactions.filter(t => !t.isTransfer);
  const rec = flow.filter(t => t.val > 0).length;
  const des = flow.filter(t => t.val < 0).length;
  const delta = flow.length - flowPrev.length;
  const maior = flow
    .filter(t => t.val < 0)
    .reduce((m, t) => Math.abs(t.val) > Math.abs(m.val) ? t : m, { val: 0, desc: '—' });
  const pend = monthTransactions.filter(t => t.status === 'pendente');
  const pendSoma = flow.filter(t => t.status === 'pendente').reduce((s, t) => s + Math.abs(t.val), 0);
  const empty = monthTransactions.length === 0;
  return (
    <div className="fds-page stu-page">
      {/* Editorial hero (compact) — via EditorialHero */}
      <EditorialHero
        eyebrow={<><Icon.Receipt size={11}/> movimento · {lbl.long.toLowerCase()}</>}
        headline={empty
          ? `Nenhum lançamento em ${lbl.long.split(' de ')[0]}.`
          : <>{monthTransactions.length} lançamentos em {lbl.long.split(' de ')[0]}
              {prevMonthTransactions.length > 0 && (
                <>, <span className="stu-pos">{Math.abs(delta)} {delta >= 0 ? 'acima' : 'abaixo'}</span>{' '}
                de {prevLbl.long.split(' de ')[0]}</>
              )}.</>
        }
        headlineStyle={{ fontSize: 32, maxWidth: 820 }}
        lede={empty
          ? <>Adicione uma transação clicando em <strong>Lançar transação</strong> ou troque o mês no topo da página.</>
          : <>Foram <strong className="stu-num">{rec} receitas</strong> e <strong className="stu-num">{des} despesas</strong>.
              {maior.val !== 0 && <> O maior lançamento do mês foi <strong className="stu-num">{maior.desc}</strong>{' '}
              em <em>R$&nbsp;{Math.abs(maior.val).toLocaleString('pt-BR',{minimumFractionDigits:2})}</em>.</>}
              {pend.length > 0 && <> {pend.length} {pend.length === 1 ? 'item ainda pendente, somando' : 'itens ainda pendentes, somando'}{' '}
              <strong className="stu-num">{fmtBRL(pendSoma)}</strong>.</>}</>
        }
        style={{ paddingBottom: 22 }}
      />

      {/* Chapter mark + table — ou empty state se mês vazio */}
      {empty ? (
        <div className="fds-empty-state">
          <div className="fds-empty-state-icon">📋</div>
          <h2 className="fds-empty-state-title">
            Nenhuma transação em {lbl.long}
          </h2>
          <p className="fds-empty-state-lede">
            Comece registrando uma receita ou despesa.
          </p>
          <button className="fds-empty-state-btn" onClick={onAdd}>
            + Adicionar lançamento
          </button>
        </div>
      ) : (
        <>
          <ChapterMark roman="I" title="Todos os lançamentos"
                       caption="Filtre, busque e edite em massa · clique numa linha para ver detalhes"
                       action={<button className="stu-link" onClick={onAdd}><Icon.Plus size={12}/> Lançar transação</button>}/>
          <div className="orc-tx-wrap">
            <Transacoes variant="v3" onAdd={onAdd}/>
          </div>
        </>
      )}
    </div>
  );
}

// ─── EditorialHero — card editorial compartilhado ──────────────
// Elimina duplicação da estrutura stu-hero entre Dashboard e Transações.
// Props:
//   eyebrow:        string | JSX   — linha de eyebrow acima do título
//   headline:       string | JSX   — manchete principal (renderizada em <h2>)
//   lede?:          string | JSX   — parágrafo explicativo (opcional)
//   headlineStyle?: object         — style extra para o <h2> (ex: fontSize, maxWidth)
//   metrics?:  Array<{             — strip horizontal de métricas (0–4 itens)
//     label:    string
//     value:    string | JSX       — conteúdo do valor (ex: "+R$ 9.948,66")
//     sub?:     string | JSX | null — terceira linha (tag, mini-chart, ProgressBar…)
//     accent?:  boolean            — aplica .stu-metric-val.pos (verde)
//     warn?:    boolean            — aplica .stu-metric-val.warn (laranja)
//   }>
//   style?:     object    — style extra para o <section>
//   className?: string    — classe extra para o <section>
function EditorialHero({ eyebrow, headline, lede, headlineStyle, metrics, notice, style, className }) {
  const hasMetrics = metrics && metrics.length > 0;
  return (
    <section className={`stu-hero${className ? ' ' + className : ''}`} style={style}>
      {eyebrow != null && (
        <div className="stu-hero-eyebrow">{eyebrow}</div>
      )}
      <h2 className="stu-hero-headline" style={headlineStyle}>{headline}</h2>
      {lede != null && (
        <p className="stu-hero-lede">{lede}</p>
      )}
      {notice != null && notice}
      {hasMetrics && (
        <div className="stu-hero-strip">
          {metrics.map((m, i) => (
            <React.Fragment key={i}>
              {i > 0 && <div className="stu-metric-sep"/>}
              <div className="stu-metric">
                <div className="stu-metric-lbl">{m.label}</div>
                <div className={`stu-metric-val${m.accent ? ' pos' : m.warn ? ' warn' : ''}`}>
                  {m.value}
                </div>
                {m.sub != null && m.sub}
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
    </section>
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
  // useId gives a stable unique ID per instance — prevents the duplicate
  // gradient bug when both sidebar and masthead render StudioMark on the
  // same page (one hidden on mobile breaks fill="url(#...)" on the other).
  const uid = (React.useId ? React.useId() : Math.random().toString(36).slice(2)).replace(/:/g, '');
  const gradId = `smg-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" style={{ display: 'block', flex: 'none' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"  stopColor="#3B7350"/>
          <stop offset="100%" stopColor="#1F4029"/>
        </linearGradient>
      </defs>
      <path d="M 0 14 C 0 4, 4 0, 14 0 L 22 0 C 32 0, 36 4, 36 14 L 36 22 C 36 32, 32 36, 22 36 L 14 36 C 4 36, 0 32, 0 22 Z"
            fill={`url(#${gradId})`}/>
      <rect x="11" y="9" width="4" height="18" rx="2" fill="#FFFFFF"/>
      <rect x="11" y="9" width="15" height="4" rx="2" fill="#FFFFFF"/>
      <rect x="11" y="16" width="11" height="4" rx="2" fill="#FFFFFF"/>
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
function SidebarSlim({ active, onNav, onGear }) {
  const { userName, firstName } = useFides();
  const displayName = firstName || userName || 'Usuário';
  const initials = displayName.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U';
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
        <button className="fds-sb-slim-item" title="Configurações" onClick={onGear}>
          <Icon.Settings size={18}/>
          <span className="fds-sb-slim-tip">Configurações</span>
        </button>
        <button className="fds-sb-slim-avatar" title={displayName}>
          {initials}
        </button>
      </div>
    </aside>
  );
}

// ─── Editorial masthead ───────────────────────────────────────
function StudioMasthead({ onAdd, onGear, active, onOpenSearch }) {
  const { selectedMonth, setSelectedMonth, prevMonth, monthLabel, openAssistant, monthTransactions, mode } = useFides();

  async function handleLogout() {
    if (window.fidesAuth) await window.fidesAuth.signOut();
  }
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerYear, setPickerYear] = React.useState(y);
  const pickerRef = React.useRef(null);
  const lbl = monthLabel(selectedMonth);
  const [y, m] = selectedMonth.split('-').map(s => parseInt(s, 10));
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const monthsLong = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  // Fecha o picker ao clicar/tocar fora — corrige bug de touch no iPhone
  React.useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [pickerOpen]);

  // Badge dinâmico do sininho — transações pendentes do mês atual
  const pendingCount = monthTransactions.filter(t => t.status === 'pendente').length;

  // Painel de notificações
  const [bellOpen, setBellOpen] = React.useState(false);
  const bellRef = React.useRef(null);

  React.useEffect(() => {
    if (!bellOpen) return;
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [bellOpen]);

  const notifications = React.useMemo(() => {
    const items = [];
    const pending = monthTransactions.filter(t => t.status === 'pendente' && t.val < 0);
    if (pending.length > 0) {
      items.push({
        id: 'pending',
        type: 'warning',
        icon: '⏳',
        title: `${pending.length} despesa${pending.length > 1 ? 's' : ''} em aberto`,
        lede: pending.slice(0, 2).map(t => t.desc).join(', ') + (pending.length > 2 ? ` e mais ${pending.length - 2}` : ''),
      });
    }
    const receitasPendentes = monthTransactions.filter(t => t.status === 'pendente' && t.val > 0);
    if (receitasPendentes.length > 0) {
      const total = receitasPendentes.reduce((s, t) => s + t.val, 0);
      items.push({
        id: 'receitas',
        type: 'info',
        icon: '💰',
        title: `${receitasPendentes.length} receita${receitasPendentes.length > 1 ? 's' : ''} a receber`,
        lede: `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} previstos para este mês`,
      });
    }
    if (items.length === 0) {
      items.push({ id: 'ok', type: 'ok', icon: '✅', title: 'Tudo em dia', lede: 'Nenhuma pendência neste mês.' });
    }
    return items;
  }, [monthTransactions]);

  // Próximo mês (avançar)
  const nextOf = (ym) => {
    const [yy, mm] = ym.split('-').map(s => parseInt(s, 10));
    if (mm === 12) return `${yy + 1}-01`;
    return `${yy}-${String(mm + 1).padStart(2, '0')}`;
  };

  // Issue numero: posição do mês (Jan = 01)
  const issueN = String(m).padStart(2, '0');
  // Semana do ano reiniciando em Janeiro — evita "semana 53" confuso
  const semanaDoAno = (ano, mes) => {
    const primeiroDiaDoAno = new Date(ano, 0, 1);
    const primeiroDiaDoMes = new Date(ano, mes - 1, 1);
    const diasDecorridos = Math.floor((primeiroDiaDoMes - primeiroDiaDoAno) / 86400000);
    return Math.ceil((diasDecorridos + primeiroDiaDoAno.getDay() + 1) / 7);
  };
  const semanaOfMonth = semanaDoAno(y, m);

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
              <span>{y} · semana {semanaOfMonth}</span>
              <span className="stu-mast-sep"/>
              <span className="stu-mast-issue">№ {issueN}</span>
            </div>
            <div className="stu-mast-picker">
              <button className="stu-mast-nav"
                      onClick={() => setSelectedMonth(prevMonth(selectedMonth))}
                      title="Mês anterior">
                <Icon.Left size={16}/>
              </button>
              <button className="stu-mast-title-btn" onClick={() => { setPickerYear(y); setPickerOpen(v => !v); }}>
                <h1 className="stu-mast-title">{monthsLong[m - 1]} · {y}</h1>
                <Icon.Down size={16} style={{ opacity: 0.45 }}/>
              </button>
              <button className="stu-mast-nav"
                      onClick={() => setSelectedMonth(nextOf(selectedMonth))}
                      title="Próximo mês">
                <Icon.Right size={16}/>
              </button>
              {pickerOpen && (
                <>
                  <div className="fds-picker-backdrop"
                       onMouseDown={() => setPickerOpen(false)}
                       onTouchStart={() => setPickerOpen(false)} />
                  <div className="stu-mast-picker-dd" ref={pickerRef}>
                    <div className="stu-mast-picker-yr">
                      <button
                        onMouseDown={e => e.stopPropagation()}
                        onTouchStart={e => { e.stopPropagation(); }}
                        onClick={e => { e.stopPropagation(); setPickerYear(v => v - 1); }}>
                        <Icon.Left size={14}/>
                      </button>
                      <span>{pickerYear}</span>
                      <button
                        onMouseDown={e => e.stopPropagation()}
                        onTouchStart={e => { e.stopPropagation(); }}
                        onClick={e => { e.stopPropagation(); setPickerYear(v => v + 1); }}>
                        <Icon.Right size={14}/>
                      </button>
                    </div>
                    <div className="stu-mast-picker-grid">
                      {meses.map((mn, i) => {
                        const target = `${pickerYear}-${String(i + 1).padStart(2,'0')}`;
                        return (
                          <button key={mn}
                                  className={`stu-mast-picker-cell${target === selectedMonth ? ' on' : ''}`}
                                  onClick={e => { e.stopPropagation(); setSelectedMonth(target); setPickerOpen(false); }}>
                            {mn}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="stu-mast-r">
        <div className="stu-mast-search" onClick={onOpenSearch} style={{ cursor: 'pointer' }}>
          <Icon.Search size={14} style={{ opacity: 0.5 }}/>
          <input placeholder="Buscar transações, contas, categorias…" readOnly/>
          <kbd className="fds-kbd">⌘K</kbd>
        </div>
        <button className="fds-icon-btn" title="Conversar com o Fides" onClick={openAssistant}>
          <Icon.Sparkles size={16}/>
        </button>
        <div style={{ position: 'relative' }}>
          <button className="fds-icon-btn"
                  title={pendingCount > 0 ? `${pendingCount} pendente${pendingCount > 1 ? 's' : ''}` : 'Notificações'}
                  onClick={() => setBellOpen(v => !v)}>
            <Icon.Bell size={16}/>
            {pendingCount > 0
              ? <span className="fds-sb-slim-badge">{pendingCount}</span>
              : <span className="fds-dot"/>}
          </button>
          {bellOpen && (
            <>
              <div className="fds-notif-backdrop"
                   onMouseDown={() => setBellOpen(false)}
                   onTouchStart={() => setBellOpen(false)} />
              <div className="fds-notif-panel" ref={bellRef} onClick={e => e.stopPropagation()}>
                <div className="fds-notif-header">
                  <span className="fds-notif-title">Avisos</span>
                  <button className="fds-notif-close" onClick={() => setBellOpen(false)}>
                    <Icon.X size={14}/>
                  </button>
                </div>
                <div className="fds-notif-list">
                  {notifications.map(n => (
                    <div key={n.id} className={`fds-notif-item fds-notif-${n.type}`}>
                      <span className="fds-notif-icon">{n.icon}</span>
                      <div className="fds-notif-body">
                        <p className="fds-notif-item-title">{n.title}</p>
                        <p className="fds-notif-item-lede">{n.lede}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <button className="stu-mast-add" onClick={onAdd}>
          <Icon.Plus size={14}/> Lançar
        </button>
        {mode === 'live' && (
          <button
            className="stu-mast-logout"
            onClick={handleLogout}
            title="Sair da conta"
            style={{
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              minHeight: 44, minWidth: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--ink-2)', borderRadius: 8, padding: '0 8px',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        )}
        <button
          className={`fds-icon-btn stu-mast-gear${active === 'perfil' ? ' on' : ''}`}
          onClick={onGear}
          title="Perfil"
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            minHeight: 44, minWidth: 44,
          }}
        >
          <Icon.Settings size={16}/>
        </button>
      </div>
    </header>
  );
}

// ─── Command Palette (⌘K) ───────────────────────────────────────
// Busca em memória sobre transactions/accounts/cards/categories já
// disponíveis via useFides() — sem query nova (TX-07).
function CommandPalette({ open, onClose, onNav }) {
  const { transactions, accounts, cards, categories } = useFides();
  const [query, setQuery] = React.useState('');
  const [activeIdx, setActiveIdx] = React.useState(0);
  const inputRef = React.useRef(null);

  // Reset ao abrir + autofoco (hooks sempre antes do return condicional).
  React.useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIdx(0);
    const t = setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 0);
    return () => clearTimeout(t);
  }, [open]);

  const results = React.useMemo(() => {
    if (!open) return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];

    // Mesmo idioma de busca de fides-transacoes.jsx:213-222 (desc/val/categoria).
    const txResults = transactions
      .filter(t => {
        const inDesc = (t.desc || '').toLowerCase().indexOf(q) >= 0;
        const inVal = String(t.val).indexOf(q) >= 0;
        const catLbl = (categories[t.cat] && categories[t.cat].label) || t.cat || '';
        const inCat = catLbl.toLowerCase().indexOf(q) >= 0;
        return inDesc || inVal || inCat;
      })
      .slice(0, 6)
      .map(t => ({
        key: 'tx-' + (t._id || t.d + t.desc),
        label: t.desc || '(sem descrição)',
        hint: (categories[t.cat] && categories[t.cat].label) || 'Transação',
        page: 'transacoes',
      }));

    const acctResults = accounts
      .filter(a => (a.name || '').toLowerCase().indexOf(q) >= 0)
      .map(a => ({ key: 'acct-' + a.id, label: a.name, hint: 'Conta', page: 'contas' }));

    const cardResults = cards
      .filter(c => (c.name || '').toLowerCase().indexOf(q) >= 0)
      .map(c => ({ key: 'card-' + c.id, label: c.name, hint: 'Cartão', page: 'contas' }));

    const catResults = Object.keys(categories || {})
      .filter(catId => ((categories[catId].label || catId) + '').toLowerCase().indexOf(q) >= 0)
      .map(catId => ({ key: 'cat-' + catId, label: categories[catId].label || catId, hint: 'Categoria', page: 'orcamento' }));

    return [...txResults, ...acctResults, ...cardResults, ...catResults];
  }, [open, query, transactions, accounts, cards, categories]);

  React.useEffect(() => { setActiveIdx(0); }, [query]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(i => (results.length ? Math.min(i + 1, results.length - 1) : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        const r = results[activeIdx];
        if (r) { onNav(r.page); onClose(); }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, results, activeIdx, onNav, onClose]);

  if (!open) return null;

  const q = query.trim();

  return (
    <div className="fds-modal-backdrop stu-cmdk-backdrop" onClick={onClose}>
      <div className="fds-modal stu-cmdk" onClick={e => e.stopPropagation()}>
        <div className="stu-cmdk-input-row">
          <Icon.Search size={16} style={{ opacity: 0.5, flexShrink: 0 }}/>
          <input
            ref={inputRef}
            className="stu-cmdk-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar transações, contas, categorias…"
          />
          <kbd className="fds-kbd">Esc</kbd>
        </div>
        <div className="stu-cmdk-list">
          {q === ''
            ? <div className="stu-cmdk-empty">Digite para buscar transações, contas ou categorias…</div>
            : results.length === 0
              ? <div className="stu-cmdk-empty">Nenhum resultado para "{q}"</div>
              : results.map((r, i) => (
                <button
                  key={r.key}
                  type="button"
                  className={`stu-cmdk-item${i === activeIdx ? ' on' : ''}`}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => { onNav(r.page); onClose(); }}
                >
                  <span className="stu-cmdk-item-label">{r.label}</span>
                  {r.hint && <span className="stu-cmdk-item-hint">{r.hint}</span>}
                </button>
              ))
          }
        </div>
      </div>
    </div>
  );
}

// ─── Perfil View ──────────────────────────────────────────────
function PerfilView({ onNav }) {
  var _s = window.useFides();
  var userName = _s.userName;
  var firstName = _s.firstName;
  var updateProfile = _s.updateProfile;
  var userPlan = _s.userPlan;
  var isPremium = _s.isPremium;
  var _st0 = React.useState(userName || '');
  var nameVal = _st0[0]; var setNameVal = _st0[1];
  var _st1 = React.useState(false);
  var saving = _st1[0]; var setSaving = _st1[1];
  var _st2 = React.useState(null);
  var msg = _st2[0]; var setMsg = _st2[1];
  var _st3 = React.useState(false);
  var upgradeOpen = _st3[0]; var setUpgradeOpen = _st3[1];
  // WA-OPTIN-01: hooks declarados incondicionalmente no topo (Rules of Hooks,
  // lição Phase 07) — o gate premium só decide o que é RENDERIZADO mais abaixo.
  var _st4 = React.useState(false);
  var waConnecting = _st4[0]; var setWaConnecting = _st4[1];
  var _st5 = React.useState(null);
  var waResult = _st5[0]; var setWaResult = _st5[1];

  React.useEffect(function () { setNameVal(userName || ''); }, [userName]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setMsg(null);
    var result = await updateProfile(nameVal);
    setSaving(false);
    if (result && result.error) {
      setMsg({ type: 'erro', text: result.error });
    } else {
      setMsg({ type: 'ok', text: 'Nome atualizado com sucesso!' });
      setTimeout(function () { setMsg(null); }, 3000);
    }
  }

  // WA-OPTIN-01: camada 1 do gating (UI) — este handler só é alcançável quando
  // isPremium (botão só renderiza nesse caso); a camada 2 (server-side,
  // fail-closed) vive em api/wa-link.js e é a defesa real (AC-01, T-14-10).
  async function handleConnectWhatsApp() {
    if (waConnecting) return;
    setWaConnecting(true);
    setMsg(null);
    try {
      var jwt = null;
      if (window.fidesAuth && typeof window.fidesAuth.getSession === 'function') {
        var sessionResult = await window.fidesAuth.getSession();
        jwt = (sessionResult && sessionResult.data && sessionResult.data.session)
          ? sessionResult.data.session.access_token
          : null;
      }
      if (!jwt) {
        setMsg({ type: 'erro', text: 'Sessão expirada. Recarregue a página e tente de novo.' });
        setWaConnecting(false);
        return;
      }
      // WR-03: token só no header Authorization Bearer, nunca no corpo.
      var res = await fetch('/api/wa-link', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + jwt }
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        var errMap = {
          PREMIUM_REQUIRED: 'Conectar WhatsApp é um recurso Premium.',
          JWT_MISSING: 'Sessão expirada. Recarregue a página e tente de novo.',
          JWT_INVALID: 'Sessão expirada. Recarregue a página e tente de novo.',
          WA_CONFIG_MISSING: 'O WhatsApp está indisponível agora. Tente em instantes.',
        };
        setMsg({ type: 'erro', text: errMap[data.error] || 'Não foi possível conectar agora. Tente de novo em instantes.' });
        setWaConnecting(false);
        return;
      }
      setWaResult({ code: data.code, waLink: data.wa_link });
    } catch (err) {
      setMsg({ type: 'erro', text: 'Sem conexão. Verifique a internet.' });
    }
    setWaConnecting(false);
  }

  return React.createElement('div', { className: 'prf-view' },
    React.createElement('div', { className: 'prf-header' },
      React.createElement('button', {
        className: 'prf-back',
        type: 'button',
        onClick: function () { onNav && onNav('dashboard'); }
      }, '← Voltar'),
      React.createElement('h2', { className: 'prf-title' }, 'Perfil')
    ),
    React.createElement('div', { className: 'prf-card' },
      React.createElement('div', { className: 'prf-avatar' },
        React.createElement('span', { className: 'prf-avatar-initials' },
          (firstName || '?').charAt(0).toUpperCase()
        )
      ),
      React.createElement('div', {
        className: 'prf-badge ' + (isPremium ? 'prf-badge--premium' : 'prf-badge--free')
      }, isPremium ? 'Premium' : 'Free'),
      !isPremium
        ? React.createElement('button', {
            type: 'button',
            className: 'fds-btn-primary prf-upgrade-btn',
            onClick: function () { setUpgradeOpen(true); }
          }, '✨ Vire Premium')
        : null,
      // WA-OPTIN-01 (AC-01, camada 1 do gating): só renderiza para premium — o
      // free segue vendo apenas o "Vire Premium" acima. Store ainda não expõe
      // waLinked/phone (14-PATTERNS.md) — botão fica sempre disponível, um novo
      // clique gera um novo código (não inventa campo de store fora do escopo).
      isPremium
        ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' } },
            waResult
              ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center' } },
                  React.createElement('p', {
                    style: { fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, margin: 0 }
                  }, 'Toque para abrir o WhatsApp e enviar o código — isso vincula seu número ao Fides.'),
                  React.createElement('a', {
                    href: waResult.waLink,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    className: 'fds-btn-primary prf-upgrade-btn'
                  }, 'Abrir WhatsApp'),
                  React.createElement('p', {
                    style: { fontSize: 12, color: 'var(--ink-3)', margin: 0 }
                  }, 'Código: ', React.createElement('strong', null, waResult.code))
                )
              : React.createElement('button', {
                  type: 'button',
                  className: 'fds-btn-primary prf-upgrade-btn',
                  disabled: waConnecting,
                  onClick: handleConnectWhatsApp
                }, waConnecting ? 'Gerando código…' : 'Conectar WhatsApp')
          )
        : null,
      React.createElement('div', { className: 'fds-field' },
        React.createElement('label', { className: 'fds-label', htmlFor: 'prf-name-input' }, 'Nome completo'),
        React.createElement('input', {
          id: 'prf-name-input',
          type: 'text',
          className: 'fds-input',
          value: nameVal,
          maxLength: 60,
          autoComplete: 'name',
          onChange: function (e) {
            setNameVal(e.target.value);
            setMsg(null);
          }
        }),
        nameVal.trim().length > 0 && nameVal.trim().length < 2
          ? React.createElement('span', { className: 'prf-hint prf-hint--err' }, 'Mínimo 2 caracteres')
          : null
      ),
      msg
        ? React.createElement('p', {
            className: 'prf-msg prf-msg--' + msg.type
          }, msg.type === 'ok' ? '✓ ' + msg.text : '⚠ ' + msg.text)
        : null,
      React.createElement('button', {
        type: 'button',
        className: 'fds-btn fds-btn--primary prf-save-btn',
        disabled: saving || nameVal.trim().length < 2,
        onClick: handleSave
      }, saving ? 'Salvando…' : 'Salvar')
    ),
    React.createElement(UpgradeModal, {
      open: upgradeOpen,
      onClose: function () { setUpgradeOpen(false); }
    })
  );
}

// ─── Modal: Vire Premium (placeholder de upgrade — checkout real chega no M6) ──
// React.createElement (não JSX) para casar com o estilo local de PerfilView.
function UpgradeModal({ open, onClose }) {
  var mc = window.FidesUI.useModalClose(open, onClose);
  var rendered = mc.rendered;
  var closing = mc.closing;
  var requestClose = mc.requestClose;
  if (!rendered) return null;
  return React.createElement('div', {
    className: 'fds-modal-backdrop' + (closing ? ' is-closing' : ''),
    onClick: requestClose
  },
    React.createElement('div', {
      className: 'fds-modal' + (closing ? ' is-closing' : ''),
      style: { maxWidth: 380 },
      onClick: function (e) { e.stopPropagation(); }
    },
      React.createElement('div', { className: 'fds-modal-head' },
        React.createElement('div', { className: 'fds-modal-title' }, 'Vire Premium'),
        React.createElement('button', { className: 'fds-icon-btn', onClick: requestClose },
          React.createElement(Icon.X, { size: 16 })
        )
      ),
      React.createElement('div', { className: 'fds-modal-body' },
        React.createElement('p', {
          style: { fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, margin: '0 0 10px' }
        }, 'O Premium libera IA ilimitada (chat + Análise), lançamentos via WhatsApp e análises avançadas.'),
        React.createElement('p', {
          style: { fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0, fontWeight: 700 }
        }, 'R$ 89,90/ano — checkout em breve.')
      ),
      React.createElement('div', { className: 'fds-modal-foot', style: { justifyContent: 'flex-end' } },
        React.createElement('button', {
          className: 'fds-btn-primary',
          onClick: requestClose,
          style: { touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }
        },
          React.createElement(Icon.Check, { size: 13 }), ' Entendi'
        )
      )
    )
  );
}

// ─── Studio dashboard ─────────────────────────────────────────
function DashboardStudio({ onAdd, onNav }) {
  const { transactions, accounts, cards, goals, monthTransactions, prevMonthTransactions, virtualRecurringRevenue, categories, spendByCategory, budgetGroups, openCategoryModal, selectedMonth, monthLabel, prevMonth, isEmpty } = useFides();

  if (isEmpty) return (
    <div className="fds-page stu-page">
      <div className="fds-empty-state">
        <div className="fds-empty-state-icon">👋</div>
        <h2 className="fds-empty-state-title">Bem-vindo ao Fides!</h2>
        <p className="fds-empty-state-lede">
          Comece adicionando sua primeira conta para ver o resumo financeiro.
        </p>
        <button className="fds-empty-state-btn" onClick={() => onNav?.('contas')}>
          + Adicionar primeira conta
        </button>
      </div>
    </div>
  );
  const lbl = monthLabel(selectedMonth);
  const prevLbl = monthLabel(prevMonth(selectedMonth));

  // Live totals derived from current monthTransactions — aggregations excluem movimentações (is_transfer).
  const flow     = monthTransactions.filter(t => !t.isTransfer);
  const flowPrev = prevMonthTransactions.filter(t => !t.isTransfer);
  const receitas  = flow.filter(t => t.val > 0).reduce((s,t) => s + t.val, 0);
  const receitaVirtual = (virtualRecurringRevenue || []).reduce((s, t) => s + t.val, 0);
  const receitaTotal   = receitas + receitaVirtual;
  const despesas  = flow.filter(t => t.val < 0 && t.status === 'pago').reduce((s,t) => s + Math.abs(t.val), 0);
  const pendentes = flow.filter(t => t.val < 0 && t.status === 'pendente').reduce((s,t) => s + Math.abs(t.val), 0);
  const fluxoMensal = receitaTotal - despesas - pendentes;
  const pendCount = monthTransactions.filter(t => t.status === 'pendente').length;

  // Saldo projetado real: saldo das contas + pendentes a receber − pendentes a pagar
  const saldoContas = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const receitasPendentes = flow.filter(t => t.val > 0 && t.status === 'pendente').reduce((s, t) => s + t.val, 0);
  const despesasPendentes = flow.filter(t => t.val < 0 && t.status === 'pendente').reduce((s, t) => s + Math.abs(t.val), 0);
  const saldoProjetado = saldoContas + receitasPendentes - despesasPendentes;

  // Comparativo com mês anterior
  const prevReceitas = flowPrev.filter(t => t.val > 0).reduce((s,t) => s + t.val, 0);
  const prevDespesas = flowPrev.filter(t => t.val < 0).reduce((s,t) => s + Math.abs(t.val), 0);
  const prevSaldo = prevReceitas - prevDespesas;
  const deltaSaldo = fluxoMensal - prevSaldo;
  const deltaReceitas = receitas - prevReceitas;
  const deltaDespesas = (despesas + pendentes) - prevDespesas;

  const { int, dec } = splitBRL(Math.abs(saldoProjetado));
  const top5 = spendByCategory.slice(0, 5);
  const totalSpend = spendByCategory.reduce((s,d) => s + d.val, 0);

  // Metas: derivadas de goals reais (sem literais hardcoded)
  const metaGuardado = goals.reduce((s, g) => s + (g.atual || 0), 0);
  const metaAlvo     = goals.reduce((s, g) => s + (g.alvo  || 0), 0);
  const temMetas     = goals.length > 0 && metaAlvo > 0;

  // Série mensal real (últimos 7 meses até o mês selecionado) para os gráficos
  const MONTH_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const flowData = (() => {
    const [selY, selM] = selectedMonth.split('-').map(Number);
    return Array.from({ length: 7 }, (_, i) => {
      let mm = selM - (6 - i), yy = selY;
      while (mm <= 0) { mm += 12; yy -= 1; }
      const ym = `${yy}-${String(mm).padStart(2, '0')}`;
      const monthTxs = transactions.filter(t => t.mes === ym);
      const rec = monthTxs.filter(t => t.val > 0 && !t.isTransfer).reduce((s, t) => s + t.val, 0);
      const des = monthTxs.filter(t => t.val < 0 && !t.isTransfer).reduce((s, t) => s + Math.abs(t.val), 0);
      return { m: MONTH_LABELS[mm - 1], rec, des };
    });
  })();

  // Modo do gráfico de fluxo
  const [flowMode, setFlowMode] = React.useState('fluxo');

  // Donut: fatia ativa (tooltip no centro)
  const [activeSlice, setActiveSlice] = React.useState(null);
  const donutWrapRef = React.useRef(null);
  React.useEffect(() => {
    if (!activeSlice) return;
    const handler = (e) => {
      if (donutWrapRef.current && !donutWrapRef.current.contains(e.target)) {
        setActiveSlice(null);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [activeSlice]);

  // Salários do mês — destacar quando há vários (caso do usuário)
  const salarios = monthTransactions.filter(t => t.cat === 'salario');
  const salarioInfo = salarios.length > 1
    ? <>Você recebe <strong className="stu-num">{salarios.length} salários</strong> em {lbl.long.split(' de ')[0]} — um em {salarios[salarios.length-1].d.split('/')[0]} e outro em {salarios[0].d.split('/')[0]}.</>
    : null;

  // Recent list (sorted: new first, then by date desc — mocks are already date-desc)
  const recent = monthTransactions.slice(0, 8);
  const empty = monthTransactions.length === 0;

  // ── Empty state: mês sem lançamentos ──────────────────────────
  if (empty) return (
    <div className="fds-page stu-page">
      <div className="fds-empty-state">
        <div className="fds-empty-state-icon">📋</div>
        <h2 className="fds-empty-state-title">
          {lbl.long.split(' de ')[0]} ainda não tem lançamentos
        </h2>
        <p className="fds-empty-state-lede">
          Adicione sua primeira receita ou despesa para ver o resumo do mês.
        </p>
        <button className="fds-empty-state-btn" onClick={onAdd}>
          + Adicionar lançamento
        </button>
      </div>
    </div>
  );

  return (
    <div className="fds-page stu-page">
      {/* ─── Editorial hero — via EditorialHero ─── */}
      {/* empty === false aqui: o early return acima já tratou o mês vazio */}
      <EditorialHero
        eyebrow={<><span className="fds-pulse-dot"/> {monthTransactions.length} lançamentos · {lbl.long}</>}
        headline={<>
          {saldoProjetado >= 0 ? 'Você terminará' : 'Você fechará'} {lbl.long.split(' de ')[0]} com{' '}
          <span className="stu-hero-amt" style={{ color: saldoProjetado < 0 ? 'var(--bad)' : 'var(--accent)' }}>
            <span className="cur">{saldoProjetado < 0 ? '−R$' : 'R$'}</span>
            <span className="int">{int}</span>
            <span className="dec">,{dec}</span>
          </span>{' '}
          {saldoProjetado >= 0 ? 'livre' : 'no vermelho'}.
        </>}
        lede={<>
          Chegam <strong className="stu-num">{fmtBRL(receitaTotal, { compact: true })}</strong> em receitas. {salarioInfo}
          {' '}Saem <strong className="stu-num">{fmtBRL(despesas + pendentes, { compact: true })}</strong> em despesas previstas, sendo{' '}
          <em>{fmtBRL(pendentes)} ainda em aberto</em>.
          {fluxoMensal < 0 && saldoProjetado >= 0 && <>{' '}Apesar do saldo positivo, o fluxo do mês é negativo (<strong className="stu-num" style={{ color: 'var(--bad)' }}>−{fmtBRL(Math.abs(fluxoMensal))}</strong>).</>}
          {prevReceitas > 0 && <> {prevLbl.long.split(' de ')[0]} fechou em <strong className="stu-num">{fmtBRL(prevSaldo, { compact: true })}</strong> — você está{' '}
            <span className="stu-pos">{deltaSaldo >= 0 ? '+' : '−'}{fmtBRL(Math.abs(deltaSaldo), { compact: true })}</span> em relação ao mês passado.</>}
        </>}
        notice={receitaTotal === 0 ? (
          <div className="pln-revenue-hint">
            <p>
              💡 Registre suas receitas recorrentes (salário, plantão, freelance)
              marcando "Repetir mensalmente". Assim a projeção fica realista.
            </p>
          </div>
        ) : null}
        metrics={[
          {
            label: 'Receitas',
            value: `+${fmtBRL(receitaTotal)}`,
            accent: true,
            sub: prevReceitas > 0 ? (
              <div className="stu-metric-tag" style={{ color: deltaReceitas >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
                {deltaReceitas >= 0 ? <Icon.ArrowUp size={11}/> : <Icon.ArrowDown size={11}/>}
                {fmtBRL(Math.abs(deltaReceitas))} vs. mês passado
              </div>
            ) : null,
          },
          {
            label: 'Despesas pagas',
            value: `−${fmtBRL(despesas)}`,
            sub: prevDespesas > 0 ? (
              <div className="stu-metric-tag" style={{ color: deltaDespesas <= 0 ? 'var(--ok)' : 'var(--warn)' }}>
                {deltaDespesas <= 0 ? <Icon.ArrowDown size={11}/> : <Icon.ArrowUp size={11}/>}
                {fmtBRL(Math.abs(deltaDespesas))} vs. mês passado
              </div>
            ) : null,
          },
          {
            label: 'Em aberto',
            value: `−${fmtBRL(pendentes)}`,
            warn: true,
            sub: <div className="stu-metric-tag"><Icon.Clock size={11}/> {pendCount} {pendCount === 1 ? 'item' : 'itens'}</div>,
          },
          ...(temMetas ? [{
            label: 'Meta poupança',
            value: <>{fmtBRL(metaGuardado)} <span className="stu-metric-of">/ {fmtBRL(metaAlvo)}</span></>,
            sub: <ProgressBar value={metaAlvo ? metaGuardado / metaAlvo : 0} tint="var(--accent)" glow/>,
          }] : []),
        ]}
      />

      {/* ─── Capítulo I · Fluxo do mês ─── */}
      <ChapterMark roman="I" title="Fluxo do mês" caption={`Receitas vs. despesas · últimos 7 meses · ${selectedMonth.split('-')[0]}`}/>
      <div className="stu-card stu-flow">
        <div className="stu-flow-head">
          <div className="fds-legend">
            <span className="lg"><span className="dot" style={{ background: 'var(--accent)' }}/>Receitas <span className="lg-v">{fmtBRL(receitas)}</span></span>
            <span className="lg"><span className="dot" style={{ background: '#0F172A', opacity: 0.55 }}/>Despesas <span className="lg-v">{fmtBRL(despesas)}</span></span>
            <span className="lg lg-future"><span className="dot"/>Projeção</span>
          </div>
          <div className="fds-tabs">
            {[
              { id: 'fluxo',     label: 'Fluxo'          },
              { id: 'acumulado', label: 'Saldo acumulado' },
              { id: 'categoria', label: 'Por categoria'   },
            ].map(t => (
              <button
                key={t.id}
                className={flowMode === t.id ? 'on' : ''}
                onClick={() => setFlowMode(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {flowMode === 'fluxo' && (
          <AreaChart data={flowData} height={240} accent="var(--accent)" glow/>
        )}
        {flowMode === 'acumulado' && (
          <AccumulatedChart data={flowData} height={240} accent="var(--accent)"/>
        )}
        {flowMode === 'categoria' && (
          <CategoryChart data={spendByCategory} height={240}/>
        )}
      </div>

      {/* ─── Capítulo II · Para onde foi ─── */}
      <ChapterMark roman="II" title="Para onde foi"
                   caption={`${fmtBRL(totalSpend)} distribuídos em maio`}
                   action={<button className="stu-link" onClick={openCategoryModal}><Icon.Settings size={12}/> Categorias</button>}/>
      <div className="stu-2col">
        <div className="stu-card stu-cats">
          <div className="stu-cats-body">
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
              const hasLimit = g.limit != null;
              const pct = hasLimit ? g.spent / g.limit : null;
              const over = hasLimit && pct > 1;
              const tint = g.id === 'essencial' ? 'var(--ok)' : g.id === 'estilo' ? 'var(--info)' : 'var(--bad)';
              return (
                <div className="stu-budget-row" key={g.id}>
                  <div className="stu-budget-row-h">
                    <span className="fds-cat-dot" style={{ background: tint }}/>
                    <span className="stu-budget-lbl">{g.label}</span>
                    <span className="stu-budget-target">{Math.round(g.target*100)}%</span>
                    <span className={`fds-budget-pct ${hasLimit ? (over ? 'over' : pct > 0.85 ? 'near' : 'ok') : ''}`}>
                      {hasLimit ? `${Math.round(pct*100)}%` : 'Sem limite'}
                    </span>
                  </div>
                  <ProgressBar value={pct != null ? pct : 0} tint={tint} glow/>
                  <div className="stu-budget-meta">
                    <span><strong>{fmtBRL(g.spent)}</strong></span>
                    <span className="fds-muted">{hasLimit ? `limite ${fmtBRL(g.limit)}` : 'sem limite definido'}</span>
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
            const a = accounts.find(x => x.id === t.acct) || cards.find(x => x.id === t.acct);
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
                   caption={`${accounts.length} ${accounts.length === 1 ? 'conta conectada' : 'contas conectadas'} · ${cards.length} ${cards.length === 1 ? 'cartão aberto' : 'cartões abertos'}`}
                   action={<button className="stu-link" onClick={() => onNav?.('contas')}>Ver tudo <Icon.Right size={12}/></button>}/>
      {accounts.length === 0 && cards.length === 0 ? (
        <div className="fds-empty-state">
          <div className="fds-empty-state-icon">🏦</div>
          <h2 className="fds-empty-state-title">Nenhuma conta ou cartão ainda</h2>
          <p className="fds-empty-state-lede">
            Adicione sua primeira conta para acompanhar saldos e faturas por aqui.
          </p>
          <button className="fds-empty-state-btn" onClick={() => onNav?.('contas')}>
            + Adicionar primeira conta
          </button>
        </div>
      ) : (
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
            <Sparkline values={[a.balance, a.balance]} width={180} height={32} accent="var(--accent)" glow fill={false}/>
          </div>
        ))}
        {cards.map(c => {
          const pct = c.limit ? c.used / c.limit : 0;
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
      )}
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

Object.assign(window, { FidesStudio, DashboardStudio, TransacoesStudio, StudioStub, StudioMark, StudioLogo, ChapterMark, EditorialHero });
