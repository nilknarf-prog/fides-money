// api/whatsapp.js — Vercel Serverless Function (CommonJS)
// Webhook público do bot WhatsApp (Meta Cloud API). Espinha de segurança (14-05):
// handshake GET + verificação HMAC do raw body + dedupe por wamid + gate premium
// fail-closed (WA-GATE-01) + respostas estáticas zero-LLM (AC-03) + caps do canal
// (CU-02/TE-03). SEM parser/LLM/insert ainda — isso entra nos planos 06/07.
//
// REGRA CENTRAL (Pitfall 5 do 14-RESEARCH.md): TODO processamento roda ANTES de
// res.status(200) — nunca responder cedo e processar depois (Vercel não garante
// execução pós-resposta). O handler SEMPRE responde 200 à Meta em qualquer erro
// TRATADO de negócio (payload malformado, payload sem mensagem, wamid repetido,
// número desconhecido, cap estourado etc. — nunca deixar a Meta em retry por
// erro de negócio). As ÚNICAS exceções são a assinatura HMAC inválida (401) e o
// handshake GET com token errado (403) — falhas de autenticação do próprio
// endpoint, não "erros de negócio" pós-autenticação.

const { createClient } = require('@supabase/supabase-js');
const { readRawBody, verifySignature } = require('./_lib/whatsapp/signature');

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

// Client service_role — mesmo padrão de api/_lib/admin/guard.js:67-72 e
// api/wa-link.js:102-107 (persistSession:false, secret lido só de env, nunca
// hardcoded/serializado na resposta).
function serviceClient() {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  // ── GET: handshake de verificação do webhook (Pattern 2 do 14-RESEARCH.md) ──
  if (req.method === 'GET') {
    const mode = req.query && req.query['hub.mode'];
    const token = req.query && req.query['hub.verify_token'];
    const challenge = req.query && req.query['hub.challenge'];
    const verifyToken = process.env.WA_VERIFY_TOKEN;

    if (mode === 'subscribe' && verifyToken && token === verifyToken) {
      // TEXTO PURO — nunca res.json() (Pitfall 2 do 14-RESEARCH.md).
      res.status(200).send(challenge == null ? '' : String(challenge));
      return;
    }
    res.status(403).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  // ── POST: raw body PRIMEIRO — nunca tocar req.body antes disto (Pitfall 1) ──
  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    console.error('[whatsapp] readRawBody exception', err);
    res.status(200).end();
    return;
  }

  const signatureHeader = req.headers['x-hub-signature-256'];
  const appSecret = process.env.WA_APP_SECRET;
  if (!appSecret || !verifySignature(rawBody, signatureHeader, appSecret)) {
    res.status(401).end();
    return;
  }

  // Só a partir daqui o corpo é considerado autêntico — parse acontece DEPOIS
  // da assinatura validada, nunca antes.
  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    // Corpo malformado pós-assinatura válida não é retry-ável — 200 encerra.
    res.status(200).end();
    return;
  }

  try {
    const value = payload
      && payload.entry
      && payload.entry[0]
      && payload.entry[0].changes
      && payload.entry[0].changes[0]
      && payload.entry[0].changes[0].value;

    const messages = value && Array.isArray(value.messages) ? value.messages : null;

    if (!messages || messages.length === 0) {
      // Payload não-mensagem (status update de entrega/leitura etc.) — 200, ignora.
      res.status(200).end();
      return;
    }

    const msg = messages[0];
    const from = typeof msg.from === 'string' ? msg.from : null;
    const wamid = typeof msg.id === 'string' ? msg.id : null;
    const text = msg.text && typeof msg.text.body === 'string' ? msg.text.body : '';

    if (!from || !wamid) {
      res.status(200).end();
      return;
    }

    const supabase = serviceClient();
    if (!supabase) {
      console.error('[whatsapp] SUPABASE config ausente — 200 fail-closed sem processar');
      res.status(200).end();
      return;
    }

    // ── Dedupe por wamid (WA-WEBHOOK-01) — upsert com ignoreDuplicates: um
    // wamid repetido (retry da Meta) não gera linha nova nem processamento
    // duplicado. wamid é PRIMARY KEY em wa_messages (supabase/wa-schema.sql).
    const { data: dedupeRows, error: dedupeError } = await supabase
      .from('wa_messages')
      .upsert({ wamid, from_phone: from, body: text }, { onConflict: 'wamid', ignoreDuplicates: true })
      .select('wamid');

    if (dedupeError) {
      console.error('[whatsapp] wa_messages upsert error', dedupeError);
      res.status(200).end();
      return;
    }
    if (!dedupeRows || dedupeRows.length === 0) {
      // wamid já existia — retry da Meta, no-op idempotente.
      res.status(200).end();
      return;
    }

    // ── PONTO DE EXTENSÃO (14-05 Task 2): gate premium + respostas estáticas
    // + caps do canal, SEMPRE antes de qualquer chamada LLM (WA-GATE-01). ──

    // ── PONTO DE EXTENSÃO (planos 06/07): parser NL→JSON + confirmação D-1
    // + insert via wa_log_transaction_service. ──

    res.status(200).end();
    return;
  } catch (err) {
    console.error('[whatsapp] unhandled processing error', err);
    res.status(200).end();
    return;
  }
};
