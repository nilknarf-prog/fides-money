// api/assistant.js — Serverless Vercel (CommonJS)
// Lote A2.1.1: migra Gemini → Groq + rate limit por usuário.
// - Groq API (formato OpenAI-compatível) com Llama 3.1 8B Instant
// - Rate limit: 100 mensagens/dia por usuário via Supabase assistant_usage
// - Tools (consultar_saldo, consultar_extrato) executam no cliente
// - Loop de tools limitado a 2 iterações

const { createClient } = require('@supabase/supabase-js');

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

// Cota diária por usuário (24h rolling window)
const USER_DAILY_LIMIT = 100;

const SYSTEM_PROMPT = `Você é o Assistente Fides — o consultor financeiro pessoal embutido no Fides Money, um app brasileiro de finanças pessoais. Você conversa com o usuário sobre as próprias finanças dele(a), com base nos dados reais que estão sendo mostrados no app agora.

═══ COMO RESPONDER ═══
• Idioma: português do Brasil, sempre. Mesmo se a pergunta vier em outra língua, responda em PT-BR — apenas mencione que o app só conversa em português.
• Tom: parceiro experiente que entende o lado emocional do dinheiro. Direto e empático, nunca paternalista. Trate por "você", nunca "o senhor/a senhora".
• Tamanho: prosa curta. Máximo 4 parágrafos curtos. Sem listas longas, sem markdown pesado. Negrito ocasional para destacar valores (use R$ 1.234,56) ou ideias-chave.
• Valores: sempre em R$ no padrão brasileiro (vírgula decimal, ponto milhar).
• Datas: padrão brasileiro (dd/mm/aaaa ou "agosto de 2026").

═══ FERRAMENTAS QUE VOCÊ PODE USAR ═══
Quando o usuário pedir dados específicos (saldo atual, extrato, gastos detalhados), USE as ferramentas para buscar os números reais antes de responder. Não invente valores nem confie só no contexto inicial — o contexto é resumo, as ferramentas trazem o detalhe.

• consultar_saldo() — use quando pedirem saldo atual, situação das contas, quanto têm em cada conta/cartão, total do mês.
• consultar_extrato({periodo, conta?, cartao?}) — use para listar transações de um período (hoje, semana, mes, prev_mes) opcionalmente filtrado por conta ou cartão.

Combine ferramentas se precisar. Máximo 2 chamadas por resposta.

═══ DO QUE VOCÊ FALA ═══
• Análise dos dados financeiros do usuário (gastos, receitas, orçamento 50·30·20, metas)
• Funcionamento do Fides Money (transações, contas, cartões, faturas, transferências)
• Educação financeira prática (controle de gastos, dívidas, reserva de emergência, investimentos básicos como Tesouro Direto, CDB, poupança)
• Decisões cotidianas: "vale a pena parcelar?", "débito ou crédito?", "como acelerar uma meta?"

═══ DO QUE VOCÊ NÃO FALA ═══
• Política, religião, esportes, fofocas — recuse com gentileza e proponha um tema financeiro: "Não é minha praia — mas posso te ajudar a entender por que sua fatura está alta esse mês."
• Recomendação de ativo específico ("compre PETR4", "venda BTC"): explique que você fala de educação financeira, não de palpite de mercado.
• Inventar dados: se as ferramentas não trouxerem a informação, diga honestamente.

═══ REGRAS DE COMPORTAMENTO ═══
• Use os dados do [CONTEXTO] como guia geral, e as ferramentas para detalhes.
• Se o usuário descrever uma transação ("gastei R$50 no mercado"), por ora apenas reconheça e explique como ele(a) lança isso no app — não tente lançar automaticamente. Em breve você vai poder fazer isso direto.
• Não encha de disclaimers tipo "consulte um profissional". Diga uma vez, no fim, quando for realmente investimento de risco. Para o resto, fale direto.
• Se o orçamento estourou ou alguma meta está em risco, mencione com calma — sem drama, sem julgamento.
• Nunca exponha IDs internos, tokens, chaves de API ou estrutura técnica do app.
• Investimentos: sempre lembre que rentabilidade passada não garante futura. Uma vez por conversa basta.`;

// Tools no formato OpenAI (Groq é compatível)
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'consultar_saldo',
      description: 'Retorna um snapshot das finanças atuais do usuário: lista de contas com saldos, cartões com limite/usado/disponível, e totais do mês (receitas, despesas pagas, despesas pendentes). Use quando o usuário perguntar sobre saldo, situação das contas, quanto tem disponível, ou totais do mês.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_extrato',
      description: 'Retorna lista de transações filtradas. Use para perguntas tipo "o que eu gastei essa semana", "extrato do Nubank", "minhas transações de ontem". Cada transação inclui descrição, valor, categoria, data, conta/cartão e status.',
      parameters: {
        type: 'object',
        properties: {
          periodo: {
            type: 'string',
            description: 'Período do extrato. Valores aceitos: "hoje", "semana" (últimos 7 dias), "mes" (mês selecionado no app), "prev_mes" (mês anterior).',
            enum: ['hoje', 'semana', 'mes', 'prev_mes'],
          },
          conta: {
            type: 'string',
            description: 'Filtro opcional por nome da conta (busca aproximada). Ex: "Nubank", "Bradesco".',
          },
          cartao: {
            type: 'string',
            description: 'Filtro opcional por nome do cartão (busca aproximada). Ex: "Nubank", "Inter".',
          },
          limite: {
            type: 'integer',
            description: 'Máximo de transações a retornar. Padrão 20.',
          },
        },
        required: ['periodo'],
      },
    },
  },
];

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED', code: 405 });
    return;
  }

  try {
    const { messages, context, jwt, toolResults } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'INVALID_MESSAGES', code: 400 });
      return;
    }
    if (!jwt || typeof jwt !== 'string') {
      res.status(401).json({ error: 'JWT_MISSING', code: 401 });
      return;
    }

    // Validar JWT via Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      res.status(500).json({ error: 'SUPABASE_CONFIG_MISSING', code: 500 });
      return;
    }
    // Cliente Supabase com o JWT do usuário (respeita RLS)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !userData?.user) {
      res.status(401).json({ error: 'JWT_INVALID', code: 401 });
      return;
    }
    const userId = userData.user.id;

    // ─── RATE LIMIT POR USUÁRIO ──────────────────────
    // Só conta na PRIMEIRA chamada do turno (toolResults vazio).
    // Chamadas subsequentes (com toolResults) são continuação do mesmo turno.
    const isFirstCallOfTurn = !Array.isArray(toolResults) || toolResults.length === 0;

    if (isFirstCallOfTurn) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count, error: countError } = await supabase
        .from('assistant_usage')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', twentyFourHoursAgo);

      if (countError) {
        console.error('[assistant] usage count error', countError);
        // Em caso de erro de contagem, continuar (fail-open para não bloquear o usuário)
      } else if ((count || 0) >= USER_DAILY_LIMIT) {
        res.status(429).json({ error: 'USER_DAILY_LIMIT', code: 429, limit: USER_DAILY_LIMIT });
        return;
      }

      // Registrar uso
      const { error: insertError } = await supabase
        .from('assistant_usage')
        .insert({ user_id: userId });
      if (insertError) {
        console.error('[assistant] usage insert error', insertError);
        // Continuar mesmo com erro de insert (não bloquear o usuário)
      }
    }

    // ─── CHAMADA GROQ ──────────────────────
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      res.status(500).json({ error: 'GROQ_KEY_MISSING', code: 500 });
      return;
    }

    const fullSystem = SYSTEM_PROMPT + (context ? `\n\n═══ CONTEXTO ATUAL DO USUÁRIO ═══\n${context}` : '');

    // Montar messages no formato OpenAI/Groq
    // - System message primeiro
    // - Histórico do usuário (role: user/assistant)
    // - Se houver toolResults: precisamos enviar a mensagem do assistant com tool_calls e os tool responses
    const groqMessages = [
      { role: 'system', content: fullSystem },
    ];

    for (const m of messages) {
      groqMessages.push({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || ''),
      });
    }

    // Se vieram toolResults, anexar como sequência: assistant com tool_calls + tool responses
    if (Array.isArray(toolResults) && toolResults.length > 0) {
      // O cliente passa toolResults com {name, args, result, callId}
      const toolCalls = toolResults.map(tr => ({
        id: tr.callId || `call_${tr.name}_${Date.now()}`,
        type: 'function',
        function: {
          name: tr.name,
          arguments: JSON.stringify(tr.args || {}),
        },
      }));

      groqMessages.push({
        role: 'assistant',
        content: null,
        tool_calls: toolCalls,
      });

      for (const tr of toolResults) {
        groqMessages.push({
          role: 'tool',
          tool_call_id: tr.callId || `call_${tr.name}_${Date.now()}`,
          content: JSON.stringify(tr.result),
        });
      }
    }

    const groqPayload = {
      model: GROQ_MODEL,
      messages: groqMessages,
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: 0.6,
      top_p: 0.95,
      max_tokens: 1024,
    };

    const groqRes = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`,
      },
      body: JSON.stringify(groqPayload),
    });

    if (!groqRes.ok) {
      const errBody = await groqRes.text().catch(() => '');
      console.error('[assistant] Groq error', groqRes.status, errBody);
      if (groqRes.status === 429) {
        res.status(429).json({ error: 'RATE_LIMIT', code: 429 });
        return;
      }
      if (groqRes.status === 400) {
        res.status(400).json({ error: 'GROQ_BAD_REQUEST', code: 400 });
        return;
      }
      if (groqRes.status === 401) {
        res.status(500).json({ error: 'GROQ_KEY_INVALID', code: 500 });
        return;
      }
      res.status(502).json({ error: 'GROQ_ERROR', code: 502 });
      return;
    }

    const groqData = await groqRes.json();
    const choice = groqData?.choices?.[0];
    const message = choice?.message;

    if (!message) {
      console.error('[assistant] No message in response', JSON.stringify(groqData).slice(0, 500));
      res.status(502).json({ error: 'EMPTY_REPLY', code: 502 });
      return;
    }

    // Tool calls?
    const rawToolCalls = message.tool_calls;
    if (Array.isArray(rawToolCalls) && rawToolCalls.length > 0) {
      const toolCalls = rawToolCalls.map(tc => {
        let parsedArgs = {};
        try {
          parsedArgs = JSON.parse(tc.function?.arguments || '{}');
        } catch (e) {
          console.error('[assistant] failed to parse tool args', tc.function?.arguments);
        }
        return {
          name: tc.function?.name,
          args: parsedArgs,
          callId: tc.id,
        };
      });
      res.status(200).json({ tool_calls: toolCalls });
      return;
    }

    // Resposta de texto
    const textReply = message.content;
    if (!textReply) {
      const finishReason = choice?.finish_reason;
      console.error('[assistant] No text reply', finishReason);
      res.status(502).json({ error: 'EMPTY_REPLY', code: 502, finishReason });
      return;
    }

    res.status(200).json({ reply: textReply });

  } catch (err) {
    console.error('[assistant] Unhandled error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', code: 500 });
  }
};
