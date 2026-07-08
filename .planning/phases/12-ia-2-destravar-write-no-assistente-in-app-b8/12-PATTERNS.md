# Phase 12: IA-2 Destravar WRITE no assistente in-app (B8) - Pattern Map

**Mapped:** 2026-07-07
**Files analyzed:** 5 (2 modified backend, 2 modified frontend, 1 new backend module)
**Analogs found:** 5 / 5 (all patterns exist live in this repo — this phase is "restore + fix 2 latent bugs + add 2 new mechanisms", not greenfield)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `supabase/schema.sql` (new fn `wa_log_transaction`) | migration/RPC | CRUD (atomic insert + derived recalc) | `pay_card_invoice` in `supabase/derived-balance.sql:106-138` | exact — same SECURITY DEFINER + owner-guard + `recalc_account_balance` shape |
| `api/assistant.js` (`TOOLS_DECLARATION`, `SYSTEM_PROMPT`, rate-limit gate) | controller (serverless handler) | request-response | itself, pre-`6018f66` version (git history) + current READ-only declarations (`:53-91`) | exact — literal revert + extension of existing code in the same file |
| `api/_lib/nonce.js` (new) | utility | transform (sign/verify) | none in-repo yet; pattern is `crypto` HMAC per Node docs, same rationale drafted for WhatsApp webhook signature (`whatsapp-e-ia-arquitetura.md §3`) | role-match only — no direct in-repo analog, but stack (`crypto.createHmac`/`timingSafeEqual`) already implied by project conventions |
| `assets/fides-claude.jsx` (`toolExecutors.criar_categoria`, `resolveWriteToolArgs`, `executeWriteTool`, `TOOLS_REQUIRING_CONFIRMATION`) | component/hook (client tool executor) | event-driven (confirm → execute → toolResult) | itself — dead code already implements the pattern correctly for `recategorizar_transacao`/`editar_transacao`; `lancar_transacao` branch needs a fix | exact — editing in place, not building new |
| `assets/fides-store.jsx` (no edit — reference only) / new call site `window.fidesDb.rpc('wa_log_transaction', ...)` | service (data layer) | CRUD | `addTransaction` (`:397-428`) for the RPC-call shape being replaced; `updateTransaction` (`:452-489`) is reused as-is for D-03 | exact — `addTransaction` shows the non-atomic 3-step pattern the new RPC must collapse into one call |

## Pattern Assignments

### `supabase/schema.sql` — new `wa_log_transaction` RPC (migration, CRUD)

**Analog:** `pay_card_invoice`, `supabase/derived-balance.sql:106-138` (also see sibling patterns `recalc_account_balance:13-25`, `delete_transaction:42-69`, `transfer_funds:71-104` in the same file for the family of SECURITY DEFINER conventions).

**Full analog body** (copy structure, not literal SQL — RPC params/columns differ):
```sql
create or replace function public.pay_card_invoice(p_card_id uuid, p_account_id uuid, p_tx_ids uuid[])
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_total numeric(12,2); v_count int;
        v_today date := (now() at time zone 'utc')::date; v_tmp uuid;
begin
  if v_uid is null then raise exception 'AUTH'; end if;
  select id into v_tmp from public.accounts where id=p_account_id and user_id=v_uid;
  if v_tmp is null then raise exception 'CONTA'; end if;
  select id into v_tmp from public.cards where id=p_card_id and user_id=v_uid;
  if v_tmp is null then raise exception 'CARTAO'; end if;

  select coalesce(sum(abs(value)),0), count(*) into v_total, v_count
  from public.transactions
  where id = any(p_tx_ids) and user_id=v_uid and card_id=p_card_id and settled=false;
  if v_count=0 or v_total<=0 then raise exception 'FATURA: nada em aberto'; end if;

  insert into public.transactions
    (user_id, description, value, category, account, account_id, card_id,
     date, month, status, recurrent, subscription, settled, is_transfer)
  values
    (v_uid,'Pagamento de fatura',-v_total,'divida',
     p_account_id::text,p_account_id,null,
     v_today,to_char(v_today,'YYYY-MM'),'cleared',false,false,true,true);

  update public.transactions set settled=true, paid_at=now(), status='cleared'
   where id = any(p_tx_ids) and user_id=v_uid and card_id=p_card_id and settled=false;
  update public.cards set used = greatest(0, used - v_total)
   where id=p_card_id and user_id=v_uid;

  perform public.recalc_account_balance(p_account_id);
  return jsonb_build_object('paid', v_total, 'count', v_count);
end; $$;
grant execute on function public.pay_card_invoice(uuid,uuid,uuid[]) to authenticated;
```

**What to copy exactly:**
- `security definer set search_path to 'public'` header — mandatory hardening, present on every RPC in this file.
- `v_uid uuid := auth.uid()` resolved internally, never a client-supplied `p_user_id` (research assumption A1 — confirmed by this pattern: `pay_card_invoice`/`delete_transaction`/`transfer_funds` all resolve `auth.uid()` internally, none accept a user id parameter).
- Ownership guard pattern: `select id into v_tmp from public.<table> where id=p_x and user_id=v_uid; if v_tmp is null then raise exception '<CODE>'; end if;` — repeat for both `account_id` and `card_id` branches.
- `insert into public.transactions (...) values (...)` column list is the exact column set `wa_log_transaction` must also populate (`user_id, description, value, category, account, account_id, card_id, date, month, status, recurrent, subscription, settled, is_transfer`).
- Post-insert atomic side-effects done via `perform public.recalc_account_balance(p_account_id)` (never manual balance math) and direct `update public.cards set used = ...` for card-side mutation.
- `grant execute on function public.<fn>(<explicit types>) to authenticated;` — required trailing line, exact signature types.

**Caveat (research flag, HIGH risk if ignored):** `supabase/schema.sql` is confirmed stale (missing `settled`, `paid_at`, `is_transfer`, `transfer_group`, `opening_balance` columns that only exist in `derived-balance.sql`/production). Before writing the final RPC, verify column list against the LIVE schema via Supabase MCP (`list_tables`), not just against these two `.sql` files.

---

### `api/assistant.js` — `TOOLS_DECLARATION` restore (controller, request-response)

**Analog:** same file, current READ-only declarations (`api/assistant.js:53-91`), literal shape to replicate for the 4 WRITE tools:

```javascript
const TOOLS_DECLARATION = [{
  functionDeclarations: [
    {
      name: 'consultar_saldo',
      description: 'Retorna um snapshot das finanças atuais do usuário: ...',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'consultar_extrato',
      description: 'Retorna lista de transações filtradas. ...',
      parameters: {
        type: 'object',
        properties: {
          periodo: { type: 'string', description: '...', enum: ['hoje', 'semana', 'mes', 'prev_mes'] },
          conta: { type: 'string', description: '...' },
          cartao: { type: 'string', description: '...' },
          limite: { type: 'integer', description: 'Máximo de transações a retornar. Padrão 20.' },
        },
        required: ['periodo'],
      },
    },
  ],
}];
```

**Pattern to copy:** each tool is a `functionDeclarations[]` entry with `name`/`description`/`parameters` (JSON-Schema-like `type:'object'` + `properties` + `required`). Append the 4 WRITE entries into the same array (`functionDeclarations`), not a separate `TOOLS_DECLARATION` block. Exact drafts for the 4 WRITE tools (params, enums) are preserved in git history at commit `6018f66` (the commit that removed them) — read via `git show 6018f66` as the near-literal source, cross-checked against D-04/D-05 for the 2 required deltas (categoria bundling note in `criar_categoria` description; `editar_transacao.parameters.patch` already excludes `conta_ou_cartao`, no change needed there).

**SYSTEM_PROMPT pattern** (`api/assistant.js:14`, single string literal): currently contains the "modo manutenção" sentence to delete/replace:
```javascript
const SYSTEM_PROMPT = `Voce e o assistente Fides, especialista em financas pessoais. MODO ATUAL: apenas consulta. Voce pode consultar saldos e extratos do usuario. Voce NAO pode lancar transacoes, editar, categorizar ou criar categorias neste momento. ...
```
Copy the honesty-rule block from RESEARCH.md `## Code Examples` (already drafted, ready to paste) into this same template-literal, replacing the "manutenção" sentence — keep the rest of the prompt (tool usage hints at `:28-29`) unmodified, just extend with the WRITE section.

---

### `api/assistant.js` — rate-limit gate + nonce (controller, request-response)

**Analog:** the gate itself, `api/assistant.js:136-169` (current, to be extended not replaced):
```javascript
// ─── RATE LIMIT POR USUÁRIO ──────────────────────
const isFirstCallOfTurn = !Array.isArray(toolResults) || toolResults.length === 0;
let usageRowId = null;

if (isFirstCallOfTurn) {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from('assistant_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', twentyFourHoursAgo);

  if (countError) {
    console.error('[assistant] usage count error', countError);
    // fail-open
  } else if ((count || 0) >= USER_DAILY_LIMIT) {
    res.status(429).json({ error: 'USER_DAILY_LIMIT', code: 429, limit: USER_DAILY_LIMIT });
    return;
  }
  // ... insert usage row, capture usageRowId
}
```

**What to preserve:** the `isFirstCallOfTurn` variable name and the fail-open discipline on `countError` (log + continue, never block on infra error) — only the boolean expression itself changes per D-06 (add nonce validity to the check), the surrounding count/insert/429 logic stays untouched.

**Exact replacement expression** (from RESEARCH.md, ready to adapt — do not re-derive):
```javascript
const nonce = require('./_lib/nonce');
const NONCE_SECRET = process.env.ASSISTANT_NONCE_SECRET;

const hasToolResults = Array.isArray(toolResults) && toolResults.length > 0;
const clientNonce = req.body?.nonce || null;
const nonceValid = hasToolResults && clientNonce && NONCE_SECRET
  ? nonce.verify(clientNonce, userId, NONCE_SECRET)
  : false;
const isFirstCallOfTurn = !hasToolResults || !nonceValid;
```

**Response-emission pattern** — where `tool_calls` are returned today (`api/assistant.js:262`, `res.status(200).json({ tool_calls: toolCalls })`) must also emit the next nonce alongside:
```javascript
if (toolCalls.length > 0) {
  const nextNonce = NONCE_SECRET ? nonce.sign(userId, NONCE_SECRET) : null;
  res.status(200).json({ tool_calls: toolCalls, nonce: nextNonce });
  return;
}
```

---

### `api/_lib/nonce.js` (new file) — utility, transform

**No direct in-repo analog** (nonce/HMAC anti-replay doesn't exist elsewhere yet). Follow the module convention of the sibling `api/_lib/gemini.js` (CommonJS, not routable, `module.exports = { ... }` at bottom — same shape as this phase's AI-SHARED-01 extraction from Phase 11). Reference implementation (from RESEARCH.md, `Don't Hand-Roll` table mandates `crypto.timingSafeEqual` over `===` for signature comparison — non-negotiable):
```javascript
// api/_lib/nonce.js — CommonJS, não roteável (mesma convenção de _lib/gemini.js)
const crypto = require('crypto');

const NONCE_TTL_MS = 120 * 1000; // 120s (decisão desta sessão — ver CONTEXT.md)

function sign(uid, secret) {
  const payload = JSON.stringify({ uid, iat: Date.now(), exp: Date.now() + NONCE_TTL_MS });
  const payloadB64 = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

function verify(token, uid, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [payloadB64, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const sigBuf = Buffer.from(sig || '');
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false;
  let claims;
  try { claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()); } catch { return false; }
  if (claims.uid !== uid) return false;
  if (!claims.exp || Date.now() > claims.exp) return false;
  return true;
}

module.exports = { sign, verify };
```
**Note for planner:** CONTEXT.md session refinement fixes TTL at **120s** (not the 5-min RESEARCH.md suggestion) — use `NONCE_TTL_MS = 120 * 1000` as shown above, overriding the research draft's 5-minute recommendation.

---

### `assets/fides-claude.jsx` — `executeWriteTool` / `lancar_transacao` branch (component, event-driven)

**Analog:** itself — the working branches for `recategorizar_transacao`/`editar_transacao` in the same function are the correct pattern to mirror; the `lancar_transacao` branch has the P2 bug (hard-coded month).

**Current buggy code** (`assets/fides-claude.jsx:346-364`, confirmed by direct read):
```javascript
if (name === 'lancar_transacao') {
  const r = resolved;
  const tx = {
    desc: r.desc,
    val: r.val,
    cat: r.cat,
    d: r.dateStr,
    status: r.status,
    mes: selectedMonth,        // <-- BUG P2: mês da UI, não da data real
  };
  if (r.target.type === 'account') {
    tx.acct = r.target.id;
    tx.account_id = r.target.id;
  } else {
    tx.card_id = r.target.id;
  }
  await addTransaction(tx);
  return { success: true, message: `Lancei ${fmtBRL(Math.abs(r.val))} (${r.desc}) em ${r.target.name}.` };
}
```
This whole branch is being replaced by a `window.fidesDb.rpc('wa_log_transaction', {...})` call (D-01) — the correct `p_month` derivation must reuse `window.mesFaturaFor(resolved.dateStr, card, ano)` for card targets (see `mesFaturaFor` analog below) and a plain `YYYY-MM` from `resolved.dateStr` for account targets — never `selectedMonth`.

**Working sibling branches to preserve as-is (pattern for error handling / try-catch wrapper):**
```javascript
if (name === 'recategorizar_transacao') {
  await updateTransaction(resolved.tx._id || resolved.tx.id, { cat: resolved.newCatId });
  return { success: true, message: `Categoria atualizada para "${resolved.newCatLabel}".` };
}
if (name === 'editar_transacao') {
  const patch = {};
  if (resolved.patch.valor !== undefined) {
    const sign = (Number(resolved.tx.val) || 0) >= 0 ? 1 : -1;
    patch.val = sign * Math.abs(Number(resolved.patch.valor));
  }
  if (resolved.patch.descricao !== undefined) patch.desc = String(resolved.patch.descricao);
  if (resolved.patch.data !== undefined) patch.d = String(resolved.patch.data);
  if (resolved.patch.status !== undefined) patch.status = String(resolved.patch.status);
  await updateTransaction(resolved.tx._id || resolved.tx.id, patch);
  return { success: true, message: `Transação atualizada.` };
}
```
Whole function wrapped in one `try { ... } catch (err) { console.error('[FidesAssistant] executeWriteTool error', err); return { error: 'EXECUTION_ERROR', message: String(err?.message || err) }; }` (`:343-387`) — the standard error-handling shape for all 3+1 branches, must be preserved for the new RPC call too.

**`criar_categoria` fix (P5 — missing `await`)**, current buggy code (`assets/fides-claude.jsx:269-283`):
```javascript
criar_categoria: (args = {}) => {
  const label = String(args.label || '').trim();
  if (!label) return { error: 'LABEL_REQUIRED', message: 'Label da categoria é obrigatório.' };
  const emoji = String(args.emoji || '🏷️');
  const group = ['essenciais', 'estilo', 'futuro'].includes(args.group) ? args.group : 'estilo';
  const catKey = label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (!catKey) return { error: 'INVALID_LABEL', message: 'Não consegui gerar id para essa categoria.' };
  try {
    addCategory(catKey, { label, emoji, group, custom: true });   // <-- BUG P5: missing await
    setToast({ text: `✓ Categoria "${label}" criada`, ts: Date.now() });
    return { success: true, categoria_id: catKey, label, emoji, group };
  } catch (err) {
    return { error: 'EXECUTION_ERROR', message: String(err?.message || err) };
  }
},
```
Per RESEARCH.md Open Question Q1 (recommended reading: move to `TOOLS_REQUIRING_CONFIRMATION`), this executor should migrate out of the `toolExecutors` object (direct-execute path) into the same confirm-then-execute flow as the other 3 WRITE tools — mirror `resolveWriteToolArgs`/`executeWriteTool` structure below instead of patching in place with `await`.

**`TOOLS_REQUIRING_CONFIRMATION` array** (`assets/fides-claude.jsx:17`) — current:
```javascript
const TOOLS_REQUIRING_CONFIRMATION = ['lancar_transacao', 'recategorizar_transacao', 'editar_transacao'];
```
Target per this session's decision: add `'criar_categoria'` to this array.

**`callAssistant` signature to extend for nonce** (`assets/fides-claude.jsx:452-468`):
```javascript
const callAssistant = async (history, toolResults, jwt) => {
  const ctx = buildContext();
  const res = await fetch('/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
    body: JSON.stringify({ messages: history, context: ctx, toolResults: toolResults || null }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
};
```
And its call site in the polling loop (`assets/fides-claude.jsx:500-501`, `while (iteration < MAX_TOOL_ITERATIONS) { const { ok, status, data } = await callAssistant(history, toolResults, jwt); ...}`) — both need a new `nonce` parameter threaded through (state var holding last-received nonce, sent back as `body.nonce`).

---

### `assets/fides-store.jsx` — reference only (service, CRUD) — D-02: do not modify

**Analog role:** `addTransaction` (`:397-428`) shows the exact non-atomic 3-step sequence the new RPC replaces — do not copy this pattern into the assistant path, copy the *problem* it illustrates:
```javascript
const addTransaction = React.useCallback(async (tx) => {
  const merged = ensureMes({ ...tx });
  if (mode === 'live' && userId) {
    const row = txToRow(merged, userId, cards);
    const { error } = await window.fidesDb.from('transactions').insert(row);
    if (error) throw error;
    if (row.account_id) {
      await window.fidesDb.rpc('recalc_account_balance', { p_account_id: row.account_id });
    }
    if (row.card_id && merged.val < 0) {
      const { data: card } = await window.fidesDb.from('cards').select('used').eq('id', row.card_id).single();
      if (card) {
        await window.fidesDb.from('cards')
          .update({ used: Number(card.used) + Math.abs(Number(merged.val)) })
          .eq('id', row.card_id);
      }
    }
    await refreshData(userId);
  }
  ...
}, [mode, userId, cards, refreshData]);
```
3 separate round-trips (insert → recalc RPC → manual SELECT+UPDATE of `cards.used`) — exactly what `wa_log_transaction` must collapse into one SQL function call (D-01). Left untouched by this phase (D-02).

**`updateTransaction`** (`:452-489`) — reused as-is by D-03 for `recategorizar_transacao`/`editar_transacao`. Note it already supports `patch.acct` (account/card reassignment, `:467-473`) but the assistant tool intentionally never sends that key (D-05) — no code change needed here, just confirm the tool's `resolved.patch` object never includes `acct`.

**`mesFaturaFor`** — `assets/fides-data.jsx:52-64`:
```javascript
function mesFaturaFor(dStr, card, year = 2026) {
  if (!card) return null;
  const [dd, mm] = String(dStr).split('/').map(s => parseInt(s, 10));
  if (!dd || !mm) return null;
  const fechamento = card.diaFechamento || 5;
  let monthClose = mm;
  if (dd >= fechamento) monthClose = mm + 1;
  let y = year;
  while (monthClose > 12) { monthClose -= 12; y += 1; }
  return ymOf(y, monthClose);
}
```
This is the single source of truth for card-billing-month derivation (`Don't Hand-Roll` — never reimplement in SQL). The new `lancar_transacao` branch in `fides-claude.jsx` must call `window.mesFaturaFor(resolved.dateStr, card, year)` when `target.type === 'card'` and pass the result as `p_month` to `wa_log_transaction`, exactly mirroring how `txToRow` (`fides-store.jsx:193+`) already does this for the modal path (per commit `7335fed`, BUG-FATURA fix).

---

## Shared Patterns

### SECURITY DEFINER + owner guard (Postgres RPCs)
**Source:** `supabase/derived-balance.sql` — `pay_card_invoice:106-138`, `recalc_account_balance:13-25`, `delete_transaction:42-69`, `transfer_funds:71-104`
**Apply to:** `wa_log_transaction` (new RPC)
```sql
security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); ...
begin
  if v_uid is null then raise exception 'AUTH'; end if;
  select id into v_tmp from public.<table> where id=p_x and user_id=v_uid;
  if v_tmp is null then raise exception '<CODE>'; end if;
  ...
end; $$;
grant execute on function public.<fn>(<types>) to authenticated;
```

### Fail-open on infra error, fail-closed on business limit
**Source:** `api/assistant.js:150-156` (rate-limit count check)
**Apply to:** nonce verification gate (D-06) — on `countError`/malformed nonce, log and continue treating as first-call (never 500 the whole request over the rate-limit subsystem itself failing).

### try/catch wrapper returning `{ error: 'EXECUTION_ERROR', message }` for tool execution
**Source:** `assets/fides-claude.jsx:343-387` (`executeWriteTool`), `assets/fides-claude.jsx:280-282` (`criar_categoria` catch block)
**Apply to:** any new/modified branch inside `executeWriteTool`, and the migrated `criar_categoria` confirm-flow branch.

### Derived balance only, never incremental JS mutation
**Source:** `assets/fides-store.jsx:404-406` (`recalc_account_balance` call after insert), `pay_card_invoice:135` (same call)
**Apply to:** `wa_log_transaction` — must call `perform public.recalc_account_balance(p_account_id)` inside the SQL function itself (not from JS) whenever `p_account_id` is set.

### Confirm-before-execute UI flow
**Source:** `assets/fides-claude.jsx` `TOOLS_REQUIRING_CONFIRMATION` (`:17`) + `resolveWriteToolArgs` (`:287-340`) + `renderConfirmationCard` (`:574+`)
**Apply to:** `criar_categoria`, once migrated into the confirmation-required set (this session's decision).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `api/_lib/nonce.js` | utility | transform (sign/verify) | No HMAC/nonce module exists yet in this repo; closest conceptual precedent is the (undeveloped) WhatsApp webhook signature design in `.planning/research/whatsapp-e-ia-arquitetura.md §3`, not runnable code. Use `crypto.createHmac`/`crypto.timingSafeEqual` per Node docs as cited in RESEARCH.md `Don't Hand-Roll`. |

## Metadata

**Analog search scope:** `supabase/derived-balance.sql`, `api/assistant.js`, `assets/fides-claude.jsx`, `assets/fides-store.jsx`, `assets/fides-data.jsx`, git history (`6018f66`, `7335fed`, `93b02d9`) as referenced by RESEARCH.md
**Files scanned:** 5 (all files in scope from CONTEXT.md `<canonical_refs>` / `<code_context>`)
**Pattern extraction date:** 2026-07-07
**Note:** `supabase/schema.sql` itself was not read directly for this pattern map — RESEARCH.md already flagged it as stale (missing `settled`/`paid_at`/`is_transfer`/`transfer_group`/`opening_balance`), so `supabase/derived-balance.sql` (confirmed live-accurate) was used as the pattern source instead. Planner/executor must still verify the final RPC against the live schema via Supabase MCP before commit (per RESEARCH.md A3).
