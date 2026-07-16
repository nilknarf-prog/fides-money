---
phase: 13-ia-3-gating-premium-in-app
plan: 01
subsystem: auth
tags: [supabase, react, useFides, tier-gating, fail-closed]

# Dependency graph
requires:
  - phase: 12-ia-2-write-in-app
    provides: store live (fides-store.jsx) já estável com refreshData/select de profiles nos 2 caminhos de carga
provides:
  - "userPlan (estado, default 'free') lido de profiles.plan nos 2 selects (login inicial + SIGNED_IN)"
  - "isPremium derivado via allow-list (plan==='pro'||plan==='family') exposto no context value e no fallback do useFides()"
  - "resetToMock zera userPlan no logout, evitando tier stale entre sessões"
affects: [13-02-gating-backend-privileges, 13-03-gating-assistant, 13-04-gating-ui-paywall]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Allow-list explícita para flags de tier (plan === 'pro' || plan === 'family'), nunca negação (!== 'free') — valor null/desconhecido cai em free"

key-files:
  created: []
  modified:
    - assets/fides-store.jsx

key-decisions:
  - "resetToMock (chamado no SIGNED_OUT) passou a zerar userPlan para 'free' — não estava no escopo literal do plan, mas é extensão direta do mesmo fail-closed (D-02): sem isso, um usuário premium que faz logout deixaria isPremium=true stale até reload."

patterns-established:
  - "Fail-closed allow-list tier check: isPremium = userPlan === 'pro' || userPlan === 'family', default 'free' em todo estado inicial/fallback/reset"

requirements-completed: [GATE-01]

coverage:
  - id: D1
    description: "Os 2 selects de profiles (login inicial e SIGNED_IN) trazem a coluna plan e gravam userPlan (default 'free') via setUserPlan"
    requirement: GATE-01
    verification:
      - kind: unit
        ref: "grep -c \"select('name, group_targets, plan')\" assets/fides-store.jsx == 2; grep -c \"setUserPlan(profile?.plan || 'free')\" assets/fides-store.jsx == 2"
        status: pass
    human_judgment: false
  - id: D2
    description: "useFides() expõe userPlan + isPremium (allow-list pro|family) no Provider e no fallback sem provider, ambos fail-closed"
    requirement: GATE-01
    verification:
      - kind: unit
        ref: "grep -n \"isPremium: userPlan === 'pro' || userPlan === 'family'\" assets/fides-store.jsx; grep -n \"userPlan: 'free', isPremium: false\" assets/fides-store.jsx; grep -c \"userPlan !== 'free'\" assets/fides-store.jsx == 0"
        status: pass
    human_judgment: true
    rationale: "Verificação funcional real (alternar profiles.plan via SQL Editor e observar isPremium refletir no app) exige sessão no app e não é automatizável neste executor — batelada em /gsd-verify-work conforme a própria plan define (human-check)."

duration: 3min
completed: 2026-07-16
status: complete
---

# Phase 13 Plan 01: Store lê profiles.plan e expõe userPlan/isPremium Summary

**Store live passa a ler `profiles.plan` nos 2 caminhos de carga e expõe `userPlan`/`isPremium` (allow-list fail-closed) via `useFides()`, substituindo a dependência do mock morto `USER.plan:'Pro'`.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-07-16T16:43:57Z
- **Completed:** 2026-07-16T16:46:45Z
- **Tasks:** 2/2
- **Files modified:** 1

## Accomplishments
- `assets/fides-store.jsx`: os 2 selects de `profiles` (bootstrap inicial via `getAuthUser()` e re-fetch em `SIGNED_IN`) agora trazem `plan` junto de `name, group_targets`
- Novo estado `userPlan` (default `'free'`) gravado nos dois caminhos de carga via `setUserPlan(profile?.plan || 'free')`
- `useFides()` expõe `userPlan` + `isPremium` (allow-list `plan === 'pro' || plan === 'family'`) tanto no `value` do Provider quanto no objeto de fallback (sem provider) — fail-closed em ambos
- `resetToMock` (disparado no `SIGNED_OUT`) zera `userPlan` para `'free'`, evitando tier premium "grudado" após logout

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Ler `plan` nos 2 selects de profiles + estado userPlan fail-closed** - `872c4fc` (feat)
2. **Task 2: Expor userPlan/isPremium (allow-list) no context value e no fallback** - `bd3aaf1` (feat)

**Plan metadata:** (a registrar no commit final desta plan)

## Files Created/Modified
- `assets/fides-store.jsx` - estado `userPlan`, leitura de `plan` nos 2 selects de `profiles`, `isPremium` derivado (allow-list) no `value` do Provider e no fallback do `useFides()`, reset em `resetToMock`

## Decisions Made
- `resetToMock` também zera `userPlan` no logout — não estava explicitamente nas tasks da plan, mas é extensão direta do mesmo princípio fail-closed (D-02): sem isso, `isPremium` ficaria `true` residualmente após um usuário premium sair da conta, até o próximo reload completo do app.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `resetToMock` não zerava `userPlan` no logout**
- **Found during:** Task 1 (revisão do fluxo de auth bootstrap após adicionar o estado `userPlan`)
- **Issue:** `resetToMock()` (chamado no branch `else` do `onAuthStateChange`, i.e. usuário deslogado) reseta `userName`/`userEmail` mas não resetaria `userPlan` — um usuário premium que faz logout no mesmo carregamento de página deixaria `isPremium` `true` até um refresh completo, quebrando o fail-closed do gate de UI.
- **Fix:** Adicionado `setUserPlan('free')` ao final de `resetToMock`.
- **Files modified:** `assets/fides-store.jsx`
- **Verification:** Leitura de código confirma que `resetToMock` agora cobre os 4 campos de identidade/tier resetados no logout; não há teste automatizado neste plan (SPA sem test runner), consistente com o resto do arquivo.
- **Committed in:** `872c4fc` (parte do commit da Task 1)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Extensão necessária para manter o fail-closed (D-02) coerente em todo o ciclo de vida do estado (login → logout), sem alterar o escopo das 2 tasks da plan. Sem scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `useFides().isPremium` disponível para consumo pelos Plans 13-02 (REVOKE/GRANT column-level em `profiles.plan`, [BLOCKING] para travar auto-escrita via client SDK), 13-03 (gating do assistente) e 13-04 (paywall de UI: badge PerfilView, gate do botão Análise da IA, mapa de erro do chat).
- **Atenção (rastreada no próprio `<threat_model>` da plan, T-13-01):** este plan apenas LÊ `profiles.plan` — a coluna ainda não está protegida contra auto-escrita via client SDK. Isso é [BLOCKING] para o Plan 13-02; sem ele, qualquer usuário pode se auto-outorgar `plan='pro'` via chamada direta ao Supabase client.
- Human-verify funcional (alternar `profiles.plan` via SQL Editor e observar `isPremium` no app) fica para o batch de `/gsd-verify-work` da Phase 13, conforme a própria plan já define.

---
*Phase: 13-ia-3-gating-premium-in-app*
*Completed: 2026-07-16*

## Self-Check: PASSED
- FOUND: assets/fides-store.jsx
- FOUND: .planning/phases/13-ia-3-gating-premium-in-app/13-01-SUMMARY.md
- FOUND: commit 872c4fc
- FOUND: commit bd3aaf1
