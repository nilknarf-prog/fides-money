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
