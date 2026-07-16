// fides-store.jsx — Shared state with Supabase live/mock dual-mode
//
// Modes:
//   'loading' → checking auth on first render
//   'mock'    → no Supabase or no user; uses static data from fides-data.jsx
//   'live'    → authenticated user; reads/writes Supabase
//
// Components always consume the same useFides() API regardless of mode.

const FidesStoreContext = React.createContext(null);

// ─── Supabase helpers ──────────────────────────────────────────

function isSupabaseReady() {
  return !!(window.fidesDb && window.fidesAuth);
}

async function getAuthUser() {
  if (!isSupabaseReady()) return null;
  try {
    const { data: { user } } = await window.fidesAuth.getUser();
    return user || null;
  } catch (_) {
    return null;
  }
}

// ─── Data normalization (Supabase → UI) ───────────────────────

const STATUS_TO_UI = { cleared: 'pago', pending: 'pendente', scheduled: 'agendado' };
const STATUS_TO_DB = { pago: 'cleared', pendente: 'pending', agendado: 'scheduled' };

// Categorias do sistema (sintéticas) — não vivem em fides-data.jsx nem no banco.
const SYSTEM_CATEGORIES = {
  transferencia: { label: 'Transferência', emoji: '🔁', tint: 'var(--ink-3)', group: 'sistema' },
};

function normalizeTx(row) {
  const dateStr = row.date || '';
  const d = dateStr.length >= 10
    ? dateStr.slice(8, 10) + '/' + dateStr.slice(5, 7)
    : '';
  return {
    _id: row.id,
    val: Number(row.value),
    d,
    date: dateStr,
    desc: row.description,
    cat: row.category,
    acct: row.card_id || row.account_id || row.account || '',
    status: STATUS_TO_UI[row.status] || row.status,
    mes: row.month,
    recur: row.recurrent ? 'mensal' : null,
    subscription: !!row.subscription,
    settled: !!row.settled,
    paidAt: row.paid_at || null,
    isTransfer: !!row.is_transfer,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function normalizeAccount(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type || 'corrente',
    tag: row.tag || '',
    balance: Number(row.balance),
    color: row.color || '#00C37B',
    bank: row.bank || row.name || '',
  };
}

function normalizeCard(row) {
  return {
    id: row.id,
    name: row.name,
    tag: row.tag || '',
    limit: Number(row.card_limit),
    used: Number(row.used),
    diaVencimento: row.due_day,
    diaFechamento: row.closing_day,
    due: String(row.due_day),
    color: row.color || '#1A1A2E',
    bank: row.bank || '',
    expected_invoice: row.expected_invoice || {},
  };
}

function normalizeGoal(row) {
  const d = new Date(row.created_at || Date.now());
  return {
    id: row.id,
    nome: row.name,
    descricao: row.description || '',
    prazo: row.target_date || null,
    emoji: row.emoji || '🎯',
    tint: row.tint || '#00C37B',
    alvo: Number(row.target),
    atual: Number(row.current),
    contribuicao: Number(row.monthly_contrib),
    criadaEm: String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(),
    cover: row.image_url || null,
    completed: !!row.completed,
    completedAt: row.completed_at || null,
  };
}

// user_categories row → UI category shape. A chave do objeto é row.cat_key.
function normalizeCategory(row) {
  return {
    label: row.label,
    group: row.grp,
    tint:  row.tint,
    emoji: row.emoji,
    custom: true,
  };
}

// ─── Goal cover Storage helpers (Supabase Storage — bucket goal-covers) ──

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

function extFromMime(mime) {
  return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mime] || null;
}

// Sobe a capa própria do usuário para o bucket goal-covers. Path é sempre
// <user_id>/<uuid>.<ext> — nunca o nome do arquivo do usuário (anti-traversal/colisão).
async function uploadGoalCover(userId, file) {
  if (!ALLOWED_MIME.includes(file.type)) throw new Error('Formato não suportado (use JPG, PNG ou WEBP).');
  if (file.size > MAX_BYTES) throw new Error('Arquivo maior que 5MB.');
  const ext = extFromMime(file.type);
  if (!ext) throw new Error('Formato não suportado.');
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await window.fidesDb.storage.from('goal-covers').upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  const { data } = window.fidesDb.storage.from('goal-covers').getPublicUrl(path);
  return { url: data.publicUrl, path };
}

// Remove uma capa do bucket goal-covers. Não-throwing — falha é logada, não interrompe o fluxo.
async function deleteGoalCover(path) {
  if (!path) return;
  const { error } = await window.fidesDb.storage.from('goal-covers').remove([path]);
  if (error) console.error('[Fides] deleteGoalCover:', error.message);
}

// ─── FidesProvider ─────────────────────────────────────────────

function FidesProvider({ children }) {
  const [mode, setMode] = React.useState('loading');
  const [userId, setUserId] = React.useState(null);
  const [userName,  setUserName]  = React.useState('');
  const [userEmail, setUserEmail] = React.useState('');
  // GATE-01: tier real do usuário — default 'free' é o fail-closed do cliente (D-02)
  const [userPlan,  setUserPlan]  = React.useState('free');
  // LOTE-NAME: primeiro nome para saudacoes
  const firstName = React.useMemo(function () {
    if (!userName) return '';
    return String(userName).trim().split(/\s+/)[0] || '';
  }, [userName]);

  // Data state — starts with mock data; replaced on live login
  const [transactions, setTransactions] = React.useState(() =>
    TRANSACTIONS.slice().map((t, i) => ({ ...t, _id: t._id ?? `tx-${i}` }))
  );
  const [accounts, setAccounts] = React.useState(() => ACCOUNTS.slice());
  const [cards,    setCards]    = React.useState(() => CARDS.slice());
  const [goals,    setGoals]    = React.useState(() => METAS.slice());

  const [categories, setCategories]           = React.useState(() => ({ ...CATEGORIES, ...SYSTEM_CATEGORIES }));
  const [plannedOverrides, setPlannedOverrides] = React.useState({});
  const [categoryLimits, setCategoryLimits]     = React.useState({});
  const [groupTargets, setGroupTargetsState] = React.useState({ essencial: 0.50, estilo: 0.30, divida: 0.20 });
  const [categoryModalOpen, setCategoryModalOpen] = React.useState(false);
  const [selectedMonth, setSelectedMonth]         = React.useState(function() {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  });
  const [assistantOpen, setAssistantOpen]         = React.useState(false);

  // ─── Helpers ─────────────────────────────────────────────────

  const ensureMes = (tx) => ({
    ...tx,
    mes: tx.mes || `${new Date().getFullYear()}-${String(tx.d).split('/')[1]}`,
  });

  // Convert UI tx format to Supabase row, using current cards to detect card txs
  function txToRow(tx, uid, liveCards) {
    const [dd = '01', mm = '01'] = (tx.d || '01/01').split('/');
    const currYear = String(new Date().getFullYear());
    const [yyyy = currYear]        = (tx.mes || `${currYear}-01`).split('-');
    const cardIdSet = new Set((liveCards || []).map(c => c.id));
    const isCard    = cardIdSet.has(tx.acct);
    return {
      user_id:      uid,
      description:  tx.desc || '',
      value:        Number(tx.val) || 0,
      category:     tx.cat || 'outros',
      account:      tx.acct || '',
      // WR-01: preserva a `date` de compra já resolvida (ano incluído, vinda do
      // arquivo em resolveRowForImport) em vez de reconstruí-la a partir do ano
      // de `tx.mes` (mês da FATURA). Para cartões o mês da fatura pode cair no
      // ano seguinte (compra 28/12/2025, fatura 2026-01), e reconstruir daria
      // `2026-12-28` — ano/mês errados, quebrando o dedupeKey no re-import
      // (classe do incidente das 196 duplicatas). Só reconstrói se não houver
      // uma `date` YYYY-MM-DD válida.
      date:         (tx.date && /^\d{4}-\d{2}-\d{2}$/.test(tx.date))
                      ? tx.date
                      : `${yyyy}-${mm}-${dd}`,
      month:        (function() {
        if (cardIdSet && cardIdSet.has(tx.acct)) {
          const card = (liveCards || []).find(c => c.id === tx.acct);
          if (card && tx.d) {
            const yr = parseInt(String(tx.date || '').slice(0, 4))
                       || parseInt(String(tx.mes  || '').slice(0, 4))
                       || new Date().getFullYear();
            const mes = window.mesFaturaFor(tx.d, card, yr);
            if (mes) return mes;
          }
        }
        return tx.mes || '';
      })(),
      status:       STATUS_TO_DB[tx.status] || 'cleared',
      recurrent:    !!(tx.recur || tx.recurrent),
      subscription: !!tx.subscription,
      account_id:   isCard ? null : (tx.acct || null),
      card_id:      isCard ? tx.acct : null,
    };
  }

  // ─── Data refresh (live only) ─────────────────────────────────

  const refreshData = React.useCallback(async (uidOverride) => {
    const uid = uidOverride != null ? uidOverride : userId;
    if (!uid || !isSupabaseReady()) return;
    try {
      const [txRes, acctRes, cardRes, goalRes, catRes, limitsRes] = await Promise.all([
        window.fidesDb.from('transactions').select('*').eq('user_id', uid).order('date', { ascending: false }),
        window.fidesDb.from('accounts').select('*').eq('user_id', uid).order('created_at'),
        window.fidesDb.from('cards').select('*').eq('user_id', uid).order('created_at'),
        window.fidesDb.from('goals').select('*').eq('user_id', uid).order('created_at'),
        window.fidesDb.from('user_categories').select('*').eq('user_id', uid).order('created_at'),
        window.fidesDb.from('category_limits').select('cat_key, month, monthly_limit').eq('user_id', uid),
      ]);
      if (!txRes.error)   setTransactions((txRes.data   || []).map(normalizeTx));
      if (!acctRes.error) setAccounts((acctRes.data     || []).map(normalizeAccount));
      if (!cardRes.error) setCards((cardRes.data         || []).map(normalizeCard));
      if (!goalRes.error) setGoals((goalRes.data         || []).map(normalizeGoal));
      if (txRes.error)   console.error('[Fides] Erro transações:',  txRes.error.message);
      if (acctRes.error) console.error('[Fides] Erro contas:',      acctRes.error.message);
      if (cardRes.error) console.error('[Fides] Erro cartões:',     cardRes.error.message);
      // Categorias: defaults fixos + customizadas do usuário (híbrido).
      // Isolado em try/catch para nunca quebrar o load do restante dos dados.
      try {
        if (catRes && !catRes.error) {
          const custom = Object.fromEntries((catRes.data || []).map(r => [r.cat_key, normalizeCategory(r)]));
          setCategories({ ...CATEGORIES, ...SYSTEM_CATEGORIES, ...custom });
        } else {
          if (catRes && catRes.error) console.error('[Fides] Erro categorias:', catRes.error.message);
          setCategories({ ...CATEGORIES, ...SYSTEM_CATEGORIES });
        }
      } catch (catErr) {
        console.error('[Fides] Erro categorias:', catErr.message);
        setCategories({ ...CATEGORIES });
      }
      // Limites por categoria. Estrutura por chave:
      //   { cat_key: { byMonth: { 'YYYY-MM': number, ... }, default: number|null } }
      // byMonth = rows com month especifico; default = row com month NULL.
      try {
        const lmap = {};
        if (limitsRes && !limitsRes.error) {
          (limitsRes.data || []).forEach(r => {
            if (!lmap[r.cat_key]) lmap[r.cat_key] = { byMonth: {}, default: null };
            const lim = Number(r.monthly_limit);
            if (r.month == null) lmap[r.cat_key].default = lim;
            else lmap[r.cat_key].byMonth[r.month] = lim;
          });
        } else if (limitsRes && limitsRes.error) {
          console.error('[Fides] Erro limites:', limitsRes.error.message);
        }
        setCategoryLimits(lmap);
      } catch (limErr) {
        console.error('[Fides] Erro limites:', limErr.message);
        setCategoryLimits({});
      }
    } catch (err) {
      console.error('[Fides] Erro refreshData:', err.message);
    }
  }, [userId]);

  // ─── Auth bootstrap ───────────────────────────────────────────

  const resetToMock = React.useCallback(() => {
    setTransactions(TRANSACTIONS.slice().map((t, i) => ({ ...t, _id: t._id ?? `tx-${i}` })));
    setAccounts(ACCOUNTS.slice());
    setCards(CARDS.slice());
    setGoals(METAS.slice());
    setUserName('');
    setUserEmail('');
    setUserPlan('free');
  }, []);

  React.useEffect(() => {
    if (!isSupabaseReady()) {
      setMode('mock');
      console.log('[Fides] Store: modo mock (Supabase não disponível)');
      return;
    }

    let mounted = true;
    // Guarda por user-id: rastreia o último usuário efetivamente carregado.
    // Com autoRefreshToken:true o Supabase RE-EMITE SIGNED_IN no focus/token-refresh;
    // ignoramos essas re-emissões para não desmontar a árvore (perde estado do modal de import).
    let loadedUid = null;

    getAuthUser().then(async user => {
      if (!mounted) return;
      if (user) {
        setUserId(user.id);
        loadedUid = user.id;
        setMode('live');
        setUserEmail(user.email || '');
        setTransactions([]); setAccounts([]); setCards([]); setGoals([]);
        refreshData(user.id);
        try {
          const { data: profile } = await window.fidesDb.from('profiles').select('name, group_targets, plan').eq('id', user.id).single();
          if (mounted) {
            setUserName(profile?.name || '');
            setUserPlan(profile?.plan || 'free');
            if (profile?.group_targets && typeof profile.group_targets === 'object') {
              setGroupTargetsState({
                essencial: Number(profile.group_targets.essencial) || 0.50,
                estilo:    Number(profile.group_targets.estilo)    || 0.30,
                divida:    Number(profile.group_targets.divida)    || 0.20,
              });
            }
          }
        } catch (_) {}
        console.log('[Fides] Store: modo live — userId:', user.id);
      } else {
        setMode('mock');
        console.log('[Fides] Store: modo mock (sem usuário autenticado)');
      }
    });

    const { data: { subscription } } = window.fidesAuth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      const user = session?.user || null;
      if (user) {
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          // Re-emissão de SIGNED_IN para o MESMO usuário (focus/token-refresh):
          // não resetar/refetch — preserva o estado local da UI (ex.: modal de import).
          if (user.id === loadedUid) return;
          setUserId(user.id);
          setMode('live');
          setUserEmail(user.email || '');
          setTransactions([]); setAccounts([]); setCards([]); setGoals([]);
          refreshData(user.id);
          (async () => {
            try {
              const { data: profile } = await window.fidesDb.from('profiles').select('name, group_targets, plan').eq('id', user.id).single();
              if (mounted) {
                setUserName(profile?.name || '');
                setUserPlan(profile?.plan || 'free');
                if (profile?.group_targets && typeof profile.group_targets === 'object') {
                  setGroupTargetsState({
                    essencial: Number(profile.group_targets.essencial) || 0.50,
                    estilo:    Number(profile.group_targets.estilo)    || 0.30,
                    divida:    Number(profile.group_targets.divida)    || 0.20,
                  });
                }
              }
            } catch (_) {}
          })();
          loadedUid = user.id;
          console.log('[Fides] Store: modo live — userId:', user.id);
        }
      } else {
        setUserId(null);
        loadedUid = null;
        setMode('mock');
        resetToMock();
        console.log('[Fides] Store: modo mock (sem usuário autenticado)');
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Transactions ─────────────────────────────────────────────

  const addTransaction = React.useCallback(async (tx) => {
    const merged = ensureMes({ ...tx });
    if (mode === 'live' && userId) {
      try {
        const row = txToRow(merged, userId, cards);
        const { error } = await window.fidesDb.from('transactions').insert(row);
        if (error) throw error;
        // Saldo derivado: recalcula a partir das transacoes 'cleared' (fonte unica)
        if (row.account_id) {
          await window.fidesDb.rpc('recalc_account_balance', { p_account_id: row.account_id });
        }
        // Update card used for card transactions
        if (row.card_id && merged.val < 0) {
          const { data: card } = await window.fidesDb
            .from('cards').select('used').eq('id', row.card_id).single();
          if (card) {
            await window.fidesDb.from('cards')
              .update({ used: Number(card.used) + Math.abs(Number(merged.val)) })
              .eq('id', row.card_id);
          }
        }
        await refreshData(userId);
      } catch (err) {
        console.error('[Fides] addTransaction:', err.message);
      }
      return;
    }
    setTransactions(prev => [
      { ...merged, _new: true, _id: merged._id ?? (Date.now() + Math.random()) },
      ...prev,
    ]);
  }, [mode, userId, cards, refreshData]);

  const addTransactions = React.useCallback(async (txs) => {
    if (mode === 'live' && userId) {
      try {
        const rows = txs.map(tx => txToRow(ensureMes(tx), userId, cards));
        const { error } = await window.fidesDb.from('transactions').insert(rows);
        if (error) throw error;
        await refreshData(userId);
      } catch (err) {
        console.error('[Fides] addTransactions:', err.message);
      }
      return;
    }
    const stamp = Date.now();
    setTransactions(prev => [
      ...txs.map((tx, i) => ({
        ...ensureMes(tx), _new: true,
        _id: tx._id ?? (stamp + i / 1000),
      })),
      ...prev,
    ]);
  }, [mode, userId, cards, refreshData]);

  const updateTransaction = React.useCallback(async (id, patch) => {
    if (mode === 'live' && userId) {
      try {
        const { data: __prevTx } = await window.fidesDb
          .from('transactions').select('account_id').eq('id', id).single();
        const dbPatch = {};
        if (patch.status !== undefined) dbPatch.status      = STATUS_TO_DB[patch.status] || patch.status;
        if (patch.desc   !== undefined) dbPatch.description = patch.desc;
        if (patch.val    !== undefined) dbPatch.value       = patch.val;
        if (patch.cat    !== undefined) dbPatch.category    = patch.cat;
        if (patch.date) {
          dbPatch.date  = patch.date;
          dbPatch.month = String(patch.date).slice(0, 7);
        }
        if (patch.month !== undefined) dbPatch.month = patch.month;
        if (patch.acct !== undefined) {
          const cardIdSet = new Set((cards || []).map(c => c.id));
          const isCard    = cardIdSet.has(patch.acct);
          dbPatch.account    = patch.acct || '';
          dbPatch.account_id = isCard ? null : (patch.acct || null);
          dbPatch.card_id    = isCard ? patch.acct : null;
        }
        const { error } = await window.fidesDb.from('transactions').update(dbPatch).eq('id', id);
        if (error) throw error;
        const __affected = new Set();
        if (__prevTx && __prevTx.account_id) __affected.add(__prevTx.account_id);
        if (dbPatch.account_id) __affected.add(dbPatch.account_id);
        for (const __acctId of __affected) {
          await window.fidesDb.rpc('recalc_account_balance', { p_account_id: __acctId });
        }
        await refreshData(userId);
      } catch (err) {
        console.error('[Fides] updateTransaction:', err.message);
      }
      return;
    }
    setTransactions(prev => prev.map(t => t._id === id ? { ...t, ...patch } : t));
  }, [mode, userId, refreshData, cards]);

  async function deleteTransaction(id) {
    if (mode !== 'live') return;
    try {
      var result = await window.fidesDb.rpc('delete_transaction', { p_tx_id: id });
      if (result.error) throw result.error;
      await refreshData();
    } catch (err) {
      console.error('[Fides] deleteTransaction RPC error:', err);
    }
  }

  // payCartaoFatura: new signature { cartaoId, accountId, txIds }
  // Live: atomic via RPC pay_card_invoice — server inserts payment tx, debits
  //       account, marks txs settled and reduces card.used in one transaction
  // Mock: marks selected txs as paid (status:'pago') locally
  const payCartaoFatura = React.useCallback(async ({ cartaoId, accountId, txIds } = {}) => {
    if (!txIds?.length) return false;
    if (mode === 'live' && userId && cartaoId && accountId) {
      try {
        const { error } = await window.fidesDb.rpc('pay_card_invoice', {
          p_card_id:    cartaoId,
          p_account_id: accountId,
          p_tx_ids:     txIds,
        });
        if (error) throw error;
        await refreshData(userId);
        return true;
      } catch (err) {
        console.error('[Fides] payCartaoFatura:', err.message);
        return false;
      }
    }
    // mock
    setTransactions(prev => prev.map(t =>
      txIds.includes(t._id) ? { ...t, status: 'pago' } : t
    ));
    return true;
  }, [mode, userId, refreshData]);

  // transferFunds: movimentação entre contas (sem trava de saldo — permite negativo)
  // Live: atomic via RPC transfer_funds. Mock: dois lançamentos locais marcados isTransfer.
  const transferFunds = React.useCallback(async ({ from, to, val, date, desc } = {}) => {
    if (!from || !to || from === to || !(Number(val) > 0)) return false;
    if (mode === 'live' && userId) {
      try {
        const { error } = await window.fidesDb.rpc('transfer_funds', {
          p_from:  from,
          p_to:    to,
          p_value: Number(val),
          p_date:  date || null,        // 'YYYY-MM-DD' ou null
          p_desc:  desc || null,
        });
        if (error) throw error;
        await refreshData(userId);
        return true;
      } catch (err) {
        console.error('[Fides] transferFunds:', err.message);
        return false;
      }
    }
    // mock: dois lançamentos locais (demo)
    const grp = 'tf' + Date.now();
    const mkMes = (d) => (d || new Date().toISOString().slice(0,10)).slice(0,7);
    setTransactions(prev => ([
      { _id: grp+'a', d: '', mes: mkMes(date), desc: desc || 'Transferência', cat: 'transferencia', acct: from, val: -Number(val), status: 'pago', isTransfer: true },
      { _id: grp+'b', d: '', mes: mkMes(date), desc: desc || 'Transferência', cat: 'transferencia', acct: to,   val:  Number(val), status: 'pago', isTransfer: true },
      ...prev,
    ]));
    return true;
  }, [mode, userId, refreshData]);

  // ─── Accounts ─────────────────────────────────────────────────

  const addAccount = React.useCallback(async (acct) => {
    if (mode === 'live' && userId) {
      try {
        const { error } = await window.fidesDb.from('accounts').insert({
          user_id: userId,
          name:    acct.name || '',
          type:    acct.type || 'checking',
          tag:     acct.tag  || '',
          balance:         Number(acct.balance) || 0,
          opening_balance: Number(acct.balance) || 0,
          color:   acct.color || '#00C37B',
          bank:    acct.bank || acct.name || '',
        });
        if (error) throw error;
        await refreshData(userId);
      } catch (err) {
        console.error('[Fides] addAccount:', err.message);
      }
      return;
    }
    setAccounts(prev => [
      { ...acct, id: acct.id ?? ('acct_' + Date.now()), _new: true },
      ...prev,
    ]);
  }, [mode, userId, refreshData]);

  const updateAccount = React.useCallback(async (id, patch) => {
    if (mode === 'live' && userId) {
      try {
        const { balance: __targetBal, ...__rest } = patch;
        if (Object.keys(__rest).length) {
          const { error } = await window.fidesDb.from('accounts').update(__rest).eq('id', id);
          if (error) throw error;
        }
        if (__targetBal !== undefined && __targetBal !== null) {
          await window.fidesDb.rpc('set_account_balance', { p_account_id: id, p_target: Number(__targetBal) });
        }
        await refreshData(userId);
      } catch (err) {
        console.error('[Fides] updateAccount:', err.message);
      }
      return;
    }
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  }, [mode, userId, refreshData]);

  const deleteAccount = React.useCallback(async (id) => {
    if (mode === 'live' && userId) {
      try {
        const { error } = await window.fidesDb.from('accounts').delete().eq('id', id);
        if (error) throw error;
        await refreshData(userId);
      } catch (err) {
        console.error('[Fides] deleteAccount:', err.message);
      }
      return;
    }
    setAccounts(prev => prev.filter(a => a.id !== id));
  }, [mode, userId, refreshData]);

  // ─── Goals ────────────────────────────────────────────────────

  const addGoal = React.useCallback(async (g) => {
    if (mode === 'live' && userId) {
      try {
        const { error } = await window.fidesDb.from('goals').insert({
          user_id: userId,
          name:        g.nome || '',
          target:      Number(g.alvo) || 0,
          target_date: g.prazo || null,
          description: g.descricao || '',
          emoji:       g.emoji || '🎯',
          tint:        g.tint || '#00C37B',
          image_url:   g.cover || null,
          current:     Number(g.atual) || 0,
        });
        if (error) throw error;
        await refreshData(userId);
      } catch (err) {
        console.error('[Fides] addGoal:', err.message);
      }
      return;
    }
    setGoals(prev => [
      { ...g, id: g.id ?? ('goal_' + Date.now()), _new: true },
      ...prev,
    ]);
  }, [mode, userId, refreshData]);

  const updateGoal = React.useCallback(async (id, patch) => {
    if (mode === 'live' && userId) {
      try {
        const { error } = await window.fidesDb.from('goals').update(patch).eq('id', id);
        if (error) throw error;
        await refreshData(userId);
      } catch (err) {
        console.error('[Fides] updateGoal:', err.message);
      }
      return;
    }
    setGoals(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x));
  }, [mode, userId, refreshData]);

  const deleteGoal = React.useCallback(async (id) => {
    if (mode === 'live' && userId) {
      try {
        const { error } = await window.fidesDb.from('goals').delete().eq('id', id);
        if (error) throw error;
        await refreshData(userId);
      } catch (err) {
        console.error('[Fides] deleteGoal:', err.message);
      }
      return;
    }
    setGoals(prev => prev.filter(x => x.id !== id));
  }, [mode, userId, refreshData]);

  // ─── Cards ────────────────────────────────────────────────────

  const addCard = React.useCallback(async (card) => {
    if (mode === 'live' && userId) {
      try {
        const { error } = await window.fidesDb.from('cards').insert({
          user_id:     userId,
          name:        card.name        || '',
          tag:         card.tag         || '',
          card_limit:  Number(card.limit) || 0,
          used:        0,
          due_day:     parseInt(card.due || card.diaVencimento || 10),
          closing_day: parseInt(card.diaFechamento || 3),
          color:       card.color || '#1A1A2E',
          bank:        card.bank || card.name || '',
        });
        if (error) throw error;
        await refreshData(userId);
      } catch (err) {
        console.error('[Fides] addCard:', err.message);
      }
      return;
    }
    setCards(prev => [
      { ...card, id: card.id ?? ('card_' + Date.now()), used: 0, _new: true },
      ...prev,
    ]);
  }, [mode, userId, refreshData]);

  const updateCard = React.useCallback(async (id, patch) => {
    if (mode === 'live' && userId) {
      try {
        const dbPatch = { ...patch };
        if (patch.limit         !== undefined) { dbPatch.card_limit  = patch.limit;         delete dbPatch.limit; }
        if (patch.diaVencimento !== undefined) { dbPatch.due_day     = patch.diaVencimento; delete dbPatch.diaVencimento; }
        if (patch.diaFechamento !== undefined) { dbPatch.closing_day = patch.diaFechamento; delete dbPatch.diaFechamento; }
        if (patch.expected_invoice !== undefined) { dbPatch.expected_invoice = patch.expected_invoice; }
        const { error } = await window.fidesDb.from('cards').update(dbPatch).eq('id', id);
        if (error) throw error;
        await refreshData(userId);
      } catch (err) {
        console.error('[Fides] updateCard:', err.message);
      }
      return;
    }
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }, [mode, userId, refreshData]);

  const deleteCard = React.useCallback(async (id) => {
    if (mode === 'live' && userId) {
      try {
        const { error } = await window.fidesDb.from('cards').delete().eq('id', id);
        if (error) throw error;
        await refreshData(userId);
      } catch (err) {
        console.error('[Fides] deleteCard:', err.message);
      }
      return;
    }
    setCards(prev => prev.filter(c => c.id !== id));
  }, [mode, userId, refreshData]);

  // ─── Categories (híbrido: defaults fixos + custom persistidas no Supabase) ─

  // Cria uma categoria custom. Garante chave única contra defaults + custom.
  // Otimista local; no modo live também grava em user_categories (revert em erro).
  const addCategory = React.useCallback(async (id, draft) => {
    // Garante unicidade da chave contra TODAS as categorias atuais.
    let uniqueId = id;
    let n = 2;
    while (categories[uniqueId]) {
      uniqueId = `${id}-${n}`;
      n += 1;
    }
    const newCat = {
      label: draft.label,
      emoji: draft.emoji,
      tint:  draft.tint,
      group: draft.group,
      custom: true,
    };
    setCategories(prev => ({ ...prev, [uniqueId]: newCat }));
    if (mode === 'live' && userId) {
      try {
        const { error } = await window.fidesDb.from('user_categories').insert({
          user_id: userId,
          cat_key: uniqueId,
          label:   draft.label,
          emoji:   draft.emoji,
          tint:    draft.tint,
          grp:     draft.group,
        });
        if (error) throw error;
      } catch (err) {
        console.error('[Fides] addCategory:', err.message);
        setCategories(prev => { const nx = { ...prev }; delete nx[uniqueId]; return nx; });
        window.FidesUI.toast.error('Não foi possível salvar a categoria. Tente novamente.');
      }
    }
    return uniqueId;
  }, [mode, userId, categories]);

  // Atualiza uma categoria. Defaults permanecem read-only no banco — apenas
  // categorias custom são persistidas. Estado local é otimista (revert em erro).
  const updateCategory = React.useCallback(async (id, patch) => {
    const prevCat = categories[id];
    if (!prevCat) return;
    setCategories(prev => prev[id] ? { ...prev, [id]: { ...prev[id], ...patch } } : prev);
    if (mode === 'live' && userId && prevCat.custom) {
      try {
        const dbPatch = {};
        if (patch.label !== undefined) dbPatch.label = patch.label;
        if (patch.emoji !== undefined) dbPatch.emoji = patch.emoji;
        if (patch.tint  !== undefined) dbPatch.tint  = patch.tint;
        if (patch.group !== undefined) dbPatch.grp   = patch.group;
        if (Object.keys(dbPatch).length) {
          const { error } = await window.fidesDb.from('user_categories')
            .update(dbPatch).eq('user_id', userId).eq('cat_key', id);
          if (error) throw error;
        }
      } catch (err) {
        console.error('[Fides] updateCategory:', err.message);
        setCategories(prev => ({ ...prev, [id]: prevCat }));
        window.FidesUI.toast.error('Não foi possível atualizar a categoria. Tente novamente.');
      }
    }
  }, [mode, userId, categories]);

  // Exclui uma categoria custom. Reatribui as transações dela para 'outros'
  // (local + banco) antes de remover. Em erro em qualquer etapa, reverte tudo.
  const deleteCategory = React.useCallback(async (id) => {
    const prevCat = categories[id];
    if (!prevCat || !prevCat.custom) return; // defaults não podem ser excluídos
    const txSnapshot = transactions;
    setTransactions(prev => prev.map(t => t.cat === id ? { ...t, cat: 'outros' } : t));
    setCategories(prev => { const nx = { ...prev }; delete nx[id]; return nx; });
    if (mode === 'live' && userId) {
      try {
        const { error: txErr } = await window.fidesDb.from('transactions')
          .update({ category: 'outros' }).eq('user_id', userId).eq('category', id);
        if (txErr) throw txErr;
        const { error: catErr } = await window.fidesDb.from('user_categories')
          .delete().eq('user_id', userId).eq('cat_key', id);
        if (catErr) throw catErr;
      } catch (err) {
        console.error('[Fides] deleteCategory:', err.message);
        setTransactions(txSnapshot);
        setCategories(prev => ({ ...prev, [id]: prevCat }));
        window.FidesUI.toast.error('Não foi possível excluir a categoria. Tente novamente.');
      }
    }
  }, [mode, userId, categories, transactions]);

  // Mudar de grupo é só um update de `grp` (persistido apenas para custom).
  const moveCategory = React.useCallback((id, newGroup) => {
    updateCategory(id, { group: newGroup });
  }, [updateCategory]);
  const setPlanned = React.useCallback((catId, value) => {
    setPlannedOverrides(p => ({ ...p, [catId]: value }));
  }, []);

  // ─── Category limits (Lote 3) ─────────────────────────────────
  // scope: 'this' (mes selecionado), 'default' (month=null) ou 'custom'
  // (cada month do array `months`). Para month=null fazemos delete+insert,
  // pois o unique constraint do Postgres nao deduplica linhas com NULL, entao
  // um upsert com onConflict nao funcionaria nesse caso.
  const setCategoryLimit = React.useCallback(async (cat_key, limit, scope, months) => {
    const val = Number(limit);
    if (!cat_key || !isFinite(val) || val <= 0) {
      throw new Error('Limite invalido');
    }
    if (mode !== 'live' || !userId) return;
    const persist = async (month) => {
      if (month == null) {
        await window.fidesDb.from('category_limits').delete()
          .eq('user_id', userId).eq('cat_key', cat_key).is('month', null);
        const { error } = await window.fidesDb.from('category_limits')
          .insert([{ user_id: userId, cat_key: cat_key, month: null, monthly_limit: val }]);
        if (error) throw error;
      } else {
        const { error } = await window.fidesDb.from('category_limits')
          .upsert([{ user_id: userId, cat_key: cat_key, month: month, monthly_limit: val }],
                  { onConflict: 'user_id,cat_key,month' });
        if (error) throw error;
      }
    };
    try {
      if (scope === 'default') {
        await persist(null);
      } else if (scope === 'custom') {
        const list = months || [];
        if (!list.length) return;
        for (let i = 0; i < list.length; i++) await persist(list[i]);
      } else {
        await persist(selectedMonth);
      }
      await refreshData(userId);
    } catch (err) {
      console.error('[Fides] setCategoryLimit:', err.message);
      throw err;
    }
  }, [mode, userId, selectedMonth, refreshData]);

  // scope: 'this' (mes selecionado), 'default' (month=null) ou 'specific'
  // (o month passado como argumento).
  const removeCategoryLimit = React.useCallback(async (cat_key, scope, month) => {
    if (!cat_key) return;
    if (mode !== 'live' || !userId) return;
    try {
      let q = window.fidesDb.from('category_limits').delete()
        .eq('user_id', userId).eq('cat_key', cat_key);
      if (scope === 'default') {
        q = q.is('month', null);
      } else if (scope === 'specific') {
        q = q.eq('month', month);
      } else {
        q = q.eq('month', selectedMonth);
      }
      const { error } = await q;
      if (error) throw error;
      await refreshData(userId);
    } catch (err) {
      console.error('[Fides] removeCategoryLimit:', err.message);
      throw err;
    }
  }, [mode, userId, selectedMonth, refreshData]);

  // ─── Category limits — copiar de outro mes (Lote 6) ───────────
  // Copia todos os overrides (month != null) de sourceMonth para targetMonth.
  // Sobrescreve overrides existentes em targetMonth (upsert). Nao toca em
  // defaults (month=null). Retorna { copied: n } com n = qtd de categorias
  // copiadas (0 se sourceMonth nao tiver nenhum override).
  const copyLimitsFromMonth = React.useCallback(async (sourceMonth, targetMonth) => {
    if (mode !== 'live' || !userId) return { copied: 0 };
    if (!sourceMonth || !targetMonth || sourceMonth === targetMonth) return { copied: 0 };
    const entries = Object.entries(categoryLimits)
      .filter(([, lim]) => lim && lim.byMonth && lim.byMonth[sourceMonth] != null)
      .map(([cat_key, lim]) => ({ cat_key, monthly_limit: Number(lim.byMonth[sourceMonth]) }));
    if (!entries.length) return { copied: 0 };
    try {
      const rows = entries.map(e => ({
        user_id: userId, cat_key: e.cat_key, month: targetMonth, monthly_limit: e.monthly_limit
      }));
      const { error } = await window.fidesDb.from('category_limits')
        .upsert(rows, { onConflict: 'user_id,cat_key,month' });
      if (error) throw error;
      await refreshData(userId);
      return { copied: entries.length };
    } catch (err) {
      console.error('[Fides] copyLimitsFromMonth:', err.message);
      throw err;
    }
  }, [mode, userId, categoryLimits, refreshData]);

  // ─── Category limits — calcular sugestoes (Lote 6B) ────────────
  // Para cada categoria SEM limite efetivo no mes selecionado (sem override
  // e sem default), calcula uma sugestao SEM aplicar:
  //   1) media dos overrides historicos da categoria (>=2 meses anteriores
  //      com override) — fonte preferencial, source='historico'; ou
  //   2) media dos gastos reais (transactions, is_transfer=false, valor<0)
  //      nos ultimos 3 meses anteriores, source='gastos'; ou
  //   3) omite a categoria, se nenhuma das duas fontes existir.
  // Retorna array [{ cat_key, label, emoji, monthly_limit, source }].
  // Funcao SINCRONA e pura — nao escreve no banco.
  const computeSuggestions = React.useCallback(() => {
    const monthsBack = [];
    let m = selectedMonth;
    for (let i = 0; i < 12; i++) { m = prevMonth(m); monthsBack.push(m); }

    const spendByMonthCat = {};
    transactions.forEach(t => {
      if (t.isTransfer || t.val >= 0) return;
      const tm = txMonth(t);
      if (!monthsBack.includes(tm)) return;
      spendByMonthCat[tm] = spendByMonthCat[tm] || {};
      spendByMonthCat[tm][t.cat] = (spendByMonthCat[tm][t.cat] || 0) + Math.abs(t.val);
    });

    const suggestions = [];
    Object.keys(categories).forEach(cat_key => {
      const lim = categoryLimits[cat_key];
      const hasEffective = lim && (
        (lim.byMonth && lim.byMonth[selectedMonth] != null) ||
        lim.default != null
      );
      if (hasEffective) return;

      const histLimits = (lim && lim.byMonth)
        ? monthsBack.map(mm => lim.byMonth[mm]).filter(v => v != null && v > 0)
        : [];

      let value = null;
      let source = null;
      if (histLimits.length >= 2) {
        value = histLimits.reduce((a, b) => a + b, 0) / histLimits.length;
        source = 'historico';
      } else {
        const last3 = monthsBack.slice(0, 3);
        const spends = last3
          .map(mm => (spendByMonthCat[mm] || {})[cat_key] || 0)
          .filter(v => v > 0);
        if (spends.length) {
          value = spends.reduce((a, b) => a + b, 0) / spends.length;
          source = 'gastos';
        }
      }
      if (value && value > 0) {
        const c = categories[cat_key] || {};
        suggestions.push({
          cat_key,
          label: c.label || cat_key,
          emoji: c.emoji || '🏷️',
          monthly_limit: Math.round(value * 100) / 100,
          source
        });
      }
    });

    return suggestions;
  }, [selectedMonth, transactions, categories, categoryLimits, prevMonth]);

  // ─── Category limits — aplicar sugestoes selecionadas (Lote 6B) ─
  // Recebe a lista (ja filtrada pelo usuario) e faz upsert no mes selecionado.
  // Retorna { applied: n }.
  const applySuggestions = React.useCallback(async (list) => {
    if (mode !== 'live' || !userId) return { applied: 0 };
    if (!list || !list.length) return { applied: 0 };
    try {
      const rows = list.map(s => ({
        user_id: userId, cat_key: s.cat_key, month: selectedMonth,
        monthly_limit: Number(s.monthly_limit)
      }));
      const { error } = await window.fidesDb.from('category_limits')
        .upsert(rows, { onConflict: 'user_id,cat_key,month' });
      if (error) throw error;
      await refreshData(userId);
      return { applied: list.length };
    } catch (err) {
      console.error('[Fides] applySuggestions:', err.message);
      throw err;
    }
  }, [mode, userId, selectedMonth, refreshData]);

  const updateProfile = React.useCallback(async function (newName) {
    const trimmed = String(newName || '').trim();
    if (!trimmed || trimmed.length < 2) return { error: 'Nome muito curto' };
    const cleaned = trimmed.replace(/[^a-zA-ZÀ-ÿ0-9 .'-]/g, '').trim();
    if (!cleaned) return { error: 'Nome inválido' };
    const uid = userId;
    if (!uid) return { error: 'Usuário não autenticado' };
    const { error } = await window.fidesDb
      .from('profiles')
      .update({ name: cleaned })
      .eq('id', uid);
    if (!error) setUserName(cleaned);
    return { error: error?.message || null };
  }, [userId]);

  const setGroupTargets = React.useCallback(async (patch) => {
    const next = { ...groupTargets, ...patch };
    next.essencial = Math.max(0, Number(next.essencial) || 0);
    next.estilo    = Math.max(0, Number(next.estilo)    || 0);
    next.divida    = Math.max(0, Number(next.divida)    || 0);
    if (mode === 'live' && userId) {
      const { error } = await window.fidesDb
        .from('profiles')
        .update({ group_targets: next })
        .eq('id', userId);
      if (error) throw error;
    }
    setGroupTargetsState(next);
  }, [mode, userId, groupTargets]);

  const resetGroupTargets = React.useCallback(async () => {
    const def = { essencial: 0.50, estilo: 0.30, divida: 0.20 };
    if (mode === 'live' && userId) {
      const { error } = await window.fidesDb
        .from('profiles')
        .update({ group_targets: def })
        .eq('id', userId);
      if (error) throw error;
    }
    setGroupTargetsState(def);
  }, [mode, userId]);

  // ─── Month helpers ────────────────────────────────────────────

  const prevMonth = (ym) => {
    const [y, m] = ym.split('-').map(s => parseInt(s, 10));
    if (m === 1) return `${y - 1}-12`;
    return `${y}-${String(m - 1).padStart(2, '0')}`;
  };
  const monthLabel = (ym) => {
    const meses      = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const mesesLongos = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const [y, m] = ym.split('-').map(s => parseInt(s, 10));
    return { short: `${meses[m - 1]} · ${y}`, long: `${mesesLongos[m - 1]} de ${y}` };
  };
  // monthsInRange: array de 'YYYY-MM' inclusivo de fromYM até toYM (base TX-03/TX-04).
  function monthsInRange(fromYM, toYM) {
    const out = [];
    let [y, m] = fromYM.split('-').map(Number);
    const [ey, em] = toYM.split('-').map(Number);
    while (y < ey || (y === ey && m <= em)) {
      out.push(`${y}-${String(m).padStart(2, '0')}`);
      m++; if (m > 12) { m = 1; y++; }
    }
    return out;
  }

  // ─── Derived state ────────────────────────────────────────────

  const monthTransactions = React.useMemo(() =>
    transactions.filter(t => txMonth(t) === selectedMonth),
  [transactions, selectedMonth]);

  // rangeTransactions: superset de monthTransactions para múltiplos meses (TX-04).
  // Sem filtrar is_transfer/val — a lista mostra tudo, igual a monthTransactions.
  const rangeTransactions = React.useCallback((fromYM, toYM) => {
    const months = new Set(monthsInRange(fromYM, toYM));
    return transactions.filter(t => months.has(txMonth(t)));
  }, [transactions]);

  // Lote 4D — receitas virtuais derivadas de recorrência
  const virtualRecurringRevenue = React.useMemo(() => {
    const recurTemplates = {};
    transactions.forEach(t => {
      if (t.recur === 'mensal' && t.val > 0 && !t.isTransfer && !t._isVirtual) {
        const key = (t.desc || '').toLowerCase().trim();
        if (!key) return;
        if (!recurTemplates[key] || t.mes > recurTemplates[key].mes) {
          recurTemplates[key] = t;
        }
      }
    });
    const virtuals = [];
    Object.keys(recurTemplates).forEach(key => {
      const tpl = recurTemplates[key];
      if (tpl.mes === selectedMonth) return;
      const hasReal = monthTransactions.some(t =>
        !t._isVirtual && t.val > 0 && !t.isTransfer &&
        (t.desc || '').toLowerCase().trim() === key
      );
      if (hasReal) return;
      const dd = String(tpl.d || '01').split('/')[0].padStart(2, '0');
      virtuals.push({
        ...tpl,
        _id:       'virtual:' + tpl._id + ':' + selectedMonth,
        _isVirtual: true,
        mes:       selectedMonth,
        status:    'pendente',
        date:      selectedMonth + '-' + dd,
      });
    });
    return virtuals;
  }, [transactions, monthTransactions, selectedMonth]);

  const prevMonthTransactions = React.useMemo(() => {
    const pm = prevMonth(selectedMonth);
    return transactions.filter(t => txMonth(t) === pm);
  }, [transactions, selectedMonth]);

  const spendByCategory = React.useMemo(() => {
    const map = {};
    monthTransactions.forEach(t => {
      if (t.val < 0 && !t.isTransfer) map[t.cat] = (map[t.cat] || 0) + Math.abs(t.val);
    });
    return Object.entries(map).map(([key, val]) => {
      const c = categories[key] || { label: key, tint: '#888', emoji: '🏷️' };
      return { key, val, label: c.label, tint: c.tint, emoji: c.emoji };
    }).sort((a, b) => b.val - a.val);
  }, [monthTransactions, categories]);

  // spendByCategoryRange: derivação paralela a spendByCategory, reprocessa
  // transactions completo sobre um range [fromYM, toYM] (TX-03). Não altera
  // spendByCategory (consumida por DashboardStudio e fides-claude.jsx).
  const spendByCategoryRange = React.useCallback((fromYM, toYM) => {
    const months = new Set(monthsInRange(fromYM, toYM));
    const map = {};
    transactions.forEach(t => {
      if (t.val < 0 && !t.isTransfer && months.has(txMonth(t))) {
        map[t.cat] = (map[t.cat] || 0) + Math.abs(t.val);
      }
    });
    return Object.entries(map).map(([key, val]) => {
      const c = categories[key] || { label: key, tint: '#888', emoji: '🏷️' };
      return { key, val, label: c.label, tint: c.tint, emoji: c.emoji };
    }).sort((a, b) => b.val - a.val);
  }, [transactions, categories]);

  // Uso vs limite por categoria para o mes selecionado. Regra de leitura:
  // limite do mes especifico (byMonth[selectedMonth]) tem prioridade sobre o
  // default; sem nenhum dos dois, a categoria fica sem limite (status null).
  const categoryUsage = React.useMemo(() => {
    const spentByKey = {};
    spendByCategory.forEach(s => { spentByKey[s.key] = Math.abs(s.val || 0); });
    const rank = { over: 0, warn: 1, ok: 2 };
    return Object.entries(categories).map(([cat_key, c]) => {
      const lim = categoryLimits[cat_key];
      const limit = lim
        ? (lim.byMonth && lim.byMonth[selectedMonth] != null
            ? lim.byMonth[selectedMonth]
            : (lim.default != null ? lim.default : null))
        : null;
      const spent = spentByKey[cat_key] || 0;
      const pct = limit ? Math.round((spent / limit) * 100) : null;
      const status = !limit ? null
        : pct >= 100 ? 'over'
        : pct >= 80 ? 'warn'
        : 'ok';
      return {
        cat_key: cat_key,
        label: c.label,
        emoji: c.emoji,
        grp: c.group,
        spent: spent,
        limit: limit,
        pct: pct,
        status: status
      };
    }).sort((a, b) => {
      const ra = a.status == null ? 3 : rank[a.status];
      const rb = b.status == null ? 3 : rank[b.status];
      if (ra !== rb) return ra - rb;
      return b.spent - a.spent;
    });
  }, [categoryLimits, spendByCategory, selectedMonth, categories]);

  const budgetGroups = React.useMemo(() => {
    // BUDGET_GROUPS é usado APENAS para label/target do grupo (50·30·20).
    // O limite por categoria vem de categoryLimits (regra byMonth→default→null, mesma de categoryUsage).
    return ['essencial', 'estilo', 'divida'].map(groupId => {
      const def = BUDGET_GROUPS.find(g => g.id === groupId);
      const cats = Object.entries(categories)
        .filter(([, c]) => c.group === groupId)
        .map(([id, c]) => {
          const lim = categoryLimits[id];
          const limit = lim
            ? (lim.byMonth && lim.byMonth[selectedMonth] != null
                ? lim.byMonth[selectedMonth]
                : (lim.default != null ? lim.default : null))
            : null;
          const spent = monthTransactions
            .filter(t => t.cat === id && t.val < 0 && !t.isTransfer)
            .reduce((s, t) => s + Math.abs(t.val), 0);
          return { cat: id, limit, spent, _custom: c.custom === true };
        })
        // Visível só se: categoria custom, limite definido pelo usuário, ou houve gasto.
        .filter(c => c._custom || c.limit != null || c.spent > 0)
        .map(({ _custom, ...c }) => c);
      const groupLimit = cats.every(c => c.limit == null) ? null : cats.reduce((s, c) => s + (c.limit || 0), 0);
      const spent = cats.reduce((s, c) => s + c.spent, 0);
      const pct = groupLimit != null ? Math.round((spent / groupLimit) * 100) : null;
      return { id: groupId, label: def?.label || groupId, target: groupTargets[groupId] || 0, limit: groupLimit, spent, pct, cats };
    });
  }, [monthTransactions, categories, categoryLimits, selectedMonth, groupTargets]);

  // faturasPorCartao: mode-aware so live card UUIDs resolve correctly
  const faturasPorCartao = React.useMemo(() => {
    const map = {};
    const cardList  = mode === 'live' ? cards : CARDS;
    const cardIdSet = new Set(cardList.map(c => c.id));
    transactions.forEach(t => {
      const isSettled = mode === 'live' ? t.settled : (t.status === 'pago');
      if (!cardIdSet.has(t.acct) || isSettled) return;
      const card = cardList.find(c => c.id === t.acct);
      const yr   = parseInt((t.mes || `${new Date().getFullYear()}-01`).split('-')[0], 10);
      const fat  = mesFaturaFor(t.d, card, yr);
      if (!fat) return;
      const key = `${t.acct}|${fat}`;
      if (!map[key]) map[key] = { cardId: t.acct, mesFatura: fat, total: 0, txs: [] };
      map[key].total += Math.abs(t.val);
      map[key].txs.push(t);
    });
    return map;
  }, [transactions, cards, mode]);

  // faturaAbertaPorCartao: agrega TODAS as txs não quitadas do cartão, independente
  // do mês de fatura — permite pagar a qualquer tempo (antes do fechamento).
  const faturaAbertaPorCartao = React.useMemo(() => {
    const map = {};
    const cardList  = mode === 'live' ? cards : CARDS;
    const cardIdSet = new Set(cardList.map(c => c.id));
    transactions.forEach(t => {
      const isSettled = mode === 'live' ? t.settled : (t.status === 'pago');
      if (!cardIdSet.has(t.acct) || isSettled) return;
      if (!map[t.acct]) map[t.acct] = { cardId: t.acct, total: 0, txs: [] };
      map[t.acct].total += Math.abs(t.val);
      map[t.acct].txs.push(t);
    });
    return map;
  }, [transactions, cards, mode]);

  const faturasDoCartao = React.useCallback((cardId) => {
    const cardList = mode === 'live' ? cards : CARDS;
    const card = cardList.find(c => c.id === cardId);
    if (!card) return [];

    const faturas = Object.values(faturasPorCartao).filter(f => f.cardId === cardId);
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const mapped = faturas.map(fat => {
      const { dtFechamento, dtVencimento } = computeFaturaDates(fat.mesFatura, card);

      let status = 'aberta';
      if (hoje > dtVencimento) {
        status = 'vencida';
      } else if (hoje > dtFechamento || hoje.getTime() === dtFechamento.getTime()) {
        status = 'fechada';
      }

      return { ...fat, dtFechamento, dtVencimento, status };
    });

    mapped.sort((a, b) => a.mesFatura.localeCompare(b.mesFatura));
    return mapped;
  }, [faturasPorCartao, cards, mode]);

  // faturasPorCartaoCompleto: igual a faturasPorCartao, mas inclui txs JÁ quitadas
  // (settled). Permite o card de Contas exibir uma fatura paga do mês selecionado
  // ("Fatura paga · R$ X") sem reabri-la para pagamento.
  const faturasPorCartaoCompleto = React.useMemo(() => {
    const map = {};
    const cardList  = mode === 'live' ? cards : CARDS;
    const cardIdSet = new Set(cardList.map(c => c.id));
    transactions.forEach(t => {
      if (!cardIdSet.has(t.acct)) return;
      const card = cardList.find(c => c.id === t.acct);
      const yr   = parseInt((t.mes || `${new Date().getFullYear()}-01`).split('-')[0], 10);
      const fat  = mesFaturaFor(t.d, card, yr);
      if (!fat) return;
      const key = `${t.acct}|${fat}`;
      if (!map[key]) map[key] = { cardId: t.acct, mesFatura: fat, total: 0, totalAberto: 0, txs: [], txsAbertas: [] };
      const isSettled = mode === 'live' ? t.settled : (t.status === 'pago');
      map[key].total += Math.abs(t.val);
      map[key].txs.push(t);
      if (!isSettled) {
        map[key].totalAberto += Math.abs(t.val);
        map[key].txsAbertas.push(t);
      }
    });
    return map;
  }, [transactions, cards, mode]);

  // faturasDoCartaoCompleto: mesma forma de faturasDoCartao, porém inclui faturas
  // pagas (status 'paga' quando não restam txs em aberto). USO: exibição no card,
  // escopada ao mês selecionado. NÃO usar para pagar (txs já quitadas dentro).
  const faturasDoCartaoCompleto = React.useCallback((cardId) => {
    const cardList = mode === 'live' ? cards : CARDS;
    const card = cardList.find(c => c.id === cardId);
    if (!card) return [];

    const faturas = Object.values(faturasPorCartaoCompleto).filter(f => f.cardId === cardId);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const mapped = faturas.map(fat => {
      const { dtFechamento, dtVencimento } = computeFaturaDates(fat.mesFatura, card);

      const paga = fat.txsAbertas.length === 0;
      let status = 'aberta';
      if (paga) {
        status = 'paga';
      } else if (hoje > dtVencimento) {
        status = 'vencida';
      } else if (hoje > dtFechamento || hoje.getTime() === dtFechamento.getTime()) {
        status = 'fechada';
      }

      return { ...fat, dtFechamento, dtVencimento, status, paga };
    });

    mapped.sort((a, b) => a.mesFatura.localeCompare(b.mesFatura));
    return mapped;
  }, [faturasPorCartaoCompleto, cards, mode]);

  // ─── Computed flags ───────────────────────────────────────────

  const isLoading = mode === 'loading';
  const isEmpty   = mode === 'live'
    && transactions.length === 0
    && accounts.length === 0
    && cards.length === 0;

  // ─── Context value ────────────────────────────────────────────

  const value = {
    // Mode & auth
    mode, userId, isLoading, isEmpty,
    userName, firstName, userEmail,
    // GATE-01: tier real (D-02, allow-list fail-closed — nunca negação !== 'free')
    userPlan, isPremium: userPlan === 'pro' || userPlan === 'family',
    refreshData: () => refreshData(userId),
    goals, addGoal, updateGoal, deleteGoal,
    uploadGoalCover, deleteGoalCover,
    // Transactions
    transactions, addTransaction, addTransactions, payCartaoFatura, transferFunds,
    updateTransaction, deleteTransaction,
    // Accounts
    accounts, addAccount, updateAccount, deleteAccount,
    // Cards
    cards, addCard, updateCard, deleteCard,
    // Categories
    categories, addCategory, updateCategory, deleteCategory, moveCategory,
    plannedOverrides, setPlanned,
    // Category limits (Lote 3)
    categoryLimits, categoryUsage, setCategoryLimit, removeCategoryLimit,
    // Category limits — copiar/sugerir (Lote 6 / 6B)
    copyLimitsFromMonth, computeSuggestions, applySuggestions,
    // Profile
    updateProfile,
    // Group targets (Lote 4B)
    groupTargets, setGroupTargets, resetGroupTargets,
    // Month
    selectedMonth, setSelectedMonth, prevMonth, monthLabel,
    // Derived
    monthTransactions, prevMonthTransactions, virtualRecurringRevenue,
    spendByCategory, budgetGroups, faturasPorCartao, faturaAbertaPorCartao, faturasDoCartao, faturasDoCartaoCompleto,
    // Range analytics (TX-03/TX-04 foundation)
    spendByCategoryRange, rangeTransactions,
    // UI toggles
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

// Hook with safe fallback so V3 reference dashboards work without a provider.
function useFides() {
  const ctx = React.useContext(FidesStoreContext);
  if (ctx) return ctx;
  return {
    mode: 'mock', userId: null, isLoading: false, isEmpty: false,
    userName: '', firstName: '', userEmail: '',
    userPlan: 'free', isPremium: false,
    refreshData: async () => {},
    goals: [], addGoal: () => {}, updateGoal: () => {}, deleteGoal: () => {},
    uploadGoalCover: async () => {}, deleteGoalCover: async () => {},
    transactions: TRANSACTIONS,
    monthTransactions: TRANSACTIONS,
    prevMonthTransactions: [],
    addTransaction: () => {}, addTransactions: () => {}, payCartaoFatura: () => {}, transferFunds: () => {},
    updateTransaction: () => {}, deleteTransaction: () => {},
    accounts: ACCOUNTS, addAccount: () => {}, updateAccount: () => {}, deleteAccount: () => {},
    cards: CARDS, addCard: () => {}, updateCard: () => {}, deleteCard: () => {},
    categories: CATEGORIES,
    addCategory: () => {}, updateCategory: () => {}, deleteCategory: () => {}, moveCategory: () => {},
    plannedOverrides: {}, setPlanned: () => {},
    categoryLimits: {}, categoryUsage: [],
    setCategoryLimit: () => {}, removeCategoryLimit: () => {},
    groupTargets: { essencial: 0.50, estilo: 0.30, divida: 0.20 },
    setGroupTargets: async () => {}, resetGroupTargets: async () => {},
    selectedMonth: new Date().toISOString().slice(0, 7), setSelectedMonth: () => {},
    prevMonth: (ym) => ym, monthLabel: (ym) => ({ short: ym, long: ym }),
    spendByCategory: SPEND_BY_CATEGORY,
    budgetGroups: BUDGET_GROUPS,
    faturasPorCartao: {},
    faturaAbertaPorCartao: {},
    faturasDoCartao: () => [],
    faturasDoCartaoCompleto: () => [],
    virtualRecurringRevenue: [],
    spendByCategoryRange: () => [],
    rangeTransactions: () => [],
    openCategoryModal: () => {}, closeCategoryModal: () => {},
    openAssistant: () => {}, closeAssistant: () => {},
    assistantOpen: false, categoryModalOpen: false,
  };
}

// ─── <CategoryAvatar/> ────────────────────────────────────────
function CategoryAvatar({ cat, size = 32, categories: categoriesProp }) {
  const ctx  = React.useContext(FidesStoreContext);
  const cats = categoriesProp || ctx?.categories || CATEGORIES;
  const c    = cats[cat] || { label: cat || '?', tint: '#888', emoji: null };
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
            fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif',
          }}>
      {c.emoji || (
        <span style={{ color: c.tint, fontSize: size * 0.42, fontWeight: 600, fontFamily: 'inherit' }}>
          {(c.label || '?')[0]}
        </span>
      )}
    </span>
  );
}

// ─── <MoveCatDropdown/> ───────────────────────────────────────
function MoveCatDropdown({ id, currentGroup }) {
  const { moveCategory } = useFides();
  const [open, setOpen]  = React.useState(false);
  const ref              = React.useRef(null);

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

// ─── <CategoriaModal/> ────────────────────────────────────────
const CATEGORY_TINTS = [
  '#F59E0B','#EF4444','#DC2626','#7C3AED','#0EA5E9','#16A34A','#F97316',
  '#0891B2','#CA8A04','#EC4899','#A855F7','#22C55E','#8B5CF6','#06B6D4',
  '#F43F5E','#B91C1C','#0F766E','#10B981','#84CC16','#3B82F6','#6366F1',
];

function CategoriaModal({ open, onClose }) {
  const { categories, addCategory, updateCategory, deleteCategory, moveCategory } = useFides();
  const { rendered, closing, requestClose } = window.FidesUI.useModalClose(open, onClose);
  const [activeGroup, setActiveGroup] = React.useState('essencial');
  const [creating, setCreating]       = React.useState(false);
  const [draft, setDraft]             = React.useState({
    label: '', emoji: '🛒', tint: '#F59E0B', group: 'essencial',
  });

  if (!rendered) return null;

  const grouped = ['essencial', 'estilo', 'divida', 'receita'].map(g => ({
    id: g,
    label: g === 'essencial' ? 'Essencial'
         : g === 'estilo'    ? 'Estilo de vida'
         : g === 'divida'    ? 'Dívidas & investimentos'
         : 'Receitas',
    cats: Object.entries(categories).filter(([, c]) => c.group === g),
  }));

  const handleSave = () => {
    if (!draft.label.trim()) return;
    const id = draft.label.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
      .slice(0, 20) || 'custom_' + Date.now();
    // Editar uma categoria custom existente não pode chamar insert (viola unique):
    // roteia para updateCategory. Caso contrário, cria nova via addCategory.
    if (categories[id] && categories[id].custom) {
      updateCategory(id, draft);
    } else {
      addCategory(id, draft);
    }
    setCreating(false);
    setDraft({ label: '', emoji: '🛒', tint: '#F59E0B', group: activeGroup });
  };

  return (
    <div className={"fds-modal-backdrop" + (closing ? " is-closing" : "")} onClick={requestClose} style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      <div className={"fds-modal cat-modal" + (closing ? " is-closing" : "")} onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <header className="fds-modal-head">
          <div>
            <div className="fds-modal-eyebrow">Personalizar</div>
            <h2 className="fds-modal-title">Categorias</h2>
          </div>
          <button className="fds-icon-btn" onClick={requestClose}><Icon.X size={16}/></button>
        </header>

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
          <button className="fds-btn-primary" onClick={requestClose}>Fechar</button>
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
