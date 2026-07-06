---
id: ratelimit-bypass-toolresults
created: 2026-07-06
priority: high
source: 11-security-review (security-reviewer)
area: api/assistant.js
severity: high
pre_existing: true
epic: IA/WhatsApp (phases 12-14)
---

# Bypass do rate-limit diário do assistente via `toolResults` forjado

## Problema
`api/assistant.js`: `const isFirstCallOfTurn = !Array.isArray(toolResults) || toolResults.length === 0;`
Todo o gate de `USER_DAILY_LIMIT` (count + insert em `assistant_usage`) só roda `if (isFirstCallOfTurn)`.
O servidor é stateless — não guarda memória dos `tool_calls` que ele mesmo ofereceu na resposta anterior.
Logo, qualquer requisição autenticada que envie um `toolResults` NÃO-vazio (mesmo fabricado, sem relação com uma chamada real) pula o gate inteiro. Um usuário autenticado pode chamar `/api/assistant` indefinidamente sem esbarrar nos 100/dia mandando sempre `toolResults: [{name:'x',result:'y'}]`.

## Por que importa
Fase 11 é hardening de custo/abuso do assistente — este é o maior risco real de custo hoje. Achado é PRÉ-EXISTENTE (existia idêntico no baseline b4b6622), não introduzido pela fase, por isso não bloqueou o push da fase 11. Mas a fase mexeu exatamente nesse bloco (telemetria) sem fechar a brecha.

## Correção sugerida
Não usar só a presença de `toolResults` como prova de continuação. Opções:
- Contar TODA chamada HTTP no rate-limit (não só "primeira do turno"); ou
- Nonce assinado de curta duração emitido junto com `tool_calls` e validado/expirado no request seguinte.

## Onde resolver
Épico IA (phase 12 IA-2 destravar WRITE reabre este arquivo, ou hardening dedicado). Casa com a superfície de custo/gating premium (phase 13, `profiles.plan`).
