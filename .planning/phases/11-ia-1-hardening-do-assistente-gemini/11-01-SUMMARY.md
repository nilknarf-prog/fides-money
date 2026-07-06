---
phase: 11-ia-1-hardening-do-assistente-gemini
plan: 01
subsystem: api
tags: [gemini, commonjs, vercel-functions, refactor, function-calling]

# Dependency graph
requires: []
provides:
  - "api/_lib/gemini.js — helper Gemini CommonJS não-roteável (buildPayload/callGemini/parseResponse)"
  - "api/assistant.js consumindo o helper para payload/call/parse"
  - "ponto de extensão toolMode 'NONE' pronto para WR-02 (11-02)"
  - "parseResponse já retorna usageMetadata (fallback null) — base para AI-TELEM-01"
affects: [11-02, 11-03, 11-04, 14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vercel: diretório api/_lib/ com prefixo underscore = biblioteca não-roteável, importável via require relativo"
    - "callGemini normaliza { ok, status, errorCode, data } em vez de escrever em res — deixa a decisão de status HTTP para o handler caller"

key-files:
  created:
    - api/_lib/gemini.js
  modified:
    - api/assistant.js

key-decisions:
  - "toolMode 'AUTO' explícito na chamada do chat em api/assistant.js — preserva tools READ sem regressão, e já deixa o parâmetro pronto para o caminho de análise (WR-02) usar 'NONE'"
  - "GEMINI_MODEL/GEMINI_ENDPOINT desestruturados do helper em api/assistant.js (fonte única, sem duplicata local) mesmo GEMINI_MODEL não sendo mais referenciado diretamente no handler"

patterns-established:
  - "Módulo Gemini compartilhado: payload/call/parse centralizados em api/_lib/gemini.js para api/whatsapp.js (fase 14) reusar sem divergência"

requirements-completed: [AI-SHARED-01]

# Metrics
duration: ~5min
completed: 2026-07-06
status: complete
---

# Phase 11 Plan 01: Helper Gemini compartilhado (AI-SHARED-01) Summary

**Extraiu api/_lib/gemini.js (buildPayload/callGemini/parseResponse) do handler api/assistant.js, sem mudar comportamento observável do chat nem da Análise da IA — refactor puro que já prevê os pontos de extensão toolMode e usageMetadata para os próximos plans (WR-02, AI-TELEM-01).**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-06T20:38:00Z (aprox.)
- **Completed:** 2026-07-06T20:42:21-04:00
- **Tasks:** 2
- **Files modified:** 2 (1 criado, 1 modificado)

## Accomplishments
- `api/_lib/gemini.js` criado: helper CommonJS puro exportando `GEMINI_MODEL`, `GEMINI_ENDPOINT`, `buildPayload`, `callGemini`, `parseResponse` — nenhuma assinatura de handler `(req, res)`, prefixo `_` garante que a Vercel não o registre como Serverless Function.
- `api/assistant.js` reconectado ao helper: payload/fetch/parsing inline removidos, substituídos por `gemini.buildPayload(...)`, `gemini.callGemini(...)` e `gemini.parseResponse(...)`. Os três branches de resposta (`tool_calls`, `EMPTY_REPLY`, `reply`) e os errorCodes (`RATE_LIMIT`, `GEMINI_BAD_REQUEST`, `GEMINI_ERROR`) permanecem idênticos.
- `buildPayload` já suporta `toolMode: 'NONE'` (omite `tools`, seta `toolConfig.functionCallingConfig.mode = 'NONE'`) — pronto para o 11-02 (WR-02) usar no caminho de análise sem tocar o helper de novo.
- `parseResponse` já retorna `usageMetadata` (fallback `null` quando ausente) — pronto para o 11-02/AI-TELEM-01 gravar tokens/latência sem alterar a assinatura.

## Task Commits

Each task was committed atomically:

1. **Task 1: Criar o helper api/_lib/gemini.js** - `63aa33b` (feat)
2. **Task 2: Reconectar api/assistant.js ao helper** - `4ac32b2` (refactor)

_Sem tasks TDD neste plano — projeto não tem test runner (verificação por inspeção estática + human-verify, conforme 11-RESEARCH.md)._

## Files Created/Modified
- `api/_lib/gemini.js` - Helper Gemini CommonJS: constantes de modelo/endpoint, `buildPayload` (payload + safetySettings + toolConfig condicional), `callGemini` (fetch normalizado, sem escrever em `res`), `parseResponse` (toolCalls/textReply/finishReason/usageMetadata)
- `api/assistant.js` - Handler HTTP: `require('./_lib/gemini')`, delega payload/call/parse ao helper; auth JWT (body, ainda — WR-03 é o 11-02), rate-limit `assistant_usage`, `SYSTEM_PROMPT`, `TOOLS_DECLARATION` permanecem inalterados no handler

## Decisions Made
- `toolMode: 'AUTO'` foi passado explicitamente na chamada de `buildPayload` em `api/assistant.js` (em vez de deixar implícito), documentando no próprio call-site que o chat usa o modo padrão com tools ativas — facilita o diff do 11-02 quando o caminho de análise precisar de `'NONE'`.
- Mantive a desestruturação `const { GEMINI_MODEL, GEMINI_ENDPOINT } = gemini;` em `api/assistant.js` mesmo `GEMINI_MODEL` não sendo mais referenciado diretamente ali (só documental/paridade) — decisão de menor risco que remover e potencialmente esquecer de reintroduzir em plano futuro; sem impacto funcional (projeto não tem linter configurado para acusar variável não usada).

## Deviations from Plan

None - plan executado exatamente como escrito.

## Issues Encountered
None. Testado via `node -e` isolado (smoke test manual do módulo, fora do runtime Vercel): `buildPayload` com `toolMode: 'NONE'` omite `tools` e seta `toolConfig.functionCallingConfig.mode='NONE'` corretamente; `toolMode: 'AUTO'` mantém `tools`; `parseResponse` retorna `usageMetadata` quando presente e `null` quando ausente, e separa `toolCalls`/`textReply` corretamente. `node -c api/assistant.js` confirma sintaxe válida.

## Security Review (caminho sensível api/)

Revisão manual contra o threat register do plano (sem agent dedicado disponível neste ambiente de execução):
- **T-11-01-01 (Information Disclosure):** `callGemini` loga apenas `status` e o corpo de erro da RESPOSTA do Gemini (`errBody`) em caso de falha — nunca a `apiKey` nem o payload da requisição. Consistente com o padrão anterior.
- **T-11-01-02 (Tampering — nomes de errorCode):** `RATE_LIMIT`, `GEMINI_BAD_REQUEST`, `GEMINI_ERROR`, `EMPTY_REPLY` preservados byte-a-byte no handler; grep confirma presença dos 3 primeiros no diff e `EMPTY_REPLY` permanece no branch original.
- **T-11-01-03 (Elevation of Privilege — superfície de rota):** `api/_lib/gemini.js` não exporta handler `(req, res)`; prefixo `_lib` confirmado pela pesquisa como não-roteável na Vercel. Nenhum endpoint novo.
- **T-11-01-SC (npm installs):** N/A — zero `require` de terceiros novos.

Nenhuma superfície de segurança nova introduzida (refactor puro, sem mudança em auth/RLS/RPCs).

## User Setup Required

None - nenhuma configuração externa necessária.

## Next Phase Readiness
- `api/_lib/gemini.js` pronto para o 11-02 (WR-02: `toolConfig.mode='NONE'` no caminho de análise) usar `toolMode: 'NONE'` sem tocar o helper novamente.
- `parseResponse` já expõe `usageMetadata` — 11-02/AI-TELEM-01 pode ler direto sem mudar a assinatura do helper.
- Nenhum bloqueio conhecido. Human-verify (chat + Análise da IA idênticos ao anterior) fica pendente para a UAT de fase (`/gsd-verify-work 11`), conforme W-1 (push segurado até 11-04 concluir).

---
*Phase: 11-ia-1-hardening-do-assistente-gemini*
*Completed: 2026-07-06*

## Self-Check: PASSED

- FOUND: api/_lib/gemini.js
- FOUND: api/assistant.js
- FOUND commit: 63aa33b
- FOUND commit: 4ac32b2
