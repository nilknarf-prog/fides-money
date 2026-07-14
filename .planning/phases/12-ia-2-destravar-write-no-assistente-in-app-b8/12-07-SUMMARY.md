---
phase: 12-ia-2-destravar-write-no-assistente-in-app-b8
plan: 07
subsystem: ai-assistant
tags: [gemini, function-calling, prompt-engineering, react, resolver]

# Dependency graph
requires:
  - phase: 12-02
    provides: 4 tools WRITE + system prompt de honestidade + nonce anti-replay
  - phase: 12-03
    provides: caminho de cartão correto (mesFaturaFor + status pendente) em lancar_transacao
  - phase: 12-06
    provides: writeOutcome/anti-espelho e SYSTEM_PROMPT já sem addendum de cancelamento (base sobre a qual este plano estendeu o prompt)
provides:
  - Discriminador tipo_destino (enum conta|cartao, opcional) na tool lancar_transacao
  - Regra de prompt mapeando palavras do usuário → tipo_destino
  - resolveWriteToolArgs honra tipo_destino (cartão exclusivo por findCardByName, conta exclusivo por findAccountByName)
  - Desambiguação explícita (fail-closed) quando existe conta E cartão homônimos e o usuário não qualificou o tipo
affects: [12-UAT, assistente-ia, chat-write]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminador opcional em schema de tool LLM (tipo_destino) para desambiguar entre duas entidades homônimas de domínios distintos (conta vs cartão), com fallback fail-closed no cliente quando o modelo omite o campo"
    - "Resolver de destino calcula SEMPRE os dois candidatos (accMatch + cardMatch) antes de decidir — nunca decide por precedência de ordem de busca"

key-files:
  created: []
  modified:
    - api/assistant.js
    - assets/fides-claude.jsx

key-decisions:
  - "tipo_destino é STRING com enum ['conta','cartao'], fora de required — o modelo pode omitir quando o usuário não qualificar; o resolver decide/desambigua nesse caso"
  - "Resolver calcula accMatch e cardMatch incondicionalmente (não mais 'card só se nenhuma conta casar') — a precedência conta-primeiro que causava o bug foi removida por completo, não amenizada"
  - "Mensagem de desambiguação de homônimo: 'Encontrei uma conta E um cartão chamados \"<ref>\" — qual você quis dizer? Diga \"cartão <ref>\" para o cartão de crédito ou \"conta <ref>\" para a conta corrente.'"
  - "Target de cartão mantém obj: cardMatch em todos os 2 pontos onde é construído (tipo='cartao' explícito e fallback sem-tipo com match único de cartão) — preserva o caminho mesFaturaFor/status pendente de 12-03"
  - "security-review conduzida diretamente pelo executor (sem Task-launcher de subagente ECC disponível no ambiente) — mesmo escopo/critério usado em 12-06: auth/RLS/nonce/rate-limit intactos, regra de honestidade reforçada (não enfraquecida), nenhum canal para o modelo forjar destino (cliente resolve nome→UUID e RPC revalida dono)"

patterns-established:
  - "Schema de tool com discriminador opcional + resolver fail-closed: quando o LLM não sinaliza o discriminador e existe ambiguidade real nos dados do usuário, o cliente nunca escolhe silenciosamente — retorna erro pedindo esclarecimento"

requirements-completed: [WRITE-01, HONEST-01]

coverage:
  - id: D1
    description: "lancar_transacao ganha tipo_destino (enum conta|cartao, opcional) no schema da tool + descrição de conta_ou_cartao orientando o modelo a enviá-lo quando o usuário qualificar o tipo"
    requirement: "WRITE-01"
    verification:
      - kind: other
        ref: "grep -n tipo_destino api/assistant.js (propriedade com enum ['conta','cartao']); linha required de lancar_transacao inspecionada — segue ['descricao','valor','categoria','conta_ou_cartao'], sem tipo_destino"
        status: pass
    human_judgment: false
  - id: D2
    description: "Regra no SYSTEM_PROMPT (seção honestidade) mapeando cartão/crédito/fatura → tipo_destino=cartao, conta/débito/pix → tipo_destino=conta, e instruindo a NÃO escolher sozinho em caso de homônimo sem qualificação"
    requirement: "HONEST-01"
    verification:
      - kind: other
        ref: "grep -n tipo_destino api/assistant.js linha 48 (bullet do SYSTEM_PROMPT); node -e \"require('./api/assistant.js')\" carrega sem erro"
        status: pass
    human_judgment: false
  - id: D3
    description: "resolveWriteToolArgs (branch lancar_transacao) consulta SEMPRE findAccountByName e findCardByName (removida a precedência conta-primeiro !acc ? findCardByName) e honra tipo_destino quando presente"
    requirement: "WRITE-01"
    verification:
      - kind: other
        ref: "grep -c '!acc ? findCardByName' assets/fides-claude.jsx == 0; grep -n tipo_destino assets/fides-claude.jsx (lido no resolver); grep -n 'obj: cardMatch' assets/fides-claude.jsx (2 ocorrências — tipo='cartao' explícito e fallback sem-tipo)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Homônimo sem tipo_destino (conta E cartão com mesmo nome) retorna erro de desambiguação explícito, nunca escolhe pela ordem"
    requirement: "HONEST-01"
    verification:
      - kind: other
        ref: "grep -qi 'conta E um cartão\\|qual você quis' assets/fides-claude.jsx"
        status: pass
    human_judgment: false
  - id: D5
    description: "Regressão end-to-end do 12-UAT Test 1: 'lança 1 real na categoria natal, no cartão de crédito bradesco' resolve para o CARTÃO (Status Pendente, mês pela fatura), 'conta corrente bradesco' resolve para a CONTA, 'bradesco' sem qualificar pede desambiguação"
    requirement: "WRITE-01"
    verification: []
    human_judgment: true
    rationale: "Requer sessão real no app (Gemini decidindo tipo_destino a partir de linguagem natural + confirmação visual + gravação via RPC); depende de uma conta e um cartão homônimos existirem nos dados do usuário de teste — coberto por /gsd-verify-work 12"

# Metrics
duration: ~10min
completed: 2026-07-14
status: complete
---

# Phase 12 Plan 07: Discriminador tipo_destino — fechar cartão homônimo virando conta Summary

**A tool `lancar_transacao` ganha um discriminador opcional `tipo_destino` (enum `conta|cartao`) preenchido pelo modelo a partir das palavras do usuário, e o resolver no cliente passa a consultar SEMPRE conta e cartão candidatos, honrando o tipo declarado e desambiguando homônimos com erro explícito em vez de escolher pela ordem — fechando o 12-UAT Test 1 (cartão de crédito Bradesco não vira mais conta corrente Bradesco).**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-14
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments
- `api/assistant.js`: `lancar_transacao.parameters.properties` ganha `tipo_destino` (`STRING`, `enum: ['conta','cartao']`, fora de `required`); descrição de `conta_ou_cartao` ajustada para orientar o envio conjunto de `tipo_destino` quando o usuário qualificar o tipo; `SYSTEM_PROMPT` (seção honestidade) ganha um bullet mapeando as palavras do usuário → `tipo_destino` e instruindo a não escolher sozinho em caso de homônimo
- `assets/fides-claude.jsx`: `resolveWriteToolArgs` (branch `lancar_transacao`) reescrito — calcula `accMatch`/`cardMatch` incondicionalmente (a precedência conta-primeiro `!acc ? findCardByName(ref) : null` foi removida por completo), honra `tipo_destino` quando presente (cartão exclusivo por `findCardByName`, conta exclusivo por `findAccountByName`), e desambigua homônimos sem tipo com um erro explícito pedindo esclarecimento — nunca escolhendo pela ordem
- Caminho de cartão já correto desde 12-03 (`mesFaturaFor` + status pendente) agora é alcançável para nomes homônimos, porque o discriminador chega até o resolver antes de qualquer decisão

## Task Commits

Each task was committed atomically:

1. **Task 1: Discriminador tipo_destino na tool lancar_transacao + regra de prompt + security-review** - `dc84e97` (feat)
2. **Task 2: resolveWriteToolArgs honra tipo_destino (cartão exclusivo) + desambiguação de homônimo** - `5574054` (fix)

_Nenhuma task TDD — mudança de schema/prompt estático e de lógica de resolução de branch, sem novo hook React._

## Files Created/Modified
- `api/assistant.js` - propriedade `tipo_destino` em `lancar_transacao`, descrição de `conta_ou_cartao` ajustada, bullet de mapeamento no `SYSTEM_PROMPT`
- `assets/fides-claude.jsx` - branch `lancar_transacao` de `resolveWriteToolArgs` reescrito: `accMatch`/`cardMatch` sempre calculados, seleção de `target` por `tipo_destino` ou por desambiguação de homônimo, `target` do `resolved` passa a usar a variável já decidida

## Decisions Made
- `tipo_destino` com enum exato `['conta', 'cartao']`, opcional (fora de `required` de `lancar_transacao`) — o cliente desambigua quando ausente
- Precedência conta-primeiro removida por completo (não amenizada): `findCardByName` deixou de depender de `!acc`
- Redação final da mensagem de desambiguação: `Encontrei uma conta E um cartão chamados "<ref>" — qual você quis dizer? Diga "cartão <ref>" para o cartão de crédito ou "conta <ref>" para a conta corrente.`
- Shape final do `target`: cartão = `{ type: 'card', id, name, obj: cardMatch }` (preserva `obj` usado por `window.mesFaturaFor` em `executeWriteTool`); conta = `{ type: 'account', id, name }` — idêntico ao shape anterior, apenas a lógica de seleção mudou
- Disposição do security-review sobre `api/assistant.js`: **PASS, zero findings**. Diff é só propriedade de schema (`STRING`/`enum` opcional) + texto estático adicional no `SYSTEM_PROMPT`; nenhum código de auth/JWT/RLS/nonce/rate-limit tocado; `tipo_destino` fora de `required` não quebra parse de chamadas antigas; o campo não abre canal para o modelo forjar destino — o cliente resolve nome→UUID com guarda determinística (`findAccountByName`/`findCardByName`) e a RPC `wa_log_transaction` revalida o dono (12-01); a regra de honestidade foi reforçada (instrução explícita de não escolher sozinho em homônimo), não enfraquecida. Conduzida diretamente pelo executor — o ambiente não expõe um Task/agent-launcher para o subagente `security-reviewer` nomeado no plano (mesma adaptação já registrada em 12-06).

## Deviations from Plan

None - plan executado exatamente como escrito. O único ponto de adaptação (idêntico ao já registrado em 12-06) foi o veículo do security-review: conduzida diretamente pelo executor em vez de via subagente `security-reviewer` da ECC, com o mesmo escopo/critérios. Não é mudança de escopo/arquitetura.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 12-UAT Test 1 (cartão homônimo virando conta) endereçado no código (WRITE-01/HONEST-01); regressão end-to-end (D5) requer sessão real no app com uma conta e um cartão de mesmo nome — cabe a `/gsd-verify-work 12`
- Este era o último plano do gap closure aberto por 12-06/12-07 (wave 5) — Phase 12 fica com 4 UATs humanos pendentes no total (Test 1 revisitado + os 3 remanescentes já listados em STATE.md)
- Nenhum blocker técnico novo introduzido

---
*Phase: 12-ia-2-destravar-write-no-assistente-in-app-b8*
*Completed: 2026-07-14*

## Self-Check: PASSED

- FOUND: api/assistant.js
- FOUND: assets/fides-claude.jsx
- FOUND: .planning/phases/12-ia-2-destravar-write-no-assistente-in-app-b8/12-07-SUMMARY.md
- FOUND commit: dc84e97 (Task 1)
- FOUND commit: 5574054 (Task 2)
