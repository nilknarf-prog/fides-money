# Requirements: Fides Money

**Defined:** 2026-06-29
**Milestone:** v1.0 — Polish pré-lançamento
**Core Value:** Finanças pessoais por registro manual (fricção intencional → consciência); nunca número que impressiona mas engana.

## v1 Requirements

### CLEAN — Limpeza de código (P1)

- [x] **CLEAN-01**: `fides-diario.jsx` e `fides-diario.css` removidos do repositório e `<link>` correspondente removido de `index.html`

### DESIGN — Visual polish (P2)

- [x] **DESIGN-01**: Avatar (`.fds-avatar`) usa token de cor de marca — sem roxo hardcoded
- [x] **DESIGN-02**: View de perfil (`.prf-view`) usa token de cor de marca — sem roxo hardcoded
- [x] **DESIGN-03**: Token `--warn` consistente entre todos os arquivos CSS (`fides.css`, `fides-studio.css`, `fides-orcamento.css`)
- [x] **DESIGN-04**: `fides.css`, `fides-studio.css` e `fides-orcamento.css` auditados — propriedades mortas e divergentes removidas

### MOBILE — Acesso ao perfil mobile (P3)

- [x] **MOBILE-01**: Usuário acessa `PerfilView` via ícone de engrenagem clicável em 400×512px iOS Safari

### MOTION — Micro-interações (P4)

- [x] **MOTION-01**: Modais exibem transição de entrada/saída suave via CSS keyframes (sem JS adicional)
- [x] **MOTION-02**: Cards de categoria e conta têm micro-interação em tap/hover (CSS, não JS)

### AI — Integração IA real (P5)

- [x] **AI-01**: Botão "Análise da IA" em `fides-orcamento.jsx` chama `api/assistant.js` real (não stub de 2,2s)
- [x] **AI-02**: UI exibe loading state e resposta da IA sem travamento do thread principal

### DEBT — Dívida técnica v1.0 (Phase 06 — fecha as 4 warnings de `v1.0-MILESTONE-AUDIT.md`)

- [x] **DEBT-01** (WARN-1): Bloco morto em `buildAiContext()` (`fides-orcamento.jsx`) que lê `totals.receitas/despesas` inexistentes é removido — IA mantém status do planejamento + tendência
- [x] **DEBT-02** (WARN-3): Os 8 modais `fds-modal-backdrop` de `fides-metas.jsx` são ligados a `useModalClose` — saída animada consistente com os 3 modais da fase 04
- [x] **DEBT-03** (WARN-4): Token `--warn-soft` alinhado para `#FEF0D6` (valor de `tokens.css`) em `fides.css` — consistente em todos os CSS
- [x] **DEBT-04** (WARN-2): `setModalOpen(false)` duplicado no caminho salvar-e-fechar (`fides-transacoes.jsx` / `fides-studio.jsx`) eliminado — dispara uma única vez

## v2 Requirements (M5 Expansão — deferred)

### META — Metas

- **META-01**: Usuário cria meta com nome, valor-alvo e prazo
- **META-02**: Usuário acompanha progresso da meta
- **META-03**: Usuário edita e exclui metas

### IMPORT — Importação de dados

- **IMPORT-01**: Usuário importa transações via CSV
- **IMPORT-02**: Usuário importa transações via OFX

### UX

- **UX-01**: Usuário busca transações via ⌘K / campo de busca
- **UX-02**: Modal de Nova Transação exibe preview de limite da categoria selecionada

## Out of Scope

| Feature | Reason |
|---------|--------|
| Migração Babel → Vite/Next | Débito arquitetural raiz — milestone próprio (B11) |
| Pipeline CI/CD staging/production | Aguarda B11; separado do polish |
| Assistente WRITE (escrita de transações pela IA) | Aguarda fundação 100% estável (B8) |
| Telas Dívidas / Família | M5+ — design próprio necessário |
| Investimento ≠ despesa | Mudança de modelo de dados — M5+ |
| Projeção via média histórica | Requer 3+ meses de dados |
| WhatsApp / Meta Cloud API | Pós validação de WRITE estável |
| Monetização / landing / comercial | M6 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLEAN-01 | Phase 03 | Complete |
| DESIGN-01 | Phase 03 | Complete |
| DESIGN-02 | Phase 03 | Complete |
| DESIGN-03 | Phase 03 | Complete |
| DESIGN-04 | Phase 03 | Complete |
| MOBILE-01 | Phase 04 | Complete |
| MOTION-01 | Phase 04 | Complete |
| MOTION-02 | Phase 04 | Complete |
| AI-01 | Phase 05 | Complete |
| AI-02 | Phase 05 | Complete |
| DEBT-01 | Phase 06 | Complete |
| DEBT-02 | Phase 06 | Complete |
| DEBT-03 | Phase 06 | Complete |
| DEBT-04 | Phase 06 | Complete |

**Coverage:**

- v1 requirements: 10 total (+ 4 DEBT em Phase 06)
- Mapped to phases: 14/14 ✓
- Unmapped: 0

---
*Requirements defined: 2026-06-29*
*Last updated: 2026-06-29 — roadmap phases 03–05 mapped (M3 v1.0)*
