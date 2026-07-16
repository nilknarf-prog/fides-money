---
phase: 13-ia-3-gating-premium-in-app
plan: 02
subsystem: database
tags: [supabase, postgres, rls, column-level-security, grant, revoke, tier-gating]

# Dependency graph
requires:
  - phase: 13-01
    provides: "store lê profiles.plan e expõe userPlan/isPremium (fonte da verdade do tier no client)"
  - phase: 13-03
    provides: "gate de tier server-side em api/assistant.js (premium = plan pro/family)"
provides:
  - "supabase/profiles-plan-privileges.sql: REVOKE UPDATE ON public.profiles FROM authenticated + GRANT UPDATE (name, group_targets) TO authenticated"
  - "Trava column-level que impede self-elevation de profiles.plan pelo client SDK autenticado (fecha Pitfall 1 CRÍTICO do RESEARCH)"
  - "Fonte da verdade do tier (profiles.plan) agora não-escrevível pelo sujeito controlado — pré-requisito de integridade de todo o gate premium (GATE-03)"
affects: [13-04, gating-premium, paywall, security-review, whatsapp-bot]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Column-level privilege (REVOKE/GRANT por coluna) como camada aditiva sobre RLS row-level — RLS restringe LINHAS, privilégio de coluna restringe COLUNAS"
    - "Aplicação manual de SQL no Supabase SQL Editor (owner/service_role) via checkpoint:human-action — consistente com D-04, projeto não usa supabase db push"

key-files:
  created:
    - "supabase/profiles-plan-privileges.sql"
  modified: []

key-decisions:
  - "REVOKE/GRANT column-level (padrão oficial Supabase) em vez de trigger PL/pgSQL custom — mecanismo nativo, sem lógica de aplicação a manter"
  - "Arquivo aditivo: NÃO altera a policy RLS (fica row-level, D-01) — só adiciona restrição de coluna por cima"
  - "Lista de colunas re-concedidas (name, group_targets) confirmada por grep de todas as chamadas .from('profiles').update( no repo — plan fora da lista por design"
  - "D-04 preservado: REVOKE só atinge authenticated; owner/service_role (SQL Editor) ignora privilégios de coluna, então o toggle de dev de tier continua funcionando"

patterns-established:
  - "Column-level security sobre profiles: authenticated só escreve name/group_targets; plan é read-only para o client SDK, escrevível apenas por owner/service_role"

requirements-completed: [GATE-03]

coverage:
  - id: D1
    description: "REVOKE UPDATE ON public.profiles FROM authenticated + GRANT UPDATE (name, group_targets) — arquivo SQL escrito com plan fora do GRANT"
    requirement: GATE-03
    verification:
      - kind: manual_procedural
        ref: "grep -ic 'revoke update on public.profiles from authenticated' && grep -ic 'grant update (name, group_targets) on public.profiles to authenticated' → ambos 1; plan só em comentário"
        status: pass
    human_judgment: false
  - id: D2
    description: "Migração aplicada no banco live: usuário authenticated NÃO consegue auto-escrever profiles.plan via client SDK"
    requirement: GATE-03
    verification:
      - kind: manual_procedural
        ref: "console: window.fidesDb.from('profiles').update({plan:'pro'}).eq('id',meuId) → erro de permissão, linha inalterada (confirmado pelo usuário)"
        status: pass
    human_judgment: true
    rationale: "Só verificável no runtime autenticado do browser contra o banco live — aplicação manual no SQL Editor (checkpoint:human-action, projeto não usa supabase db push)"
  - id: D3
    description: "Não-regressão: updates legítimos de name (updateProfile) e group_targets (setGroupTargets/resetGroupTargets) continuam salvando"
    requirement: GATE-03
    verification:
      - kind: manual_procedural
        ref: "app: editar Nome no Perfil + ajustar metas de grupo → ambos salvam sem erro (confirmado pelo usuário)"
        status: pass
    human_judgment: true
    rationale: "Verificação de não-regressão só possível exercitando o app live autenticado após o apply"
  - id: D4
    description: "D-04 preservado: dev alterna tier via UPDATE profiles SET plan='pro' no SQL Editor (owner ignora REVOKE de authenticated)"
    requirement: GATE-03
    verification:
      - kind: manual_procedural
        ref: "SQL Editor: UPDATE profiles SET plan='pro' WHERE id=meuId → funciona (confirmado pelo usuário)"
        status: pass
    human_judgment: true
    rationale: "Verificável apenas no SQL Editor do Supabase pós-apply, como owner/service_role"

# Metrics
duration: 18min
completed: 2026-07-16
status: complete
---

# Phase 13 Plan 02: Trava column-level de profiles.plan Summary

**REVOKE/GRANT column-level em `public.profiles` que impede o client SDK autenticado de auto-escrever `profiles.plan`, fechando a self-elevation de tier via RLS sem `WITH CHECK` (Pitfall 1 CRÍTICO) e aplicado no banco live via SQL Editor.**

## Performance

- **Duration:** ~18 min (inclui espera do checkpoint human-action)
- **Started:** 2026-07-16T17:03:49Z
- **Completed:** 2026-07-16T17:21:43Z
- **Tasks:** 2 (Task 1 auto + Task 2 checkpoint:human-action [BLOCKING])
- **Files modified:** 1 (novo)

## Accomplishments
- Criado `supabase/profiles-plan-privileges.sql`: `revoke update on public.profiles from authenticated;` + `grant update (name, group_targets) on public.profiles to authenticated;` — `plan` deliberadamente fora do GRANT.
- Fechado o headline threat do épico (Pitfall 1 CRÍTICO / T-13-01): a coluna que decide "quem paga" deixa de ser auto-outorgável pelo próprio usuário via `window.fidesDb.from('profiles').update({plan:'pro'})` no console.
- Database + security review conduzida diretamente pelo executor (sem Task-launcher de subagente ECC disponível — mesmo veículo usado nas Phases 12-06/12-07): **PASS, zero findings bloqueantes**.
- Migração aplicada no banco live pelo usuário via Supabase SQL Editor e verificada nos 3 eixos (trava de `plan`, não-regressão de name/group_targets, D-04 preservado).

## Task Commits

Cada task foi tratada atomicamente:

1. **Task 1: Escrever supabase/profiles-plan-privileges.sql (REVOKE/GRANT column-level)** - `ac033ad` (feat)
2. **Task 2: [BLOCKING] Aplicar o REVOKE/GRANT no banco live via SQL Editor** - sem commit de código (apply manual no banco live via checkpoint:human-action; nenhuma mudança de arquivo a versionar)

**Plan metadata:** commit de tracking (SUMMARY.md + STATE.md + ROADMAP.md)

## Files Created/Modified
- `supabase/profiles-plan-privileges.sql` - Privilégio de coluna que trava `profiles.plan` para a role `authenticated`, re-concedendo apenas `name`/`group_targets`. Header documenta propósito, referência de decisão (Pitfall P1 / D-01 / D-02), escopo D-04 (owner/service_role não afetado) e a origem da lista de colunas por grep.

## Decisions Made
- **REVOKE/GRANT column-level nativo, não trigger custom** — padrão oficial documentado pelo Supabase; sem lógica de aplicação a manter (Don't Hand-Roll do RESEARCH).
- **Arquivo estritamente aditivo** — a policy RLS `for all using (auth.uid() = id)` fica row-level como está (D-01). Este arquivo só adiciona a camada de coluna, não substitui nem endurece a policy.
- **Lista `(name, group_targets)` fechada por grep** — 3 ocorrências de `.from('profiles').update(` no repo, todas em `assets/fides-store.jsx` (linhas 1038 `name`, 1052 e 1064 `group_targets`); `api/assistant.js` só faz `SELECT plan` (linha 235), nunca UPDATE. Nenhuma terceira coluna client-editável (Assumption A1 confirmada no código-fonte).
- **D-04 preservado por design** — o REVOKE atinge só `authenticated`; owner/`service_role` do SQL Editor ignora privilégios de coluna, então `UPDATE profiles SET plan='pro'` como dev continua funcionando (confirmado pelo usuário no apply).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. A database+security review foi conduzida diretamente pelo executor porque o launcher de subagente ECC não estava disponível — comportamento previsto pelo próprio plan (`<how-to-verify>`: "Se o launcher de subagente ECC não estiver disponível, o executor conduz a revisão diretamente"). PASS sem findings.

## Database + Security Review (registro)

Conduzida diretamente pelo executor sobre `supabase/profiles-plan-privileges.sql` (caminho `supabase/` sensível — CLAUDE.md exige revisão antes do commit):

- ✅ Sintaxe REVOKE/GRANT correta (padrão oficial Supabase column-level security).
- ✅ `plan` confirmado FORA da lista do GRANT — só aparece em comentários/propósito (grep `plan` retorna apenas linhas de comentário).
- ✅ Aditivo — não toca a policy RLS existente; sem regressão de escopo de linha.
- ✅ Lista de colunas (`name`, `group_targets`) completa e correta vs. todos os call-sites `.from('profiles').update(` do repo — sem 3ª coluna esquecida que o REVOKE quebraria silenciosamente.
- ✅ `api/assistant.js` só lê `plan` (SELECT), nunca escreve — nenhuma escrita server-side afetada.
- ✅ Escopo D-04: REVOKE só atinge `authenticated`; owner/service_role não afetado.
- ✅ Idempotente (REVOKE/GRANT não acumulam nem falham em reaplicação).
- **Resultado: PASS — zero findings bloqueantes.**

## Verificação do apply live (checkpoint human-action, confirmado pelo usuário)

Usuário confirmou verbatim: "Aplicado, testes feitos e comando rodado no SQL do Supabase" — resume signal "aplicado":
- (a) **Trava de `plan` (P1 / T-13-01):** self-UPDATE de `plan` como `authenticated` via client SDK falha com erro de permissão; a linha não muda. ✅
- (b) **Não-regressão (T-13-01b):** edição de Nome (updateProfile → `name`) e ajuste de metas de grupo (setGroupTargets → `group_targets`) continuam salvando. ✅
- (c) **D-04 (T-13-01c):** toggle de dev via SQL Editor (`UPDATE profiles SET plan='pro'`) funciona (owner ignora o REVOKE). ✅

## Threat Register — dispositions atendidas
- **T-13-01** (Elevation of Privilege, high, mitigate): fechado — `plan` não é mais escrevível por `authenticated`.
- **T-13-01b** (regressão de name/group_targets, medium, mitigate): sem regressão confirmada no app live.
- **T-13-01c** (bypass do canal de dev, low, accept): D-04 preservado por design.
- **T-13-SC** (supply chain, n/a, accept): nenhum pacote instalado nesta plan.

## Next Phase Readiness
- Fonte da verdade do tier (`profiles.plan`) agora íntegra e não-outorgável pelo próprio usuário — o gate server-side de tier (13-03) e a UI de paywall (13-04) passam a assentar sobre um dado confiável.
- Sem blockers. Plan 13-04 (paywall UI + entradas de erro `FREE_MONTHLY_LIMIT`/`PREMIUM_REQUIRED`) é o próximo passo do gate premium.

---
*Phase: 13-ia-3-gating-premium-in-app*
*Completed: 2026-07-16*

## Self-Check: PASSED
- FOUND: supabase/profiles-plan-privileges.sql
- FOUND: 13-02-SUMMARY.md
- FOUND commit: ac033ad (Task 1)
