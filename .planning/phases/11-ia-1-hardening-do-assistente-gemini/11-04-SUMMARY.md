---
phase: 11-ia-1-hardening-do-assistente-gemini
plan: 04
subsystem: ai
tags: [react, babel-standalone, jwt, gemini, fetch, cooldown]

# Dependency graph
requires:
  - phase: 11-ia-1-hardening-do-assistente-gemini (plan 02)
    provides: "api/assistant.js exige Authorization Bearer + aceita mode:'analysis' com toolConfig NONE"
provides:
  - "Cooldown (WR-01) no botao 'Análise da IA' (PlnMesInsights), mesmo padrao do chat (4s normal / 60s rate limit)"
  - "Os dois callers cliente (fides-orcamento.jsx e fides-claude.jsx) enviam o JWT via header Authorization: Bearer, nunca mais no corpo do POST (WR-03)"
  - "Caller de analise envia mode:'analysis' e removeu o branch morto que tratava function-calling como erro (WR-02 cliente)"
affects: [12-ia-2, 13-ia-3, 14-ia-4-whatsapp]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cooldown array-indexed state (var stX = React.useState(); var x = stX[0]; var setX = stX[1];) replicado em fides-orcamento.jsx a partir do padrao ja existente em fides-claude.jsx"
    - "Constantes de cooldown (COOLDOWN_NORMAL_SEC/COOLDOWN_RATELIMIT_SEC) duplicadas por arquivo (sem modulo compartilhado, ambos .jsx sao IIFEs independentes carregados via script tag)"
    - "JWT sempre no header Authorization: Bearer, nunca no corpo do fetch para /api/assistant"

key-files:
  created: []
  modified:
    - assets/fides-orcamento.jsx
    - assets/fides-claude.jsx

key-decisions:
  - "11-04: cooldown do botao de analise nao arma no caminho JWT_MISSING, espelhando exatamente o comportamento do chat (fides-claude.jsx tambem nao arma cooldown nesse caminho)"
  - "11-04: erro !res.ok arma 60s quando res.status===429 OU errCode e USER_DAILY_LIMIT/RATE_LIMIT; demais erros armam 4s — igual ao chat"
  - "11-04: branch morto de function-calling removido do handleAiClick (servidor em mode='analysis' nunca retorna tool_calls, dado toolConfig NONE do plano 11-02)"

patterns-established:
  - "Pattern: countdown de cooldown via useEffect no topo do componente com setTimeout+updater funcional (Math.max(0, c-1)), nunca dentro de handler ou condicional"

requirements-completed: [WR-01, WR-02, WR-03]

# Metrics
duration: ~10min
completed: 2026-07-06
status: complete
---

# Phase 11 Plan 04: Cliente migra JWT para header Authorization + cooldown no botão de análise Summary

**Cooldown portado do chat para o botão "Análise da IA" e os dois callers (chat + análise) migraram o JWT do corpo do POST para o header `Authorization: Bearer`, com o caller de análise passando a enviar `mode:'analysis'` e sem o branch morto de function-calling.**

## Performance

- **Duration:** ~10min
- **Tasks:** 3/3
- **Files modified:** 2

## Accomplishments
- `PlnMesInsights` (fides-orcamento.jsx) ganhou cooldown (WR-01): estado + `useEffect` de countdown no topo do componente, guarda de entrada em `handleAiClick`, re-arme em todos os caminhos terminais (sucesso, erro, empty reply, network), 60s em rate limit/limite diário, botão desabilitado com label "Aguarde Ns".
- Caller de análise (`handleAiClick`) migrou o JWT do body para o header `Authorization: Bearer <jwt>`, passou a enviar `mode:'analysis'` no body, e teve o branch morto de `tool_calls`/function-calling removido (WR-02 + WR-03 cliente).
- `callAssistant` do chat (`fides-claude.jsx`) migrou o JWT do body para o header `Authorization: Bearer <jwt>`; assinatura da função e lógica de tools/iterações do chat permanecem inalteradas (WR-03).

## Task Commits

Each task was committed atomically:

1. **Task 1: WR-01 — cooldown no botão "Análise da IA" (fides-orcamento.jsx)** - `4655650` (feat)
2. **Task 2: WR-03 + WR-02 (cliente) — caller de análise: header Authorization + mode analysis + remover branch morto** - `47b5c43` (fix)
3. **Task 3: WR-03 — caller do chat envia JWT no header (fides-claude.jsx)** - `0f8c0b6` (fix)

_Nota: nenhuma tarefa era TDD (tdd="false" em todas); um commit por tarefa._

## Files Created/Modified
- `assets/fides-orcamento.jsx` - Cooldown (estado/effect/guarda/re-arme/botão) em `PlnMesInsights`; caller de análise migrado para header Authorization + `mode:'analysis'`; branch morto de function-calling removido.
- `assets/fides-claude.jsx` - `callAssistant` monta header `Authorization: Bearer <jwt>`; JWT removido do body do POST.

## Decisions Made
- Cooldown do botão de análise não arma no caminho `JWT_MISSING` — espelha exatamente o comportamento do chat (que também não arma cooldown nesse caminho), evitando divergência de UX entre os dois callers.
- Erro `!res.ok`: 60s quando `res.status===429` OU `errCode` é `USER_DAILY_LIMIT`/`RATE_LIMIT`; demais erros armam 4s (mesma regra do chat).
- Branch morto de function-calling removido por completo do `handleAiClick` (não apenas comentado) — o servidor do plano 11-02 nunca retorna `tool_calls` em `mode:'analysis'` (toolConfig NONE), tornando o branch inalcançável.

## Deviations from Plan

None - plan executado exatamente como escrito.

## Issues Encountered

None.

## Verification

### Estática (grep automatizado, todas as tasks)

**Task 1 (cooldown):**
```
COOLDOWN_NORMAL_SEC       -> assets/fides-orcamento.jsx:22
COOLDOWN_RATELIMIT_SEC    -> assets/fides-orcamento.jsx:23
setCooldown (8 ocorrências) -> declaração + 6 caminhos terminais + effect
cooldown > 0 (3 ocorrências) -> guarda de entrada, disabled do botão, label do botão
```
Rules of Hooks: `useState`×4 e `useEffect` do cooldown declarados incondicionalmente no topo de `PlnMesInsights` (linhas 990-1009), ANTES do early return `if (!cards.length) return null;` (linha ~1015). Nenhum hook dentro de `handleAiClick` ou condicional.

**Task 2 (caller de análise — header + mode + branch morto removido):**
```
Authorization  -> assets/fides-orcamento.jsx:1076
Bearer         -> assets/fides-orcamento.jsx:1076
mode: 'analysis' -> assets/fides-orcamento.jsx:1081
```
Branch `Array.isArray(data && data.tool_calls)...` confirmado removido por inspeção do diff (bloco entre `!res.ok` e `var reply = data && data.reply` não contém mais checagem de `tool_calls`).

**Task 3 (callAssistant do chat — header):**
```
Authorization  -> assets/fides-claude.jsx:458
Bearer         -> assets/fides-claude.jsx:458
```

### W-2 — Prova estática extra (grep negativo: token saiu do body, entrou no header)

**Caller de análise (`fides-orcamento.jsx`, Task 2):**
```js
// headers (linha 1074-1077):
headers: {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + jwt,      // <- token no header
},
// body (linha 1078-1083):
body: JSON.stringify({
  messages: [{ role: 'user', content: 'Analise meu orçamento deste mês e aponte os principais pontos de atenção.' }],
  context: buildAiContext(),
  mode: 'analysis',
  toolResults: null,                     // <- SEM jwt/token no body
}),
```
Grep programático sobre o objeto passado a `JSON.stringify` do body (isolado do bloco `handleAiClick`): `/jwt|token/i.test(bodyObj) === false`.

**Caller do chat (`fides-claude.jsx`, Task 3):**
```js
const callAssistant = async (history, toolResults, jwt) => {
  const ctx = buildContext();
  const res = await fetch('/api/assistant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`,   // <- token no header
    },
    body: JSON.stringify({
      messages: history,
      context: ctx,
      toolResults: toolResults || null,   // <- SEM jwt/token no body
    }),
  });
```
Grep programático sobre o objeto do body: `/\bjwt\b|\btoken\b/i.test(bodyObj) === false`.

Ambos os callers: header `Authorization` com esquema `Bearer` presente; corpo do POST (`JSON.stringify`) sem `jwt`/`token` — WR-03 fechado no cliente, casando com o servidor do plano 11-02 (deploy atômico, W-1).

### Human-verify (pendente — após deploy)

- Duplo-tap em "Análise da IA" (viewport 400×512 iOS Safari) → 1 só chamada, cota +1 em `assistant_usage`; botão desabilita ~4s (~60s em rate limit).
- DevTools → Network: token no request header `Authorization` de ambos os callers (chat e análise), ausente do payload JSON.
- Análise sempre responde com texto (nunca cai em erro genérico por function-calling).
- Chat com tools READ (consultar_saldo/consultar_extrato) segue funcionando normalmente.

**IMPORTANTE (W-1 — deploy atômico):** este plano NÃO foi pushado. O push só deve acontecer junto com o servidor do plano 11-02 (que passou a EXIGIR o header Authorization) para evitar 401 em produção caso um suba sem o outro.

## User Setup Required

None - nenhuma configuração externa necessária.

## Next Phase Readiness

- Frente cliente da fase 11 (WR-01/WR-02/WR-03 cliente) concluída. Falta apenas o push atômico (servidor 11-02 + clientes 11-04) para produção — ainda não realizado (W-1, segurado propositalmente).
- Nenhum bloqueio para as próximas fases (12/13/14) do épico IA/WhatsApp.

---
*Phase: 11-ia-1-hardening-do-assistente-gemini*
*Completed: 2026-07-06*

## Self-Check: PASSED

- FOUND: assets/fides-orcamento.jsx
- FOUND: assets/fides-claude.jsx
- FOUND: .planning/phases/11-ia-1-hardening-do-assistente-gemini/11-04-SUMMARY.md
- FOUND: 4655650 (Task 1 commit)
- FOUND: 47b5c43 (Task 2 commit)
- FOUND: 0f8c0b6 (Task 3 commit)
