// api/_lib/admin/audit-list.js — lê admin_audit_log (paginado, mais recente primeiro).
// CommonJS, não-roteável. Recebe o adminClient já autorizado pelo guard.

function clampInt(val, fallback, min, max) {
  const n = parseInt(val, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

async function listAudit(adminClient, { limit, offset }) {
  const safeLimit = clampInt(limit, 50, 1, 200);
  const safeOffset = clampInt(offset, 0, 0, Number.MAX_SAFE_INTEGER);

  const { data, error, count } = await adminClient
    .from('admin_audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1);

  if (error) {
    return { error };
  }
  // Mesmo formato { <chave>, total_count } de admin_list_accounts, para consistência.
  return { data: { audit: data || [], total_count: count || 0 } };
}

module.exports = { listAudit };
