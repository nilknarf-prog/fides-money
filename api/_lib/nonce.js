// api/_lib/nonce.js — CommonJS, não roteável (mesma convenção de _lib/gemini.js)
// Anti-replay nonce para o gate de rate-limit do assistente (D-06).
// HMAC-SHA256 stateless, sem tabela — validação é assinatura + expiry puros.

const crypto = require('crypto');

const NONCE_TTL_MS = 120 * 1000; // 120s (SD-2 — cobre confirmação humana do card WRITE)

function sign(uid, secret) {
  const payload = JSON.stringify({ uid, iat: Date.now(), exp: Date.now() + NONCE_TTL_MS });
  const payloadB64 = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

function verify(token, uid, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return false;
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;
  let claims;
  try { claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()); } catch { return false; }
  if (claims.uid !== uid) return false;
  if (!claims.exp || Date.now() > claims.exp) return false;
  return true;
}

module.exports = { sign, verify };
