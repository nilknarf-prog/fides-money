// api/admin.js — Vercel Serverless Function (CommonJS)
// Roteador ÚNICO do painel admin/backoffice (ADMIN-02). NENHUM outro arquivo em
// api/ deve expor superfície admin — guard e roteador são únicos por design.
//
// requireAdmin roda SEMPRE antes de qualquer dispatch (nenhuma action é
// alcançável sem PASS). Toda resposta é Cache-Control: no-store — nunca
// cacheável, nunca segredo (service_role jamais chega ao corpo da resposta).
//
// Actions: GET whoami | GET accounts | GET audit | POST set_plan.

const { requireAdmin, logAction, getClientIp, getUserAgent } = require('./_lib/admin/guard');
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
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);
  const action = (req.query && req.query.action) || (req.body && req.body.action) || null;

  try {
    switch (action) {
      case 'whoami': {
        if (req.method !== 'GET') {
          res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
          return;
        }
        // Toda action grava audit — inclusive whoami, que não toca outras tabelas.
        await logAction(adminClient, {
          action: 'whoami',
          admin_id: user.id,
          admin_email: user.email,
          ip,
          user_agent: userAgent,
        });
        res.status(200).json({ id: user.id, email: user.email });
        return;
      }

      case 'accounts': {
        if (req.method !== 'GET') {
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
          res.status(500).json({ error: 'ACCOUNTS_QUERY_FAILED' });
          return;
        }
        await logAction(adminClient, {
          action: 'list_accounts',
          admin_id: user.id,
          admin_email: user.email,
          ip,
          user_agent: userAgent,
        });
        res.status(200).json(result.data);
        return;
      }

      case 'audit': {
        if (req.method !== 'GET') {
          res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
          return;
        }
        const q = req.query || {};
        const result = await listAudit(adminClient, { limit: q.limit, offset: q.offset });
        if (result.error) {
          console.error('[admin] audit query error', result.error);
          res.status(500).json({ error: 'AUDIT_QUERY_FAILED' });
          return;
        }
        await logAction(adminClient, {
          action: 'view_audit',
          admin_id: user.id,
          admin_email: user.email,
          ip,
          user_agent: userAgent,
        });
        res.status(200).json(result.data);
        return;
      }

      case 'set_plan': {
        if (req.method !== 'POST') {
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
          res.status(400).json({ error: result.validationError });
          return;
        }
        if (result.error) {
          const msg = String((result.error && result.error.message) || '');
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
        // transação (16-01) — NÃO duplicar INSERT aqui.
        res.status(200).json(result.data);
        return;
      }

      default:
        res.status(400).json({ error: 'UNKNOWN_ACTION' });
    }
  } catch (err) {
    console.error('[admin] unhandled error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
};
