// fides-store.jsx — Shared state (transactions, categories, budgets)
// React context lifted at <FidesStudio> level so Dashboard / Transações
// / Orçamento all see the same data and reflect new lançamentos.
//
// Also exposes:
//   • <CategoryAvatar cat={id} size={n}/>  — colored chip with emoji
//   • <CategoriaModal/>                    — CRUD for categories
//   • useFides()                           — hook to consume the store

const FidesStoreContext = React.createContext(null);

function FidesProvider({ children }) {
  const [transactions, setTransactions] = React.useState(() =>
    TRANSACTIONS.slice().map((t, i) => ({ ...t, _id: t._id ?? `tx-${i}` }))
  );
  const [categories, setCategories]     = React.useState(() => ({ ...CATEGORIES }));
  const [plannedOverrides, setPlannedOverrides] = React.useState({});
  const [categoryModalOpen, setCategoryModalOpen] = React.useState(false);
  // Mês selecionado em todas as telas (formato 'YYYY-MM'). Default: mês dos mocks.
  const [selectedMonth, setSelectedMonth] = React.useState('2026-05');
  const [assistantOpen, setAssistantOpen] = React.useState(false);
  const [accounts, setAccounts] = React.useState(() => ACCOUNTS.slice());
  const [cards, setCards]       = React.useState(() => CARDS.slice());

  // ─── Helpers ───────────────────────────────────────────────
  const ensureMes = (tx) => ({ ...tx, mes: tx.mes || `2026-${String(tx.d).split('/')[1]}` });

  const addTransaction = React.useCallback((tx) => {
    setTransactions(prev => [
      ensureMes({ ...tx, _new: true, _id: tx._id ?? (Date.now() + Math.random()) }),
      ...prev,
    ]);
  }, []);
  const addTransactions = React.useCallback((txs) => {
    const stamp = Date.now();
    setTransactions(prev => [
      ...txs.map((tx, i) => ensureMes({ ...tx, _new: true, _id: tx._id ?? (stamp + i / 1000) })),
      ...prev,
    ]);
  }, []);
  // Marca todas as transações de um cartão num mês de fatura como pagas
  const payCartaoFatura = React.useCallback((cardId, mesFatura) => {
    setTransactions(prev => prev.map(t => {
      if (t.acct !== cardId || t.status === 'pago') return t;
      const fat = mesFaturaFor(t.d, CARDS.find(c => c.id === cardId), parseInt(t.mes?.split('-')[0] || '2026', 10));
      if (fat === mesFatura) return { ...t, status: 'pago' };
      return t;
    }));
  }, []);
  const updateTransaction = React.useCallback((id, patch) => {
    setTransactions(prev => prev.map(t => t._id === id ? { ...t, ...patch } : t));
  }, []);
  const deleteTransaction = React.useCallback((id) => {
    setTransactions(prev => prev.filter(t => t._id !== id));
  }, []);

  const addAccount = React.useCallback((acct) => {
    setAccounts(prev => [
      { ...acct, id: acct.id ?? ('acct_' + Date.now()), _new: true },
      ...prev,
    ]);
  }, []);
  const addCard = React.useCallback((card) => {
    setCards(prev => [
      { ...card, id: card.id ?? ('card_' + Date.now()), used: 0, _new: true },
      ...prev,
    ]);
  }, []);

  const addCategory = React.useCallback((id, cat) => {
    setCategories(prev => ({ ...prev, [id]: { ...cat, custom: true } }));
  }, []);
  const updateCategory = React.useCallback((id, patch) => {
    setCategories(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);
  const deleteCategory = React.useCallback((id) => {
    setCategories(prev => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
  }, []);
  const moveCategory = React.useCallback((id, newGroup) => {
    setCategories(prev => {
      if (!prev[id]) return prev;
      return { ...prev, [id]: { ...prev[id], group: newGroup } };
    });
  }, []);
  const setPlanned = React.useCallback((catId, value) => {
    setPlannedOverrides(p => ({ ...p, [catId]: value }));
  }, []);

  // ─── Helpers de mês ────────────────────────────────────────
  const prevMonth = (ym) => {
    const [y, m] = ym.split('-').map(s => parseInt(s, 10));
    if (m === 1) return `${y - 1}-12`;
    return `${y}-${String(m - 1).padStart(2, '0')}`;
  };
  const monthLabel = (ym) => {
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const mesesLongos = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const [y, m] = ym.split('-').map(s => parseInt(s, 10));
    return { short: `${meses[m - 1]} · ${y}`, long: `${mesesLongos[m - 1]} de ${y}` };
  };

  // ─── Derived: transações do mês selecionado (pelo mês da COMPRA) ─
  // No Fides, gastos no cartão entram no orçamento do mês em que
  // foram feitos — não no mês da fatura. Isso evita o "bug do
  // PlannerFin" onde compras de fim de mês inflavam o mês seguinte.
  const monthTransactions = React.useMemo(() =>
    transactions.filter(t => txMonth(t) === selectedMonth),
  [transactions, selectedMonth]);

  const prevMonthTransactions = React.useMemo(() => {
    const pm = prevMonth(selectedMonth);
    return transactions.filter(t => txMonth(t) === pm);
  }, [transactions, selectedMonth]);

  // ─── Derived: spend by category — mês selecionado ──────────
  const spendByCategory = React.useMemo(() => {
    const map = {};
    monthTransactions.forEach(t => {
      if (t.val < 0) {
        map[t.cat] = (map[t.cat] || 0) + Math.abs(t.val);
      }
    });
    return Object.entries(map).map(([key, val]) => {
      const c = categories[key] || { label: key, tint: '#888', emoji: '🏷️' };
      return { key, val, label: c.label, tint: c.tint, emoji: c.emoji };
    }).sort((a, b) => b.val - a.val);
  }, [monthTransactions, categories]);

  // ─── Derived: budget groups — mês selecionado ──────────────
  const budgetGroups = React.useMemo(() => {
    return ['essencial', 'estilo', 'divida'].map(groupId => {
      const def = BUDGET_GROUPS.find(g => g.id === groupId);
      const cats = Object.entries(categories)
        .filter(([, c]) => c.group === groupId)
        .map(([id]) => {
          const original = def?.cats.find(x => x.cat === id);
          const limit = plannedOverrides[id] ?? original?.limit ?? 0;
          const spent = monthTransactions
            .filter(t => t.cat === id && t.val < 0)
            .reduce((s, t) => s + Math.abs(t.val), 0);
          return { cat: id, limit, spent };
        });
      const limit = cats.reduce((s, c) => s + c.limit, 0);
      const spent = cats.reduce((s, c) => s + c.spent, 0);
      return { id: groupId, label: def?.label || groupId, target: def?.target || 0, limit, spent, cats };
    });
  }, [monthTransactions, categories, plannedOverrides]);

  // ─── Derived: faturas em aberto agrupadas por cartão+mêsFatura ─
  const faturasPorCartao = React.useMemo(() => {
    const map = {};
    transactions.forEach(t => {
      if (!isCardId(t.acct) || t.status === 'pago') return;
      const card = CARDS.find(c => c.id === t.acct);
      const yr = parseInt((t.mes || '2026-01').split('-')[0], 10);
      const fat = mesFaturaFor(t.d, card, yr);
      if (!fat) return;
      const key = `${t.acct}|${fat}`;
      if (!map[key]) map[key] = { cardId: t.acct, mesFatura: fat, total: 0, txs: [] };
      map[key].total += Math.abs(t.val);
      map[key].txs.push(t);
    });
    return map;
  }, [transactions]);

  const value = {
    transactions, addTransaction, addTransactions, payCartaoFatura,
    updateTransaction, deleteTransaction,
    accounts, addAccount,
    cards, addCard,
    categories, addCategory, updateCategory, deleteCategory, moveCategory,
    plannedOverrides, setPlanned,
    selectedMonth, setSelectedMonth, prevMonth, monthLabel,
    monthTransactions, prevMonthTransactions,
    spendByCategory, budgetGroups, faturasPorCartao,
    categoryModalOpen,
    assistantOpen,
    openCategoryModal:  () => setCategoryModalOpen(true),
    closeCategoryModal: () => setCategoryModalOpen(false),
    openAssistant:      () => setAssistantOpen(true),
    closeAssistant:     () => setAssistantOpen(false),
  };

  return (
    <FidesStoreContext.Provider value={value}>
      {children}
    </FidesStoreContext.Provider>
  );
}

// Hook with safe fallback to the static mock data (so V3 reference
// dashboards keep working without a provider).
function useFides() {
  const ctx = React.useContext(FidesStoreContext);
  if (ctx) return ctx;
  return {
    transactions: TRANSACTIONS,
    monthTransactions: TRANSACTIONS,
    prevMonthTransactions: [],
    addTransaction: () => {}, addTransactions: () => {}, payCartaoFatura: () => {},
    updateTransaction: () => {}, deleteTransaction: () => {},
    accounts: ACCOUNTS, addAccount: () => {},
    cards: CARDS, addCard: () => {},
    categories: CATEGORIES,
    addCategory: () => {}, updateCategory: () => {}, deleteCategory: () => {}, moveCategory: () => {},
    plannedOverrides: {}, setPlanned: () => {},
    selectedMonth: '2026-05', setSelectedMonth: () => {},
    prevMonth: (ym) => ym, monthLabel: (ym) => ({ short: ym, long: ym }),
    spendByCategory: SPEND_BY_CATEGORY,
    budgetGroups: BUDGET_GROUPS,
    faturasPorCartao: {},
    openCategoryModal: () => {}, closeCategoryModal: () => {},
    openAssistant: () => {}, closeAssistant: () => {},
    assistantOpen: false,
  };
}

// ─── <CategoryAvatar/> ────────────────────────────────────────
// Renders a colored chip with the category's emoji. Falls back to
// first letter if the category has no emoji. Used everywhere we
// used to render a single-letter circle.
function CategoryAvatar({ cat, size = 32, categories: categoriesProp }) {
  const ctx = React.useContext(FidesStoreContext);
  const cats = categoriesProp || ctx?.categories || CATEGORIES;
  const c = cats[cat] || { label: cat || '?', tint: '#888', emoji: null };
  const radius = Math.max(6, size * 0.28);
  return (
    <span className="fds-cat-avatar"
          style={{
            width: size, height: size,
            borderRadius: radius,
            background: c.tint + '1A',
            border: `1px solid ${c.tint}33`,
            display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: Math.round(size * 0.52),
            lineHeight: 1,
            flex: 'none',
            fontFamily:
              '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif',
          }}>
      {c.emoji || <span style={{ color: c.tint, fontSize: size * 0.42, fontWeight: 600, fontFamily: 'inherit' }}>{(c.label || '?')[0]}</span>}
    </span>
  );
}

// ─── <MoveCatDropdown/> — inline dropdown to move a category ─
function MoveCatDropdown({ id, currentGroup }) {
  const { moveCategory } = useFides();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close, { passive: true });
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);

  const groups = [
    { id: 'essencial', label: 'Essencial',        pct: '50%' },
    { id: 'estilo',    label: 'Estilo de vida',    pct: '30%' },
    { id: 'divida',    label: 'Dívidas & invest.', pct: '20%' },
  ].filter(g => g.id !== currentGroup);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="cat-move-btn"
        title="Mover para outro grupo"
        onPointerUp={(e) => { e.stopPropagation(); setOpen(v => !v); }}
      >
        <Icon.Arrow size={13}/>
      </button>
      {open && (
        <div className="cat-move-dd">
          {groups.map(g => (
            <button
              key={g.id}
              className="cat-move-dd-item"
              onPointerUp={() => { moveCategory(id, g.id); setOpen(false); }}
            >
              <span className="pct">{g.pct}</span>
              {g.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── <CategoriaModal/> — CRUD ────────────────────────────────
// Opens via store.openCategoryModal() OR via prop `open`.
const CATEGORY_TINTS = [
  '#F59E0B','#EF4444','#DC2626','#7C3AED','#0EA5E9','#16A34A','#F97316',
  '#0891B2','#CA8A04','#EC4899','#A855F7','#22C55E','#8B5CF6','#06B6D4',
  '#F43F5E','#B91C1C','#0F766E','#10B981','#84CC16','#3B82F6','#6366F1',
];

function CategoriaModal({ open, onClose }) {
  const { categories, addCategory, deleteCategory, moveCategory } = useFides();
  const [activeGroup, setActiveGroup] = React.useState('essencial');
  const [creating, setCreating] = React.useState(false);
  const [draft, setDraft] = React.useState({
    label: '',
    emoji: '🛒',
    tint: '#F59E0B',
    group: 'essencial',
  });

  if (!open) return null;

  const grouped = ['essencial', 'estilo', 'divida', 'receita'].map(g => ({
    id: g,
    label: g === 'essencial' ? 'Essencial' : g === 'estilo' ? 'Estilo de vida' : g === 'divida' ? 'Dívidas & investimentos' : 'Receitas',
    cats: Object.entries(categories).filter(([, c]) => c.group === g),
  }));

  const handleSave = () => {
    if (!draft.label.trim()) return;
    const id = draft.label.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
      .slice(0, 20) || 'custom_' + Date.now();
    addCategory(id, draft);
    setCreating(false);
    setDraft({ label: '', emoji: '🛒', tint: '#F59E0B', group: activeGroup });
  };

  return (
    <div className="fds-modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      <div className="fds-modal cat-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <header className="fds-modal-head">
          <div>
            <div className="fds-modal-eyebrow">Personalizar</div>
            <h2 className="fds-modal-title">Categorias</h2>
          </div>
          <button className="fds-icon-btn" onClick={onClose}><Icon.X size={16}/></button>
        </header>

        {/* Group tabs */}
        <div className="cat-tabs">
          {grouped.map(g => (
            <button key={g.id}
                    className={`cat-tab${activeGroup === g.id ? ' on' : ''}`}
                    onClick={() => { setActiveGroup(g.id); setDraft(d => ({ ...d, group: g.id })); }}>
              {g.label}
              <span className="cat-tab-count">{g.cats.length}</span>
            </button>
          ))}
        </div>

        <div className="cat-modal-body">
          {/* Inline create form */}
          {creating ? (
            <div className="cat-create">
              <div className="cat-create-row">
                <div className="cat-create-preview">
                  <span className="cat-create-chip" style={{ background: draft.tint + '1A', borderColor: draft.tint + '33' }}>
                    <span style={{ fontSize: 26 }}>{draft.emoji}</span>
                  </span>
                  <div>
                    <input className="cat-create-name"
                           autoFocus
                           value={draft.label}
                           onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
                           placeholder="Nome da categoria"/>
                    <div className="cat-create-meta">
                      em <strong>{grouped.find(g => g.id === draft.group)?.label}</strong>
                    </div>
                  </div>
                </div>
                <div className="cat-create-actions">
                  <button className="fds-btn-ghost" onClick={() => setCreating(false)}>Cancelar</button>
                  <button className="fds-btn-primary" onClick={handleSave} disabled={!draft.label.trim()}>
                    <Icon.Check size={14}/> Criar categoria
                  </button>
                </div>
              </div>

              <div className="cat-create-section">
                <div className="cat-create-lbl">Emoji</div>
                <div className="cat-emoji-grid">
                  {EMOJI_PALETTE.map(e => (
                    <button key={e}
                            className={`cat-emoji${draft.emoji === e ? ' on' : ''}`}
                            onClick={() => setDraft(d => ({ ...d, emoji: e }))}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div className="cat-create-section">
                <div className="cat-create-lbl">Cor</div>
                <div className="cat-tints">
                  {CATEGORY_TINTS.map(t => (
                    <button key={t}
                            className={`cat-tint${draft.tint === t ? ' on' : ''}`}
                            style={{ background: t }}
                            onClick={() => setDraft(d => ({ ...d, tint: t }))}>
                      {draft.tint === t && <Icon.Check size={12}/>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="cat-create-section">
                <div className="cat-create-lbl">Grupo (regra 50·30·20)</div>
                <div className="cat-groups">
                  {[
                    ['essencial', 'Essencial',   '50%', 'var(--ok)'],
                    ['estilo',    'Estilo',      '30%', 'var(--info)'],
                    ['divida',    'Dívidas',     '20%', 'var(--bad)'],
                    ['receita',   'Receita',     '—',   'var(--ink-2)'],
                  ].map(([id, lbl, pct, color]) => (
                    <button key={id}
                            className={`cat-group-opt${draft.group === id ? ' on' : ''}`}
                            onClick={() => setDraft(d => ({ ...d, group: id }))}
                            style={draft.group === id ? { borderColor: color, background: color + '14' } : {}}>
                      <span className="cat-group-pct" style={{ color }}>{pct}</span>
                      <span className="cat-group-lbl">{lbl}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <button className="cat-add-btn" onClick={() => { setDraft(d => ({ ...d, group: activeGroup })); setCreating(true); }}>
              <Icon.Plus size={14}/> Nova categoria em <strong>{grouped.find(g => g.id === activeGroup)?.label}</strong>
            </button>
          )}

          {/* Categories grid for the active group */}
          <div className="cat-grid">
            {grouped.find(g => g.id === activeGroup)?.cats.map(([id, c]) => (
              <div className="cat-card" key={id}>
                <CategoryAvatar cat={id} size={40}/>
                <div className="cat-card-meta">
                  <div className="cat-card-name">{c.label}</div>
                  <div className="cat-card-sub">{c.custom ? 'Personalizada' : 'Padrão'}</div>
                </div>
                <MoveCatDropdown id={id} currentGroup={activeGroup}/>
                {c.custom && (
                  <button className="cat-card-del" onClick={() => deleteCategory(id)} title="Excluir">
                    <Icon.X size={13}/>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <footer className="fds-modal-foot">
          <span className="fds-muted" style={{ fontSize: 12 }}>
            {Object.keys(categories).length} categorias · {Object.values(categories).filter(c => c.custom).length} personalizadas
          </span>
          <button className="fds-btn-primary" onClick={onClose}>Fechar</button>
        </footer>
      </div>
    </div>
  );
}

Object.assign(window, {
  FidesStoreContext, FidesProvider, useFides,
  CategoryAvatar, CategoriaModal, CATEGORY_TINTS,
  MoveCatDropdown,
});
