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

function PagarFaturaModal({ modal, accounts = [], onClose, onConfirm }) {
  const { categories } = useFides();
  const [selected, setSelected] = React.useState(() =>
    new Set(modal.txs.map(t => t._id))
  );
  const [selectedAccount, setSelectedAccount] = React.useState(accounts[0]?.id || '');

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selected.size === modal.txs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(modal.txs.map(t => t._id)));
    }
  };

  const totalSelecionado = modal.txs
    .filter(t => selected.has(t._id))
    .reduce((sum, t) => sum + Math.abs(t.val), 0);

  const allSelected = selected.size === modal.txs.length;
  const noneSelected = selected.size === 0;

  const selectedAcct      = accounts.find(a => a.id === selectedAccount);
  const semContas         = accounts.length === 0;
  const saldoInsuficiente = selectedAcct && selectedAcct.balance < totalSelecionado;

  return (
    <div className="fds-modal-backdrop" onClick={onClose}
         style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      <div className="fds-modal" style={{ maxWidth: 480 }}
           onClick={e => e.stopPropagation()}>

        <div className="fds-modal-head">
          <div>
            <div className="fds-modal-eyebrow">Pagar fatura</div>
            <div className="fds-modal-title">{modal.cardName}</div>
          </div>
          <button className="fds-icon-btn" onClick={onClose}
                  style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>
            <Icon.X size={16}/>
          </button>
        </div>

        <div className="fds-modal-body" style={{ padding: '0 0 4px' }}>

          {/* Linha selecionar todos */}
          <div className="pfm-select-all">
            <button className="pfm-check-btn" onClick={toggleAll}
                    style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>
              <span className={`pfm-checkbox ${allSelected ? 'checked' : ''}`}>
                {allSelected && <Icon.Check size={11}/>}
              </span>
              <span className="pfm-select-all-lbl">
                {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
              </span>
            </button>
            <span className="pfm-count">{selected.size} de {modal.txs.length}</span>
          </div>

          {/* Lista de transações */}
          <div className="pfm-list">
            {modal.txs.map(t => {
              const cat = categories[t.cat] || { label: t.cat, emoji: '🏷️', tint: '#888' };
              const isSelected = selected.has(t._id);
              return (
                <button key={t._id}
                        className={`pfm-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggle(t._id)}
                        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>
                  <span className={`pfm-checkbox ${isSelected ? 'checked' : ''}`}>
                    {isSelected && <Icon.Check size={11}/>}
                  </span>
                  <CategoryAvatar cat={t.cat} size={28}/>
                  <span className="pfm-item-desc">{t.desc}</span>
                  <span className="pfm-item-d">{t.d}</span>
                  <span className="pfm-item-val">
                    −R$ {Math.abs(t.val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Débitar da conta */}
          <div style={{ padding: '12px 16px 4px' }}>
            {semContas ? (
              <div style={{ color: 'var(--bad)', fontSize: 13 }}>
                Você não tem contas cadastradas. Adicione uma conta primeiro.
              </div>
            ) : (
              <>
                <label className="fds-field">
                  <span>Débitar da conta</span>
                  <select className="fds-input" value={selectedAccount}
                          onChange={e => setSelectedAccount(e.target.value)}
                          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', minHeight: 44, fontSize: 16 }}>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} · saldo {fmtBRL(a.balance)}
                      </option>
                    ))}
                  </select>
                </label>
                {saldoInsuficiente && (
                  <div style={{ color: 'var(--bad)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <Icon.X size={13}/>
                    Saldo insuficiente — faltam {fmtBRL(totalSelecionado - (selectedAcct?.balance || 0))}.
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="fds-modal-foot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div className="pfm-total">
            <span className="pfm-total-lbl">Total selecionado</span>
            <span className="pfm-total-val">{fmtBRL(totalSelecionado)}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="fds-btn-ghost" onClick={onClose}
                    style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', minHeight: 44 }}>
              Cancelar
            </button>
            <button className="fds-btn-primary"
                    disabled={noneSelected || semContas || saldoInsuficiente || !selectedAccount}
                    onClick={() => onConfirm({ txIds: [...selected], accountId: selectedAccount })}
                    style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', minHeight: 44 }}>
              <Icon.Check size={13}/>
              Confirmar pagamento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ColorPicker ──────────────────────────────────────────────
const CTN_TINTS = (typeof CATEGORY_TINTS !== 'undefined' ? CATEGORY_TINTS : null) ||
  ['#F59E0B','#EF4444','#DC2626','#7C3AED','#0EA5E9','#16A34A','#F97316',
   '#0891B2','#CA8A04','#EC4899','#A855F7','#22C55E','#8B5CF6','#06B6D4',
   '#F43F5E','#B91C1C','#0F766E','#10B981','#84CC16','#3B82F6','#6366F1'];

function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
      {CTN_TINTS.map(t => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            minWidth: 44, minHeight: 44,
            padding: 10,
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          aria-label={`Cor ${t}`}
        >
          <span style={{
            display: 'block',
            width: 20, height: 20,
            borderRadius: '50%',
            background: t,
            boxSizing: 'border-box',
            boxShadow: value === t
              ? `0 0 0 2px var(--surface, #fff), 0 0 0 4px ${t}`
              : 'none',
          }}/>
        </button>
      ))}
    </div>
  );
}

function ContasStudio({ onAdd }) {
  const {
    transactions, categories, payCartaoFatura, updateTransaction,
    faturaAbertaPorCartao, selectedMonth, monthLabel,
    accounts, cards,
    addAccount, addCard, updateAccount, deleteAccount, updateCard, deleteCard,
  } = useFides();
  const lbl = monthLabel(selectedMonth);

  const [addModal, setAddModal]         = React.useState(null);
  const [editConta, setEditConta]       = React.useState(null);
  const [editCartao, setEditCartao]     = React.useState(null);
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [payModal, setPayModal]         = React.useState(null);

  const BANK_COLORS = ['#2D5A3D','#2C5282','#B45309','#7C3AED','#0F766E','#9B2C2C'];
  const [addContaColor,   setAddContaColor]   = React.useState(BANK_COLORS[0]);
  const [addCartaoColor,  setAddCartaoColor]  = React.useState('#1A1A2E');
  const [editContaColor,  setEditContaColor]  = React.useState('#00C37B');
  const [editCartaoColor, setEditCartaoColor] = React.useState('#1A1A2E');
  // Lote 4E — preview do ciclo da fatura
  const [pvEditFechamento, setPvEditFechamento] = React.useState('');
  const [pvEditDue,        setPvEditDue       ] = React.useState('');
  const [pvAddFechamento,  setPvAddFechamento ] = React.useState('');
  const [pvAddDue,         setPvAddDue        ] = React.useState('');

  async function handleAddConta(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    await addAccount({
      name:    fd.get('name')    || 'Nova conta',
      type:    fd.get('type')    || 'corrente',
      tag:     fd.get('tag')     || '',
      balance: parseFloat(fd.get('balance') || '0'),
      color:   addContaColor,
    });
    setAddModal(null);
  }

  async function handleAddCartao(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    await addCard({
      name:          fd.get('name')      || 'Novo cartão',
      tag:           fd.get('tag')       || '',
      limit:         parseFloat(fd.get('limit') || '0'),
      due:           fd.get('due')       || '10',
      diaFechamento: fd.get('fechamento') || '03',
      color:         addCartaoColor,
    });
    setAddModal(null);
  }

  async function handleEditConta(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    await updateAccount(editConta.id, {
      name:    fd.get('name')    || editConta.name,
      type:    fd.get('type')    || editConta.type,
      tag:     fd.get('tag')     || editConta.tag,
      balance: parseFloat(fd.get('balance') ?? editConta.balance),
      color:   editContaColor,
    });
    setEditConta(null);
  }

  async function handleEditCartao(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    await updateCard(editCartao.id, {
      name:          fd.get('name')       || editCartao.name,
      tag:           fd.get('tag')        || editCartao.tag,
      limit:         parseFloat(fd.get('limit') ?? editCartao.limit),
      due:           fd.get('due')        || editCartao.due,
      diaFechamento: fd.get('fechamento') || editCartao.diaFechamento,
      color:         editCartaoColor,
    });
    setEditCartao(null);
  }

  const openAddContaModal  = () => { setAddModal('conta');  setAddContaColor(BANK_COLORS[accounts.length % BANK_COLORS.length]); };
  const openAddCartaoModal = () => { setAddModal('cartao'); setAddCartaoColor('#1A1A2E'); };

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'conta') {
      await deleteAccount(deleteTarget.id);
    } else {
      await deleteCard(deleteTarget.id);
    }
    setDeleteTarget(null);
  }

  // ─── Totals use store accounts / cards ─────────────────────
  const totalContas         = accounts.reduce((s, a) => s + a.balance, 0);
  const totalUsadoCartoes   = cards.reduce((s, c) => s + c.used, 0);
  const totalLimiteCartoes  = cards.reduce((s, c) => s + c.limit, 0);
  const proximaFatura       = cards.reduce((m, c) =>
    (!m || c.due < m.due) ? c : m, null);

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
              <div className="fds-field">
                <span className="fds-field-lbl" style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 2 }}>Cor de identificação</span>
                <ColorPicker value={editContaColor} onChange={setEditContaColor}/>
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
                <label className="fds-field"><span>Vencimento da fatura (dia)</span><input className="fds-input" name="due" type="number" min={1} max={31} defaultValue={String(editCartao.diaVencimento || editCartao.due || '')} onChange={e => setPvEditDue(e.target.value)}/></label>
              </div>
              <label className="fds-field">
                <span>Melhor data de compra (dia)</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--ink-3, #888)', display: 'block', marginBottom: 2 }}>Quando começa o próximo ciclo (ex: todo dia 19)</span>
                <input className="fds-input" name="fechamento" type="number" min={1} max={31} defaultValue={editCartao.diaFechamento} onChange={e => setPvEditFechamento(e.target.value)}/>
              </label>
              {(pvEditFechamento || pvEditDue) && (
                <div style={{ background: 'var(--surface-alt, #f5f0eb)', borderRadius: 8, padding: '10px 14px', fontSize: '0.78rem', color: 'var(--ink-3, #666)', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--ink, #333)' }}>📅 Ciclo da fatura</div>
                  {pvEditFechamento && <div>• Compras até dia {parseInt(pvEditFechamento) - 1 || '—'} → fatura atual{pvEditDue ? ` (vence dia ${pvEditDue})` : ''}</div>}
                  {pvEditFechamento && <div>• Do dia {pvEditFechamento} em diante → próxima fatura</div>}
                  {pvEditFechamento && <div style={{ marginTop: 4, color: 'var(--ok, #2e7d32)', fontSize: '0.74rem' }}>💡 Melhor dia para parcelar: dia {pvEditFechamento}</div>}
                </div>
              )}
              <div className="fds-field">
                <span className="fds-field-lbl" style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 2 }}>Cor do cartão</span>
                <ColorPicker value={editCartaoColor} onChange={setEditCartaoColor}/>
              </div>
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
                  <input className="fds-input" name="tag" placeholder="Opcional" maxLength={4}/>
                </label>
                <label className="fds-field">
                  <span>Saldo inicial (R$)</span>
                  <input className="fds-input" name="balance" type="number" step="0.01" placeholder="0,00"/>
                </label>
              </div>
              <div className="fds-field">
                <span className="fds-field-lbl" style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 2 }}>Cor de identificação</span>
                <ColorPicker value={addContaColor} onChange={setAddContaColor}/>
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
                  <input className="fds-input" name="tag" placeholder="Opcional" maxLength={4}/>
                </label>
              </div>
              <div className="fds-modal-row two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="fds-field">
                  <span>Limite total (R$)</span>
                  <input className="fds-input" name="limit" type="number" step="0.01" placeholder="0,00" required/>
                </label>
                <label className="fds-field">
                  <span>Vencimento da fatura (dia)</span>
                  <input className="fds-input" name="due" type="number" min={1} max={31} placeholder="10" onChange={e => setPvAddDue(e.target.value)}/>
                </label>
              </div>
              <label className="fds-field">
                <span>Melhor data de compra (dia)</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--ink-3, #888)', display: 'block', marginBottom: 2 }}>Quando começa o próximo ciclo (ex: todo dia 19)</span>
                <input className="fds-input" name="fechamento" type="number" min={1} max={31} placeholder="03" onChange={e => setPvAddFechamento(e.target.value)}/>
              </label>
              {(pvAddFechamento || pvAddDue) && (
                <div style={{ background: 'var(--surface-alt, #f5f0eb)', borderRadius: 8, padding: '10px 14px', fontSize: '0.78rem', color: 'var(--ink-3, #666)', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--ink, #333)' }}>📅 Ciclo da fatura</div>
                  {pvAddFechamento && <div>• Compras até dia {parseInt(pvAddFechamento) - 1 || '—'} → fatura atual{pvAddDue ? ` (vence dia ${pvAddDue})` : ''}</div>}
                  {pvAddFechamento && <div>• Do dia {pvAddFechamento} em diante → próxima fatura</div>}
                  {pvAddFechamento && <div style={{ marginTop: 4, color: 'var(--ok, #2e7d32)', fontSize: '0.74rem' }}>💡 Melhor dia para parcelar: dia {pvAddFechamento}</div>}
                </div>
              )}
              <div className="fds-field">
                <span className="fds-field-lbl" style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 2 }}>Cor do cartão</span>
                <ColorPicker value={addCartaoColor} onChange={setAddCartaoColor}/>
              </div>
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
          <strong className="stu-num">{accounts.length} contas</strong> ativas e{' '}
          <strong className="stu-num">{cards.length} cartões</strong> abertos. Você comprometeu{' '}
          <strong className="stu-num">{fmtBRL(totalUsadoCartoes)}</strong> de{' '}
          <strong className="stu-num">{fmtBRL(totalLimiteCartoes)}</strong> em limite — {totalLimiteCartoes ? ((totalUsadoCartoes/totalLimiteCartoes)*100).toFixed(0) : 0}%.
          {proximaFatura && <> Próxima fatura: <strong className="stu-num">{proximaFatura.name}</strong> vence em <em>{proximaFatura.due}</em>.</>}
        </p>

        <div className="stu-hero-strip" data-od-id="ctn-hero-strip">
          <div className="stu-metric">
            <div className="stu-metric-lbl">Saldo em contas</div>
            <div className="stu-metric-val pos">{fmtBRL(totalContas)}</div>
            <div className="stu-metric-tag" style={{ color: 'var(--muted)' }}>
              <Icon.Bank size={11}/> {accounts.length} contas
            </div>
          </div>
          <div className="stu-metric-sep"/>
          <div className="stu-metric">
            <div className="stu-metric-lbl">Usado em crédito</div>
            <div className="stu-metric-val">−{fmtBRL(totalUsadoCartoes)}</div>
            <ProgressBar value={totalLimiteCartoes ? totalUsadoCartoes/totalLimiteCartoes : 0} tint="var(--accent)" glow/>
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
                   action={<button className="stu-link" onClick={openAddContaModal}><Icon.Plus size={12}/> Adicionar conta</button>}/>
      <div className="ctn-accounts" data-od-id="ctn-lista-contas">
        {accounts.length === 0 ? (
          <div className="fds-empty-state">
            <div className="fds-empty-state-icon">🏦</div>
            <h2 className="fds-empty-state-title">Nenhuma conta cadastrada</h2>
            <p className="fds-empty-state-lede">
              Adicione sua primeira conta para acompanhar seu saldo e movimentações.
            </p>
            <button className="fds-empty-state-btn" onClick={openAddContaModal}
                    style={{ touchAction: 'manipulation', minHeight: 44 }}>
              + Adicionar primeira conta
            </button>
          </div>
        ) : accounts.map(a => {
          const txs = txByAcct(a.id);
          const last = lastByAcct(a.id);
          // Sem histórico real disponível: linha plana no saldo atual.
          const last7 = [a.balance, a.balance];
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
                    { id: 'edit',   label: 'Editar conta',  icon: 'Edit',  onClick: () => { setEditConta(a); setEditContaColor(a.color || '#00C37B'); } },
                    { id: 'delete', label: 'Excluir conta', icon: 'Trash', danger: true, onClick: () => setDeleteTarget({ type: 'conta', id: a.id, name: a.name }) },
                  ]}
                />
              </div>

              <div className="ctn-account-bal-row">
                <div>
                  <div className="ctn-account-bal-lbl">Saldo atual</div>
                  <div className="ctn-account-bal">{fmtBRL(a.balance)}</div>
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
                   action={<button className="stu-link" onClick={openAddCartaoModal}><Icon.Plus size={12}/> Adicionar cartão</button>}/>
      <div className="ctn-cards" data-od-id="ctn-lista-cartoes">
        {cards.length === 0 ? (
          <div className="fds-empty-state">
            <div className="fds-empty-state-icon">💳</div>
            <h2 className="fds-empty-state-title">Nenhum cartão cadastrado</h2>
            <p className="fds-empty-state-lede">
              Adicione um cartão de crédito para acompanhar faturas e limite disponível.
            </p>
            <button className="fds-empty-state-btn" onClick={openAddCartaoModal}
                    style={{ touchAction: 'manipulation', minHeight: 44 }}>
              + Adicionar cartão
            </button>
          </div>
        ) : cards.map(c => {
          const pct = c.used / c.limit;
          const over = pct > 0.85;
          const faturaAberta = faturaAbertaPorCartao[c.id];
          const faturaTxs   = faturaAberta?.txs   || [];
          const faturaValor = faturaAberta?.total || 0;
          const handlePay = () => {
            if (faturaTxs.length > 0) {
              setPayModal({ cardId: c.id, cardName: c.name, txs: faturaTxs });
            }
          };
          return (
            <div className="ctn-card" key={c.id}>
              <div className="ctn-card-visual" style={{
                background: c.color
                  ? `linear-gradient(135deg, ${c.color} 0%, ${c.color}BB 100%)`
                  : 'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)',
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
                        ...(faturaTxs.length > 0 ? [
                          { id: 'pay', label: 'Pagar fatura', icon: 'Check', onClick: handlePay },
                        ] : []),
                        { id: 'edit',   label: 'Editar cartão', icon: 'Edit',  onClick: () => { setEditCartao(c); setEditCartaoColor(c.color || '#1A1A2E'); setPvEditFechamento(String(c.diaFechamento || '')); setPvEditDue(String(c.diaVencimento || c.due || '')); } },
                        { id: 'delete', label: 'Excluir cartão',icon: 'Trash', danger: true, onClick: () => setDeleteTarget({ type: 'cartao', id: c.id, name: c.name }) },
                      ]}
                    />
                  </div>
                </div>
                <div className="ctn-card-visual-num">•••• •••• •••• {c.tag.replace(/[^\d]/g,'').slice(-4) || '0000'}</div>
                <div className="ctn-card-visual-foot" style={{ justifyContent: 'flex-end' }}>
                  <div>
                    <div className="ctn-card-visual-lbl">Vence</div>
                    <div className="ctn-card-visual-val">{c.due}</div>
                  </div>
                </div>
              </div>

              <div className="ctn-card-info">
                <div className="ctn-card-fatura">
                  <div className="ctn-card-fatura-l">
                    <div className="ctn-stat-lbl">Fatura em aberto</div>
                    <div className="ctn-card-fatura-val">{fmtBRL(faturaValor)}</div>
                    <div className="ctn-card-fatura-meta">
                      {faturaTxs.length > 0
                        ? `${faturaTxs.length} ${faturaTxs.length === 1 ? 'lançamento' : 'lançamentos'} · melhor compra: dia ${c.diaFechamento} · vence dia ${c.due}`
                        : `Em dia · melhor compra: dia ${c.diaFechamento}`}
                    </div>
                  </div>
                  {faturaTxs.length > 0 ? (
                    <button className="fds-btn-primary" onClick={handlePay}>
                      <Icon.Check size={13}/> Pagar
                    </button>
                  ) : (
                    <span className="fds-status" style={{ padding: '7px 12px' }}>
                      Em dia
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
          {accounts.map(a => {
            const w = totalContas > 0 ? (a.balance / totalContas) * 100 : 0;
            return (
              <div key={a.id} className="ctn-dist-seg"
                   style={{ width: `${w}%`, background: a.color || '#888' }}
                   title={`${a.name}: ${w.toFixed(1)}%`}/>
            );
          })}
        </div>
        <div className="ctn-dist-rows">
          {accounts.map(a => {
            const pct = totalContas > 0 ? (a.balance / totalContas) * 100 : 0;
            return (
              <div className="ctn-dist-row" key={a.id}>
                <span className="ctn-dist-dot" style={{ background: a.color || '#888' }}/>
                <span className="ctn-dist-name">{a.name}</span>
                <div className="ctn-dist-track">
                  <div className="ctn-dist-fill" style={{ width: `${pct}%`, background: a.color || '#888' }}/>
                </div>
                <span className="ctn-dist-pct">{pct.toFixed(1)}%</span>
                <span className="ctn-dist-val">{fmtBRL(a.balance)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {payModal && (
        <PagarFaturaModal
          modal={payModal}
          accounts={accounts}
          onClose={() => setPayModal(null)}
          onConfirm={async ({ txIds, accountId }) => {
            const ok = await payCartaoFatura({ cartaoId: payModal.cardId, accountId, txIds });
            if (ok) setPayModal(null);
          }}
        />
      )}
    </div>
  );
}

Object.assign(window, { ContasStudio });
