---
phase: 11-ia-1-hardening-do-assistente-gemini
status: passed
verified: 2026-07-06
method: static spot-check + security-reviewer + database-reviewer + human UAT (aprovado)
requirements: [WR-01, WR-02, WR-03, AI-SHARED-01, AI-TELEM-01]
---

# Phase 11 Verification — IA-1 Hardening do Assistente Gemini

**Veredito: PASSED.** 4 planos executados, código deployado (push atômico `e40f7e7`), migração de telemetria aplicada, UAT humana aprovada (A–D). Nenhum gap aberto; 2 follow-ups pré-existentes/adjacentes registrados como todos.

## Requisitos × evidência

| Req | O que exige | Evidência | Status |
|-----|-------------|-----------|--------|
| AI-SHARED-01 | Módulo Gemini CommonJS compartilhado | `api/_lib/gemini.js` (buildPayload/callGemini/parseResponse); `api/assistant.js` consome via require. Spot-check: 5 símbolos + usageMetadata + functionCallingConfig | ✅ |
| WR-03 | JWT no header, não no body (servidor + 2 callers) | `req.headers.authorization` (assistant.js:108); body destructure sem jwt/token (W-2 grep); `Authorization: Bearer` nos 2 `.jsx`; UAT B: DevTools token no header, fora do body | ✅ |
| WR-02 | Modo análise proíbe tools (toolConfig NONE) → sempre texto | `toolMode: isAnalysisMode ? 'NONE' : 'AUTO'`; branch functionCall removido do cliente (0 ocorrências); UAT A: análise sempre texto | ✅ |
| WR-01 | Cooldown no botão "Análise da IA" | Estado+effect no topo de PlnMesInsights (Rules of Hooks OK); re-arme em todos os terminais (60s rate-limit); UAT C: 2 toques → 1 chamada, botão trava ~4s | ✅ |
| AI-TELEM-01 | assistant_usage grava tokens+latência | UPDATE fail-open (assistant.js); migração aplicada (3 colunas + índice + RLS UPDATE policy); UAT D: SELECT com 3 colunas não-nulas | ✅ |

## Gates de qualidade
- **security-reviewer (api/ + client):** CLEAN — safe to push. Nada crítico/alto introduzido pela fase.
- **database-reviewer (schema + telemetria):** CLEAN. MEDIUM #1 (policy RLS UPDATE) e #2 (índice) resolvidos no checkpoint MCP.
- **Human UAT:** aprovado (A retest G-1 autocontida, B header, C cooldown, D telemetria).

## Follow-ups registrados (não bloqueiam a fase)
- `ratelimit-bypass-toolresults.md` — ALTO pré-existente: bypass do rate-limit via `toolResults` forjado. Roteado ao épico IA (fase 12+).
- `analise-ia-resposta-autocontida.md` — G-1 resolvido nesta fase (gap-closure `e40f7e7`); todo mantido como referência do trabalho de prompt/eval.

## Notas
- `#2` da UAT ("temporariamente indisponível" 1×) = erro transitório do Gemini (HTTP 502 → GEMINI_ERROR), resolvido no retry — não é falha do WR-02 (branch functionCall confirmado removido).
- Sem test runner no projeto: verificação = inspeção estática + reviews + UAT humana (conforme CLAUDE.md / 11-RESEARCH.md).
