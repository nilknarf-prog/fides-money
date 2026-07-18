// api/wa-link.js — Serverless Vercel (CommonJS)
// Endpoint autenticado que gera o código de posse de vínculo do WhatsApp (WA-OPTIN-01).
// Camada 2 do gating premium (AC-01): fail-closed server-side — espelha o gate de
// api/assistant.js:234-262 (fonte da verdade = profiles.plan relido por request).
// Escrita em wa_link_codes exige service_role (tabela é REVOKE de authenticated,
// supabase/wa-schema.sql:60-62) — o client service_role só nasce DEPOIS do gate
// premium passar (ordem load-bearing, mesmo princípio de api/_lib/admin/guard.js:187-232).

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// TTL do código de posse — janela curta reduz a superfície de um código vazado,
// mas dá tempo do usuário abrir o WhatsApp e enviar a mensagem pré-preenchida.
const CODE_TTL_MS = 30 * 60 * 1000;

// Alfabeto sem caracteres ambíguos (sem 0/O, 1/I/L) — código legível/ditável.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 7;

// T-14-12 (Information Disclosure): código gerado de crypto.randomBytes (não
// sequencial/previsível), nunca de Math.random.
function generateCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED', code: 405 });
    return;
  }

  try {
    // WR-03: token de sessão vem do header Authorization: Bearer (nunca do body).
    // Node normaliza chaves de header para minúsculas.
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ error: 'JWT_MISSING', code: 401 });
      return;
    }

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

    // ─── TIER (profiles.plan) — camada 2 do gating premium (AC-01) ──────────
    // Fonte da verdade é o BANCO, sempre relida por request — nunca confiar em
    // nada vindo do client/UI. Default fail-closed 'free': erro de leitura,
    // linha ausente, ou valor de plan desconhecido caem em free.
    let plan = 'free';
    try {
      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', userId)
        .single();
      if (!profileError && profileRow && typeof profileRow.plan === 'string') {
        plan = profileRow.plan;
      }
    } catch (profileFetchErr) {
      console.error('[wa-link] profile plan fetch exception', profileFetchErr);
      // fail-closed — plan permanece 'free'
    }
    // Allow-list (mesmo padrão de assistant.js:252-254): valor desconhecido/corrompido
    // cai em free, nunca em premium.
    const isPremium = plan === 'pro' || plan === 'family';

    if (!isPremium) {
      res.status(403).json({ error: 'PREMIUM_REQUIRED', code: 403 });
      return;
    }

    const waWabaNumber = process.env.WA_WABA_NUMBER;
    if (!waWabaNumber) {
      res.status(500).json({ error: 'WA_CONFIG_MISSING', code: 500 });
      return;
    }

    // ─── SERVICE_ROLE — só instanciado AQUI, pós-gate premium PASS ──────────
    // wa_link_codes é REVOKE de authenticated — a escrita exige service_role.
    // Mesmo padrão de api/_lib/admin/guard.js:222-229 (persistSession:false,
    // lido só de SUPABASE_SERVICE_ROLE_KEY, nunca hardcoded/serializado).
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      res.status(500).json({ error: 'SUPABASE_CONFIG_MISSING', code: 500 });
      return;
    }
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // T-14-13 (accept, best-effort): invalida códigos anteriores não-consumidos
    // do mesmo usuário para não acumular linhas — falha aqui é fail-open (não
    // impede gerar o novo código; a expiração natural cobre o resto).
    try {
      const { error: cleanupError } = await serviceClient
        .from('wa_link_codes')
        .delete()
        .eq('user_id', userId)
        .is('consumed_at', null);
      if (cleanupError) {
        console.error('[wa-link] cleanup old codes error (fail-open)', cleanupError);
      }
    } catch (cleanupErr) {
      console.error('[wa-link] cleanup old codes exception (fail-open)', cleanupErr);
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

    const { error: insertError } = await serviceClient
      .from('wa_link_codes')
      .insert({ code, user_id: userId, expires_at: expiresAt });
    if (insertError) {
      console.error('[wa-link] insert error', insertError);
      res.status(500).json({ error: 'INTERNAL_ERROR', code: 500 });
      return;
    }

    // Texto pré-preenchido que o webhook (plano 06) reconhece como pedido de vínculo.
    const waLink = `https://wa.me/${waWabaNumber}?text=${encodeURIComponent('Conectar Fides ' + code)}`;

    res.status(200).json({ code, wa_link: waLink, expires_at: expiresAt });

  } catch (err) {
    console.error('[wa-link] Unhandled error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', code: 500 });
  }
};
