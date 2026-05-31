// fides-claude.jsx — Assistente Fides com Gemini 2.5 Flash Lite
// Chat puro (sem tools ainda — Lote A2 vai adicionar function calling).
// Chama /api/assistant (serverless Vercel) que protege a API key e valida JWT.
// Contexto financeiro do mês selecionado é injetado em toda mensagem.

function FidesAssistant() {
  const { assistantOpen, closeAssistant, monthTransactions, spendByCategory, budgetGroups, selectedMonth, monthLabel, goals, accounts, cards, userName } = useFides();
  const lbl = monthLabel(selectedMonth);

  const [messages, setMessages] = React.useState([]); // {role, content, ts}
  const [input, setInput] = React.useState('');
  const [thinking, setThinking] = React.useState(false);
  const [error, setError] = React.useState(null);
  const listRef = React.useRef(null);

  // Welcome message once when panel opens
  React.useEffect(() => {
    if (assistantOpen && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `Olá${userName ? `, ${userName.split(' ')[0]}` : ''}! Sou o Assistente Fides. Posso analisar seus gastos, falar sobre planejamento, metas e investimentos básicos. Você está vendo o ${lbl.long} agora — me pergunte algo.`,
        ts: Date.now(),
      }]);
    }
  }, [assistantOpen]);

  // Auto-scroll
  React.useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  if (!assistantOpen) return null;

  // ─── Contexto financeiro injetado em toda pergunta ──────────
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

  // ─── Traduz erros do backend pra mensagem amigável ──────────
  const friendlyError = (errCode) => {
    const map = {
      JWT_MISSING:        'Sua sessão não foi reconhecida. Faça login de novo.',
      JWT_INVALID:        'Sua sessão expirou. Faça login de novo.',
      RATE_LIMIT:         'Muitas conversas agora — espere um minuto e tente de novo.',
      GEMINI_KEY_MISSING: 'O assistente está indisponível agora. Tente em instantes.',
      GEMINI_BAD_REQUEST: 'Não consegui entender sua mensagem. Tente reformular.',
      EMPTY_REPLY:        'O assistente não conseguiu responder dessa vez. Tente reformular.',
      GEMINI_ERROR:       'O assistente está temporariamente fora do ar. Tente em instantes.',
      INTERNAL_ERROR:     'Algo deu errado do nosso lado. Tente novamente.',
      NETWORK:            'Sem conexão. Verifique a internet.',
    };
    return map[errCode] || 'Não consegui responder agora. Tente de novo em instantes.';
  };

  const send = async (q) => {
    const question = (q ?? input).trim();
    if (!question || thinking) return;
    setInput('');
    setError(null);
    const userMsg = { role: 'user', content: question, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setThinking(true);

    try {
      // 1. Pegar JWT da sessão Supabase
      let jwt = null;
      if (window.fidesAuth && typeof window.fidesAuth.getSession === 'function') {
        const { data: sessionData } = await window.fidesAuth.getSession();
        jwt = sessionData?.session?.access_token || null;
      }
      if (!jwt) {
        setError(friendlyError('JWT_MISSING'));
        setThinking(false);
        return;
      }

      // 2. Montar histórico (excluir mensagem de boas-vindas inicial pra não confundir o modelo)
      const history = [...messages, userMsg]
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }));

      // 3. Montar contexto financeiro
      const ctx = buildContext();

      // 4. Chamar serverless
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, context: ctx, jwt }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(friendlyError(data?.error));
        setThinking(false);
        return;
      }

      const reply = data?.reply;
      if (!reply) {
        setError(friendlyError('EMPTY_REPLY'));
        setThinking(false);
        return;
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: reply,
        ts: Date.now(),
      }]);
    } catch (err) {
      console.error('[FidesAssistant] send error', err);
      setError(friendlyError('NETWORK'));
    } finally {
      setThinking(false);
    }
  };

  const quickPrompts = [
    'Onde eu gastei mais este mês?',
    'Como posso acelerar minhas metas?',
    'Vale a pena investir agora?',
    'Como o Fides trata gastos no crédito?',
  ];

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
                <span/><span/><span/>
              </div>
            </div>
          )}
          {error && (
            <div className="cla-msg cla-msg-error">
              <Icon.X size={12}/> {error}
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
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
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
            placeholder="Pergunte sobre suas finanças, o app, investimentos…"
            disabled={thinking}
            style={{ fontSize: 16 }}
            autoFocus/>
          <button type="submit" disabled={!input.trim() || thinking} style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>
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

// Floating action button (visible em qualquer página, abre o assistente)
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
