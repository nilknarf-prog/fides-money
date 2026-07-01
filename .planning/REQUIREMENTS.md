# Requirements: Fides Money

**Defined:** 2026-07-01
**Milestone:** v1.1 — CRUD Metas
**Core Value:** Finanças pessoais por registro manual (fricção intencional → consciência); nunca número que impressiona mas engana.

## v1.1 Requirements

### META — CRUD de Metas

- [ ] **META-01**: Usuário cria uma meta (nome, valor-alvo, prazo) persistida na tabela `goals`
- [ ] **META-02**: Usuário edita nome, valor-alvo e/ou prazo de uma meta existente e a mudança persiste
- [ ] **META-03**: Usuário exclui uma meta via modal de confirmação; a meta some da lista após confirmar
- [ ] **META-04**: A view de Metas lista as metas reais do usuário (não placeholder), refletindo criação/edição/exclusão sem reload da página

## Future Requirements (deferred)

### META — evolução (M5+)

- **META-05**: Usuário registra aportes que somam ao progresso da meta
- **META-06**: Usuário acompanha progresso (valor atual vs alvo, % , tempo restante)
- **META-07**: Ajuste de plano — recalcular aporte mensal sugerido para bater o prazo

### IMPORT — Importação de dados

- **IMPORT-01**: Usuário importa transações via CSV
- **IMPORT-02**: Usuário importa transações via OFX

### UX

- **UX-01**: Usuário busca transações via ⌘K / campo de busca
- **UX-02**: Modal de Nova Transação exibe preview de limite da categoria selecionada

## Out of Scope

| Feature | Reason |
|---------|--------|
| Fonte do valor atual da meta (aportes manuais vs vínculo a conta/reserva) | Decisão de modelo de dados — resolver em `/gsd-discuss-phase 07` antes de planejar aportes/progresso |
| Aportes / acompanhamento de progresso / ajuste de plano | Dependem da decisão de fonte de valor — M5+ |
| Import CSV/OFX | M5 Expansão — milestone próprio |
| Busca ⌘K | M5 Expansão |
| Assistente WRITE | Aguarda fundação 100% estável (B8) |
| Migração Babel → Vite/Next, CI/CD | Débito arquitetural — milestone próprio (B11/B12) |
| Monetização / landing / comercial | M6 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| META-01 | Phase 07 | Pending |
| META-02 | Phase 07 | Pending |
| META-03 | Phase 07 | Pending |
| META-04 | Phase 07 | Pending |

**Coverage:**

- v1.1 requirements: 4 total
- Mapped to phases: 4/4 ✓
- Unmapped: 0

---
*Requirements defined: 2026-07-01 — Milestone v1.1 CRUD Metas*
*Roadmap created: 2026-07-01 — Phase 07 (CRUD Metas) covers all 4 requirements*
