---
phase: 13-ia-3-gating-premium-in-app
plan: 03
subsystem: api
tags: [gemini, function-calling, supabase, tier-gating, fail-closed, rate-limit]

# Dependency graph
requires:
  - phase: 13-ia-3-gating-premium-in-app (13-01)
    provides: "padrão fail-closed allow-list (plan === 'pro' || plan === 'family') já estabelecido em fides-store.jsx, espelhado aqui no server"
  - phase: 12-ia-2-write-in-app
    provides: "4 tools WRITE (lancar/recategorizar/editar_transacao, criar_categoria) + nonce anti-replay + rate-limit diário já vivos em api/assistant.js"
provides:
  - "api/assistant.js lê profiles.plan server-side (fonte da verdade), allow-list fail-closed (plan === 'pro' || plan === 'family'), default 'free'"
  - "GATE-03 parte 1: mode:'analysis' com !isPremium retorna 403 PREMIUM_REQUIRED antes de qualquer chamada ao Gemini"
  - "READ_FUNCTIONS/WRITE_FUNCTIONS (split de TOOLS_DECLARATION) + buildToolsForPlan(isPremium) — free recebe só as 2 tools READ no payload do Gemini, premium recebe READ+WRITE"
  - "FREE_TIER_ADDENDUM concatenado no system prompt quando !isPremium, para o modelo nunca prometer WRITE que não tem"
  - "GATE-02: cap de 10 msg/mês para free sobre assistant_usage (janela = mês calendário UTC), guardado por isFirstCallOfTurn + !isPremium, fail-open no erro de count; 429 FREE_MONTHLY_LIMIT na 11ª"
affects: [13-04-gating-ui-paywall]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-closed allow-list tier check no server: isPremium = plan === 'pro' || plan === 'family', nunca negação (plan !== 'free') — mesmo padrão do client (13-01)"
    - "Gate de tier roda SEMPRE antes do Gemini, independente de toolResults/nonce — fecha bypass por chamada direta com mode:'analysis' ou toolResults forjado (T-13-02)"
    - "Cota mensal sem tabela/coluna/job novo: filtro gte(startOfMonthUTC) recalculado a cada request auto-reseta no dia 1 (Don't Hand-Roll), espelhando o cap diário existente"

key-files:
  created: []
  modified:
    - api/assistant.js

key-decisions:
  - "Comentário explicativo do allow-list reescrito para não conter literalmente a substring \"plan !== 'free'\" entre crases, evitando falso-positivo no grep negativo de verificação da própria plan (D-02 continua sendo o princípio; só o texto do comentário mudou)."

patterns-established:
  - "buildToolsForPlan(isPremium): helper puro que devolve [{ functionDeclarations }] montado por tier — mesma forma que o Gemini já esperava de TOOLS_DECLARATION, sem mudar o call-site do gemini.buildPayload além da própria referência"

requirements-completed: [GATE-02, GATE-03]

coverage:
  - id: D1
    description: "plan lido fail-closed via allow-list server-side (profiles.plan); Análise da IA retorna 403 PREMIUM_REQUIRED para free antes do Gemini, roda independente de toolResults/nonce"
    requirement: GATE-03
    verification:
      - kind: unit
        ref: "grep -c \"let plan = 'free'\" api/assistant.js == 1; grep -c \"const isPremium = plan === 'pro' || plan === 'family'\" api/assistant.js == 1; grep -c \"plan !== 'free'\" api/assistant.js == 0; grep -n \"PREMIUM_REQUIRED\" api/assistant.js"
        status: pass
    human_judgment: true
    rationale: "A plan exige verificação funcional (fetch direto no console forçando mode:'analysis' como free retorna 403; como pro funciona) — não automatizável neste executor sem sessão real no app. Fica para o batch de /gsd-verify-work."
  - id: D2
    description: "Tools montadas por tier via buildToolsForPlan; free recebe só READ_FUNCTIONS, premium READ+WRITE; FREE_TIER_ADDENDUM injetado quando !isPremium"
    requirement: GATE-03
    verification:
      - kind: unit
        ref: "grep -c \"const READ_FUNCTIONS\"/\"const WRITE_FUNCTIONS\"/\"buildToolsForPlan\" api/assistant.js; grep -c \"tools: isAnalysisMode ? undefined : TOOLS_DECLARATION\" api/assistant.js == 0; grep -c \"FREE_TIER_ADDENDUM\" api/assistant.js == 2; node -c api/assistant.js"
        status: pass
    human_judgment: true
    rationale: "A plan exige verificação funcional (como free, pedir lançamento nunca abre card de confirmação; como pro, abre — regressão Phase 12) — requer sessão real no app, fica para /gsd-verify-work."
  - id: D3
    description: "Cap de 10 msg/mês para free sobre assistant_usage (mês calendário UTC), guardado por isFirstCallOfTurn+!isPremium, fail-open no erro de count; 429 FREE_MONTHLY_LIMIT na 11ª; premium não afetado"
    requirement: GATE-02
    verification:
      - kind: unit
        ref: "grep -n \"const FREE_TIER_MONTHLY_LIMIT = 10\"/\"FREE_MONTHLY_LIMIT\"/\"getUTCMonth\" api/assistant.js; leitura confirma bloco dentro de isFirstCallOfTurn + !isPremium, fail-open único caminho de erro"
        status: pass
    human_judgment: true
    rationale: "A plan exige teste funcional com 11 mensagens reais (11ª retorna 429) e checagem via SQL Editor de que 1 turno com round-trip de tool grava só 1 linha em assistant_usage — requer sessão real e SQL Editor, fica para /gsd-verify-work."

duration: ~10min
completed: 2026-07-16
status: complete
---

# Phase 13 Plan 03: Gate de tier server-side no assistente (READ/WRITE + cap mensal free) Summary

**`api/assistant.js` passa a diferenciar capacidade por `profiles.plan` server-side: Análise da IA vira premium-only (403), o array de tools do Gemini é montado condicionalmente via `buildToolsForPlan` (free nunca recebe as declarações WRITE), e free ganha cap de 10 msg/mês sobre `assistant_usage`.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-16T16:49Z (aprox.)
- **Completed:** 2026-07-16T16:55Z
- **Tasks:** 3/3
- **Files modified:** 1

## Accomplishments
- `api/assistant.js` lê `profiles.plan` logo após validar o JWT (mesmo client `supabase` já criado, com `Authorization: Bearer`), default `'free'` fail-closed em qualquer erro/linha ausente/valor desconhecido; deriva `isPremium` por allow-list (`pro`/`family`), nunca por negação
- GATE-03 parte 1: `mode:'analysis' && !isPremium` retorna `403 PREMIUM_REQUIRED` ANTES da chamada ao Gemini — roda sempre, fecha o bypass por chamada direta (D-01)
- `TOOLS_DECLARATION` dividido em `READ_FUNCTIONS` (2 tools) e `WRITE_FUNCTIONS` (4 tools, conteúdo idêntico ao Phase 12, incluindo `tipo_destino` de 12-07); novo helper `buildToolsForPlan(isPremium)` monta o array por tier no mesmo shape que o Gemini já esperava
- Call-site do `gemini.buildPayload` passa a usar `buildToolsForPlan(isPremium)` no lugar da constante estática — free literalmente não recebe as declarações WRITE no payload enviado ao modelo
- `FREE_TIER_ADDENDUM` concatenado em `fullSystem` quando `!isPremium`, no mesmo estilo string-concat do `ANALYSIS_ADDENDUM` já existente — instrui o modelo a nunca fingir executar uma escrita que não tem
- `FREE_TIER_MONTHLY_LIMIT = 10` + bloco de cap mensal dentro do mesmo `if (isFirstCallOfTurn)` que já governa o rate-limit diário, gateado adicionalmente por `!isPremium`: conta sobre `assistant_usage` com janela `startOfMonthUTC` (mês calendário UTC), fail-open no erro de leitura do count, `429 FREE_MONTHLY_LIMIT` na 11ª mensagem — sem tabela/coluna/job novo (auto-reset via filtro `gte`)

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Ler profiles.plan fail-closed + gate premium-only da Análise da IA** - `2221196` (feat)
2. **Task 2: Split READ/WRITE tools + buildToolsForPlan + FREE_TIER_ADDENDUM** - `438826a` (feat)
3. **Task 3: Cap mensal de degustação free (10 msg/mês) sobre assistant_usage** - `0ac1dbc` (feat)

**Plan metadata:** (a registrar no commit final desta plan)

## Files Created/Modified
- `api/assistant.js` - leitura fail-closed de `profiles.plan`, gate 403 `PREMIUM_REQUIRED` na Análise da IA, split `READ_FUNCTIONS`/`WRITE_FUNCTIONS` + `buildToolsForPlan(isPremium)`, `FREE_TIER_ADDENDUM`, cap mensal `FREE_TIER_MONTHLY_LIMIT=10` com 429 `FREE_MONTHLY_LIMIT`

## Decisions Made
- Comentário do allow-list reescrito para não conter literalmente `plan !== 'free'` entre crases (o texto original citava o padrão proibido como exemplo negativo, o que colidia com o próprio grep negativo `D-02` da plan). O princípio (nunca usar negação direta) permanece; só a redação do comentário mudou para não ativar o próprio guard de verificação.

## Deviations from Plan

None - plan executado exatamente como escrito (as 3 tasks seguiram o `<action>` de cada uma ponto a ponto; o único ajuste foi textual em um comentário, sem impacto de comportamento — ver "Decisions Made" acima).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Threat Flags
None - todos os 6 threats do `<threat_model>` da plan (T-13-02, T-13-04, T-13-06, T-13-03, T-13-05, T-13-SC) já estavam mapeados; nenhuma superfície nova fora do threat model foi introduzida.

## Next Phase Readiness
- `PREMIUM_REQUIRED` (403) e `FREE_MONTHLY_LIMIT` (429) prontos para o Plan 13-04 mapear em `friendlyError`/`friendlyAiError` (client) e acionar a UI de paywall.
- `buildToolsForPlan`/`FREE_TIER_ADDENDUM` fecham a parte "núcleo não-burlável" do GATE-03 (servidor); a parte de UI (esconder botões/CTA para free) fica para 13-04 — é conveniência, não segurança, já que o servidor recusa a capacidade independentemente do que o cliente mostra.
- Human-verify funcional (403 na Análise como free, ausência de card de confirmação de WRITE como free, 11ª mensagem retornando 429, checagem via SQL Editor do não-double-count por turno) fica para o batch de `/gsd-verify-work` da Phase 13, conforme a própria plan já define.
- Risco residual T-13-03 (RPC `wa_log_transaction` sem checagem de `plan`, chamável fora de `/api/assistant`) segue **aceito por D-01** — nenhuma ação pendente deste plan.

---
*Phase: 13-ia-3-gating-premium-in-app*
*Completed: 2026-07-16*

## Self-Check: PASSED
- FOUND: api/assistant.js
- FOUND: .planning/phases/13-ia-3-gating-premium-in-app/13-03-SUMMARY.md
- FOUND: commit 2221196
- FOUND: commit 438826a
- FOUND: commit 0ac1dbc
