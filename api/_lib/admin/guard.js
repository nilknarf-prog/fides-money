// api/_lib/admin/guard.js — CommonJS, NÃO-roteável (helper interno, não é uma function Vercel).
// Guard requireAdmin do painel admin (ADMIN-02).
//
// ORDEM LOAD-BEARING (não reordenar — é o item de maior risco da fase, service_role
// ignora TODA a RLS):
//   (a) extrai Bearer do header → sem token: 401 JWT_MISSING
//   (b) authClient ANON + auth.getUser(token) → token inválido: 401 JWT_INVALID
//   (c) allowlist ADMIN_USER_IDS (fail-closed: vazia/ausente = 403 p/ TODOS) →
//       não-allowlisted: auditDenied (best-effort, throttled) + 403 FORBIDDEN
//   (d) SÓ ENTÃO instancia o adminClient (service_role, persistSession:false) e
//       retorna { user, adminClient } ao roteador.
//
// service_role SÓ é lido de process.env.SUPABASE_SERVICE_ROLE_KEY, nunca hardcoded,
// nunca serializado em resposta.

const { createClient } = require('@supabase/supabase-js');

// Janela/teto do throttle anti-flood de denied_access (M1 — antecipado do 16-04
// porque qualquer JWT válido de usuário comum já pode martelar o endpoint desde
// o dia 1, mesmo sem estar na allowlist).
const DENIED_THROTTLE_WINDOW_MS = 60 * 1000;
const DENIED_THROTTLE_MAX = 5;

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

// Extrai IP do request. Best-effort — usado para chave do throttle e para o
// campo `ip` do audit trail (accountability/não-repúdio), nunca para decisão de
// auth. IMPORTANTE (anti-spoof): o cliente pode enviar x-forwarded-for/x-real-ip
// arbitrários; na Vercel a BORDA sobrescreve x-real-ip com o IP real e ANEXA o IP
// observado ao FINAL de x-forwarded-for. Por isso: (1) preferir x-real-ip
// (edge-set, não spoofável), (2) no fallback usar o ÚLTIMO elemento de XFF — o
// PRIMEIRO é o valor que o cliente original mandou (forjável).
function getClientIp(req) {
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real.trim().length > 0) {
    return real.trim();
  }
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    const parts = fwd.split(',');
    return parts[parts.length - 1].trim();
  }
  return (req.socket && req.socket.remoteAddress) || '';
}

function getUserAgent(req) {
  return req.headers['user-agent'] || '';
}

// Client service_role dedicado ao audit trail (admin_audit_log). Distinto do
// `adminClient` do passo (d): este só é usado internamente por auditDenied/logAction
// para escrever no audit_log (única tabela cujo GRANT exige service_role mesmo para
// registrar um 403) — nunca é devolvido ao roteador nem usado para RPCs de negócio.
// admin_audit_log tem RLS on + zero policies + REVOKE de anon/authenticated (16-01),
// então NENHUM outro client consegue gravar a linha 'denied_access'.
function createAuditClient() {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

// auditDenied: best-effort, fail-open (nunca lança — o 403 já foi decidido
// independente do resultado do audit). Throttle por user_id/IP negado numa janela
// curta evita que um único JWT válido infle admin_audit_log com flood de 'denied'.
async function auditDenied(user, req) {
  const client = createAuditClient();
  if (!client) {
    console.error('[admin-guard] auditDenied: SUPABASE config ausente, audit pulado (fail-open)');
    return;
  }
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);
  try {
    const windowStart = new Date(Date.now() - DENIED_THROTTLE_WINDOW_MS).toISOString();
    const safeIp = (ip || '').replace(/[,()]/g, '');
    let countQuery = client
      .from('admin_audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'denied')
      .gte('created_at', windowStart);
    countQuery = safeIp
      ? countQuery.or(`admin_id.eq.${user.id},ip.eq.${safeIp}`)
      : countQuery.eq('admin_id', user.id);

    const { count, error: countError } = await countQuery;
    if (countError) {
      console.error('[admin-guard] auditDenied throttle count error (fail-open, pulando insert)', countError);
      return;
    }
    if (typeof count === 'number' && count >= DENIED_THROTTLE_MAX) {
      return; // teto da janela atingido — não insere nova linha (anti-flood)
    }

    const { error: insertError } = await client.from('admin_audit_log').insert({
      admin_id: user.id,
      admin_email: user.email || '',
      action: 'denied_access',
      status: 'denied',
      ip: ip || null,
      user_agent: userAgent || null,
    });
    if (insertError) {
      console.error('[admin-guard] auditDenied insert error', insertError);
    }
  } catch (err) {
    console.error('[admin-guard] auditDenied exception (fail-open)', err);
  }
}

// logAction: linha LEVE de audit para leituras (whoami/list_accounts/view_audit) —
// sem before/after/reason. Usa o adminClient já autorizado do roteador (não cria
// client novo). Fail-open: erro aqui nunca derruba a resposta ao admin legítimo.
async function logAction(adminClient, { action, admin_id, admin_email, target_user, ip, user_agent, status }) {
  try {
    const { error } = await adminClient.from('admin_audit_log').insert({
      admin_id,
      admin_email: admin_email || '',
      action,
      target_user: target_user || null,
      status: status || 'ok',
      ip: ip || null,
      user_agent: user_agent || null,
    });
    if (error) {
      console.error('[admin-guard] logAction insert error', error);
    }
  } catch (err) {
    console.error('[admin-guard] logAction exception (fail-open)', err);
  }
}

async function requireAdmin(req) {
  // (a) Bearer — mesmo padrão de api/assistant.js:207-212 (WR-03).
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return { fail: { status: 401, error: 'JWT_MISSING' } };
  }

  // (b) Client ANON + getUser(token) — identidade validada pelo Auth server, nunca
  // decodificada localmente. Mesmos nomes de env de assistant.js:218-219 (M7).
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return { fail: { status: 500, error: 'SUPABASE_CONFIG_MISSING' } };
  }
  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data || !data.user) {
    return { fail: { status: 401, error: 'JWT_INVALID' } };
  }
  const user = data.user;

  // (c) Allowlist server-side, normalizada trim().toLowerCase() DOS DOIS LADOS (M9).
  // Fail-closed: ADMIN_USER_IDS ausente/vazia ⇒ allowlist=[] ⇒ isAllowed=false p/
  // QUALQUER user.id ⇒ 403 para todos, inclusive quem seria admin.
  const allowlist = (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const isAllowed = allowlist.length > 0 && allowlist.includes(String(user.id).toLowerCase());
  if (!isAllowed) {
    await auditDenied(user, req);
    return { fail: { status: 403, error: 'FORBIDDEN' } };
  }

  // (d) SÓ AQUI — pós-allowlist PASS — o adminClient (service_role) nasce.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    // Allowlist passou mas a chave de service_role não foi configurada — 500,
    // nunca degradar para "acesso liberado sem adminClient".
    return { fail: { status: 500, error: 'SUPABASE_CONFIG_MISSING' } };
  }
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  return { user, adminClient };
}

module.exports = { requireAdmin, auditDenied, logAction, getClientIp, getUserAgent };
