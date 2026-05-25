// fides-claude.jsx — Assistente conversacional com Claude
// Usa window.claude.complete (haiku 4.5, 1024 tokens). Injeta resumo
// do mês selecionado como contexto pro modelo dar conselhos relevantes.
// parseTxJson: detecta JSON de transação sugerida e oferece confirmação.

function FidesAssistant() {
  const { assistantOpen, closeAssistant, monthTransactions, spendByCategory, budgetGroups, selectedMonth, monthLabel, addTransaction } = useFides();
  const lbl = monthLabel(selectedMonth);

  const [messages, setMessages] = React.useState([]); // {role, content, ts, pendingTx?}
  const [input, setInput] = React.useState('');
  const [thinking, setThinking] = React.useState(false);
  const [error, setError] = React.useState(null);
  const listRef = React.useRef(null);

  // Welcome message once when panel opens
  React.useEffect(() => {
    if (assistantOpen && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `Olá, ${USER.name.split(' ')[0]}! Sou o assistente do Fides. Posso responder sobre suas finanças, explicar funções do app, ou dar conselhos. Você está vendo o ${lbl.long} agora — pergunte algo!`,
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
    const receitas  = monthTransactions.filter(t => t.val > 0).reduce((s,t) => s + t.val, 0);
    const despesas  = monthTransactions.filter(t => t.val < 0).reduce((s,t) => s + Math.abs(t.val), 0);
    const pendentes = monthTransactions.filter(t => t.val < 0 && t.status === 'pendente').reduce((s,t) => s + Math.abs(t.val), 0);
    const top3 = spendByCategory.slice(0, 3).map(c => `${c.label} ${fmtBRL(c.val)}`).join(', ');
    const orcStatus = budgetGroups.map(g =>
      `${g.label}: ${fmtBRL(g.spent)} de ${fmtBRL(g.limit)} (${Math.round((g.spent/g.limit||0)*100)}%)`
    ).join('; ');
    const metasInfo = METAS.map(m =>
      `${m.nome}: ${fmtBRL(m.atual)} de ${fmtBRL(m.alvo)} (${Math.round(m.atual/m.alvo*100)}%, aportando ${fmtBRL(m.contribuicao)}/mês)`
    ).join('; ');
    return [
      `Usuário: ${USER.name}, plano ${USER.plan}.`,
      `Mês em foco: ${lbl.long}.`,
      `Receitas do mês: ${fmtBRL(receitas)}. Despesas: ${fmtBRL(despesas)}. Em aberto: ${fmtBRL(pendentes)}.`,
      `Top gastos por categoria: ${top3 || 'nenhum'}.`,
      `Status do Planejamento (50·30·20): ${orcStatus}.`,
      `Metas em curso: ${metasInfo}.`,
      `Contas: ${ACCOUNTS.map(a => `${a.name} ${fmtBRL(a.balance)}`).join(', ')}.`,
      `Cartões: ${CARDS.map(c => `${c.name} usa ${fmtBRL(c.used)}/${fmtBRL(c.limit)}`).join(', ')}.`,
    ].join(' ');
  };

  const SYSTEM = `Você é o assistente do Fides Money, um app brasileiro de finanças pessoais.
Responda em português do Brasil, de forma concisa (máx. 4 parágrafos curtos), tom calmo e prático.
Use os dados financeiros do contexto pra dar respostas específicas. Cite valores em R$.
Pode falar sobre: funções do app, controle financeiro, orçamento, metas, dívidas, investimentos básicos.
Não dê garantias de retorno; sempre lembre que investimentos têm risco.
Se não souber, diga honestamente. Não invente dados.
Formato: prosa curta, sem markdown pesado. Pode usar negrito ocasional pra valores ou termos-chave.

Quando o usuário descrever uma transação (ex: "gastei X em Y", "paguei X de Y", "recebi X de Y"), retorne um JSON no seguinte formato ANTES da resposta em texto, numa linha própria:
{"acao":"lancar_transacao","dados":{"desc":"","valor":0,"tipo":"despesa","cat":"outros","pay":"debito","data":""}}
Preencha os campos com os dados interpretados da mensagem. O campo "tipo" deve ser "despesa" ou "receita". O campo "pay" deve ser "debito", "credito" ou "pix". O campo "data" deve ser no formato dd/mm/yyyy ou vazio. Se não for uma transação, retorne apenas texto normal, sem JSON.

Quando o usuário perguntar se deve comprar algo no crédito ou débito, analise o saldo disponível em conta, o limite disponível no cartão e a proximidade do vencimento da fatura. Recomende a opção mais vantajosa com justificativa objetiva, comparando os valores reais das contas e cartões do contexto.`;

  // ─── Detecta e extrai JSON de transação da resposta do modelo ─
  const parseTxJson = (text) => {
    try {
      const match = text.match(/\{"acao"\s*:\s*"lancar_transacao"[^}]*\}/);
      if (!match) return null;
      return JSON.parse(match[0]);
    } catch { return null; }
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
      const history = [...messages, userMsg].filter(m => m.role !== 'system').map(m => ({
        role: m.role, content: m.content,
      }));
      const ctx = buildContext();
      const reply = await window.claude.complete({
        messages: [
          { role: 'user', content: `[contexto] ${ctx}\n\n[instruções do sistema] ${SYSTEM}\n\nA partir daqui é a conversa.` },
          { role: 'assistant', content: 'Entendi. Vou responder com base nesses dados.' },
          ...history,
        ],
      });

      // Tenta parsear JSON de transação sugerida pelo modelo
      const txJson = parseTxJson(reply);
      // Remove a linha JSON da exibição, deixando só o texto em prosa
      const displayText = reply.replace(/\{"acao"\s*:\s*"lancar_transacao"[^}]*\}\n?/, '').trim();

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: displayText,
        ts: Date.now(),
        pendingTx: txJson?.dados ?? null,
      }]);
    } catch (err) {
      setError(err?.message || 'Não consegui falar com o Claude agora.');
    } finally {
      setThinking(false);
    }
  };

  const quickPrompts = [
    'Onde eu gastei mais este mês?',
    'Como acelero minha meta de Maceió?',
    'Que dívida quito primeiro?',
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
          <button className="fds-icon-btn" onClick={closeAssistant} title="Fechar">
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
                {m.pendingTx && (
                  <div className="cla-tx-confirm">
                    <div className="cla-tx-confirm-preview">
                      <span className="fds-mini-tag soft">
                        {m.pendingTx.tipo === 'receita' ? '+' : '−'}R$ {parseFloat(m.pendingTx.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span>{m.pendingTx.desc}</span>
                      <span className="fds-muted">{m.pendingTx.cat} · {m.pendingTx.pay}</span>
                    </div>
                    <button className="fds-btn-primary" style={{ fontSize: 12, padding: '5px 12px' }}
                            onClick={() => {
                              const d = m.pendingTx;
                              const today = new Date();
                              const dateStr = d.data || `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;
                              const parts = dateStr.split('/');
                              const mesStr = parts[2] && parts[1]
                                ? `${parts[2]}-${parts[1].padStart(2,'0')}`
                                : `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
                              addTransaction({
                                desc: d.desc || 'Transação via assistente',
                                val: d.tipo === 'receita' ? Math.abs(parseFloat(d.valor) || 0) : -Math.abs(parseFloat(d.valor) || 0),
                                cat: d.cat || 'outros',
                                acct: d.pay === 'credito' ? (CARDS[0]?.id || 'bradesco') : 'bradesco',
                                d: parts[0] && parts[1] ? `${parts[0].padStart(2,'0')}/${parts[1].padStart(2,'0')}` : `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}`,
                                mes: mesStr,
                                status: 'pago',
                              });
                              // Remove pendingTx da mensagem após confirmar
                              setMessages(prev => prev.map((msg, idx) => idx === i ? { ...msg, pendingTx: null } : msg));
                            }}>
                      <Icon.Check size={12}/> Confirmar lançamento
                    </button>
                  </div>
                )}
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
              <button key={p} className="cla-suggestion" onClick={() => send(p)}>
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
            autoFocus/>
          <button type="submit" disabled={!input.trim() || thinking}>
            {thinking ? <Icon.Clock size={14}/> : <Icon.Right size={14}/>}
          </button>
        </form>

        <div className="cla-foot">
          <span>Powered by Claude · respostas podem errar — confira valores</span>
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
    <button className="cla-fab" onClick={openAssistant} title="Conversar com o Fides (Claude)">
      <Icon.Sparkles size={20}/>
      <span className="cla-fab-pulse"/>
    </button>
  );
}

Object.assign(window, { FidesAssistant, FidesAssistantFAB });
