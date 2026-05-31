// api/assistant.js — Serverless Vercel (CommonJS)
// Recebe POST { messages, context, jwt }, valida JWT no Supabase,
// chama Gemini 2.5 Flash Lite e retorna { reply } ou { error, code }.
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

═══ DO QUE VOCÊ FALA ═══
• Análise dos dados financeiros do usuário (gastos, receitas, orçamento 50·30·20, metas)
• Funcionamento do Fides Money (transações, contas, cartões, faturas, transferências)
• Educação financeira prática (controle de gastos, dívidas, reserva de emergência, investimentos básicos como Tesouro Direto, CDB, poupança)
• Decisões cotidianas: "vale a pena parcelar?", "débito ou crédito?", "como acelerar uma meta?"

═══ DO QUE VOCÊ NÃO FALA ═══
• Política, religião, esportes, fofocas — recuse com gentileza e proponha um tema financeiro: "Não é minha praia — mas posso te ajudar a entender por que sua fatura está alta esse mês."
• Recomendação de ativo específico ("compre PETR4", "venda BTC"): explique que você fala de educação financeira, não de palpite de mercado.
• Inventar dados: se o contexto não tem a informação, diga honestamente. "Não tenho esse dado no painel agora" é melhor que chutar.

═══ REGRAS DE COMPORTAMENTO ═══
• Use os dados do [CONTEXTO] como verdade. Cite valores específicos quando relevante.
• Se o usuário descrever uma transação ("gastei R$50 no mercado"), por ora apenas reconheça e explique como ele(a) lança isso no app — não tente lançar automaticamente. Em breve você vai poder fazer isso direto.
• Não encha de disclaimers tipo "consulte um profissional". Diga uma vez, no fim, quando for realmente investimento de risco. Para o resto, fale direto.
• Se o orçamento estourou ou alguma meta está em risco, mencione com calma — sem drama, sem julgamento.
• Nunca exponha IDs internos, tokens, chaves de API ou estrutura técnica do app.
• Investimentos: sempre lembre que rentabilidade passada não garante futura. Uma vez por conversa basta.`;

module.exports = async (req, res) => {
  // CORS / Method check
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED', code: 405 });
    return;
  }

  try {
    // 1. Validar payload
    const { messages, context, jwt } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'INVALID_MESSAGES', code: 400 });
      return;
    }
    if (!jwt || typeof jwt !== 'string') {
      res.status(401).json({ error: 'JWT_MISSING', code: 401 });
      return;
    }

    // 2. Validar JWT via Supabase
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

    // 3. Validar GEMINI_API_KEY
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      res.status(500).json({ error: 'GEMINI_KEY_MISSING', code: 500 });
      return;
    }

    // 4. Montar payload Gemini
    // O system prompt + contexto vão em systemInstruction; histórico vem em contents.
    const fullSystem = SYSTEM_PROMPT + (context ? `\n\n═══ CONTEXTO ATUAL DO USUÁRIO ═══\n${context}` : '');

    // Gemini usa "contents" com roles "user" e "model" (não "assistant").
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    }));

    const geminiPayload = {
      systemInstruction: { parts: [{ text: fullSystem }] },
      contents,
      generationConfig: {
        temperature: 0.6,
        topP: 0.95,
        maxOutputTokens: 512,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      ],
    };

    // 5. Chamar Gemini
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
    const reply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      const finishReason = geminiData?.candidates?.[0]?.finishReason;
      console.error('[assistant] No reply', finishReason, JSON.stringify(geminiData).slice(0, 500));
      res.status(502).json({ error: 'EMPTY_REPLY', code: 502, finishReason });
      return;
    }

    res.status(200).json({ reply });
  } catch (err) {
    console.error('[assistant] Unhandled error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', code: 500 });
  }
};
