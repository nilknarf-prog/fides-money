// fides-claude.jsx — Assistente Fides com Gemini 2.5 Flash-Lite
// Lote A2.2: tools WRITE com card de confirmação + limpeza de histórico após 2h.
// - 6 tools: 2 READ (consultar_saldo, consultar_extrato) + 4 WRITE
// - WRITE: lancar, recategorizar, editar, criar_categoria (com card de confirmação)
// - Limpeza automática do chat após 2h de inatividade

const MAX_TOOL_ITERATIONS = 2;
const COOLDOWN_NORMAL_SEC = 10;
const COOLDOWN_RATELIMIT_SEC = 60;
const HISTORY_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 horas
// AI-RETRY-CLIENT-01: o backend já faz retry + fallback de modelo numa mesma request
// (até 5 tentativas upstream em 2 pools, 1 slot de cota). Esta camada só cobre o caso raro
// em que a request inteira ainda volta 503 (GEMINI_UNAVAILABLE): 1 retentativa transparente
// esconde o blip. Mantido em 1 de propósito — cada request que chega ao backend consome 1
// slot da cota diária mesmo quando o Gemini falha, então nada de tempestade de retries aqui.
const ASSISTANT_RETRY_ON_503 = 1;
const ASSISTANT_RETRY_DELAY_MS = 1200;
// AI-WRITE-MIRROR-01: bump de versão da chave de sessão — invalida sessões já poluídas pelo
// espelhamento de desfecho WRITE (12-06) num único deploy, sem esperar HISTORY_TIMEOUT_MS.
const STORAGE_KEY_MESSAGES = 'fides_assistant_messages_v2';
const STORAGE_KEY_LAST_ACTIVITY = 'fides_assistant_last_activity_v2';
const TOAST_DURATION_MS = 3000;

// AI-WRITE-MIRROR-01: constantes de desfecho sintético (synthesizeWriteReply) — fonte única,
// reusada pelo guard anti-espelho (isSyntheticWriteOutcome). Mensagens compostas a partir
// destas constantes são marcadas `writeOutcome: true` e NUNCA reenviadas ao Gemini como
// texto de histórico (ver o `.filter` da montagem do history em `send`).
const WRITE_OUTCOME_CANCEL = 'Ok, cancelei então. Se quiser, é só me pedir de novo. 👍';
const WRITE_OUTCOME_SUCCESS_PREFIX = 'Pronto! ';
const WRITE_OUTCOME_SUCCESS_NO_PARTS = 'Pronto, feito! ✓';

// Tools que requerem confirmação visual antes de executar
const TOOLS_REQUIRING_CONFIRMATION = ['lancar_transacao', 'recategorizar_transacao', 'editar_transacao', 'criar_categoria'];

function FidesAssistant() {
  const fs = useFides();
  const {
    assistantOpen, closeAssistant,
    transactions, monthTransactions, accounts, cards, categories,
    spendByCategory, budgetGroups, faturaAbertaPorCartao,
    selectedMonth, monthLabel, goals, userName, firstName,
    addTransaction, updateTransaction, addCategory,
  } = fs;
  const lbl = monthLabel(selectedMonth);

  // Estado: tenta carregar do sessionStorage com verificação de timeout
  const initState = () => {
    try {
      const lastActivity = parseInt(sessionStorage.getItem(STORAGE_KEY_LAST_ACTIVITY), 10);
      if (lastActivity && (Date.now() - lastActivity) < HISTORY_TIMEOUT_MS) {
        const stored = sessionStorage.getItem(STORAGE_KEY_MESSAGES);
        if (stored) return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[FidesAssistant] sessionStorage init failed', e);
    }
    return [];
  };

  const [messages, setMessages] = React.useState(initState);
  const [input, setInput] = React.useState('');
  const [thinking, setThinking] = React.useState(false);
  const [thinkingLabel, setThinkingLabel] = React.useState('');
  const [error, setError] = React.useState(null);
  const [cooldown, setCooldown] = React.useState(0);
  const [rateLimitMode, setRateLimitMode] = React.useState(null);
  const [pendingConfirmation, setPendingConfirmation] = React.useState(null); // { toolCall, resolved }
  const [toast, setToast] = React.useState(null); // { text, ts }
  const listRef = React.useRef(null);

  // Ponte p/ o guard de ⌘K (Plan 05)
  React.useEffect(() => {
    window.__fidesWriteConfirmPending = !!pendingConfirmation;
    return () => { window.__fidesWriteConfirmPending = false; };
  }, [pendingConfirmation]);

  // Persistir mensagens + timestamp
  React.useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
      sessionStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(Date.now()));
    } catch (e) {
      console.warn('[FidesAssistant] sessionStorage save failed', e);
    }
  }, [messages]);

  // Welcome message ao abrir vazio
  React.useEffect(() => {
    if (assistantOpen && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `Olá${firstName ? `, ${firstName}` : ''}! Sou o Assistente Fides. Posso consultar seus saldos, analisar seu extrato e responder duvidas sobre suas financas. Estou aqui para ajudar. Você está vendo o ${lbl.long} agora — me pergunte algo.`,
        ts: Date.now(),
      }]);
    }
  }, [assistantOpen]);

  // Auto-scroll
  React.useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, thinking, thinkingLabel, cooldown, pendingConfirmation]);

  // Countdown
  React.useEffect(() => {
    if (cooldown <= 0) {
      if (rateLimitMode) setRateLimitMode(null);
      return;
    }
    const t = setTimeout(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown, rateLimitMode]);

  // Toast auto-dismiss
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(t);
  }, [toast]);

  if (!assistantOpen) return null;

  // ─── Contexto resumido ────────────────────
  const buildContext = () => {
    const receitas  = monthTransactions.filter(t => !t.isTransfer && t.val > 0).reduce((s,t) => s + t.val, 0);
    const despesas  = monthTransactions.filter(t => !t.isTransfer && t.val < 0).reduce((s,t) => s + Math.abs(t.val), 0);
    const pendentes = monthTransactions.filter(t => !t.isTransfer && t.val < 0 && t.status === 'pendente').reduce((s,t) => s + Math.abs(t.val), 0);
    const top3 = (spendByCategory || []).slice(0, 3).map(c => `${c.label} ${fmtBRL(c.val)}`).join(', ');
    const orcStatus = (budgetGroups || []).map(g =>
      `${g.label}: ${fmtBRL(g.spent)} de ${fmtBRL(g.limit)} (${g.limit > 0 ? Math.round((g.spent/g.limit)*100) : 0}%)`
    ).join('; ');
    const metasInfo = (goals && goals.length > 0)
      ? goals.map(m => `${m.nome}: ${fmtBRL(m.atual)} de ${fmtBRL(m.alvo)} (${Math.round(m.alvo > 0 ? m.atual / m.alvo * 100 : 0)}%, aportando ${fmtBRL(m.contribuicao)}/mês)`).join('; ')
      : 'nenhuma';
    const categoriasDisponiveis = Object.entries(categories || {})
      .filter(([k, v]) => v && v.label)
      .map(([k, v]) => `${v.label} (id: ${k})`)
      .slice(0, 30)
      .join(', ');
    return [
      userName ? `Usuário: ${userName}.` : '',
      `Mês em foco: ${lbl.long}.`,
      `Receitas do mês: ${fmtBRL(receitas)}. Despesas: ${fmtBRL(despesas)}. Em aberto (pendentes): ${fmtBRL(pendentes)}.`,
      `Top gastos por categoria: ${top3 || 'nenhum gasto categorizado ainda'}.`,
      `Status do Planejamento (50·30·20): ${orcStatus || 'sem limites definidos'}.`,
      `Metas em curso: ${metasInfo}.`,
      (accounts && accounts.length > 0) ? `Contas: ${accounts.map(a => `${a.name} (id: ${a.id}, saldo ${fmtBRL(a.balance)})`).join(', ')}.` : 'Nenhuma conta cadastrada.',
      (cards && cards.length > 0) ? `Cartões: ${cards.map(c => `${c.name} (id: ${c.id}, usando ${fmtBRL(c.used)} de ${fmtBRL(c.limit)})`).join(', ')}.` : 'Nenhum cartão cadastrado.',
      `Categorias disponíveis: ${categoriasDisponiveis || 'apenas as padrão'}.`
    ].filter(Boolean).join(' ');
  };

  // ─── Helpers: resolver nomes em UUIDs ──────
  const findAccountByName = (query) => {
    if (!query) return null;
    const q = String(query).toLowerCase().trim();
    return (accounts || []).find(a => a.name && a.name.toLowerCase().includes(q)) || null;
  };

  const findCardByName = (query) => {
    if (!query) return null;
    const q = String(query).toLowerCase().trim();
    return (cards || []).find(c => c.name && c.name.toLowerCase().includes(q)) || null;
  };

  const findCategoryByName = (query) => {
    if (!query) return null;
    const q = String(query).toLowerCase().trim();
    const cats = Object.entries(categories || {});
    // 1. match exato por id (ex.: "mercado")
    if (categories[q]) return { id: q, ...categories[q] };
    // 2. match exato por label (ex.: "Presente")
    let entry = cats.find(([, v]) => v && v.label && v.label.toLowerCase().trim() === q);
    // 3. label contém a query (ex.: "aliment" → "Alimentação")
    if (!entry) entry = cats.find(([, v]) => v && v.label && v.label.toLowerCase().includes(q));
    // 4. a query contém o label (ex.: "presente de natal" → "Presente") — evita criar
    //    categoria duplicada quando o usuário só detalhou a existente. Label de 1 palavra
    //    casa por token exato (não deixa "conta" casar dentro de "descontos"); label de
    //    várias palavras casa por substring (o espaço já torna o acerto improvável de errar).
    if (!entry) {
      const qTokens = q.split(/\s+/).filter(Boolean);
      entry = cats.find(([, v]) => {
        if (!v || !v.label) return false;
        const lbl = v.label.toLowerCase().trim();
        if (!lbl) return false;
        return lbl.includes(' ') ? q.includes(lbl) : qTokens.includes(lbl);
      });
    }
    return entry ? { id: entry[0], ...entry[1] } : null;
  };

  // ─── Executores das tools ──────────────────
  // READ-ONLY (executam direto)
  const toolExecutors = {
    consultar_saldo: () => {
      const receitas  = monthTransactions.filter(t => !t.isTransfer && t.val > 0).reduce((s,t) => s + t.val, 0);
      const despesasPagas = monthTransactions.filter(t => !t.isTransfer && t.val < 0 && t.status === 'pago').reduce((s,t) => s + Math.abs(t.val), 0);
      const despesasPendentes = monthTransactions.filter(t => !t.isTransfer && t.val < 0 && t.status === 'pendente').reduce((s,t) => s + Math.abs(t.val), 0);
      return {
        mes: lbl.long,
        contas: (accounts || []).map(a => ({ nome: a.name, saldo: Number(a.balance) || 0 })),
        cartoes: (cards || []).map(c => {
          const used = Number(c.used) || 0;
          const limit = Number(c.limit) || 0;
          const faturaAberta = Number((faturaAbertaPorCartao || {})[c.id]) || 0;
          return {
            nome: c.name,
            limite_total: limit,
            usado: used,
            disponivel: Math.max(0, limit - used),
            fatura_em_aberto: faturaAberta,
          };
        }),
        totais_do_mes: {
          receitas: Number(receitas.toFixed(2)),
          despesas_pagas: Number(despesasPagas.toFixed(2)),
          despesas_pendentes: Number(despesasPendentes.toFixed(2)),
        },
      };
    },

    consultar_extrato: (args = {}) => {
      const periodo = String(args.periodo || 'mes').toLowerCase();
      const filtroContaQ = String(args.conta || '').toLowerCase().trim();
      const filtroCartaoQ = String(args.cartao || '').toLowerCase().trim();
      const limite = Math.max(1, Math.min(50, parseInt(args.limite, 10) || 20));

      let pool = [];
      if (periodo === 'hoje') {
        const today = new Date();
        const todayKey = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}`;
        pool = transactions.filter(t => t.d === todayKey);
      } else if (periodo === 'semana') {
        const seven = new Date(); seven.setDate(seven.getDate() - 7);
        pool = transactions.filter(t => {
          if (!t.dateObj) {
            try {
              const [dd, mm] = (t.d || '').split('/');
              const [yyyy] = (t.mes || '').split('-');
              const dt = new Date(`${yyyy}-${mm}-${dd}`);
              return dt >= seven;
            } catch { return false; }
          }
          return t.dateObj >= seven;
        });
      } else if (periodo === 'prev_mes') {
        const [yyyy, mm] = selectedMonth.split('-').map(Number);
        const prev = mm === 1 ? `${yyyy-1}-12` : `${yyyy}-${String(mm-1).padStart(2,'0')}`;
        pool = transactions.filter(t => t.mes === prev);
      } else {
        pool = monthTransactions;
      }

      if (filtroContaQ) {
        pool = pool.filter(t => {
          const acc = accounts.find(a => a.id === t.acct || a.id === t.account_id);
          if (!acc) return false;
          return acc.name.toLowerCase().includes(filtroContaQ);
        });
      }

      if (filtroCartaoQ) {
        pool = pool.filter(t => {
          const card = cards.find(c => c.id === t.card_id);
          if (!card) return false;
          return card.name.toLowerCase().includes(filtroCartaoQ);
        });
      }

      const items = pool.slice(0, limite).map(t => {
        const cat = categories[t.cat] || {};
        const accObj = accounts.find(a => a.id === t.acct || a.id === t.account_id);
        const cardObj = cards.find(c => c.id === t.card_id);
        return {
          id: t._id || t.id,
          descricao: t.desc || '',
          valor: Number(t.val) || 0,
          tipo: (Number(t.val) || 0) >= 0 ? 'receita' : 'despesa',
          categoria: cat.label || t.cat || '—',
          categoria_id: t.cat,
          data: t.d || '',
          conta: accObj ? accObj.name : null,
          cartao: cardObj ? cardObj.name : null,
          status: t.status || 'pago',
          eh_movimentacao: !!t.isTransfer,
        };
      });

      const totalDespesas = items.filter(i => i.tipo === 'despesa' && !i.eh_movimentacao).reduce((s,i) => s + Math.abs(i.valor), 0);
      const totalReceitas = items.filter(i => i.tipo === 'receita' && !i.eh_movimentacao).reduce((s,i) => s + i.valor, 0);

      return {
        periodo,
        filtros: { conta: filtroContaQ || null, cartao: filtroCartaoQ || null },
        total_encontrado: pool.length,
        retornado: items.length,
        soma_despesas: Number(totalDespesas.toFixed(2)),
        soma_receitas: Number(totalReceitas.toFixed(2)),
        transacoes: items,
      };
    },
  };

  // Resolver tool WRITE preparando os argumentos finais (UUIDs)
  const resolveWriteToolArgs = (toolCall) => {
    const { name, args } = toolCall;
    if (name === 'lancar_transacao') {
      const ref = args.conta_ou_cartao || '';
      // WR-01: um tipo_destino presente mas fora do enum ('conta'|'cartao') — ex. 'cartão'/
      // 'crédito' acentuado que o modelo às vezes emite — não pode cair no fallback posicional
      // abaixo: isso reintroduz o destino errado silencioso que o 12-07 matou. Normaliza as
      // variantes óbvias; se ainda assim não reconhecer, fail-closed (pede desambiguação).
      let tipo = args.tipo_destino;
      if (typeof tipo === 'string' && tipo.trim()) {
        const norm = tipo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        if (norm === 'cartao' || norm === 'credito' || norm === 'cartao de credito') tipo = 'cartao';
        else if (norm === 'conta' || norm === 'debito' || norm === 'pix' || norm === 'conta corrente') tipo = 'conta';
        else return { error: `Não entendi se "${ref}" é uma conta ou um cartão. Diga "cartão ${ref}" para o cartão de crédito ou "conta ${ref}" para a conta corrente.` };
      } else {
        tipo = undefined;
      }
      // AI-DEST-HOMONIMO-01: consultar SEMPRE os dois (nunca condicionar findCardByName a
      // "nenhuma conta casou") — senão o qualificador "cartão" do usuário nunca entra na
      // decisão e uma conta homônima sempre vence pela ordem (12-UAT Test 1).
      const accMatch = findAccountByName(ref);
      const cardMatch = findCardByName(ref);

      let target = null;
      if (tipo === 'cartao') {
        if (!cardMatch) {
          return { error: `Não encontrei um cartão chamado "${ref}". Cartões disponíveis: ${(cards||[]).map(c=>c.name).join(', ') || 'nenhum'}` };
        }
        target = { type: 'card', id: cardMatch.id, name: cardMatch.name, obj: cardMatch };
      } else if (tipo === 'conta') {
        if (!accMatch) {
          return { error: `Não encontrei uma conta chamada "${ref}". Contas disponíveis: ${(accounts||[]).map(a=>a.name).join(', ') || 'nenhuma'}` };
        }
        target = { type: 'account', id: accMatch.id, name: accMatch.name };
      } else if (accMatch && cardMatch) {
        // Homônimo sem tipo declarado: NUNCA escolher pela ordem (fail-closed) — pedir
        // desambiguação explícita ao usuário.
        return { error: `Encontrei uma conta E um cartão chamados "${ref}" — qual você quis dizer? Diga "cartão ${ref}" para o cartão de crédito ou "conta ${ref}" para a conta corrente.` };
      } else if (accMatch) {
        target = { type: 'account', id: accMatch.id, name: accMatch.name };
      } else if (cardMatch) {
        target = { type: 'card', id: cardMatch.id, name: cardMatch.name, obj: cardMatch };
      } else {
        return { error: `Não encontrei conta ou cartão chamado "${ref}". Contas/cartões disponíveis: ${[...(accounts||[]).map(a=>a.name), ...(cards||[]).map(c=>c.name)].join(', ')}` };
      }

      const cat = findCategoryByName(args.categoria);
      let catId, catLabel;
      let createCategory = null;
      if (cat) {
        catId = cat.id;
        catLabel = cat.label;
      } else {
        catLabel = String(args.categoria || '').trim();
        catId = catLabel.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        if (!catId) return { error: `Categoria inválida.` };
        createCategory = { label: catLabel, catKey: catId, emoji: '🏷️', group: 'estilo' };
      }
      
      let yr, mm, dd;
      if (args.data && /^\d{4}-\d{2}-\d{2}$/.test(args.data)) {
        [yr, mm, dd] = args.data.split('-');
      } else {
        const today = new Date();
        yr = String(today.getFullYear());
        mm = String(today.getMonth() + 1).padStart(2, '0');
        dd = String(today.getDate()).padStart(2, '0');
      }
      const isoDate = `${yr}-${mm}-${dd}`;
      const dateStr = `${dd}/${mm}`;
      
      const val = Number(args.valor) || 0;
      return {
        resolved: {
          tipo: val >= 0 ? 'receita' : 'despesa',
          val,
          desc: args.descricao,
          cat: catId,
          catLabel,
          createCategory,
          isoDate,
          dateStr,
          ano: parseInt(yr, 10),
          status: args.status || 'pago',
          target,
        },
      };
    }
    if (name === 'recategorizar_transacao') {
      const tx = transactions.find(t => (t._id || t.id) === args.transacao_id);
      if (!tx) return { error: `Transação ${args.transacao_id} não encontrada.` };
      const cat = findCategoryByName(args.nova_categoria);
      if (!cat) return { error: `Categoria "${args.nova_categoria}" não encontrada.` };
      return {
        resolved: {
          tx,
          newCatId: cat.id,
          newCatLabel: cat.label,
        },
      };
    }
    if (name === 'editar_transacao') {
      const tx = transactions.find(t => (t._id || t.id) === args.transacao_id);
      if (!tx) return { error: `Transação ${args.transacao_id} não encontrada.` };
      return {
        resolved: {
          tx,
          patch: args.patch || {},
        },
      };
    }
    if (name === 'criar_categoria') {
      const label = String(args.nome || '').trim();
      if (!label) return { error: 'Label da categoria é obrigatório.' };
      const catKey = label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      if (!catKey) return { error: 'Categoria inválida.' };
      return {
        resolved: {
          label,
          catKey,
          emoji: String(args.emoji || '🏷️'),
          group: 'estilo'
        }
      };
    }
    return { error: `Tool ${name} não suportada.` };
  };

  // Executar tool WRITE após confirmação do usuário
  const executeWriteTool = async (toolCall, resolved) => {
    const { name } = toolCall;
    try {
      if (name === 'lancar_transacao') {
        const r = resolved;
        if (r.createCategory) {
          await addCategory(r.createCategory.catKey, {
            label: r.createCategory.label,
            emoji: r.createCategory.emoji,
            group: r.createCategory.group,
            custom: true
          });
        }
        
        const isCard = r.target.type === 'card';
        const p_month = isCard 
          ? window.mesFaturaFor(r.dateStr, r.target.obj, r.ano)
          : r.isoDate.substring(0, 7);
          
        const p_status = isCard ? 'pending' : (r.status === 'pago' ? 'cleared' : 'pending');
        
        const { error: rpcError } = await window.fidesDb.rpc('wa_log_transaction', {
          p_description: r.desc,
          p_value: r.val,
          p_category: r.cat,
          p_date: r.isoDate,
          p_month: p_month,
          p_status: p_status,
          p_account_id: isCard ? null : r.target.id,
          p_card_id: isCard ? r.target.id : null
        });
        
        if (rpcError) throw rpcError;
        
        if (fs.refreshData) await fs.refreshData();
        return { success: true, message: `Lancei ${fmtBRL(Math.abs(r.val))} (${r.desc}) em ${r.target.name}.` };
      }
      if (name === 'recategorizar_transacao') {
        await updateTransaction(resolved.tx._id || resolved.tx.id, { cat: resolved.newCatId });
        return { success: true, message: `Categoria atualizada para "${resolved.newCatLabel}".` };
      }
      if (name === 'editar_transacao') {
        const patch = {};
        if (resolved.patch.valor !== undefined) {
          // Manter sinal do valor original
          const sign = (Number(resolved.tx.val) || 0) >= 0 ? 1 : -1;
          patch.val = sign * Math.abs(Number(resolved.patch.valor));
        }
        if (resolved.patch.descricao !== undefined) patch.desc = String(resolved.patch.descricao);
        if (resolved.patch.data !== undefined) patch.d = String(resolved.patch.data);
        if (resolved.patch.status !== undefined) patch.status = String(resolved.patch.status);
        await updateTransaction(resolved.tx._id || resolved.tx.id, patch);
        return { success: true, message: `Transação atualizada.` };
      }
      if (name === 'criar_categoria') {
        await addCategory(resolved.catKey, { label: resolved.label, emoji: resolved.emoji, group: resolved.group, custom: true });
        setToast({ text: `✓ Categoria "${resolved.label}" criada`, ts: Date.now() });
        return { success: true, categoria_id: resolved.catKey, label: resolved.label, emoji: resolved.emoji, group: resolved.group, message: `Criei a categoria "${resolved.label}".` };
      }
      return { error: 'UNKNOWN_TOOL' };
    } catch (err) {
      console.error('[FidesAssistant] executeWriteTool error', err);
      return { error: 'EXECUTION_ERROR', message: String(err?.message || err) };
    }
  };

  // Executar tools (loop principal)
  const executeTools = async (toolCalls) => {
    const results = [];
    for (const tc of toolCalls) {
      try {
        if (TOOLS_REQUIRING_CONFIRMATION.includes(tc.name)) {
          // Resolver args (resolver UUIDs)
          const resolution = resolveWriteToolArgs(tc);
          if (resolution.error) {
            results.push({ name: tc.name, args: tc.args, id: tc.id, result: { error: 'RESOLUTION_ERROR', message: resolution.error } });
            continue;
          }
          // Aguardar confirmação do usuário (Promise resolvida pelos botões)
          const confirmed = await new Promise(resolve => {
            setPendingConfirmation({
              toolCall: tc,
              resolved: resolution.resolved,
              onDecide: (decision) => resolve(decision),
            });
          });
          setPendingConfirmation(null);
          if (confirmed === 'cancel') {
            results.push({ name: tc.name, args: tc.args, id: tc.id, result: { cancelled: true, message: 'Usuário cancelou a operação.' } });
            continue;
          }
          // Executar
          const execResult = await executeWriteTool(tc, resolution.resolved);
          results.push({ name: tc.name, args: tc.args, id: tc.id, result: execResult });
        } else {
          // Tool sem confirmação (READ ou WRITE leve)
          const fn = toolExecutors[tc.name];
          if (!fn) {
            results.push({ name: tc.name, args: tc.args, id: tc.id, result: { error: 'TOOL_NOT_FOUND' } });
            continue;
          }
          const result = fn(tc.args || {});
          results.push({ name: tc.name, args: tc.args, id: tc.id, result });
        }
      } catch (err) {
        console.error('[FidesAssistant] tool exec error', tc.name, err);
        results.push({ name: tc.name, args: tc.args, id: tc.id, result: { error: 'EXECUTION_ERROR', message: String(err?.message || err) } });
      }
    }
    return results;
  };

  const friendlyError = (errCode) => {
    const map = {
      JWT_MISSING:         'Sua sessão não foi reconhecida. Faça login de novo.',
      JWT_INVALID:         'Sua sessão expirou. Faça login de novo.',
      RATE_LIMIT:          'O assistente está com muitas conversas no momento. Aguarde para tentar de novo.',
      USER_DAILY_LIMIT:    'Você atingiu o limite diário de mensagens com o assistente. Tente novamente em algumas horas.',
      GEMINI_KEY_MISSING:  'O assistente está indisponível agora. Tente em instantes.',
      GEMINI_BAD_REQUEST:  'Não consegui entender sua mensagem. Tente reformular.',
      EMPTY_REPLY:         'O assistente não conseguiu responder dessa vez. Tente reformular.',
      GEMINI_ERROR:        'O assistente está temporariamente fora do ar. Tente em instantes.',
      GEMINI_UNAVAILABLE:  'Serviço indisponível no momento. Tente novamente em instantes.',
      GEMINI_TIMEOUT:      'O assistente demorou demais. Tente novamente.',
      GEMINI_SERVER_ERROR: 'Erro interno do assistente. Tente novamente em instantes.',
      INTERNAL_ERROR:      'Algo deu errado do nosso lado. Tente novamente.',
      NETWORK:             'Sem conexão. Verifique a internet.',
      TOOL_LIMIT:          'O assistente ficou em loop. Tente reformular a pergunta.',
      FREE_MONTHLY_LIMIT:  'Você usou toda a degustação gratuita de IA deste mês. O Premium libera mensagens ilimitadas — veja os planos no seu Perfil.',
      PREMIUM_REQUIRED:    'Esse recurso é exclusivo do plano Premium. Veja os planos no seu Perfil.',
    };
    return map[errCode] || 'Não consegui responder agora. Tente de novo em instantes.';
  };

  const callAssistant = async (history, toolResults, lastToolCalls, jwt, nonceStr) => {
    const ctx = buildContext();
    const res = await fetch('/api/assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        messages: history,
        context: ctx,
        toolResults: toolResults || null,
        lastToolCalls: lastToolCalls || null,
        nonce: nonceStr || null
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  };

  // AI-RETRY-CLIENT-01: retentativa transparente só no 503 (GEMINI_UNAVAILABLE). O nonce é
  // HMAC stateless (TTL 120s), então reenviar a mesma request com toolResults+nonce é seguro
  // (sem replay nem gasto duplo). Erros não-503 (429/401/400/...) sobem na hora, sem retry.
  const callAssistantWithRetry = async (history, toolResults, lastToolCalls, jwt, nonceStr) => {
    let res = await callAssistant(history, toolResults, lastToolCalls, jwt, nonceStr);
    for (let r = 0; r < ASSISTANT_RETRY_ON_503 && !res.ok && res.status === 503; r++) {
      await new Promise(resolve => setTimeout(resolve, ASSISTANT_RETRY_DELAY_MS));
      res = await callAssistant(history, toolResults, lastToolCalls, jwt, nonceStr);
    }
    return res;
  };

  // AI-WRITE-NOCALL-01: monta a confirmação de um lote de tools WRITE 100% localmente, a partir
  // dos resultados que já temos — sem gastar uma 2ª chamada ao Gemini só pro texto. Usado tanto
  // no atalho pós-WRITE (corta ~50% da cota/tokens em lançamentos) quanto na degradação quando
  // a chamada seguinte falha.
  const synthesizeWriteReply = (results) => {
    const parts = [];
    let anySuccess = false, anyCancel = false;
    for (const r of (results || [])) {
      const res = r && r.result;
      if (!res) continue;
      if (res.success) { anySuccess = true; if (res.message) parts.push(res.message); }
      else if (res.cancelled) { anyCancel = true; }
    }
    if (anySuccess) return parts.length ? `${WRITE_OUTCOME_SUCCESS_PREFIX}${parts.join(' ')}` : WRITE_OUTCOME_SUCCESS_NO_PARTS;
    if (anyCancel) return WRITE_OUTCOME_CANCEL;
    return 'Feito.';
  };

  // AI-WRITE-MIRROR-01: defesa em profundidade — os textos de desfecho WRITE são artefatos
  // 100% locais (só synthesizeWriteReply os produz) e um cancelamento real é resolvido
  // localmente (short-circuit allWrite && allTerminal) antes de chegar ao Gemini. Logo, um
  // reply de TEXTO (sem tool_call) que reproduza um desses textos só pode ser espelhamento.
  const isSyntheticWriteOutcome = (text) => {
    const t = String(text || '').trim();
    if (!t) return false;
    if (t === WRITE_OUTCOME_CANCEL) return true;
    if (t === WRITE_OUTCOME_SUCCESS_NO_PARTS) return true;
    // CR-01: só é espelhamento se reproduzir VERBATIM um desfecho sintético de fato emitido
    // nesta sessão (mensagens marcadas writeOutcome). Casar o prefixo genérico 'Pronto! '
    // descartava respostas legítimas — inclusive o turno de texto após um tool READ
    // (consultar_saldo/consultar_extrato), onde 'Pronto! ...' é resposta válida, não espelho.
    if (messages.some(m => m && m.writeOutcome && String(m.content || '').trim() === t)) return true;
    return false;
  };

  // AI-WRITE-FABRICATION-01: o guard verbatim acima (isSyntheticWriteOutcome) só pega ECO de um
  // desfecho sintético já emitido. Mas o flash-lite, sob toolMode AUTO, às vezes FABRICA um
  // desfecho de escrita do zero em TEXTO ("Entendido! Lancei R$ 1,00...") sem chamar a ferramenta
  // — o card nunca aparece e nada é salvo, mas o usuário é informado que "lancei" (12-UAT Test 4).
  // Como TODA escrita real vira uma mensagem writeOutcome via card de confirmação, um reply de
  // TEXTO (sem tool_call) que AFIRME conclusão de escrita é sempre mentira. Detecta paráfrases
  // (não só verbatim) por verbo de conclusão em 1ª pessoa / particípio de desfecho. NÃO casa
  // infinitivos ("posso lançar", "quer criar?") nem perguntas de esclarecimento legítimas.
  const claimsWriteCompletion = (text) => {
    const t = String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (!t.trim()) return false;
    return /\b(lancei|lancado|lancada|lancados|lancadas|criei|criada|criado|criados|criadas|cancelei|cancelada|cancelado|editei|editada|editado|registrei|registrada|registrado|adicionei|adicionada|adicionado|recategorizei)\b/.test(t);
  };

  const send = async (q) => {
    const question = (q ?? input).trim();
    if (!question || thinking || cooldown > 0 || pendingConfirmation) return;
    setInput('');
    setError(null);
    const userMsg = { role: 'user', content: question, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setThinking(true);
    setThinkingLabel('');

    try {
      let jwt = null;
      if (window.fidesAuth && typeof window.fidesAuth.getSession === 'function') {
        const { data: sessionData } = await window.fidesAuth.getSession();
        jwt = sessionData?.session?.access_token || null;
      }
      if (!jwt) {
        setError(friendlyError('JWT_MISSING'));
        setThinking(false);
        setThinkingLabel('');
        return;
      }

      // AI-WRITE-MIRROR-01: exclui desfechos WRITE sintéticos (writeOutcome) do history enviado
      // ao Gemini — permanecem visíveis na UI (array `messages` intacto), mas deixam de ser a
      // fonte que o modelo espelhava verbatim em turnos seguintes.
      const history = [...messages, userMsg]
        .filter(m => (m.role === 'user' || m.role === 'assistant') && !m.writeOutcome)
        .map(m => ({ role: m.role, content: m.content }));

      let toolResults = null;
      let lastToolCalls = null;
      let iteration = 0;
      let lastNonce = null;
      let forcedWriteRetry = false;

      while (iteration < MAX_TOOL_ITERATIONS) {
        const { ok, status, data } = await callAssistantWithRetry(history, toolResults, lastToolCalls, jwt, lastNonce);

        if (!ok) {
          // AI-WRITE-DEGRADE-01: se um WRITE já executou neste turno (transação criada etc.),
          // a ação do usuário ESTÁ concluída — esta chamada seguinte só geraria o texto de
          // confirmação. Se ela falhar (429/503/timeout), NÃO mostrar erro nem travar 60s:
          // sintetiza a confirmação a partir do resultado da tool que já rodou.
          const hadSuccessfulWrite = Array.isArray(toolResults)
            && toolResults.some(r => r && r.result && r.result.success);
          if (hadSuccessfulWrite) {
            setMessages(prev => [...prev, { role: 'assistant', content: synthesizeWriteReply(toolResults), ts: Date.now(), writeOutcome: true }]);
            setCooldown(COOLDOWN_NORMAL_SEC);
            setThinking(false);
            setThinkingLabel('');
            return;
          }
          const errCode = data?.error;
          if (status === 429) {
            if (errCode === 'USER_DAILY_LIMIT') {
              setError(friendlyError('USER_DAILY_LIMIT'));
              setRateLimitMode('user');
              setCooldown(COOLDOWN_RATELIMIT_SEC);
            } else if (errCode === 'FREE_MONTHLY_LIMIT') {
              setError(friendlyError('FREE_MONTHLY_LIMIT'));
              setRateLimitMode('user');
              setCooldown(COOLDOWN_RATELIMIT_SEC);
            } else {
              setError(friendlyError('RATE_LIMIT'));
              setRateLimitMode('global');
              setCooldown(COOLDOWN_RATELIMIT_SEC);
            }
          } else {
            setError(friendlyError(errCode));
            setCooldown(COOLDOWN_NORMAL_SEC);
          }
          setThinking(false);
          setThinkingLabel('');
          return;
        }

        if (Array.isArray(data?.tool_calls) && data.tool_calls.length > 0) {
          if (data.nonce) lastNonce = data.nonce;
          lastToolCalls = data.tool_calls;
          setThinkingLabel('consultando seus dados...');
          // executeTools agora é async (pode esperar confirmação)
          toolResults = await executeTools(data.tool_calls);

          // AI-WRITE-NOCALL-01: se TODAS as tools deste lote são WRITE e terminaram num estado
          // final (sucesso ou cancelado), a resposta já está inteira no resultado local — pula a
          // 2ª chamada ao Gemini (que só geraria o textinho) e sintetiza aqui. Corta ~50% da cota
          // gasta em lançamentos. READ (consultar_*) e erros de WRITE seguem pro modelo, que
          // precisa interpretar os dados / ajudar a recuperar.
          const allWrite = data.tool_calls.every(tc => TOOLS_REQUIRING_CONFIRMATION.includes(tc.name));
          const allTerminal = Array.isArray(toolResults) && toolResults.length > 0
            && toolResults.every(r => r && r.result && (r.result.success || r.result.cancelled));
          if (allWrite && allTerminal) {
            setMessages(prev => [...prev, { role: 'assistant', content: synthesizeWriteReply(toolResults), ts: Date.now(), writeOutcome: true }]);
            setCooldown(COOLDOWN_NORMAL_SEC);
            setThinking(false);
            setThinkingLabel('');
            return;
          }

          iteration++;
          continue;
        }

        const reply = data?.reply;
        if (!reply) {
          setError(friendlyError('EMPTY_REPLY'));
          setCooldown(COOLDOWN_NORMAL_SEC);
          setThinking(false);
          setThinkingLabel('');
          return;
        }
        if (isSyntheticWriteOutcome(reply)) {
          // AI-WRITE-MIRROR-01: guard anti-espelho — reply de texto idêntico a um desfecho WRITE
          // sintético (sem tool_call) é sempre espelhamento. Suprime (não exibe, não persiste) e
          // substitui por uma mensagem neutra, sem re-semear poluição.
          setMessages(prev => [...prev, { role: 'assistant', content: 'Não fiquei certo do que já foi feito — pode repetir o que você quer lançar?', ts: Date.now() }]);
          setCooldown(COOLDOWN_NORMAL_SEC);
          setThinking(false);
          setThinkingLabel('');
          return;
        }
        if (claimsWriteCompletion(reply)) {
          // AI-WRITE-FABRICATION-01: chegar aqui significa que data.tool_calls veio VAZIO (o branch
          // de tool_calls acima faz continue/return) — ou seja, o modelo AFIRMOU concluir uma escrita
          // em texto sem chamar ferramenta nenhuma: NADA foi salvo. Nunca exibir a afirmação falsa.
          // 1x: injeta correção no history e re-tenta em AUTO. NÃO forço mode 'ANY' de propósito —
          // forçar a chamada faria o modelo INVENTAR campos que o usuário não deu (viola "NUNCA
          // invente"; melhor ele perguntar). Se insistir na fabricação, cai no fail-safe honesto.
          if (!forcedWriteRetry) {
            forcedWriteRetry = true;
            history.push({
              role: 'user',
              content: 'ATENÇÃO: sua última resposta afirmou que algo foi feito, mas você NÃO chamou nenhuma ferramenta — então NADA foi salvo. Se você tem todos os dados (valor, categoria, destino), CHAME a ferramenta agora. Se falta algum dado, PERGUNTE. Nunca afirme que lançou/criou/cancelou sem chamar a ferramenta.'
            });
            toolResults = null;
            lastToolCalls = null;
            lastNonce = null;
            iteration++;
            continue;
          }
          setMessages(prev => [...prev, { role: 'assistant', content: 'Não executei nada ainda — nenhum lançamento foi salvo. Pode repetir o pedido? Ex: "lance 50 no mercado, categoria alimentação, conta Nubank".', ts: Date.now() }]);
          setCooldown(COOLDOWN_NORMAL_SEC);
          setThinking(false);
          setThinkingLabel('');
          return;
        }
        setMessages(prev => [...prev, { role: 'assistant', content: reply, ts: Date.now() }]);
        setCooldown(COOLDOWN_NORMAL_SEC);
        setThinking(false);
        setThinkingLabel('');
        return;
      }

      setError(friendlyError('TOOL_LIMIT'));
      setCooldown(COOLDOWN_NORMAL_SEC);
      setThinking(false);
      setThinkingLabel('');
    } catch (err) {
      console.error('[FidesAssistant] send error', err);
      setError(friendlyError('NETWORK'));
      setCooldown(COOLDOWN_NORMAL_SEC);
      setThinking(false);
      setThinkingLabel('');
    }
  };

  const quickPrompts = [
    'Quanto eu tenho disponível?',
    'O que gastei essa semana?',
    'Como está meu orçamento?',
    'Lança R$ 50 no mercado',
  ];

  const errorWithCountdown = error && cooldown > 0 && rateLimitMode
    ? `${error} Aguarde ${cooldown}s.`
    : error;

  const sendDisabled = !input.trim() || thinking || cooldown > 0 || !!pendingConfirmation;

  // Render card de confirmação inline
  const renderConfirmationCard = () => {
    if (!pendingConfirmation) return null;
    const { toolCall, resolved, onDecide } = pendingConfirmation;
    let title = '';
    let details = [];

    if (toolCall.name === 'lancar_transacao') {
      title = resolved.tipo === 'despesa' ? '📌 Lançar despesa' : '💰 Lançar receita';
      if (resolved.createCategory) {
        details.push({ label: 'Nova categoria', value: `Vou criar "${resolved.createCategory.label}"` });
        details.push({ 
          label: 'Grupo da categoria', 
          value: (
            <select
              defaultValue={resolved.createCategory.group || 'estilo'}
              onChange={(e) => { resolved.createCategory.group = e.target.value; }}
              style={{ padding: '2px 4px', fontSize: 13, borderRadius: 4, border: '1px solid var(--ink-4)', background: 'var(--bg)', color: 'var(--ink-1)', outline: 'none' }}
            >
              <option value="essencial">Essencial</option>
              <option value="estilo">Estilo de Vida</option>
              <option value="renda">Renda</option>
              <option value="ignorados">Ignorados</option>
            </select>
          ) 
        });
      }
      details.push(
        { label: 'Descrição', value: resolved.desc },
        { label: 'Valor', value: fmtBRL(Math.abs(resolved.val)) },
        { label: resolved.target.type === 'account' ? 'Conta' : 'Cartão', value: resolved.target.name },
        { label: 'Categoria', value: resolved.catLabel },
        { label: 'Data', value: resolved.dateStr },
        { label: 'Status', value: resolved.status === 'pago' ? 'Pago' : 'Pendente' }
      );
    } else if (toolCall.name === 'recategorizar_transacao') {
      title = '🏷️ Mudar categoria';
      details = [
        { label: 'Transação', value: resolved.tx.desc || '—' },
        { label: 'Valor', value: fmtBRL(Math.abs(Number(resolved.tx.val) || 0)) },
        { label: 'Nova categoria', value: resolved.newCatLabel },
      ];
    } else if (toolCall.name === 'editar_transacao') {
      title = '✏️ Editar transação';
      const changes = [];
      if (resolved.patch.valor !== undefined) changes.push({ label: 'Novo valor', value: fmtBRL(Math.abs(Number(resolved.patch.valor))) });
      if (resolved.patch.descricao !== undefined) changes.push({ label: 'Nova descrição', value: resolved.patch.descricao });
      if (resolved.patch.data !== undefined) changes.push({ label: 'Nova data', value: resolved.patch.data });
      if (resolved.patch.status !== undefined) changes.push({ label: 'Novo status', value: resolved.patch.status === 'pago' ? 'Pago' : 'Pendente' });
      details = [
        { label: 'Transação', value: resolved.tx.desc || '—' },
        ...changes,
      ];
    } else if (toolCall.name === 'criar_categoria') {
      title = '🏷️ Criar categoria';
      details = [
        { label: 'Nome', value: resolved.label },
        { label: 'Emoji', value: resolved.emoji },
        { 
          label: 'Grupo', 
          value: (
            <select
              defaultValue={resolved.group || 'estilo'}
              onChange={(e) => { resolved.group = e.target.value; }}
              style={{ padding: '2px 4px', fontSize: 13, borderRadius: 4, border: '1px solid var(--ink-4)', background: 'var(--bg)', color: 'var(--ink-1)', outline: 'none' }}
            >
              <option value="essencial">Essencial</option>
              <option value="estilo">Estilo de Vida</option>
              <option value="renda">Renda</option>
              <option value="ignorados">Ignorados</option>
            </select>
          )
        }
      ];
    }

    return (
      <div className="cla-confirm-card">
        <div className="cla-confirm-title">{title}</div>
        <div className="cla-confirm-details">
          {details.map((d, i) => (
            <div key={i} className="cla-confirm-row">
              <span className="cla-confirm-label">{d.label}</span>
              <strong className="cla-confirm-value">{d.value}</strong>
            </div>
          ))}
        </div>
        <div className="cla-confirm-actions">
          <button
            className="cla-confirm-cancel"
            onClick={() => onDecide('cancel')}
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>
            Cancelar
          </button>
          <button
            className="cla-confirm-ok"
            onClick={() => onDecide('confirm')}
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>
            Confirmar
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="cla-backdrop" onClick={closeAssistant}/>
      <aside className="cla-panel" role="dialog" aria-label="Assistente Fides">
        <header className="cla-head">
          <div className="cla-head-l">
            <div className="cla-head-mark"><Icon.Sparkles size={16}/></div>
            <div>
              <div className="cla-head-eyebrow">Conversar com</div>
              <div className="cla-head-title">Assistente Fides</div>
            </div>
          </div>
          <button className="fds-icon-btn" onClick={closeAssistant} title="Fechar" style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>
            <Icon.X size={16}/>
          </button>
        </header>

        <div className="cla-context">
          <Icon.Eye size={11}/>
          Vendo: <strong>{lbl.long}</strong> · {monthTransactions.length} lançamentos
        </div>

        <div className="cla-messages" ref={listRef}>
          {messages.map((m, i) => (
            <div key={i} className={`cla-msg cla-msg-${m.role}`}>
              {m.role === 'assistant' && (
                <div className="cla-msg-avatar"><Icon.Sparkles size={12}/></div>
              )}
              <div className="cla-msg-bubble">
                {m.content.split('\n').map((line, j) => (
                  <p key={j}>{line}</p>
                ))}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="cla-msg cla-msg-assistant">
              <div className="cla-msg-avatar"><Icon.Sparkles size={12}/></div>
              <div className="cla-msg-bubble cla-thinking">
                {thinkingLabel ? (
                  <span style={{ fontSize: 13, color: 'var(--ink-3)', fontStyle: 'italic' }}>{thinkingLabel}</span>
                ) : (
                  <><span/><span/><span/></>
                )}
              </div>
            </div>
          )}
          {renderConfirmationCard()}
          {error && (
            <div className="cla-msg cla-msg-error">
              <Icon.X size={12}/> {errorWithCountdown}
            </div>
          )}
        </div>

        {messages.length <= 1 && !thinking && !pendingConfirmation && (
          <div className="cla-suggestions">
            {quickPrompts.map(p => (
              <button
                key={p}
                className="cla-suggestion"
                onClick={() => send(p)}
                disabled={cooldown > 0}
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', opacity: cooldown > 0 ? 0.5 : 1 }}>
                {p}
              </button>
            ))}
          </div>
        )}

        <form className="cla-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={cooldown > 0 && !rateLimitMode ? `Aguarde ${cooldown}s para enviar...` : pendingConfirmation ? 'Confirme ou cancele a ação acima...' : 'Pergunte sobre suas finanças, o app, investimentos…'}
            disabled={thinking || cooldown > 0 || !!pendingConfirmation}
            style={{ fontSize: 16 }}
            autoFocus/>
          <button type="submit" disabled={sendDisabled} style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>
            {thinking ? <Icon.Clock size={14}/> : <Icon.Right size={14}/>}
          </button>
        </form>

        <div className="cla-foot">
          <span>Respostas geradas por IA — podem conter erros. Confira valores antes de decidir.</span>
        </div>

        {toast && (
          <div className="cla-toast" role="status">
            {toast.text}
          </div>
        )}
      </aside>
    </>
  );
}

function FidesAssistantFAB() {
  const { openAssistant, assistantOpen } = useFides();
  if (assistantOpen) return null;
  return (
    <button
      className="cla-fab"
      onClick={openAssistant}
      title="Conversar com o Assistente Fides"
      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>
      <Icon.Sparkles size={20}/>
      <span className="cla-fab-pulse"/>
    </button>
  );
}

Object.assign(window, { FidesAssistant, FidesAssistantFAB });
