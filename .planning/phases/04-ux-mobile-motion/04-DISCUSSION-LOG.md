# Phase 04: UX Mobile + Motion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-30
**Phase:** 04-ux-mobile-motion
**Areas discussed:** Padrão do estado closing

---

## Padrão do estado closing

| Option | Description | Selected |
|--------|-------------|----------|
| Hook compartilhado em fides-ui | `useModalClose(open, onClose)` → `{rendered, closing, requestClose}`; troca `if(!open) return null` por `if(!rendered) return null` + classe `is-closing` | ✓ |
| Inline por modal | `useState('closing')` + `setTimeout` local em cada um dos 3 modais, sem abstração | |
| `<ModalShell>` wrapper | Componente que possui os divs do backdrop/modal e a animação; modais renderizam children dentro | |

**User's choice:** Hook compartilhado em fides-ui
**Notes:** `fides-ui.jsx` já hospeda primitivos de dialog (ConfirmDialog) e keyframes `fui-*` — casa natural. Aplicar aos 3 modais `.fds-modal-backdrop` do escopo (NovaTransacao, Categoria, contas); demais modais ficam para fase futura.

| Option | Description | Selected |
|--------|-------------|----------|
| Travar interação (pointer-events:none) | `pointer-events:none` no `.fds-modal.is-closing` durante o fade-out | ✓ |
| Manter interativo | Sem trava; usuário poderia clicar nos ~180ms de saída | |

**User's choice:** Travar interação (pointer-events:none)
**Notes:** Evita clique acidental em botões durante a janela de saída.

---

## Claude's Discretion

Áreas de gray-area não selecionadas pelo usuário — defaults recomendados registrados no CONTEXT.md para o planner:
- Posição da engrenagem no masthead mobile (slot exato em 400px)
- Keyframes de saída: estender `fds-fadeIn`/`fds-slideUp` com variantes `-out` em `fides.css`
- Toggle "view anterior": rastrear `lastView` no estado `active`
- Classes exatas dos cards de categoria (`.stu-acct` de conta já confirmado)

## Deferred Ideas

- Wire do avatar do rodapé (`.fds-sb-slim-avatar`) — fora do escopo do SPEC
- Adotar `useModalClose` nos demais modais (metas, TxAdvFilters, tweaks, fui dialog) — fase futura de consistência
- Micro-interação em cards de transação (`.stu-tx`) e outros
