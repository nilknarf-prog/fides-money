// fides-contas.jsx — Studio "Contas & cartões" page

// ─── Logos bancárias ─────────────────────────────────────────
const BANK_MAP = {
  nubank:      { file: 'nubank.svg',      bg: '#820AD1' },
  bradesco:    { file: 'bradesco.svg',    bg: '#CC092F' },
  inter:       { file: 'inter.svg',       bg: '#FF6600' },
  bancointer:  { file: 'inter.svg',       bg: '#FF6600' },
  c6:          { file: 'c6bank.svg',      bg: '#242424' },
  c6bank:      { file: 'c6bank.svg',      bg: '#242424' },
  picpay:      { file: 'picpay.svg',      bg: '#21C25E' },
  infinitepay: { file: 'infinitepay.svg', bg: '#00B14F' },
  infinity:    { file: 'infinitepay.svg', bg: '#00B14F' },
  caixa:       { file: 'caixa.svg',       bg: '#005CA9' },
  itau:        { file: 'itau.svg',        bg: '#003087' },
  santander:   { file: 'santander.svg',   bg: '#EC0000' },
};

function BankLogo({ bank = '', name = '', size = 40 }) {
  const key = (bank + name).toLowerCase().replace(/[\s\-_\.]/g, '');
  const match = Object.entries(BANK_MAP).find(([k]) => key.includes(k));
  const initials = (name || bank).trim().split(' ')
    .map(w => w[0]).join('').slice(0, 2).toUpperCase();

  if (match) {
    const { file, bg } = match[1];
    return (
      <div style={{
        width: size, height: size, borderRadius: 10,
        background: bg, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, overflow: 'hidden',
      }}>
        <img
          src={`assets/banks/${file}`}
          alt={name || bank}
          width={size * 0.62}
          height={size * 0.62}
          style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
          onError={e => { e.target.style.display = 'none'; }}
        />
      </div>
    );
  }

  // Fallback: iniciais com cor automática
  const colors = ['#4F46E5','#0891B2','#059669','#D97706','#DC2626'];
  const bg = colors[(initials.charCodeAt(0) || 0) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: 10,
      background: bg, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, color: '#fff',
      fontFamily: 'var(--font-display)',
      fontWeight: 700, fontSize: size * 0.35,
    }}>
      {initials || '?'}
    </div>
  );
}

// ─── Ícones locais (não estão no Icon global) ─────────────────
const __ctnIco = (paths) => ({ size = 16, style, className }) =>
  React.createElement('svg', {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
    style, className,
  }, paths);

const CtnIcon = {
  Edit:  __ctnIco(React.createElement(React.Fragment, null,
    React.createElement('path', { d: 'M11 4H5a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-6' }),
    React.createElement('path', { d: 'M17.5 2.5a2.12 2.12 0 013 3L12 14l-4 1 1-4 7.5-8.5z' }),
  )),
  Trash: __ctnIco(React.createElement(React.Fragment, null,
    React.createElement('polyline', { points: '3 6 5 6 21 6' }),
    React.createElement('path', { d: 'M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2' }),
  )),
};

// ─── DotsMenu — dropdown contextual reutilizável ──────────────
// Props:
//   items: Array<{ id, label, icon, danger?, onClick }>
//   align: 'left' | 'right' (default 'right')
function DotsMenu({ items, align = 'right' }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  return (
    <div className="ctn-dots-wrap" ref={ref}>
      <button
        className="fds-icon-btn"
        aria-label="Opções"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(v => !v)}
        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
      >
        <Icon.Dots size={16}/>
      </button>

      {open && (
        <div
          className={`ctn-dots-dd ${align === 'left' ? 'ctn-dots-dd--left' : ''}`}
          role="menu"
          onClick={e => e.stopPropagation()}
        >
          {items.map(item => {
            const Ic = item.icon ? (CtnIcon[item.icon] || Icon[item.icon] || null) : null;
            return (
              <button
                key={item.id}
                role="menuitem"
                className={`ctn-dots-item${item.danger ? ' danger' : ''}`}
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

// ─── ConfirmDeleteModal ────────────────────────────────────────
function ConfirmDeleteModal({ open, title, desc, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fds-modal-backdrop" onClick={onCancel}>
      <div className="fds-modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="fds-modal-head">
          <div className="fds-modal-title" style={{ color: 'var(--bad)' }}>
            <CtnIcon.Trash size={16} style={{ marginRight: 8, verticalAlign: 'middle' }}/>
            {title}
          </div>
          <button className="fds-icon-btn" onClick={onCancel}><Icon.X size={16}/></button>
        </div>
        <div className="fds-modal-body">
          <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, margin: 0 }}>{desc}</p>
        </div>
        <div className="fds-modal-foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="fds-btn-ghost" onClick={onCancel}>Cancelar</button>
          <button
            className="fds-btn-primary"
            style={{ background: 'var(--bad)' }}
            onClick={onConfirm}
          >
            <CtnIcon.Trash size={13}/> Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

function ContasStudio({ onAdd }) {
  const { transactions, categories, payCartaoFatura, faturasPorCartao, selectedMonth, monthLabel } = useFides();
  const lbl = monthLabel(selectedMonth);

  // ─── Local state extends ACCOUNTS / CARDS ─────────────────
  const [localAccounts, setLocalAccounts] = React.useState(ACCOUNTS);
  const [localCards, setLocalCards]       = React.useState(CARDS);
  const [addModal, setAddModal]           = React.useState(null); // 'conta' | 'cartao'
  const [editConta, setEditConta]   = React.useState(null);
  const [editCartao, setEditCartao] = React.useState(null);
  const [deleteTarget, setDeleteTarget] = React.useState(null);

  const BANK_COLORS = ['#2D5A3D','#2C5282','#B45309','#7C3AED','#0F766E','#9B2C2C'];

  function handleAddConta(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const newAcct = {
      id:      'acct-' + Date.now(),
      name:    fd.get('name') || 'Nova conta',
      type:    fd.get('type') || 'corrente',
      tag:     fd.get('tag') || '0000',
      balance: parseFloat(fd.get('balance') || '0'),
      color:   BANK_COLORS[localAccounts.length % BANK_COLORS.length],
    };
    setLocalAccounts(prev => [...prev, newAcct]);
    setAddModal(null);
  }

  function handleAddCartao(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const newCard = {
      id:            'card-' + Date.now(),
      name:          fd.get('name') || 'Novo cartão',
      tag:           fd.get('tag') || '0000',
      limit:         parseFloat(fd.get('limit') || '0'),
      used:          0,
      due:           fd.get('due') || '10',
      diaFechamento: fd.get('fechamento') || '03',
    };
    setLocalCards(prev => [...prev, newCard]);
    setAddModal(null);
  }

  function handleEditConta(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    setLocalAccounts(prev => prev.map(a =>
      a.id === editConta.id
        ? { ...a, name: fd.get('name') || a.name, type: fd.get('type') || a.type, tag: fd.get('tag') || a.tag, balance: parseFloat(fd.get('balance') ?? a.balance) }
        : a
    ));
    setEditConta(null);
  }

  function handleEditCartao(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    setLocalCards(prev => prev.map(c =>
      c.id === editCartao.id
        ? { ...c, name: fd.get('name') || c.name, tag: fd.get('tag') || c.tag, limit: parseFloat(fd.get('limit') ?? c.limit), due: fd.get('due') || c.due, diaFechamento: fd.get('fechamento') || c.diaFechamento }
        : c
    ));
    setEditCartao(null);
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'conta') {
      setLocalAccounts(prev => prev.filter(a => a.id !== deleteTarget.id));
    } else {
      setLocalCards(prev => prev.filter(c => c.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  }

  // ─── Totals use localAccounts / localCards ─────────────────
  const totalContas = localAccounts.reduce((s, a) => s + a.balance, 0);
  const totalUsadoCartoes = localCards.reduce((s, c) => s + c.used, 0);
  const totalLimiteCartoes = localCards.reduce((s, c) => s + c.limit, 0);
  const proximaFatura = localCards.reduce((m, c) =>
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
    <div className="fds-page stu-page" data-od-id="contas">
      {/* ─── Modals ─── */}
      <ConfirmDeleteModal
        open={!!deleteTarget}
        title={deleteTarget?.type === 'conta' ? 'Excluir conta' : 'Excluir cartão'}
        desc={deleteTarget?.type === 'conta'
          ? `Tem certeza que deseja excluir a conta "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`
          : `Tem certeza que deseja excluir o cartão "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {editConta && (
        <div className="fds-modal-backdrop" onClick={() => setEditConta(null)}>
          <div className="fds-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="fds-modal-head">
              <div>
                <div className="fds-modal-eyebrow">Editar</div>
                <div className="fds-modal-title">{editConta.name}</div>
              </div>
              <button className="fds-icon-btn" onClick={() => setEditConta(null)}><Icon.X size={16}/></button>
            </div>
            <form className="fds-modal-body" onSubmit={handleEditConta} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="fds-modal-row two">
                <label className="fds-field"><span>Nome do banco</span><input className="fds-input" name="name" defaultValue={editConta.name} required/></label>
                <label className="fds-field"><span>Tipo</span><select className="fds-input" name="type" defaultValue={editConta.type}><option value="corrente">Corrente</option><option value="digital">Digital</option><option value="poupança">Poupança</option></select></label>
              </div>
              <div className="fds-modal-row two">
                <label className="fds-field"><span>Últimos 4 dígitos</span><input className="fds-input" name="tag" defaultValue={editConta.tag} maxLength={4}/></label>
                <label className="fds-field"><span>Saldo atual (R$)</span><input className="fds-input" name="balance" type="number" step="0.01" defaultValue={editConta.balance}/></label>
              </div>
              <div className="fds-modal-foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 0 0' }}>
                <button type="button" className="fds-btn-ghost" onClick={() => setEditConta(null)}>Cancelar</button>
                <button type="submit" className="fds-btn-primary"><Icon.Check size={13}/> Salvar alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editCartao && (
        <div className="fds-modal-backdrop" onClick={() => setEditCartao(null)}>
          <div className="fds-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="fds-modal-head">
              <div>
                <div className="fds-modal-eyebrow">Editar</div>
                <div className="fds-modal-title">{editCartao.name}</div>
              </div>
              <button className="fds-icon-btn" onClick={() => setEditCartao(null)}><Icon.X size={16}/></button>
            </div>
            <form className="fds-modal-body" onSubmit={handleEditCartao} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="fds-modal-row two">
                <label className="fds-field"><span>Nome do cartão</span><input className="fds-input" name="name" defaultValue={editCartao.name} required/></label>
                <label className="fds-field"><span>Últimos 4 dígitos</span><input className="fds-input" name="tag" defaultValue={editCartao.tag.replace(/[^\d]/g,'')} maxLength={4}/></label>
              </div>
              <div className="fds-modal-row two">
                <label className="fds-field"><span>Limite total (R$)</span><input className="fds-input" name="limit" type="number" step="0.01" defaultValue={editCartao.limit} required/></label>
                <label className="fds-field"><span>Vencimento (dia)</span><input className="fds-input" name="due" type="number" min={1} max={31} defaultValue={String(editCartao.diaVencimento || editCartao.due || '')}/></label>
              </div>
              <label className="fds-field"><span>Fechamento da fatura (dia)</span><input className="fds-input" name="fechamento" type="number" min={1} max={31} defaultValue={editCartao.diaFechamento}/></label>
              <div className="fds-modal-foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 0 0' }}>
                <button type="button" className="fds-btn-ghost" onClick={() => setEditCartao(null)}>Cancelar</button>
                <button type="submit" className="fds-btn-primary"><Icon.Check size={13}/> Salvar alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addModal === 'conta' && (
        <div className="fds-modal-backdrop" onClick={() => setAddModal(null)}>
          <div className="fds-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="fds-modal-head">
              <div className="fds-modal-title">Adicionar conta</div>
              <button className="fds-icon-btn" onClick={() => setAddModal(null)}><Icon.X size={16}/></button>
            </div>
            <form className="fds-modal-body" onSubmit={handleAddConta} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="fds-modal-row two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="fds-field">
                  <span>Nome do banco</span>
                  <input className="fds-input" name="name" placeholder="Ex: Bradesco" required/>
                </label>
                <label className="fds-field">
                  <span>Tipo</span>
                  <select className="fds-input" name="type">
                    <option value="corrente">Corrente</option>
                    <option value="digital">Digital</option>
                    <option value="poupança">Poupança</option>
                  </select>
                </label>
              </div>
              <div className="fds-modal-row two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="fds-field">
                  <span>Últimos 4 dígitos</span>
                  <input className="fds-input" name="tag" placeholder="0000" maxLength={4}/>
                </label>
                <label className="fds-field">
                  <span>Saldo inicial (R$)</span>
                  <input className="fds-input" name="balance" type="number" step="0.01" placeholder="0,00"/>
                </label>
              </div>
              <div className="fds-modal-foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 0 0' }}>
                <button type="button" className="fds-btn-ghost" onClick={() => setAddModal(null)}>Cancelar</button>
                <button type="submit" className="fds-btn-primary"><Icon.Check size={13}/> Adicionar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addModal === 'cartao' && (
        <div className="fds-modal-backdrop" onClick={() => setAddModal(null)}>
          <div className="fds-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="fds-modal-head">
              <div className="fds-modal-title">Adicionar cartão</div>
              <button className="fds-icon-btn" onClick={() => setAddModal(null)}><Icon.X size={16}/></button>
            </div>
            <form className="fds-modal-body" onSubmit={handleAddCartao} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="fds-modal-row two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="fds-field">
                  <span>Nome do cartão</span>
                  <input className="fds-input" name="name" placeholder="Ex: Nubank Roxinho" required/>
                </label>
                <label className="fds-field">
                  <span>Últimos 4 dígitos</span>
                  <input className="fds-input" name="tag" placeholder="0000" maxLength={4}/>
                </label>
              </div>
              <div className="fds-modal-row two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="fds-field">
                  <span>Limite total (R$)</span>
                  <input className="fds-input" name="limit" type="number" step="0.01" placeholder="0,00" required/>
                </label>
                <label className="fds-field">
                  <span>Vencimento (dia)</span>
                  <input className="fds-input" name="due" type="number" min={1} max={31} placeholder="10"/>
                </label>
              </div>
              <label className="fds-field">
                <span>Fechamento da fatura (dia)</span>
                <input className="fds-input" name="fechamento" type="number" min={1} max={31} placeholder="03"/>
              </label>
              <div className="fds-modal-foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 0 0' }}>
                <button type="button" className="fds-btn-ghost" onClick={() => setAddModal(null)}>Cancelar</button>
                <button type="submit" className="fds-btn-primary"><Icon.Check size={13}/> Adicionar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <section className="stu-hero" data-od-id="ctn-hero">
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
          <strong className="stu-num">{localAccounts.length} contas</strong> ativas e{' '}
          <strong className="stu-num">{localCards.length} cartões</strong> abertos. Você comprometeu{' '}
          <strong className="stu-num">{fmtBRL(totalUsadoCartoes)}</strong> de{' '}
          <strong className="stu-num">{fmtBRL(totalLimiteCartoes)}</strong> em limite — {((totalUsadoCartoes/totalLimiteCartoes)*100).toFixed(0)}%.
          {proximaFatura && <> Próxima fatura: <strong className="stu-num">{proximaFatura.name}</strong> vence em <em>{proximaFatura.due}</em>.</>}
        </p>

        <div className="stu-hero-strip" data-od-id="ctn-hero-strip">
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
                   caption={`${localAccounts.length} contas correntes e digitais`}
                   action={<button className="stu-link" onClick={() => setAddModal('conta')}><Icon.Plus size={12}/> Adicionar conta</button>}/>
      <div className="ctn-accounts" data-od-id="ctn-lista-contas">
        {localAccounts.map(a => {
          const txs = txByAcct(a.id);
          const last = lastByAcct(a.id);
          const last7 = acctHistory[a.id] || [a.balance];
          const delta = last7[last7.length - 1] - last7[0];
          const deltaPct = last7[0] ? (delta / last7[0]) * 100 : 0;
          return (
            <div className="ctn-account" key={a.id}>
              <div className="ctn-account-head">
                <BankLogo bank={a.bank || ''} name={a.name || ''} size={40}/>
                <div className="ctn-account-meta">
                  <div className="ctn-account-name">{a.name}</div>
                  <div className="ctn-account-tag">
                    Conta {a.type === 'digital' ? 'digital' : 'corrente'} · ••{a.tag}
                  </div>
                </div>
                <DotsMenu
                  align="left"
                  items={[
                    { id: 'edit', label: 'Editar conta', icon: 'Edit', onClick: () => setEditConta(a) },
                    { id: 'delete', label: 'Excluir conta', icon: 'Trash', danger: true, onClick: () => setDeleteTarget({ type: 'conta', id: a.id, name: a.name }) },
                  ]}
                />
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
                   caption={`${localCards.length} cartões · ${fmtBRL(totalUsadoCartoes)} de fatura aberta`}
                   action={<button className="stu-link" onClick={() => setAddModal('cartao')}><Icon.Plus size={12}/> Adicionar cartão</button>}/>
      <div className="ctn-cards" data-od-id="ctn-lista-cartoes">
        {localCards.map(c => {
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
                    <BankLogo bank={c.bank || ''} name={c.name || ''} size={28}/>
                    <span>{c.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon.Wifi size={16}/>
                    <DotsMenu
                      align="left"
                      items={[
                        { id: 'edit', label: 'Editar cartão', icon: 'Edit', onClick: () => setEditCartao(c) },
                        { id: 'delete', label: 'Excluir cartão', icon: 'Trash', danger: true, onClick: () => setDeleteTarget({ type: 'cartao', id: c.id, name: c.name }) },
                      ]}
                    />
                  </div>
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
      <div className="stu-card ctn-dist" data-od-id="ctn-distribuicao">
        <div className="ctn-dist-bar">
          {ACCOUNTS.map(a => {
            const w = (a.balance / totalContas) * 100;
            return (
              <div key={a.id} className="ctn-dist-seg"
                   style={{ width: `${w}%`, background: a.color }}
                   title={`${a.name}: ${w.toFixed(1)}%`}/>
            );
          })}
        </div>
        <div className="ctn-dist-rows">
          {ACCOUNTS.map(a => {
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
    </div>
  );
}

Object.assign(window, { ContasStudio });
