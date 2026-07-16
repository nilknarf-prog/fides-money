---
created: 2026-07-16T18:21:06.671Z
title: "Assistente: modais de confirmação WRITE ficam stale e se acumulam"
area: assistant
priority: high
files:
  - assets/fides-claude.jsx  # executeTools / resolveWriteToolArgs / executeWriteTool / TOOLS_REQUIRING_CONFIRMATION (~L33, ~L306-545) + estado do modal de confirmação (__fidesWriteConfirmPending)
  - api/assistant.js  # caminho de tool_calls devolvidas pelo Gemini (~L438-444)
related:
  - "Phase 12 (IA-2 WRITE in-app) — introduziu o fluxo de confirmação WRITE: 12-04 (__fidesWriteConfirmPending, SD-1), 12-05 (guard ⌘K), 12-06 (writeOutcome/guard anti-espelho)"
schedule: "Endereçar numa fase futura de IA in-app (NÃO WhatsApp/favicon). Não é do escopo da Phase 13 (gating); candidata a uma fase de hardening/UX do assistente WRITE."
---

## Problem

**Bug de UX no fluxo WRITE do assistente Fides (chat IA in-app).**

Repro:
1. Usuário pede ao assistente para lançar uma transação (despesa ou receita) via `lancar_transacao` → aparece o modal de confirmação, usuário confirma, transação é lançada.
2. Em seguida, o usuário dita OUTRA despesa para o assistente lançar.
3. O modal de confirmação que aparece mostra a transação **ANTERIOR** (dados stale/errados), não a nova que acabou de ser ditada.
4. Ao clicar **"Cancelar"**, aí sim aparece o modal correto — mas o comportamento se **acumula**: a cada nova transação, mais um modal antigo/errado entra na fila.
5. Já foi observado chegar a **~4 modais de transações passadas erradas** que o usuário precisa cancelar em sequência até finalmente chegar na última transação que ele de fato ditou.

**Impacto:** UX quebrada + **risco de segurança financeira** — o usuário pode confirmar/cancelar a transação errada por engano (o modal exibido não corresponde à ação pretendida). Alto, porque toca dinheiro real e mina a confiança no assistente WRITE (a feature-chave da Phase 12).

## Solution

TBD — investigar com `/gsd-debug`. Hipótese de causa raiz: **estado residual da fila de confirmações WRITE não sendo limpo** entre turnos do assistente. Suspeitos:

- `__fidesWriteConfirmPending` (flag de confirmação pendente, Phase 12-04) não é resetado após confirmar/cancelar, ou é sobrescrito em vez de substituído, deixando confirmações antigas "presas".
- Os args/payload do modal de confirmação (`resolveWriteToolArgs`) podem estar sendo capturados por closure de um turno anterior (stale closure — clássico com Babel-standalone React, ver histórico de Rules of Hooks na Phase 07), ou uma fila (array) de pending writes que faz push sem drenar.
- O `tool_calls` novo devolvido pelo Gemini (`api/assistant.js:~438-444`) pode estar sendo enfileirado atrás dos antigos no cliente em vez de substituí-los.

Ao investigar, confirmar: (a) onde a fila/estado de confirmação vive em `assets/fides-claude.jsx`; (b) se cancelar realmente remove o item da fila ou só avança um índice; (c) se um novo turno limpa pendências antigas. Reproduzir lançando 2-4 transações seguidas via assistente.

**Nota de planejamento:** capturado durante `/gsd-execute-phase 13`. O usuário pediu explicitamente para incluir isto numa **fase futura**. Puxar este todo ao planejar a próxima fase de IA in-app (não cabe em 13-gating, 14-WhatsApp nem 15-favicon).
