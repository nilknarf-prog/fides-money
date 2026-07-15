# Phase 13: IA-3 Gating premium in-app - Pattern Map

**Mapped:** 2026-07-14
**Files analyzed:** 6 modify + 1 create
**Analogs found:** 7 / 7 (all in-file, self-referential — this phase composes existing patterns in the same files, not cross-file analogs)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `api/assistant.js` | route/controller (serverless) | request-response | itself — `auth.getUser`/rate-limit/tools-toggle blocks already in the same file | exact (self-pattern) |
| `assets/fides-store.jsx` | store/provider | CRUD (read-mostly) | itself — existing `select('name, group_targets')` fetch (2x) + `value` object | exact (self-pattern) |
| `assets/fides-claude.jsx` | component (chat UI) | request-response | itself — `friendlyError` map + error-handling branch in `callAssistant` | exact (self-pattern) |
| `assets/fides-orcamento.jsx` | component (analysis UI) | request-response | itself — `friendlyAiError` map in the insights/análise block | exact (self-pattern) |
| `assets/fides-studio.jsx` (`PerfilView`) | component | CRUD (display + light write) | itself — `PerfilView` header/card structure | exact (self-pattern) |
| `supabase/profiles-plan-privileges.sql` | migration | batch (DDL, one-shot) | `supabase/wa-log-transaction.sql` (file style/header convention), `supabase/schema.sql:182-211` (RLS policy + trigger block for `profiles`) | role-match |
| Paywall UI (used from `fides-claude.jsx`/`fides-orcamento.jsx`/`fides-studio.jsx`) | component (modal) | request-response | `EmBreveModal` (`assets/fides-metas.jsx:972-999`) + `ConfirmDialog`/`useConfirm`/`useToast` (`assets/fides-ui.jsx:46-228`) | exact |

## Pattern Assignments

### `api/assistant.js` (route/controller, request-response) — MODIFY

**Analog:** same file, existing auth/rate-limit/payload blocks.

**Auth pattern** (lines 195-212) — where to insert the plan read, right after `userId` is known:
```js
const isAnalysisMode = mode === 'analysis';
...
const { data: userData, error: authError } = await supabase.auth.getUser(token);
if (authError || !userData?.user) {
  res.status(401).json({ error: 'JWT_INVALID', code: 401 });
  return;
}
const userId = userData.user.id;
```

**Fail-closed plan read pattern to add right after line 212** (allow-list, D-02/D-4 — mirrors the `try/catch` + fail-open style already used for `assistant_usage` inserts below):
```js
let plan = 'free'; // fail-closed default (D-02)
try {
  const { data: profileRow, error: profileError } = await supabase
    .from('profiles').select('plan').eq('id', userId).single();
  if (!profileError && profileRow && typeof profileRow.plan === 'string') plan = profileRow.plan;
} catch (e) {
  console.error('[assistant] profile plan fetch exception', e);
}
const isPremium = plan === 'pro' || plan === 'family'; // allow-list, not `!== 'free'`

// GATE-03 part 1: Análise da IA is premium-only
if (isAnalysisMode && !isPremium) {
  res.status(403).json({ error: 'PREMIUM_REQUIRED', code: 403 });
  return;
}
```

**Rate-limit / cap pattern to copy for the monthly free cap** (lines 221-254 — `isFirstCallOfTurn` guard + `count`/`gte` query + fail-open on count error + hard-block on `>=` threshold):
```js
const isFirstCallOfTurn = !hasToolResults || !nonceValid;
...
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
  ...
}
```
New monthly-cap block (GATE-02) goes inside the same `if (isFirstCallOfTurn)` guard, gated additionally by `!isPremium`, computing `startOfMonthUTC` instead of 24h-ago, and returning `429 FREE_MONTHLY_LIMIT` — same shape as `USER_DAILY_LIMIT` above, no new table/column (query only).

**System-prompt addendum toggle pattern** (lines 263-270 — `ANALYSIS_ADDENDUM` conditionally concatenated):
```js
const ANALYSIS_ADDENDUM = '\n\n═══ MODO ANÁLISE (resposta única) ═══\n...';

const fullSystem = SYSTEM_PROMPT
  + (isAnalysisMode ? ANALYSIS_ADDENDUM : '')
  + (context ? `\n\n═══ CONTEXTO ATUAL DO USUÁRIO ═══\n${context}` : '');
```
Add a third concatenated block `+ (!isPremium ? FREE_TIER_ADDENDUM : '')` following the exact same string-concat style — do not branch into a separate function.

**Tools toggle pattern** (lines 304-308 — the exact point that must change from a static array to a tier-conditional builder):
```js
const payload = gemini.buildPayload({
  systemPrompt: fullSystem,
  contents,
  tools: isAnalysisMode ? undefined : TOOLS_DECLARATION,   // → buildToolsForPlan(isPremium)
  toolMode: isAnalysisMode ? 'NONE' : 'AUTO',
  generationConfig: {
```
`TOOLS_DECLARATION` itself starts at line 70 as `const TOOLS_DECLARATION = [{ functionDeclarations: [...] }]` — must be split into `READ_FUNCTIONS`/`WRITE_FUNCTIONS` arrays feeding a `buildToolsForPlan(isPremium)` helper (see RESEARCH.md Pattern 1 for the exact split shape — 2 read tools, 4 write tools already enumerated there).

**Error handling pattern:** every gate branch in this file uses the same `res.status(code).json({ error: 'CODE', code })` shape with an early `return;` — no thrown exceptions, no centralized error middleware. New gate responses (`403 PREMIUM_REQUIRED`, `429 FREE_MONTHLY_LIMIT`) must follow this exact shape to match what `friendlyError`/`friendlyAiError` on the client expect (`data?.error` string).

---

### `assets/fides-store.jsx` (store/provider, CRUD) — MODIFY

**Analog:** same file, two existing `profiles` select points + the `value` object.

**Select pattern, 2 occurrences to update identically** (lines 330 and 364 — both inside `getAuthUser().then(...)` initial load and the `onAuthStateChange` SIGNED_IN re-fetch):
```js
const { data: profile } = await window.fidesDb.from('profiles').select('name, group_targets').eq('id', user.id).single();
if (mounted) {
  setUserName(profile?.name || '');
  if (profile?.group_targets && typeof profile.group_targets === 'object') {
    setGroupTargetsState({ ... });
  }
}
```
Change `.select('name, group_targets')` → `.select('name, group_targets, plan')` in both places, and add `setUserPlan(profile?.plan || 'free')` (fail-closed default) alongside `setUserName`.

**State declaration pattern** (line 158, `userName` useState — model for the new `userPlan` state):
```js
const [userName,  setUserName]  = React.useState('');
```
Add sibling: `const [userPlan, setUserPlan] = React.useState('free');`

**Context value exposure pattern** (lines 1370-1394, the `value` object returned by the Provider):
```js
const value = {
  mode, userId, isLoading, isEmpty,
  userName, firstName, userEmail,
  ...
  updateProfile,
  groupTargets, setGroupTargets, resetGroupTargets,
```
Add `userPlan, isPremium: userPlan === 'pro' || userPlan === 'family',` near `userName, firstName, userEmail,` — same allow-list logic as the backend (`plan === 'pro' || plan === 'family'`), not `!== 'free'`.

Note: there is a second "mock"/fallback `value` object further down (around line 1424, `userName: '', firstName: '', userEmail: '',`) used when there's no session — mirror the same addition there with `userPlan: 'free', isPremium: false,` (fail-closed default) to keep both branches in sync.

---

### `assets/fides-claude.jsx` (component, request-response) — MODIFY

**Analog:** same file, `friendlyError` map (lines 547-565) + the `callAssistant` error-handling branch (lines 701-713).

**Error map pattern** (lines 547-565):
```js
const friendlyError = (errCode) => {
  const map = {
    JWT_MISSING:         'Sua sessão não foi reconhecida. Faça login de novo.',
    ...
    USER_DAILY_LIMIT:    'Você atingiu o limite diário de mensagens com o assistente. Tente novamente em algumas horas.',
    ...
    TOOL_LIMIT:          'O assistente ficou em loop. Tente reformular a pergunta.',
  };
  return map[errCode] || 'Não consegui responder agora. Tente de novo em instantes.';
};
```
Add `FREE_MONTHLY_LIMIT: '...'` and `PREMIUM_REQUIRED: '...'` entries — copy must point toward upgrade (paywall), unlike the generic daily-limit copy.

**Caller pattern for special-cased error codes** (lines 701-713, where `USER_DAILY_LIMIT` already gets distinct handling vs. the generic fallthrough):
```js
const errCode = data?.error;
if (errCode === 'USER_DAILY_LIMIT') {
  setError(friendlyError('USER_DAILY_LIMIT'));
  ...
} else if (...) {
  setError(friendlyError('RATE_LIMIT'));
  ...
} else {
  setError(friendlyError(errCode));
}
```
`FREE_MONTHLY_LIMIT`/`PREMIUM_REQUIRED` should get their own branch here if the paywall UI (modal, not inline text) needs to trigger — reuse this `if/else if` ladder shape, don't invent a new dispatch mechanism.

**Guard pattern for reference (Pitfall 3 in RESEARCH)** — `claimsWriteCompletion` at line 642 already detects the model claiming a write without calling the tool; this exists as a safety net, do not duplicate its logic for the new gate, only add the `FREE_TIER_ADDENDUM` server-side per RESEARCH Pattern 4.

---

### `assets/fides-orcamento.jsx` (component, request-response) — MODIFY

**Analog:** same file, `friendlyAiError` map (lines 1017-1031), separate copy from `fides-claude.jsx`'s `friendlyError` (Pitfall 4 — must edit both together).

```js
function friendlyAiError(errCode) {
  var map = {
    JWT_MISSING:        'Sessão expirada. Atualize a página e tente novamente.',
    ...
    USER_DAILY_LIMIT:   'Você atingiu o limite diário de análises. Tente novamente amanhã.',
    ...
    NETWORK:            'Sem conexão. Verifique a internet e tente de novo.',
  };
  return map[errCode] || 'Não consegui gerar a análise agora. Tente novamente em instantes.';
}
```
Add `FREE_MONTHLY_LIMIT`/`PREMIUM_REQUIRED` entries here too (var-based ES5-ish style matches the rest of this file — note it uses `var`, not `const`, unlike `fides-claude.jsx`; keep that local convention). Also add the gate for the "Análise da IA" button itself (hide/CTA when `!isPremium`, sourced from `useFides().isPremium`), near where `cooldown`/`hasHistory` gate rendering already happens (lines 1005-1015).

---

### `assets/fides-studio.jsx` `PerfilView` (component, CRUD) — MODIFY

**Analog:** same file, `PerfilView` function (lines 706+), which already reads store state via `useFides()` and renders a card-based profile section (ES5 `React.createElement` style, not JSX — this file does NOT use Babel JSX sugar).

```js
function PerfilView({ onNav }) {
  var _s = window.useFides();
  var userName = _s.userName;
  var firstName = _s.firstName;
  var updateProfile = _s.updateProfile;
  ...
  return React.createElement('div', { className: 'prf-view' },
    React.createElement('div', { className: 'prf-header' }, ...),
    React.createElement('div', { className: 'prf-card' },
      React.createElement('div', { className: 'prf-avatar' }, ...),
      React.createElement('div', { className: 'fds-field' }, ...)
```
Add `userPlan`/`isPremium` to the destructured `_s` at the top, and a new tier-badge block (`React.createElement('div', {className:'prf-badge'}, isPremium ? 'Premium' : 'Free')`) plus an upgrade CTA button placed inside `prf-card`, following the same `React.createElement` nesting style as the existing avatar/field blocks — **do not introduce JSX syntax in this file**, it will break the Babel-standalone parse in this file's convention.

---

### `supabase/profiles-plan-privileges.sql` (migration, batch DDL) — CREATE

**Analog A (file style/header convention):** `supabase/wa-log-transaction.sql` (lines 1-9) — header comment block explaining purpose, decision reference, and scope:
```sql
-- Fides Money — wa_log_transaction
-- RPC atômica para lançamento de transação via assistente IA (chat in-app).
-- Espelha o padrão SECURITY DEFINER + owner-guard de pay_card_invoice.
--
-- Caminho EXCLUSIVO do assistente (D-02): NÃO substitui addTransaction do modal.
```
Mirror this header style: purpose (column-level privilege lock on `profiles.plan`), decision reference (Pitfall P1 / D-01/D-02), and explicit scope note (does not block `service_role`/SQL-Editor writes used for D-04 dev toggling).

**Analog B (existing profiles table + RLS definition to patch around):** `supabase/schema.sql`:
```sql
-- lines 11-16
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  name        text not null default '',
  plan        text not null default 'free' check (plan in ('free', 'pro', 'family')),
  created_at  timestamptz not null default now()
);
```
```sql
-- line 182 (RLS enable) and 190 (existing policy, name pattern to match style)
alter table public.profiles        enable row level security;
...
create policy "profiles: próprio usuário"     on public.profiles
```
The new file should add, AFTER this policy (not replacing it — RLS stays row-level as-is per D-01, this file only adds column-level privilege):
```sql
revoke update on public.profiles from authenticated;
grant update (name, group_targets) on public.profiles to authenticated;
```
**Important caveat surfaced by RESEARCH Assumption A1/A2 and CLAUDE.md (schema.sql may be stale, ROADMAP B10):** `schema.sql`'s `CREATE TABLE profiles` (line 11-16) does NOT list a `group_targets` column at all, even though the live code (`fides-store.jsx:330,364`, `setGroupTargets`) reads/writes it — confirming schema drift. Before writing the `GRANT UPDATE (...)` column list, confirm the live column set (via MCP Supabase or dashboard) rather than trusting `schema.sql` alone — grep every `.from('profiles').update(` call in the codebase to build the complete allow-list (RESEARCH already names `name` and `group_targets` as the only two found by that grep).

---

### Paywall UI (shared component, request-response) — used across `fides-claude.jsx`/`fides-orcamento.jsx`/`fides-studio.jsx`

**Analog 1 — modal shape:** `EmBreveModal` (`assets/fides-metas.jsx:972-999`):
```jsx
function EmBreveModal({ open, onClose }) {
  const { rendered, closing, requestClose } = window.FidesUI.useModalClose(open, onClose);
  if (!rendered) return null;
  return (
    <div className={"fds-modal-backdrop" + (closing ? " is-closing" : "")} onClick={requestClose}>
      <div className={"fds-modal" + (closing ? " is-closing" : "")} style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div className="fds-modal-head">
          <div className="fds-modal-title">Em breve</div>
          <button className="fds-icon-btn" onClick={requestClose}><Icon.X size={16}/></button>
        </div>
        <div className="fds-modal-body">
          <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, margin: 0 }}>
            Metas com salvamento chegam em breve. Por enquanto é só leitura.
          </p>
        </div>
        <div className="fds-modal-foot" style={{ justifyContent: 'flex-end' }}>
          <button className="fds-btn-primary" onClick={requestClose} style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>
            <Icon.Check size={13}/> Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
```
Copy this shape directly for the "Tela de upgrade" placeholder (title "Vire Premium" / body pricing copy per CONTEXT §Precificação P-2, single CTA "Entendi" or "Saiba mais" per PAYWALL-01 discretion) — uses `window.FidesUI.useModalClose`, the project's shared close-animation hook.

**Analog 2 — hard-block dialog / soft toast:** `assets/fides-ui.jsx` (`useConfirm`/`ConfirmDialog` lines 104-228, `useToast` lines 46-49):
```js
// hard block usage pattern (promise-based)
var confirm = useConfirm();
var ok = await confirm({ title: 'Recurso Premium', message: '...', confirmLabel: 'Ver planos', destructive: false });
if (ok) { /* navigate to upgrade screen */ }
```
```js
// soft warning usage pattern
var toast = useToast();
toast.warn('Você atingiu o limite gratuito deste mês.');
```
Both exported at `fides-ui.jsx:289-291` (`ConfirmDialog: ConfirmDialog, useToast: useToast, useConfirm: useConfirm,`) via `window.FidesUI`. Use `useConfirm`/`ConfirmDialog` for hard blocks (e.g. blocking WRITE attempt as free) and `useToast().warn` for soft nudges (e.g. approaching the 10-msg cap) — never native `confirm()`/`alert()` (ROADMAP B9, CLAUDE.md).

## Shared Patterns

### Fail-closed allow-list tier check
**Source:** RESEARCH.md Pattern 2 (server), mirrored in `fides-store.jsx` context `value` (client)
**Apply to:** `api/assistant.js`, `fides-store.jsx`
```js
const isPremium = plan === 'pro' || plan === 'family'; // NEVER `plan !== 'free'`
```
Both server and client must use the identical allow-list expression — a typo'd/unknown `plan` value must fall to free in both places (D-02).

### Error response shape (server) / error map dispatch (client)
**Source:** `api/assistant.js` (`res.status(code).json({ error: 'CODE', code })`), `fides-claude.jsx:friendlyError`, `fides-orcamento.jsx:friendlyAiError`
**Apply to:** all 3 files — new codes `FREE_MONTHLY_LIMIT` (429) and `PREMIUM_REQUIRED` (403) must be added to BOTH client error maps simultaneously (Pitfall 4) or one caller path (chat vs. Análise da IA) silently falls back to the generic error string.

### No native `confirm()`/`alert()`
**Source:** `assets/fides-ui.jsx:46-228` (`ConfirmDialog`/`useConfirm`/`useToast`)
**Apply to:** all new paywall/gate UI in `fides-claude.jsx`, `fides-orcamento.jsx`, `fides-studio.jsx`. Verification: grep negative for new `confirm(`/`alert(` calls in touched files before commit (per RESEARCH Validation Architecture Wave 0 gap).

### ES5 `React.createElement` vs JSX convention split
**Source:** observed directly — `fides-studio.jsx` uses `React.createElement(...)` (no JSX), `fides-claude.jsx`/`fides-metas.jsx` use JSX syntax.
**Apply to:** any new markup added to `fides-studio.jsx` MUST use `React.createElement`, not JSX, to match the file's existing Babel-standalone parse path; the other touched `.jsx` files may use JSX as they already do.

## No Analog Found

None — this phase is 100% composition of patterns that already exist verbatim in the same 6 files being modified, plus one net-new SQL migration for which two solid style/structure analogs exist in `supabase/`.

## Metadata

**Analog search scope:** `api/assistant.js`, `assets/fides-store.jsx`, `assets/fides-claude.jsx`, `assets/fides-orcamento.jsx`, `assets/fides-studio.jsx`, `assets/fides-metas.jsx`, `assets/fides-ui.jsx`, `supabase/schema.sql`, `supabase/wa-log-transaction.sql`
**Files scanned:** 9 (all read directly in this session, not from memory)
**Pattern extraction date:** 2026-07-14
