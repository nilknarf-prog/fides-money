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

- [x] 01-01-PLAN.md — R1: `budgetGroups` lê `categoryLimits` + estado "sem limite" no card
- [x] 01-02-PLAN.md — R2: tooltip de fatia no `Donut` (centro reusado) + dismiss mobile
- [x] 01-03-PLAN.md — R3: `saldoProjetado` no hero + fluxo negativo visível (P1)

**Tema:** o `DashboardStudio` exibe números que não refletem a verdade financeira do usuário. 3 correções:

| # | Sintoma | Hipótese de causa (a confirmar no SPEC/plan) |
|---|---|---|
| 1 | Card "Para onde foi" mostra limite **R$0 / 0%** nas macro-categorias (Essencial / Estilo de vida / Dívidas) apesar de `category_limits` definidos no Planejamento | Card não faz join com `category_limits` ou lê escopo errado; agregação 50-30-20 não soma limites das categorias-filhas por macro |
| 2 | Gráfico donut: **tooltip da fatia não aparece** (hover desktop nem tap mobile) — fatia vermelha dominante sem identificação | Sem handler hover/tap no SVG; falta `<title>`/tooltip por fatia; mobile precisa tap-to-identify |
| 3 | Aviso **"fechará Junho com −R$655 no vermelho"** assusta sem motivo | Projeção = receitas − despesas do mês, **ignora saldo atual** positivo (correntes + Reserva 99Pay ~R$7.346). **Decisão de produto pendente** → resolver no SPEC: saldo projetado = saldo atual + receitas previstas − despesas previstas? mostrar ambos? mudar cópia? |

**Escopo:** investigação + fix dos 3. Issue #3 exige decisão de produto antes de planejar → começar por `/gsd-spec-phase 1`. Se grande demais, dividir em sub-fases (#1+#2 fix direto; #3 estratégia de projeção).

---

## PARTE 3.6 — Fase 02 · Fixes de Experiência — ✅ (commit `3549395`, verificado)

> Detalhe completo em `phases/02-fixes-experiencia/02-01-PLAN.md`.

**Entregue:**

- [x] Sort por Data com desempate `createdAt` DESC — transação mais nova do dia aparece em cima
- [x] `onAuthStateChange` não re-fetch em `TOKEN_REFRESHED` — sem piscar ao voltar de aba

---

## PARTE 3.7 — ✅ M3 v1.0 Polish pré-lançamento — SHIPPED 2026-07-01 (tag `v1.0`)

- [x] **Phase 03: Limpeza + Tokens** (2/2) — Dead code removido e identidade visual alinhada aos tokens de marca (2026-06-30)
- [x] **Phase 04: UX Mobile + Motion** (4/4) — Perfil acessível no mobile e micro-interações CSS em modais/cards (2026-07-01)
- [x] **Phase 05: IA Real** (1/1) — Botão "Análise da IA" conectado ao Gemini real (2026-07-01)
- [x] **Phase 06: Fix v1.0 tech debt** (2/2, INSERTED) — Fecha as 4 warnings da auditoria v1.0 (2026-07-01)

> Detalhe completo arquivado em `milestones/v1.0-ROADMAP.md`.

<details>
<summary>Phase Details (Phases 03-06) — clique para expandir</summary>

---

### Phase 03: Limpeza + Tokens

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

- [x] 03-01-PLAN.md — CLEAN-01 (verificação) + DESIGN-01/02/03: avatares roxo→verde de marca, perfil on-brand, token `--warn` consistente

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — DESIGN-04: auditoria conservadora dos 3 CSS (duplicatas, órfãos, tokens fantasma)

**Achados do planejamento**: `fides-diario.*` já removido no commit `d4db34f` (CLEAN-01 vira verificação de estado). `.prf-view`/`.prf-avatar` já usam `var(--accent)` (DESIGN-02 conforme; apenas audita). Roxo real (`#6366F1→#8B5CF6`) vive em DOIS avatares: `.fds-avatar` (fides.css) e `.fds-sb-slim-avatar` (fides-studio.css). Única divergência de `--warn`: `#D97706` no bloco legado `.fds-app[data-variant="v3"]`.
**UI hint**: yes

---

### Phase 04: UX Mobile + Motion

**Goal**: O usuário acessa o perfil pelo mobile via engrenagem e percebe transições suaves ao abrir/fechar modais e interagir com cards — tudo via CSS, sem JS adicional.
**Depends on**: Phase 03
**Requirements**: MOBILE-01, MOTION-01, MOTION-02
**Key files**: `fides-studio.jsx`, `fides-studio.css`, CSS de modais (fides.css / fides-studio.css), CSS de cards
**Success Criteria** (what must be TRUE):

  1. Em viewport 400×512px (iOS Safari), tocar o ícone de engrenagem abre a `PerfilView` — o ícone é visível e clicável sem zoom ou scroll horizontal
  2. Ao abrir qualquer modal, o conteúdo entra com animação de fade/slide suave; ao fechar, sai com transição de saída visível (não corte abrupto)
  3. Ao tocar/hover em um card de categoria ou conta, há micro-feedback visual (ex.: escala, brilho, sombra) implementado puramente em CSS
  4. As animações não causam jank em iPhone SE (400px) — nenhum `transform` ou `opacity` transition acima de 300ms sem `will-change` ou GPU hint

**Plans**: 4/4 plans complete

**Wave 1**

- [x] 04-01-PLAN.md — MOTION-01/PERF: hook `useModalClose` (fides-ui.jsx) + keyframes de saída + gate reduced-motion (fides.css)
- [x] 04-03-PLAN.md — MOBILE-01: engrenagem clicável no masthead (≤768px) + foot gear desktop + estado `lastView`/toggle

**Wave 2** *(blocked on Wave 1)*

- [x] 04-02-PLAN.md — MOTION-01: wiring dos 3 modais (NovaTransacao/Categoria/contas) ao `useModalClose` (saída animada, re-open limpo)
- [x] 04-04-PLAN.md — MOTION-02/PERF: micro-feedback CSS em `.stu-acct` e `.cat-card` (`:hover` isolado em `@media (hover:hover)` + `:active` scale)

**UI hint**: yes

---

### Phase 05: IA Real

**Goal**: O botão "Análise da IA" chama o Gemini 2.5 Flash-Lite real e exibe a resposta na UI com loading state, sem travar o thread principal.
**Depends on**: Phase 03
**Requirements**: AI-01, AI-02
**Key files**: `fides-orcamento.jsx`, `api/assistant.js`
**Success Criteria** (what must be TRUE):

  1. Ao clicar "Análise da IA", a UI exibe imediatamente um indicador de loading (spinner ou skeleton) — o botão não fica silencioso
  2. Após resposta do Gemini (tipicamente 2–8s), o texto da análise aparece na área designada da UI sem recarregar a página
  3. Se a chamada falhar (rede, erro 5xx), a UI exibe mensagem de erro amigável — não trava nem fica em loading infinito
  4. O arquivo `api/assistant.js` usa `commonjs` (`require`/`module.exports`) — nenhum `import`/`export` ESM introduzido

**Plans**: 1/1 plans complete

- [x] 05-01-PLAN.md — AI-01/AI-02: substitui stub 2,2s por fetch real ao `/api/assistant`; 3 superfícies (loading spinner com gate reduced-motion, painel `.pln-mi-ai-result`, erro `.pln-mi-ai-error`); garantia never-hang + checkpoint humano

**UI hint**: yes

---

### Phase 06: Fix v1.0 tech debt

**Goal**: A base v1.0 fica sem as 4 warnings da auditoria do milestone — bloco de contexto de IA morto removido, os 8 modais de metas com motion consistente, token `--warn-soft` alinhado e o `setModalOpen(false)` duplicado eliminado.
**Depends on**: Phase 05
**Requirements**: DEBT-01, DEBT-02, DEBT-03, DEBT-04
**Key files**: `assets/fides-orcamento.jsx`, `assets/fides-metas.jsx`, `assets/fides.css`, `assets/fides-transacoes.jsx`, `assets/fides-studio.jsx`, `assets/fides-ui.jsx`
**Success Criteria** (what must be TRUE):

  1. **DEBT-01 (WARN-1):** O bloco morto em `buildAiContext()` (fides-orcamento.jsx ~1019-1029) que lê `totals.receitas/despesas` não existe mais — a IA continua recebendo status do planejamento + tendência (verificável por grep)
  2. **DEBT-02 (WARN-3):** Os 8 modais `fds-modal-backdrop` de `fides-metas.jsx` abrem/fecham com a mesma animação de saída dos demais (via `useModalClose` + `is-closing`), sem corte abrupto
  3. **DEBT-03 (WARN-4):** O token `--warn-soft` = `#FEF0D6` em todos os CSS que o definem (fides.css alinhado a tokens.css/fides-studio.css; verificável por grep)
  4. **DEBT-04 (WARN-2):** O caminho salvar-e-fechar dispara `setModalOpen(false)` uma única vez (fides-transacoes.jsx / fides-studio.jsx) — sem double-write

**Plans**: 2/2 plans complete

Plans:

- [x] 06-01-PLAN.md — DEBT-01/03/04: remove bloco morto de `buildAiContext()`, alinha `--warn-soft`→`#FEF0D6` em fides.css, elimina `setModalOpen(false)` duplicado
- [x] 06-02-PLAN.md — DEBT-02: liga os 8 modais `fds-modal-backdrop` de fides-metas.jsx ao `useModalClose` (saída animada via `is-closing`, mesmo padrão da fase 04)

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

## PARTE 3.8 — 🔄 M3.1 v1.1 CRUD Metas — EM PLANEJAMENTO

**Goal do milestone:** tornar a view de Metas funcional — usuário cria, edita e exclui metas (nome, valor-alvo, prazo) persistidas na tabela `goals`, saindo do estado read-only atual. Fonte do valor atual da meta é decisão explicitamente deferida — não faz parte deste milestone.

### Phases

- [x] **Phase 07: CRUD Metas** - Usuário cria, edita, exclui e lista metas reais persistidas em `goals`, sem placeholders (completed 2026-07-01)

### Phase Details

### Phase 07: CRUD Metas

**Goal**: A view de Metas deixa de ser read-only — usuário cria, edita e exclui metas (nome, valor-alvo, prazo) com persistência real na tabela `goals`, e a lista reflete o estado atual do banco sem reload de página.
**Depends on**: Phase 06 (concluída — modais de Metas já têm `useModalClose` wiring)
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

- [x] 07-01-PLAN.md — [BLOCKING] Migration via MCP: `target_date DATE` + `description text` (nullable) em `goals` + espelho (D-01/02/03/10)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 07-02-PLAN.md — Store: `addGoal`/`updateGoal`/`deleteGoal` (espelham trio de accounts) + `normalizeGoal` lê prazo/descrição + exposição no context/fallback (D-05/11/12)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 07-03-PLAN.md — UI: `CriarMetaModal` novo, `AjustarPlanoModal` para edição, wiring de Nova/Editar/Excluir aos modais reais + fix do `onAdd` mal-cabeado (D-06/13/14/15/16)

**UI hint**: yes

---

### Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 07 - CRUD Metas | 3/3 | Complete   | 2026-07-01 |

---

## PARTE 4 — BACKLOG (⏳ M5 · Expansão)

| # | Item | Estimativa | Dependência |
|---|---|---|---|
| B1 | CSV/OFX/PDF import (avaliar `fdt-bulk-*` antes) | 1+ sessão | — |
| B2 | Lote 5B — preview de limite no modal de Nova Transação | ½ sessão | — |
| B3 | ~~CRUD Metas~~ (movido para milestone v1.1, Phase 07) | 1 sessão | — |
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
| `fides-diario.*` dead code | v15 | Baixo — peso morto | Phase 03 |
| `supabase/schema.sql` desatualizado (MCP é a verdade) | v9 | Médio — drift | B10 |
| Roxo off-brand hardcoded | v15 | Baixo — identidade | Phase 03 |
