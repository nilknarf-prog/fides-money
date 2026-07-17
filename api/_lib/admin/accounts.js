// api/_lib/admin/accounts.js — chama admin_list_accounts (RPC service_role-only, 16-01).
// CommonJS, não-roteável. Recebe o adminClient já autorizado pelo guard.

function firstOf(val) {
  return Array.isArray(val) ? val[0] : val;
}

async function listAccounts(adminClient, { search, plan, limit, offset }) {
  const { data, error } = await adminClient.rpc('admin_list_accounts', {
    p_search: firstOf(search) || null,
    p_plan: firstOf(plan) || null,
    p_limit: limit || undefined,
    p_offset: offset || undefined,
  });
  if (error) {
    return { error };
  }
  // A RPC já retorna jsonb { accounts: [...], total_count }.
  return { data };
}

module.exports = { listAccounts };
