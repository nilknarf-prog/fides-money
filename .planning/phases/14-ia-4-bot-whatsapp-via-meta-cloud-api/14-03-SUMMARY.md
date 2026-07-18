---
phase: 14-ia-4-bot-whatsapp-via-meta-cloud-api
plan: 03
subsystem: security
tags: [rate-limit, nonce, hmac, assistant, audit]

# Dependency graph
requires:
  - phase: 12-ia-2-write-in-app
    provides: "commit 9abd83e — nonce HMAC anti-replay (D-06) que fechou o bypass estrutural do gate de cota"
provides:
  - "Auditoria com evidência de que o bypass estrutural de rate-limit via toolResults forjado está fechado desde 9abd83e"
  - "Decisão registrada (accept) sobre o gap residual de replay-de-nonce dentro do TTL de 120s"
  - "Todo ratelimit-bypass-toolresults fechado formalmente em done/"
affects: [14-05-webhook-whatsapp, 14-06-webhook-parser, 14-07-webhook-insert]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Closeout formal de todo pré-existente: audit-first (evidência via grep + git log), decisão explícita via checkpoint, então mover pending/ -> done/ com nota de resolução"

key-files:
  created: []
  modified:
    - api/assistant.js (nenhuma alteração de código — apenas leitura/auditoria)
    - .planning/todos/done/ratelimit-bypass-toolresults.md (movido de pending/, nota de resolução anexada)

key-decisions:
  - "WA-RATELIMIT-01: bypass estrutural (item HIGH herdado da security-review da Phase 11) confirmado FECHADO desde o commit 9abd83e (Phase 12-02) — não foi necessário implementar fix novo"
  - "Gap residual de replay-de-nonce dentro do TTL de 120s (api/_lib/nonce.js é HMAC stateless, sem jti de uso único) ACEITO como baixo risco (decisão do dono no checkpoint) — sem hardening nesta fase, conforme RESEARCH.md Assumption A5"

patterns-established: []

requirements-completed: [WA-RATELIMIT-01]

coverage:
  - id: D1
    description: "Auditoria confirma (evidência de código + git log) que o bypass estrutural do rate-limit via toolResults forjado está fechado desde o commit 9abd83e"
    requirement: "WA-RATELIMIT-01"
    verification:
      - kind: other
        ref: "grep 'isFirstCallOfTurn = !hasToolResults || !nonceValid' api/assistant.js && grep 'nonce.verify' api/assistant.js && ! grep 'toolResults.length === 0' api/assistant.js && git log --oneline | grep '9abd83e'"
        status: pass
    human_judgment: false
  - id: D2
    description: "Decisão explícita registrada sobre o gap residual (replay de nonce dentro do TTL de 120s): aceito como baixo risco (não hardening nesta fase)"
    requirement: "WA-RATELIMIT-01"
    verification: []
    human_judgment: true
    rationale: "Decisão de risco/severidade tomada pelo dono do produto no checkpoint da Task 2 — não é algo que um teste automatizado possa validar, é uma escolha de negócio/risco já capturada nesta SUMMARY e no todo done/."
  - id: D3
    description: "Todo ratelimit-bypass-toolresults movido de pending/ para done/ com nota de resolução (commit + decisão + referência ao plano 14-03)"
    requirement: "WA-RATELIMIT-01"
    verification:
      - kind: other
        ref: "test -f .planning/todos/done/ratelimit-bypass-toolresults.md && ! test -f .planning/todos/pending/ratelimit-bypass-toolresults.md && grep '9abd83e' .planning/todos/done/ratelimit-bypass-toolresults.md"
        status: pass
    human_judgment: false

duration: ~20min (inclui pausa de checkpoint humano)
completed: 2026-07-18
status: complete
---

# Phase 14 Plan 03: Closeout WA-RATELIMIT-01 (audit + decisão) Summary

**Auditoria confirma que o bypass estrutural de rate-limit via `toolResults` forjado foi fechado no commit `9abd83e` (nonce HMAC anti-replay); gap residual de replay-de-nonce (TTL 120s) aceito como baixo risco por decisão do dono — todo fechado em `done/`.**

## Performance

- **Duration:** ~20min (inclui pausa para decisão humana no checkpoint da Task 2)
- **Completed:** 2026-07-18T02:20:33Z
- **Tasks:** 3 (Task 1 auditoria, Task 2 checkpoint:decision, Task 3 closeout)
- **Files modified:** 1 (`.planning/todos/done/ratelimit-bypass-toolresults.md`, movido de `pending/`)

## Accomplishments

- Confirmado por leitura direta do HEAD de `api/assistant.js` (linhas 264-271) e por `git log` que o vetor de bypass estrutural original — `isFirstCallOfTurn = !Array.isArray(toolResults) || toolResults.length === 0` — **não existe mais**. O gate atual exige `toolResults` **e** um nonce HMAC válido (`nonce.verify`, `api/_lib/nonce.js`) para não contar na cota; `toolResults` forjado sem o `ASSISTANT_NONCE_SECRET` cai em `isFirstCallOfTurn=true` e É contado.
- Identificado o commit responsável pelo fix: `9abd83e` ("feat(12-02): reactivate WRITE tools, add honesty rules, and fix rate-limit bypass with nonce (B8)", Phase 12-02, 2026-07-12) — introduziu `api/_lib/nonce.js` (HMAC-SHA256 stateless, `crypto.timingSafeEqual`, TTL 120s).
- Decisão explícita do dono (checkpoint Task 2): o gap residual — nonce válido capturado pode ser reenviado dentro da janela de 120s sem contar na cota, pois `nonce.js` não guarda nonces já usados — é **aceito como baixo risco** (RESEARCH.md Assumption A5: impacto de custo limitado, exige captura prévia de um nonce já emitido, janela curta). Sem hardening (nonce de uso único) nesta fase.
- `.planning/todos/pending/ratelimit-bypass-toolresults.md` movido (`git mv`) para `.planning/todos/done/ratelimit-bypass-toolresults.md`, com nota de resolução citando o commit `9abd83e`, a decisão accept e a referência ao plano 14-03. WA-RATELIMIT-01, item **high** herdado da security-review da Phase 11, está formalmente fechado.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Auditar que o bypass estrutural está fechado (evidência)** - sem commit de código (task audit-only, sem arquivos modificados; evidência incorporada a esta SUMMARY)
2. **Task 2: Decisão sobre o gap residual (replay de nonce dentro do TTL)** - checkpoint humano; decisão `accept` registrada (sem commit de código, decisão pura)
3. **Task 3: Fechar formalmente o todo (mover pending -> done com nota)** - ver commit abaixo

**Plano + tracking:** ver commit abaixo (SUMMARY + todo movido + STATE/ROADMAP em commit único, a pedido do orquestrador)

_Nota: Task 1 é auditoria pura (leitura de código, sem alteração de arquivo) — não há artefato de código para stagear separadamente. A evidência está documentada acima e a Task 3 (closeout) e o tracking de STATE/ROADMAP foram commitados juntos, por instrução explícita do orquestrador ao retomar após o checkpoint._

## Files Created/Modified

- `.planning/todos/done/ratelimit-bypass-toolresults.md` - movido de `pending/`; nota de resolução anexada (commit 9abd83e + decisão accept + referência ao plano 14-03)

## Decisions Made

- **WA-RATELIMIT-01 fechado sem implementação nova de código:** o RESEARCH.md (HIGH confidence) já havia provado que o bypass estrutural foi corrigido no commit `9abd83e` (Phase 12-02). Este plano foi auditoria + decisão + closeout, não reimplementação.
- **Gap residual de replay-de-nonce (TTL 120s) aceito como baixo risco:** decisão explícita do dono no checkpoint da Task 2, alinhada com a classificação LOW do RESEARCH.md (Assumption A5). Custo/benefício de implementar nonce de uso único (tabela de `jti` consumido) desfavorável para o MVP dado que o vetor estrutural HIGH já está mitigado.

## Deviations from Plan

None - plano executado exatamente como escrito. A única nota é que a Task 1 não produziu artefato de código para commit individual (auditoria pura), o que é consistente com o próprio objetivo do plano ("NÃO é implementar o fix do zero").

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- WA-RATELIMIT-01 fechado, sem bloqueios pendentes para os próximos planos da fase (14-04 em diante).
- O padrão de nonce HMAC (`api/_lib/nonce.js`) segue sendo a base de anti-replay para o gate de cota do assistente; nenhuma mudança necessária para o webhook do WhatsApp (14-05/14-06/14-07), que usa gating de premium e caps próprios, não o gate de `toolResults`.

---
*Phase: 14-ia-4-bot-whatsapp-via-meta-cloud-api*
*Completed: 2026-07-18*
