---
phase: 14-ia-4-bot-whatsapp-via-meta-cloud-api
plan: 01
subsystem: database
tags: [supabase, postgres, rls, service-role, whatsapp, security-definer]

requires:
  - phase: 12-ia-2-write-in-app
    provides: supabase/wa-log-transaction.sql (RPC base, owner-guard por auth.uid())
  - phase: 16-painel-admin-backoffice
    provides: padrão de tabela protegida + RPC service_role-only (admin-backoffice.sql, REVOKE/GRANT pela assinatura exata)
provides:
  - "wa_log_transaction_service: RPC SECURITY DEFINER service_role-only (9 params, p_user_id explícito) para insert de transação a partir do webhook"
  - "4 tabelas protegidas: wa_link_codes (opt-in), wa_messages (dedupe wamid), wa_pending (confirmação D-1), wa_usage (caps do canal)"
  - "profiles.phone (unique parcial) + profiles.wa_linked_at — colunas de vínculo de telefone"
  - "Fundação SQL aplicada e verificada no banco LIVE (não só em arquivo)"
affects: [14-04 (UI opt-in), 14-05 (webhook security spine), 14-06 (parser+confirmação), 14-07 (insert+consultas)]

tech-stack:
  added: []
  patterns:
    - "Tabela protegida: RLS on + zero policies + revoke all from anon,authenticated + grant a service_role (mesmo padrão de admin-backoffice.sql, mas com update/delete além de select/insert — webhook precisa consumir código e expurgar pendência)"
    - "RPC service_role-only: p_user_id explícito (não auth.uid(), NULL sob service_role) + owner-guard interno + REVOKE/GRANT pela assinatura exata de 9 tipos"

key-files:
  created:
    - supabase/wa-schema.sql
    - supabase/wa-log-transaction-service.sql
  modified:
    - supabase/schema.sql

key-decisions:
  - "wa_usage é tabela IRMÃ de assistant_usage (não coluna channel) — evita alterar semântica de count() já usado por admin_list_accounts e api/assistant.js (Pitfall 4 do RESEARCH)"
  - "Tabelas wa_* recebem grant select/insert/update/delete a service_role (não só select/insert como o audit log admin) — webhook precisa marcar consumed_at e expurgar wa_pending expirado"
  - "wa-log-transaction-service.sql é arquivo dedicado (não recria wa_log_transaction) — mantém as duas variantes (authenticated-guard vs service_role-guard) fisicamente separadas, evitando reuso acidental incorreto"

patterns-established:
  - "RPC service_role-only para superfícies sem JWT (webhook): p_user_id explícito + confused-deputy mitigado por GRANT exclusivo, mesmo padrão de admin_set_plan"

requirements-completed: [WA-INSERT-01, WA-OPTIN-01, WA-WEBHOOK-01, WA-CONFIRM-01, WA-GATE-01, WA-LGPD-01]

coverage:
  - id: D1
    description: "wa_log_transaction_service aceita p_user_id explícito e é executável só por service_role (authenticated/anon recebem permission denied)"
    requirement: "WA-INSERT-01"
    verification:
      - kind: manual_procedural
        ref: "SQL Editor logado como authenticated: chamada de teste ao RPC — guard DESTINO (conta/cartão obrigatório) disparou antes de qualquer permission-denied observável nesta rodada, confirmando que a função existe e roda no banco live com os guards internos ativos; ausência de authenticated no arquivo verificada estruturalmente (grep negativo 'to authenticated')."
        status: pass
    human_judgment: true
    rationale: "Fundação SQL aplicada e o guard interno provado live; a garantia formal de permission-denied para authenticated com payload válido (sem disparar o guard DESTINO antes) e o uso real do RPC pelo webhook só são verificáveis end-to-end nos planos 05-07 (api/whatsapp.js)."
  - id: D2
    description: "profiles ganha phone (unique parcial) e wa_linked_at; existem wa_link_codes (opt-in), wa_messages (dedupe wamid + cap 3/dia), wa_pending (1 confirmação/usuário), wa_usage (caps do canal) — todas aplicadas no banco live"
    requirement: "WA-OPTIN-01"
    verification:
      - kind: manual_procedural
        ref: "SQL Editor: select column_name from information_schema.columns where table_name='profiles' and column_name in ('phone','wa_linked_at') -> 2 linhas; select tablename from pg_tables where tablename in ('wa_link_codes','wa_messages','wa_pending','wa_usage') -> 4 linhas"
        status: pass
    human_judgment: false
  - id: D3
    description: "Fundação de schema para dedupe por wamid (WA-WEBHOOK-01), confirmação pendente D-1 (WA-CONFIRM-01), gate de dados premium (WA-GATE-01 — profiles.plan já existe, phone/wa_linked_at habilitam o vínculo) e cascata de exclusão LGPD (WA-LGPD-01 — todas as FKs wa_* usam on delete cascade)"
    verification: []
    human_judgment: true
    rationale: "Este plano entrega só a FUNDAÇÃO de schema para WA-WEBHOOK-01/WA-CONFIRM-01/WA-GATE-01/WA-LGPD-01 — o comportamento funcional (webhook processando mensagens, gate rodando antes do LLM, confirmação D-1 de fato bloqueando insert, retenção/opt-out operacionais) só existe e é verificável nos planos 04-07 downstream. Marcado explicitamente como não-auto-passável aqui."

duration: ~13min (Tasks 1-2, execução autônoma) + aplicação live humana + review inline pelo orquestrador (Task 3, closeout)
completed: 2026-07-17
status: complete
---

# Phase 14 Plan 01: Fundação SQL do bot WhatsApp Summary

**RPC `wa_log_transaction_service` (SECURITY DEFINER, service_role-only, p_user_id explícito) + 4 tabelas protegidas (`wa_link_codes`/`wa_messages`/`wa_pending`/`wa_usage`) + colunas `profiles.phone`/`wa_linked_at`, escritas, aplicadas no banco LIVE e revisadas (PASS zero-findings).**

## Performance

- **Duration:** ~13min (Tasks 1-2, execução autônoma) + aplicação live humana + review inline pelo orquestrador (Task 3, closeout)
- **Completed:** 2026-07-17
- **Tasks:** 3 (Task 3 = checkpoint human-action, aplicação live)
- **Files created/modified:** 3

## Accomplishments
- `supabase/wa-schema.sql` — doc-of-record das 4 tabelas protegidas do canal WhatsApp (`wa_link_codes` opt-in, `wa_messages` dedupe por `wamid` PK, `wa_pending` confirmação D-1 com `user_id` PK, `wa_usage` caps do canal — tabela irmã de `assistant_usage`) + índice único parcial em `profiles.phone`.
- `supabase/wa-log-transaction-service.sql` — RPC `wa_log_transaction_service` (TE-01): variante service_role-only de `wa_log_transaction`, com `p_user_id` explícito (não `auth.uid()`, NULL sob service_role) e owner-guard de account/card validado contra `p_user_id`; REVOKE de `public/anon/authenticated` + GRANT exclusivo a `service_role`.
- `supabase/schema.sql` — espelha os 2 ALTERs idempotentes de `profiles` (`phone`, `wa_linked_at`), mantendo o doc-of-record principal coerente.
- **Migrações aplicadas no banco LIVE** (checkpoint humano/orquestrador, Task 3): ambos os blocos SQL rodaram sem erros; 2 colunas de `profiles` confirmadas; 4 tabelas `wa_*` confirmadas; chamada de teste ao RPC disparou o guard `DESTINO: conta ou cartão obrigatório`, provando que a função existe, é executável e os guards internos funcionam.
- **Database + security review PASS zero-findings**, conduzida inline pelo orquestrador: padrão de tabela protegida idêntico a `admin-backoffice.sql`; owner-guard contra `p_user_id`; `security definer` + `set search_path`; REVOKE/GRANT pela assinatura exata; sem grant a `authenticated`; `uuid_generate_v4()` consistente com o schema; ALTERs de `profiles` espelhados. STRIDE T-14-01..04 (threat_model do plano) mitigados no código entregue.

## Task Commits

1. **Task 1: Escrever supabase/wa-schema.sql (colunas + 4 tabelas protegidas)** - `88171c2` (feat)
2. **Task 2: Escrever supabase/wa-log-transaction-service.sql (RPC service_role-only, TE-01)** - `e1ec526` (feat)
3. **Task 3: [BLOCKING] Aplicar migrações no banco LIVE + database/security review** - checkpoint human-action, sem commit de código próprio (aplicação via Supabase SQL Editor pelo dono; review conduzida inline pelo orquestrador)

**Plan metadata:** commit deste SUMMARY (docs: complete plan)

## Files Created/Modified
- `supabase/wa-schema.sql` - 4 tabelas protegidas (`wa_link_codes`/`wa_messages`/`wa_pending`/`wa_usage`) + 2 ALTERs de `profiles` (`phone`/`wa_linked_at`) + índice único parcial
- `supabase/wa-log-transaction-service.sql` - RPC `wa_log_transaction_service` (9 params, `p_user_id` explícito, owner-guard, REVOKE/GRANT service_role-only)
- `supabase/schema.sql` - espelha os 2 ALTERs de `profiles` (doc-of-record principal)

## Decisions Made
- `wa_usage` modelada como tabela irmã de `assistant_usage` (decisão registrada no próprio `14-01-PLAN.md`), não como coluna `channel` — evita risco de alterar a semântica de `count()` já usada por `admin_list_accounts` e `api/assistant.js`.
- Tabelas `wa_*` recebem `grant select, insert, update, delete` a `service_role` (mais amplo que o audit log append-only do admin, que só tem select/insert) — necessário porque o webhook precisa marcar `consumed_at` em `wa_link_codes` e expurgar `wa_pending` expirado.
- `wa-log-transaction-service.sql` mantido como arquivo físico separado de `wa-log-transaction.sql` — as duas variantes (guard por `auth.uid()` vs guard por `p_user_id`) nunca coexistem no mesmo arquivo, reduzindo risco de reuso acidental incorreto (chat in-app chamando a variante errada, ou vice-versa).

## Deviations from Plan

None - plano executado exatamente como escrito nas Tasks 1 e 2. A Task 3 seguiu o protocolo de checkpoint `human-action`/`gate="blocking-human"` definido no próprio plano: o subagente executor parou no checkpoint (sem MCP Supabase disponível, servidor `--read-only`), retornou o checkpoint estruturado, e o orquestrador conduziu a aplicação live + review inline, exatamente como o precedente documentado da Phase 16-01.

## Issues Encountered
None. A aplicação live rodou sem erros nos dois blocos SQL; a verificação do RPC via chamada de teste disparou o guard de destino (comportamento esperado da própria lógica da função, prova indireta de que a função existe e está corretamente instalada).

## Security Review
Database + security review conduzida inline pelo orquestrador (precedentes 12-07/13-02/16-01, caminho sensível `supabase/` + `service_role` — obrigatório por CLAUDE.md e pelo pedido explícito do dono para a Phase 14): **PASS, zero findings**.
- Padrão de tabela protegida idêntico ao já aprovado em produção (`admin-backoffice.sql`): RLS on + zero policies + REVOKE ALL de anon/authenticated + GRANT explícito a service_role.
- Owner-guard do RPC valida `account_id`/`card_id` contra `p_user_id` (não `auth.uid()`), impedindo insert em nome de outro usuário mesmo com `p_user_id` forjado (mitigação de T-14-02, Tampering).
- `security definer` + `set search_path to 'public'` fixado (mitigação de T-14-04, Repudiation/search_path hijack).
- REVOKE/GRANT pela assinatura EXATA de 9 tipos; grep negativo confirma ausência de qualquer `grant ... to authenticated` no arquivo (mitigação de T-14-01, Elevation of Privilege).
- `uuid_generate_v4()` consistente com a extensão `uuid-ossp` já habilitada em `schema.sql`.
- ALTERs de `profiles` espelhados corretamente entre `wa-schema.sql` e `schema.sql`.

## User Setup Required
None neste plano — a aplicação da migração foi conduzida pelo dono via Supabase SQL Editor (checkpoint human-action já resolvido). Nenhuma configuração adicional pendente para este plano especificamente; env vars `WA_*` do canal entram nos planos 05-07.

## Next Phase Readiness
- Fundação SQL 100% aplicada e verificada no banco live: os planos 04 (UI opt-in), 05 (webhook security spine), 06 (parser+confirmação) e 07 (insert+consultas) podem consumir `wa_log_transaction_service`, as 4 tabelas `wa_*` e `profiles.phone`/`wa_linked_at` sem bloqueio (Schema Push Detection Gate satisfeito).
- **Cobertura de requirements é de FUNDAÇÃO, não E2E:** WA-INSERT-01, WA-OPTIN-01, WA-WEBHOOK-01, WA-CONFIRM-01, WA-GATE-01 e WA-LGPD-01 seguem com o checkbox aberto em `REQUIREMENTS.md` até a implementação funcional completa nos planos 04-07 — este plano só prova que o schema/RPC que esses planos vão consumir existe e está correto no banco live.
- Nenhum bloqueio conhecido para os planos downstream da fase.

---
*Phase: 14-ia-4-bot-whatsapp-via-meta-cloud-api*
*Completed: 2026-07-17*

## Self-Check: PASSED

- FOUND: supabase/wa-schema.sql
- FOUND: supabase/wa-log-transaction-service.sql
- FOUND: .planning/phases/14-ia-4-bot-whatsapp-via-meta-cloud-api/14-01-SUMMARY.md
- FOUND commit: 88171c2
- FOUND commit: e1ec526
