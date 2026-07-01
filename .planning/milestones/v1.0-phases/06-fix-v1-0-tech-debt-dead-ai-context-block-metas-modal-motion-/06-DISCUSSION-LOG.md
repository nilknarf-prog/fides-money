# Phase 06: Fix v1.0 tech debt - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-30
**Phase:** 06-fix-v1-0-tech-debt
**Areas discussed:** WARN-1 (bloco IA morto), WARN-4 (--warn-soft), WARN-2 (double-close), WARN-3 (motion metas)

---

## WARN-1 · Bloco de contexto IA morto

| Option | Description | Selected |
|--------|-------------|----------|
| Remover bloco morto | Apaga 1019-1029; IA mantém status planejamento + tendência | ✓ |
| Reaproveitar com planned/realized | Emite 'Planejado/Realizado', duplica linha de planejamento | |
| Buscar receita/despesa reais | Conecta income/expense reais; maior esforço | |

**User's choice:** Remover bloco morto
**Notes:** `totals` nunca carrega receitas/despesas (só planned/realized/projection/catsWithLimit) — bloco é morto permanente.

---

## WARN-4 · Token --warn-soft

| Option | Description | Selected |
|--------|-------------|----------|
| #FEF0D6 (tokens.css) | Alinha fides.css → tokens.css (fonte da verdade) + fides-studio.css | ✓ |
| #FEF3C7 (fides.css) | Muda tokens.css + fides-studio.css; sobrescreve token canônico | |

**User's choice:** #FEF0D6 (tokens.css)
**Notes:** tokens.css é fonte da verdade, carregado primeiro. Convergir PARA ele.

---

## WARN-2 · Double setModalOpen(false)

| Option | Description | Selected |
|--------|-------------|----------|
| Incluir WARN-2 | Corrige double-write; zera as 4 warnings | ✓ |
| Deixar pra depois | Mantém fase nos 3 itens do título | |

**User's choice:** Incluir WARN-2
**Notes:** Já mexendo em lógica de fechar modal — corrigir de uma vez.

---

## WARN-3 · Motion dos modais de metas

| Option | Description | Selected |
|--------|-------------|----------|
| Todos os 8 modais | Wire dos 8 fds-modal-backdrop → saída consistente | ✓ |
| Confirmar subconjunto antes | Wire só os acessíveis; diff menor, inconsistência parcial | |

**User's choice:** Todos os 8 modais
**Notes:** Replicar padrão da fase 04 (useModalClose + is-closing + reduced-motion).

---

## Claude's Discretion

- Ordem/estrutura dos plans (1 plan vs waves paralelas — fixes independentes).
- Mecânica exata da unificação do caminho de fechamento no WARN-2.

## Deferred Ideas

None — discussão ficou dentro do escopo (as 4 warnings da auditoria).
