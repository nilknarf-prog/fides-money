// api/assistant.js — Serverless Vercel (CommonJS)
// Assistente Fides: Gemini 2.5 Flash-Lite com function calling.
// Tools READ (consultar_saldo/extrato) + WRITE (lancar/recategorizar/editar/criar_categoria).
// WRITE reativado na Phase 12 (gate B8); tools executam no cliente com confirmação obrigatória.
// Rate limit 100 msg/dia/usuário + nonce anti-replay (D-06).

const { createClient } = require('@supabase/supabase-js');
const gemini = require('./_lib/gemini');
const nonce = require('./_lib/nonce');

const { GEMINI_MODEL, GEMINI_ENDPOINT } = gemini;
const NONCE_SECRET = process.env.ASSISTANT_NONCE_SECRET;

// Cota diária por usuário (24h rolling window)
const USER_DAILY_LIMIT = 100;

const SYSTEM_PROMPT = `Você é o Assistente Fides — o consultor financeiro pessoal embutido no Fides Money, um app brasileiro de finanças pessoais. Você conversa com o usuário sobre as próprias finanças dele(a), com base nos dados reais que estão sendo mostrados no app agora.

═══ COMO RESPONDER ═══
• Idioma: português do Brasil, sempre. Mesmo se a pergunta vier em outra língua, responda em PT-BR — apenas mencione que o app só conversa em português.
• Tom: parceiro experiente que entende o lado emocional do dinheiro. Direto e empático, nunca paternalista. Trate por "você", nunca "o senhor/a senhora".
• Tamanho: prosa curta. Máximo 4 parágrafos curtos. Sem listas longas, sem markdown pesado. Negrito ocasional para destacar valores (use R$ 1.234,56) ou ideias-chave.
• Valores: sempre em R$ no padrão brasileiro (vírgula decimal, ponto milhar).
• Datas: padrão brasileiro (dd/mm/aaaa ou "agosto de 2026").

═══ FERRAMENTAS DE LEITURA (READ) ═══
Quando o usuário pedir dados específicos (saldo atual, extrato, gastos detalhados), USE as ferramentas para buscar os números reais antes de responder. Não invente valores nem confie só no contexto inicial — o contexto é resumo, as ferramentas trazem o detalhe.

• consultar_saldo() — saldo atual, situação das contas, quanto têm em cada conta/cartão, total do mês.
• consultar_extrato({periodo, conta?, cartao?}) — listar transações de um período filtrado por conta ou cartão.

═══ FERRAMENTAS DE ESCRITA (WRITE) ═══
Você pode lançar transações, recategorizar, editar e criar categorias para o usuário. Toda ação de escrita é PROPOSTA ao usuário num card de confirmação visual — ele vê os dados e decide confirmar ou cancelar. Você nunca executa direto.

• lancar_transacao({descricao, valor, categoria, data, conta_ou_cartao}) — lançar despesa ou receita. O valor deve ser NEGATIVO para despesa e POSITIVO para receita. Se a categoria informada não existir na lista, chame esta ferramenta normalmente — o sistema vai propor criar a categoria e lançar numa confirmação só. NÃO chame criar_categoria separadamente para isso.
• recategorizar_transacao({transacao_id, nova_categoria}) — mudar a categoria de uma transação existente.
• editar_transacao({transacao_id, patch: {valor?, descricao?, data?, status?}}) — editar campos de uma transação. Você NÃO pode trocar a conta/cartão da transação por aqui.
• criar_categoria({nome, emoji?}) — criar uma nova categoria custom (sem transação). Também é proposta ao usuário para confirmação.

Máximo 2 chamadas por resposta.

═══ REGRA DE HONESTIDADE (WRITE) ═══
• NUNCA invente valor, conta, cartão ou categoria. Se o usuário não especificou, PERGUNTE antes de chamar a ferramenta.
• Se um nome de conta/cartão/categoria não bater com nenhum da lista do contexto, NÃO tente adivinhar — deixe o sistema retornar o erro e pergunte ao usuário qual quis dizer.
• Para lançamentos, se a categoria não existir, chame lancar_transacao normalmente com o nome da categoria — o sistema vai propor criar+lançar. NÃO chame criar_categoria antes.
• O assistente NÃO precisa perguntar qual o grupo da categoria (Essencial, Estilo, Renda). O próprio card de confirmação exibirá uma opção para o usuário escolher o grupo antes de confirmar. Apenas envie a ferramenta.
• Se tiver dúvida sobre qualquer campo (valor, data, destino), peça confirmação em vez de assumir.
• Ao lançar transação, sempre que o usuário qualificar o TIPO do destino, envie também tipo_destino: se disser "cartão"/"cartão de crédito"/"crédito"/"fatura", envie tipo_destino: "cartao"; se disser "conta"/"conta corrente"/"débito"/"dinheiro"/"pix", envie tipo_destino: "conta". Se existir uma conta E um cartão com o mesmo nome e o usuário não qualificar o tipo, NÃO escolha por conta própria — omita tipo_destino e deixe o sistema pedir a desambiguação.

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
        type: 'OBJECT',
        properties: {},
      },
    },
    {
      name: 'consultar_extrato',
      description: 'Retorna lista de transações filtradas. Use para perguntas tipo "o que eu gastei essa semana", "extrato do Nubank", "minhas transações de ontem". Cada transação inclui descrição, valor, categoria, data, conta/cartão e status.',
      parameters: {
        type: 'OBJECT',
        properties: {
          periodo: {
            type: 'STRING',
            description: 'Período do extrato. Valores aceitos: "hoje", "semana" (últimos 7 dias), "mes" (mês selecionado no app), "prev_mes" (mês anterior).',
            enum: ['hoje', 'semana', 'mes', 'prev_mes'],
          },
          conta: {
            type: 'STRING',
            description: 'Filtro opcional por nome da conta (busca aproximada). Ex: "Nubank", "Bradesco".',
          },
          cartao: {
            type: 'STRING',
            description: 'Filtro opcional por nome do cartão (busca aproximada). Ex: "Nubank", "Inter".',
          },
          limite: {
            type: 'INTEGER',
            description: 'Máximo de transações a retornar. Padrão 20.',
          },
        },
        required: ['periodo'],
      },
    },
    // ── WRITE tools (Phase 12 — B8 gate open) ──
    {
      name: 'lancar_transacao',
      description: 'Lança uma transação (despesa ou receita) para o usuário. Valor NEGATIVO = despesa, POSITIVO = receita. A ação é PROPOSTA num card de confirmação visual — o usuário confirma ou cancela. Se a categoria informada não existir, o sistema vai propor criar a categoria e lançar numa confirmação só — NÃO chame criar_categoria separadamente.',
      parameters: {
        type: 'OBJECT',
        properties: {
          descricao: { type: 'STRING', description: 'Descrição curta da transação. Ex: "Mercado Extra", "Salário junho".' },
          valor: { type: 'NUMBER', description: 'Valor em R$. NEGATIVO para despesa (-50.00), POSITIVO para receita (3000.00).' },
          categoria: { type: 'STRING', description: 'Chave ou nome da categoria. Ex: "mercado", "salario", "transporte". Se não existir, o sistema propõe criar.' },
          data: { type: 'STRING', description: 'Data no formato YYYY-MM-DD. Se não informada, usa hoje.' },
          conta_ou_cartao: { type: 'STRING', description: 'Nome da conta ou cartão de destino. Ex: "Nubank", "Bradesco", "Inter". Obrigatório. Quando o usuário disser o TIPO ("cartão de crédito X", "conta X"), envie também tipo_destino — isso é essencial se existir uma conta e um cartão com o mesmo nome.' },
          tipo_destino: { type: 'STRING', description: 'Tipo do destino, quando o usuário deixar claro. Use "cartao" se ele mencionar cartão/crédito/fatura. Use "conta" se ele mencionar conta/conta corrente/débito/dinheiro/pix. Omita se o usuário não qualificar o tipo — o sistema desambigua.', enum: ['conta', 'cartao'] },
        },
        required: ['descricao', 'valor', 'categoria', 'conta_ou_cartao'],
      },
    },
    {
      name: 'recategorizar_transacao',
      description: 'Muda a categoria de uma transação existente. A ação é PROPOSTA ao usuário para confirmação.',
      parameters: {
        type: 'OBJECT',
        properties: {
          transacao_id: { type: 'STRING', description: 'ID da transação a recategorizar (do extrato).' },
          nova_categoria: { type: 'STRING', description: 'Chave ou nome da nova categoria.' },
        },
        required: ['transacao_id', 'nova_categoria'],
      },
    },
    {
      name: 'editar_transacao',
      description: 'Edita campos de uma transação existente (valor, descrição, data, status). NÃO permite trocar conta/cartão. A ação é PROPOSTA ao usuário para confirmação.',
      parameters: {
        type: 'OBJECT',
        properties: {
          transacao_id: { type: 'STRING', description: 'ID da transação a editar (do extrato).' },
          patch: {
            type: 'OBJECT',
            description: 'Campos a alterar. Envie apenas os que mudam.',
            properties: {
              valor: { type: 'NUMBER', description: 'Novo valor (mantém o sinal original da transação).' },
              descricao: { type: 'STRING', description: 'Nova descrição.' },
              data: { type: 'STRING', description: 'Nova data (YYYY-MM-DD).' },
              status: { type: 'STRING', description: 'Novo status.', enum: ['pago', 'pendente'] },
            },
          },
        },
        required: ['transacao_id', 'patch'],
      },
    },
    {
      name: 'criar_categoria',
      description: 'Cria uma nova categoria customizada. A ação é PROPOSTA ao usuário num card de confirmação — ele confirma ou cancela. Para lançar uma transação com categoria nova, use lancar_transacao (o sistema propõe criar+lançar junto).',
      parameters: {
        type: 'OBJECT',
        properties: {
          nome: { type: 'STRING', description: 'Nome da categoria a criar. Ex: "Pet", "Saúde Mental".' },
          emoji: { type: 'STRING', description: 'Emoji para a categoria. Opcional, padrão 🏷️.' },
        },
        required: ['nome'],
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
    const { messages, context, toolResults, lastToolCalls, mode, nonce: clientNonce } = req.body || {};
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
    // D-06: nonce anti-replay — toolResults forjado sem nonce válido conta na cota.
    // Fail-safe: nonce ausente/inválido/expirado NUNCA bloqueia (só faz contar cota).
    const hasToolResults = Array.isArray(toolResults) && toolResults.length > 0;
    const nonceValid = hasToolResults && clientNonce && NONCE_SECRET
      ? nonce.verify(clientNonce, userId, NONCE_SECRET)
      : false;
    const isFirstCallOfTurn = !hasToolResults || !nonceValid;
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

    // Se vieram toolResults, anexar como functionResponse precedido pelos functionCalls
    if (Array.isArray(toolResults) && toolResults.length > 0) {
      if (Array.isArray(lastToolCalls) && lastToolCalls.length > 0) {
        contents.push({
          role: 'model',
          parts: lastToolCalls.map(tc => {
            const fc = { name: tc.name, args: tc.args || {} };
            if (tc.id) fc.id = tc.id;
            return { functionCall: fc };
          }),
        });
      }
      contents.push({
        role: 'user',
        parts: toolResults.map(tr => {
          const fr = { name: tr.name, response: { result: tr.result } };
          if (tr.id) fr.id = tr.id;
          return { functionResponse: fr };
        }),
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
      if (geminiResult.errorCode === 'GEMINI_UNAVAILABLE') {
        res.status(503).json({ error: 'GEMINI_UNAVAILABLE', code: 503 });
        return;
      }
      if (geminiResult.errorCode === 'GEMINI_TIMEOUT') {
        res.status(504).json({ error: 'GEMINI_TIMEOUT', code: 504 });
        return;
      }
      if (geminiResult.errorCode === 'GEMINI_SERVER_ERROR') {
        res.status(500).json({ error: 'GEMINI_SERVER_ERROR', code: 500 });
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
      const nextNonce = NONCE_SECRET ? nonce.sign(userId, NONCE_SECRET) : null;
      res.status(200).json({ tool_calls: toolCalls, nonce: nextNonce });
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
