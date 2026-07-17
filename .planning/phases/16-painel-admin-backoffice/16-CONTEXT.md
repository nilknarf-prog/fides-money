# Phase 16: Painel de administração / backoffice - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning
**Fonte primária:** `.planning/research/painel-admin-backoffice-PLAN-DRAFT.md` (decisões travadas com o dono em 2026-07-16, verificado 3x contra o código: Fable 5 subagente + Opus 4.8 + revisão adversarial Fable 5 em sessão dedicada — seções 0.1/0.2/0.3 do draft)

<domain>
## Phase Boundary

Painel de administração online em `/painel` para o admin gerir o produto sem depender do Supabase SQL Editor. **MVP = listar contas + trocar tier (free/pro/family) + audit log.** Toda mutação admin passa por caminho servidor com `service_role` (NUNCA client SDK — não reabrir a brecha fechada na 13-02), toda ação admin é auditada, autenticação de admin é conta dedicada + allowlist server-side. Métricas/observabilidade, MFA e detalhe de conta são fase 2 (16-05..16-07); ações destrutivas (banir/excluir/reset senha) ficam no backlog gateadas em B12/staging.

Requirements: ADMIN-* (formalizados pelos critérios "Pronto" de cada plan no draft §3).

</domain>

<decisions>
## Implementation Decisions

### Travadas com o dono (2026-07-16 — NÃO re-decidir)
- **D-1a (onde vive):** rota `/painel` no projeto atual, `painel.html` isolado (entrada própria, não acopla à migração Vite/Next B11). Mesma origem do app aceita conscientemente para MVP friends-and-family; mitigações: HTML isolado + client Supabase com `storageKey` próprio (`fides-admin-auth`) + conta dedicada + MFA pós-MVP.
- **D-1b (auth do admin):** conta admin dedicada NOVA (a conta pessoal do dono NÃO é admin) + allowlist de UUIDs server-side via env `ADMIN_USER_IDS`. Fail-closed: env ausente/vazia → 403 para todos. MFA TOTP entra logo após o MVP (16-07), não no MVP.
- **D-1c (escopo MVP):** listar contas + trocar tier + audit log. Nada destrutivo no MVP.
- **D-seq:** Phase 16 executa ANTES da Phase 14 (bot WhatsApp) — destrava os 5 UATs pendentes da Phase 13.

### Arquitetura (draft §1–§2, já revisada 3x — seguir, não redesenhar)
- **Um único `api/admin.js`** (CommonJS) roteador por `action`; handlers em `api/_lib/admin/*.js`; guard `requireAdmin` SEMPRE antes do dispatch (ordem load-bearing: 401 sem token → 401 inválido → 403 não-allowlisted + audit `denied_access` → só então instancia client service_role, `persistSession:false`, por request).
- **Mutações via RPC SECURITY DEFINER** (`admin_set_plan`: update + insert audit na MESMA transação); leituras agregadas via RPC `admin_list_accounts` (join `auth.users × profiles`, e-mail vive em `auth.users`). Ambas com `set search_path = public` e `revoke execute from public, anon, authenticated; grant to service_role` (EXECUTE de plpgsql é PUBLIC por default).
- **`admin_audit_log`**: RLS on sem policies + REVOKE de anon/authenticated. Leituras SEMPRE logadas em linha leve (sem before/after/reason); mutações com before/after/reason. Throttle de `denied_access` (chave user/IP negado) já no 16-02.
- **Trava 13-02 intacta**: nenhum REVOKE/GRANT existente muda; admin usa service_role por design.
- **Env novas (aba Project do Vercel, checkpoint humano):** `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USER_IDS`. `inject-config.js` NÃO muda — service_role JAMAIS chega ao client.
- **Rewrite `/painel` → `/painel.html` ANTES do catch-all** no `vercel.json`; painel é single-page com abas por estado/hash (sem sub-paths); headers `X-Frame-Options: DENY` + `Referrer-Policy: no-referrer` na rota.

### Claude's Discretion
- Formato exato de resposta/erros do `api/admin.js`, shape dos handlers, componentes da UI (respeitando tokens.css + sketch `.planning/sketches/painel-admin.html` como direção visual).
- Detalhes de paginação/busca (baseline: `p_limit=50`, `total_count` na RPC).
- Retenção do audit log (proposta 2 anos, expurgo manual) — confirmar com o dono no plan ou UAT.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/research/painel-admin-backoffice-PLAN-DRAFT.md` — **plano-rascunho completo e decidido** (arquitetura, SQL, breakdown 16-01..16-04, fase 2, backlog, riscos, pressupostos a validar via MCP). É o insumo principal do PLAN.md.
- `.planning/research/painel-admin-backoffice.md` — demanda original (escopo amplo §3, restrições herdadas §4, LGPD §5).
- `.planning/ROADMAP.md` §Phase 16 — goal + caminho sensível (security-reviewer + database-reviewer obrigatórios).
- `supabase/profiles-plan-privileges.sql` — trava 13-02 que NÃO pode ser reaberta.
- `api/assistant.js:205-311` — padrão de guard Bearer + `auth.getUser` (WR-03) e padrão de rate-limit por count; nomes de env `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `CLAUDE.md` — revisão de segurança obrigatória em `api/`/`supabase/`; verdade do schema é o banco live via MCP (B10).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `api/assistant.js` — guard JWT existente (Bearer → `getUser`), fail-closed de tier, rate-limit por count em `assistant_usage`: os três padrões a replicar no guard/throttle admin.
- `vercel.json` — par `/teste → Fides-app.html` prova que rewrites avaliam em ordem; catch-all `/((?!api/).*)` é o último.
- `supabase/derived-balance.sql`, `wa-log-transaction.sql` — convenção `security definer set search_path = public` das RPCs do projeto.
- `tokens.css` + `assets/fides-ui.jsx` (`ConfirmDialog`/`Toast`) — identidade visual e componentes p/ confirmação de troca de plano.
- `index.html:15` — supabase-js v2 UMD via CDN (suporta `auth.storageKey`).

### Established Patterns
- Serverless em CommonJS (`module.exports`), env pela aba Project do Vercel, config do client via `/fides-config.js` (só URL + anon key).
- RPCs sensíveis = SECURITY DEFINER + validação no banco + grants mínimos (padrão `pay_card_invoice`/`wa_log_transaction`).
- Fail-closed em tudo que é gate (Phase 13).

### Integration Points
- `profiles.plan` é a fonte da verdade do tier (13-01/13-03); trocar via painel deve refletir no app após F5.
- `assistant_usage` alimenta a coluna "msgs IA/mês" da listagem (e a fase 2 de métricas, AI-TELEM-01).
- Memória `testar-tier-free-pro` deve ser atualizada no 16-04 para apontar ao painel.

</code_context>

<specifics>
## Specific Ideas

- Ordem exata do guard importa para o review — sketch em draft §1.
- `admin_set_plan` confia em `p_admin_id/p_admin_email` por design (único chamador é `api/admin.js` com JWT já validado; GRANT exclusivo a service_role). `auth.uid()` é null no contexto service_role — NÃO usar como guard na RPC.
- CSRF é não-issue (auth por Bearer header, não cookies) — registrar p/ o security-reviewer não gastar ciclo.
- Introspectar schema live (`profiles`, `assistant_usage`, `auth.users`) via MCP ANTES de escrever a migração (pressupostos draft §5).

</specifics>

<deferred>
## Deferred Ideas

- **Fase 2 (16-05..16-07):** observabilidade/métricas (AI-TELEM-01), detalhe de conta, MFA TOTP (guard exige `aal2`).
- **Backlog (fora da 16, registrar no ROADMAP):** suspender/banir/reset senha/excluir conta via `auth.admin` (gatear em B12/staging; até lá, pedidos LGPD de exclusão via SQL Editor documentado) · aba billing (junto do M6) · `app_config` p/ caps/feature flags sem deploy · broadcast · rotação de segredos operacionais (ex.: `ASSISTANT_NONCE_SECRET`).

</deferred>

---

*Phase: 16-painel-admin-backoffice*
*Context gathered: 2026-07-16*
