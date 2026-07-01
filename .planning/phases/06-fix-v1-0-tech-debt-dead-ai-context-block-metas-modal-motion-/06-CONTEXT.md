# Phase 06: Fix v1.0 tech debt - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Zerar as 4 warnings de dívida técnica da auditoria do milestone v1.0 (`v1.0-MILESTONE-AUDIT.md`). Nenhuma nova capacidade — só correção de código morto, inconsistência de motion e divergência de token já entregues nas fases 03/04/05.

**Em escopo (4 itens):**
- WARN-1 — bloco morto em `buildAiContext()` (fides-orcamento.jsx)
- WARN-2 — `setModalOpen(false)` duplicado no caminho de salvar (fides-transacoes.jsx / fides-studio.jsx)
- WARN-3 — 8 modais de `fides-metas.jsx` sem animação de saída (não ligados a `useModalClose`)
- WARN-4 — token `--warn-soft` divergente entre CSS

**Fora de escopo:** qualquer novo comportamento de IA, novos modais, refactor de tokens além de `--warn-soft`.
</domain>

<decisions>
## Implementation Decisions

### WARN-1 · Bloco de contexto IA morto
- **D-01:** Remover o bloco morto (fides-orcamento.jsx:1019-1029). `totals` só carrega `planned/realized/projection/catsWithLimit` — nunca `receitas/despesas`, então o bloco jamais executa. A IA continua recebendo o "Status do Planejamento (50·30·20)" + sinal de tendência. Sem repurpose (duplicaria a linha de planejamento), sem buscar receita/despesa reais (fora de escopo).

### WARN-4 · Token --warn-soft
- **D-02:** Valor canônico = `#FEF0D6` (o de `tokens.css`, fonte da verdade carregada primeiro, e já em `fides-studio.css`). Alinhar as 2 definições de `fides.css` (linhas 40 e 102) de `#FEF3C7` → `#FEF0D6`. Não tocar `tokens.css`/`fides-studio.css`.

### WARN-2 · Double setModalOpen(false)
- **D-03:** Incluir no escopo. Corrigir o double-write frágil no caminho salvar-e-fechar (`onSave?.()` + `requestClose()` ambos disparam `setModalOpen(false)`). Locais: fides-transacoes.jsx:1270-1271, fides-studio.jsx:73-78. Fechar tudo por um único caminho.

### WARN-3 · Motion dos modais de metas
- **D-04:** Ligar TODOS os 8 modais `fds-modal-backdrop` de `fides-metas.jsx` ao hook `useModalClose` (exportado por `window.FidesUI`), replicando o padrão da fase 04 (classe `is-closing` + gate reduced-motion). Saída fade+slide consistente com os 3 modais já em escopo.

### Claude's Discretion
- Ordem de execução dos 4 fixes (independentes; podem ser 1 plan ou waves paralelas).
- Como unificar o caminho de fechamento no WARN-2 (remover a chamada redundante vs. deixar só `requestClose` fazer o `setModalOpen`).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auditoria de origem
- `.planning/v1.0-MILESTONE-AUDIT.md` — define as 4 warnings, localizações exatas e diagnóstico. Fonte da verdade desta fase.

### Padrão de motion já entregue (fase 04)
- `.planning/phases/04-ux-mobile-motion/04-01-PLAN.md` — hook `useModalClose` + keyframes de saída + gate reduced-motion (referência para WARN-3).
- `.planning/phases/04-ux-mobile-motion/04-02-PLAN.md` — wiring dos 3 modais em escopo (padrão a replicar nos 8 de metas).

### Código-alvo
- `assets/fides-orcamento.jsx` §buildAiContext (linhas ~1017-1044) — WARN-1.
- `assets/fides-metas.jsx` — 8 usos de `fds-modal-backdrop` — WARN-3.
- `assets/fides-transacoes.jsx:1270-1271`, `assets/fides-studio.jsx:73-78` — WARN-2.
- `assets/fides.css:40` e `assets/fides.css:102` — WARN-4 (definições a alinhar).
- `assets/fides-ui.jsx` §useModalClose (linhas ~230-292) — hook a reutilizar.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useModalClose(open, onClose)` — exportado em `window.FidesUI` (fides-ui.jsx:238/292). Já usado pelos 3 modais da fase 04. Reusar direto nos 8 de metas.
- Keyframes de saída + gate `prefers-reduced-motion` — já existem em `fides.css` (fase 04). Nenhum CSS novo de animação deve ser necessário além de aplicar a classe.

### Established Patterns
- Modais usam `fds-modal-backdrop` + classe `is-closing` durante a saída animada. Padrão confirmado nos 3 modais em escopo.
- `tokens.css` é a fonte de verdade dos tokens, carregado primeiro (histórico do projeto). Divergências devem convergir PARA ele, não a partir dele.
- `totals` (fides-orcamento.jsx:1266-1279) é um `useMemo` que só produz `planned/realized/projection/catsWithLimit`.

### Integration Points
- WARN-2: caminho salvar-e-fechar cruza fides-transacoes.jsx (child) → fides-studio.jsx (parent `setModalOpen`). Verificar re-open limpo após o fix (mesma armadilha da fase 04-02).
</code_context>

<specifics>
## Specific Ideas

Corrigir os 4 itens exatamente como diagnosticado na auditoria — sem re-arquitetar. Objetivo: fechar v1.0 sem dívida residual antes do ship.
</specifics>

<deferred>
## Deferred Ideas

None — discussão ficou dentro do escopo da fase (as 4 warnings da auditoria).
</deferred>

---

*Phase: 06-fix-v1-0-tech-debt*
*Context gathered: 2026-06-30*
