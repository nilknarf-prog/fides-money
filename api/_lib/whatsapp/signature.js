// api/_lib/whatsapp/signature.js — CommonJS, não roteável (mesma convenção de _lib/gemini.js e _lib/nonce.js)
// Verificação HMAC-SHA256 do header X-Hub-Signature-256 da Meta (WA-WEBHOOK-01, T-14-05).
//
// Este é o PRIMEIRO gate de todo POST recebido em api/whatsapp.js (plano 05) — a única
// prova de autenticidade de um corpo de request vindo de fora (Meta, público).
//
// Regra de ouro (Pitfall 1 do 14-RESEARCH.md): a assinatura é calculada sobre os BYTES
// EXATOS do corpo recebido. NUNCA usar req.body (getter lazy, pode normalizar/reordenar
// bytes) — só o Buffer bruto lido diretamente do stream (readRawBody abaixo).

const crypto = require('crypto');

/**
 * Lê o corpo bruto (raw bytes) de um IncomingMessage do Node, concatenando os chunks
 * recebidos via stream. Deve ser chamado ANTES de qualquer acesso a req.body no handler.
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<Buffer>}
 */
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Verifica se o header X-Hub-Signature-256 bate com o HMAC-SHA256 do corpo bruto,
 * usando comparação constant-time (mesmo padrão de api/_lib/nonce.js).
 * @param {Buffer} rawBody - corpo bruto exato recebido do stream (nunca req.body)
 * @param {string} signatureHeader - valor do header, formato 'sha256=<hex>'
 * @param {string} appSecret - App Secret da Meta (WA_APP_SECRET)
 * @returns {boolean}
 */
function verifySignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader || typeof signatureHeader !== 'string' || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const provided = signatureHeader.slice('sha256='.length);
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  const providedBuf = Buffer.from(provided, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');

  // Guard de comprimento ANTES do timingSafeEqual — buffers de tamanho diferente lançam
  // exceção nessa função; nunca comparar diretamente sem checar .length primeiro (mesma
  // regra de nonce.js).
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

module.exports = { readRawBody, verifySignature };
