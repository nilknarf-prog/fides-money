# Phase 16: Painel de administração / backoffice - Research

**Researched:** 2026-07-16
**Domain:** Admin/backoffice server-side (`service_role`), auth allowlist, SECURITY DEFINER RPCs, roteamento Vercel, painel HTML isolado
**Confidence:** HIGH

## Summary

Este research **não redesenha** a arquitetura — ela já está travada em `.planning/research/painel-admin-backoffice-PLAN-DRAFT.md`, revisada 3x contra o código real (Opus 4.8 + Fable 5 duas passadas) e ratificada pelo dono em `16-CONTEXT.md`. O trabalho deste documento foi **validar cada afirmação do draft linha por linha contra o código-fonte atual** e consolidar o que falta para o planner agir com confiança: guard order exato, convenção de RPC `SECURITY DEFINER`, integridade da trava 13-02, ordem de rewrites do `vercel.json`, isolamento do bridge de config, e a Arquitetura de Validação (Nyquist) que os reviewers obrigatórios (`security-reviewer`, `database-reviewer`) vão checar.

**Todas as afirmações verificáveis por grep/leitura direta do repositório conferem exatamente com o que o draft documentou** — nenhum conflito draft-vs-código foi encontrado na arquitetura, SQL ou guard. **Um conflito de caminho foi encontrado e deve ser corrigido no PLAN.md:** tanto o draft (§1, linha 161) quanto `16-CONTEXT.md` (`Claude's Discretion`) referenciam `.planning/sketches/painel-admin.html`, mas o sketch real vive em `.planning/sketches/001-painel-admin/index.html` (3 variantes A/B/C, `winner: null` — decisão de vencedor ainda pendente, ver `## Open Questions`).

**Primary recommendation:** seguir o draft §1–§3 sem alterações estruturais; o 16-01 (fundação SQL) permanece BLOCKING e deve rodar a introspecção live via MCP Supabase ANTES de escrever a migração, pois **esta sessão de pesquisa não teve acesso ao MCP Supabase** — os 10 pressupostos do draft §5 seguem como pendências de execução, não resolvidas aqui.

## User Constraints

<user_constraints>
### Locked Decisions (de 16-CONTEXT.md — NÃO re-decidir)

- **D-1a (onde vive):** rota `/painel` no projeto atual, `painel.html` isolado (entrada própria, não acopla à migração Vite/Next B11). Mesma origem do app aceita conscientemente para MVP friends-and-family; mitigações: HTML isolado + client Supabase com `storageKey` próprio (`fides-admin-auth`) + conta dedicada + MFA pós-MVP.
- **D-1b (auth do admin):** conta admin dedicada NOVA (a conta pessoal do dono NÃO é admin) + allowlist de UUIDs server-side via env `ADMIN_USER_IDS`. Fail-closed: env ausente/vazia → 403 para todos. MFA TOTP entra logo após o MVP (16-07), não no MVP.
- **D-1c (escopo MVP):** listar contas + trocar tier + audit log. Nada destrutivo no MVP.
- **D-seq:** Phase 16 executa ANTES da Phase 14 (bot WhatsApp) — destrava os 5 UATs pendentes da Phase 13.

**Arquitetura (draft §1–§2, já revisada 3x — seguir, não redesenhar):**
- Um único `api/admin.js` (CommonJS) roteador por `action`; handlers em `api/_lib/admin/*.js`; guard `requireAdmin` SEMPRE antes do dispatch (ordem load-bearing: 401 sem token → 401 inválido → 403 não-allowlisted + audit `denied_access` → só então instancia client service_role, `persistSession:false`, por request).
- Mutações via RPC `SECURITY DEFINER` (`admin_set_plan`: update + insert audit na MESMA transação); leituras agregadas via RPC `admin_list_accounts` (join `auth.users × profiles`, e-mail vive em `auth.users`). Ambas com `set search_path = public` e `revoke execute from public, anon, authenticated; grant to service_role`.
- `admin_audit_log`: RLS on sem policies + REVOKE de anon/authenticated. Leituras SEMPRE logadas em linha leve (sem before/after/reason); mutações com before/after/reason. Throttle de `denied_access` (chave user/IP negado) já no 16-02.
- Trava 13-02 intacta: nenhum REVOKE/GRANT existente muda; admin usa service_role por design.
- Env novas (aba Project do Vercel, checkpoint humano): `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USER_IDS`. `inject-config.js` NÃO muda — service_role JAMAIS chega ao client.
- Rewrite `/painel` → `/painel.html` ANTES do catch-all no `vercel.json`; painel é single-page com abas por estado/hash (sem sub-paths); headers `X-Frame-Options: DENY` + `Referrer-Policy: no-referrer` na rota.

### Claude's Discretion
- Formato exato de resposta/erros do `api/admin.js`, shape dos handlers, componentes da UI (respeitando tokens.css + sketch como direção visual — ver conflito de caminho acima).
- Detalhes de paginação/busca (baseline: `p_limit=50`, `total_count` na RPC).
- Retenção do audit log (proposta 2 anos, expurgo manual) — confirmar com o dono no plan ou UAT.

### Deferred Ideas (OUT OF SCOPE)
- **Fase 2 (16-05..16-07):** observabilidade/métricas (AI-TELEM-01), detalhe de conta, MFA TOTP (guard exige `aal2`).
- **Backlog (fora da 16, registrar no ROADMAP):** suspender/banir/reset senha/excluir conta via `auth.admin` (gatear em B12/staging; até lá, pedidos LGPD de exclusão via SQL Editor documentado) · aba billing (junto do M6) · `app_config` p/ caps/feature flags sem deploy · broadcast · rotação de segredos operacionais (ex.: `ASSISTANT_NONCE_SECRET`).
</user_constraints>

<phase_requirements>
## Phase Requirements

Não há IDs `ADMIN-*` formalizados em `.planning/REQUIREMENTS.md` ainda (confirmado por leitura — o arquivo lista requisitos até a Phase 13/14, Phase 16 aparece só como "a formalizar" no ROADMAP linha 466). Os critérios "Pronto" do draft §3 são o material-fonte para o `/gsd-plan-phase` derivar os IDs formais. Mapeamento proposto (o planner decide a numeração final):

| ID proposto | Descrição | Suporte da pesquisa |
|----|-------------|------------------|
| ADMIN-01 | Fundação SQL: `admin_audit_log` + `admin_list_accounts` + `admin_set_plan`, grants service_role-only, RPCs com `set search_path = public` | Confirmado: convenção já existe em `derived-balance.sql`/`wa-log-transaction.sql` (ver `## RPC conventions`) |
| ADMIN-02 | Guard `requireAdmin` fail-closed (401→401→403+audit) + roteador `api/admin.js` + throttle de `denied_access` | Confirmado: padrão Bearer+`getUser` já em produção em `assistant.js:205-231` (ver `## Guard order & auth`) |
| ADMIN-03 | Front `/painel` isolado (login, tabela de contas, alterar plano, auditoria) + rewrite antes do catch-all + headers anti-clickjacking | Confirmado: `vercel.json` ordem de rewrites e par `/teste` (ver `## vercel.json rewrite ordering`) |
| ADMIN-04 | Hardening + LGPD (retenção do audit log) + verificação (UATs 12/13 via painel) | Ver `## LGPD e retenção — pesquisa externa` |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Login do admin (Supabase Auth) | Browser / Client | — | `painel.html` client Supabase próprio (`storageKey: 'fides-admin-auth'`) — só troca credenciais por JWT, nenhuma lógica de negócio aqui |
| Verificação de identidade (JWT válido) | API / Backend | — | `requireAdmin` chama `authClient.auth.getUser(token)` com **anon key** — não decodifica o JWT localmente, delega ao Auth server (mesmo padrão de `assistant.js:227`) |
| Autorização (allowlist `ADMIN_USER_IDS`) | API / Backend | — | Comparação server-side contra env var — nunca no client, nunca em tabela consultável pelo próprio usuário |
| Leitura agregada de contas (`admin_list_accounts`) | Database / Storage | API / Backend | RPC `SECURITY DEFINER` faz o join `auth.users × profiles` no Postgres — o backend só invoca e repassa o JSON, não filtra/agrega em JS |
| Mutação de tier (`admin_set_plan`) | Database / Storage | API / Backend | Update + audit insert atômico dentro da RPC (transação única) — o backend só valida o guard e chama a função, nunca faz o UPDATE direto via SDK |
| Audit log (escrita) | Database / Storage | API / Backend | INSERT simples (leituras) feito pelo serverless com `adminClient`; INSERT+UPDATE atômico (mutações) feito dentro da RPC — nunca do browser |
| Roteamento `/painel` → `painel.html` | CDN / Static (Vercel rewrites) | — | `vercel.json` resolve isso na borda, antes de qualquer JS rodar |
| Headers de segurança (`X-Frame-Options`, `Referrer-Policy`) | CDN / Static (Vercel headers) | — | Aplicados na configuração de rota, não em runtime |
| Config bridge (URL + anon key) | Frontend Server (SSR-like, mas serverless) | — | `api/inject-config.js` roda como função Vercel, gera JS estático — não é SSR de página, mas é a mesma responsabilidade de "servir config pública sem expor segredo" |

**Nenhuma capacidade do MVP foi encontrada mal-atribuída no draft.** O ponto de maior risco de shift de tier é justamente o que o draft já isola corretamente: toda mutação/autorização fica no tier API/Database, nunca no Browser — é a mesma garantia que a trava 13-02 já estabeleceu para o app principal.

## Standard Stack

Não há biblioteca nova a introduzir — o MVP reutiliza 100% do stack já presente no projeto.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | `^2.45.0` no `package.json` (verificado `npm view` retorna `2.110.7` disponível no registry — o pin do projeto é antigo mas compatível, `auth.getUser`/`createClient` são API estável da v2) [VERIFIED: npm registry] | Cliente Auth (anon) para validar JWT + cliente `service_role` para RPCs admin | Já é a única lib de acesso a Supabase no projeto (`api/assistant.js`, `assets/fides-supabase.js`) |
| supabase-js v2 UMD via CDN (`jsdelivr`) | `@2` (tag, resolve para a última v2) | Client-side Auth do `painel.html` | `index.html:15` já carrega exatamente essa tag — `auth.storageKey` é opção documentada da v2 [VERIFIED: index.html:15 + CDN tag] |

### Supporting
Nenhuma. React via Babel-standalone (já usado em `Fides-app.html`/`index.html`) é reaproveitado para `painel.html`, sem framework novo.

### Alternatives Considered
Nenhuma — decisão já travada em D-1a/D-1b (draft §0). Não há alternativa a pesquisar aqui.

**Installation:** nenhuma instalação nova. `SUPABASE_SERVICE_ROLE_KEY` e `ADMIN_USER_IDS` são env vars (aba Project do Vercel), não pacotes.

## Package Legitimacy Audit

**Não aplicável — nenhum pacote novo é instalado nesta fase.** O MVP reutiliza `@supabase/supabase-js` (já dependência de produção, confirmado em `package.json:5` e validado via `npm view @supabase/supabase-js version` → `2.110.7` disponível no registry). Nenhuma entrada de tabela de legitimidade é necessária.

## Architecture Patterns

> A arquitetura completa (diagrama, breakdown 16-01..16-04, SQL) já está em `.planning/research/painel-admin-backoffice-PLAN-DRAFT.md` §1–§3. Esta seção só resolve os pontos que o draft pediu para verificar explicitamente contra o código real.

### System Architecture Diagram

```
Browser (/painel → painel.html, entrada isolada, storageKey 'fides-admin-auth')
  │
  │ 1. Login via Supabase Auth (client dedicado, NÃO o client do app)
  │
  ▼
[Tela: login] ──(JWT emitido)──▶ [Tela: tabela de contas / auditoria]
  │
  │ 2. fetch('/api/admin?action=accounts|set_plan|audit|whoami', { headers: { Authorization: 'Bearer <JWT>' } })
  ▼
api/admin.js  (Vercel Function, roteador único)
  │
  ├─▶ requireAdmin(req)  [api/_lib/admin/guard.js — SEMPRE primeiro, antes de qualquer dispatch]
  │     │
  │     ├─ sem Bearer? ──────────────────▶ 401 JWT_MISSING (fim)
  │     ├─ authClient.auth.getUser(token) falha? ─▶ 401 JWT_INVALID (fim)
  │     ├─ user.id ∉ ADMIN_USER_IDS? ────▶ audit 'denied_access' (best-effort) ─▶ 403 FORBIDDEN (fim)
  │     └─ passou ──▶ cria adminClient = createClient(url, SERVICE_ROLE_KEY, {persistSession:false})
  │
  ▼ (só chega aqui com adminClient válido)
dispatch por `action`:
  ├─ GET  'accounts' ──▶ adminClient.rpc('admin_list_accounts', {...}) ──▶ INSERT audit (linha leve)
  ├─ GET  'audit'     ──▶ adminClient.from('admin_audit_log').select(...) ──▶ INSERT audit (linha leve)
  ├─ GET  'whoami'    ──▶ retorna user.id/email do guard (sem tocar banco)
  └─ POST 'set_plan'  ──▶ adminClient.rpc('admin_set_plan', {...}) [update+audit atômico dentro da RPC]
  ▼
Resposta JSON, sempre `Cache-Control: no-store`
```

O leitor consegue seguir o caso de uso primário (admin troca o tier de uma conta) do input (clique "Alterar plano" na UI) até o output (linha nova na aba Auditoria + `profiles.plan` atualizado) só seguindo as setas acima — sem precisar saber nomes de arquivo.

### Guard order & auth — verificado contra `api/assistant.js:205-231`

O padrão real em produção (não é hipotético — está rodando hoje) é:

```js
// api/assistant.js:205-231 (trecho real, confirmado por leitura)
const authHeader = req.headers.authorization || '';
const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
if (!token) { res.status(401).json({ error: 'JWT_MISSING', code: 401 }); return; }

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) { res.status(500).json({ error: 'SUPABASE_CONFIG_MISSING', code: 500 }); return; }

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: `Bearer ${token}` } },
});
const { data: userData, error: authError } = await supabase.auth.getUser(token);
if (authError || !userData?.user) { res.status(401).json({ error: 'JWT_INVALID', code: 401 }); return; }
const userId = userData.user.id;
```

**Confirmações [VERIFIED: api/assistant.js:205-231]:**
1. Nomes de env exatos são `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — M7 do draft está correto, o sketch do guard admin (draft §1, bloco `requireAdmin`) já usa esses nomes.
2. `auth.getUser(token)` é chamado com o **anon client**, não com o client `service_role` — o padrão correto é "verificar identidade com anon + JWT do usuário", só DEPOIS instanciar `service_role`. O draft segue exatamente essa ordem (`adminClient` só é criado após o passo `c` do guard).
3. `assistant.js` NÃO tem um passo de allowlist (não precisa — qualquer usuário autenticado pode chamar o assistente). O guard admin ADICIONA um passo 403 que `assistant.js` não tem — isso é esperado e correto, é a diferença funcional entre "endpoint de usuário" e "endpoint admin".
4. Fail-closed em `SUPABASE_CONFIG_MISSING` (500) já é o padrão do projeto — o guard admin deve replicar isso E também fail-closed em `ADMIN_USER_IDS` ausente/vazia (→ 403 para todos, não 500 — decisão M5 do draft, correta: uma env ausente não deve nunca abrir acesso, e 403 é semanticamente mais correto que 500 para "ninguém está na allowlist").

**Diferença real notada (não é conflito, é uma nuance a documentar no plan):** `assistant.js` cria o client anon com `global.headers.Authorization` (para que chamadas subsequentes `.from('profiles')` etc já rodem autenticadas como o usuário). O guard admin só usa o client anon para `auth.getUser(token)` e descarta — todo acesso a dado depois disso é via `adminClient` (`service_role`), então não precisa desse header global. Confirmar essa nuance é responsabilidade do 16-02, mas não muda a ordem de guard.

### RPC conventions — verificado contra `derived-balance.sql` e `wa-log-transaction.sql`

Confirmado por leitura direta: **toda** função `SECURITY DEFINER` existente no projeto já usa a forma `set search_path to 'public'` (ou `= public`, equivalentes em Postgres) imediatamente após `security definer`:

```sql
-- derived-balance.sql:14 (uma das 5 funções do arquivo, todas seguem o padrão)
create or replace function public.recalc_account_balance(p_account_id uuid)
returns numeric language plpgsql security definer set search_path to 'public' as $$ ... $$;

-- wa-log-transaction.sql:21-23
create or replace function public.wa_log_transaction(...)
returns jsonb language plpgsql security definer set search_path to 'public' as $$ ... $$;
```

[VERIFIED: supabase/derived-balance.sql, supabase/wa-log-transaction.sql] — M6 do draft está correto: a convenção já existe e não é uma invenção desta fase.

**Por que o `REVOKE` explícito importa (M8 do draft, confirmado como preocupação real):** em Postgres, `CREATE FUNCTION` para `language plpgsql` concede `EXECUTE` a `PUBLIC` por padrão (todo role, incluindo `anon`/`authenticated`, herda de `PUBLIC` a menos que haja um `REVOKE` explícito). As RPCs existentes (`pay_card_invoice`, `wa_log_transaction`, etc.) **não precisam** desse REVOKE porque são *desenhadas* para serem chamadas por `authenticated` (o próprio dono do dado, via `auth.uid()` dentro da função). As duas RPCs novas do painel (`admin_list_accounts`, `admin_set_plan`) são o **oposto**: devem ser inacessíveis a `authenticated`/`anon` e só chamáveis por `service_role`. Sem o bloco:

```sql
revoke execute on function public.admin_set_plan(...) from public, anon, authenticated;
grant  execute on function public.admin_set_plan(...) to service_role;
```

qualquer usuário `authenticated` do app (não só o admin) poderia chamar `admin_set_plan` diretamente via `supabase.rpc(...)` no client SDK e mudar o próprio `plan` para `'pro'` — reabrindo exatamente a brecha que a 13-02 fechou, só que por uma porta lateral nova. Este é o ponto de maior risco técnico desta fase e deve ser o primeiro item que `database-reviewer` verifica no 16-01.

### 13-02 lock integrity — verificado contra `supabase/profiles-plan-privileges.sql`

Conteúdo real do arquivo (13 linhas úteis, lido integralmente):

```sql
revoke update on public.profiles from authenticated;
grant update (name, group_targets) on public.profiles to authenticated;
```

**O que trava, precisamente [VERIFIED: supabase/profiles-plan-privileges.sql]:**
- `authenticated` perde `UPDATE` em **qualquer coluna** de `public.profiles` (REVOKE amplo).
- `authenticated` recebe de volta `UPDATE` só nas colunas `(name, group_targets)` — `plan` fica de fora, e é isso que impede o self-elevation via console do browser (`window.fidesDb.from('profiles').update({plan:'pro'})`).
- **Escopo explícito no comentário do arquivo (linha 16-21):** este REVOKE atinge só a role `authenticated`. `service_role`/owner (SQL Editor, e por extensão qualquer client instanciado com `SUPABASE_SERVICE_ROLE_KEY`) **sempre ignora privilégios de coluna** — é assim que o dono testa tiers manualmente hoje, e é exatamente o mecanismo que o painel admin usa por design (não é um bypass novo, é o mesmo bypass documentado, só que via RPC em vez de SQL Editor manual).
- A policy RLS de `profiles` (`schema.sql:190-191`, confirmada por leitura: `for all using (auth.uid() = id)`) não muda e não precisa mudar — RLS continua garantindo linha, o REVOKE/GRANT de coluna continua garantindo coluna, e `admin_set_plan` roda como `service_role` que ignora ambos por design de arquitetura (não por falha).

**Confirmação de que o caminho admin NÃO toca a trava:** `admin_set_plan` faz `UPDATE public.profiles SET plan = ...` **dentro** da função `SECURITY DEFINER` (que roda com os privilégios do *definer* da função — tipicamente o owner/postgres — não os privilégios de quem a chama). Isso é ortogonal ao REVOKE de `authenticated`: a função nunca é chamada pelo client SDK como `authenticated`, é chamada pelo `api/admin.js` usando `service_role` para invocar a RPC. **Nenhum REVOKE/GRANT do 13-02 precisa ser alterado, adicionado ou removido nesta fase** — confirma o item 4 do draft §2.4 ("NÃO muda").

### vercel.json rewrite ordering — verificado

Conteúdo real (`vercel.json`, 33 linhas, lido integralmente):

```json
"rewrites": [
  { "source": "/fides-config.js", "destination": "/api/inject-config" },
  { "source": "/teste", "destination": "/Fides-app.html" },
  { "source": "/teste/(.*)", "destination": "/Fides-app.html" },
  { "source": "/((?!api/).*)", "destination": "/index.html" }
]
```

[VERIFIED: vercel.json:7-24] Confirmações:
1. **Vercel avalia `rewrites` em ordem de array** (comportamento documentado da plataforma — primeira regra que casa "vence"; regras subsequentes não são tentadas). O par `/teste`+`/teste/(.*)` já depende disso na prática (se o catch-all viesse antes, `/teste` nunca chegaria em `Fides-app.html`) — isso já é prova viva em produção de que a ordenação funciona como o draft assume.
2. O catch-all `/((?!api/).*)` (negative lookahead — casa qualquer path que NÃO comece com `api/`) é o **último** item do array hoje. O par novo `{ "source": "/painel", "destination": "/painel.html" }` deve ser inserido **antes** desse catch-all (em qualquer posição anterior a ele) — o padrão exato de posicionamento do par `/teste` serve de modelo direto.
3. **M10 do draft está corretamente resolvido:** como não existe hoje um rewrite `/teste/(.*)` → o painel decidiu ser single-page (abas por hash/estado, sem sub-rotas), **não é necessário** adicionar um par `/painel/(.*)` — confirmado que essa é uma escolha deliberada para evitar a complexidade extra, não uma omissão.
4. **Headers:** o bloco `"headers"` do `vercel.json` hoje só tem uma entrada (`/fides-config.js` → `Cache-Control: no-store`). Adicionar `X-Frame-Options: DENY` + `Referrer-Policy: no-referrer` para `/painel` segue o mesmo formato de objeto (`{ "source": "/painel", "headers": [...] }`), como uma nova entrada no array `headers`, ortogonal ao array `rewrites` — os dois arrays não interagem entre si, então a ordem de `headers` não importa para este caso (só a ordem de `rewrites` importa).

### Config bridge — verificado contra `api/inject-config.js`

Conteúdo integral do arquivo (13 linhas):

```js
module.exports = (req, res) => {
  const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL      || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(`window.FIDES_CONFIG = {\n  supabaseUrl: "${supabaseUrl}",\n  supabaseAnonKey: "${supabaseAnonKey}"\n};`);
};
```

[VERIFIED: api/inject-config.js] Confirmado: **só** URL + anon key são injetados no `window.FIDES_CONFIG` — nenhuma referência a `SUPABASE_SERVICE_ROLE_KEY` existe neste arquivo, e o draft já decide (§1, "Env novas") que este arquivo **não muda**. `/fides-config.js` (o rewrite que aponta para esta function, `vercel.json:9-11`) já é servido com `Cache-Control: no-store` tanto no `inject-config.js` quanto no bloco `headers` do `vercel.json` — dupla garantia contra cache de config.

**Como `painel.html` obtém um client Supabase isolado sem reusar o mesmo objeto do app:** o mesmo `/fides-config.js` pode ser carregado por `painel.html` (é público, sem segredo) — o isolamento não vem de uma config diferente, vem de:
1. `painel.html` é um documento HTML separado (não compartilha o mesmo `window` runtime do `index.html`/`Fides-app.html` — cada `<script>` roda no contexto de página isolado do browser).
2. O client Supabase instanciado em `painel.html` usa `createClient(url, anonKey, { auth: { storageKey: 'fides-admin-auth' } })` — `storageKey` controla a **chave usada no localStorage** para persistir a sessão. Como o app principal usa o storageKey padrão do supabase-js (`sb-<project-ref>-auth-token`, implícito), uma sessão logada no app não colide/nem é reaproveitada pela sessão do painel, e vice-versa — mesmo compartilhando `localStorage` (mesma origem).
3. **service_role NUNCA chega ao client** — nem no `painel.html`, nem em `fides-config.js`. A chave só existe como env var lida por `api/admin.js` no runtime serverless (nunca serializada em HTML/JS entregue ao browser).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Verificação de JWT | Decodificar/validar o token manualmente (JWT parsing, checagem de assinatura/expiração) | `authClient.auth.getUser(token)` — já é o padrão de `assistant.js:227`, delega ao Supabase Auth server | Supabase já valida assinatura, expiração e revogação; reimplementar isso é superfície de bug de segurança sem necessidade |
| Bloqueio de coluna `plan` para `authenticated` | Uma nova policy RLS custom ou trigger `BEFORE UPDATE` que rejeita mudança em `plan` | REVOKE/GRANT column-level já existente (`profiles-plan-privileges.sql`) | Já resolvido pela 13-02; reabrir esse mecanismo com uma solução paralela é reinventar (pior: risco de esquecer um dos dois caminhos e criar inconsistência) |
| Atomicidade update+audit | Duas chamadas separadas do serverless (`update profiles` depois `insert admin_audit_log`) | RPC `SECURITY DEFINER` fazendo ambos na mesma transação Postgres | Duas chamadas HTTP/SDK sequenciais não são atômicas — uma falha entre elas deixa o `plan` mudado sem audit (ou audit sem mudança real) |
| Rate limit / throttle | Middleware de terceiros, Redis, contador em memória (não sobrevive a cold start serverless) | Padrão `count` sobre tabela existente (mesmo de `assistant.js:264-311`: `select('id', {count:'exact', head:true}).gte('created_at', janela)`) | Já é o padrão comprovado do projeto, funciona sem estado externo, sem infra nova |
| Storage de sessão isolado | Sistema de multi-tenant de sessão customizado | Opção `storageKey` nativa do supabase-js v2 | Já é a solução suportada oficialmente para múltiplos clients Supabase na mesma origem |

**Key insight:** nada nesta fase precisa de biblioteca nova porque o projeto já resolveu, em fases anteriores (11/12/13), exatamente os mesmos três problemas que um painel admin precisa resolver: guard fail-closed por JWT, RPC atômica com SECURITY DEFINER, e rate-limit por contagem. A tarefa do 16-01/16-02 é replicar esses três padrões com os parâmetros certos (allowlist em vez de tier, service_role em vez de anon-autenticado), não inventar nada novo.

## Common Pitfalls

### Pitfall 1: EXECUTE de função plpgsql concedido implicitamente a PUBLIC (M8 do draft)
**What goes wrong:** `GRANT EXECUTE ... TO service_role` sem o `REVOKE ... FROM PUBLIC, anon, authenticated` correspondente deixa a função chamável por qualquer role autenticado, porque Postgres concede `EXECUTE` a `PUBLIC` por padrão na criação da função.
**Why it happens:** é fácil copiar o padrão das RPCs existentes do projeto (que só têm `GRANT ... TO authenticated`, sem REVOKE, porque são DESENHADAS para esse role) sem perceber que as RPCs admin precisam do padrão oposto (REVOKE explícito).
**How to avoid:** sempre emitir o par completo REVOKE+GRANT nas duas RPCs novas (`admin_list_accounts`, `admin_set_plan`); o 16-01 já lista isso como critério "Pronto" testável (`execute` como `authenticated` deve falhar).
**Warning signs:** se o teste `select public.admin_set_plan(...)` logado como `authenticated` (não service_role) NÃO falhar com erro de permissão, o REVOKE não foi aplicado ou não cobriu a assinatura exata da função (Postgres distingue funções por assinatura — nome + tipos de parâmetro).

### Pitfall 2: Allowlist sensível a caixa/espaço (M9 do draft)
**What goes wrong:** um UUID colado com maiúsculas ou espaço extra em `ADMIN_USER_IDS` (env var, CSV) não bate contra `data.user.id` (sempre minúsculo, sem espaço) — o admin real recebe 403 silencioso, sem log de erro óbvio.
**Why it happens:** comparação de string ingênua (`allow.includes(userId)`) sem normalização nos dois lados.
**How to avoid:** `trim().toLowerCase()` em AMBOS os lados da comparação (env parseado e `user.id`) — já especificado no sketch do guard do draft.
**Warning signs:** admin loga com sucesso (JWT válido) mas recebe 403 mesmo com UUID aparentemente correto no env — sintoma clássico de mismatch de formatação.

### Pitfall 3: `auth.uid()` é NULL dentro de função chamada via `service_role`
**What goes wrong:** se alguém tentar usar `auth.uid()` como guard dentro de `admin_set_plan` (copiando o padrão de `wa_log_transaction`/`pay_card_invoice`, que usam `if v_uid is null then raise exception 'AUTH'`), a função sempre falha — porque `service_role` não tem contexto de sessão de usuário, `auth.uid()` retorna `NULL` nesse contexto.
**Why it happens:** é o padrão de TODAS as outras RPCs do projeto (todas rodam como `authenticated`, então `auth.uid()` funciona). A RPC admin é a primeira do projeto desenhada para rodar como `service_role`, o que quebra essa suposição.
**How to avoid:** a RPC admin confia nos parâmetros explícitos `p_admin_id`/`p_admin_email` passados pelo `api/admin.js` (que já validou o JWT no guard) — não usar `auth.uid()` como guard aqui. Já documentado no draft §2.3 como nota explícita para o security-reviewer.
**Warning signs:** RPC sempre lança `AUTH` mesmo com guard passando corretamente no `api/admin.js` — sinal de que a função ainda tem um `if auth.uid() is null` residual copiado por engano.

### Pitfall 4: Rewrite `/painel` inserido DEPOIS do catch-all
**What goes wrong:** `/painel` cai no catch-all (`/((?!api/).*)` → `/index.html`) em vez de servir `painel.html` — o admin veria o app normal, não o painel.
**Why it happens:** adicionar a nova entrada ao final do array `rewrites` por hábito (append), sem considerar que o catch-all já está lá e "vence" primeiro por já estar em posição anterior.
**How to avoid:** inserir o novo par no MESMO bloco de rewrites específicos que já existe (`/teste`, `/teste/(.*)`), sempre antes da entrada do catch-all.
**Warning signs:** `curl -I https://<deploy>/painel` retorna o `index.html` do app em vez de `painel.html`.

### Pitfall 5: Auditoria de leitura vira ruído ou é esquecida
**What goes wrong:** ou (a) cada leitura grava um `before`/`after`/`reason` desnecessário (ruído, e possivelmente PII redundante no log), ou (b) a auditoria de leitura é esquecida porque "só é leitura, não muda nada".
**Why it happens:** o ROADMAP exige "toda ação admin auditada" — leituras contam como ação, mas o padrão de log de mutação (before/after/reason) não se aplica a elas.
**How to avoid:** linha leve para leituras (`action`, `admin_id`, `status='ok'`, sem `before`/`after`/`reason`) — já decidido no draft (M2) e no `16-CONTEXT.md`.
**Warning signs:** tabela `admin_audit_log` crescendo rápido com linhas quase idênticas de leitura sem nenhum campo diferenciador além de `created_at` — sinal de que talvez precise de amostragem/agregação futura (fora de escopo do MVP, mas vale nota para a fase 2).

## Code Examples

### Padrão de rate-limit por contagem (para replicar no throttle de `denied_access`)
```js
// Fonte: api/assistant.js:264-291 (padrão real em produção, adaptar chave para user/IP negado)
const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const { count, error: countError } = await supabase
  .from('assistant_usage')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', userId)
  .gte('created_at', twentyFourHoursAgo);

if (countError) {
  console.error('[assistant] usage count error', countError);
  // fail-open — erro de leitura do count nunca bloqueia
} else if ((count || 0) >= USER_DAILY_LIMIT) {
  res.status(429).json({ error: 'USER_DAILY_LIMIT', code: 429, limit: USER_DAILY_LIMIT });
  return;
}
```
Para o throttle de `denied_access` (16-02), a adaptação é: janela curta (ex. 1 minuto, não 24h), chave = `user_id` OU `ip` do request negado (não "admin" — o negado nem é admin), tabela-alvo = `admin_audit_log` filtrando `status='denied'` em vez de `assistant_usage`.

### Padrão RPC SECURITY DEFINER com search_path fixo e grants mínimos
```sql
-- Fonte: supabase/derived-balance.sql:27-40 (set_account_balance), adaptar para admin_set_plan
create or replace function public.set_account_balance(p_account_id uuid, p_target numeric)
returns numeric language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_sum numeric;
begin
  if v_uid is null then raise exception 'AUTH'; end if;
  -- ... validação + update + return
end; $$;
grant execute on function public.set_account_balance(uuid, numeric) to authenticated;
```
Para `admin_set_plan`, a diferença crítica (documentada no draft §2.3): **não** usar `auth.uid()` como guard (é NULL sob `service_role`), e o `GRANT` final deve ser `to service_role` **com o REVOKE explícito antes** (`revoke execute ... from public, anon, authenticated;`), não replicar o `grant ... to authenticated` deste exemplo.

## State of the Art

Não aplicável nesta fase — o domínio (Supabase Auth JWT + Postgres RPC + Vercel rewrites) é o mesmo stack já em produção no projeto, sem mudança de versão relevante detectada. `@supabase/supabase-js` tem versões mais novas disponíveis no registry (`2.110.7` vs pin `^2.45.0`) mas isso é um item de manutenção de dependências, não um bloqueador ou requisito desta fase — não recomendamos bump de versão como parte do escopo 16-01..16-04.

## Assumptions Log

> Claims tagged `[ASSUMED]` nesta pesquisa — todas herdadas do draft §5 ("Pressupostos a validar via MCP"), pois **esta sessão não teve acesso ao MCP Supabase** para introspecção do schema live.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `profiles` live = `id, name, plan, created_at, group_targets`; sem coluna `email` (por isso o join com `auth.users` na RPC) | Pressupostos a validar via MCP | Se `email` existir na tabela live (schema.sql pode estar desatualizado, ROADMAP B10), a RPC pode simplificar e não precisar do join — mas usar o join mesmo assim não quebra nada, só é redundante |
| A2 | `assistant_usage` live tem `prompt_tokens/completion_tokens/latency_ms` (migração 11-03) | Pressupostos a validar via MCP | Se a coluna "msgs IA/mês" da listagem depender de agregação diferente, o cálculo do `admin_list_accounts` precisa ajuste |
| A3 | `SUPABASE_SERVICE_ROLE_KEY` não existe no env Vercel hoje | Checkpoint humano 16-02 | Se já existir (uso não documentado), pode já estar exposta em algum lugar não auditado — vale checar antes de assumir "é totalmente nova" |
| A4 | Schema `auth` não é exposto via PostgREST (comportamento padrão documentado do Supabase) — por isso a leitura de e-mail precisa de RPC SECURITY DEFINER | Fundação SQL 16-01 | Se por alguma config custom o schema `auth` estivesse exposto, a RPC ainda funcionaria (não é incorreta), só seria uma camada a mais do que estritamente necessário |
| A5 | Plano Vercel = Hobby (muda limite de functions e Deployment Protection) | Riscos do draft §4.2 | Se for Pro, o "único endpoint admin.js para economizar slots" deixa de ser uma restrição rígida — ainda é uma boa prática (ponto único de guard), mas o motivo "economizar slots" pode não se aplicar |
| A6 | Supabase Auth MFA TOTP disponível no plano atual | Fase 2 (16-07) | Bloqueador só para fase 2, não para o MVP (16-01..16-04) |
| A7 | Dono loga com `caduucomc@gmail.com` (conta admin dedicada será OUTRA conta, nova) | D-1b | Erro aqui significaria a conta pessoal do dono acabar na allowlist por engano — checkpoint humano do 16-02 deve confirmar o UUID específico antes de setar `ADMIN_USER_IDS` |
| A8 | Volume friends-and-family → paginação `p_limit=50` + `count()` são suficientes (sem necessidade de cursor/keyset pagination) | 2.2 `admin_list_accounts` | Se a base crescer muito além do esperado, paginação offset-based fica lenta — não é um risco do MVP, é uma nota para fase 2 |

**Pressupostos JÁ verificados nesta sessão (não entram nesta tabela — promovidos a [VERIFIED]):** rewrites do `vercel.json` avaliados em ordem (prova viva: par `/teste`); `index.html:15` usa supabase-js v2 UMD (`auth.storageKey` é opção v2 suportada); convenção `security definer set search_path` já existe no projeto; REVOKE/GRANT da 13-02 é exatamente como o draft descreve; `service_role` tem zero ocorrências em `api/` hoje (`grep` retornou vazio nesta sessão).

## Open Questions (RESOLVED — resolução via planos, 2026-07-16)

> **Resolução (pós plan-phase 16):** as 3 questões abaixo foram endereçadas pelos PLAN.md — nenhuma bloqueia execução.
> 1. **(RESOLVED)** Variante do sketch → 16-03 usa `.planning/sketches/001-painel-admin/index.html` como direção revisável e adia a escolha do `winner` para a execução (registrar no README/SUMMARY), consistente com "Claude's Discretion" do CONTEXT.
> 2. **(RESOLVED)** Caminho do sketch → 16-03 já referencia o caminho real (correção propagada); o path stale do draft/CONTEXT foi descartado.
> 3. **(RESOLVED)** Retenção de 2 anos → 16-04 ratifica com o dono no checkpoint humano (decisão de produto, não risco técnico).

1. **Qual variante do sketch (A/B/C) é a vencedora?**
   - What we know: `.planning/sketches/001-painel-admin/index.html` tem 3 variantes completas (A: sidebar admin; B: masthead editorial; C: console escuro) — todas com as 3 telas do MVP funcionais. `winner: null` no front-matter do README.
   - What's unclear: o dono ainda não escolheu.
   - Recommendation: o `/gsd-plan-phase 16` deve resolver isso antes ou durante o 16-03 (abrir o sketch, decidir, registrar o `winner` no README). Não é bloqueador para 16-01/16-02 (SQL e guard são agnósticos de UI).

2. **Caminho do sketch: conflito de referência entre draft/CONTEXT e a estrutura real de arquivos.**
   - What we know: tanto `painel-admin-backoffice-PLAN-DRAFT.md` (linha 161) quanto `16-CONTEXT.md` (`Claude's Discretion`) citam `.planning/sketches/painel-admin.html` como caminho. O caminho real (confirmado por `Glob`) é `.planning/sketches/001-painel-admin/index.html`, com `README.md` e `MANIFEST.md` de apoio no mesmo diretório.
   - What's unclear: nada tecnicamente — é só uma referência de caminho desatualizada nos dois documentos upstream (provavelmente escrita antes do sketch ser gerado com a convenção numerada `NNN-nome/`).
   - Recommendation: **⚠ Conflito draft-vs-código.** O PLAN.md (16-03) deve referenciar o caminho real `.planning/sketches/001-painel-admin/index.html`, não o caminho citado no draft/CONTEXT. Não é uma decisão de arquitetura a redebater — é uma correção de referência de arquivo.

3. **Retenção do audit log — 2 anos é adequado?**
   - What we know: LGPD não fixa um prazo numérico (confirmado via pesquisa externa — ver seção abaixo); a prática de mercado citada é mínimo de ~6 meses para logs de acesso a dado pessoal, sem teto superior fixo desde que documentado e com finalidade clara (minimização + expurgo ao fim da finalidade, art. 15/16 LGPD).
   - What's unclear: se "2 anos, expurgo manual" (proposta do draft §4.1) é a escolha final do dono ou só um placeholder.
   - Recommendation: 2 anos está dentro da faixa razoável e acima do mínimo prático de mercado — não há sinal de que viole a LGPD. Ainda assim, o draft já marca isso como "confirmar" — o `/gsd-plan-phase` deve tratar como uma decisão explícita a ratificar (não é tecnicamente arriscado, é uma escolha de produto/compliance).

## LGPD e retenção — pesquisa externa

- A LGPD **não define um prazo fixo** de retenção de dados pessoais/logs — o art. 15 define os eventos que encerram o tratamento (finalidade atingida, revogação de consentimento, determinação da ANPD) e o art. 16 trata da eliminação após o fim do tratamento, com exceções (obrigação legal, pesquisa anonimizada, etc.) [CITED: gov.br/anpd — Perguntas Frequentes 5.5]. `[CITED: https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes/perguntas-frequentes/5-adequacao-a-lgpd/5-5-por-quanto-tempo]`
- Prática de mercado citada para logs de acesso a dado pessoal: mínimo de ~6 meses, dentro do conjunto de medidas técnicas frequentemente cobradas pela ANPD sob o art. 46 (segurança da informação) `[CITED: https://novuln.com.br/blog/lgpd-medidas-tecnicas-praticas]`. **Confiança MEDIUM** — é uma fonte de blog especializado, não a lei ou a ANPD diretamente; usar como referência de ordem de grandeza, não como norma vinculante.
- O modelo de Política de Gestão de Registros de Logs de Auditoria do governo federal recomenda reter por um período mínimo definido pela própria organização e documentado, com exclusão/sanitização eficiente ao final do prazo `[CITED: https://www.gov.br/governodigital/pt-br/privacidade-e-seguranca/ppsi/modelo_politica_logs_auditoria.pdf]`.
- OWASP ASVS 4.0 V7 (Error Handling and Logging) — categoria diretamente relevante para `admin_audit_log`: V7.1 (não logar credenciais/segredos/PII desnecessária nos logs), V7.2 (toda decisão de autenticação E de controle de acesso, incluindo falhas, deve ser logada com metadados suficientes para investigação de segurança), V7.3 (proteger logs contra acesso/modificação não autorizada — reforça o `REVOKE ALL ... FROM anon, authenticated` do `admin_audit_log`) `[CITED: https://github.com/OWASP/ASVS/blob/master/4.0/en/0x15-V7-Error-Logging.md]`. **Confiança HIGH** — fonte primária OWASP.

**Conclusão para o 16-04:** a proposta de retenção de 2 anos com expurgo manual está dentro da faixa aceitável (acima do mínimo prático de mercado, sem prazo máximo legal fixo violado) — tratar como decisão de produto a ratificar com o dono, não como pendência técnica de pesquisa.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime das Vercel Functions | ✓ | v24.17.0 (ambiente local) | — |
| npm | Gerência de dependências | ✓ | 11.13.0 | — |
| `@supabase/supabase-js` | Client Auth + `service_role` client | ✓ (já dependência) | pin `^2.45.0`, registry atual `2.110.7` | — |
| Vercel CLI | Deploy/preview local (opcional) | ✓ | 54.1.0 | Deploy real é via push-to-main (CLAUDE.md) — CLI é só conveniência local |
| MCP Supabase | Introspecção do schema live (`profiles`/`assistant_usage`/`auth.users`) ANTES de escrever a migração 16-01 | ✗ **nesta sessão de pesquisa** | — | Nenhum fallback válido para introspecção — é uma dependência de EXECUÇÃO, não desta pesquisa. O 16-01 (plan/execute) deve rodar com MCP disponível; se não estiver disponível na execução, os 8 pressupostos da Assumptions Log continuam não confirmados e o 16-01 fica bloqueado até estarem |
| Supabase Auth MFA TOTP | Fase 2 (16-07), fora do MVP | Não verificado nesta sessão (plano do projeto no Supabase não inspecionado) | — | Sem impacto no MVP 16-01..16-04 |

**Missing dependencies with no fallback:**
- MCP Supabase para introspecção live — bloqueia o início real do 16-01 (a migração SQL não deve ser escrita "às cegas" contra pressupostos do `schema.sql`, que é documentação, não fonte de verdade — ROADMAP B10).

**Missing dependencies with fallback:**
- Nenhuma outra — Node/npm/Vercel CLI/lib Supabase já estão todos disponíveis no ambiente.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Nenhum framework de teste automatizado detectado no repositório (sem `pytest.ini`/`jest.config.*`/`vitest.config.*`, sem diretório `test/`/`tests/`/`__tests__/`, `package.json` não tem script `test`) |
| Config file | Nenhum — projeto usa verificação manual via `curl` + UAT conversacional (`/gsd-verify-work`), consistente com o restante do projeto (sem build step, CLAUDE.md) |
| Quick run command | `curl` direto contra o endpoint deployado (ver comandos por requisito abaixo) — não há suíte automatizada a rodar |
| Full suite command | `/gsd-verify-work 16` (UAT conversacional) + checklist de segurança do 16-04 |

**Gap identificado:** este projeto não tem infraestrutura de teste automatizado (unit/integration) em nenhuma fase anterior — é consistente com o stack (HTML + Babel-standalone, sem bundler, ROADMAP B11 ainda não resolvido). A verificação desta fase é **necessariamente manual/curl + UAT conversacional**, não testes automatizados de código. Isso não é uma lacuna introduzida por esta fase — é o padrão de todo o projeto até aqui (Phases 11-13 verificadas do mesmo jeito).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Comando manual (curl) | Arquivo existe? |
|--------|----------|-----------|-------------------|-------------|
| ADMIN-01 | RPCs só executáveis por `service_role` | manual (SQL) | `select public.admin_set_plan(...)` logado como `authenticated` no SQL Editor → deve falhar com erro de permissão (`permission denied for function`) | N/A — verificação via MCP/SQL Editor |
| ADMIN-01 | `admin_audit_log` inacessível a `anon`/`authenticated` | manual (SQL) | `select * from admin_audit_log` como `authenticated` → deve falhar (RLS on, zero policies + REVOKE) | N/A |
| ADMIN-02 | Guard fail-closed: sem token | smoke | `curl -i https://<deploy>/api/admin?action=whoami` (sem header) → espera `401 JWT_MISSING` | ❌ — endpoint não existe ainda, criar no 16-02 |
| ADMIN-02 | Guard fail-closed: token inválido | smoke | `curl -i -H "Authorization: Bearer token-invalido" https://<deploy>/api/admin?action=whoami` → espera `401 JWT_INVALID` | ❌ Wave 16-02 |
| ADMIN-02 | Guard fail-closed: `ADMIN_USER_IDS` ausente/vazia → 403 para TODOS | smoke | Deploy de teste com env var vazia + JWT válido de qualquer usuário (mesmo o que seria admin) → espera `403 FORBIDDEN` para 100% dos casos | ❌ Wave 16-02 — este é o teste mais importante do fail-closed, deve rodar antes de setar `ADMIN_USER_IDS` em produção |
| ADMIN-02 | Usuário comum autenticado (não-admin) → 403 + audit `denied_access` | smoke | `curl` com JWT de usuário comum → `403 FORBIDDEN`; depois checar `select * from admin_audit_log where action='denied_access' order by created_at desc limit 1` via MCP | ❌ Wave 16-02 |
| ADMIN-02 | Throttle de `denied_access` (anti-flood) | smoke | Disparar N requisições negadas rápidas do mesmo user/IP → contar linhas `denied_access` inseridas no período — deve haver um teto (não 1:1 com as requisições) | ❌ Wave 16-02 |
| ADMIN-02 | Admin válido → `whoami` 200 | smoke | `curl` com JWT do admin dedicado + allowlist correta → `200` com `user.id`/`email` | ❌ Wave 16-02 |
| ADMIN-02/03 | Troca de tier reflete no app após F5 | E2E manual (UAT) | Via painel: trocar `free↔pro` de conta de teste → logar no app com essa conta → F5 → tier mudou (consistente com `useFides()` lendo `profiles.plan` fail-closed, Phase 13-01/13-03) | ❌ Wave 16-03/16-04 (dogfooding dos 5 UATs da Phase 13) |
| ADMIN-03 | `/painel` servido antes do catch-all | smoke | `curl -sI https://<deploy>/painel` → header/corpo deve ser de `painel.html`, não `index.html` | ❌ Wave 16-03 |
| ADMIN-03 | Headers anti-clickjacking presentes | smoke | `curl -sI https://<deploy>/painel \| grep -i "x-frame-options\|referrer-policy"` → confirma `DENY`/`no-referrer` | ❌ Wave 16-03 |
| ADMIN-04 | Ação de mutação grava audit com before/after/reason na MESMA transação | manual (SQL) | Via MCP: checar que `admin_audit_log` tem linha com `before`/`after` populados exatamente coincidindo com o `set_plan` mais recente executado | ❌ Wave 16-01/16-04 |

### Sampling Rate
- **Por task/commit:** `curl` smoke tests dos itens marcados "smoke" acima, direto contra o deploy de preview do Vercel (push-to-main já auto-deploya — CLAUDE.md).
- **Por wave/merge do MVP:** checklist completo do 16-04 (todos os itens "Pronto" do draft §3 para 16-01..16-04) + revisão de `security-reviewer` e `database-reviewer` (caminho sensível, ROADMAP §Phase 16).
- **Phase gate:** os 5 UATs pendentes da Phase 13 + os UATs da Phase 12 executados via painel (dogfooding, conforme decisão D-seq e `painel-admin-backoffice.md` §5.1) antes de considerar a Phase 16 verificada.

### Wave 0 Gaps
- `api/_lib/admin/guard.js` não existe ainda — criar no 16-02 (não há "teste" a rodar antes disso existir, é o próprio entregável).
- Nenhum framework de teste automatizado a instalar — decisão consistente com o resto do projeto (sem bundler, ROADMAP B11); os comandos acima são `curl` manuais, não scripts de suíte.
- MCP Supabase precisa estar disponível na sessão de execução do 16-01 para rodar os testes SQL marcados "manual (SQL)" acima — é a mesma dependência já listada em `## Environment Availability`.

## Security Domain

> `security_enforcement` não está desabilitado no `.planning/config.json` (ausente = habilitado) — e o ROADMAP já marca esta fase como caminho sensível com `security-reviewer` + `database-reviewer` obrigatórios.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Sim | `auth.getUser(token)` contra o Supabase Auth server (já padrão do projeto) — nenhuma verificação de senha/token customizada |
| V3 Session Management | Sim | `persistSession: false` no `adminClient` (service_role não deve persistir sessão — é instanciado por request); `storageKey` dedicado (`fides-admin-auth`) isola a sessão do admin da sessão do app no mesmo browser |
| V4 Access Control | Sim | Allowlist server-side `ADMIN_USER_IDS` (não client-side, não em tabela consultável); `REVOKE`/`GRANT` a nível de função Postgres para as RPCs admin (defesa em profundidade — mesmo que o guard JS falhe, a RPC em si rejeita `authenticated`) |
| V5 Input Validation | Sim | Validação de `plan IN ('free','pro','family')` **no banco** (dentro da RPC, além do `CHECK` constraint já existente em `schema.sql:14`) — defesa em profundidade, não a única camada |
| V6 Cryptography | Não diretamente | Nenhuma criptografia nova introduzida — reutiliza JWT/TLS do Supabase Auth existente |
| V7 Error Handling and Logging | Sim (categoria central desta fase) | `admin_audit_log` cobre V7.1 (nenhum dado sensível/segredo logado — só metadados + before/after de `plan`, nunca senha/token), V7.2 (toda decisão de autorização, incluindo falha `denied_access`, é logada), V7.3 (RLS + REVOKE protege o log contra leitura/adulteração por `anon`/`authenticated`) |

### Known Threat Patterns for {admin backoffice server-side + service_role}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Self-elevation via RPC exposta sem REVOKE (M8) | Elevation of Privilege | `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` explícito nas duas RPCs novas, testado no 16-01 |
| Bypass do guard por ordem incorreta (chamar `adminClient` antes da checagem de allowlist) | Elevation of Privilege | Ordem load-bearing do `requireAdmin` — 401→401→403+audit→só então instancia `adminClient`; único guard, roteador único (`api/admin.js`), sem endpoint admin fora dele |
| Confused deputy — RPC confia em `p_admin_id`/`p_admin_email` do chamador | Spoofing / Elevation of Privilege | GRANT exclusivo a `service_role`; único chamador possível é `api/admin.js`, que só preenche esses parâmetros DEPOIS do guard validar o JWT — não há caminho para um `authenticated` comum injetar esses parâmetros diretamente (a RPC nem é executável por ele, ver Pitfall 1) |
| Clickjacking na rota `/painel` (M11) | Tampering | Headers `X-Frame-Options: DENY` + `Referrer-Policy: no-referrer` na rota `/painel` do `vercel.json` |
| Flood de `denied_access` inflando a tabela de audit (qualquer JWT válido pode martelar o endpoint) | Denial of Service (dados) | Throttle de `denied_access` por user/IP negado, implementado já no 16-02 (não esperar o 16-04 de hardening geral) |
| CSRF | Tampering | **Não-issue** — autenticação via `Authorization: Bearer` header, não cookies; registrado explicitamente para o security-reviewer não gastar ciclo nisso (nota do `16-CONTEXT.md`) |
| Vazamento de `service_role` para o client | Information Disclosure (crítico) | `inject-config.js` não muda (confirmado, só injeta URL+anon key); `SUPABASE_SERVICE_ROLE_KEY` só é lida via `process.env` dentro do runtime serverless, nunca serializada em HTML/JS/resposta JSON |
| Mesma origem painel/app — XSS futuro no app compromete o painel também | Information Disclosure / Elevation of Privilege | Aceito conscientemente para MVP friends-and-family (risco #4 do draft §4); mitigado em camadas (HTML isolado + storageKey próprio + conta dedicada + MFA pós-MVP) — não é resolvido nesta fase, é um risco residual documentado |

## Sources

### Primary (HIGH confidence)
- `.planning/research/painel-admin-backoffice-PLAN-DRAFT.md` — arquitetura decidida, SQL, breakdown, 3x revisado contra o código
- `.planning/phases/16-painel-admin-backoffice/16-CONTEXT.md` — decisões travadas do dono
- `api/assistant.js` (leitura integral, 477 linhas) — padrão de guard/rate-limit/fail-closed em produção
- `supabase/profiles-plan-privileges.sql` (leitura integral, 45 linhas) — trava 13-02
- `supabase/derived-balance.sql` (leitura integral, 139 linhas) — convenção `security definer set search_path`
- `supabase/wa-log-transaction.sql` (leitura integral, 97 linhas) — mesma convenção
- `vercel.json` (leitura integral, 33 linhas) — ordem de rewrites/headers
- `api/inject-config.js` (leitura integral, 13 linhas) — bridge de config
- `index.html` (linhas 1-40) — supabase-js v2 UMD via CDN
- `supabase/schema.sql` (grep dirigido) — CHECK de `plan`, RLS policy de `profiles`, tabela `assistant_usage`
- `assets/fides-store.jsx:1380` (grep) — `isPremium` inclui `family`
- `.planning/ROADMAP.md` (linhas 440-489) — goal + caminho sensível da Phase 16
- `.planning/REQUIREMENTS.md` (linhas 1-60) — confirma ausência de IDs `ADMIN-*` formais
- `.planning/sketches/001-painel-admin/README.md` + `MANIFEST.md` — caminho real do sketch (correção de conflito)
- `.planning/config.json` — `nyquist_validation: true`, `security_enforcement` ausente (= habilitado)
- `package.json` + `npm view @supabase/supabase-js version` — versão da lib confirmada no registry
- OWASP ASVS 4.0 V7 (Error Handling and Logging) — https://github.com/OWASP/ASVS/blob/master/4.0/en/0x15-V7-Error-Logging.md

### Secondary (MEDIUM confidence)
- ANPD — Perguntas Frequentes 5.5 (prazo de tratamento de dados pessoais) — https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes/perguntas-frequentes/5-adequacao-a-lgpd/5-5-por-quanto-tempo
- Política de Gestão de Registros de Logs de Auditoria (governo federal) — https://www.gov.br/governodigital/pt-br/privacidade-e-seguranca/ppsi/modelo_politica_logs_auditoria.pdf
- Blog especializado (No Vuln) — prática de mercado de retenção mínima de ~6 meses — https://novuln.com.br/blog/lgpd-medidas-tecnicas-praticas

### Tertiary (LOW confidence)
- Nenhuma — todos os pressupostos não verificáveis nesta sessão foram movidos explicitamente para `## Assumptions Log`, não apresentados como fato.

## Metadata

**Confidence breakdown:**
- Arquitetura/guard/RPC/vercel.json: HIGH — verificado por leitura direta e grep do código real, 100% de conformidade com o draft
- 13-02 lock integrity: HIGH — arquivo lido integralmente, comportamento confirmado
- LGPD/retenção: MEDIUM — lei não fixa prazo, fontes secundárias/blog para prática de mercado
- Schema live (`profiles`/`assistant_usage`/`auth.users`): LOW/pendente — sem acesso a MCP Supabase nesta sessão, tratado explicitamente como pendência de execução (não fato assumido)

**Research date:** 2026-07-16
**Valid until:** 30 dias (stack estável, sem dependência de API externa de terceiros que mude rápido) — mas os pressupostos da Assumptions Log DEVEM ser revalidados via MCP no início do 16-01, independente da validade deste documento.
