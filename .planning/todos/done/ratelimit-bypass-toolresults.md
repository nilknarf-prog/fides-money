---
id: ratelimit-bypass-toolresults
created: 2026-07-06
priority: high
source: 11-security-review (security-reviewer)
area: api/assistant.js
severity: high
pre_existing: true
epic: IA/WhatsApp (phases 12-14)
resolved: 2026-07-18
resolved_by: 14-03-PLAN.md
resolution: accept
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

## Nota de resolução (14-03, 2026-07-18)

**Status: RESOLVIDO — vetor estrutural fechado, gap residual aceito (não-issue).**

1. **Vetor estrutural HIGH fechado no commit `9abd83e`** ("feat(12-02): reactivate WRITE tools, add honesty rules, and fix rate-limit bypass with nonce (B8)", Phase 12-02, 2026-07-12). A linha vulnerável original (`isFirstCallOfTurn = !Array.isArray(toolResults) || toolResults.length === 0`) não existe mais em `api/assistant.js`. O gate atual (linhas 264-271) exige `toolResults` **e** um nonce HMAC-SHA256 assinado (`api/_lib/nonce.js`, TTL 120s, `crypto.timingSafeEqual`) válido para o `userId` antes de pular a contagem — `toolResults` forjado sem `ASSISTANT_NONCE_SECRET` cai em `isFirstCallOfTurn=true` e É contado. Auditado por leitura direta do HEAD + `git log` na Task 1 do plano 14-03 (evidência completa em `14-03-SUMMARY.md`).
2. **Gap residual avaliado e ACEITO como baixo risco (decisão do dono, checkpoint Task 2 do plano 14-03):** `api/_lib/nonce.js` é HMAC stateless — sem tabela de nonces usados (sem `jti` de uso único). Um nonce válido capturado (ex.: XSS ou log vazado) pode em teoria ser reenviado dentro da janela de TTL de 120s sem contar na cota. Classificação **LOW** conforme `14-RESEARCH.md` Assumption A5 (impacto de custo limitado; exige captura prévia de um nonce já emitido por ≥1 chamada legítima contada; janela curta de 120s por captura). Decisão: **accept** — sem hardening de nonce de uso único nesta fase. Custo/benefício desfavorável para o MVP dado que o vetor estrutural (o que motivou a severidade HIGH original) já está mitigado.
3. **Referência de closeout formal:** `.planning/phases/14-ia-4-bot-whatsapp-via-meta-cloud-api/14-03-PLAN.md` / `14-03-SUMMARY.md` (requirement `WA-RATELIMIT-01`).
