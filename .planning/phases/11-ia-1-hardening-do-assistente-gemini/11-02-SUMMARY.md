---
phase: 11-ia-1-hardening-do-assistente-gemini
plan: 02
subsystem: api
tags: [security, gemini, jwt, function-calling, vercel-functions]

# Dependency graph
requires:
  - "api/_lib/gemini.js buildPayload com toolMode 'NONE' (11-01)"
provides:
  - "api/assistant.js lendo o token de req.headers.authorization (Bearer), nunca de req.body"
  - "flag mode='analysis' whitelisted que ramifica buildPayload para toolMode NONE (sem tools)"
affects: [11-03, 11-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Token de sessão transportado via header Authorization: Bearer (não mais no corpo do POST) — reduz superfície capturada por request-logging/proxies"
    - "Flags de modo no body validados por whitelist estrita (===) em vez de truthy check — qualquer valor não reconhecido cai no comportamento default seguro"

key-files:
  modified:
    - api/assistant.js

key-decisions:
  - "isAnalysisMode = mode === 'analysis' (comparação estrita, não truthy) — único valor aceito é a string exata; qualquer outro valor/ausência preserva o chat com tools AUTO (T-11-02-03)"
  - "tools: isAnalysisMode ? undefined : TOOLS_DECLARATION — no modo análise nem envia o array de tools ao buildPayload (opção A da pesquisa: omitir tools E toolConfig NONE, mais econômico em payload)"
  - "Token extraído via authHeader.startsWith('Bearer ') + slice(7).trim() — aceita só o esquema Bearer explícito, sem fallback silencioso para outros formatos"

requirements-completed: [WR-02, WR-03]

# Metrics
duration: ~10min
completed: 2026-07-06
status: complete
---

# Phase 11 Plan 02: Hardening do contrato de requisição — JWT no header + toolConfig NONE na análise Summary

**WR-03 move a leitura do JWT de sessão do corpo do POST para o header `Authorization: Bearer` em `api/assistant.js` (fix de segurança do review da fase 05); WR-02 faz o caminho de "Análise da IA" proibir function-calling via `toolConfig.mode='NONE'` quando `mode==='analysis'`, eliminando o erro genérico que fechava a análise gastando cota — o chat conversacional mantém as tools READ intactas.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 2
- **Files modified:** 1 (`api/assistant.js`)

## Accomplishments

- Token de sessão agora lido de `req.headers.authorization` (chave em minúsculas — normalização do Node), reconhecendo o esquema `Bearer ` com `trim()`. Removido da desestruturação de `req.body` (`messages, context, toolResults` — sem `jwt`/`token`).
- Guarda de token ausente preservada (`401 JWT_MISSING`), só mudou a fonte do valor. `createClient` (header `Authorization`) e `supabase.auth.getUser(token)` seguem idênticos, aceitando o mesmo token.
- Nenhum `console.*` recebe `req.headers` cru — grep negativo confirmado (evita vazar o token de sessão nos logs Vercel).
- Novo flag `mode` lido do body, validado por whitelist estrita (`mode === 'analysis'`); qualquer outro valor ou ausência preserva o comportamento de chat (default).
- Quando `mode === 'analysis'`: `buildPayload` chamado com `toolMode: 'NONE'` e `tools: undefined` — o modelo Gemini nunca emite `functionCall`, então o branch `tool_calls` do handler nunca é atingido para a análise; sempre retorna `reply`.
- Quando não é análise (chat): `toolMode: 'AUTO'` + `tools: TOOLS_DECLARATION` — tools READ (`consultar_saldo`/`consultar_extrato`) inalteradas.

## Task Commits

Each task was committed atomically:

1. **Task 1: WR-03 — servidor lê o JWT do header Authorization** - `c973c81` (fix)
2. **Task 2: WR-02 — modo análise proíbe tools (toolConfig mode NONE)** - `5ad268a` (feat)

_Sem tasks TDD neste plano — projeto não tem test runner (verificação por inspeção estática + human-verify, conforme 11-RESEARCH.md)._

## Files Created/Modified

- `api/assistant.js` — leitura do token migrada para `req.headers.authorization`; token removido da desestruturação de `req.body`; novo flag `mode` whitelisted ramificando `toolMode`/`tools` passados a `gemini.buildPayload`.

## Verification (estática)

Automated checks do plano, rodados contra o estado final commitado:

```
$ grep -nE "req\.headers\.authorization" api/assistant.js
108:    const authHeader = req.headers.authorization || '';
126:      global: { headers: { Authorization: `Bearer ${token}` } },

$ grep -nE "Bearer" api/assistant.js
109:    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
126:      global: { headers: { Authorization: `Bearer ${token}` } },

$ grep -nc "console.*req\.headers" api/assistant.js
0   → PASS: nenhum console recebe req.headers cru

$ grep -nE "analysis" api/assistant.js
115:    // WR-02: flag de modo validado por whitelist — só 'analysis' é reconhecido.
116:    const isAnalysisMode = mode === 'analysis';

$ grep -nE "toolMode" api/assistant.js
198:      toolMode: isAnalysisMode ? 'NONE' : 'AUTO',

$ node -c api/assistant.js
SYNTAX OK
```

### W-2 — prova negativa extra (STATE.md operator notes)

Confirmando que `jwt`/`token` saíram da desestruturação de `req.body`:

```
$ grep -nE "req\.headers\.authorization" api/assistant.js
108:    const authHeader = req.headers.authorization || '';

$ grep -nE "const \{[^}]*\} = req\.body" api/assistant.js
100:    const { messages, context, toolResults, mode } = req.body || {};
```

A linha 100 (única desestruturação de `req.body` no arquivo) contém `messages, context, toolResults, mode` — **sem** `jwt` e **sem** `token`. O token só é lido do header (linhas 108-109). W-2 confirmado.

## Decisions Made

- `isAnalysisMode = mode === 'analysis'` usa comparação estrita (não truthy) — string exata é o único valor reconhecido; qualquer payload malicioso ou malformado no campo `mode` cai automaticamente no default seguro (chat com tools AUTO), satisfazendo T-11-02-03 (V5 ASVS Input Validation).
- `tools: isAnalysisMode ? undefined : TOOLS_DECLARATION` — no modo análise o array de tools nem é enviado ao `buildPayload` (em vez de enviar tools e confiar só no `toolConfig NONE` para bloquear) — opção A da pesquisa, mais econômica em payload e redundante em segurança (dupla barreira: nem declara a tool, nem permite chamá-la).

## Deviations from Plan

None - plano executado exatamente como escrito. Ambas as tasks tocam o mesmo arquivo em regiões próximas; para manter commits atômicos por task (conforme protocolo), a Task 2 foi temporariamente revertida, a Task 1 commitada isolada, e então a Task 2 reaplicada e commitada em seguida — sem perda de granularidade nos commits finais (diff de cada commit contém só as linhas da sua task, confirmado via `git diff --cached` antes de cada commit).

## Security Review (caminho sensível `api/`)

CLAUDE.md exige revisão de segurança antes de commitar mudanças em `api/`. O agent `security-reviewer` do ECC não está disponível como subagente neste ambiente de execução (sem tool de spawn de subagente); tentei `/ecc:security-scan`, mas o scanner (AgentShield) audita configs/hooks/MCP do próprio agente, não lógica de aplicação — não aplicável a este diff. Revisão manual feita contra o threat register do plano:

- **T-11-02-01 (Information Disclosure — transporte do JWT):** mitigado. Token migrou de `req.body` para `req.headers.authorization` (esquema Bearer); menos exposto a request-logging/analytics/proxies que tipicamente inspecionam bodies, não headers de auth padrão (RFC 6750).
- **T-11-02-02 (Information Disclosure — logs do servidor):** mitigado. Grep negativo confirma que nenhum `console.*` recebe `req.headers` cru; os únicos `console.error` existentes seguem logando apenas `errorCode`/status do Supabase/Gemini (padrão pré-existente, inalterado).
- **T-11-02-03 (Tampering / Input Validation — flag `mode`):** mitigado. Comparação estrita `=== 'analysis'`; nenhum outro valor de `mode` influencia o payload — cai no default (chat, tools AUTO).
- **T-11-02-04 (Elevation of Privilege — superfície de function-calling):** mitigado. `toolConfig.mode='NONE'` + omissão de `tools` no caminho análise; chat mantém as duas tools READ (`consultar_saldo`, `consultar_extrato`) — nenhuma tool WRITE reativada, consistente com o modo apenas-consulta do IA-1.
- **T-11-02-SC (npm installs):** N/A confirmado — `git diff` não introduz nenhum `require` novo; `package.json`/`package-lock.json` não tocados por este plano.

Nenhuma superfície de segurança nova além do exposto no threat register do plano (sem novos endpoints, sem mudança de schema, sem RPCs tocados).

## Atomicidade de deploy (W-1 — honrado)

Nenhum `git push` foi executado. `api/assistant.js` agora **exige** o token no header Authorization — se isso for pra produção isolado, o chat/análise quebram com 401 até os callers migrarem (plano 11-04). O commit fica local, aguardando o push atômico único ao final da fase (após 11-04 atualizar os 2 callers `.jsx` para enviar o header em vez do body).

## User Setup Required

None - nenhuma configuração externa necessária. Push continua segurado (orquestrador da fase controla o único push atômico ao final).

## Next Phase Readiness

- `api/assistant.js` pronto para os callers migrarem no plano 11-04 (enviar `Authorization: Bearer <token>` no header em vez de `jwt` no body; enviar `mode: 'analysis'` no botão de Análise da IA).
- Nenhum bloqueio conhecido. Human-verify (token no header via DevTools; análise sempre retorna texto; chat mantém tools) fica pendente para a UAT de fase (`/gsd-verify-work 11`), após o push atômico ao final da fase 11 (W-1).

---
*Phase: 11-ia-1-hardening-do-assistente-gemini*
*Completed: 2026-07-06*

## Self-Check: PASSED

- FOUND: api/assistant.js
- FOUND commit: c973c81
- FOUND commit: 5ad268a
