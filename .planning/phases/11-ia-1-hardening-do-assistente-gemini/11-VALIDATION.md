---
phase: 11
slug: ia-1-hardening-do-assistente-gemini
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-06
---

# Phase 11 — Validation Strategy

> Per-phase validation contract. **Este projeto não tem test runner** (React via Babel-standalone, sem bundler/npm no front; `api/*.js` = funções Vercel CommonJS sem suíte). Verificação = inspeção estática de código + human-verify no app deployado, espelhando o padrão estabelecido na Fase 05 (05-VERIFICATION.md). Não há amostragem automatizada possível; este documento mapeia cada requisito à sua prova estática/manual.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — Babel-standalone no front, sem bundler/test runner; `api/*.js` sem suíte |
| **Config file** | none |
| **Quick run command** | none (verificação = `grep`/inspeção de blob + human-verify no app) |
| **Full suite command** | none |
| **Estimated runtime** | n/a |

---

## Sampling Rate

- **Após cada task:** inspeção estática do blob (grep dos anchors + leitura do diff) — sem comando automatizado.
- **Antes de `/gsd-verify-work`:** deploy em Vercel + human-verify das superfícies afetadas (chat + botão "Análise da IA").
- **Caminho `api/`/`supabase/`:** `security-reviewer` + `database-reviewer` antes do commit (regra CLAUDE.md).

---

## Per-Task Verification Map

| Requisito | Prova (estática ou human-verify) | Tipo |
|-----------|----------------------------------|------|
| WR-01 | Estática: `handleAiClick` (`fides-orcamento.jsx`) checa cooldown antes do fetch e re-arma em todo caminho terminal (grep do estado de cooldown). Human-verify: duplo-tap rápido no botão "Análise da IA" no mobile dispara só 1 chamada. | static + human |
| WR-02 | Estática: payload do caminho de análise inclui `toolConfig.functionCallingConfig.mode='NONE'`; `grep` confirma que o branch `tool_calls`/`GEMINI_ERROR` não é mais alcançável para análise. Human-verify: análise retorna texto, nunca erro genérico. | static + human |
| WR-03 | Estática: `api/assistant.js` lê JWT de `req.headers.authorization` (não `req.body.jwt`); ambos callers montam header `Authorization: Bearer`; `grep -n "body.jwt"` → 0. Human-verify: chat + análise seguem autenticando pós-deploy. | static + human |
| AI-SHARED-01 | Estática: existe `api/_lib/gemini.js` CommonJS; `api/assistant.js` faz `require` dele; `_lib/` não é roteado como endpoint (nome com `_`). Human-verify: chat + análise funcionam (regressão zero). | static + human |
| AI-TELEM-01 | Estática: migração aplicada (colunas `prompt_tokens`/`completion_tokens`/`latency_ms` nullable em `assistant_usage`) + espelho `.sql` criado; servidor lê `usageMetadata` e grava via update. DB-verify: `select` mostra linhas novas com tokens preenchidos. | static + db-verify |

---

## Wave 0 Requirements

- Nenhum framework a instalar (projeto sem test runner por design — débito arquitetural B11, fora deste escopo).
- *Existing infrastructure: verificação é human-verify + inspeção estática, conforme Fase 05.*

---

## Manual-Only Verifications

| Behavior | Requisito | Por que manual | Instruções |
|----------|-----------|----------------|------------|
| Duplo-tap no botão de análise dispara 1 chamada | WR-01 | Comportamento de timing/UI, sem test runner | No app deployado (400×512px iOS Safari), tocar "Análise da IA" 2× rápido; confirmar 1 resposta e cota +1 (não +2) em `assistant_usage`. |
| Análise nunca retorna erro genérico por tool_calls | WR-02 | Depende da resposta real do Gemini | Rodar análise algumas vezes; confirmar sempre texto, nunca `GEMINI_ERROR`. |
| Auth segue funcionando pós-mudança de header | WR-03 | Fluxo end-to-end auth | Após deploy, chat responde e análise responde autenticados; deslogar → 401 amigável. |
| Regressão zero após extrair helper | AI-SHARED-01 | Integração serverless | Chat + análise funcionam idênticos ao pré-mudança. |
| Telemetria grava tokens reais | AI-TELEM-01 | Requer chamada real + inspeção de banco | Após 1 chamada, `select prompt_tokens, completion_tokens, latency_ms from assistant_usage order by created_at desc limit 1` mostra valores não-nulos coerentes. |

---

## Validation Sign-Off

- [ ] Cada requisito tem prova estática OU human-verify mapeada acima
- [ ] Caminho `api/` revisado por `security-reviewer` (WR-03 é segurança)
- [ ] Caminho `supabase/` (AI-TELEM-01) revisado por `database-reviewer`
- [ ] Human-verify das 5 provas manuais executado no app deployado antes de `/gsd-verify-work 11`

**Approval:** pending

> Nota: `nyquist_compliant` permanece `false` intencionalmente — o modelo de amostragem automatizada do Nyquist não se aplica a um projeto sem test runner. A garantia de qualidade aqui é inspeção estática + human-verify (padrão herdado da Fase 05), não cobertura de testes. Reavaliar quando/se o projeto migrar para Vite/Next com suíte (débito B11).
