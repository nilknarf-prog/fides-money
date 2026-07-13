// api/_lib/gemini.js — Helper Gemini compartilhado (CommonJS, NÃO roteável na Vercel)
// Prefixo `_` no diretório garante que este arquivo nunca vira Serverless Function.
// AI-SHARED-01: extrai payload/call/parse comuns entre api/assistant.js (hoje) e
// api/whatsapp.js (fase 14). Escopo mínimo — auth/rate-limit/prompt ficam no handler.

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Monta o payload de generateContent do Gemini.
 * @param {object} params
 * @param {string} params.systemPrompt
 * @param {Array}  params.contents
 * @param {Array}  [params.tools] - functionDeclarations (omitido quando toolMode === 'NONE')
 * @param {'AUTO'|'NONE'} [params.toolMode] - 'NONE' proíbe function calling (ponto de extensão WR-02)
 * @param {object} params.generationConfig
 * @returns {object} payload pronto para enviar ao endpoint generateContent
 */
function buildPayload({ systemPrompt, contents, tools, toolMode, generationConfig }) {
  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig,
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  if (toolMode === 'NONE') {
    // Proíbe function calling — o modelo sempre retorna texto (WR-02: caminho single-shot).
    payload.toolConfig = { functionCallingConfig: { mode: 'NONE' } };
  } else if (tools) {
    // toolMode ausente ou 'AUTO' — comportamento atual do chat preservado.
    payload.tools = tools;
  }

  return payload;
}

/**
 * Chama o endpoint generateContent do Gemini e normaliza o resultado.
 * NÃO escreve em `res` — o handler HTTP decide o status/response ao cliente.
 * @param {object} payload
 * @param {string} apiKey
 * @returns {Promise<{ok: boolean, status: number, errorCode: (string|null), data: (object|null)}>}
 */
async function callGemini(payload, apiKey) {
  const geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!geminiRes.ok) {
    const errBody = await geminiRes.text().catch(() => '');
    console.error('[gemini] Gemini error', geminiRes.status, errBody);

    let errorCode = 'GEMINI_ERROR';
    if (geminiRes.status === 429) errorCode = 'RATE_LIMIT';
    else if (geminiRes.status === 400) errorCode = 'GEMINI_BAD_REQUEST';
    else if (geminiRes.status === 503) errorCode = 'GEMINI_UNAVAILABLE';
    else if (geminiRes.status === 504) errorCode = 'GEMINI_TIMEOUT';
    else if (geminiRes.status === 500) errorCode = 'GEMINI_SERVER_ERROR';

    return { ok: false, status: geminiRes.status, errorCode, data: null };
  }

  const data = await geminiRes.json();
  return { ok: true, status: geminiRes.status, errorCode: null, data };
}

/**
 * Extrai toolCalls/textReply/finishReason/usageMetadata da resposta do Gemini.
 * @param {object} geminiData
 * @returns {{toolCalls: Array, textReply: string, finishReason: (string|undefined), usageMetadata: (object|null)}}
 */
function parseResponse(geminiData) {
  const candidate = geminiData && geminiData.candidates ? geminiData.candidates[0] : undefined;
  const parts = (candidate && candidate.content && candidate.content.parts) || [];

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

  const finishReason = candidate ? candidate.finishReason : undefined;
  const usageMetadata = (geminiData && geminiData.usageMetadata) || null;

  return { toolCalls, textReply, finishReason, usageMetadata };
}

module.exports = {
  GEMINI_MODEL,
  GEMINI_ENDPOINT,
  buildPayload,
  callGemini,
  parseResponse,
};
