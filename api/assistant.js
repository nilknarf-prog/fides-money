// api/assistant.js — Serverless Vercel (CommonJS)
// Lote A2.1: function calling com tools que executam no cliente.
// Recebe POST { messages, context, jwt, toolResults? }, valida JWT,
// chama Gemini 2.5 Flash Lite com declaração de tools.
// Se Gemini pede tool, retorna { tool_calls } para o cliente executar.
// Se Gemini responde com texto, retorna { reply }.
// API key fica APENAS no servidor (env var GEMINI_API_KEY).

const { createClient } = require('@supabase/supabase-js');

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `Você é o Assistente Fides — o consultor financeiro pessoal embutido no Fides Money, um app brasileiro de finanças pessoais. Você conversa com o usuário sobre as próprias finanças dele(a), com base nos dados reais que estão sendo mostrados no app agora.

═══ COMO RESPONDER ═══
• Idioma: português do Brasil, sempre. Mesmo se a pergunta vier em outra língua, responda em PT-BR — apenas mencione que o app só conversa em português.
• Tom: parceiro experiente que entende o lado emocional do dinheiro. Direto e empático, nunca paternalista. Trate por "você", nunca "o senhor/a senhora".
• Tamanho: prosa curta. Máximo 4 parágrafos curtos. Sem listas longas, sem markdown pesado. Negrito ocasional para destacar valores (use **R$ 1.234,56**) ou ideias-chave.
• Valores: sempre em R$ no padrão brasileiro (vírgula decimal, ponto milhar).
• Datas: padrão brasileiro (dd/mm/aaaa ou "agosto de 2026").

═══ FERRAMENTAS QUE VOCÊ PODE USAR ═══
Quando o usuário pedir dados específicos (saldo atual, extrato, gastos detalhados), USE as ferramentas para buscar os números reais antes de responder. Não invente valores nem confie só no contexto inicial — o contexto é resumo, as ferramentas trazem o detalhe.

• consultar_saldo() — use quando pedirem saldo atual, situação das contas, quanto têm em cada conta/cartão, total do mês.
• consultar_extrato({periodo, conta?, cartao?}) — use para listar transações de um período (hoje, semana, mes, prev_mes) opcionalmente filtrado por conta ou cartão.

Combine ferramentas se precisar. Máximo 3 chamadas por resposta.

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

// Declaração das tools no formato Gemini function calling.
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
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !userData?.user) {
      res.status(401).json({ error: 'JWT_INVALID', code: 401 });
      return;
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      res.status(500).json({ error: 'GEMINI_KEY_MISSING', code: 500 });
      return;
    }

    const fullSystem = SYSTEM_PROMPT + (context ? `\n\n═══ CONTEXTO ATUAL DO USUÁRIO ═══\n${context}` : '');

    // Montar contents do Gemini.
    // messages = histórico do usuário (role: 'user' | 'assistant')
    // toolResults (opcional) = resultados de tools executadas pelo cliente na rodada anterior
    const contents = [];

    for (const m of messages) {
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content || '') }],
      });
    }

    // Se vieram toolResults, anexar como "function" turn
    if (Array.isArray(toolResults) && toolResults.length > 0) {
      // Primeiro o turn do model que pediu as tools (precisa estar no histórico)
      // O cliente envia isso embutido no messages array (com role 'assistant' contendo um marcador)
      // mas o Gemini exige a sequência exata: user → model(functionCall) → user(functionResponse) → model(reply)
      // Como não temos como reproduzir functionCall só pelo texto, vamos enviar um turn 'function' simulado:
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

    const geminiPayload = {
      systemInstruction: { parts: [{ text: fullSystem }] },
      contents,
      tools: TOOLS_DECLARATION,
      generationConfig: {
        temperature: 0.6,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      ],
    };

    const geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text().catch(() => '');
      console.error('[assistant] Gemini error', geminiRes.status, errBody);
      if (geminiRes.status === 429) {
        res.status(429).json({ error: 'RATE_LIMIT', code: 429 });
        return;
      }
      if (geminiRes.status === 400) {
        res.status(400).json({ error: 'GEMINI_BAD_REQUEST', code: 400 });
        return;
      }
      res.status(502).json({ error: 'GEMINI_ERROR', code: 502 });
      return;
    }

    const geminiData = await geminiRes.json();
    const candidate = geminiData?.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    // Extrair tool calls (functionCall) e texto separadamente
    const toolCalls = [];
    let textReply = '';
    for (const p of parts) {
      if (p.functionCall) {
        toolCalls.push({
          name: p.functionCall.name,
          args: p.functionCall.args || {},
        });
      } else if (p.text) {
        textReply += p.text;
      }
    }

    if (toolCalls.length > 0) {
      // O cliente vai executar e chamar de novo
      res.status(200).json({ tool_calls: toolCalls });
      return;
    }

    if (!textReply) {
      const finishReason = candidate?.finishReason;
      console.error('[assistant] No reply', finishReason, JSON.stringify(geminiData).slice(0, 500));
      res.status(502).json({ error: 'EMPTY_REPLY', code: 502, finishReason });
      return;
    }

    res.status(200).json({ reply: textReply });
  } catch (err) {
    console.error('[assistant] Unhandled error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', code: 500 });
  }
};
