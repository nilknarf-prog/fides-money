# ROADMAP — Fides Money

> Mapa "feito vs a fazer" derivado dos relatórios v2–v18. Cada fase aponta requisitos e critério de conclusão.
> Legenda: ✅ feito · 🔄 em andamento · 🟡 próximo · ⏳ backlog · 🔴 prioridade alta

---

## PARTE 1 — JÁ FEITO (✅)

### Fase 0 · Fundação Supabase & Auth — ✅ (v2–v4)
- Schema base (`profiles`, `accounts`, `cards`, `transactions`, `goals`), SDK (`fidesDb`, `fidesAuth`, `waitForAuth`), serverless `inject-config.js`.
- Auth email/senha + reset; e-mail de confirmação com branding.
- Bug raiz resolvido: env vars na aba **Project** do Vercel; `tokens.css` como primeiro CSS.

### Fase 1 · Religação Live (mock → Supabase) — ✅ (v5)
- Todas as páginas lendo store real; categorias custom persistidas (`user_categories`); empty states.
- Lição: Dashboard live = `DashboardStudio`.

### Fase 2 · Modelo de movimentação & fatura selecionável v1 — ✅ (v6)
- `is_transfer` consolidado (compra = despesa; pagamento de fatura = movimentação).
- RPC atômico `pay_card_invoice`; transferência via `transfer_funds` + `transfer_group`.

### Fase 3 · Assistente IA (só-leitura) — ✅ (v7–v8)
- Gemini 2.5 Flash-Lite via `api/assistant.js`; tools READ; WRITE removido até fundação sólida.

### Fase 4 · Fundação de dados & UI globais — ✅ (v8)
- FIX-1 `selectedMonth` dinâmico; FIX-2 `delete_transaction` atômico com estorno; `fides-ui` (`ConfirmDialog`/`Toast`/`useConfirm`); bulk actions.

### Fase 5 · Planejamento & Transações (núcleo) — ✅ (v9–v10)
- `category_limits` (3 escopos), cards de categoria, grupos colapsáveis, copiar limites, sugestões.
- Transações: alta densidade, sort/filtros, bulk reais. Fix BUG-DATA (edição de data/mês).

### Fase 6 · Ciclo de fatura (correção `mesFaturaFor`) v1 — ✅ (v11)
- `mesFaturaFor` corrigido (`>=` no fechamento; retorna `monthClose`); `txToRow` passa a chamá-la; backfill de 16 txs.
- FIX-CREDITO (toggle "pago" desabilitado p/ cartão); Google OAuth habilitado; Apple removido.
- ⚠️ **Esta fase corrigiu o cálculo de mês, NÃO o agrupamento do modal de pagamento.** É o débito que a Fase ativa (M4) ataca.

### Fase 7 · Saldo derivado & projeção saneada — ✅ (v12–v16)
- FIX-PROJECAO; KPI "Projeção" removido; `PerfilView`; refactor de saldo derivado (`opening_balance`, `recalc_account_balance`, `set_account_balance` com guarda de dono).

### Fase 8 · Insights determinísticos do mês — ✅ (v17–v18)
- `computeInsights` + `PlnMesInsights`; status "No limite"; tendência por R$ real; ação sugerida por `CUT_PRIORITY`.

### Fase 9 · Ajustes pós-v18 (no working tree, ainda não nos relatórios) — ✅ (commits `2bd41a4`..`714872e`)
- Preview de transferência; aviso de saldo zerado/negativo; grupos minimizáveis; limpeza de CSS morto; mapeamento de tokens fantasma.

---

## PARTE 2 — EM ANDAMENTO (🔄 M3 · Polish pré-lançamento)

| # | Item | Prioridade | Estado | Arquivos |
|---|---|---|---|---|
| P1 | Remover `fides-diario.*` (jsx+css+`<link>`) — dead code cream/gold | 🔴 Alta | ⏳ não iniciado | `index.html`, `assets/fides-diario.*` |
| P2 | `impeccable-design-polish`: roxo off-brand (`.fds-avatar`, `.prf-view`), `--warn` divergente, auditoria CSS | Alta | parcial | `fides.css`, `fides-studio.css`, `fides-orcamento.css` |
| P3 | Acesso ao Perfil no mobile (engrenagem clicável, protótipo Antes/Depois) | Média | ⏳ | `fides-studio.jsx`/`.css` |
| P4 | `emilkowalski-motion` — micro-interações CSS | Alta | ⏳ | CSS de modais/cards |
| P5 | Integração Gemini real no botão "Análise da IA" (hoje stub 2,2s) | Alta | ⏳ | `fides-orcamento.jsx`, `api/assistant.js` |

---

## PARTE 3 — PRÓXIMO (🟡 M4 · Ciclo de fatura confiável) — **FASE ATIVA**

> Detalhe completo em `phases/fatura-ciclo/SPEC.md` e `phases/fatura-ciclo/PLAN.md`.

**Problema:** o modal "Pagar fatura" consome `faturaAbertaPorCartao`, que mistura TODAS as compras não quitadas do cartão (junho + julho juntas), sem permitir pagar apenas a fatura de um mês. Já existe `faturasPorCartao` (agrupado por `mesFaturaFor`) não utilizado pelo modal.

**Entrega:** modal por fatura/mês + seletor; status aberta/fechada/vencida; aviso de fechamento no card de Contas; sincronia opcional com o valor real da fatura do cartão.

Escopo aprovado: **Modal + agrupamento + avisos + sincronia com fatura real** (inclui nova coluna em `cards`).

---

## PARTE 4 — BACKLOG (⏳ M5 · Expansão)

| # | Item | Estimativa | Dependência |
|---|---|---|---|
| B1 | CSV/OFX/PDF import (avaliar `fdt-bulk-*` antes) | 1+ sessão | — |
| B2 | Lote 5B — preview de limite no modal de Nova Transação | ½ sessão | — |
| B3 | CRUD Metas (Claude Design + `design-brief`; tabela `goals` já existe) | 1 sessão | — |
| B4 | Telas Dívidas / Família (Claude Design) | 1+ sessão | — |
| B5 | Investimento ≠ despesa (mudança de modelo de dados) | design próprio | — |
| B6 | Projeção via média histórica (após 3+ meses de dados) | 1+ sessão | histórico |
| B7 | Busca ⌘K funcional | ½ sessão | — |
| B8 | Assistente tools WRITE (pós validação de fundação) | 1+ sessão | fundação 100% |
| B9 | Substituir `confirm()`/`alert()` residuais | ½ sessão | — |
| B10 | Regenerar `supabase/schema.sql` do banco real via MCP | ¼ sessão | — |

---

## PARTE 5 — ROADMAP COMERCIAL (⏳ M6)

| # | Item | Skill | Quando |
|---|---|---|---|
| C1 | Landing page | `imagegen-frontend-web` | ao comercializar |
| C2 | FAQ / central de ajuda | `faq-page` | usuários externos |
| C3 | Redesign visual completo | `redesign-existing-projects` | pós-feedback F&F |
| C4 | WhatsApp (Meta Cloud API recomendada) | — | após WRITE estável |
| C5 | Monetização (preço único → mensal) | — | a definir |

---

## DÍVIDAS TÉCNICAS RASTREADAS

| Dívida | Origem | Risco | Onde resolve |
|---|---|---|---|
| `faturaAbertaPorCartao` mistura faturas | v6 | **Alto** — UX de pagamento incorreta | Fase M4 (ativa) |
| Ambiguidade fechamento vs vencimento na rotulagem | v11 | Médio — confunde usuário | Fase M4 (decisão aberta) |
| `fides-diario.*` dead code | v15 | Baixo — peso morto | P1 |
| `supabase/schema.sql` desatualizado (MCP é a verdade) | v9 | Médio — drift | B10 |
| Roxo off-brand hardcoded | v15 | Baixo — identidade | P2 |
