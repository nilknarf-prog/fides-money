// api/_lib/admin/set-plan.js — chama admin_set_plan (RPC service_role-only, 16-01).
// CommonJS, não-roteável. A RPC já grava o audit before/after/reason na MESMA
// transação (atômico) — este módulo NUNCA insere um segundo registro de audit.

const VALID_PLANS = new Set(['free', 'pro', 'family']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function setPlan(adminClient, { adminId, adminEmail, targetUser, newPlan, reason }) {
  // Validação defensiva no serverless — a RPC também valida (defesa em profundidade,
  // schema.sql CHECK + validação plpgsql), mas falhar cedo com 400 é mais claro que
  // deixar o Postgres levantar exceção de cast/domínio.
  if (!targetUser || typeof targetUser !== 'string' || !UUID_RE.test(targetUser)) {
    return { validationError: 'TARGET_USER_INVALIDO' };
  }
  if (!newPlan || typeof newPlan !== 'string' || !VALID_PLANS.has(newPlan)) {
    return { validationError: 'PLANO_INVALIDO' };
  }
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return { validationError: 'REASON_OBRIGATORIO' };
  }

  const { data, error } = await adminClient.rpc('admin_set_plan', {
    p_admin_id: adminId,
    p_admin_email: adminEmail,
    p_target_user: targetUser,
    p_new_plan: newPlan,
    p_reason: reason.trim(),
  });
  if (error) {
    return { error };
  }
  // A RPC retorna jsonb { target, before, after }.
  return { data };
}

module.exports = { setPlan };
