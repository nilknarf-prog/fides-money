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

## PARTE 3.5 — Fase 01 · Veracidade do Dashboard — ✅ (commit `e3783f3`, verificado)

> Detalhe completo em `phases/01-veracidade-do-dashboard/` (`SPEC.md`, `CONTEXT.md`, `RESEARCH.md`, `PATTERNS.md`, `PLAN.md`).

**Goal:** o `DashboardStudio` reflete a verdade financeira em 3 pontos hoje quebrados — card 50·30·20 lê limites reais (`categoryLimits`), cada fatia do donut é identificável (categoria + valor + %), e o número de fechamento do hero vira saldo projetado real (incorpora `accounts.balance`), sem esconder fluxo mensal negativo (P1).

**Requirements:** R1 (budgetGroups · limites reais), R2 (tooltip de fatia do donut), R3 (saldo projetado no hero)

**Plans:** 3 plans (waves 1→2→3, sequenciais por compartilharem `fides-studio.jsx`)

- [x] 00-01-PLAN.md — R1: `budgetGroups` lê `categoryLimits` + estado "sem limite" no card
- [x] 00-02-PLAN.md — R2: tooltip de fatia no `Donut` (centro reusado) + dismiss mobile
- [x] 00-03-PLAN.md — R3: `saldoProjetado` no hero + fluxo negativo visível (P1)

**Tema:** o `DashboardStudio` exibe números que não refletem a verdade financeira do usuário. 3 correções:

| # | Sintoma | Hipótese de causa (a confirmar no SPEC/plan) |
|---|---|---|
| 1 | Card "Para onde foi" mostra limite **R$0 / 0%** nas macro-categorias (Essencial / Estilo de vida / Dívidas) apesar de `category_limits` definidos no Planejamento | Card não faz join com `category_limits` ou lê escopo errado; agregação 50-30-20 não soma limites das categorias-filhas por macro |
| 2 | Gráfico donut: **tooltip da fatia não aparece** (hover desktop nem tap mobile) — fatia vermelha dominante sem identificação | Sem handler hover/tap no SVG; falta `<title>`/tooltip por fatia; mobile precisa tap-to-identify |
| 3 | Aviso **"fechará Junho com −R$655 no vermelho"** assusta sem motivo | Projeção = receitas − despesas do mês, **ignora saldo atual** positivo (correntes + Reserva 99Pay ~R$7.346). **Decisão de produto pendente** → resolver no SPEC: saldo projetado = saldo atual + receitas previstas − despesas previstas? mostrar ambos? mudar cópia? |

**Escopo:** investigação + fix dos 3. Issue #3 exige decisão de produto antes de planejar → começar por `/gsd-spec-phase 1`. Se grande demais, dividir em sub-fases (#1+#2 fix direto; #3 estratégia de projeção).

---

## PARTE 3.6 — Fase 02 · Fixes de Experiência — ✅ (commit `3549395`, verificado)

> Detalhe completo em `phases/02-fixes-experiencia/01-01-PLAN.md`.

**Entregue:**

- [x] Sort por Data com desempate `createdAt` DESC — transação mais nova do dia aparece em cima
- [x] `onAuthStateChange` não re-fetch em `TOKEN_REFRESHED` — sem piscar ao voltar de aba

---

## PARTE 3.7 — ✅ M3 v1.0 Polish pré-lançamento — SHIPPED 2026-07-01 (tag `v1.0`)

- [x] **Phase 2: Limpeza + Tokens** (2/2) — Dead code removido e identidade visual alinhada aos tokens de marca (2026-06-30)
- [x] **Phase 3: UX Mobile + Motion** (4/4) — Perfil acessível no mobile e micro-interações CSS em modais/cards (2026-07-01)
- [x] **Phase 4: IA Real** (1/1) — Botão "Análise da IA" conectado ao Gemini real (2026-07-01)
- [x] **Phase 5: Fix v1.0 tech debt** (2/2, INSERTED) — Fecha as 4 warnings da auditoria v1.0 (2026-07-01)

> Detalhe completo arquivado em `milestones/v1.0-ROADMAP.md`.

<details>
<summary>Phase Details (Phases 02-06) — clique para expandir</summary>

---

### Phase 2: Limpeza + Tokens

**Goal**: O repositório não contém código morto e toda a UI usa exclusivamente tokens CSS de marca — sem valores hardcoded de cor fora dos tokens.
**Depends on**: Fase 02 (concluída)
**Requirements**: CLEAN-01, DESIGN-01, DESIGN-02, DESIGN-03, DESIGN-04
**Key files**: `index.html`, `fides-diario.jsx`, `fides-diario.css`, `fides.css`, `fides-studio.css`, `fides-orcamento.css`, `tokens.css`
**Success Criteria** (what must be TRUE):

  1. Os arquivos `fides-diario.jsx` e `fides-diario.css` não existem no repositório e nenhuma `<link>` ou `import` os referencia em `index.html`
  2. O avatar do usuário (`.fds-avatar`) exibe a cor correta de marca em qualquer tema — sem roxo hardcoded visível no DevTools
  3. A view de perfil (`.prf-view`) exibe cor de marca consistente com o resto da UI — sem roxo hardcoded
  4. O token `--warn` tem o mesmo valor em `fides.css`, `fides-studio.css` e `fides-orcamento.css` (verificável com grep)
  5. `fides.css`, `fides-studio.css` e `fides-orcamento.css` não contêm regras duplicadas ou propriedades sem referência no DOM (verificável por diff do audit)

**Plans**: 2/2 plans complete
**Wave 1**

- [x] 02-01-PLAN.md — CLEAN-01 (verificação) + DESIGN-01/02/03: avatares roxo→verde de marca, perfil on-brand, token `--warn` consistente

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — DESIGN-04: auditoria conservadora dos 3 CSS (duplicatas, órfãos, tokens fantasma)

**Achados do planejamento**: `fides-diario.*` já removido no commit `d4db34f` (CLEAN-01 vira verificação de estado). `.prf-view`/`.prf-avatar` já usam `var(--accent)` (DESIGN-02 conforme; apenas audita). Roxo real (`#6366F1→#8B5CF6`) vive em DOIS avatares: `.fds-avatar` (fides.css) e `.fds-sb-slim-avatar` (fides-studio.css). Única divergência de `--warn`: `#D97706` no bloco legado `.fds-app[data-variant="v3"]`.
**UI hint**: yes

---

### Phase 3: UX Mobile + Motion

**Goal**: O usuário acessa o perfil pelo mobile via engrenagem e percebe transições suaves ao abrir/fechar modais e interagir com cards — tudo via CSS, sem JS adicional.
**Depends on**: Phase 2
**Requirements**: MOBILE-01, MOTION-01, MOTION-02
**Key files**: `fides-studio.jsx`, `fides-studio.css`, CSS de modais (fides.css / fides-studio.css), CSS de cards
**Success Criteria** (what must be TRUE):

  1. Em viewport 400×512px (iOS Safari), tocar o ícone de engrenagem abre a `PerfilView` — o ícone é visível e clicável sem zoom ou scroll horizontal
  2. Ao abrir qualquer modal, o conteúdo entra com animação de fade/slide suave; ao fechar, sai com transição de saída visível (não corte abrupto)
  3. Ao tocar/hover em um card de categoria ou conta, há micro-feedback visual (ex.: escala, brilho, sombra) implementado puramente em CSS
  4. As animações não causam jank em iPhone SE (400px) — nenhum `transform` ou `opacity` transition acima de 300ms sem `will-change` ou GPU hint

**Plans**: 4/4 plans complete

**Wave 1**

- [x] 03-01-PLAN.md — MOTION-01/PERF: hook `useModalClose` (fides-ui.jsx) + keyframes de saída + gate reduced-motion (fides.css)
- [x] 03-03-PLAN.md — MOBILE-01: engrenagem clicável no masthead (≤768px) + foot gear desktop + estado `lastView`/toggle

**Wave 2** *(blocked on Wave 1)*

- [x] 03-02-PLAN.md — MOTION-01: wiring dos 3 modais (NovaTransacao/Categoria/contas) ao `useModalClose` (saída animada, re-open limpo)
- [x] 03-04-PLAN.md — MOTION-02/PERF: micro-feedback CSS em `.stu-acct` e `.cat-card` (`:hover` isolado em `@media (hover:hover)` + `:active` scale)

**UI hint**: yes

---

### Phase 4: IA Real

**Goal**: O botão "Análise da IA" chama o Gemini 2.5 Flash-Lite real e exibe a resposta na UI com loading state, sem travar o thread principal.
**Depends on**: Phase 2
**Requirements**: AI-01, AI-02
**Key files**: `fides-orcamento.jsx`, `api/assistant.js`
**Success Criteria** (what must be TRUE):

  1. Ao clicar "Análise da IA", a UI exibe imediatamente um indicador de loading (spinner ou skeleton) — o botão não fica silencioso
  2. Após resposta do Gemini (tipicamente 2–8s), o texto da análise aparece na área designada da UI sem recarregar a página
  3. Se a chamada falhar (rede, erro 5xx), a UI exibe mensagem de erro amigável — não trava nem fica em loading infinito
  4. O arquivo `api/assistant.js` usa `commonjs` (`require`/`module.exports`) — nenhum `import`/`export` ESM introduzido

**Plans**: 1/1 plans complete

- [x] 04-01-PLAN.md — AI-01/AI-02: substitui stub 2,2s por fetch real ao `/api/assistant`; 3 superfícies (loading spinner com gate reduced-motion, painel `.pln-mi-ai-result`, erro `.pln-mi-ai-error`); garantia never-hang + checkpoint humano

**UI hint**: yes

---

### Phase 5: Fix v1.0 tech debt

**Goal**: A base v1.0 fica sem as 4 warnings da auditoria do milestone — bloco de contexto de IA morto removido, os 8 modais de metas com motion consistente, token `--warn-soft` alinhado e o `setModalOpen(false)` duplicado eliminado.
**Depends on**: Phase 4
**Requirements**: DEBT-01, DEBT-02, DEBT-03, DEBT-04
**Key files**: `assets/fides-orcamento.jsx`, `assets/fides-metas.jsx`, `assets/fides.css`, `assets/fides-transacoes.jsx`, `assets/fides-studio.jsx`, `assets/fides-ui.jsx`
**Success Criteria** (what must be TRUE):

  1. **DEBT-01 (WARN-1):** O bloco morto em `buildAiContext()` (fides-orcamento.jsx ~1019-1029) que lê `totals.receitas/despesas` não existe mais — a IA continua recebendo status do planejamento + tendência (verificável por grep)
  2. **DEBT-02 (WARN-3):** Os 8 modais `fds-modal-backdrop` de `fides-metas.jsx` abrem/fecham com a mesma animação de saída dos demais (via `useModalClose` + `is-closing`), sem corte abrupto
  3. **DEBT-03 (WARN-4):** O token `--warn-soft` = `#FEF0D6` em todos os CSS que o definem (fides.css alinhado a tokens.css/fides-studio.css; verificável por grep)
  4. **DEBT-04 (WARN-2):** O caminho salvar-e-fechar dispara `setModalOpen(false)` uma única vez (fides-transacoes.jsx / fides-studio.jsx) — sem double-write

**Plans**: 2/2 plans complete

Plans:

- [x] 05-01-PLAN.md — DEBT-01/03/04: remove bloco morto de `buildAiContext()`, alinha `--warn-soft`→`#FEF0D6` em fides.css, elimina `setModalOpen(false)` duplicado
- [x] 05-02-PLAN.md — DEBT-02: liga os 8 modais `fds-modal-backdrop` de fides-metas.jsx ao `useModalClose` (saída animada via `is-closing`, mesmo padrão da fase 04)

**Marker**: (INSERTED) — débito técnico v1.0 (fecha as 4 warnings de `v1.0-MILESTONE-AUDIT.md`)
**UI hint**: no (replica padrão de motion existente da fase 04 — sem novo design)

---

### Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 03 - Limpeza + Tokens | 2/2 | Complete    | 2026-06-30 |
| 04 - UX Mobile + Motion | 4/4 | Complete    | 2026-07-01 |
| 05 - IA Real | 1/1 | Complete    | 2026-07-01 |
| 06 - Fix v1.0 tech debt | 2/2 | Complete   | 2026-07-01 |

</details>

---

## PARTE 3.8 — ✅ v1.1 Metas + Transações — SHIPPED 2026-07-06 (tag `v1.1`)

- [x] **Phase 07: CRUD Metas** (3/3) — Metas deixa de ser read-only: criar/editar/excluir/listar em `goals` (2026-07-01)
- [x] **Phase 08: Metas vision-board** (8/8) — capas SVG/upload, busca/filtro por status, hero editorial, aportar/concluir inline (2026-07-03)
- [x] **Phase 09: Transações power tools + analytics** (5/5) — filtro Cartões, paginação 20/50/100, gasto cross-month, CSV, ⌘K (2026-07-04)
- [x] **Phase 10: Fatura cartão + hardening import** (6/6) — computeFaturaDates + preview/dedupe de import (2026-07-05)

> Detalhe completo arquivado em `milestones/v1.1-ROADMAP.md`.

<details>
<summary>Phase Details (Phases 07-10) — clique para expandir</summary>

### Phase 6: CRUD Metas

**Goal**: A view de Metas deixa de ser read-only — usuário cria, edita e exclui metas (nome, valor-alvo, prazo) com persistência real na tabela `goals`, e a lista reflete o estado atual do banco sem reload de página.
**Depends on**: Phase 5 (concluída — modais de Metas já têm `useModalClose` wiring)
**Requirements**: META-01, META-02, META-03, META-04
**Key files**: `assets/fides-metas.jsx`, `assets/fides-data.jsx` (camada de acesso a dados — **protegido**, mudanças coordenadas), schema `goals` (Supabase, verificar via MCP)
**Success Criteria** (what must be TRUE):

  1. Usuário preenche nome, valor-alvo e prazo em um formulário/modal de criação e, ao salvar, a meta aparece na lista imediatamente e persiste após reload da página (META-01, META-04)
  2. Usuário abre uma meta existente, altera nome e/ou valor-alvo e/ou prazo, salva, e a lista reflete os novos valores sem reload (META-02, META-04)
  3. Usuário aciona excluir em uma meta, confirma no modal `ConfirmDelete`, e a meta some da lista imediatamente e permanece ausente após reload (META-03, META-04)
  4. A view de Metas, ao carregar, exibe as metas reais do usuário autenticado vindas de `goals` (não dados mock/placeholder) — lista vazia mostra empty state, não erro (META-04)

**Notas de escopo:** NÃO inclui aportes, acompanhamento de progresso ou ajuste de plano (deferidos a M5+). A fonte do "valor atual" da meta (aportes manuais vs vínculo a conta/reserva) é uma decisão de modelo de dados em aberto — resolver em `/gsd-discuss-phase 07` antes de planejar. Este phase cobre apenas persistência de nome/valor-alvo/prazo e listagem live; os modais `Aportar`/`AjustarPlano` (como calculadora de plano) permanecem placeholder (não fazem parte do escopo v1.1).
**Plans**: 3/3 plans complete

Plans:
**Wave 1**

- [x] 06-01-PLAN.md — [BLOCKING] Migration via MCP: `target_date DATE` + `description text` (nullable) em `goals` + espelho (D-01/02/03/10)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 06-02-PLAN.md — Store: `addGoal`/`updateGoal`/`deleteGoal` (espelham trio de accounts) + `normalizeGoal` lê prazo/descrição + exposição no context/fallback (D-05/11/12)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 06-03-PLAN.md — UI: `CriarMetaModal` novo, `AjustarPlanoModal` para edição, wiring de Nova/Editar/Excluir aos modais reais + fix do `onAdd` mal-cabeado (D-06/13/14/15/16)

**UI hint**: yes

### Phase 9: Transações — power tools + analytics

**Goal:** Elevar a área de Transações a "power tools": filtro de Cartões dedicado, paginação com seletor de qtd (20/50/100), analytics de gasto por categoria cross-month (com range), export CSV e persistência de filtros — majoritariamente client-only (sem migração/gate de segurança). Respeita o modelo atual (`is_transfer` exclui de gasto).
**Requirements**: TX-01 (filtro Cartões), TX-02 (paginação 20/50/100), TX-03 (gasto/categoria cross-month), TX-04 (lista em modo range), TX-05 (export CSV + fix CSV-injection), TX-06 (persistência localStorage), TX-07 (⌘K, absorve UX-01/B7), TX-08 (preview de limite, absorve UX-02/B2)
**Depends on:** Phase 8
**Plans:** 5/5 plans complete

**Escopo previsto (decidido 2026-07-02):**

- Filtro "Cartões" separado (dado já distingue via `cardIdSet` em `fides-store.jsx:161`) — `fides-transacoes.jsx` `TxAdvFiltersModal`
- Paginação + seletor de qtd 20/50/100 (hoje `grouped.map` renderiza tudo) — perf + paridade PlannerFin
- Gasto por categoria **cross-month** com range (3m/6m/12m/ano/custom), honrando `is_transfer` — hoje `spendByCategory` trava em 1 mês (`fides-store.jsx:1068`)
- Ver range / múltiplos meses na lista (destrava o item acima)
- Export CSV; persistir filtro/sort/mês no reload (só import é rastreado hoje)
- Absorve ⌘K global (B7/UX-01) e preview de limite no modal Nova Transação (B2/UX-02)
- **Deferido:** WhatsApp WRITE (C4) atrás do B8; captura quick-add + parse-NL client-side vira fase própria se crescer (tensão fricção-intencional = valor-núcleo)

Plans:
**Wave 1** *(fundação — arquivos distintos, em paralelo)*

- [x] 09-01-PLAN.md — TX-03/TX-04 store: `monthsInRange` + `spendByCategoryRange` + `rangeTransactions` (derivações cross-month sobre `transactions`, sem alterar `spendByCategory`/`monthTransactions`)
- [x] 09-02-PLAN.md — TX-07: command palette ⌘K (novo `CommandPalette` + atalho Cmd/Ctrl+K global + liga o input morto do masthead)
- [x] 09-03-PLAN.md — TX-01/TX-02: filtro Cartões dedicado no `TxAdvFiltersModal` + paginação `pagedSorted` com seletor 20/50/100

**Wave 2** *(depende de 09-01 e 09-03)*

- [x] 09-04-PLAN.md — TX-03/TX-04: modo range na lista (`baseList` alternável) + widget de gasto por categoria cross-month (Donut/CategoryChart reaproveitados)

**Wave 3** *(depende de 09-04)*

- [x] 09-05-PLAN.md — TX-05/TX-06/TX-08: export CSV audit + fix CSV-injection; persistência `fides:tx.state`; preview de limite no Nova Transação

### Phase 10: Correção fatura cartão + hardening de importação

**Goal:** A fatura de cartão exibe fechamento/vencimento corretos para qualquer configuração de dias (incluindo `closing_day > due_day`, ex. Bradesco fecha 19 / vence 1), sem regressão para cartões `closing_day < due_day`; e a importação de CSV/OFX deixa de duplicar dados silenciosamente — passa a ter preview/seleção/confirmação + dedupe. Descoberto no UAT da Fase 09 (`09-FOLLOWUPS.md`).
**Requirements**: FAT-01 (fatura fechamento/vencimento corretos), IMP-01 (preview + seleção + confirmação no import), IMP-02 (dedupe + mês/fatura correto por linha + card_id resolvido), UX-03 (botão rápido "Cartão" no masthead), UX-04 (modo Período — barras por cor + valor/categoria no hover/tap)
**Depends on:** Phase 9
**Key files**: `assets/fides-store.jsx` (`faturasDoCartao` :1265-1293, `faturasDoCartaoCompleto` :1334-1365), `assets/fides-data.jsx` (`mesFaturaFor` :52-64), `assets/fides-transacoes.jsx` (`handleImport` :554, masthead filtros, widget Período) — **domínio de cartão sensível: rodar database/security review**
**Success Criteria** (what must be TRUE):

  1. **FAT-01:** Para o cartão Bradesco (fecha 19 / vence 1), a fatura com compras de 19/06→11/07 exibe "fecha 19/07 · vence 01/08 · aberta" (não "vence 01/07 · vencida"); a fatura de junho paga permanece paga. Convenção de "mês da fatura" unificada entre `mesFaturaFor` e `faturasDoCartao*`.
  2. **FAT-01 (regressão):** Um cartão com `closing_day < due_day` (fecha e vence no mesmo mês) continua com datas corretas — o fix não inverte esse caso.
  3. **IMP-01:** Importar CSV/OFX abre um modal de preview com as linhas detectadas, permite selecionar todas/individuais e exige confirmação antes de gravar — cancelar não grava nada.
  4. **IMP-02:** Reimportar um arquivo já importado não cria duplicatas (dedupe por `description`+`value`+`date` contra o existente); linhas usam o `mês`/fatura correto por data e resolvem `card_id` quando a conta é cartão.
  5. **UX-03/UX-04:** botão "Cartão" no masthead filtra crédito sem abrir Filtros avançados; no modo Período toda categoria da legenda tem barra e o valor por categoria aparece no hover/tap.

**Notas de escopo:** FAT-01 é P1 (bug de confiança — dado no banco está correto, só a exibição erra). IMP-01/02 é débito P2 (incidente real: 196 txs duplicadas revertidas manualmente via SQL no UAT). UX-03/04 é P3 (polish). Fonte completa da diagnose: `.planning/phases/09-transacoes-power-tools-analytics/09-FOLLOWUPS.md`. **Escopo travado em FASE ÚNICA por D-01 (CONTEXT.md)** — a nota de split (10a/10b/10c) está SUPERSEDED; a fase é organizada em ondas por prioridade (Onda 1 FAT-01 → Onda 2 import → Onda 3 UX).
**UI hint**: yes (masthead + widget Período)
**Plans**: 6/6 plans complete

Plans:
**Onda 1 · FAT-01 (P1)**

- [x] 10-01-PLAN.md — FAT-01: helper `computeFaturaDates` (fides-data.jsx) + `faturasDoCartao`/`faturasDoCartaoCompleto` consomem o helper (remove o mesF divergente) + regressão closing<due (D-02/03/04/05)

**Onda 2 · Import hardening (P2)** *(depende de 10-01 — prioridade)*

- [x] 10-02-PLAN.md — IMP-01/IMP-02: `dedupeKey`/`buildDedupeIndex`/`resolveRowForImport` + `handleImport` parse-then-preview + `ImportPreviewModal` (preview/seleção/confirmação, dedupe, mês por linha, card_id resolvido) (D-06..D-12)

**Onda 3 · UX (P3)** *(depende de 10-02 — mesmo arquivo)*

- [x] 10-03-PLAN.md — UX-03/UX-04: chip "Cartão" no masthead + Donut do modo Período com hover/tap (centro dinâmico) + legenda textual completa

**Gap closure · 10-UAT (6 gaps, 2 blockers)**

- [x] 10-04-PLAN.md — IMP-01/IMP-02 (G1/G2/G3 blockers): export grava nome do cartão + `resolveRowForImport` resolve destino/status POR LINHA a partir da origem do arquivo (reimport idêntico = 0 gravações, nunca converte pendente→paga) + `ImportPreviewModal` com opções de destino (origem/conta/cartão) e status (arquivo/pendente/paga) [wave 1]
- [x] 10-05-PLAN.md — IMP-01 (G6): guarda por user-id no `onAuthStateChange` (fides-store.jsx) — trocar aba/minimizar não reseta o modal de import nem recarrega a lista [wave 1]
- [x] 10-06-PLAN.md — UX-04 (G4/G5): analytics do modo Período escopado ao mês selecionado (spendByCategory, não o range) + remoção da legenda textual redundante (volta ao top-7) [wave 2, depende de 10-04]

</details>

---

## PARTE 4 — 🔜 Próximo milestone · Épico IA/WhatsApp (Phases 11–14) — PLANEJADO

> **Épico IA/WhatsApp (Phases 11–14).** Fonte de design completa: `.planning/research/whatsapp-e-ia-arquitetura.md` (Parte A = bot WhatsApp, Parte B = plano IA in-app, decisões D-1..D-11 resolvidas 2026-07-06, adendo D-8 = caminho sem CNPJ). Precificação decidida: P-2 (Free + Premium R$ 89,90/ano via Mercado Pago/Pix). Ordem travada: 11→12→13→14 (WRITE in-app validado antes do bot, que reusa parser/insert/confirmação). Caminhos sensíveis (`api/`, `supabase/`) → rodar `security-reviewer` + `database-reviewer` antes de commit.

### Phase 11: IA-1 Hardening do assistente Gemini

**Goal:** As duas superfícies de IA existentes (chat `fides-claude.jsx` + botão "Análise da IA" `fides-orcamento.jsx`) ficam sem as 3 dívidas do review da fase 05 e com base observável para os evals das fases seguintes — antes de qualquer nova capacidade. WR-01: "Análise da IA" ganha o mesmo throttle/cooldown do chat (não queima cota com duplo-tap). WR-02: chamada single-shot proíbe tools (`tool_config: NONE`) para nunca morrer com erro genérico em `tool_calls`. WR-03: JWT vai no header `Authorization: Bearer`, não no corpo. Extrai módulo Gemini compartilhado (payload/safety/erros) que `api/assistant.js` e o futuro `api/whatsapp.js` consomem. Telemetria: `assistant_usage` passa a gravar tokens in/out + latência.
**Requirements**: WR-01, WR-02, WR-03, AI-SHARED-01, AI-TELEM-01
**Depends on:** Phase 10
**Fonte:** `.planning/research/whatsapp-e-ia-arquitetura.md` §B1, §B3 (Fase IA-1)
**Caminho sensível:** `api/assistant.js` → security-reviewer (+ database-reviewer no plano de telemetria)
**Plans:** 4/4 plans complete

Plans:

**Onda 1 · AI-SHARED-01 (helper Gemini)**

- [x] 11-01-PLAN.md — AI-SHARED-01: extrai `api/_lib/gemini.js` (CommonJS não-roteável: buildPayload/callGemini/parseResponse com pontos de extensão toolMode + usageMetadata) e reconecta `api/assistant.js` — refactor puro, zero mudança de comportamento

**Onda 2 · WR-02 + WR-03 servidor** *(depende de 11-01 — mesmo arquivo)*

- [x] 11-02-PLAN.md — WR-03: servidor lê JWT de `Authorization: Bearer` (não do body) · WR-02: modo `analysis` proíbe tools (toolConfig NONE), chat mantém tools READ

**Onda 3 · Telemetria + frente cliente** *(ambos dependem de 11-02; arquivos disjuntos → paralelos)*

- [x] 11-03-PLAN.md — AI-TELEM-01: `assistant_usage` grava prompt_tokens/completion_tokens/latency_ms (insert→update fail-open) + espelho `.sql` + migração MCP (checkpoint humano)
- [x] 11-04-PLAN.md — WR-01: cooldown no botão "Análise da IA" (padrão do chat) · WR-03 cliente: os 2 callers migram o token p/ header · WR-02 cliente: mode `analysis` + remove branch morto

### Phase 12: IA-2 Destravar WRITE no assistente in-app (B8)

**Goal:** O gate B8 abre — o chat "Assistente Fides" volta a poder ESCREVER (lançar/recategorizar/editar transação + criar categoria) com confirmação, agora que a fundação que derrubou o WRITE na v7 está resolvida e verificada (FIX-1..4, RPCs atômicos, fase 10). O cliente já tem os 4 tools WRITE com card de confirmação (`fides-claude.jsx` — hoje código morto porque o servidor só declara READ); reativar = religar `TOOLS_DECLARATION` + system prompt de escrita com regra de honestidade, não construir do zero. Insert via RPC `wa_log_transaction` SECURITY DEFINER com guarda de dono (mesmo padrão de `pay_card_invoice`), respeitando o saldo derivado (nenhuma mutação incremental). Regra de honestidade: baixa confiança pede confirmação, nunca chuta valor/conta/categoria.
**Requirements**: WRITE-01..04 (lançar/recategorizar/editar/criar-categoria), HONEST-01, DERIVED-SAFE-01 (a formalizar). UAT = os 6 bugs da v7 (mês vazio, mês hard-coded, delete sem estorno, cartão inconsistente, toast falso de criar_categoria, ⌘K) viram casos de regressão.
**Depends on:** Phase 11
**Fonte:** `.planning/research/whatsapp-e-ia-arquitetura.md` §6, §7, §B3 (Fase IA-2). Gate B8 em `v1.0-ROADMAP.md:258`.
**Caminho sensível:** `api/assistant.js` + RPC Supabase → security-reviewer + database-reviewer
**Plans:** 7/7 plans complete

Plans:
**Wave 1**

- [x] 12-01-PLAN.md — WRITE-01/DERIVED-SAFE-01: RPC `wa_log_transaction` (SECURITY DEFINER + owner-guard, espelha pay_card_invoice) aplicada no Supabase LIVE via MCP + database-reviewer (Onda 1)
- [x] 12-02-PLAN.md — WRITE-01..04/HONEST-01: servidor religa `TOOLS_DECLARATION` (4 WRITE) + system prompt de honestidade + nonce anti-replay `api/_lib/nonce.js` (D-06, TTL 120s) + security-reviewer (Onda 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 12-03-PLAN.md — WRITE-01/WRITE-04/DERIVED-SAFE-01: cliente reescreve `lancar_transacao` p/ a RPC + fix P2 (mês real, não selectedMonth) + status pendente em cartão + D-04 categoria bundlada (Onda 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 12-04-PLAN.md — WRITE-04/HONEST-01: `criar_categoria` passa a exigir confirmação (SD-1) + mata toast falso (P5, await) + threading do nonce (cliente) + flag de confirmação pendente (Onda 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 12-05-PLAN.md — HONEST-01: guard de ⌘K não sobrepõe o card de confirmação WRITE pendente (P6) (Onda 4)

**Gap closure · 12-UAT (2 gaps: 1 blocker, 1 major)**

- [x] 12-06-PLAN.md — WRITE-01/HONEST-01 (Test 4, BLOCKER): mata o falso "Ok, cancelei então" — desfechos WRITE sintéticos deixam de ser texto espelhável no history (tag `writeOutcome` + filtro), guard anti-espelho no reply, bump da storage key p/ desbloqueio, remoção do addendum de cancelamento (5e161e9) + security-reviewer [wave 4]
- [x] 12-07-PLAN.md — WRITE-01/HONEST-01 (Test 1, major): "cartão" homônimo resolve p/ cartão, não conta — `tipo_destino` (enum conta|cartao) na tool + prompt + security-reviewer; `resolveWriteToolArgs` honra o tipo (cartão → findCardByName exclusivo) e desambigua homônimo em vez de escolher conta-primeiro [wave 5, depende de 12-06]

### Phase 13: IA-3 Gating premium in-app

**Goal:** O app passa a gatear capacidades por tier real. Hoje o front usa mock `plan:'Pro'` (`fides-data.jsx:31`) e o store live nem lê a coluna — `profiles.plan` (`free|pro|family`, já existe no schema) vira fonte da verdade. Premium = `plan <> 'free'` (usar `pro`, zero migração — D-4). Free: degustação de IA (~10 msg/mês de chat READ, sem WRITE — D-5) como funil de conversão. Premium: chat completo + WRITE + Análise da IA ilimitada dentro dos caps. Paywall suave + tela de upgrade que aponta para o checkout do M6.
**Requirements**: GATE-01 (store lê plan real), GATE-02 (free degustação limitada), GATE-03 (premium libera WRITE/IA), PAYWALL-01 (a formalizar)
**Depends on:** Phase 12
**Fonte:** `.planning/research/whatsapp-e-ia-arquitetura.md` §B3 (Fase IA-3), §B4 (precificação P-2)
**Plans:** 5 plans (waves 1→2 + gap closure)

Plans:

**Wave 1** *(arquivos disjuntos — em paralelo)*

- [x] 13-01-PLAN.md — GATE-01: store lê `plan` de `profiles` + expõe `userPlan`/`isPremium` (allow-list fail-closed) no `useFides()`
- [x] 13-02-PLAN.md — [BLOCKING] P1 (integridade de GATE-03): REVOKE/GRANT column-level em `profiles.plan` (autonomous:false — apply manual no SQL Editor). Sem isso o tier é auto-outorgável via client SDK
- [x] 13-03-PLAN.md — GATE-02/GATE-03: gate server-side em `api/assistant.js` (lê plan fail-closed; Análise premium-only 403; split READ/WRITE tools por tier via `buildToolsForPlan`; cap 10/mês free sobre `assistant_usage`; `FREE_TIER_ADDENDUM`)

**Wave 2** *(depende de 13-01 + 13-03)*

- [x] 13-04-PLAN.md — GATE-03/PAYWALL-01: paywall suave (copy `FREE_MONTHLY_LIMIT`/`PREMIUM_REQUIRED` nos 2 mapas de erro) + gate do botão Análise da IA + `PerfilView` badge/CTA + `UpgradeModal` (checkout M6 em breve)

**Gap closure** *(fecha VERIFICATION truth #9 / CR-01 — defesa em profundidade)*

- [x] 13-05-PLAN.md — GATE-03 (gap): revalida server-side o nome de todo `tool_call` retornado contra o tier (`WRITE_NAMES` de `WRITE_FUNCTIONS` → 403 `PREMIUM_REQUIRED` sem relay, CR-01) + guarda cliente `!fs.isPremium` em `executeTools` + reescrita comportamental de `FREE_TIER_ADDENDUM` (WR-04)

### Phase 14: IA-4 Bot WhatsApp via Meta Cloud API

**Goal:** Usuário premium registra transações e consulta saldo/mini-extrato pelo WhatsApp. `api/whatsapp.js` (Vercel Function CommonJS): webhook Meta Cloud API com verificação de assinatura HMAC (`X-Hub-Signature-256`), idempotência por `wamid`, opt-in por código de posse (link `wa.me`), gating premium antes de qualquer LLM, parser NL→JSON (Gemini, saída estruturada — NÃO function calling — com guarda determinística de valor), confirmação sempre antes do insert (D-1), insert pelo MESMO RPC/regras da fase 12. Migrações: `phone` + `wa_linked_at` em `profiles`, tabelas `wa_link_codes`/`wa_messages`/`wa_pending` (todas via ALTER standalone + MCP). Provedor: Meta direta. **Sem CNPJ não bloqueia** (adendo D-8): WABA não-verificada responde mensagens de usuário ilimitado/grátis; dev/UAT com test number (você + 4 beta testers). LGPD: consentimento explícito no opt-in, minimização (só a mensagem + listas ao LLM, nunca extrato/saldo), retenção 90 dias do texto bruto, opt-out "PARAR".
**Requirements**: WA-WEBHOOK-01 (assinatura+idempotência), WA-OPTIN-01, WA-GATE-01, WA-PARSE-01, WA-CONFIRM-01, WA-INSERT-01, WA-LGPD-01 (a formalizar)
**Depends on:** Phase 13
**Fonte:** `.planning/research/whatsapp-e-ia-arquitetura.md` Parte A inteira (§1–§10) + adendo D-8
**Caminho sensível:** `api/whatsapp.js` + migrações + RPC → security-reviewer + database-reviewer (obrigatório — webhook público + service role)
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 14 to break down)

---

### Progress Table — Próximo milestone (IA/WhatsApp)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 11 - IA-1 Hardening Gemini | 4/4 | Complete    | 2026-07-07 |
| 12 - IA-2 WRITE in-app (B8) | 7/7 | Complete    | 2026-07-14 |
| 13 - IA-3 Gating premium | 5/5 | Complete   | 2026-07-16 |
| 14 - IA-4 Bot WhatsApp | 0/? | Not started | - |
| 15 - UI Polish (Favicon) | 0/? | Not started | - |

### Phase 15: UI Polish (Favicon)

**Goal:** Adicionar o ícone do Fides como favicon do site (atualmente está sem favicon).
**Plans:** 0 plans

- [ ] TBD (run /gsd-plan-phase 15 to break down)

> Milestone v1.1 (Phases 07-10) shipped 2026-07-06 — detalhe em `milestones/v1.1-ROADMAP.md`.

<details>
<summary>v1.1 Phase 08 (vision-board) — detalhe arquivado, clique para expandir</summary>

### Phase 7: Metas vision-board redesign

**Goal:** A área de Metas vira um "vision board": cards com capa (galeria de ~16 presets SVG bespoke OU upload próprio), busca por nome/descrição, filtro por status (Ativa/Concluída via `completed`) e update inline (Aportar com projeção + Atualizar saldo direto) — tudo persistido em `goals.image_url` + bucket Storage `goal-covers` com RLS owner-only — mantendo a identidade editorial Fides (hero próprio `met-hero`, capítulos I/II/III, sistema de tint por meta). Fecha 2 gaps herdados da Phase 07: `normalizeGoal` passa a mapear `completed`/`image_url`, e o `AportarModal` (dead code) é montado.
**Requirements**: UAT-1…UAT-7 (design spec §8 — sem REQ-IDs formais; PRD Express Path)
**Depends on:** Phase 6
**Plans:** 8 plans (waves 1→4 + gap-closure pós-UAT)

Plans:
**Wave 1** *(fundação — arquivos distintos, em paralelo)*

- [~] 07-01-PLAN.md (disco: 08-01) — [BLOCKING] Backend: SQL escrito+commitado (040dc31, hardened pós security-review); **apply ao banco LIVE PENDENTE** (Task 2 = checkpoint humano, Supabase MCP sem auth) (UAT-1/2/5)
- [x] 07-02-PLAN.md (disco: 08-02) — 16 capas preset SVG bespoke em `assets/covers/*.svg` (paleta tint, zero-tooling) — commit 107d30a (UAT-1)
- [x] 07-03-PLAN.md (disco: 08-03) — Store: `normalizeGoal` mapeia cover/completed/completedAt (gap Phase-07 #1) + `addGoal` cover/current + helpers `uploadGoalCover`/`deleteGoalCover` — 6318f22/f875532 (UAT-1..5)

**Wave 2** *(depende de 07-03)*

- [x] 07-04-PLAN.md (disco: 08-04) — Barra de controles (busca + filtro segmentado Todas/Ativas/Concluídas + Nova meta) + Capítulo III "Já atingidas" populado por `completed` — 09ade51/f460682 (UAT-3/7)

**Wave 3** *(depende de 07-04, 07-02)*

- [x] 07-05-PLAN.md (disco: 08-05) — Hero próprio `met-hero` (D3) + redesign `vcard` (capa/scrim/overlay/corpo) + `resolveCoverUrl` + montar `AportarModal` (gap Phase-07 #2) + Atualizar saldo inline + Marcar como concluída — 432e278/e18482f/b0fc048/b652475 (UAT-4/6/7)

**Wave 4** *(depende de 07-05, 07-03, 07-01, 07-02)*

- [x] 07-06-PLAN.md (disco: 08-06) — Seletor de capa (Galeria/Enviar foto) nos modais + campos Valor atual/Status + limpeza de Storage no editar/excluir — 0264389/6b7612a (código pronto; persistência real depende do apply de 08-01) (UAT-1/2/5)

**Gap closure (pós-08-UAT — 4 de 6 gaps; 2 needs_research deferidos)**

- [x] 08-07-PLAN.md — **wave 1** · UI polish (presentation-only): guardar Infinity→"sem prazo" em todas exibições de meses (GAP-INFINITY); remover CTA "Nova meta" duplicado/vazado (GAP-DUP-NOVA); EmojiPicker grid curado hand-rolled (sem npm) nos modais Criar/Ajustar (GAP-EMOJI)
- [x] 08-08-PLAN.md — **wave 2** (depends_on 08-07 por sobreposição de fides-metas.jsx) · [BLOCKER] conclusão de meta diagnose-first: instrumentar runtime (chrome-devtools + Supabase MCP) → (condicional) migração/policy LIVE blocking-human → conclusão manual end-to-end + auto-conclusão a >=alvo, sem auto-reabertura (GAP-CONCLUSAO)
- Deferidos p/ passada research-gated: capas fotos reais CC0; metas-exemplo pré-criadas (ambos needs_research)

</details>
