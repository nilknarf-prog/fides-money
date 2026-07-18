# Phase 14: IA-4 Bot WhatsApp via Meta Cloud API — Mapa de Padrões

**Mapeado:** 2026-07-17
**Arquivos analisados:** 9 (novos/modificados)
**Analogs encontrados:** 8 / 9

## Classificação de Arquivos

| Arquivo novo/modificado | Papel | Fluxo de dados | Analog mais próximo | Qualidade do match |
|---|---|---|---|---|
| `api/whatsapp.js` | route/controller (webhook público) | event-driven + request-response | `api/assistant.js` (gate+rate-limit+Gemini) + `api/admin.js` (roteador fail-closed) | role-match forte (composição de 2 analogs) |
| `api/_lib/whatsapp/signature.js` | utility (HMAC) | transform | `api/_lib/nonce.js` (HMAC-SHA256 + `timingSafeEqual`) | exact (mesmo padrão criptográfico, adaptar de nonce assinado p/ verificação de assinatura externa) |
| `api/_lib/whatsapp/graph-api.js` | service (HTTP client externo) | request-response | `api/_lib/gemini.js` (`callModel`/`fetch` para API externa) | role-match |
| `api/_lib/whatsapp/parser-schema.js` | config (schema Gemini) | transform | Nenhum arquivo isolado hoje — schema fica inline em `api/assistant.js` (não há `buildToolsForPlan`/schema em arquivo próprio) | sem analog direto — usar Pattern 5 do RESEARCH.md como fonte |
| `supabase/wa-log-transaction-service.sql` | migration/RPC (service_role-only) | CRUD | `supabase/admin-backoffice.sql` (`admin_set_plan`, REVOKE/GRANT) + `supabase/wa-log-transaction.sql` (base funcional) | exact (composição: lógica de `wa_log_transaction` + padrão de segurança de `admin-backoffice.sql`) |
| `supabase/wa-schema.sql` | migration (DDL) | batch | `supabase/admin-backoffice.sql` (criação de tabela `admin_audit_log` com RLS+REVOKE) | role-match |
| `docs/whatsapp-lgpd.md` | doc (compliance) | — | `docs/admin-lgpd.md` | exact |
| `api/assistant.js` (fix WA-RATELIMIT-01) | controller (modificação pontual) | request-response | próprio arquivo — auditoria, não reescrita | exact (já resolvido, ver achado da pesquisa) |
| Perfil in-app — botão "Conectar WhatsApp" (arquivo `.jsx` a localizar, ex. `assets/fides-perfil.jsx` ou equivalente) | component | request-response | Nenhum botão premium-gated equivalente identificado nesta busca — planner deve grep por `isPremium`/`plan ===` em componentes de Perfil antes de escrever do zero | sem analog confirmado — ver "No Analog Found" |

## Pattern Assignments

### `api/whatsapp.js` (route/controller, event-driven + request-response)

**Analogs:** `api/assistant.js` (gate fail-closed + rate-limit) e `api/admin.js` (roteador CommonJS + dispatch por `action`/método)

**Imports pattern** (`api/assistant.js` linhas 1-12):
```javascript
const { createClient } = require('@supabase/supabase-js');
const gemini = require('./_lib/gemini');
const nonce = require('./_lib/nonce');

const { GEMINI_MODEL, GEMINI_ENDPOINT } = gemini;
const NONCE_SECRET = process.env.ASSISTANT_NONCE_SECRET;
```
Para `api/whatsapp.js`, replicar mais `const crypto = require('crypto');` e os novos helpers `./_lib/whatsapp/signature`, `./_lib/whatsapp/graph-api`.

**Handler shape CommonJS puro** (`api/admin.js` linhas 16-17, 60-61, 161-165):
```javascript
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  // ...
  try {
    switch (action) { /* ... */ }
  } catch (err) {
    console.error('[admin] unhandled error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
};
```
Para o webhook: raiz do handler faz dispatch por `req.method` (GET = handshake, POST = mensagem) em vez de `action`, mas a estrutura try/catch-raiz + `module.exports = async (req, res) => {}` é idêntica. **Regra do design (Pitfall 5 do RESEARCH.md): todo processamento (parse Gemini incluso) roda ANTES do `res.status(200)` — nunca responder cedo e processar depois.**

**Gate fail-closed (mesmo padrão a espelhar para premium/número desconhecido)** (`api/assistant.js` linhas 234-262):
```javascript
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
  console.error('[assistant] profile plan fetch exception', profileFetchErr);
  // fail-closed — plan permanece 'free'
}
const isPremium = plan === 'pro' || plan === 'family';

if (isAnalysisMode && !isPremium) {
  res.status(403).json({ error: 'PREMIUM_REQUIRED', code: 403 });
  return;
}
```
No webhook, a resolução é `phone → profiles.id → plan` (não JWT); o gate roda ANTES de qualquer chamada Gemini — mesmo princípio (WA-GATE-01).

**Rate-limit por contagem (padrão para caps CU-02, 30/dia + 300/mês do canal WhatsApp)** (`api/assistant.js` linhas 264-327):
```javascript
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
```
Mesmo padrão `count` fail-open (erro de leitura NUNCA bloqueia) — replicar para o cap diário e mensal do canal WhatsApp, com `channel='whatsapp'` (Pitfall 4 do RESEARCH.md) ou tabela irmã `wa_usage`.

**Padrão de rate-limit GERAL pós-guard (T-16-15, alternativa/reforço para o throttle do webhook, TE-03)** (`api/_lib/admin/guard.js` linhas 159-185):
```javascript
async function checkGeneralRateLimit(adminClient, user, req) {
  const ip = getClientIp(req);
  try {
    const windowStart = new Date(Date.now() - GENERAL_RATE_LIMIT_WINDOW_MS).toISOString();
    // ... count() sobre janela, fail-open no erro, 429 no estouro
  } catch (err) {
    console.error('[admin-guard] checkGeneralRateLimit exception (fail-open)', err);
    return { limited: false };
  }
}
```
Nota importante do fix `ratelimit-bypass-toolresults` aplicado no admin (`api/admin.js` linhas 41-58): **contar TODA requisição pós-guard, sucesso E falha**, para o throttle não ser burlável — mesmo princípio a aplicar no cap do canal WhatsApp.

**Erro/resposta 200-sempre-para-Meta:** nenhum analog interno cobre "sempre responder 200 mesmo em erro tratado" (webhook idempotente) — é um padrão NOVO desta fase, não copiar de `assistant.js`/`admin.js` (que retornam 4xx/5xx legitimamente). Ver Pattern 1 do RESEARCH.md.

---

### `api/_lib/whatsapp/signature.js` (utility, transform)

**Analog:** `api/_lib/nonce.js` (HMAC-SHA256 + `timingSafeEqual`, arquivo `_lib` não-roteável)

**Padrão completo** (`api/_lib/nonce.js` linhas 1-33):
```javascript
// api/_lib/nonce.js — CommonJS, não roteável (mesma convenção de _lib/gemini.js)
const crypto = require('crypto');

function verify(token, uid, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return false;
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;
  // ...
}

module.exports = { sign, verify };
```
Adaptar para `verifySignature(rawBody, signatureHeader, appSecret)` (ver Pattern 1 do RESEARCH.md, linhas 201-209) — mesmo princípio: `createHmac('sha256', secret)`, comparação com `timingSafeEqual` sobre buffers de mesmo tamanho, nunca `===` direto (mitigação de timing attack já documentada como padrão do projeto).

---

### `api/_lib/whatsapp/graph-api.js` (service, request-response)

**Analog:** `api/_lib/gemini.js` (`callModel`, chamada HTTP a serviço externo com `fetch`)

**Padrão de chamada externa + tratamento de erro** (`api/_lib/gemini.js` linhas 85-119):
```javascript
async function callModel(model, payload, apiKey, maxRetries) {
  const endpoint = endpointFor(model);
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const geminiRes = await fetch(`${endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (geminiRes.ok) {
      const data = await geminiRes.json();
      return { ok: true, status: geminiRes.status, errorCode: null, data };
    }

    const errBody = await geminiRes.text().catch(() => '');
    console.error(`[gemini] ${model} error (HTTP ${geminiRes.status}) attempt ${attempt}/${maxRetries}:`, errBody);
    // ... retry com backoff exponencial, classifyError(status)
  }
}
```
Módulo separado (`_lib/`, arquivo não roteável, mesmo prefixo `_` — comentário do próprio `gemini.js` linha 2 confirma a convenção). `graph-api.js` deve exportar `sendTextMessage(phoneNumberId, to, body, token)` (Pattern 3 do RESEARCH.md) — sem retry/fallback (a Graph API não tem o mesmo modelo de contingência dupla do Gemini), mas manter o retorno normalizado `{ok, status, ...}` como convenção do `_lib`.

---

### `supabase/wa-log-transaction-service.sql` (migration/RPC service_role-only, CRUD)

**Analogs:** `supabase/wa-log-transaction.sql` (lógica de negócio base, TE-01) + `supabase/admin-backoffice.sql` (padrão de segurança REVOKE/GRANT service_role-only)

**Lógica de negócio a herdar** (`supabase/wa-log-transaction.sql` linhas 10-95) — owner-guard, INSERT atômico, `recalc_account_balance`, incremento de `cards.used`. **Diferença obrigatória (TE-01):** trocar `v_uid := auth.uid()` (linha 26, NULL sob service_role) por `p_user_id uuid` explícito como parâmetro:
```sql
create or replace function public.wa_log_transaction(
  p_description text, p_value numeric, p_category text, p_date date,
  p_month text, p_status text, p_account_id uuid default null, p_card_id uuid default null
)
...
declare
  v_uid    uuid := auth.uid();   -- NULL no service_role — NÃO reusar às cegas
...
grant execute on function public.wa_log_transaction(...) to authenticated;  -- NÃO fazer isso na variante service_role-only
```

**Padrão de segurança REVOKE/GRANT a copiar literalmente** (`supabase/admin-backoffice.sql` linhas 126-127, 187-188):
```sql
revoke execute on function public.admin_list_accounts(text, text, int, int) from public, anon, authenticated;
grant  execute on function public.admin_list_accounts(text, text, int, int) to service_role;
```
Aplicar exatamente essa dupla linha para `wa_log_transaction_service(uuid, text, numeric, text, date, text, text, uuid, uuid)` — REVOKE explícito de `public, anon, authenticated` (M8: EXECUTE de plpgsql é PUBLIC por default) + GRANT só a `service_role`. Ver SQL completo já esboçado no RESEARCH.md, Pattern 4 (linhas 271-344) — pode ser copiado quase 1:1 para o plano.

---

### `supabase/wa-schema.sql` (migration DDL, batch)

**Analog:** `supabase/admin-backoffice.sql` (criação de `admin_audit_log` com RLS habilitado + zero policies + REVOKE)

**Padrão de tabela protegida (RLS + REVOKE) a espelhar para `wa_messages`/`wa_pending`/`wa_link_codes`** (`supabase/admin-backoffice.sql` linha 58, 61):
```sql
revoke all on public.admin_audit_log from anon, authenticated;  -- defesa dupla (V7.3)
grant select, insert on public.admin_audit_log to service_role;
```
Tabelas novas do webhook (`wa_messages` para dedupe `wamid`, `wa_pending` para confirmação D-1, `wa_link_codes` para opt-in) devem seguir o mesmo padrão: RLS on, zero policies para `anon`/`authenticated`, GRANT restrito a `service_role` (o único chamador é sempre `api/whatsapp.js`). Colunas novas em `profiles` (`phone`, `wa_linked_at`) seguem convenção de migração já documentada no CONTEXT.md: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` standalone (aprendizado 08-08) + `apply_migration` via MCP.

---

### `docs/whatsapp-lgpd.md` (doc, compliance)

**Analog:** `docs/admin-lgpd.md` (já ratificado pelo dono, Phase 16)

**Estrutura a espelhar** (seções do arquivo completo, linhas 1-48): `## 1. Base legal` (LGPD art. 7º) → `## 2. Minimização` (ASVS V7.1, dados mínimos coletados/retidos) → `## 3. Retenção` (prazo + expurgo manual, decisão do dono) → `## 4. Padrão seguido` (mapeamento ASVS V7) → `## 5. Direitos do titular` (art. 18). Para o WhatsApp, adaptar para: base legal = consentimento explícito (opt-in por `wa.me` + código de posse) em vez de legítimo interesse puro; minimização = `wa_messages`/`wa_pending` não armazenam conteúdo de mensagem além do necessário para dedupe/confirmação (checar contra CONTEXT.md WA-LGPD-01: "retenção 90d, opt-out"); retenção = 90 dias (já decidido no CONTEXT.md, diferente dos 2 anos do admin) + mecanismo de opt-out explícito.

---

### `api/assistant.js` — auditoria do fix WA-RATELIMIT-01 (não reescrever)

**Achado do RESEARCH.md (HIGH confidence, linhas 397-416):** o bypass estrutural do todo `ratelimit-bypass-toolresults.md` **já foi corrigido** no commit `9abd83e` (Phase 12-02). Código atual (`api/assistant.js` linhas 267-271):
```javascript
const hasToolResults = Array.isArray(toolResults) && toolResults.length > 0;
const nonceValid = hasToolResults && clientNonce && NONCE_SECRET
  ? nonce.verify(clientNonce, userId, NONCE_SECRET)
  : false;
const isFirstCallOfTurn = !hasToolResults || !nonceValid;
```
**Trabalho real desta fase (não é "implementar fix"):** (1) auditar/confirmar via teste manual que o bypass estrutural está fechado; (2) decidir se o gap residual de replay-de-nonce-dentro-do-TTL (120s, `api/_lib/nonce.js` linha 7) merece hardening; (3) fechar formalmente o todo `.planning/todos/pending/ratelimit-bypass-toolresults.md` (mover para `done/` ou reabrir com escopo revisado).

---

## Padrões Compartilhados

### Gate fail-closed (premium/allowlist)
**Fonte:** `api/assistant.js` linhas 234-262 (padrão `profiles.plan`) + `api/_lib/admin/guard.js` linhas 187-232 (`requireAdmin`, ordem load-bearing)
**Aplicar em:** `api/whatsapp.js` (gating premium antes de qualquer LLM, WA-GATE-01) — princípio: default fail-closed ('free'/negado), fonte de verdade sempre relida do banco, nunca confiar em estado do client/webhook payload.

### Rate-limit por contagem (fail-open na leitura, fail-closed no teto)
**Fonte:** `api/assistant.js` linhas 264-327; `api/_lib/admin/guard.js` linhas 144-185 (`checkGeneralRateLimit`)
**Aplicar em:** caps CU-02 do canal WhatsApp (30/dia, 300/mês) — `count()` sobre janela de tempo, erro de leitura NUNCA bloqueia (fail-open), estouro do teto retorna 429/resposta de limite (fail-closed). **Lição do fix de `api/admin.js` linhas 41-58: contar TODA requisição pós-guard (sucesso E falha), nunca só um subconjunto — evita reabrir o mesmo bypass já corrigido em 12-02.**

### HMAC + comparação constant-time
**Fonte:** `api/_lib/nonce.js` linhas 16-30 (`crypto.createHmac` + `crypto.timingSafeEqual`)
**Aplicar em:** `api/_lib/whatsapp/signature.js` (verificação de `X-Hub-Signature-256`) — nunca `===` direto entre strings de assinatura (timing side-channel), sempre buffers de mesmo tamanho antes do `timingSafeEqual`.

### RPC service_role-only (REVOKE explícito + GRANT restrito)
**Fonte:** `supabase/admin-backoffice.sql` linhas 126-127, 187-188 (`admin_list_accounts`, `admin_set_plan`)
**Aplicar em:** `wa_log_transaction_service` — `REVOKE EXECUTE ... FROM public, anon, authenticated` + `GRANT EXECUTE ... TO service_role`, sempre as duas linhas juntas (M8: EXECUTE de plpgsql é PUBLIC por default, esquecer o REVOKE é o erro mais provável).

### Handler CommonJS puro + try/catch raiz
**Fonte:** `api/admin.js` linhas 16-17, 60-61, 161-165; `api/assistant.js` linhas 192-198, 473-477
**Aplicar em:** `api/whatsapp.js` — `module.exports = async (req, res) => {}`, todo o corpo dentro de um `try` único com `catch` que loga e responde 500 (ou, no caso do webhook, 200 conforme Pitfall 5 do RESEARCH.md — nunca deixar a Meta reter em retry por erro tratado).

### Módulos `_lib/` não-roteáveis
**Fonte:** `api/_lib/gemini.js` linha 1-2 (comentário explica a convenção do prefixo `_`); `api/_lib/nonce.js` linha 1; `api/_lib/admin/guard.js` linha 1
**Aplicar em:** todo o diretório novo `api/_lib/whatsapp/` — nenhum arquivo lá deve ser chamável como Serverless Function, só importado por `api/whatsapp.js`.

## Arquivos Sem Analog Confirmado

| Arquivo | Papel | Fluxo de dados | Motivo |
|---|---|---|---|
| `api/_lib/whatsapp/parser-schema.js` | config | transform | Nenhum `responseSchema` isolado existe hoje no projeto — `api/assistant.js` usa `functionDeclarations` (function calling), não `responseSchema`/JSON mode. Usar Pattern 5 do RESEARCH.md (linhas 346-379) como fonte primária, não um analog de código existente. |
| Componente de Perfil "Conectar WhatsApp" (arquivo não localizado nesta busca) | component | request-response | Busca não confirmou um botão premium-gated equivalente nos arquivos `assets/*.jsx` lidos até agora. **Ação para o planner/executor:** `Grep` por `isPremium`/`plan === 'pro'`/`plan === 'family'` nos componentes de Perfil antes de escrever a UI do zero — pode existir um padrão de gating de UI (ex. botão de upgrade) reaproveitável mesmo que não tenha sido lido nesta sessão de mapeamento. |
| `res.status(200)` sempre-sucesso para a Meta (idempotência de webhook) | padrão comportamental, não arquivo | event-driven | Nenhum outro endpoint do projeto recebe webhook de terceiro com exigência de "sempre 200 mesmo em erro tratado, retry-safe" — é uma superfície nova (Pattern 1/Pitfall 5 do RESEARCH.md), não copiar dos handlers de erro de `assistant.js`/`admin.js` (que retornam 4xx/5xx legítimos ao cliente autenticado). |

## Metadados

**Escopo da busca de analogs:** `api/*.js`, `api/_lib/**/*.js`, `api/_lib/admin/*.js`, `supabase/*.sql`, `docs/*.md` (raiz do repositório).
**Arquivos lidos integralmente:** `api/assistant.js`, `api/_lib/gemini.js`, `api/_lib/nonce.js`, `api/_lib/admin/guard.js`, `api/admin.js`, `supabase/wa-log-transaction.sql`, `docs/admin-lgpd.md`, `vercel.json`; `supabase/admin-backoffice.sql` (trechos REVOKE/GRANT via grep direcionado).
**Data da extração de padrões:** 2026-07-17
**Nota:** grande parte da mecânica de implementação (payload Meta, HMAC em CommonJS puro, `responseSchema` Gemini) já vem com exemplos de código completos no `14-RESEARCH.md` (seção "Architecture Patterns", Patterns 1-5) — este PATTERNS.md complementa apontando os analogs REAIS do repositório para os padrões internos de segurança/rate-limit/RPC que o RESEARCH.md já identificou por nome mas não citou linha a linha.
