// fides-orcamento.jsx — Studio budget page (50·30·20 + per-category)
//
// Editorial idiom: hero headline + Roman-numeral chapters + inline-edit planned values
// Reuses ProgressBar from fides-charts, tokens from fides-studio.css

function OrcamentoStudio({ onAdd }) {
  const { transactions, categories, budgetGroups, plannedOverrides, setPlanned, openCategoryModal, selectedMonth, monthLabel } = useFides();
  const lbl = monthLabel(selectedMonth);
  const [showHelp, setShowHelp] = React.useState(false);

  // ─── Totals across all 50·30·20 groups ────────────────────
  const totals = budgetGroups.reduce((acc, g) => {
    acc.planned += g.limit;
    acc.spent   += g.spent;
    return acc;
  }, { planned: 0, spent: 0 });
  const pctSpent = totals.planned ? totals.spent / totals.planned : 0;
  const sobra = totals.planned - totals.spent;
  const hasSpend = totals.spent > 0; // false → Capítulo II mostra empty state
  // crude projection: current burn extrapolated to end of month
  const dayOfMonth = 16, daysInMonth = 31;
  const projecaoFinal = totals.spent * (daysInMonth / dayOfMonth);
  const sobraProjetada = totals.planned - projecaoFinal;
  const { int, dec } = splitBRL(totals.planned);

  const [editing, setEditing] = React.useState(null);
  const [expanded, setExpanded] = React.useState(null);
  const [collapsedGroups, setCollapsedGroups] = React.useState({});
  const toggleGroup = (groupId) => setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));

  // ─── 6-month planned vs real (fabricated stable history) ──
  const history = [
    { m: 'Dez', plan: 8200, real: 7820 },
    { m: 'Jan', plan: 8400, real: 8410 },
    { m: 'Fev', plan: 8500, real: 7912 },
    { m: 'Mar', plan: 8600, real: 9104 },
    { m: 'Abr', plan: 8700, real: 8290 },
    { m: 'Mai', plan: Math.max(totals.planned, 8700), real: totals.spent, partial: true },
  ];

  return (
    <div className="fds-page stu-page" data-od-id="orcamento">
      {/* ─── Editorial hero ─── */}
      <section className="stu-hero" data-od-id="orc-hero">
        <div className="stu-hero-eyebrow">
          <Icon.Pie size={11}/>
          planejamento · 50·30·20 · {lbl.long}
        </div>
        <h2 className="stu-hero-headline">
          Você planejou{' '}
          <span className="stu-hero-amt">
            <span className="cur">R$</span>
            <span className="int">{int}</span>
            <span className="dec">,{dec}</span>
          </span>{' '}
          em {lbl.long.split(' de ')[0]}.
        </h2>
        <p className="stu-hero-lede">
          Até hoje, comprometeu <strong className="stu-num">R$&nbsp;{totals.spent.toLocaleString('pt-BR',{minimumFractionDigits:2})}</strong> — {(pctSpent*100).toFixed(0)}% do total. No ritmo atual, fechará Maio em <strong className="stu-num">R$&nbsp;{Math.round(projecaoFinal).toLocaleString('pt-BR')}</strong>, sobrando <span className="stu-pos">R$&nbsp;{Math.round(sobraProjetada).toLocaleString('pt-BR')}</span>. <em>Dívidas estouraram 25% acima do limite</em> — Ádria pesa.
        </p>

        <div className="stu-hero-strip" data-od-id="orc-hero-strip">
          <div className="stu-metric">
            <div className="stu-metric-lbl">Planejado</div>
            <div className="stu-metric-val">{fmtBRL(totals.planned)}</div>
            <div className="stu-metric-tag" style={{ color: 'var(--muted)' }}>
              <Icon.Tag size={11}/> 12 categorias
            </div>
          </div>
          <div className="stu-metric-sep"/>
          <div className="stu-metric">
            <div className="stu-metric-lbl">Comprometido</div>
            <div className="stu-metric-val">−{fmtBRL(totals.spent).replace('R$\u00a0','R$\u00a0')}</div>
            <ProgressBar value={pctSpent} tint="var(--accent)" glow/>
          </div>
          <div className="stu-metric-sep"/>
          <div className="stu-metric">
            <div className="stu-metric-lbl">Restante</div>
            <div className="stu-metric-val pos">{fmtBRL(sobra)}</div>
            <div className="stu-metric-tag" style={{ color: 'var(--muted)' }}>
              <Icon.Clock size={11}/> 15 dias até o fim
            </div>
          </div>
          <div className="stu-metric-sep"/>
          <div className="stu-metric">
            <div className="stu-metric-lbl">Projeção fim de mês</div>
            <div className="stu-metric-val warn">{fmtBRL(projecaoFinal)}</div>
            <div className="stu-metric-tag">
              <Icon.TrendUp size={11}/> ~{((projecaoFinal/totals.planned)*100 - 100).toFixed(0)}% do plano
            </div>
          </div>
        </div>
      </section>

      {/* ─── Info: como o crédito conta no Planejamento ─── */}
      <div className={`pln-info-banner${showHelp ? ' expanded' : ''}`} data-od-id="orc-info-banner">
        <div className="pln-info-icon"><Icon.Sparkles size={16}/></div>
        <div className="pln-info-body">
          <div className="pln-info-title">
            Gastos no cartão contam no <strong>mês da compra</strong>
            <button className="pln-info-toggle" onClick={() => setShowHelp(v => !v)}>
              {showHelp ? 'Entendi' : 'Por quê?'} <Icon.Down size={12} style={{ transform: showHelp ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }}/>
            </button>
          </div>
          {showHelp && (
            <div className="pln-info-desc">
              Diferente de outros apps, o Fides contabiliza compras de crédito no mês em que foram feitas,
              não no mês da fatura. Assim seu Planejamento de <strong>{lbl.long.split(' de ')[0]}</strong> reflete
              o que você gastou em {lbl.long.split(' de ')[0]} — não o que vai vencer em {lbl.long.split(' de ')[0]}.
              Para fluxo de caixa do cartão (quando vai sair da conta), veja a aba <strong>Contas &amp; cartões</strong>.
            </div>
          )}
        </div>
      </div>

      {/* ─── Capítulo I · A regra ─── */}
      <ChapterMark roman="I" title="A regra 50·30·20"
                   caption="Como seu plano se divide entre essencial, estilo e dívidas"/>
      <div className="orc-rule" data-od-id="orc-regra-502030">
        {budgetGroups.map((g, idx) => {
          const tint = g.id === 'essencial' ? 'var(--ok)' : g.id === 'estilo' ? 'var(--info)' : 'var(--bad)';
          const pct = g.limit ? g.spent / g.limit : 0;
          const over = pct > 1;
          const status = over ? 'estourado' : pct > 0.85 ? 'no limite' : 'em dia';
          const statusCls = over ? 'bad' : pct > 0.85 ? 'warn' : 'ok';
          return (
            <div className="orc-rule-col" key={g.id}>
              <div className="orc-rule-pct" style={{ color: tint }}>
                {Math.round(g.target * 100)}<span>%</span>
              </div>
              <div className="orc-rule-name">{g.label}</div>
              <div className="orc-rule-amt">{fmtBRL(g.limit)} <span>limite</span></div>
              <div className="orc-rule-spent">
                <span className="orc-rule-spent-v">{fmtBRL(g.spent)}</span>
                <span className={`orc-rule-status ${statusCls}`}>{status}</span>
              </div>
              <ProgressBar value={Math.min(pct, 1)} tint={tint} glow/>
              <div className="orc-rule-foot">
                <span className={over ? 'over' : ''}>{Math.round(pct*100)}% gasto</span>
                <span className="fds-muted">{g.cats.length} categorias</span>
              </div>
              {over && (
                <div className="orc-rule-alert">
                  <Icon.TrendUp size={12}/> {fmtBRL(g.spent - g.limit)} acima do limite
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Capítulo II · Por categoria — ou empty state se sem gastos ─── */}
      <ChapterMark roman="II" title="Por categoria"
                   caption="Clique no valor planejado para editar · clique na linha para ver as transações"
                   action={<button className="stu-link" onClick={openCategoryModal}><Icon.Plus size={12}/> Gerenciar categorias</button>}/>
      {!hasSpend ? (
        <div className="fds-empty-state">
          <div className="fds-empty-state-icon">🗂️</div>
          <h2 className="fds-empty-state-title">
            Sem gastos registrados para planejar este mês.
          </h2>
          <p className="fds-empty-state-lede">
            Adicione uma despesa e ela aparecerá aqui distribuída por categoria.
          </p>
        </div>
      ) : (
      <div className="stu-card orc-cats" data-od-id="orc-categorias">
        <div className="orc-cats-head">
          <div>Categoria</div>
          <div>Planejado</div>
          <div>Gasto</div>
          <div>Restante</div>
          <div>Progresso</div>
          <div></div>
        </div>
        {budgetGroups.map(g => {
          const tint = g.id === 'essencial' ? 'var(--ok)' : g.id === 'estilo' ? 'var(--info)' : 'var(--bad)';
          return (
            <React.Fragment key={g.id}>
              <button className="orc-cats-group"
                      onClick={() => toggleGroup(g.id)}
                      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', minHeight: 44 }}
                      role="button"
                      aria-expanded={!collapsedGroups[g.id]}>
                <span className="orc-cats-group-dot" style={{ background: tint }}/>
                {g.label}
                <span className="orc-cats-group-meta">
                  {fmtBRL(g.spent)} de {fmtBRL(g.limit)} · {g.limit ? Math.round(g.spent/g.limit*100) : 0}%
                </span>
                <Icon.Down size={14} style={{ marginLeft: 'auto', transition: 'transform 0.2s ease', transform: collapsedGroups[g.id] ? 'rotate(-90deg)' : 'rotate(0deg)', color: 'var(--ink-3)' }}/>
              </button>
              {!collapsedGroups[g.id] && g.cats.map(c => {
                const cat = categories[c.cat] || { label: c.cat, tint: '#888', emoji: '🏷️' };
                const lim = c.limit;
                const rest = lim - c.spent;
                const pct = lim ? c.spent / lim : 0;
                const over = pct > 1;
                const isEditing = editing === c.cat;
                const isExpanded = expanded === c.cat;
                const txs = transactions.filter(t => t.cat === c.cat);
                return (
                  <React.Fragment key={c.cat}>
                    <div className={`orc-cat-row ${isExpanded ? 'expanded' : ''}`}
                         onClick={() => !isEditing && setExpanded(isExpanded ? null : c.cat)}>
                      <div className="orc-cat-cell-name">
                        <CategoryAvatar cat={c.cat} size={28}/>
                        <span>{cat.label}</span>
                        {txs.length > 0 && <span className="orc-cat-count">{txs.length}</span>}
                      </div>
                      <div className="orc-cat-cell-plan" onClick={(e) => { e.stopPropagation(); setEditing(c.cat); }}>
                        {isEditing ? (
                          <span className="orc-cat-edit">
                            <span className="orc-cat-edit-prefix">R$</span>
                            <input autoFocus
                                   className="orc-cat-edit-input"
                                   defaultValue={lim.toLocaleString('pt-BR',{minimumFractionDigits:0})}
                                   onBlur={(e) => {
                                     const v = parseFloat(e.target.value.replace(/\./g,'').replace(',','.')) || 0;
                                     setPlanned(c.cat, v);
                                     setEditing(null);
                                   }}
                                   onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(null); }}
                                   onClick={(e) => e.stopPropagation()}/>
                          </span>
                        ) : (
                          <span className="orc-cat-plan-val">
                            <span className="cur">R$</span>{lim.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0})}
                          </span>
                        )}
                      </div>
                      <div className="orc-cat-cell-spent">
                        <span className="orc-cat-spent-val">{fmtBRL(c.spent)}</span>
                      </div>
                      <div className={`orc-cat-cell-rest ${over ? 'over' : ''}`}>
                        {over ? '−' : ''}{fmtBRL(Math.abs(rest))}
                      </div>
                      <div className="orc-cat-cell-bar">
                        <div className="orc-cat-bar-track">
                          <div className={`orc-cat-bar-fill ${over ? 'over' : pct > 0.85 ? 'near' : ''}`}
                               style={{ width: `${Math.min(pct, 1.2) * 100}%`, background: over ? 'var(--bad)' : cat.tint }}/>
                          {over && <div className="orc-cat-bar-overflow" style={{ width: `${Math.min((pct - 1)/0.2, 1) * 100}%` }}/>}
                        </div>
                        <span className={`orc-cat-bar-pct ${over ? 'over' : pct > 0.85 ? 'near' : ''}`}>{Math.round(pct*100)}%</span>
                      </div>
                      <div className="orc-cat-cell-act">
                        <Icon.Down size={14} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }}/>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="orc-cat-detail">
                        {txs.length === 0 ? (
                          <div className="orc-cat-empty">Nenhuma transação em maio para {cat.label}.</div>
                        ) : (
                          <>
                            <div className="orc-cat-detail-head">
                              {txs.length} {txs.length === 1 ? 'transação' : 'transações'} em maio · {fmtBRL(c.spent)}
                            </div>
                            <div className="orc-cat-detail-list">
                              {txs.map((t, i) => {
                                const a = ACCOUNTS.find(x => x.id === t.acct);
                                return (
                                  <div className="orc-cat-detail-tx" key={i}>
                                    <span className="orc-cat-detail-d">{t.d}</span>
                                    <span className="orc-cat-detail-desc">{t.desc}</span>
                                    <span className="fds-acct-pill">
                                      <span className="fds-acct-mark-sm" style={{ background: a?.color }}/>
                                      {a?.name}
                                    </span>
                                    {t.status === 'pendente'
                                      ? <span className="fds-status pendente"><Icon.Clock size={11}/>Pendente</span>
                                      : <span className="fds-status pago"><Icon.Check size={11}/>Pago</span>}
                                    <span className="orc-cat-detail-val">−R$ {Math.abs(t.val).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
      )}

      {/* ─── Capítulo III · Comparação ─── */}
      <ChapterMark roman="III" title="Plano vs. realizado"
                   caption="Últimos 6 meses · barras escuras = realizado, claras = planejado"
                   action={<div className="orc-legend">
                     <span className="orc-legend-item">
                       <span className="orc-legend-dot plan"/>
                       Planejado
                     </span>
                     <span className="orc-legend-item">
                       <span className="orc-legend-dot real"/>
                       Realizado
                     </span>
                     <span className="orc-legend-item">
                       <span className="orc-legend-dot over"/>
                       Estourado
                     </span>
                   </div>}/>
      <div className="stu-card orc-history" data-od-id="orc-historico">
        <div className="orc-history-wrap">
        <div className="orc-history-grid">
          {history.map(h => {
            const max = Math.max(...history.flatMap(x => [x.plan, x.real])) * 1.1;
            const planH = (h.plan / max) * 180;
            const realH = (h.real / max) * 180;
            const ratio = h.real / h.plan;
            const over = ratio > 1 && !h.partial;
            return (
              <div className="orc-history-col" key={h.m}>
                <div className="orc-history-bars">
                  <div className="orc-history-bar plan" style={{ height: planH }}>
                    <span className="orc-history-bar-val">{(h.plan/1000).toFixed(1)}k</span>
                  </div>
                  <div className={`orc-history-bar real ${over ? 'over' : ''} ${h.partial ? 'partial' : ''}`}
                       style={{ height: realH }}>
                    <span className="orc-history-bar-val">{(h.real/1000).toFixed(1)}k</span>
                  </div>
                </div>
                <div className="orc-history-meta">
                  <div className="orc-history-month">{h.m}</div>
                  <div className={`orc-history-pct ${over ? 'over' : ''} ${h.partial ? 'partial' : ''}`}>
                    {h.partial ? `${Math.round(ratio*100)}% até hoje` : over ? `+${Math.round((ratio-1)*100)}%` : `${Math.round(ratio*100)}%`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>{/* /orc-history-wrap */}
        <div className="orc-history-foot">
          <div className="orc-history-foot-stat">
            <div className="orc-history-foot-lbl">Média realizado</div>
            <div className="orc-history-foot-val">{fmtBRL(history.filter(h=>!h.partial).reduce((s,h)=>s+h.real,0) / (history.length-1))}</div>
          </div>
          <div className="orc-history-foot-stat">
            <div className="orc-history-foot-lbl">Aderência ao plano</div>
            <div className="orc-history-foot-val">96%</div>
          </div>
          <div className="orc-history-foot-stat">
            <div className="orc-history-foot-lbl">Meses estourados</div>
            <div className="orc-history-foot-val">1 <span className="fds-muted">/ 5</span></div>
          </div>
          <div className="orc-history-foot-stat">
            <div className="orc-history-foot-lbl">Maior estouro</div>
            <div className="orc-history-foot-val">Mar · +6%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { OrcamentoStudio });
