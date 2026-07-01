# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Polish pré-lançamento

**Shipped:** 2026-07-01
**Phases:** 4 (03, 04, 05, 06) | **Plans:** 9 | **Tasks:** 21

### What Was Built
- Limpeza + tokens: dead code `fides-diario.*` removido, avatares/perfil migrados de roxo hardcoded para tokens de marca, `--warn`/`--warn-soft` consistentes.
- UX mobile + motion: engrenagem clicável abre `PerfilView` em 400×512px; `useModalClose` anima entrada/saída de modais e cards.
- IA real: stub de 2,2s substituído por fetch single-shot ao `/api/assistant` (Gemini 2.5 Flash-Lite) com loading/erro amigável.
- Fix tech debt (Phase 06 INSERTED): fechou as 4 warnings da auditoria — bloco morto de IA, motion dos 8 modais de Metas, `--warn-soft` alinhado, double `setModalOpen` eliminado.

### What Worked
- Auditoria de milestone (`gsd-audit-milestone`) pegou 4 defeitos de qualidade não-bloqueantes antes do close; a Phase 06 inserida os fechou todos em 2 plans.
- Hook único `useModalClose` reusado de fase em fase — o padrão da fase 04 aplicou-se direto aos 8 modais de Metas na 06 sem novo design.
- Waves sequenciais quando plans compartilham o mesmo arquivo (`fides-studio.jsx`) evitaram conflitos de edição.

### What Was Inefficient
- Divergência de `--warn-soft` passou pela auditoria da fase 03 (só rastreava `--warn-bg`) e virou débito na fase 06 — auditoria de tokens irmãos deveria ter sido exaustiva de primeira.
- Bloco morto de IA (`totals.receitas/despesas` inexistentes) foi flagrado no 05-REVIEW mas deixado sem fix, exigindo a fase 06.

### Patterns Established
- `useModalClose` + classe `is-closing` = padrão canônico de saída animada de modal, com gate `prefers-reduced-motion`.
- Fechamento de modal por via única (`requestClose → onClose`), nunca double-write de estado.
- IA single-shot fail-closed: erro amigável em vez de hang; tool round-trips ficam para port futuro de `executeTools`.

### Key Lessons
1. Auditoria de tokens deve cobrir a família inteira (`--warn`, `--warn-soft`, `--warn-bg`), não um por vez — cascade mascara divergência até um refactor de ordem quebrar.
2. Warning de code-review não corrigido na hora vira fase inteira depois; fechar no plano de origem é mais barato.
3. Inserir fase decimal/tech-debt no fim do milestone é um caminho limpo para converter achados de auditoria em trabalho rastreável.

### Cost Observations
- Model mix: execução do app feita fora do GSD (Deyglison via Gemini 3.1 Pro / Sonnet); `.planning/` só planeja.
- Timeline: 2026-06-29 → 2026-07-01 (3 dias).
- Notable: Phase 06 (2 plans, ~18min combinados) fechou 4 warnings — alto retorno para custo baixo.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v1.0 | 4 | Primeiro milestone GSD completo; auditoria→fase-de-débito inserida antes do close |

### Cumulative Quality

| Milestone | Requirements | Coverage | Deferred |
|-----------|--------------|----------|----------|
| v1.0 | 14/14 | 100% | 1 (UAT humano fatura-ciclo, M4) |

### Top Lessons (Verified Across Milestones)

1. Auditar famílias de tokens por inteiro, não item a item. *(a revalidar em milestones futuros)*
