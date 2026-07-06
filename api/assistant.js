// api/assistant.js — Serverless Vercel (CommonJS)
// Lote A2.1.3: rollback Groq → Gemini 2.5 Flash-Lite (function calling do Llama era falho em PT-BR).
// MANTÉM proteções do A2.1.1: throttle 4s no cliente, rate limit 100 msg/dia/usuário, max 2 iterações.
// Tools (consultar_saldo, consultar_extrato) continuam executando no cliente.

const { createClient } = require('@supabase/supabase-js');
const gemini = require('./_lib/gemini');

const { GEMINI_MODEL, GEMINI_ENDPOINT } = gemini;

// Cota diária por usuário (24h rolling window)
const USER_DAILY_LIMIT = 100;

const SYSTEM_PROMPT = `Voce e o assistente Fides, especialista em financas pessoais. MODO ATUAL: apenas consulta. Voce pode consultar saldos e extratos do usuario. Voce NAO pode lancar transacoes, editar, categorizar ou criar categorias neste momento. Quando o usuario pedir uma acao dessas, responda de forma simpatica que esta funcionalidade esta temporariamente em manutencao e sera reativada em breve. Nao explique motivos tecnicos. Sugerir que o usuario use o app diretamente para essas acoes por ora.

Você é o Assistente Fides — o consultor financeiro pessoal embutido no Fides Money, um app brasileiro de finanças pessoais. Você conversa com o usuário sobre as próprias finanças dele(a), com base nos dados reais que estão sendo mostrados no app agora.

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

Máximo 2 chamadas por resposta.

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

// Tools no formato Gemini function calling
const TOOLS_DECLARATION = [{
  functionDeclarations: [
    {
      name: 'consultar_saldo',
      description: 'Retorna um snapshot das finanças atuais do usuário: lista de contas com saldos, cartões com limite/usado/disponível, e totais do mês (receitas, despesas pagas, despesas pendentes). Use quando o usuário perguntar sobre saldo, situação das contas, quanto tem disponível, ou totais do mês.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    {
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
  ],
}];

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED', code: 405 });
    return;
  }

  try {
    const { messages, context, toolResults, mode } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'INVALID_MESSAGES', code: 400 });
      return;
    }

    // WR-03: token de sessão vem do header Authorization: Bearer (nunca do body).
    // Node normaliza chaves de header para minúsculas.
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ error: 'JWT_MISSING', code: 401 });
      return;
    }

    // WR-02: flag de modo validado por whitelist — só 'analysis' é reconhecido.
    const isAnalysisMode = mode === 'analysis';

    // Validar JWT via Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      res.status(500).json({ error: 'SUPABASE_CONFIG_MISSING', code: 500 });
      return;
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      res.status(401).json({ error: 'JWT_INVALID', code: 401 });
      return;
    }
    const userId = userData.user.id;

    // ─── RATE LIMIT POR USUÁRIO ──────────────────────
    const isFirstCallOfTurn = !Array.isArray(toolResults) || toolResults.length === 0;
    // AI-TELEM-01: id da linha de rate-limit desta chamada, para o UPDATE fail-open
    // de telemetria mais abaixo (tokens + latência). Fica null se o insert falhar
    // ou fora do isFirstCallOfTurn — nesse caso simplesmente não há telemetria a gravar.
    let usageRowId = null;

    if (isFirstCallOfTurn) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count, error: countError } = await supabase
        .from('assistant_usage')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', twentyFourHoursAgo);

      if (countError) {
        console.error('[assistant] usage count error', countError);
        // fail-open
      } else if ((count || 0) >= USER_DAILY_LIMIT) {
        res.status(429).json({ error: 'USER_DAILY_LIMIT', code: 429, limit: USER_DAILY_LIMIT });
        return;
      }

      const { data: insertData, error: insertError } = await supabase
        .from('assistant_usage')
        .insert({ user_id: userId })
        .select('id')
        .single();
      if (insertError) {
        console.error('[assistant] usage insert error', insertError);
        // fail-open — segue sem usageRowId, telemetria desta chamada fica sem UPDATE
      } else {
        usageRowId = insertData?.id || null;
      }
    }

    // ─── CHAMADA GEMINI ──────────────────────
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      res.status(500).json({ error: 'GEMINI_KEY_MISSING', code: 500 });
      return;
    }

    // G-1 (11-UAT): no modo análise (single-shot, sem chat) a resposta deve ser
    // autocontida — sem perguntas de follow-up nem convites a "analisar o extrato",
    // que o usuário não tem como responder nesta tela. Aponta o chat para aprofundar.
    const ANALYSIS_ADDENDUM = '\n\n═══ MODO ANÁLISE (resposta única) ═══\nEsta é uma análise pontual, NÃO um chat: o usuário NÃO pode responder aqui. Entregue uma resposta completa e autocontida com conclusões acionáveis. NÃO faça perguntas de follow-up nem convide o usuário a continuar a conversa ou a enviar dados (ex.: "podemos analisar o extrato?"). Se um aprofundamento fizer sentido, apenas oriente-o a abrir o chat "Assistente Fides" para detalhar — sem terminar com pergunta.';

    const fullSystem = SYSTEM_PROMPT
      + (isAnalysisMode ? ANALYSIS_ADDENDUM : '')
      + (context ? `\n\n═══ CONTEXTO ATUAL DO USUÁRIO ═══\n${context}` : '');

    // Montar contents do Gemini
    const contents = [];

    for (const m of messages) {
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content || '') }],
      });
    }

    // Se vieram toolResults, anexar como functionResponse
    if (Array.isArray(toolResults) && toolResults.length > 0) {
      contents.push({
        role: 'user',
        parts: toolResults.map(tr => ({
          functionResponse: {
            name: tr.name,
            response: { result: tr.result },
          },
        })),
      });
    }

    const payload = gemini.buildPayload({
      systemPrompt: fullSystem,
      contents,
      tools: isAnalysisMode ? undefined : TOOLS_DECLARATION,
      toolMode: isAnalysisMode ? 'NONE' : 'AUTO',
      generationConfig: {
        temperature: 0.6,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });

    // AI-TELEM-01: mede só a chamada Gemini (o que interessa para custo/performance do modelo).
    const t0 = Date.now();
    const geminiResult = await gemini.callGemini(payload, geminiKey);
    const latencyMs = Date.now() - t0;

    if (!geminiResult.ok) {
      if (geminiResult.errorCode === 'RATE_LIMIT') {
        res.status(429).json({ error: 'RATE_LIMIT', code: 429 });
        return;
      }
      if (geminiResult.errorCode === 'GEMINI_BAD_REQUEST') {
        res.status(400).json({ error: 'GEMINI_BAD_REQUEST', code: 400 });
        return;
      }
      res.status(502).json({ error: 'GEMINI_ERROR', code: 502 });
      return;
    }

    const { toolCalls, textReply, finishReason, usageMetadata } = gemini.parseResponse(geminiResult.data);

    // AI-TELEM-01: UPDATE fail-open da linha de rate-limit com tokens + latência.
    // NUNCA grava texto de prompt/contexto/resposta — só contagens + latência (LGPD §9).
    // Telemetria jamais pode derrubar a resposta ao usuário: qualquer erro aqui só loga e segue.
    if (usageRowId) {
      const promptTokens = usageMetadata ? (usageMetadata.promptTokenCount ?? null) : null;
      const completionTokens = usageMetadata ? (usageMetadata.candidatesTokenCount ?? null) : null;
      try {
        const { error: updateError } = await supabase
          .from('assistant_usage')
          .update({ prompt_tokens: promptTokens, completion_tokens: completionTokens, latency_ms: latencyMs })
          .eq('id', usageRowId);
        if (updateError) {
          console.error('[assistant] usage telemetry update error', updateError);
        }
      } catch (telemetryErr) {
        console.error('[assistant] usage telemetry update exception', telemetryErr);
      }
    }

    if (toolCalls.length > 0) {
      res.status(200).json({ tool_calls: toolCalls });
      return;
    }

    if (!textReply) {
      console.error('[assistant] No reply', finishReason, JSON.stringify(geminiResult.data).slice(0, 500));
      res.status(502).json({ error: 'EMPTY_REPLY', code: 502, finishReason });
      return;
    }

    res.status(200).json({ reply: textReply });

  } catch (err) {
    console.error('[assistant] Unhandled error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', code: 500 });
  }
};
