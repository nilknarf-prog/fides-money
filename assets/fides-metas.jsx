// fides-metas.jsx — Studio "Metas" page (savings goals)

function MetasStudio({ onAdd }) {
  const { transactions, monthTransactions, selectedMonth, monthLabel } = useFides();
  const today = new Date();
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const lbl = monthLabel(selectedMonth);

  // ─── Local state extends METAS ──────────────────────────────
  const [localMetas, setLocalMetas] = React.useState(METAS);
  const [addMetaOpen, setAddMetaOpen] = React.useState(false);

  function handleAddMeta(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const alvo = parseFloat(fd.get('alvo') || '0');
    const atual = parseFloat(fd.get('atual') || '0');
    const contrib = parseFloat(fd.get('contribuicao') || '0');
    const hoje = today.getMonth() + 1 + '/' + today.getFullYear();
    const newMeta = {
      id:           'meta-' + Date.now(),
      nome:         fd.get('nome') || 'Nova meta',
      descricao:    fd.get('descricao') || '',
      emoji:        fd.get('emoji') || '🎯',
      tint:         '#2D5A3D',
      alvo,
      atual,
      contribuicao: contrib,
      criadaEm:     hoje,
    };
    setLocalMetas(prev => [...prev, newMeta]);
    setAddMetaOpen(false);
  }

  // Project end-date by ceil((alvo - atual)/contribuicao) months from today
  const computed = localMetas.map(m => {
    const faltam = Math.max(0, m.alvo - m.atual);
    const pct = m.alvo ? Math.min(1, m.atual / m.alvo) : 0;
    const mesesAteFim = m.contribuicao > 0 ? Math.ceil(faltam / m.contribuicao) : Infinity;
    const fim = new Date(today.getFullYear(), today.getMonth() + mesesAteFim, 1);
    const fimLabel = mesesAteFim === Infinity ? '—' : `${meses[fim.getMonth()]} ${fim.getFullYear()}`;
    // adherence: actual progress / "expected" progress given time since criadaEm
    const [cmes, cano] = m.criadaEm.split('/').map(s => parseInt(s, 10));
    const mesesDesdeInicio = (today.getFullYear() - cano) * 12 + (today.getMonth() + 1 - cmes);
    const aporteEsperado = mesesDesdeInicio * m.contribuicao;
    return { ...m, faltam, pct, mesesAteFim, fimLabel, mesesDesdeInicio, aporteEsperado };
  });

  // ─── Totals ────────────────────────────────────────────────
  const totalGuardado = localMetas.reduce((s, m) => s + m.atual, 0);
  const totalAlvo     = localMetas.reduce((s, m) => s + m.alvo, 0);
  const totalAporte   = localMetas.reduce((s, m) => s + m.contribuicao, 0);
  const pctMedio = totalAlvo ? (totalGuardado / totalAlvo) : 0;
  const maior = [...computed].sort((a, b) => b.alvo - a.alvo)[0];
  const proxima = [...computed].sort((a, b) => a.mesesAteFim - b.mesesAteFim)[0];

  const { int, dec } = splitBRL(totalGuardado);

  return (
    <div className="fds-page stu-page" data-od-id="metas">
      {/* ─── Nova Meta modal ─── */}
      {addMetaOpen && (
        <div className="fds-modal-backdrop" onClick={() => setAddMetaOpen(false)}>
          <div className="fds-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="fds-modal-head">
              <div className="fds-modal-title">Nova meta</div>
              <button className="fds-icon-btn" onClick={() => setAddMetaOpen(false)}><Icon.X size={16}/></button>
            </div>
            <form className="fds-modal-body" onSubmit={handleAddMeta} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr', gap: 12 }}>
                <label className="fds-field">
                  <span>Emoji</span>
                  <input className="fds-input" name="emoji" placeholder="🎯" maxLength={2} style={{ textAlign: 'center', fontSize: 20 }}/>
                </label>
                <label className="fds-field">
                  <span>Nome da meta</span>
                  <input className="fds-input" name="nome" placeholder="Ex: Viagem para Europa" required/>
                </label>
              </div>
              <label className="fds-field">
                <span>Descrição (opcional)</span>
                <input className="fds-input" name="descricao" placeholder="Ex: Férias de julho 2027"/>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="fds-field">
                  <span>Valor alvo (R$)</span>
                  <input className="fds-input" name="alvo" type="number" step="0.01" min="0" placeholder="0,00" required/>
                </label>
                <label className="fds-field">
                  <span>Já guardado (R$)</span>
                  <input className="fds-input" name="atual" type="number" step="0.01" min="0" placeholder="0,00"/>
                </label>
              </div>
              <label className="fds-field">
                <span>Aporte mensal (R$)</span>
                <input className="fds-input" name="contribuicao" type="number" step="0.01" min="0" placeholder="0,00" required/>
              </label>
              <div className="fds-modal-foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12 }}>
                <button type="button" className="fds-btn-ghost" onClick={() => setAddMetaOpen(false)}>Cancelar</button>
                <button type="submit" className="fds-btn-primary"><Icon.Check size={13}/> Criar meta</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Editorial hero ─── */}
      <section className="stu-hero" data-od-id="met-hero">
        <div className="stu-hero-eyebrow">
          <Icon.Goal size={11}/>
          metas · {localMetas.length} em curso
        </div>
        <h2 className="stu-hero-headline">
          Você guardou{' '}
          <span className="stu-hero-amt">
            <span className="cur">R$</span>
            <span className="int">{int}</span>
            <span className="dec">,{dec}</span>
          </span>{' '}
          para os seus sonhos.
        </h2>
        <p className="stu-hero-lede">
          São <strong className="stu-num">{localMetas.length} metas ativas</strong> somando{' '}
          <strong className="stu-num">{fmtBRL(totalAlvo)}</strong> de alvo —{' '}
          <strong className="stu-num">{Math.round(pctMedio * 100)}% do caminho</strong> já foi.
          Você reserva <strong className="stu-num">{fmtBRL(totalAporte)}</strong> por mês para isso.
          A próxima a chegar é <strong className="stu-num">{proxima?.nome}</strong>, em{' '}
          <span className="stu-pos">{proxima?.mesesAteFim} {proxima?.mesesAteFim === 1 ? 'mês' : 'meses'}</span>.
        </p>

        <div className="stu-hero-strip" data-od-id="met-hero-strip">
          <div className="stu-metric">
            <div className="stu-metric-lbl">Guardado</div>
            <div className="stu-metric-val pos">{fmtBRL(totalGuardado)}</div>
            <div className="stu-metric-tag" style={{ color: 'var(--muted)' }}>
              <Icon.Sparkles size={11}/> {Math.round(pctMedio * 100)}% de {fmtBRL(totalAlvo, { compact: true })}
            </div>
          </div>
          <div className="stu-metric-sep"/>
          <div className="stu-metric">
            <div className="stu-metric-lbl">Aporte mensal</div>
            <div className="stu-metric-val">{fmtBRL(totalAporte)}</div>
            <div className="stu-metric-tag" style={{ color: 'var(--muted)' }}>
              <Icon.Refresh size={11}/> automático
            </div>
          </div>
          <div className="stu-metric-sep"/>
          <div className="stu-metric">
            <div className="stu-metric-lbl">Maior meta</div>
            <div className="stu-metric-val">{maior?.nome.split(' ').slice(0, 2).join(' ')}</div>
            <div className="stu-metric-tag">
              <Icon.Goal size={11}/> {fmtBRL(maior?.alvo)} · {maior?.mesesAteFim} meses
            </div>
          </div>
          <div className="stu-metric-sep"/>
          <div className="stu-metric">
            <div className="stu-metric-lbl">Próxima a chegar</div>
            <div className="stu-metric-val pos">{proxima?.nome.split(' ').slice(0, 2).join(' ')}</div>
            <div className="stu-metric-tag" style={{ color: 'var(--accent-bright)' }}>
              <Icon.Clock size={11}/> {proxima?.fimLabel}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Capítulo I · Em curso ─── */}
      <ChapterMark roman="I" title="Em curso"
                   caption={`${localMetas.length} metas com aporte regular`}
                   action={<button className="stu-link" onClick={() => setAddMetaOpen(true)}><Icon.Plus size={12}/> Nova meta</button>}/>
      <div className="met-grid" data-od-id="met-grid">
        {computed.map((m) => {
          const aporteOk = m.atual >= m.aporteEsperado * 0.9;
          return (
            <div className="met-card" key={m.id}>
              <div className="met-card-glow" style={{ background: `radial-gradient(circle at 80% 0%, ${m.tint}33 0%, transparent 60%)` }}/>
              <div className="met-card-head">
                <div className="met-card-emoji" style={{ background: m.tint + '1A', borderColor: m.tint + '33' }}>
                  {m.emoji}
                </div>
                <div className="met-card-meta">
                  <div className="met-card-name">{m.nome}</div>
                  <div className="met-card-desc">{m.descricao}</div>
                </div>
                <button className="fds-icon-btn"><Icon.Dots size={16}/></button>
              </div>

              <div className="met-card-amounts">
                <div className="met-card-current">
                  <span className="met-card-cur">R$</span>
                  <span className="met-card-int">{Math.floor(m.atual).toLocaleString('pt-BR')}</span>
                </div>
                <div className="met-card-alvo">
                  de <strong>{fmtBRL(m.alvo)}</strong>
                </div>
              </div>

              <div className="met-card-bar">
                <div className="met-card-bar-track">
                  <div className="met-card-bar-fill"
                       style={{ width: `${m.pct * 100}%`, background: `linear-gradient(90deg, ${m.tint}, color-mix(in oklab, ${m.tint} 70%, black))`,
                                boxShadow: `0 0 10px ${m.tint}66` }}/>
                </div>
                <div className="met-card-bar-foot">
                  <span className="met-card-pct" style={{ color: m.tint }}>{Math.round(m.pct * 100)}%</span>
                  <span className="met-card-faltam">faltam <strong>{fmtBRL(m.faltam)}</strong></span>
                </div>
              </div>

              <div className="met-card-stats">
                <div className="met-stat">
                  <div className="met-stat-lbl">Aporte mensal</div>
                  <div className="met-stat-val">{fmtBRL(m.contribuicao)}</div>
                </div>
                <div className="met-stat">
                  <div className="met-stat-lbl">Chega em</div>
                  <div className="met-stat-val">
                    {m.mesesAteFim} {m.mesesAteFim === 1 ? 'mês' : 'meses'}
                    <span className="met-stat-sub">{m.fimLabel}</span>
                  </div>
                </div>
                <div className="met-stat">
                  <div className="met-stat-lbl">Aderência</div>
                  <div className={`met-stat-val ${aporteOk ? 'pos' : 'warn'}`}>
                    {aporteOk ? 'Em dia' : 'Atrás'}
                    <span className="met-stat-sub">
                      {m.atual >= m.aporteEsperado ? '✓' : (m.aporteEsperado ? Math.round((m.atual/m.aporteEsperado)*100) : 100) + '%'} do esperado
                    </span>
                  </div>
                </div>
              </div>

              <div className="met-card-actions">
                <button className="met-card-aportar" style={{ background: m.tint }}>
                  <Icon.Plus size={13}/> Aportar
                </button>
                <button className="fds-btn-ghost">
                  <Icon.Settings size={13}/> Ajustar plano
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Capítulo II · Como acelerar ─── */}
      <ChapterMark roman="II" title="Como acelerar"
                   caption={`Sugestões inteligentes baseadas em ${lbl.long}`}/>
      <div className="met-tips" data-od-id="met-dicas">
        {(() => {
          // Cada dica é { id, icon, color, title, desc, amt, cta }
          const tips = [];

          // 1) Renegociar dívidas com muitas parcelas
          const dividaParcelada = transactions.find(t => t.sub && t.cat === 'divida' && t.status === 'pendente');
          if (dividaParcelada) {
            const parcelaTotal = parseInt(dividaParcelada.sub.split('/')[1], 10);
            const economia = Math.round(Math.abs(dividaParcelada.val) * parcelaTotal * 0.12);
            const liberar = Math.round(Math.abs(dividaParcelada.val) * 0.33);
            tips.push({
              id: 'reneg',
              icon: 'Refresh', color: 'var(--accent)', bg: 'var(--accent-soft)',
              title: `Renegociar ${dividaParcelada.desc}`,
              desc: <>Parcela atual <strong>{fmtBRL(Math.abs(dividaParcelada.val))}</strong> em <strong>{parcelaTotal} meses</strong>. Antecipando uma parte, economiza ~<strong>{fmtBRL(economia)}</strong> em juros e libera <strong>{fmtBRL(liberar)}/mês</strong>.</>,
              amt: `+${fmtBRL(liberar)}/mês`,
              cta: 'Simular',
            });
          }

          // 2) Assinaturas — soma do mês e sugere cortar a maior recorrente
          const assins = monthTransactions.filter(t => t.cat === 'assinaturas');
          if (assins.length > 0) {
            const totalAssin = assins.reduce((s, t) => s + Math.abs(t.val), 0);
            const maior = assins.reduce((m, t) => Math.abs(t.val) > Math.abs(m.val) ? t : m, assins[0]);
            tips.push({
              id: 'assin',
              icon: 'Sparkles', color: '#B45309', bg: '#FEF0D6',
              title: 'Revisar assinaturas',
              desc: <>Você gasta <strong>{fmtBRL(totalAssin)}/mês</strong> em <strong>{assins.length} {assins.length === 1 ? 'serviço' : 'serviços'}</strong>. Cortar <strong>{maior.desc}</strong> libera <strong>{fmtBRL(Math.abs(maior.val))}</strong> direto para suas metas.</>,
              amt: `+${fmtBRL(Math.abs(maior.val))}/mês`,
              cta: 'Revisar',
            });
          }

          // 3) Saldo parado nas contas → render no Tesouro Selic
          const totalContas = ACCOUNTS.reduce((s, a) => s + a.balance, 0);
          if (totalContas > 3000) {
            const rendimento = Math.round(totalContas * 0.011); // ~1.1% a.m. (Selic 13%)
            tips.push({
              id: 'tesouro',
              icon: 'TrendUp', color: '#0F766E', bg: '#0F766E22',
              title: 'Render dinheiro parado',
              desc: <>Você tem <strong>{fmtBRL(totalContas)}</strong> distribuídos em conta corrente. Aplicando em Tesouro Selic, renderia <strong>~{fmtBRL(rendimento)}/mês</strong> sem perder liquidez.</>,
              amt: `+${fmtBRL(rendimento)}/mês`,
              cta: 'Aplicar',
            });
          }

          // 4) Categoria estourada → cortar antes de aumentar aporte
          const estouradas = ['essencial','estilo','divida'].map(g => {
            const cats = monthTransactions.filter(t => t.val < 0 && (categories => true));
            return null;
          }).filter(Boolean);
          // Simpler: pega gastos por categoria do mês e detecta a que mais gastou
          const gastosCat = {};
          monthTransactions.forEach(t => {
            if (t.val < 0) gastosCat[t.cat] = (gastosCat[t.cat] || 0) + Math.abs(t.val);
          });
          const topCat = Object.entries(gastosCat).sort((a,b) => b[1] - a[1])[0];
          if (topCat && tips.length < 3) {
            const [catId, val] = topCat;
            tips.push({
              id: 'cat',
              icon: 'Goal', color: '#7C3AED', bg: '#7C3AED22',
              title: `Otimizar ${catId === 'divida' ? 'gasto com dívida' : catId === 'mercado' ? 'mercado' : catId}`,
              desc: <>Sua maior categoria em {lbl.long.split(' de ')[0]} é <strong>{catId}</strong> com <strong>{fmtBRL(val)}</strong>. Reduzir 10% liberaria <strong>{fmtBRL(val * 0.1)}/mês</strong> pras metas.</>,
              amt: `+${fmtBRL(val * 0.1)}/mês`,
              cta: 'Estudar',
            });
          }

          // 5) Aumentar aporte se sobra > 0
          const receitas = monthTransactions.filter(t => t.val > 0).reduce((s,t) => s + t.val, 0);
          const despesas = monthTransactions.filter(t => t.val < 0).reduce((s,t) => s + Math.abs(t.val), 0);
          const sobra = receitas - despesas - localMetas.reduce((s,m) => s + m.contribuicao, 0);
          if (sobra > 200 && tips.length < 3) {
            tips.push({
              id: 'aporte',
              icon: 'TrendUp', color: 'var(--ok)', bg: 'var(--ok-soft)',
              title: 'Aumentar aporte mensal',
              desc: <>Depois das despesas e aportes atuais, sobram <strong>{fmtBRL(sobra)}</strong> em {lbl.long.split(' de ')[0]}. Direcionando metade para Maceió, antecipa a meta em ~6 meses.</>,
              amt: `+${fmtBRL(sobra * 0.5)}/mês`,
              cta: 'Configurar',
            });
          }

          return tips.slice(0, 3).map(t => {
            const Ic = Icon[t.icon] || Icon.Sparkles;
            return (
              <div className="met-tip" key={t.id}>
                <div className="met-tip-icon" style={{ background: t.bg, color: t.color }}>
                  <Ic size={18}/>
                </div>
                <div className="met-tip-body">
                  <div className="met-tip-title">{t.title}</div>
                  <div className="met-tip-desc">{t.desc}</div>
                  <div className="met-tip-foot">
                    <span className="met-tip-amt">{t.amt}</span>
                    <button className="stu-link">{t.cta} →</button>
                  </div>
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* ─── Capítulo III · Já atingidas ─── */}
      <ChapterMark roman="III" title="Já atingidas"
                   caption="Suas conquistas — para lembrar"/>
      <div className="stu-card met-done" data-od-id="met-concluidas">
        {METAS_ATINGIDAS.length === 0 ? (
          <div className="met-done-empty">Nenhuma meta concluída ainda. A primeira está chegando!</div>
        ) : (
          <div className="met-done-list">
            {METAS_ATINGIDAS.map((m, i) => (
              <div className="met-done-row" key={i}>
                <span className="met-done-emoji">{m.emoji}</span>
                <span className="met-done-name">{m.nome}</span>
                <span className="met-done-val">{fmtBRL(m.valor)}</span>
                <span className="met-done-date">atingida em {m.mesAtingido}</span>
                <span className="met-done-tag">
                  <Icon.Check size={11}/> Concluída
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { MetasStudio });
