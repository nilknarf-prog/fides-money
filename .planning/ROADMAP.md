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

## PARTE 3 — M4 · Ciclo de fatura confiável — ✅ (commit `ade84f7`, verificado)

> Detalhe completo em `phases/fatura-ciclo/SPEC.md`, `PLAN.md`, `VERIFICATION.md`.

**Problema (resolvido):** o modal "Pagar fatura" consumia `faturaAbertaPorCartao`, que misturava TODAS as compras não quitadas do cartão (junho + julho juntas). Agora usa `faturasPorCartao` (agrupado por `mesFaturaFor`).

**Entregue:** modal por fatura/mês + seletor; status aberta/fechada/vencida; aviso de fechamento no card de Contas; sincronia com valor real da fatura (nova coluna em `cards`).

⚠️ Pendência: 3 testes comportamentais humanos (ver VERIFICATION.md) a rodar no app pós-deploy.

---

## PARTE 3.5 — PRÓXIMO (🔴 Fase 01 · Veracidade do Dashboard) — **FASE ATIVA**

> Detalhe completo a definir em `phases/01-veracidade-do-dashboard/SPEC.md` (rodar `/gsd-spec-phase 1`).

**Tema:** o `DashboardStudio` exibe números que não refletem a verdade financeira do usuário. 3 correções:

| # | Sintoma | Hipótese de causa (a confirmar no SPEC/plan) |
|---|---|---|
| 1 | Card "Para onde foi" mostra limite **R$0 / 0%** nas macro-categorias (Essencial / Estilo de vida / Dívidas) apesar de `category_limits` definidos no Planejamento | Card não faz join com `category_limits` ou lê escopo errado; agregação 50-30-20 não soma limites das categorias-filhas por macro |
| 2 | Gráfico donut: **tooltip da fatia não aparece** (hover desktop nem tap mobile) — fatia vermelha dominante sem identificação | Sem handler hover/tap no SVG; falta `<title>`/tooltip por fatia; mobile precisa tap-to-identify |
| 3 | Aviso **"fechará Junho com −R$655 no vermelho"** assusta sem motivo | Projeção = receitas − despesas do mês, **ignora saldo atual** positivo (correntes + Reserva 99Pay ~R$7.346). **Decisão de produto pendente** → resolver no SPEC: saldo projetado = saldo atual + receitas previstas − despesas previstas? mostrar ambos? mudar cópia? |

**Escopo:** investigação + fix dos 3. Issue #3 exige decisão de produto antes de planejar → começar por `/gsd-spec-phase 1`. Se grande demais, dividir em sub-fases (#1+#2 fix direto; #3 estratégia de projeção).

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
| B11 | **[doc PM]** Migrar Babel-standalone → Vite/Next (build moderno + quality gates: lint/types/testes) | 1+ milestone | débito arquitetural raiz |
| B12 | **[doc PM]** Pipeline CI/CD com ambientes Staging/Production (hoje deploy direto via `push.sh`/`vercel.json`) | 1 sessão | B11 ideal antes |

> Origem B11–B12: `docs/planejamento/Relatórios_ideIA/analise_project_manager.md`. Estratégico, não bloqueia Fase 01.

---

## PARTE 5 — ROADMAP COMERCIAL (⏳ M6)

| # | Item | Skill | Quando |
|---|---|---|---|
| C1 | Landing page | `imagegen-frontend-web` | ao comercializar |
| C2 | FAQ / central de ajuda | `faq-page` | usuários externos |
| C3 | Redesign visual completo | `redesign-existing-projects` | pós-feedback F&F |
| C4 | WhatsApp (Meta Cloud API recomendada) | — | após WRITE estável |
| C5 | Monetização (preço único → mensal) | — | a definir |
| C6 | **[doc blueprint]** GTM: ASO + marketing de conteúdo (canais de aquisição além de F&F) | — | pós F&F |
| C7 | **[doc blueprint]** Validar pricing via A/B (Gratuito / Essencial R$89,9 / Premium R$149,9) | — | base de usuários |
| C8 | **[doc blueprint]** Gamificação / micro-incentivos p/ retenção do registro manual | — | pós-onboarding |
| C9 | **[doc blueprint]** Onboarding guiado + trial p/ reduzir fricção do registro manual | — | — |

> Origem C6–C9: `docs/planejamento/Relatórios_ideIA/fidesmoney-ideia-blueprint.md` (viabilidade 64/100; maior risco = fricção do registro manual). Estratégico/negócio, não fase de código.

## DÍVIDAS TÉCNICAS RASTREADAS

| Dívida | Origem | Risco | Onde resolve |
|---|---|---|---|
| `faturaAbertaPorCartao` mistura faturas | v6 | **Alto** — UX de pagamento incorreta | Fase M4 (ativa) |
| Ambiguidade fechamento vs vencimento na rotulagem | v11 | Médio — confunde usuário | Fase M4 (decisão aberta) |
| `fides-diario.*` dead code | v15 | Baixo — peso morto | P1 |
| `supabase/schema.sql` desatualizado (MCP é a verdade) | v9 | Médio — drift | B10 |
| Roxo off-brand hardcoded | v15 | Baixo — identidade | P2 |
