---
phase: 16-painel-admin-backoffice
plan: 01
subsystem: database
tags: [postgres, supabase, rls, security-definer, rpc, audit-log, service-role, lgpd]

requires:
  - phase: 13-ia-3-gating-premium-in-app
    provides: "trava 13-02 (profiles-plan-privileges) — column-privilege que impede authenticated de escrever profiles.plan"
provides:
  - "Tabela public.admin_audit_log (RLS on, zero policies, append-only p/ service_role)"
  - "RPC public.admin_list_accounts(text,text,int,int) — leitura agregada + total_count, service_role-only"
  - "RPC public.admin_set_plan(uuid,text,uuid,text,text) — mutação atômica de tier + audit, service_role-only"
  - "Espelho versionado supabase/admin-backoffice.sql (doc-of-record ROADMAP B10)"
affects: [16-02, 16-03, 16-04, api/admin.js]

tech-stack:
  added: []
  patterns:
    - "RPC admin service_role-only: REVOKE execute FROM public/anon/authenticated + GRANT só service_role, pela assinatura exata (M8)"
    - "SECURITY DEFINER + set search_path=public em toda RPC (convenção derived-balance.sql / wa-log-transaction.sql, M6)"
    - "Audit trail append-only: grant só SELECT,INSERT ao service_role (sem UPDATE/DELETE)"

key-files:
  created:
    - "supabase/admin-backoffice.sql"
  modified: []

key-decisions:
  - "admin_set_plan confia em p_admin_id/p_admin_email (não usa auth.uid(), NULL sob service_role — Pitfall 3); mitigação = GRANT service_role-only, único chamador é api/admin.js pós-guard"
  - "admin_list_accounts retorna jsonb {accounts:[...], total_count} — minimização LGPD: só metadados/contagens agregadas, nunca lançamentos individuais"
  - "Migração aplicada MANUALMENTE via Supabase SQL Editor: MCP Supabase não é exposto ao agente neste runtime (Agent SDK) — introspecção A1-A8 e apply feitos pelo dono; ver [[mcp-supabase-subagente-inline]]"
  - "grant explícito SELECT,INSERT ao service_role no audit_log (não depender de default privilege implícito da plataforma) — finding LOW do database-reviewer"

patterns-established:
  - "Fundação admin no banco: toda ação admin passa por service_role via RPC/serverless — nunca client SDK (D-1c)"

requirements-completed: [ADMIN-01]

coverage:
  - id: D1
    description: "3 objetos criados no live com SECURITY DEFINER + search_path=public; espelho SQL versionado"
    requirement: "ADMIN-01"
    verification:
      - kind: other
        ref: "SQL Editor: objetos_existem=all true, security_definer=all true, search_path=[search_path=public]"
        status: pass
    human_judgment: false
  - id: D2
    description: "authenticated BARRADO: não executa as RPCs nem lê/insere no audit_log; service_role permitido"
    requirement: "ADMIN-01"
    verification:
      - kind: other
        ref: "SQL Editor has_function_privilege/has_table_privilege: authenticated tudo false, service_role tudo true"
        status: pass
    human_judgment: false
  - id: D3
    description: "Trava 13-02 intacta — authenticated mantém UPDATE só em (group_targets, name) de profiles"
    requirement: "ADMIN-01"
    verification:
      - kind: other
        ref: "SQL Editor role_column_grants profiles/authenticated/UPDATE = [group_targets, name]"
        status: pass
    human_judgment: false
  - id: D4
    description: "admin_set_plan muda profiles.plan + insere audit na MESMA transação retornando {target,before,after}"
    verification: []
    human_judgment: true
    rationale: "Lógica confirmada por database-reviewer + security-reviewer, mas não executada em runtime (não rodei set_plan real p/ não alterar conta viva) — será exercido no dogfooding via painel (16-04)"
  - id: D5
    description: "admin_list_accounts retorna page agregada + total_count (join auth.users×profiles + contagens + ai_msgs_month)"
    verification: []
    human_judgment: true
    rationale: "Estrutura confirmada por review; execução real será exercida pela tabela de contas do painel (16-03) e dogfooding (16-04)"

duration: ~2 sessões (split por bloqueio de MCP + restart)
completed: 2026-07-16
status: complete
---

# Phase 16 / Plano 01: Fundação SQL do painel admin

**`admin_audit_log` + RPCs `admin_list_accounts`/`admin_set_plan` SECURITY DEFINER executáveis só por `service_role`, com trava 13-02 intacta — aplicado e verificado no banco live.**

## Performance

- **Tasks:** 3/3 (introspecção · migração+espelho · revisão de segurança)
- **Files created:** 1 (`supabase/admin-backoffice.sql`)
- **Completed:** 2026-07-16

## Accomplishments
- **Introspecção live (Task 1):** os 8 pressupostos A1–A8 CONFIRMADOS contra o banco real via SQL Editor — `profiles` sem coluna email; `assistant_usage` com as 3 colunas de telemetria; email/last_sign_in_at em `auth.users`; `uuid-ossp` presente; nenhum objeto admin pré-existente. Zero divergências → DDL escrita sobre schema real, não presumido.
- **Migração (Task 2):** 3 objetos aplicados no live + espelho `supabase/admin-backoffice.sql`. RPCs com REVOKE/GRANT service_role-only por assinatura exata; audit_log com RLS on + zero policies + revoke anon/authenticated + grant append-only ao service_role.
- **Revisão de segurança (Task 3):** database-reviewer + security-reviewer independentes/adversariais → ambos **PASS**, zero findings high/critical. T1 EoP, T2 confused-deputy, T3 info-disclosure, T4 trava 13-02, T5 search_path-hijack todas mitigadas com evidência.
- **Verificação em produção:** `has_function_privilege`/`has_table_privilege` provam que `authenticated` está barrado e `service_role` permitido; trava 13-02 = `[group_targets, name]`.

## Task Commits

1. **Task 1: Introspecção live + revalidação A1–A8** - sem commit (validação documentada aqui; nenhum arquivo de código)
2. **Task 2: Migração + espelho SQL** - `09ea41e` (feat)
3. **Task 3: Revisão de segurança (database + security reviewer)** - sem commit (2 reviews PASS documentadas aqui)

## Files Created/Modified
- `supabase/admin-backoffice.sql` - espelho versionado da migração admin (audit_log + 2 RPCs)

## Decisions Made
- **Aplicação manual via SQL Editor** em vez de MCP `apply_migration`: o MCP Supabase não é exposto ao agente neste runtime (Agent SDK) — `claude mcp list` diz "Connected" mas as tools `mcp__supabase__*` não chegam ao loop, nem no thread principal nem em subagente. Introspecção e apply conduzidas pelo dono no SQL Editor com SQL fornecido/revisado. Registrado em memória [[mcp-supabase-subagente-inline]].
- **grant explícito SELECT,INSERT do audit_log ao service_role** (finding LOW do reviewer) — robustez, não depender de default privilege implícito; append-only mantido.

## Deviations from Plan

### Ajustes aplicados
**1. [Robustez — LOW review] grant explícito ao service_role no admin_audit_log**
- **Found during:** Task 3 (database-reviewer)
- **Issue:** acesso do service_role à tabela dependia de default privilege implícito da plataforma, enquanto o resto do arquivo usa grants explícitos
- **Fix:** `grant select, insert on public.admin_audit_log to service_role` (append-only)
- **Committed in:** `09ea41e`

**2. [Ambiente] Task 1/2 via SQL Editor em vez de MCP**
- **Issue:** MCP Supabase indisponível ao agente neste runtime (não é config nem --read-only)
- **Fix:** introspecção + apply manuais com SQL revisado antes de tocar produção; mesmo resultado (schema validado, migração aplicada, verificada)

---
**Total deviations:** 2 (1 robustez de review, 1 de ambiente). **Impacto:** nenhum scope creep; ambos reforçam segurança/robustez.

## Issues Encountered
- **MCP Supabase não exposto ao agente (Agent SDK runtime):** bloqueou o caminho automático `apply_migration`. Diagnóstico: servidor conecta no health-check do CLI mas as tools não são registradas no tool-loop. Resolvido pivotando para SQL Editor manual (fluxo habitual do dono). Custou 1 restart + investigação.

## User Setup Required
None neste plano — o 16-02 é que exige setup no Vercel (conta admin dedicada + `SUPABASE_SERVICE_ROLE_KEY` + `ADMIN_USER_IDS`).

## Next Phase Readiness
- Banco pronto: guard e serverless (16-02) já têm as RPCs e a tabela de audit para consumir via service_role.
- **Ressalva de sequenciamento (do security-reviewer):** os objetos ficam inertes até `api/admin.js` existir; quando o 16-02 escrever o guard, ele é a única barreira de aplicação — precisa autenticar o admin de verdade antes de preencher `p_admin_id/p_admin_email`.

---
*Phase: 16-painel-admin-backoffice · Plano 01*
*Completed: 2026-07-16*
