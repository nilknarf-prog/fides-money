# Milestones

## v1.0 Polish pré-lançamento (Shipped: 2026-07-01)

**Phases completed:** 4 phases, 9 plans, 21 tasks

**Key accomplishments:**

- CLEAN-01 já estava satisfeito pelo commit d4db34f. Nenhuma edição necessária.
- Conclusao: ZERO duplicatas verdadeiras (redundantes).
- 3 modais (NovaTransacao, Categoria, ConfirmDelete de contas) migrados de `onClose` direto para `useModalClose`, com saída animada real, cancelamento de race no re-open, e travamento de clique durante o fade-out.
- Replaced the 2.2s `setTimeout` stub in `PlnMesInsights` with a real single-shot fetch to `/api/assistant`, rendering Gemini's reply in a new `.pln-mi-ai-result` panel or a friendly `.pln-mi-ai-error` message, with a `prefers-reduced-motion` gate on the loading spinner.
- buildAiContext() enxuto sem bloco morto, --warn-soft unificado em #FEF0D6 e fechamento de modal roteado por via única (requestClose→onClose), fechando 3 das 4 warnings da auditoria v1.0.
- Todos os 8 modais `fds-modal-backdrop` de `fides-metas.jsx` agora fecham com fade-out + slide-down via `window.FidesUI.useModalClose`, replicando exatamente o padrão da fase 04 — fechando WARN-3/DEBT-02 do audit v1.0.

**Known deferred items at close:** 1 (see STATE.md Deferred Items) — `fatura-ciclo-VERIFICATION.md [human_needed]`, UAT humano de feature já shipada no M4 (`ade84f7`), fora do escopo v1.0.

---

## v1.1 Metas + Transações (Shipped: 2026-07-06)

**Phases completed:** 4 phases (07-10), 22 plans

**Key accomplishments:**

- **Metas CRUD (Phase 07):** view de Metas deixou de ser read-only — criar/editar/excluir/listar metas (nome, valor-alvo, prazo) persistidas em `goals`, com colunas novas `target_date`/`description` e trio `addGoal/updateGoal/deleteGoal` espelhando accounts.
- **Metas vision-board (Phase 08):** tela de Metas virou vision-board — 16 capas SVG bespoke + upload próprio (bucket `goal-covers` RLS owner-only), busca/filtro por status, hero editorial `met-hero`, Aportar/Atualizar-saldo inline e Marcar-como-concluída (auto-conclusão a >=alvo, sem auto-reabertura).
- **Transações power tools (Phase 09):** filtro dedicado de Cartões, paginação 20/50/100, analytics de gasto por categoria cross-month com range, export CSV (fix CSV-injection), persistência de filtros e ⌘K command palette.
- **Fatura + import hardening (Phase 10):** `computeFaturaDates` corrige fechamento/vencimento para qualquer config (Bradesco fecha 19/vence 1) sem regressão; import CSV/OFX ganha preview/seleção/confirmação + dedupe (fecha incidente real de 196 txs duplicadas); chip "Cartão" no masthead + modo Período com hover/tap.

**Stats:** 120 commits desde v1.0; UAT final 8/8 pass (Phase 10); CR-01/WR-01/WR-02 fechados (`c2cd89d`). Requisitos: 9/9 formais Complete (+ TX-01..08, UAT-1..7 via PRD Express).

**Deferido no fechamento:** fonte do valor atual da meta (aportes vs vínculo a conta) → M5+; épico IA/WhatsApp (Phases 11–14) → próximo milestone.

Detalhe completo: `milestones/v1.1-ROADMAP.md` · requisitos: `milestones/v1.1-REQUIREMENTS.md`.

---
