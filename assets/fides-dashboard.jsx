// fides-dashboard.jsx — Dashboard / Visão geral

function Dashboard({ variant, onAdd }) {
  // KPIs derived
  const receitas = 8748.66;
  const despesas = 5832.72;
  const pendentes = 2070.61;
  const saldo = receitas - despesas;
  const saldoAcumulado = 6810.86;

  return (
    <div className="fds-page">
      {/* ───────── HERO ───────── */}
      <section className="fds-hero">
        <div className="fds-hero-main">
          <div className="fds-hero-eyebrow">
            <span className="fds-pulse-dot"/>
            Mai · 2026 · em curso
          </div>
          <HeroAmount value={saldoAcumulado} variant={variant}/>
          <div className="fds-hero-meta">
            <span className="fds-delta up">
              <Icon.ArrowUp size={12}/> {fmtPct(12.4)}
            </span>
            <span className="fds-muted">vs. abril</span>
            <span className="fds-divider"/>
            <span className="fds-muted">Projeção fim do mês</span>
            <span className="fds-strong">{fmtBRL(7920)}</span>
          </div>
          <div className="fds-hero-spark">
            <Sparkline
              values={MONTHLY.filter(m => !m.future).map(m => m.rec - m.des)}
              width={520} height={68}
              accent="var(--accent)"
              glow={variant === 'v3'}/>
            <div className="fds-spark-axis">
              {MONTHLY.filter(m => !m.future).map((m, i) => (
                <span key={i}>{m.m.toLowerCase()}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="fds-hero-kpis">
          <KpiTile label="Receitas"  value={receitas} delta={+8.2} tint="emerald" variant={variant} spark={[12,18,15,21,19,24,28]}/>
          <KpiTile label="Despesas"  value={-despesas} delta={-6.3} tint="rose"  variant={variant} spark={[24,18,21,15,17,19,18]}/>
          <KpiTile label="Pendentes" value={-pendentes} delta={null} tint="amber" variant={variant} kind="pending"/>
          <KpiTile label="Meta poupança" value={1560} delta={null} tint="indigo" variant={variant} kind="goal" goal={{ used: 668, total: 1560 }}/>
        </div>
      </section>

      {/* ───────── FLUXO MENSAL ───────── */}
      <section className="fds-card fds-flow">
        <header className="fds-card-head">
          <div>
            <h3 className="fds-h3">Fluxo mensal</h3>
            <p className="fds-card-sub">Receitas vs. despesas · últimos 7 meses</p>
          </div>
          <div className="fds-tabs">
            <button className="on">Fluxo</button>
            <button>Saldo acumulado</button>
            <button>Categoria</button>
          </div>
          <div className="fds-period">
            <span>2026</span>
            <Icon.Down size={13} style={{ opacity: 0.45 }}/>
          </div>
        </header>
        <div className="fds-legend">
          <span className="lg"><span className="dot" style={{ background: 'var(--accent)' }}/>Receitas <span className="lg-v">{fmtBRL(receitas)}</span></span>
          <span className="lg"><span className="dot" style={{ background: '#0F172A', opacity: 0.55 }}/>Despesas <span className="lg-v">{fmtBRL(despesas)}</span></span>
          <span className="lg lg-future"><span className="dot"/>Projeção</span>
        </div>
        <AreaChart data={MONTHLY} height={260} accent="var(--accent)" glow={variant === 'v3'}/>
      </section>

      {/* ───────── 3-COL: Categorias | Recentes | Orçamento ───────── */}
      <section className="fds-grid-3">
        <CategoriesCard variant={variant}/>
        <RecentCard/>
        <BudgetCard variant={variant}/>
      </section>

      {/* ───────── Contas & cartões ───────── */}
      <section className="fds-grid-accounts">
        <div className="fds-card fds-accounts">
          <header className="fds-card-head">
            <div>
              <h3 className="fds-h3">Contas</h3>
              <p className="fds-card-sub">3 contas conectadas</p>
            </div>
            <button className="fds-link">Gerenciar <Icon.Right size={13}/></button>
          </header>
          <div className="fds-account-list">
            {ACCOUNTS.map(a => (
              <div className="fds-account" key={a.id}>
                <div className="fds-account-mark" style={{ background: a.color }}>
                  <Icon.Bank size={14}/>
                </div>
                <div className="fds-account-meta">
                  <div className="fds-account-name">{a.name}</div>
                  <div className="fds-account-tag">•• {a.tag} · {a.type}</div>
                </div>
                <div className="fds-account-bal">
                  <div>{fmtBRL(a.balance)}</div>
                  <Sparkline values={[3,4,3.5,4.2,5,4.7,5.3]} width={64} height={20} accent="var(--accent)" fill={false}/>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="fds-card fds-cards">
          <header className="fds-card-head">
            <div>
              <h3 className="fds-h3">Cartões</h3>
              <p className="fds-card-sub">Fatura em aberto</p>
            </div>
            <button className="fds-link">Faturas <Icon.Right size={13}/></button>
          </header>
          <div className="fds-card-list">
            {CARDS.map(c => {
              const pct = c.used / c.limit;
              return (
                <div className="fds-cc" key={c.id}>
                  <div className="fds-cc-head">
                    <div className="fds-cc-mark"><Icon.Card size={14}/></div>
                    <div className="fds-cc-name">{c.name}</div>
                    <div className="fds-cc-tag">{c.tag}</div>
                  </div>
                  <div className="fds-cc-amount">{fmtBRL(c.used)}</div>
                  <ProgressBar value={pct} tint="var(--accent)" glow={variant === 'v3'}/>
                  <div className="fds-cc-meta">
                    <span>{(pct*100).toFixed(0)}% de R$ {c.limit.toLocaleString('pt-BR')}</span>
                    <span>Vence {c.due}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Hero amount — variant-specific typography ────────────────
function HeroAmount({ value, variant }) {
  const { sign, currency, int, dec } = splitBRL(value);
  if (variant === 'v1') {
    return (
      <div className="fds-hero-amount v1">
        <span className="cur">{currency}</span>
        <span className="int">{sign}{int}</span>
        <span className="dec">,{dec}</span>
      </div>
    );
  }
  if (variant === 'v3') {
    return (
      <div className="fds-hero-amount v3">
        <span className="cur">{currency}</span>
        <span className="int">{sign}{int}</span>
        <span className="dec">.{dec}</span>
      </div>
    );
  }
  return (
    <div className="fds-hero-amount v2">
      <span className="cur">{currency}</span>
      <span className="int">{sign}{int}</span>
      <span className="dec">,{dec}</span>
    </div>
  );
}

// ─── KPI tile ─────────────────────────────────────────────────
function KpiTile({ label, value, delta, tint, variant, spark, kind, goal }) {
  const tintMap = {
    emerald: 'var(--ok)',
    rose:    'var(--bad)',
    amber:   'var(--warn)',
    indigo:  'var(--info)',
  };
  const tintColor = tintMap[tint] || 'var(--accent)';
  return (
    <div className="fds-kpi">
      <div className="fds-kpi-head">
        <span className="fds-kpi-label">{label}</span>
        {delta != null && (
          <span className={`fds-kpi-delta ${delta >= 0 ? 'up' : 'down'}`}>
            {delta >= 0 ? <Icon.ArrowUp size={11}/> : <Icon.ArrowDown size={11}/>}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {kind === 'pending' && <span className="fds-tag warn"><Icon.Clock size={11}/> 4 itens</span>}
        {kind === 'goal' && <span className="fds-tag info">43% atingida</span>}
      </div>
      <div className="fds-kpi-amount" style={{ color: value < 0 ? 'var(--bad)' : 'var(--ink)' }}>
        {fmtBRL(value)}
      </div>
      {spark && (
        <div className="fds-kpi-spark">
          <Sparkline values={spark} width={140} height={32} accent={tintColor} glow={variant === 'v3'}/>
        </div>
      )}
      {kind === 'goal' && (
        <div className="fds-kpi-goal">
          <ProgressBar value={goal.used / goal.total} tint={tintColor} glow={variant === 'v3'}/>
          <div className="fds-kpi-goal-meta">
            <span>{fmtBRL(goal.used)} de {fmtBRL(goal.total)}</span>
          </div>
        </div>
      )}
      {kind === 'pending' && (
        <div className="fds-kpi-pending">
          <div className="fds-pending-list">
            <span className="dot" style={{ background: 'var(--warn)' }}/>
            <span>Salário PMAM</span>
            <span className="amt">+{fmtBRL(5417).replace('R$\u00a0','')}</span>
          </div>
          <div className="fds-pending-list">
            <span className="dot" style={{ background: 'var(--bad)' }}/>
            <span>Mercado · Bradesco</span>
            <span className="amt neg">−{fmtBRL(143.08).replace('R$\u00a0','')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Categories card (donut) ──────────────────────────────────
function CategoriesCard({ variant }) {
  const top5 = SPEND_BY_CATEGORY.slice(0, 5);
  const total = SPEND_BY_CATEGORY.reduce((s, d) => s + d.val, 0);
  return (
    <div className="fds-card fds-cats">
      <header className="fds-card-head">
        <div>
          <h3 className="fds-h3">Gastos por categoria</h3>
          <p className="fds-card-sub">{fmtBRL(total)} em maio</p>
        </div>
        <button className="fds-link">Ver tudo <Icon.Right size={13}/></button>
      </header>
      <div className="fds-cats-body">
        <div className="fds-donut-wrap">
          <Donut data={SPEND_BY_CATEGORY} size={172} thickness={22} glow={variant === 'v3'}/>
          <div className="fds-donut-center">
            <div className="fds-donut-label">Total</div>
            <div className="fds-donut-value">{fmtBRL(total, { compact: true })}</div>
          </div>
        </div>
        <div className="fds-cats-list">
          {top5.map((c) => (
            <div className="fds-cat-row" key={c.key}>
              <span className="fds-cat-dot" style={{ background: c.tint }}/>
              <span className="fds-cat-lbl">{c.label}</span>
              <span className="fds-cat-pct">{((c.val/total)*100).toFixed(0)}%</span>
              <span className="fds-cat-val">{fmtBRL(c.val)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Recent transactions card ─────────────────────────────────
function RecentCard() {
  const recent = TRANSACTIONS.slice(0, 6);
  return (
    <div className="fds-card fds-recent">
      <header className="fds-card-head">
        <div>
          <h3 className="fds-h3">Transações recentes</h3>
          <p className="fds-card-sub">Atualizado agora</p>
        </div>
        <button className="fds-link">Todas <Icon.Right size={13}/></button>
      </header>
      <div className="fds-recent-list">
        {recent.map((t, i) => {
          const c = CATEGORIES[t.cat];
          const neg = t.val < 0;
          return (
            <div className="fds-recent-row" key={i}>
              <div className="fds-recent-mark" style={{ background: c.tint + '22', color: c.tint }}>
                {t.desc[0]}
              </div>
              <div className="fds-recent-meta">
                <div className="fds-recent-desc">{t.desc}</div>
                <div className="fds-recent-sub">
                  {t.d}
                  <span className="fds-bullet">·</span>
                  {c.label}
                  {t.status === 'pendente' && <span className="fds-mini-tag warn">pendente</span>}
                </div>
              </div>
              <div className={`fds-recent-amt ${neg ? 'neg' : 'pos'}`}>
                {neg ? '−' : '+'}R$ {Math.abs(t.val).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Budget summary card ──────────────────────────────────────
function BudgetCard({ variant }) {
  const totalLimit = BUDGET_GROUPS.reduce((s, g) => s + g.limit, 0);
  const totalSpent = BUDGET_GROUPS.reduce((s, g) => s + g.spent, 0);
  return (
    <div className="fds-card fds-budget">
      <header className="fds-card-head">
        <div>
          <h3 className="fds-h3">Orçamento 50 · 30 · 20</h3>
          <p className="fds-card-sub">{fmtBRL(totalSpent)} de {fmtBRL(totalLimit)}</p>
        </div>
        <button className="fds-link">Editar <Icon.Right size={13}/></button>
      </header>
      <div className="fds-budget-bar">
        <BudgetBar segments={BUDGET_GROUPS.map(g => ({ target: g.target, spent: g.spent, limit: g.limit, tint: groupTint(g.id) }))}/>
      </div>
      <div className="fds-budget-list">
        {BUDGET_GROUPS.map(g => {
          const pct = g.spent / g.limit;
          const over = pct > 1;
          return (
            <div className="fds-budget-row" key={g.id}>
              <div className="fds-budget-row-head">
                <span className="fds-cat-dot" style={{ background: groupTint(g.id) }}/>
                <span className="fds-budget-lbl">{g.label}</span>
                <span className={`fds-budget-pct ${over ? 'over' : pct > 0.85 ? 'near' : 'ok'}`}>
                  {Math.round(pct * 100)}%
                </span>
              </div>
              <ProgressBar value={pct} tint={groupTint(g.id)} glow={variant === 'v3'}/>
              <div className="fds-budget-meta">
                <span>{fmtBRL(g.spent)}</span>
                <span className="fds-muted">limite {fmtBRL(g.limit)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function groupTint(id) {
  return id === 'essencial' ? 'var(--ok)' : id === 'estilo' ? 'var(--info)' : 'var(--bad)';
}

Object.assign(window, { Dashboard });
