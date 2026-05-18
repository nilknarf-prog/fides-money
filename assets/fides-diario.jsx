// fides-diario.jsx — "Diário" signature layout
// Single-column editorial / narrative dashboard. No sidebar, no KPI tile grid.
// Reads top-to-bottom like a financial newsletter for one person.

function FidesDiario({ variant = 'diario' }) {
  const receitas = 8748.66;
  const despesas = 5832.72;
  const pendentes = 2070.61;
  const saldoFinal = receitas - (despesas + pendentes);   // R$ 845.33
  const totalGroups = BUDGET_GROUPS.reduce((s,g)=>s+g.spent,0);

  // Group transactions by day for the "Movimento" section
  const byDay = {};
  TRANSACTIONS.forEach(t => { (byDay[t.d] ||= []).push(t); });
  const days = Object.keys(byDay).sort((a,b) => b.localeCompare(a)).slice(0, 6);

  return (
    <div className="fds-app fds-diario" data-variant="diario">
      {/* Floating top rail — minimal, no sidebar */}
      <header className="dia-rail">
        <div className="dia-rail-l">
          <FidesLogo size={26} variant="v1"/>
        </div>
        <nav className="dia-rail-nav">
          <button className="on">Diário</button>
          <button>Transações</button>
          <button>Orçamento</button>
          <button>Contas</button>
          <button>Dívidas</button>
          <button>Metas</button>
        </nav>
        <div className="dia-rail-r">
          <button className="dia-rail-icon" title="Buscar">
            <Icon.Search size={15}/>
            <kbd className="fds-kbd">⌘K</kbd>
          </button>
          <button className="dia-rail-icon"><Icon.Bell size={15}/></button>
          <button className="dia-rail-cta">
            <Icon.Plus size={14}/> Lançar
          </button>
        </div>
      </header>

      <article className="dia-page">

        {/* MASTHEAD */}
        <div className="dia-mast">
          <div className="dia-eyebrow">
            <span>Edição de Maio</span>
            <span className="dia-eyebrow-sep"/>
            <span>2026 · semana 20</span>
            <span className="dia-eyebrow-sep"/>
            <span className="dia-issue">№ 05</span>
          </div>
          <h1 className="dia-headline">
            Você terminará Maio com{' '}
            <span className="dia-headline-num">R$&nbsp;845</span> livre.
          </h1>
          <p className="dia-lede">
            Chegam <strong>R$&nbsp;8.748</strong> em receitas até o dia 30. Saem{' '}
            <strong>R$&nbsp;7.903</strong> em despesas previstas — sendo{' '}
            <em>R$&nbsp;2.070 ainda em aberto</em>, vencendo nos próximos 14 dias.
            Abril fechou em R$&nbsp;1.858; você está{' '}
            <span className="dia-pos">R$&nbsp;845 acima</span>{' '}
            do mês passado e <span className="dia-pos">12% acima</span> da meta do trimestre.
          </p>
          <div className="dia-byline">
            <div className="dia-byline-l">
              <div className="dia-byline-avatar">{USER.initials}</div>
              <div>
                <div className="dia-byline-name">{USER.name}</div>
                <div className="dia-byline-sub">Atualizado às 09:42 · 14 mai 2026</div>
              </div>
            </div>
            <button className="dia-byline-act"><Icon.Eye size={13}/> Ocultar valores</button>
          </div>
        </div>

        {/* TODAY — pulse strip */}
        <section className="dia-section dia-today">
          <SectionMark label="Hoje · 14 mai"/>
          <div className="dia-today-list">
            <div className="dia-event">
              <span className="dia-event-time">em 16 dias</span>
              <span className="dia-event-dot" style={{ background: 'var(--ok)' }}/>
              <span className="dia-event-desc">Salário <strong>PMAM</strong> deve cair na conta Bradesco</span>
              <span className="dia-event-amt pos">+R$&nbsp;5.417,00</span>
            </div>
            <div className="dia-event">
              <span className="dia-event-time">em 1 dia</span>
              <span className="dia-event-dot" style={{ background: 'var(--warn)' }}/>
              <span className="dia-event-desc"><strong>Claro</strong> vence amanhã, débito automático</span>
              <span className="dia-event-amt neg">−R$&nbsp;123,62</span>
            </div>
            <div className="dia-event">
              <span className="dia-event-time">pendente</span>
              <span className="dia-event-dot" style={{ background: 'var(--bad)' }}/>
              <span className="dia-event-desc"><strong>Mercado Atacadão</strong> ainda não conciliado · Bradesco</span>
              <span className="dia-event-amt neg">−R$&nbsp;143,08</span>
            </div>
            <div className="dia-event">
              <span className="dia-event-time">em 4 dias</span>
              <span className="dia-event-dot" style={{ background: 'var(--bad)' }}/>
              <span className="dia-event-desc"><strong>Renegociação Ádria</strong> — parcela 1 de 47</span>
              <span className="dia-event-amt neg">−R$&nbsp;302,32</span>
            </div>
          </div>
        </section>

        {/* CHAPTER I — Movement */}
        <section className="dia-section">
          <SectionMark label="Capítulo I · O movimento"/>
          <p className="dia-prose">
            Nos últimos sete meses entraram <strong className="dia-num">R$&nbsp;58.638</strong> e
            saíram <strong className="dia-num">R$&nbsp;44.270</strong> — uma sobra média de{' '}
            <strong className="dia-num">R$&nbsp;2.052</strong> ao mês. Em Maio, especificamente,
            você gastou menos que a média móvel pela primeira vez no ano.
          </p>
          <div className="dia-chart">
            <AreaChart data={MONTHLY} height={220} accent="var(--accent)" glow/>
          </div>
        </section>

        {/* CHAPTER II — Where it went */}
        <section className="dia-section">
          <SectionMark label="Capítulo II · Para onde foi"/>
          <p className="dia-prose">
            Metade do mês foi para o <strong>essencial</strong> — mercado (
            <DiaCatChip cat="mercado"/>), combustível (<DiaCatChip cat="combustivel"/>) e contas fixas.
            Apenas <strong className="dia-num">12%</strong> em <strong>estilo de vida</strong>{' '}
            (compras, lazer, assinaturas), bem abaixo dos 30% que você se propõe.
            E <strong className="dia-num">124%</strong> em <strong>dívidas</strong>{' '}
            — <em>acima do limite</em>: a renegociação da Ádria pesa.
          </p>
          <div className="dia-budget">
            {BUDGET_GROUPS.map(g => {
              const pct = g.spent / g.limit;
              const over = pct > 1;
              const tint = g.id === 'essencial' ? 'var(--ok)'
                         : g.id === 'estilo'    ? 'var(--info)'
                         : 'var(--bad)';
              return (
                <div className="dia-budget-row" key={g.id}>
                  <div className="dia-budget-name">
                    <span>{g.label}</span>
                    <span className="dia-budget-target">{Math.round(g.target*100)}% planejado</span>
                  </div>
                  <div className="dia-budget-track">
                    <div className="dia-budget-fill" style={{
                      width: `${Math.min(100, pct*100)}%`,
                      background: tint,
                    }}/>
                    {over && (
                      <div className="dia-budget-over" style={{
                        width: `${Math.min(40, (pct-1)*100)}%`,
                        background: tint,
                        right: 0
                      }}/>
                    )}
                  </div>
                  <div className="dia-budget-meta">
                    <span className="dia-num"><strong>{fmtBRL(g.spent)}</strong></span>
                    <span className="fds-muted"> de {fmtBRL(g.limit)}</span>
                    <span className={`dia-budget-pct ${over?'over':pct>0.85?'near':'ok'}`}>
                      {Math.round(pct*100)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* CHAPTER III — Recent transactions, by day */}
        <section className="dia-section">
          <SectionMark label="Capítulo III · Movimento recente"/>
          <div className="dia-ledger">
            {days.map(d => {
              const items = byDay[d];
              const total = items.reduce((s,t) => s + t.val, 0);
              const day = d.split('/')[0];
              const month = ['','jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][parseInt(d.split('/')[1])];
              return (
                <div className="dia-day" key={d}>
                  <div className="dia-day-h">
                    <div className="dia-day-date">
                      <span className="dia-day-num">{day}</span>
                      <span className="dia-day-mo">{month}</span>
                    </div>
                    <div className="dia-day-spine"/>
                    <div className="dia-day-sum">
                      saldo do dia
                      <span className={total >= 0 ? 'pos' : 'neg'}>
                        {total >= 0 ? '+' : '−'}R$&nbsp;{Math.abs(total).toLocaleString('pt-BR', {minimumFractionDigits:2})}
                      </span>
                    </div>
                  </div>
                  <div className="dia-day-list">
                    {items.map((t, i) => {
                      const c = CATEGORIES[t.cat];
                      const a = ACCOUNTS.find(x => x.id === t.acct);
                      const neg = t.val < 0;
                      return (
                        <div className="dia-tx" key={i}>
                          <span className="dia-tx-dot" style={{ background: c.tint }}/>
                          <div className="dia-tx-main">
                            <div className="dia-tx-desc">{t.desc}</div>
                            <div className="dia-tx-meta">
                              {c.label} · {a.name}
                              {t.recur && <span className="dia-tx-tag">recorrente</span>}
                              {t.status === 'pendente' && <span className="dia-tx-tag warn">pendente</span>}
                            </div>
                          </div>
                          <div className={`dia-tx-amt ${neg ? 'neg' : 'pos'}`}>
                            {neg ? '−' : '+'}R$&nbsp;{Math.abs(t.val).toLocaleString('pt-BR', {minimumFractionDigits:2})}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <button className="dia-more">Ver as 68 transações de Maio →</button>
        </section>

        {/* COLOPHON */}
        <footer className="dia-colophon">
          <div>Fides · um diário financeiro</div>
          <div>{USER.name} · Maio · 2026</div>
        </footer>
      </article>
    </div>
  );
}

// Reusable section marker — small caps eyebrow with a hairline
function SectionMark({ label }) {
  return (
    <div className="dia-section-mark">
      <span className="dia-section-rule"/>
      <span className="dia-section-label">{label}</span>
      <span className="dia-section-rule"/>
    </div>
  );
}

// Inline category chip used inside prose
function DiaCatChip({ cat }) {
  const c = CATEGORIES[cat];
  return (
    <span className="dia-cat-chip">
      <span className="fds-cat-dot" style={{ background: c.tint }}/>
      {c.label}
    </span>
  );
}

Object.assign(window, { FidesDiario });
