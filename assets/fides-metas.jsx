// fides-metas.jsx — Studio "Metas" page (savings goals)

// ─── Ícones locais ────────────────────────────────────────────
const __metIco = (paths) => ({ size = 16, style, className }) =>
  React.createElement('svg', {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
    style, className,
  }, paths);

const MetIcon = {
  Edit:  __metIco(React.createElement(React.Fragment, null,
    React.createElement('path', { d: 'M11 4H5a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-6' }),
    React.createElement('path', { d: 'M17.5 2.5a2.12 2.12 0 013 3L12 14l-4 1 1-4 7.5-8.5z' }),
  )),
  Trash: __metIco(React.createElement(React.Fragment, null,
    React.createElement('polyline', { points: '3 6 5 6 21 6' }),
    React.createElement('path', { d: 'M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2' }),
  )),
  Trophy: __metIco(React.createElement(React.Fragment, null,
    React.createElement('path', { d: 'M6 2h12v6a6 6 0 01-12 0V2z' }),
    React.createElement('path', { d: 'M6 4H3a2 2 0 000 4h3M18 4h3a2 2 0 010 4h-3M12 14v4M8 22h8M12 14a6 6 0 000 0' }),
  )),
  Slider: __metIco(React.createElement(React.Fragment, null,
    React.createElement('line', { x1: '4', y1: '6', x2: '20', y2: '6' }),
    React.createElement('line', { x1: '4', y1: '12', x2: '20', y2: '12' }),
    React.createElement('line', { x1: '4', y1: '18', x2: '20', y2: '18' }),
    React.createElement('circle', { cx: '8', cy: '6', r: '2', fill: 'currentColor', stroke: 'none' }),
    React.createElement('circle', { cx: '16', cy: '12', r: '2', fill: 'currentColor', stroke: 'none' }),
    React.createElement('circle', { cx: '10', cy: '18', r: '2', fill: 'currentColor', stroke: 'none' }),
  )),
};

// ─── MetDotsMenu — dropdown contextual das metas ──────────────
function MetDotsMenu({ items }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  return (
    <div className="met-dots-wrap" ref={ref}>
      <button
        className="fds-icon-btn"
        aria-label="Opções da meta"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(v => !v)}
        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
      >
        <Icon.Dots size={16}/>
      </button>
      {open && (
        <div className="met-dots-dd" role="menu" onClick={e => e.stopPropagation()}>
          {items.map(item => {
            const Ic = item.icon ? (MetIcon[item.icon] || Icon[item.icon] || null) : null;
            return (
              <button
                key={item.id}
                role="menuitem"
                className={`met-dots-item${item.danger ? ' danger' : ''}`}
                onPointerUp={() => { item.onClick?.(); setOpen(false); }}
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              >
                {Ic && <Ic size={14}/>}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Modal: Aportar ───────────────────────────────────────────
function AportarModal({ meta, onConfirm, onClose }) {
  const [valor, setValor] = React.useState('');
  if (!meta) return null;
  const v = parseFloat(valor) || 0;
  const novoAtual = meta.atual + v;
  const novoPct = meta.alvo ? Math.min(1, novoAtual / meta.alvo) : 0;
  const faltamDepois = Math.max(0, meta.alvo - novoAtual);
  const novosMeses = meta.contribuicao > 0 ? Math.ceil(faltamDepois / meta.contribuicao) : Infinity;

  return (
    <div className="fds-modal-backdrop" onClick={onClose}>
      <div className="fds-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="fds-modal-head">
          <div>
            <div className="fds-modal-eyebrow">Aporte</div>
            <div className="fds-modal-title">
              <span style={{ marginRight: 8 }}>{meta.emoji}</span>{meta.nome}
            </div>
          </div>
          <button className="fds-icon-btn" onClick={onClose}><Icon.X size={16}/></button>
        </div>
        <div className="fds-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label className="fds-field">
            <span>Valor a adicionar (R$)</span>
            <input
              className="fds-input"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              value={valor}
              onChange={e => setValor(e.target.value)}
              autoFocus
            />
          </label>

          {v > 0 && (
            <div className="met-aporte-preview">
              <div className="met-aporte-preview-bar">
                <div
                  className="met-aporte-preview-fill"
                  style={{
                    width: `${novoPct * 100}%`,
                    background: `linear-gradient(90deg, ${meta.tint}, color-mix(in oklab, ${meta.tint} 70%, black))`,
                    boxShadow: `0 0 10px ${meta.tint}66`,
                  }}
                />
                <div
                  className="met-aporte-preview-delta"
                  style={{ left: `${Math.min((meta.atual / meta.alvo) * 100, 98)}%` }}
                />
              </div>
              <div className="met-aporte-preview-stats">
                <div className="met-aporte-stat">
                  <span className="met-aporte-stat-lbl">Novo saldo</span>
                  <span className="met-aporte-stat-val" style={{ color: meta.tint }}>{fmtBRL(novoAtual)}</span>
                </div>
                <div className="met-aporte-stat">
                  <span className="met-aporte-stat-lbl">Progresso</span>
                  <span className="met-aporte-stat-val">{Math.round(novoPct * 100)}%</span>
                </div>
                <div className="met-aporte-stat">
                  <span className="met-aporte-stat-lbl">Chega em</span>
                  <span className="met-aporte-stat-val">
                    {novosMeses === Infinity ? '—' : `${novosMeses} ${novosMeses === 1 ? 'mês' : 'meses'}`}
                  </span>
                </div>
              </div>
              {novoPct >= 1 && (
                <div className="met-aporte-concluida">
                  🎉 Meta atingida com este aporte!
                </div>
              )}
            </div>
          )}
        </div>
        <div className="fds-modal-foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="fds-btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            className="fds-btn-primary"
            disabled={v <= 0}
            onClick={() => v > 0 && onConfirm(v)}
            style={{ background: v > 0 ? meta.tint : undefined, opacity: v <= 0 ? 0.5 : 1 }}
          >
            <Icon.Check size={13}/> Confirmar aporte
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Ajustar plano (edição completa da meta) ───────────
function AjustarPlanoModal({ meta, onConfirm, onClose }) {
  if (!meta) return null;
  const TINTS = ['#2D5A3D','#2C5282','#B45309','#7C3AED','#0F766E','#9B2C2C','#0891B2','#BE185D'];

  return (
    <div className="fds-modal-backdrop" onClick={onClose}>
      <div className="fds-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="fds-modal-head">
          <div>
            <div className="fds-modal-eyebrow">Editar</div>
            <div className="fds-modal-title">{meta.emoji} {meta.nome}</div>
          </div>
          <button className="fds-icon-btn" onClick={onClose}><Icon.X size={16}/></button>
        </div>
        <form
          className="fds-modal-body"
          onSubmit={e => {
            e.preventDefault();
            const fd = new FormData(e.target);
            onConfirm({
              nome:         fd.get('nome')        || meta.nome,
              descricao:    fd.get('descricao')   ?? meta.descricao,
              emoji:        fd.get('emoji')       || meta.emoji,
              alvo:         parseFloat(fd.get('alvo'))         || meta.alvo,
              atual:        parseFloat(fd.get('atual'))        ?? meta.atual,
              contribuicao: parseFloat(fd.get('contribuicao')) || meta.contribuicao,
              tint:         fd.get('tint')        || meta.tint,
            });
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 12 }}>
            <label className="fds-field">
              <span>Emoji</span>
              <input className="fds-input" name="emoji" defaultValue={meta.emoji} maxLength={2} style={{ textAlign: 'center', fontSize: 20 }}/>
            </label>
            <label className="fds-field">
              <span>Nome da meta</span>
              <input className="fds-input" name="nome" defaultValue={meta.nome} required/>
            </label>
          </div>
          <label className="fds-field">
            <span>Descrição</span>
            <input className="fds-input" name="descricao" defaultValue={meta.descricao} placeholder="Ex: Férias de julho 2027"/>
          </label>
          <div className="fds-modal-row two">
            <label className="fds-field">
              <span>Valor alvo (R$)</span>
              <input className="fds-input" name="alvo" type="number" step="0.01" min="0" defaultValue={meta.alvo} required/>
            </label>
            <label className="fds-field">
              <span>Já guardado (R$)</span>
              <input className="fds-input" name="atual" type="number" step="0.01" min="0" defaultValue={meta.atual}/>
            </label>
          </div>
          <label className="fds-field">
            <span>Aporte mensal (R$)</span>
            <input className="fds-input" name="contribuicao" type="number" step="0.01" min="0" defaultValue={meta.contribuicao} required/>
          </label>
          <div className="fds-field">
            <span>Cor</span>
            <div className="met-tint-picker">
              {TINTS.map(t => (
                <label key={t} className="met-tint-opt">
                  <input type="radio" name="tint" value={t} defaultChecked={meta.tint === t} style={{ display: 'none' }}/>
                  <span className="met-tint-swatch" style={{ background: t }}>
                    {meta.tint === t && <Icon.Check size={12}/>}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="fds-modal-foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 0 0' }}>
            <button type="button" className="fds-btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="fds-btn-primary"><Icon.Check size={13}/> Salvar alterações</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Confirmar exclusão ────────────────────────────────
function MetConfirmDeleteModal({ open, nome, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fds-modal-backdrop" onClick={onCancel}>
      <div className="fds-modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="fds-modal-head">
          <div className="fds-modal-title" style={{ color: 'var(--bad)' }}>
            <MetIcon.Trash size={16} style={{ marginRight: 8, verticalAlign: 'middle' }}/>
            Excluir meta
          </div>
          <button className="fds-icon-btn" onClick={onCancel}><Icon.X size={16}/></button>
        </div>
        <div className="fds-modal-body">
          <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, margin: 0 }}>
            Tem certeza que deseja excluir a meta <strong>"{nome}"</strong>? Esta ação não pode ser desfeita.
          </p>
        </div>
        <div className="fds-modal-foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="fds-btn-ghost" onClick={onCancel}>Cancelar</button>
          <button className="fds-btn-primary" style={{ background: 'var(--bad)' }} onClick={onConfirm}>
            <MetIcon.Trash size={13}/> Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Painel: Simular renegociação ─────────────────────────────
function SimularPanel({ dívida, onClose }) {
  if (!dívida) return null;
  const parcelaAtual = Math.abs(dívida.val);
  const totalParcelas = parseInt(dívida.sub?.split('/')[1] || '12', 10);
  const parcelaAtualNum = parseInt(dívida.sub?.split('/')[0] || '1', 10);
  const restantes = totalParcelas - parcelaAtualNum + 1;
  const totalRestante = parcelaAtual * restantes;

  const [antecipacao, setAntecipacao] = React.useState(Math.round(totalRestante * 0.2));
  const reducaoJuros = 0.12;
  const economiaTotal = Math.round(antecipacao * reducaoJuros);
  const novoTotal = totalRestante - antecipacao - economiaTotal;
  const novaParcelaMensal = restantes > 1 ? Math.round((novoTotal) / (restantes - Math.ceil(antecipacao / parcelaAtual))) : 0;
  const reducaoMensal = Math.max(0, parcelaAtual - novaParcelaMensal);
  const mesesAntecipados = Math.ceil(antecipacao / parcelaAtual);

  const rows = [3, 6, 12].map(meses => ({
    meses,
    liberado: fmtBRL(reducaoMensal * meses),
    economia: fmtBRL(Math.round(antecipacao * reducaoJuros * (meses / restantes))),
  }));

  return (
    <div className="fds-modal-backdrop" onClick={onClose}>
      <div className="fds-modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="fds-modal-head">
          <div>
            <div className="fds-modal-eyebrow">Calculadora</div>
            <div className="fds-modal-title">Simular antecipação</div>
          </div>
          <button className="fds-icon-btn" onClick={onClose}><Icon.X size={16}/></button>
        </div>
        <div className="fds-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="met-simul-origem">
            <span className="met-simul-label">Dívida analisada</span>
            <span className="met-simul-nome">{dívida.desc}</span>
            <span className="met-simul-detalhe">
              {restantes} parcelas restantes de {fmtBRL(parcelaAtual)} · total {fmtBRL(totalRestante)}
            </span>
          </div>

          <div className="fds-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span className="fds-field-label">Quanto você anteciparia hoje</span>
              <strong style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: '-0.02em' }}>
                {fmtBRL(antecipacao)}
              </strong>
            </div>
            <input
              type="range"
              className="met-simul-slider"
              min={Math.round(parcelaAtual)}
              max={Math.round(totalRestante * 0.8)}
              step={Math.round(parcelaAtual / 2)}
              value={antecipacao}
              onChange={e => setAntecipacao(parseInt(e.target.value))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              <span>1 parcela</span>
              <span>80% da dívida</span>
            </div>
          </div>

          <div className="met-simul-resultado">
            <div className="met-simul-stat">
              <span className="met-simul-stat-lbl">Economia em juros</span>
              <span className="met-simul-stat-val ok">+{fmtBRL(economiaTotal)}</span>
            </div>
            <div className="met-simul-stat">
              <span className="met-simul-stat-lbl">Parcelas antecipadas</span>
              <span className="met-simul-stat-val">{mesesAntecipados} {mesesAntecipados === 1 ? 'mês' : 'meses'}</span>
            </div>
            <div className="met-simul-stat">
              <span className="met-simul-stat-lbl">Redução mensal</span>
              <span className="met-simul-stat-val ok">{fmtBRL(reducaoMensal)}/mês</span>
            </div>
          </div>

          <div className="met-simul-table">
            <div className="met-simul-table-head">
              <span>Horizonte</span><span>Dinheiro liberado</span><span>Economia acumulada</span>
            </div>
            {rows.map(r => (
              <div className="met-simul-table-row" key={r.meses}>
                <span>{r.meses} meses</span>
                <span className="ok">{r.liberado}</span>
                <span className="ok">{r.economia}</span>
              </div>
            ))}
          </div>

          <p className="met-simul-disclaimer">
            Simulação baseada em estimativa de 12% de economia sobre o valor antecipado. Consulte seu banco para condições exatas.
          </p>
        </div>
        <div className="fds-modal-foot" style={{ justifyContent: 'flex-end' }}>
          <button className="fds-btn-primary" onClick={onClose}>Entendi</button>
        </div>
      </div>
    </div>
  );
}

// ─── Painel: Revisar assinaturas ──────────────────────────────
function RevisarPanel({ assinaturas, onClose }) {
  const [marcadas, setMarcadas] = React.useState([]);
  if (!assinaturas || assinaturas.length === 0) return null;
  const toggle = (id) => setMarcadas(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );
  const economia = assinaturas
    .filter(t => marcadas.includes(t._id))
    .reduce((s, t) => s + Math.abs(t.val), 0);

  return (
    <div className="fds-modal-backdrop" onClick={onClose}>
      <div className="fds-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="fds-modal-head">
          <div>
            <div className="fds-modal-eyebrow">Revisão</div>
            <div className="fds-modal-title">Assinaturas ativas</div>
          </div>
          <button className="fds-icon-btn" onClick={onClose}><Icon.X size={16}/></button>
        </div>
        <div className="fds-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 }}>
            Marque os serviços que você considera cancelar. O valor que sobra vai direto para as suas metas.
          </p>
          <div className="met-revisar-list">
            {assinaturas.map(t => (
              <label key={t._id} className={`met-revisar-item${marcadas.includes(t._id) ? ' checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={marcadas.includes(t._id)}
                  onChange={() => toggle(t._id)}
                  style={{ display: 'none' }}
                />
                <span className="met-revisar-check">
                  {marcadas.includes(t._id) && <Icon.Check size={12}/>}
                </span>
                <CategoryAvatar cat={t.cat} size={28}/>
                <span className="met-revisar-nome">{t.desc}</span>
                <span className="met-revisar-val">{fmtBRL(Math.abs(t.val))}/mês</span>
              </label>
            ))}
          </div>
          {economia > 0 && (
            <div className="met-revisar-economia">
              <Icon.TrendUp size={14}/> Cancelando estes serviços, você libera{' '}
              <strong>{fmtBRL(economia)}/mês</strong> para as metas.
            </div>
          )}
        </div>
        <div className="fds-modal-foot" style={{ justifyContent: 'flex-end' }}>
          <button className="fds-btn-ghost" onClick={onClose}>Fechar</button>
          {economia > 0 && (
            <button className="fds-btn-primary" onClick={onClose}>
              <Icon.Check size={13}/> Registrei, obrigado
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Painel: Aplicar (Tesouro Selic educativo) ────────────────
function AplicarPanel({ totalContas, onClose }) {
  const taxaMensal = 0.011;
  const meses = [3, 6, 12, 24];
  return (
    <div className="fds-modal-backdrop" onClick={onClose}>
      <div className="fds-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="fds-modal-head">
          <div>
            <div className="fds-modal-eyebrow">Simulação</div>
            <div className="fds-modal-title">Tesouro Selic</div>
          </div>
          <button className="fds-icon-btn" onClick={onClose}><Icon.X size={16}/></button>
        </div>
        <div className="fds-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0, lineHeight: 1.55 }}>
            Você tem <strong>{fmtBRL(totalContas)}</strong> parados em conta corrente. O Tesouro Selic rende ~1,1% ao mês com liquidez diária — você resgata quando precisar.
          </p>
          <div className="met-aplicar-table">
            <div className="met-aplicar-head">
              <span>Prazo</span>
              <span>Rendimento estimado</span>
              <span>Total acumulado</span>
            </div>
            {meses.map(m => {
              const rendimento = totalContas * (Math.pow(1 + taxaMensal, m) - 1);
              return (
                <div className="met-aplicar-row" key={m}>
                  <span>{m < 12 ? `${m} meses` : m === 12 ? '1 ano' : '2 anos'}</span>
                  <span className="ok">+{fmtBRL(Math.round(rendimento))}</span>
                  <span>{fmtBRL(Math.round(totalContas + rendimento))}</span>
                </div>
              );
            })}
          </div>
          <div className="met-aplicar-aviso">
            <Icon.Sparkles size={13}/> Taxa baseada na Selic atual (~13% a.a.). Rentabilidade passada não garante retorno futuro.
          </div>
        </div>
        <div className="fds-modal-foot" style={{ justifyContent: 'flex-end' }}>
          <button className="fds-btn-primary" onClick={onClose}>Entendi</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Configurar distribuição de sobra ──────────────────
function ConfigurarModal({ sobra, metas, onConfirm, onClose }) {
  const [dist, setDist] = React.useState(() =>
    Object.fromEntries(metas.map(m => [m.id, '']))
  );
  const totalDistribuido = Object.values(dist).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const restante = sobra - totalDistribuido;

  return (
    <div className="fds-modal-backdrop" onClick={onClose}>
      <div className="fds-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="fds-modal-head">
          <div>
            <div className="fds-modal-eyebrow">Distribuir sobra</div>
            <div className="fds-modal-title">Aumentar aportes</div>
          </div>
          <button className="fds-icon-btn" onClick={onClose}><Icon.X size={16}/></button>
        </div>
        <div className="fds-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="met-config-sobra">
            <span>Sobra disponível</span>
            <strong style={{ color: restante >= 0 ? 'var(--ok)' : 'var(--bad)' }}>{fmtBRL(restante)}</strong>
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 }}>
            Distribua a sobra entre suas metas aumentando o aporte mensal de cada uma.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {metas.map(m => (
              <div key={m.id} className="met-config-row">
                <span className="met-config-emoji">{m.emoji}</span>
                <div className="met-config-meta">
                  <span className="met-config-nome">{m.nome}</span>
                  <span className="met-config-atual">aporte atual: {fmtBRL(m.contribuicao)}/mês</span>
                </div>
                <div className="met-config-input-wrap">
                  <span className="met-config-prefix">+R$</span>
                  <input
                    className="fds-input met-config-input"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={dist[m.id]}
                    onChange={e => setDist(prev => ({ ...prev, [m.id]: e.target.value }))}
                  />
                </div>
              </div>
            ))}
          </div>
          {restante < 0 && (
            <div className="met-config-aviso">
              <Icon.X size={12}/> Você distribuiu {fmtBRL(Math.abs(restante))} a mais do que a sobra disponível.
            </div>
          )}
        </div>
        <div className="fds-modal-foot" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="fds-btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            className="fds-btn-primary"
            disabled={restante < 0 || totalDistribuido === 0}
            onClick={() => restante >= 0 && totalDistribuido > 0 && onConfirm(dist)}
            style={{ opacity: restante < 0 || totalDistribuido === 0 ? 0.5 : 1 }}
          >
            <Icon.Check size={13}/> Aplicar distribuição
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MetasStudio ──────────────────────────────────────────────
function MetasStudio({ onAdd, onNav }) {
  const { transactions, monthTransactions, selectedMonth, monthLabel } = useFides();
  const today = new Date();
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const lbl = monthLabel(selectedMonth);

  // ─── Local state ───────────────────────────────────────────
  const [localMetas, setLocalMetas] = React.useState(METAS);
  const [addMetaOpen, setAddMetaOpen]   = React.useState(false);

  // Modal states
  const [aportarMeta,    setAportarMeta]    = React.useState(null); // meta object
  const [ajustarMeta,    setAjustarMeta]    = React.useState(null); // meta object
  const [deleteMeta,     setDeleteMeta]     = React.useState(null); // meta object
  const [simularDivida,  setSimularDivida]  = React.useState(null); // tx object
  const [revisarOpen,    setRevisarOpen]    = React.useState(false);
  const [aplicarOpen,    setAplicarOpen]    = React.useState(false);
  const [configurarOpen, setConfigurarOpen] = React.useState(false);

  // ─── Handlers ──────────────────────────────────────────────
  function handleAddMeta(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const alvo    = parseFloat(fd.get('alvo') || '0');
    const atual   = parseFloat(fd.get('atual') || '0');
    const contrib = parseFloat(fd.get('contribuicao') || '0');
    const hoje    = (today.getMonth() + 1) + '/' + today.getFullYear();
    setLocalMetas(prev => [...prev, {
      id: 'meta-' + Date.now(),
      nome: fd.get('nome') || 'Nova meta',
      descricao: fd.get('descricao') || '',
      emoji: fd.get('emoji') || '🎯',
      tint: '#2D5A3D',
      alvo, atual,
      contribuicao: contrib,
      criadaEm: hoje,
    }]);
    setAddMetaOpen(false);
  }

  function handleAporte(metaId, valor) {
    setLocalMetas(prev => prev.map(m => {
      if (m.id !== metaId) return m;
      const novoAtual = m.atual + valor;
      return { ...m, atual: novoAtual };
    }));
    setAportarMeta(null);
  }

  function handleAjustar(metaId, patch) {
    setLocalMetas(prev => prev.map(m => m.id === metaId ? { ...m, ...patch } : m));
    setAjustarMeta(null);
  }

  function handleDelete(metaId) {
    setLocalMetas(prev => prev.filter(m => m.id !== metaId));
    setDeleteMeta(null);
  }

  function handleConfigurar(dist) {
    setLocalMetas(prev => prev.map(m => {
      const extra = parseFloat(dist[m.id]) || 0;
      return extra > 0 ? { ...m, contribuicao: m.contribuicao + extra } : m;
    }));
    setConfigurarOpen(false);
  }

  // ─── Computed ──────────────────────────────────────────────
  const computed = localMetas.map(m => {
    const faltam = Math.max(0, m.alvo - m.atual);
    const pct = m.alvo ? Math.min(1, m.atual / m.alvo) : 0;
    const mesesAteFim = m.contribuicao > 0 ? Math.ceil(faltam / m.contribuicao) : Infinity;
    const fim = new Date(today.getFullYear(), today.getMonth() + mesesAteFim, 1);
    const fimLabel = mesesAteFim === Infinity ? '—' : `${meses[fim.getMonth()]} ${fim.getFullYear()}`;
    const [cmes, cano] = m.criadaEm.split('/').map(s => parseInt(s, 10));
    const mesesDesdeInicio = (today.getFullYear() - cano) * 12 + (today.getMonth() + 1 - cmes);
    const aporteEsperado = mesesDesdeInicio * m.contribuicao;
    return { ...m, faltam, pct, mesesAteFim, fimLabel, mesesDesdeInicio, aporteEsperado };
  });

  const totalGuardado = localMetas.reduce((s, m) => s + m.atual, 0);
  const totalAlvo     = localMetas.reduce((s, m) => s + m.alvo, 0);
  const totalAporte   = localMetas.reduce((s, m) => s + m.contribuicao, 0);
  const pctMedio      = totalAlvo ? (totalGuardado / totalAlvo) : 0;
  const maior         = [...computed].sort((a, b) => b.alvo - a.alvo)[0];
  const proxima       = [...computed].sort((a, b) => a.mesesAteFim - b.mesesAteFim)[0];
  const { int, dec }  = splitBRL(totalGuardado);

  // Dados para os painéis "Como acelerar"
  const dividaParcelada  = transactions.find(t => t.sub && t.cat === 'divida' && t.status === 'pendente');
  const assinaturas      = monthTransactions.filter(t => t.cat === 'assinaturas');
  const totalContas      = ACCOUNTS.reduce((s, a) => s + a.balance, 0);
  const receitas         = monthTransactions.filter(t => t.val > 0).reduce((s,t) => s + t.val, 0);
  const despesas         = monthTransactions.filter(t => t.val < 0).reduce((s,t) => s + Math.abs(t.val), 0);
  const sobra            = receitas - despesas - totalAporte;
  const gastosCat        = {};
  monthTransactions.forEach(t => { if (t.val < 0) gastosCat[t.cat] = (gastosCat[t.cat] || 0) + Math.abs(t.val); });
  const topCat           = Object.entries(gastosCat).sort((a,b) => b[1] - a[1])[0];

  return (
    <div className="fds-page stu-page" data-od-id="metas">

      {/* ─── Modais ─── */}
      <AportarModal
        meta={aportarMeta}
        onConfirm={v => handleAporte(aportarMeta.id, v)}
        onClose={() => setAportarMeta(null)}
      />
      <AjustarPlanoModal
        meta={ajustarMeta}
        onConfirm={patch => handleAjustar(ajustarMeta.id, patch)}
        onClose={() => setAjustarMeta(null)}
      />
      <MetConfirmDeleteModal
        open={!!deleteMeta}
        nome={deleteMeta?.nome}
        onConfirm={() => handleDelete(deleteMeta.id)}
        onCancel={() => setDeleteMeta(null)}
      />
      {simularDivida && <SimularPanel dívida={simularDivida} onClose={() => setSimularDivida(null)}/>}
      {revisarOpen   && <RevisarPanel assinaturas={assinaturas} onClose={() => setRevisarOpen(false)}/>}
      {aplicarOpen   && <AplicarPanel totalContas={totalContas} onClose={() => setAplicarOpen(false)}/>}
      {configurarOpen && (
        <ConfigurarModal
          sobra={sobra}
          metas={localMetas}
          onConfirm={handleConfigurar}
          onClose={() => setConfigurarOpen(false)}
        />
      )}

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
              <div className="fds-modal-row two">
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
                <MetDotsMenu items={[
                  { id: 'editar',    label: 'Editar meta',           icon: 'Edit',   onClick: () => setAjustarMeta(m) },
                  { id: 'concluir',  label: 'Marcar como concluída', icon: 'Trophy', onClick: () => handleAporte(m.id, Math.max(0, m.alvo - m.atual)) },
                  { id: 'excluir',   label: 'Excluir meta',          icon: 'Trash',  danger: true, onClick: () => setDeleteMeta(m) },
                ]}/>
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
                       style={{ width: `${m.pct * 100}%`,
                                background: `linear-gradient(90deg, ${m.tint}, color-mix(in oklab, ${m.tint} 70%, black))`,
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
                <button
                  className="met-card-aportar"
                  style={{ background: m.tint }}
                  onClick={() => setAportarMeta(m)}
                >
                  <Icon.Plus size={13}/> Aportar
                </button>
                <button className="fds-btn-ghost" onClick={() => setAjustarMeta(m)}>
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
          const tips = [];

          if (dividaParcelada) {
            const parcelaTotal = parseInt(dividaParcelada.sub.split('/')[1], 10);
            const economia = Math.round(Math.abs(dividaParcelada.val) * parcelaTotal * 0.12);
            const liberar  = Math.round(Math.abs(dividaParcelada.val) * 0.33);
            tips.push({
              id: 'reneg', icon: 'Refresh', color: 'var(--accent)', bg: 'var(--accent-soft)',
              title: `Renegociar ${dividaParcelada.desc}`,
              desc: <>Parcela atual <strong>{fmtBRL(Math.abs(dividaParcelada.val))}</strong> em <strong>{parcelaTotal} meses</strong>. Antecipando uma parte, economiza ~<strong>{fmtBRL(economia)}</strong> em juros e libera <strong>{fmtBRL(liberar)}/mês</strong>.</>,
              amt: `+${fmtBRL(liberar)}/mês`,
              cta: 'Simular',
              onClick: () => setSimularDivida(dividaParcelada),
            });
          }

          if (assinaturas.length > 0) {
            const totalAssin = assinaturas.reduce((s, t) => s + Math.abs(t.val), 0);
            const maiorAssin = assinaturas.reduce((mx, t) => Math.abs(t.val) > Math.abs(mx.val) ? t : mx, assinaturas[0]);
            tips.push({
              id: 'assin', icon: 'Sparkles', color: '#B45309', bg: '#FEF0D6',
              title: 'Revisar assinaturas',
              desc: <>Você gasta <strong>{fmtBRL(totalAssin)}/mês</strong> em <strong>{assinaturas.length} {assinaturas.length === 1 ? 'serviço' : 'serviços'}</strong>. Cortar <strong>{maiorAssin.desc}</strong> libera <strong>{fmtBRL(Math.abs(maiorAssin.val))}</strong> direto para suas metas.</>,
              amt: `+${fmtBRL(Math.abs(maiorAssin.val))}/mês`,
              cta: 'Revisar',
              onClick: () => setRevisarOpen(true),
            });
          }

          if (totalContas > 3000) {
            const rendimento = Math.round(totalContas * 0.011);
            tips.push({
              id: 'tesouro', icon: 'TrendUp', color: '#0F766E', bg: '#0F766E22',
              title: 'Render dinheiro parado',
              desc: <>Você tem <strong>{fmtBRL(totalContas)}</strong> em conta corrente. Aplicando em Tesouro Selic, renderia <strong>~{fmtBRL(rendimento)}/mês</strong> sem perder liquidez.</>,
              amt: `+${fmtBRL(rendimento)}/mês`,
              cta: 'Aplicar',
              onClick: () => setAplicarOpen(true),
            });
          }

          if (topCat && tips.length < 3) {
            const [catId, val] = topCat;
            tips.push({
              id: 'cat', icon: 'Goal', color: '#7C3AED', bg: '#7C3AED22',
              title: `Otimizar ${catId === 'divida' ? 'dívidas' : catId === 'mercado' ? 'mercado' : catId}`,
              desc: <>Sua maior categoria este mês é <strong>{catId}</strong> com <strong>{fmtBRL(val)}</strong>. Reduzir 10% liberaria <strong>{fmtBRL(val * 0.1)}/mês</strong> para as metas.</>,
              amt: `+${fmtBRL(val * 0.1)}/mês`,
              cta: 'Estudar',
              onClick: () => onNav?.('orcamento'),
            });
          }

          if (sobra > 200 && tips.length < 3) {
            tips.push({
              id: 'aporte', icon: 'TrendUp', color: 'var(--ok)', bg: 'var(--ok-soft)',
              title: 'Aumentar aporte mensal',
              desc: <>Depois das despesas e aportes atuais, sobram <strong>{fmtBRL(sobra)}</strong>. Redistribuir metade entre as metas antecipa a chegada de todas elas.</>,
              amt: `+${fmtBRL(sobra * 0.5)}/mês`,
              cta: 'Configurar',
              onClick: () => setConfigurarOpen(true),
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
                    <button className="stu-link" onClick={t.onClick}>{t.cta} →</button>
                  </div>
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* ─── Capítulo III · Já atingidas ─── */}
      <ChapterMark roman="III" title="Já atingidas" caption="Suas conquistas — para lembrar"/>
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
                <span className="met-done-tag"><Icon.Check size={11}/> Concluída</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { MetasStudio });
