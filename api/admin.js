// api/admin.js — Vercel Serverless Function (CommonJS)
// Roteador ÚNICO do painel admin/backoffice (ADMIN-02). NENHUM outro arquivo em
// api/ deve expor superfície admin — guard e roteador são únicos por design.
//
// requireAdmin roda SEMPRE antes de qualquer dispatch (nenhuma action é
// alcançável sem PASS). Toda resposta é Cache-Control: no-store — nunca
// cacheável, nunca segredo (service_role jamais chega ao corpo da resposta).
//
// Actions: GET whoami | GET accounts | GET audit | POST set_plan.

const { requireAdmin, logAction, checkGeneralRateLimit, getClientIp, getUserAgent } = require('./_lib/admin/guard');
const { listAccounts } = require('./_lib/admin/accounts');
const { setPlan } = require('./_lib/admin/set-plan');
const { listAudit } = require('./_lib/admin/audit-list');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  // Guard SEMPRE primeiro — nenhum dispatch acontece sem PASS.
  const g = await requireAdmin(req);
  if (g.fail) {
    res.status(g.fail.status).json({ error: g.fail.error });
    return;
  }
  const { user, adminClient } = g;

  // Rate-limit GERAL da superfície admin (ADMIN-04, T-16-15) — DEPOIS do guard
  // já ter liberado o acesso (nunca antes da allowlist), vale para TODAS as
  // actions autenticadas abaixo. Complementa (não substitui) o throttle de
  // denied_access já aplicado dentro do próprio guard.
  const rateLimit = await checkGeneralRateLimit(adminClient, user, req);
  if (rateLimit.limited) {
    res.status(429).json({ error: 'RATE_LIMITED' });
    return;
  }

  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);
  const action = (req.query && req.query.action) || (req.body && req.body.action) || null;

  // Grava UMA linha de audit para o request corrente. Fail-open (logAction nunca
  // lança). É o que faz o rate-limit geral — que conta linhas de admin_audit_log na
  // janela — enxergar TODA requisição pós-guard, SUCESSO E FALHA. Sem isso, um
  // request que não grava linha (ex.: set_plan com input inválido, 405, action
  // desconhecida) nunca conta e o teto de 30/60s (T-16-15) fica trivialmente
  // burlável. Em erro, target_user vai SEMPRE null: o valor pode ser um uuid
  // inválido, e um INSERT que falha no cast da coluna uuid não gravaria linha —
  // reabrindo o bypass. Só o caminho de sucesso do set_plan não usa este helper
  // (a RPC 16-01 já grava a linha before/after/reason na mesma transação, que
  // também conta para o rate-limit).
  const audit = (fields) =>
    logAction(adminClient, {
      admin_id: user.id,
      admin_email: user.email,
      ip,
      user_agent: userAgent,
      ...fields,
    });

  try {
    switch (action) {
      case 'whoami': {
        if (req.method !== 'GET') {
          await audit({ action: 'whoami', status: 'error' });
          res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
          return;
        }
        await audit({ action: 'whoami' });
        res.status(200).json({ id: user.id, email: user.email });
        return;
      }

      case 'accounts': {
        if (req.method !== 'GET') {
          await audit({ action: 'list_accounts', status: 'error' });
          res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
          return;
        }
        const q = req.query || {};
        const result = await listAccounts(adminClient, {
          search: q.search,
          plan: q.plan,
          limit: q.limit ? parseInt(q.limit, 10) : undefined,
          offset: q.offset ? parseInt(q.offset, 10) : undefined,
        });
        if (result.error) {
          console.error('[admin] accounts rpc error', result.error);
          await audit({ action: 'list_accounts', status: 'error' });
          res.status(500).json({ error: 'ACCOUNTS_QUERY_FAILED' });
          return;
        }
        await audit({ action: 'list_accounts' });
        res.status(200).json(result.data);
        return;
      }

      case 'audit': {
        if (req.method !== 'GET') {
          await audit({ action: 'view_audit', status: 'error' });
          res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
          return;
        }
        const q = req.query || {};
        const result = await listAudit(adminClient, { limit: q.limit, offset: q.offset });
        if (result.error) {
          console.error('[admin] audit query error', result.error);
          await audit({ action: 'view_audit', status: 'error' });
          res.status(500).json({ error: 'AUDIT_QUERY_FAILED' });
          return;
        }
        await audit({ action: 'view_audit' });
        res.status(200).json(result.data);
        return;
      }

      case 'set_plan': {
        if (req.method !== 'POST') {
          await audit({ action: 'set_plan', status: 'error' });
          res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
          return;
        }
        const body = req.body || {};
        const result = await setPlan(adminClient, {
          adminId: user.id,
          adminEmail: user.email,
          targetUser: body.target_user,
          newPlan: body.new_plan,
          reason: body.reason,
        });
        if (result.validationError) {
          // target_user pode ser inválido → null (não arriscar cast uuid no INSERT).
          await audit({ action: 'set_plan', status: 'error' });
          res.status(400).json({ error: result.validationError });
          return;
        }
        if (result.error) {
          const msg = String((result.error && result.error.message) || '');
          await audit({ action: 'set_plan', status: 'error' });
          if (msg.includes('ALVO_INEXISTENTE')) {
            res.status(404).json({ error: 'ALVO_INEXISTENTE' });
            return;
          }
          if (msg.includes('PLANO_INVALIDO') || msg.includes('PLAN_INVALIDO')) {
            res.status(400).json({ error: 'PLANO_INVALIDO' });
            return;
          }
          console.error('[admin] set_plan rpc error', result.error);
          res.status(500).json({ error: 'SET_PLAN_FAILED' });
          return;
        }
        // A RPC admin_set_plan já grava o audit before/after/reason na MESMA
        // transação (16-01) — NÃO duplicar INSERT aqui (e essa linha conta p/ o rate-limit).
        res.status(200).json(result.data);
        return;
      }

      default:
        await audit({ action: 'unknown', status: 'error' });
        res.status(400).json({ error: 'UNKNOWN_ACTION' });
    }
  } catch (err) {
    console.error('[admin] unhandled error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
};
