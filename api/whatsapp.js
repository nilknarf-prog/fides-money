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
const { sendTextMessage } = require('./_lib/whatsapp/graph-api');

// CU-02 (Claude's Discretion, teto ≤ ~R$15/mês/usuário — 14-CONTEXT.md): caps do
// canal WhatsApp para usuário PREMIUM vinculado, separados do chat in-app
// (assistant_usage) — contam sobre wa_usage (tabela irmã, 14-01). Cálculo do
// teto: cobrança pós-01/10/2026 ≈ R$0,04/msg ENVIADA (inbound grátis); pior caso
// ~1,9 msgs enviadas por mensagem inbound processada (confirmação + ack) ⇒
// 200 inbound/mês × 1,9 × R$0,04 ≈ R$15,20/mês. Cap diário mantém a mesma
// proporção (30/dia × ~30 dias ≈ 900, folga sobre o teto mensal de 200).
const WA_DAILY_LIMIT = 30;
const WA_MONTHLY_LIMIT = 200;

// AC-03: cap de mensagens estáticas por número NÃO vinculado/free, janela 24h
// rolling — zero LLM em todo esse caminho, custo desprezível mesmo sob abuso.
const UNLINKED_DAILY_CAP = 3;

// T-14-16 (Information Disclosure): MESMA mensagem para número desconhecido E
// número vinculado-porém-free — nunca revela se existe conta atrás do número.
const STATIC_UPGRADE_MSG = 'Esse número ainda não está liberado para o bot do Fides Money 🔒 O bot é um benefício do plano Premium. Assine ou vincule seu número pelo app: https://fides-money.vercel.app';

const STATIC_LIMIT_MSG = 'Você atingiu o limite de mensagens do bot por hoje. Pode continuar lançando e consultando direto pelo app: https://fides-money.vercel.app';

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

    // ── GATE PREMIUM (WA-GATE-01) — resolve phone → profiles.plan, SEMPRE
    // relido do banco, fail-closed. Roda ANTES de qualquer chamada LLM (planos
    // 06/07) — nenhum dado do payload da Meta decide o tier (espelha o gate de
    // api/assistant.js:234-262). ──
    let userId = null;
    let plan = 'free';
    try {
      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('id, plan')
        .eq('phone', from)
        .single();
      if (!profileError && profileRow) {
        userId = profileRow.id;
        if (typeof profileRow.plan === 'string') plan = profileRow.plan;
      }
    } catch (profileFetchErr) {
      console.error('[whatsapp] profile lookup exception', profileFetchErr);
      // fail-closed — userId permanece null, plan permanece 'free'
    }
    // Allow-list (mesmo padrão de assistant.js:252-254): número não-vinculado
    // (userId null) OU plan desconhecido/corrompido caem em "não premium".
    const isPremium = !!userId && (plan === 'pro' || plan === 'family');

    if (!isPremium) {
      // Número não-vinculado E vinculado-porém-free recebem a MESMA resposta
      // estática de upgrade (AC-03) — zero LLM em todo este caminho, nenhuma
      // chamada a callGemini/parser existe neste branch.
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: unlinkedCount, error: unlinkedCountError } = await supabase
        .from('wa_messages')
        .select('wamid', { count: 'exact', head: true })
        .eq('from_phone', from)
        .gte('created_at', twentyFourHoursAgo);

      if (unlinkedCountError) {
        console.error('[whatsapp] unlinked cap count error (fail-open, envia mesmo assim)', unlinkedCountError);
      }
      // Fail-open na leitura (erro nunca bloqueia o envio); fail-closed no teto
      // (mensagem já inserida em wa_messages na Task 1 conta para o próprio cap).
      const withinCap = !!unlinkedCountError || (unlinkedCount || 0) <= UNLINKED_DAILY_CAP;

      if (withinCap) {
        const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
        const accessToken = process.env.WA_ACCESS_TOKEN;
        if (phoneNumberId && accessToken) {
          await sendTextMessage(phoneNumberId, from, STATIC_UPGRADE_MSG, accessToken);
        } else {
          console.error('[whatsapp] WA_PHONE_NUMBER_ID/WA_ACCESS_TOKEN ausente — resposta estática não enviada');
        }
      }
      // Acima do cap: nem envia resposta, só 200 (custo zero adicional).
      res.status(200).end();
      return;
    }

    // ── CAPS DO CANAL (CU-02/TE-03) — premium vinculado, ANTES de qualquer
    // LLM (planos 06/07). Fail-open na leitura do count (erro nunca bloqueia),
    // fail-closed no teto (estouro sempre bloqueia e responde estática de
    // limite, zero LLM). Conta sobre wa_usage, separado de assistant_usage
    // (Pitfall 4 do 14-RESEARCH.md). ──
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: dailyCount, error: dailyCountError } = await supabase
      .from('wa_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', dayAgo);

    if (dailyCountError) {
      console.error('[whatsapp] wa_usage daily count error (fail-open)', dailyCountError);
    } else if ((dailyCount || 0) >= WA_DAILY_LIMIT) {
      const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
      const accessToken = process.env.WA_ACCESS_TOKEN;
      if (phoneNumberId && accessToken) {
        await sendTextMessage(phoneNumberId, from, STATIC_LIMIT_MSG, accessToken);
      }
      res.status(200).end();
      return;
    }

    const now = new Date();
    const startOfMonthUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { count: monthlyCount, error: monthlyCountError } = await supabase
      .from('wa_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfMonthUTC);

    if (monthlyCountError) {
      console.error('[whatsapp] wa_usage monthly count error (fail-open)', monthlyCountError);
    } else if ((monthlyCount || 0) >= WA_MONTHLY_LIMIT) {
      const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
      const accessToken = process.env.WA_ACCESS_TOKEN;
      if (phoneNumberId && accessToken) {
        await sendTextMessage(phoneNumberId, from, STATIC_LIMIT_MSG, accessToken);
      }
      res.status(200).end();
      return;
    }

    // Cap PASS: registra a mensagem premium PROCESSADA (a contagem que
    // alimenta os caps acima). Telemetria de tokens/latência é preenchida
    // depois (planos 06/07, quando houver chamada Gemini real).
    const { error: usageInsertError } = await supabase
      .from('wa_usage')
      .insert({ user_id: userId });
    if (usageInsertError) {
      console.error('[whatsapp] wa_usage insert error (fail-open, segue sem telemetria)', usageInsertError);
    }

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
