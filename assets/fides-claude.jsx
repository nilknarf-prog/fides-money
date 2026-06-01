// fides-claude.jsx — Assistente Fides com Groq (Llama 3.1 8B Instant) + tools read-only
// Lote A2.1.1: throttle de 4s entre mensagens + countdown de 60s em caso de rate limit.
// Tools (consultar_saldo, consultar_extrato) executam no cliente usando useFides().
// Loop de tool calls limitado a 2 iterações por turno (anti-loop + economia de quota).
// Sem retry automático: usuário decide quando tentar de novo após countdown.

const MAX_TOOL_ITERATIONS = 2;
const COOLDOWN_NORMAL_SEC = 4;
const COOLDOWN_RATELIMIT_SEC = 60;

function FidesAssistant() {
  const fs = useFides();
  const {
    assistantOpen, closeAssistant,
    transactions, monthTransactions, accounts, cards, categories,
    spendByCategory, budgetGroups, faturaAbertaPorCartao,
    selectedMonth, monthLabel, goals, userName,
  } = fs;
  const lbl = monthLabel(selectedMonth);

  const [messages, setMessages] = React.useState([]); // {role, content, ts}
  const [input, setInput] = React.useState('');
  const [thinking, setThinking] = React.useState(false);
  const [thinkingLabel, setThinkingLabel] = React.useState('');
  const [error, setError] = React.useState(null);
  const [cooldown, setCooldown] = React.useState(0); // segundos restantes
  const [rateLimitMode, setRateLimitMode] = React.useState(null); // 'global' | 'user' | null
  const listRef = React.useRef(null);

  // Welcome message
  React.useEffect(() => {
    if (assistantOpen && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `Olá${userName ? `, ${userName.split(' ')[0]}` : ''}! Sou o Assistente Fides. Posso analisar seus gastos, consultar saldos e extrato, falar sobre planejamento, metas e investimentos básicos. Você está vendo o ${lbl.long} agora — me pergunte algo.`,
        ts: Date.now(),
      }]);
    }
  }, [assistantOpen]);

  // Auto-scroll
  React.useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, thinking, thinkingLabel, cooldown]);

  // Countdown decrementing
  React.useEffect(() => {
    if (cooldown <= 0) {
      if (rateLimitMode) setRateLimitMode(null);
      return;
    }
    const t = setTimeout(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown, rateLimitMode]);

  if (!assistantOpen) return null;

  // ─── Contexto resumido (overview para o system prompt) ─────────
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
    return [
      userName ? `Usuário: ${userName}.` : '',
      `Mês em foco: ${lbl.long}.`,
      `Receitas do mês: ${fmtBRL(receitas)}. Despesas: ${fmtBRL(despesas)}. Em aberto (pendentes): ${fmtBRL(pendentes)}.`,
      `Top gastos por categoria: ${top3 || 'nenhum gasto categorizado ainda'}.`,
      `Status do Planejamento (50·30·20): ${orcStatus || 'sem limites definidos'}.`,
      `Metas em curso: ${metasInfo}.`,
      (accounts && accounts.length > 0) ? `Contas: ${accounts.map(a => `${a.name} saldo ${fmtBRL(a.balance)}`).join(', ')}.` : 'Nenhuma conta cadastrada.',
      (cards && cards.length > 0) ? `Cartões: ${cards.map(c => `${c.name} usando ${fmtBRL(c.used)} de ${fmtBRL(c.limit)}`).join(', ')}.` : 'Nenhum cartão cadastrado.',
    ].filter(Boolean).join(' ');
  };

  // ─── Executores das tools ──────────────────
  const toolExecutors = {
    consultar_saldo: () => {
      const receitas  = monthTransactions.filter(t => !t.isTransfer && t.val > 0).reduce((s,t) => s + t.val, 0);
      const despesasPagas = monthTransactions.filter(t => !t.isTransfer && t.val < 0 && t.status === 'pago').reduce((s,t) => s + Math.abs(t.val), 0);
      const despesasPendentes = monthTransactions.filter(t => !t.isTransfer && t.val < 0 && t.status === 'pendente').reduce((s,t) => s + Math.abs(t.val), 0);
      return {
        mes: lbl.long,
        contas: (accounts || []).map(a => ({
          nome: a.name,
          saldo: Number(a.balance) || 0,
        })),
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
          descricao: t.desc || '',
          valor: Number(t.val) || 0,
          tipo: (Number(t.val) || 0) >= 0 ? 'receita' : 'despesa',
          categoria: cat.label || t.cat || '—',
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

  const executeTools = (toolCalls) => {
    return toolCalls.map(tc => {
      try {
        const fn = toolExecutors[tc.name];
        if (!fn) return { name: tc.name, args: tc.args, callId: tc.callId, result: { error: 'TOOL_NOT_FOUND' } };
        const result = fn(tc.args || {});
        return { name: tc.name, args: tc.args, callId: tc.callId, result };
      } catch (err) {
        console.error('[FidesAssistant] tool exec error', tc.name, err);
        return { name: tc.name, args: tc.args, callId: tc.callId, result: { error: 'EXECUTION_ERROR', message: String(err?.message || err) } };
      }
    });
  };

  const friendlyError = (errCode) => {
    const map = {
      JWT_MISSING:         'Sua sessão não foi reconhecida. Faça login de novo.',
      JWT_INVALID:         'Sua sessão expirou. Faça login de novo.',
      RATE_LIMIT:          'O assistente está com muitas conversas no momento. Aguarde para tentar de novo.',
      USER_DAILY_LIMIT:    'Você atingiu o limite diário de mensagens com o assistente. Tente novamente em algumas horas.',
      GROQ_KEY_MISSING:    'O assistente está indisponível agora. Tente em instantes.',
      GROQ_KEY_INVALID:    'O assistente está indisponível agora. Tente em instantes.',
      GROQ_BAD_REQUEST:    'Não consegui entender sua mensagem. Tente reformular.',
      EMPTY_REPLY:         'O assistente não conseguiu responder dessa vez. Tente reformular.',
      GROQ_ERROR:          'O assistente está temporariamente fora do ar. Tente em instantes.',
      INTERNAL_ERROR:      'Algo deu errado do nosso lado. Tente novamente.',
      NETWORK:             'Sem conexão. Verifique a internet.',
      TOOL_LIMIT:          'O assistente ficou em loop. Tente reformular a pergunta.',
    };
    return map[errCode] || 'Não consegui responder agora. Tente de novo em instantes.';
  };

  const callAssistant = async (history, toolResults, jwt) => {
    const ctx = buildContext();
    const res = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: history,
        context: ctx,
        jwt,
        toolResults: toolResults || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  };

  const send = async (q) => {
    const question = (q ?? input).trim();
    if (!question || thinking || cooldown > 0) return;
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

      const history = [...messages, userMsg]
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }));

      let toolResults = null;
      let iteration = 0;

      while (iteration < MAX_TOOL_ITERATIONS) {
        const { ok, status, data } = await callAssistant(history, toolResults, jwt);

        if (!ok) {
          const errCode = data?.error;
          // Tratamento especial para rate limits
          if (status === 429) {
            if (errCode === 'USER_DAILY_LIMIT') {
              setError(friendlyError('USER_DAILY_LIMIT'));
              setRateLimitMode('user');
              setCooldown(COOLDOWN_RATELIMIT_SEC);
            } else {
              setError(friendlyError('RATE_LIMIT'));
              setRateLimitMode('global');
              setCooldown(COOLDOWN_RATELIMIT_SEC);
            }
          } else {
            setError(friendlyError(errCode));
            // Cooldown normal de 4s mesmo em erro
            setCooldown(COOLDOWN_NORMAL_SEC);
          }
          setThinking(false);
          setThinkingLabel('');
          return;
        }

        if (Array.isArray(data?.tool_calls) && data.tool_calls.length > 0) {
          setThinkingLabel('consultando seus dados...');
          toolResults = executeTools(data.tool_calls);
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
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: reply,
          ts: Date.now(),
        }]);
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
    'Vale a pena investir agora?',
  ];

  // Mensagem de cooldown visível no erro
  const errorWithCountdown = error && cooldown > 0 && rateLimitMode
    ? `${error} Aguarde ${cooldown}s.`
    : error;

  const sendDisabled = !input.trim() || thinking || cooldown > 0;

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
          {error && (
            <div className="cla-msg cla-msg-error">
              <Icon.X size={12}/> {errorWithCountdown}
            </div>
          )}
        </div>

        {messages.length <= 1 && !thinking && (
          <div className="cla-suggestions">
            {quickPrompts.map(p => (
              <button
                key={p}
                className="cla-suggestion"
                onClick={() => send(p)}
                disabled={cooldown > 0}
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', opacity: cooldown > 0 ? 0.5 : 1 }}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        <form className="cla-input"
              onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={cooldown > 0 && !rateLimitMode ? `Aguarde ${cooldown}s para enviar...` : 'Pergunte sobre suas finanças, o app, investimentos…'}
            disabled={thinking || cooldown > 0}
            style={{ fontSize: 16 }}
            autoFocus/>
          <button type="submit" disabled={sendDisabled} style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>
            {thinking ? <Icon.Clock size={14}/> : <Icon.Right size={14}/>}
          </button>
        </form>

        <div className="cla-foot">
          <span>Respostas geradas por IA — podem conter erros. Confira valores antes de decidir.</span>
        </div>
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
      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
    >
      <Icon.Sparkles size={20}/>
      <span className="cla-fab-pulse"/>
    </button>
  );
}

Object.assign(window, { FidesAssistant, FidesAssistantFAB });
