---
phase: 11-ia-1-hardening-do-assistente-gemini
plan: 03
subsystem: api
tags: [telemetry, assistant_usage, supabase, migration, rls, fail-open]

# Dependency graph
requires: [11-01, 11-02]
provides:
  - "supabase/schema.sql — espelho de public.assistant_usage + ALTERs de telemetria (prompt_tokens/completion_tokens/latency_ms)"
  - "api/assistant.js — captura id do insert, mede latência, UPDATE fail-open com tokens+latência"
  - "colunas de telemetria aplicadas no banco (via MCP, checkpoint humano) + índice (user_id, created_at) + policy RLS UPDATE"
affects: [12, 13, 14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "insert→update: mantém o insert de rate-limit ANTES da chamada Gemini (fail-open) e faz UPDATE da mesma linha após a resposta com tokens+latência"
    - "telemetria fail-open: UPDATE em try/catch + checagem de updateError — falha loga e segue, nunca derruba a resposta"

key-files:
  created: []
  modified:
    - supabase/schema.sql
    - api/assistant.js

key-decisions:
  - "usageMetadata lido com ?? (não ||) para preservar 0 como contagem de token válida"
  - "checkpoint humano (blocking): migração aplicada via Supabase MCP fora da sessão do agente (MCP sem auth na sessão)"
  - "G-1 (UAT): addendum de system prompt só no modo analysis — resposta autocontida, sem follow-up; aponta o chat para aprofundar"

patterns-established:
  - "assistant_usage passa a ter espelho .sql (antes só existia no banco — débito B10); ALTER standalone add-column-if-not-exists idempotente (learning supabase-schema-alter-not-create)"

requirements-completed: [AI-TELEM-01]

# Metrics
duration: ~4min (código) + checkpoint humano (migração + UAT)
completed: 2026-07-06
status: complete
---

# Phase 11 Plan 03: Telemetria assistant_usage (AI-TELEM-01) Summary

**`assistant_usage` passa a gravar prompt_tokens/completion_tokens/latency_ms por chamada (fonte: usageMetadata do Gemini + medição de tempo no servidor), via UPDATE fail-open da linha de rate-limit — sem regredir o rate-limit e sem gravar nenhum texto de prompt/resposta (minimização LGPD §9). Base de custo real por usuário para os evals das fases 12–14.**

## Accomplishments
- **Task 1 (`baa920e`):** `supabase/schema.sql` ganha bloco `public.assistant_usage` — `create table if not exists` defensivo (id/user_id/created_at) + comentário do learning + 3 ALTERs standalone `add column if not exists` (prompt_tokens/completion_tokens/latency_ms, int nullable, sem backfill).
- **Task 2 (`0d71e91`):** `api/assistant.js` captura o id do insert de rate-limit (`.select('id').single()`, tolerante a erro), mede latência com `Date.now()` cercando a chamada Gemini, e faz UPDATE fail-open (`prompt_tokens`/`completion_tokens`/`latency_ms`). Usa `??` para preservar 0. Nenhum texto pessoal gravado; insert de contagem permanece antes do Gemini.
- **Task 3 (checkpoint humano — resolvido):** migração aplicada no banco via Supabase MCP: 3 ALTERs + índice `idx_assistant_usage_user_created (user_id, created_at)` (achado database-reviewer MEDIUM #2) + policy RLS `for update using ((select auth.uid()) = user_id)` (achado MEDIUM #1 — a tabela só tinha policy de INSERT/SELECT; sem a de UPDATE a telemetria seria filtrada silenciosamente). UAT: `select prompt_tokens, completion_tokens, latency_ms ... order by created_at desc` mostrou as 3 colunas não-nulas após chamada real. **Aprovado pelo usuário.**

## Task Commits
1. **Task 1: espelho .sql + ALTERs** — `baa920e` (feat)
2. **Task 2: UPDATE fail-open de telemetria** — `0d71e91` (feat)
3. **Task 3: migração no banco** — aplicada via MCP pelo usuário (sem commit de código; DDL vive no banco, débito B10)

## Gap-closure (11-UAT)
- **G-1 (`e40f7e7`):** a "Análise da IA" (single-shot) reusava o SYSTEM_PROMPT conversacional e terminava com perguntas de follow-up sem via de resposta. Addendum de prompt só no `isAnalysisMode`: resposta autocontida + aponta o chat "Assistente Fides". Prompt do chat inalterado; assistente segue READ-only. Retestado na UAT — OK.

## Security & Database Review (caminhos sensíveis api/ + supabase/)
- **security-reviewer:** CLEAN — safe to push. WR-03/WR-02/AI-TELEM-01 corretos; minimização respeitada (só contagens+latência+user_id). Follow-up ALTO pré-existente registrado: bypass de rate-limit via `toolResults` forjado (`.planning/todos/pending/ratelimit-bypass-toolresults.md`).
- **database-reviewer:** CLEAN — schema+telemetry safe. MEDIUM #1 (RLS UPDATE) e MEDIUM #2 (índice) resolvidos no mesmo checkpoint MCP. LOW informativos: telemetria não cobre a 2ª chamada Gemini de um turno com tool-calling; chamadas com erro Gemini ficam sem latency_ms (aceitável por plano).

## Deviations from Plan
- Checkpoint T3 executado por humano (não pelo agente) — MCP Supabase sem auth na sessão, conforme previsto no próprio plano (blocking-human).
- Escopo do checkpoint ampliado com 2 achados do database-reviewer (índice + policy UPDATE), aplicados no mesmo `apply_migration`.

## User Setup Required
Feito na UAT: migração + índice + policy RLS UPDATE aplicados via Supabase MCP.

---
*Phase: 11-ia-1-hardening-do-assistente-gemini*
*Completed: 2026-07-06*

## Self-Check: PASSED

- FOUND: supabase/schema.sql (bloco assistant_usage + ALTERs)
- FOUND: api/assistant.js (latency_ms, UPDATE fail-open)
- FOUND commit: baa920e
- FOUND commit: 0d71e91
- CONFIRMED (UAT humano): colunas aplicadas + SELECT não-nulo + policy RLS UPDATE
