# Phase 11: IA-1 Hardening do assistente Gemini — Context

**Gathered:** 2026-07-06
**Status:** Ready for planning
**Source:** Decisões travadas em `.planning/research/whatsapp-e-ia-arquitetura.md` (D-1..D-11 aceitas pelo usuário 2026-07-06). Este phase é a Fase IA-1 do épico IA/WhatsApp (Phases 11–14).

<domain>
## Phase Boundary

IA-1 é **hardening puro** das DUAS superfícies de IA que já existem, antes de qualquer capacidade nova. Fecha as 3 dívidas do review da fase 05 e cria a base observável (telemetria) que os evals das fases 12–14 vão consumir. NÃO adiciona WRITE, NÃO mexe em gating/premium, NÃO troca de modelo.

Superfícies afetadas (ambas Gemini 2.5 Flash-Lite via `api/assistant.js`, ambas só-leitura, mantêm-se só-leitura):
1. Chat "Assistente Fides" — `assets/fides-claude.jsx` (já tem cooldown 4s/60s + limpeza 2h).
2. Botão "Análise da IA" — `assets/fides-orcamento.jsx` (`PlnMesInsights` / `handleAiClick`), single-shot, SEM cooldown hoje (WR-01).

Escopo: 5 requisitos — WR-01, WR-02, WR-03, AI-SHARED-01, AI-TELEM-01.
</domain>

<decisions>
## Implementation Decisions (LOCKED)

### WR-01 — throttle no "Análise da IA"
- O `handleAiClick` (`fides-orcamento.jsx`) ganha o MESMO padrão de cooldown do chat (`fides-claude.jsx`: `COOLDOWN_NORMAL_SEC=4`, `COOLDOWN_RATELIMIT_SEC=60`). Duplo-tap no mobile não dispara 2ª chamada nem queima a cota de 100/dia.
- Reusar o mecanismo existente do chat onde possível, não inventar um novo.

### WR-02 — single-shot nunca morre em tool_calls
- A chamada do "Análise da IA" passa a proibir tools na requisição (Gemini `toolConfig` com `functionCallingConfig.mode: 'NONE'`), então o modelo SEMPRE retorna texto — nunca `functionCall`. Elimina o caminho que hoje fecha com `GEMINI_ERROR` genérico gastando cota.
- Decisão travada: modo NONE (não executar round-trip READ agora). O round-trip de tools fica para quando a "Análise da IA" precisar de dados frescos — deferido, documentado em STATE Phase 05 ("port executeTools from fides-claude.jsx later"). O chat conversacional MANTÉM suas tools READ — a proibição de tools é SÓ no caminho do botão de análise.

### WR-03 — JWT no header, não no body
- Cliente envia o JWT em `Authorization: Bearer <token>`; o servidor `api/assistant.js` lê do header em vez de `req.body.jwt`. Os DOIS chamadores (`fides-claude.jsx` e `fides-orcamento.jsx`) são atualizados junto com o servidor — nenhum caller pode ficar mandando no body após a mudança.
- Manter compat retroativa durante a transição NÃO é necessário (deploy é atômico via push single-file; front e api sobem juntos).

### AI-SHARED-01 — módulo Gemini compartilhado
- Extrair um helper CommonJS único (payload builder + safetySettings + mapeamento de erros 429/400/502/EMPTY_REPLY) que `api/assistant.js` consome hoje e `api/whatsapp.js` vai consumir na Fase 14.
- **Restrição Vercel:** o helper NÃO pode virar um endpoint roteável. Localização a decidir na pesquisa/plano (convenção `api/_lib/` ou `/lib` fora de `api/`) — verificar como a Vercel roteia funções neste projeto sem `vercel.json` de rewrites. CommonJS obrigatório (nunca ESM — regra do projeto).
- Escopo mínimo: extrair só o que é genuinamente comum. Não refatorar o handler inteiro.

### AI-TELEM-01 — telemetria de tokens
- `assistant_usage` passa a gravar tokens de entrada/saída + latência por chamada. Fonte: `usageMetadata` da resposta Gemini (`promptTokenCount`, `candidatesTokenCount`) + medição de tempo no servidor.
- Migração de schema via MCP `apply_migration` + espelho em `supabase/*.sql` com ALTER standalone `add column if not exists` (aprendizado registrado: create-if-not-exists não altera tabela existente). Colunas nullable (chamadas antigas ficam null, sem backfill).
- Objetivo: custo real por usuário observável, base dos evals das fases 12–14. Não construir dashboard agora — só gravar o dado.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design do épico (fonte da verdade das decisões)
- `.planning/research/whatsapp-e-ia-arquitetura.md` — §B1 (diagnóstico do estado atual), §B2 (por que manter Gemini Flash-Lite), §B3 Fase IA-1 (os 5 itens deste phase), §10 (modelo de custo que a telemetria vai alimentar).

### Código a modificar
- `api/assistant.js` — servidor Gemini atual: `TOOLS_DECLARATION` (:52-91), rate limit `assistant_usage` (:127-152), validação JWT via `req.body.jwt` (:100-125), chamada Gemini + parsing de erro (:154-253).
- `assets/fides-orcamento.jsx` — `PlnMesInsights` / `handleAiClick` (single-shot, sem cooldown; envia jwt no body).
- `assets/fides-claude.jsx` — chat com cooldown existente (`:9-11`, re-arma em `:504-539`); referência do padrão de throttle a reusar; também envia jwt no body (WR-03).

### Review que originou os 3 WRs
- `.planning/milestones/v1.0-phases/05-ia-real/05-REVIEW.md` — WR-01 (:66-87), WR-02 (:89-94), WR-03 (:96-101).

### Schema / segurança
- `supabase/schema.sql` — tabela `assistant_usage` (localizar; adicionar ALTERs de telemetria).
- CLAUDE.md — caminho `api/` é sensível: rodar `security-reviewer` antes de commit. Regra CommonJS (nunca ESM em `api/*.js`).
</canonical_refs>

<specifics>
## Specific Ideas

- O padrão de cooldown do chat é a referência canônica para WR-01 — não criar um segundo mecanismo divergente.
- WR-02 usa o campo `toolConfig`/`tool_config` do payload Gemini (mode NONE) — checar o nome exato do campo na API generativelanguage v1beta usada em `GEMINI_ENDPOINT`.
- WR-03: `supabase.auth.getUser()` aceita o token; a mudança é de ONDE o token vem (header vs body), não de como é validado.
- AI-TELEM-01: Gemini retorna `usageMetadata` no corpo da resposta — já disponível no `geminiData` parseado, só não é lido/gravado hoje.
</specifics>

<deferred>
## Deferred Ideas

- Reativação das tools WRITE (`lancar_transacao` etc.) → Fase 12 (IA-2 / gate B8). IA-1 permanece só-leitura.
- Round-trip de execução de tools no "Análise da IA" (dados frescos) → quando houver necessidade; hoje mode NONE basta.
- Gating por `profiles.plan` / degustação free → Fase 13 (IA-3).
- Dashboard/relatório de custo a partir da telemetria → fora do escopo; IA-1 só grava o dado.
- Troca de modelo (Haiku/DeepSeek) → rejeitado no design (§B2); só reavaliar se evals das fases seguintes mostrarem necessidade.
</deferred>

---

*Phase: 11-ia-1-hardening-do-assistente-gemini*
*Context gathered: 2026-07-06 — decisões derivadas de `.planning/research/whatsapp-e-ia-arquitetura.md` (aceitas pelo usuário)*
