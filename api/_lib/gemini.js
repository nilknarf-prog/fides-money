// api/_lib/gemini.js — Helper Gemini compartilhado (CommonJS, NÃO roteável na Vercel)
// Prefixo `_` no diretório garante que este arquivo nunca vira Serverless Function.
// AI-SHARED-01: extrai payload/call/parse comuns entre api/assistant.js (hoje) e
// api/whatsapp.js (fase 14). Escopo mínimo — auth/rate-limit/prompt ficam no handler.
// Retry com backoff exponencial para erros transitórios (503/504/500/429) +
// AI-FALLBACK-01: contingência de modelo quando o primário esgota (pool de capacidade
// diferente no Google, então raramente sobrecarregado no mesmo instante).

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
// AI-FALLBACK-01: modelo de contingência para quando o primário esgota os retries com erro
// transitório de disponibilidade (503/504/500/429). Modelo diferente = pool de capacidade
// separado do Google, raramente sobrecarregado no mesmo instante que o flash-lite. Suporta
// function calling com o mesmo schema, então buildPayload/parseResponse não mudam.
const GEMINI_FALLBACK_MODEL = 'gemini-2.0-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MAX_RETRIES = 3;          // tentativas no modelo primário
const MAX_FALLBACK_RETRIES = 2; // tentativas no fallback (orçamento menor p/ caber no timeout da função)
const RETRY_BASE_MS = 1000;

// Erros que valem RETRY no MESMO modelo (backoff ajuda: sobrecarga/erro transitório momentâneo).
const MODEL_RETRY_STATUS = [503, 504, 500];
// Erros que disparam FALLBACK p/ o outro modelo. Inclui 429: rate-limit por-minuto NÃO melhora
// com backoff no mesmo modelo (a janela não reseta em 1-2s), mas o outro modelo tem bucket de
// cota separado — então no 429 pula o retry inútil e vai direto pro fallback.
// 400 (bad request) e 403 (auth) ficam de fora dos dois — falhariam igual em qualquer modelo.
const FALLBACK_STATUS = [503, 504, 500, 429];

function endpointFor(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

function classifyError(status) {
  if (status === 429) return 'RATE_LIMIT';
  if (status === 400) return 'GEMINI_BAD_REQUEST';
  if (status === 503) return 'GEMINI_UNAVAILABLE';
  if (status === 504) return 'GEMINI_TIMEOUT';
  if (status === 500) return 'GEMINI_SERVER_ERROR';
  return 'GEMINI_ERROR'; // inclui 403 (forçado p/ não vazar detalhe de permissão)
}

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
 * Chama um modelo específico com retry + backoff exponencial nos erros transitórios.
 * NÃO escreve em `res` — devolve resultado normalizado ao chamador.
 * @param {string} model
 * @param {object} payload
 * @param {string} apiKey
 * @param {number} maxRetries
 * @returns {Promise<{ok: boolean, status: number, errorCode: (string|null), data: (object|null)}>}
 */
async function callModel(model, payload, apiKey, maxRetries) {
  const endpoint = endpointFor(model);
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const geminiRes = await fetch(`${endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (geminiRes.ok) {
      const data = await geminiRes.json();
      return { ok: true, status: geminiRes.status, errorCode: null, data };
    }

    const errBody = await geminiRes.text().catch(() => '');
    console.error(`[gemini] ${model} error (HTTP ${geminiRes.status}) attempt ${attempt}/${maxRetries}:`, errBody);
    if (geminiRes.status === 400) {
      console.error('[gemini] Bad Request Payload:', JSON.stringify(payload, null, 2));
    }

    const errorCode = classifyError(geminiRes.status);
    const retryable = MODEL_RETRY_STATUS.includes(geminiRes.status);

    if (retryable && attempt < maxRetries) {
      const waitMs = RETRY_BASE_MS * Math.pow(2, attempt - 1) + Math.random() * 500;
      console.log(`[gemini] ${model} retrying in ${Math.round(waitMs)}ms...`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }

    return { ok: false, status: geminiRes.status, errorCode, data: null };
  }

  return { ok: false, status: 503, errorCode: 'GEMINI_UNAVAILABLE', data: null };
}

/**
 * Chama o Gemini com contingência de modelo. Tenta o primário (com retries); se esgotar
 * com erro transitório de disponibilidade (503/504/500/429), cai UMA vez para o modelo de
 * contingência (com orçamento de retries próprio). Assinatura pública preservada — é o que
 * api/assistant.js consome: `callGemini(payload, apiKey)`.
 * @param {object} payload
 * @param {string} apiKey
 * @returns {Promise<{ok: boolean, status: number, errorCode: (string|null), data: (object|null)}>}
 */
async function callGemini(payload, apiKey) {
  const primary = await callModel(GEMINI_MODEL, payload, apiKey, MAX_RETRIES);
  if (primary.ok) return primary;

  // Só vale o fallback em erro de disponibilidade/rate-limit — 400/403 falhariam igual no outro modelo.
  if (!FALLBACK_STATUS.includes(primary.status)) return primary;

  console.warn(`[gemini] ${GEMINI_MODEL} esgotado (HTTP ${primary.status}); tentando fallback ${GEMINI_FALLBACK_MODEL}`);
  // Sucesso ou não, o resultado do fallback é o mais recente — devolve ele ao handler.
  return callModel(GEMINI_FALLBACK_MODEL, payload, apiKey, MAX_FALLBACK_RETRIES);
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
        id: p.functionCall.id || undefined,
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
  GEMINI_FALLBACK_MODEL,
  GEMINI_ENDPOINT,
  buildPayload,
  callGemini,
  parseResponse,
};
