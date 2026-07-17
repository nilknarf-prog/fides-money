# Phase 16 — Painel admin/backoffice — RASCUNHO DE PLANO (decidido)

> **Status:** rascunho de input para `/gsd-plan-phase 16`. NÃO é o PLAN.md oficial.
> **Autoria:** rascunho gerado por Claude **Fable 5** (leu o código real), revisado por **Opus 4.8** contra o repositório, decisões travadas com o dono em **2026-07-16**.
> **Fonte da demanda:** [`painel-admin-backoffice.md`](painel-admin-backoffice.md) · **ROADMAP:** §Phase 16 (linhas 463-474).

---

## 0. Decisões travadas (dono, 2026-07-16)

| # | Decisão | Escolha | Consequência |
|---|---|---|---|
| 1a | Onde o painel vive | **Rota `/painel` no projeto atual** (`painel.html` isolado) | Deploy único; NÃO acopla à migração Vite/Next (B11); aceita mesma origem do app (mitigado: HTML isolado + storageKey próprio + conta dedicada + MFA). |
| 1b | Auth do admin | **Conta admin dedicada nova** + allowlist de UUID server-side (`ADMIN_USER_IDS`) | MFA TOTP entra logo após o MVP (16-07), não no MVP. Conta pessoal do dono NÃO é admin. |
| 1c | Escopo do MVP | **Listar contas + trocar tier + audit log** | Métricas/observabilidade viram fase 2 (16-05). Ações destrutivas (banir/excluir) ficam gateadas em B12/staging. |
| seq | Prioridade | **Phase 16 antes da Phase 14 (bot WhatsApp)** | Destrava os 5 UATs pendentes da Phase 13 + teste de tier free/pro sem SQL Editor. |

## 0.1 Verificação Opus 4.8 (rascunho validado contra o código real)

| Afirmação | Evidência | Status |
|---|---|---|
| `/painel` servível antes do catch-all | `vercel.json:12-23` — par `/teste → Fides-app.html` existe; catch-all `/((?!api/).*)` é o último rewrite | ✅ |
| `plan` só gravável por `service_role` (trava 13-02) | `supabase/profiles-plan-privileges.sql:43-45` — `revoke update ... from authenticated` + re-grant só `(name, group_targets)` | ✅ |
| `service_role` não usado hoje | grep: zero ocorrências em `api/` (só docs) — chave é nova, adicioná-la é checkpoint humano | ✅ |
| Guard reusa padrão existente | `api/assistant.js:205-227` — Bearer + `auth.getUser(token)` (WR-03) já em produção | ✅ |

**Reforços do Opus (acabamento):**
1. **Maior risco do produto:** introduzir `service_role` (ignora TODA a RLS) numa function serverless. Qualquer furo em `api/admin.js` = acesso total ao banco de todos os usuários. Guard à prova de balas + `security-reviewer` + `database-reviewer` obrigatórios.
2. **Mesma origem** (painel+app): storageKey separado ajuda mas não isola de vez; aceito conscientemente para MVP friends-and-family com conta dedicada + MFA.
3. **Auditar toda leitura** gera ruído no MVP: leituras SEMPRE logadas (ROADMAP exige "toda ação"), mas em linha leve — sem `before`/`after`/`reason`.

## 0.2 Revisão adversarial Fable 5 (sessão principal, 2026-07-16)

Confirmações novas contra o código (o que o Opus não tinha checado):

| Checagem | Evidência | Status |
|---|---|---|
| `family` é premium no app | `fides-store.jsx:1380` — `isPremium: userPlan === 'pro' \|\| userPlan === 'family'` | ✅ enum free/pro/family fecha ponta a ponta |
| CHECK de `plan` já existe no schema | `schema.sql:14` — `check (plan in ('free','pro','family'))` | ✅ validação da RPC é defesa em profundidade, não invenção |
| "Padrão do rate-limit do assistant" existe | `assistant.js:264-311` — `USER_DAILY_LIMIT=100` + `FREE_TIER_MONTHLY_LIMIT=10` via count | ✅ referência real |
| Convenção CommonJS | `assistant.js:7-9` — `require(...)` | ✅ |
| `uuid_generate_v4()` é a convenção | `schema.sql` — todas as tabelas usam | ✅ extensão presente (validar live, B10) |
| MVP = sugestão da própria demanda | `painel-admin-backoffice.md` §5 — "mínimo viável é provavelmente listar contas + trocar tier + audit log" | ✅ duplamente aterrado |

Ajustes aplicados nesta revisão: (M1) throttle de `denied_access` antecipado p/ 16-02 + chave de rate-limit corrigida (user/IP negado, não "por admin"); (M2) política de audit de leituras explicitada (linha leve, sempre logada); (M3) rotação de segredos (demanda §3E) adicionada ao backlog; (M4) 16-03 cita `/fides-config.js` explicitamente; (M5) fail-closed de `ADMIN_USER_IDS` vazio vira critério testável do 16-02.

## 0.3 Revisão adversarial Fable 5 — 2ª passada (2026-07-16, sessão de revisão dedicada)

Re-verificação independente: **todas** as evidências de 0.1/0.2 conferem contra o código atual (`vercel.json:12-23`, `profiles-plan-privileges.sql:43-45`, `assistant.js:205-311`, `fides-store.jsx:1380`, `schema.sql:14`, `inject-config.js`). Achados novos, todos já aplicados nas seções abaixo:

| # | Achado | Correção aplicada |
|---|---|---|
| M6 | RPCs SECURITY DEFINER do rascunho não fixavam `search_path` — convenção JÁ existente no projeto (`derived-balance.sql:14`, `wa-log-transaction.sql:23`, `schema.sql:209`) e mitigação padrão contra hijack de resolução de nomes | §2.2/§2.3 e 16-01 exigem `set search_path = public` nas duas RPCs |
| M7 | Guard sketch usava nomes genéricos de env (`SUPABASE_URL`/`ANON_KEY`); o projeto usa `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` (`assistant.js:218-219`, `inject-config.js:5-6`) | Sketch do guard corrigido p/ os nomes reais |
| M8 | `EXECUTE` de função plpgsql é concedido a `PUBLIC` por default — "grant só a service_role" **sem REVOKE explícito** deixaria `authenticated` executando `admin_set_plan` | §2.3 agora repete o bloco REVOKE/GRANT completo da §2.2 |
| M9 | Comparação da allowlist sensível a caixa/espaços (UUID colado com maiúsculas no env quebraria silencioso → 403 pro admin real) | Guard normaliza `trim().toLowerCase()` dos dois lados |
| M10 | Navegação interna: sem rewrite `/painel/(.*)`, F5 numa sub-rota cairia no catch-all (index.html do app) | Decidido: painel é single-page com abas por estado/hash — sem sub-paths; documentado em 16-03 |
| M11 | Sem proteção anti-clickjacking na rota `/painel` | 16-03 adiciona headers `X-Frame-Options: DENY` + `Referrer-Policy: no-referrer` p/ `/painel` no `vercel.json` |
| M12 | `admin_list_accounts` sem total de linhas → paginação da UI ficaria cega | RPC retorna `total_count` junto do page |

Pressuposto 8 rebaixado de "presumido" para **verificado**: `index.html:15` carrega supabase-js **v2** UMD do CDN; `auth.storageKey` é opção suportada do v2.

---

## 1. Arquitetura proposta

```
Browser (/painel → painel.html, entrada isolada)
  │  1. Login Supabase Auth (client próprio, storageKey 'fides-admin-auth')
  │  2. fetch /api/admin?action=... com Authorization: Bearer <JWT>
  ▼
api/admin.js  (Vercel Function, CommonJS — ÚNICO endpoint admin)
  │  guard SEMPRE antes do dispatch (api/_lib/admin/guard.js):
  │    a. extrai Bearer (401 se ausente)
  │    b. authClient(anon).auth.getUser(token) → user (401 se inválido)
  │    c. user.id ∈ ADMIN_USER_IDS (env) → senão 403 + audit 'denied'
  │    d. cria adminClient = createClient(url, SERVICE_ROLE_KEY) por request, persistSession:false
  │  dispatch por action (GET=reads, POST=mutações); toda action grava em admin_audit_log
  ▼
Supabase (service_role)
  ├─ RPC admin_list_accounts(...)   ← join auth.users + profiles + agregados
  ├─ RPC admin_set_plan(...)        ← UPDATE + INSERT audit na MESMA transação
  └─ admin_audit_log                ← RLS on, zero policies, REVOKE de anon/authenticated
```

Pontos-chave:
- **Um único `api/admin.js` roteador** (dispatch por `action`), handlers em `api/_lib/admin/*.js`. Guard roda ANTES do dispatch → impossível criar endpoint admin sem guard. Economiza slots do limite de functions (Hobby ~12; hoje só 2). Ponto único p/ `Cache-Control: no-store`.
- **Admin reverificado a cada request** (JWT + allowlist), no espírito fail-closed do `assistant.js` (13-03). Ordem load-bearing: 401 sem token → 401 inválido → 403 não-allowlisted (+audit denied) → só então instancia adminClient.
- **Mutações via RPC SECURITY DEFINER** (padrão `pay_card_invoice`/`wa_log_transaction`): atomicidade update+audit; validação (`plan IN ('free','pro','family')`) no banco.
- **Audit log no Postgres**, RLS on sem policies + `REVOKE ALL FROM anon, authenticated` (defesa dupla). Só service_role lê/escreve.
- **Trava 13-02 intacta**: `authenticated` continua sem UPDATE em `profiles.plan`; admin usa service_role (ignora column privileges por design). Nenhum REVOKE/GRANT do 13-02 alterado.
- **`vercel.json`**: `{ "source": "/painel", "destination": "/painel.html" }` ANTES do catch-all.
- **Front**: `painel.html` + `assets/fides-admin.jsx/.css`, React via Babel-standalone, `tokens.css` primeiro, client Supabase com `storageKey` próprio. Desktop-first.
- **Env novas (aba Project Vercel, checkpoint humano):** `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USER_IDS` (CSV de UUIDs). `inject-config.js` NÃO muda (nunca injetar essas no client).

Guard sketch (ordem exata importa p/ review):
```js
// api/_lib/admin/guard.js (CommonJS, não-roteável)
async function requireAdmin(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return { fail: { status: 401, error: 'JWT_MISSING' } };
  // Mesmos nomes de env do assistant.js:218-219 / inject-config.js:5-6 (M7)
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) return { fail: { status: 401, error: 'JWT_INVALID' } };
  // Normalização dos dois lados (M9): UUID com caixa/espaço divergente no env não pode dar 403 silencioso
  const allow = (process.env.ADMIN_USER_IDS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!allow.includes(data.user.id.toLowerCase())) {
    await auditDenied(data.user, req);            // best-effort, via service_role
    return { fail: { status: 403, error: 'FORBIDDEN' } };
  }
  const adminClient = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } });
  return { user: data.user, adminClient };
}
```

---

## 2. Modelo de dados / mudanças no Supabase

> Aplicar via MCP `apply_migration` + espelho novo `supabase/admin-backoffice.sql` (B10). **Introspectar o schema live** de `profiles`/`assistant_usage`/`auth.users` ANTES de escrever (pressupostos §5).

### 2.1 `admin_audit_log` (nova)
```sql
create table public.admin_audit_log (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid not null, admin_email text not null,
  action text not null,          -- 'set_plan'|'list_accounts'|'get_account'|'view_audit'|'denied_access'
  target_user uuid, before jsonb, after jsonb, reason text,
  ip text, user_agent text,
  status text not null default 'ok' check (status in ('ok','denied','error')),
  created_at timestamptz not null default now()
);
create index idx_admin_audit_created on public.admin_audit_log (created_at desc);
create index idx_admin_audit_target  on public.admin_audit_log (target_user, created_at desc);
alter table public.admin_audit_log enable row level security;   -- NENHUMA policy
revoke all on public.admin_audit_log from anon, authenticated;  -- defesa dupla
```

### 2.2 `admin_list_accounts` (nova — leitura em 1 round-trip)
SECURITY DEFINER + `set search_path = public` (convenção do projeto — `derived-balance.sql:14`; M6). Join `auth.users × profiles` + agregados (accounts/cards/goals/tx counts, `ai_msgs_month`). Params: `p_search`, `p_plan`, `p_limit=50`, `p_offset=0`; retorna também `total_count` p/ paginação (M12). `revoke execute ... from public, anon, authenticated; grant execute ... to service_role`. **Minimização LGPD:** retorna metadados/contagens, nunca lançamentos individuais.

### 2.3 `admin_set_plan` (nova — mutação atômica com audit)
SECURITY DEFINER plpgsql + `set search_path = public` (M6): valida `plan IN ('free','pro','family')`, `select ... for update`, `update profiles`, `insert admin_audit_log` na mesma transação, retorna jsonb `{target, before, after}`. Mesmo bloco completo `revoke execute ... from public, anon, authenticated; grant execute ... to service_role` da 2.2 — `EXECUTE` de plpgsql é `PUBLIC` por default, grant sozinho não trava (M8).
**Nota p/ security-reviewer:** a RPC **confia** em `p_admin_id/p_admin_email` → por isso GRANT exclusivo a service_role, único chamador é `api/admin.js` (preenche do JWT já verificado). `auth.uid()` é null no contexto service_role; NÃO usar como guard aqui.

### 2.4 NÃO muda
Policies RLS de `profiles`/`accounts`/etc.; REVOKE/GRANT do 13-02; `api/assistant.js` e RPCs existentes. Leituras auditadas simples = INSERT direto do serverless (um INSERT já é atômico; RPC só onde há update+audit juntos).

---

## 3. Breakdown em plans (estilo GSD)

**MVP = 16-01 → 16-04.** Caminho sensível em todos → `security-reviewer` + `database-reviewer` antes de commit.

- **16-01 — Fundação SQL (BLOCKING):** introspecção live via MCP → migração `admin_audit_log` + `admin_list_accounts` + `admin_set_plan` (REVOKE/GRANT service_role-only; ambas RPCs com `set search_path = public`, M6) + espelho `supabase/admin-backoffice.sql`. *Pronto:* objetos no live; `select` como `authenticated` falha; `execute` das RPCs como `authenticated` falha (M8); reviewers PASS.
- **16-02 — Guard + serverless:** `api/_lib/admin/guard.js` (401→401→403+denied→adminClient) + `api/admin.js` roteador (actions `whoami`/`accounts`/`audit`/`set_plan`), audit em toda action (leituras = linha leve, sem before/after), `no-store`. **Throttle de `denied_access` já aqui** (não esperar 16-04): count de negados do MESMO user/IP no último minuto antes do INSERT — anti-flood da tabela de audit (qualquer JWT válido pode martelar o endpoint desde o dia 1). **Checkpoint humano:** criar conta admin dedicada + setar `SUPABASE_SERVICE_ROLE_KEY` e `ADMIN_USER_IDS` na aba Project do Vercel. *Pronto (curl no deploy):* sem token→401; usuário comum→403 + linha `denied_access`; flood de negados não gera >N linhas/min; `ADMIN_USER_IDS` ausente/vazia → 403 para TODOS (fail-closed testado); admin→`whoami` 200; `set_plan` muda plan + audit na mesma transação; security-reviewer PASS. *(Nota p/ reviewer: CSRF é não-issue — auth por Bearer header, não cookies.)*
- **16-03 — Front `/painel` (MVP UI):** `painel.html` (isolado, tokens.css primeiro, carrega `/fides-config.js` — só URL + anon key, service_role JAMAIS chega ao client — e client Supabase c/ storageKey próprio) + `assets/fides-admin.jsx/.css` + rewrite `/painel` antes do catch-all. **Single-page com abas por estado/hash — sem sub-paths** (evita F5 caindo no catch-all sem precisar de rewrite `/painel/(.*)`; M10). Headers no `vercel.json` p/ `/painel`: `X-Frame-Options: DENY` + `Referrer-Policy: no-referrer` (M11). Telas: login; acesso negado; tabela de contas (e-mail, nome, badge plano, criado, último login, msgs IA/mês) c/ busca+filtro; ação "Alterar plano" (select + motivo obrigatório + confirmação); aba "Auditoria". **Direção visual: sketch aprovável em `.planning/sketches/painel-admin.html`** (mesma identidade do app via tokens.css, densidade desktop-first). *Pronto (E2E):* logar admin → ver contas reais → trocar free↔pro de conta teste → app reflete tier após F5 → ação aparece na Auditoria; usuário comum vê "acesso restrito".
- **16-04 — Hardening + LGPD + verificação:** rate-limit geral da superfície admin (chave = user/IP requisitante, padrão count do assistant.js:264-311); nota LGPD (base legal, minimização, retenção audit 2 anos); atualizar memória `testar-tier-free-pro` p/ apontar ao painel. *Pronto:* checklist segurança + `/gsd-verify-work 16` + os 5 UATs da Phase 13 executados via painel (dogfooding).

**Fase 2 (pós-MVP):** 16-05 Observabilidade/métricas (conecta AI-TELEM-01) · 16-06 Detalhe de conta (agregados) · 16-07 MFA TOTP (guard exige `aal2`).

**Backlog explícito (fora da 16; registrar no ROADMAP):** suspender/banir/reset senha/excluir conta via `auth.admin` (**gatear em B12/staging** — destrutivo; nota: até lá, pedidos LGPD de exclusão seguem via SQL Editor documentado) · aba billing (junto do M6) · `app_config` p/ caps/feature flags sem deploy · broadcast · rotação/gestão de segredos operacionais, ex.: `ASSISTANT_NONCE_SECRET` (demanda §3E).

---

## 4. Riscos / questões abertas (revisitar no plan-phase)
1. Retenção do audit log (dados pessoais): proposta 2 anos, expurgo manual. Confirmar.
2. Plano Vercel (Hobby vs Pro) — muda limite de functions e Deployment Protection. Assumido Hobby.
3. Rota `/painel` pública (mostra login) — obscuridade não é defesa; guard 403 é a defesa. Aceito.
4. Mesma origem painel/app — XSS futuro no app roda na origem do painel. Mitigações em camadas.
5. Sem staging (B12) — MVP só tem ação reversível (trocar plan); destrutivas gateadas.
6. `admin_set_plan` confia no chamador — security-reviewer valida: GRANT service_role-only, nenhum caminho client, guard preenche de JWT validado.

## 5. Pressupostos (validar via MCP antes de executar)
1. `profiles` live = `id, name, plan, created_at, group_targets`; **sem coluna `email`** (e-mail vive em `auth.users` → daí o join da RPC).
2. `assistant_usage` live tem `prompt_tokens/completion_tokens/latency_ms` (migração 11-03).
3. `SUPABASE_SERVICE_ROLE_KEY` não existe no código nem (presumido) no env Vercel hoje.
4. Schema `auth` não exposto via PostgREST (padrão Supabase) → leitura de e-mails via RPC SECURITY DEFINER.
5. Rewrites do `vercel.json` avaliados em ordem (o par `/teste` já depende disso).
6. Plano Vercel = Hobby. 7. Supabase Auth MFA TOTP disponível. 8. ~~presumido~~ **verificado (0.3):** `index.html:15` usa supabase-js v2 UMD do CDN; `auth.storageKey` é opção do v2. 9. Dono loga com `caduucomc@gmail.com` (conta admin será OUTRA). 10. Volume friends-and-family → paginação 50 + count() suficientes.
