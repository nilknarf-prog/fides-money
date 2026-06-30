# PROJECT — Fides Money

> Estado inicial do `.planning/` (gsd) gerado em 28/06/2026 a partir dos relatórios v2–v18.
> Fonte de verdade operacional: este diretório. Fonte de verdade histórica: `docs/Fides_Money_Relatorio_Geral_de_Progresso.md`.

---

## 1. Identidade

| Campo | Valor |
|---|---|
| Nome | **Fides Money** |
| Categoria | App de finanças pessoais · PT-BR |
| Estágio | Produção · fase *friends-and-family* |
| Produção | https://fides-money.vercel.app |
| Demo (sem login) | https://fides-money.vercel.app/teste |
| Repo | github.com/nilknarf-prog/fides-money |
| Supabase project_id | `nhwarucfecoqcahcosga` |
| Usuário real | Deyglison Franklin de Souza |
| Último commit `main` | `714872e` (merge: preview transferência + aviso saldo negativo + grupos minimizáveis) |

> ⚠️ Os relatórios v2–v18 citam `dfd640e` como HEAD. O working tree local já está em `714872e`. Tratar `714872e` como base real.

---

## 2. Visão

Finanças pessoais por **registro manual** (fricção intencional → consciência), planejamento **50·30·20**, metas e assistente de IA só-leitura sobre os dados do próprio usuário. Diferencial declarado: experiência mobile-first iOS + **honestidade de dados** (nunca número que impressiona mas engana).

**Princípio dos Insights (travado v18):** o Fides só mostra número que reflete a realidade financeira.

---

## 3. Stack (imutável — não reabrir sem decisão explícita)

| Camada | Tecnologia |
|---|---|
| Runtime | React 18 via Babel standalone (SPA single-file, **sem bundler/npm no front**) |
| CSS | Puro, por componente (`fides-X.css`) + tokens em `tokens.css` |
| Backend | Supabase (Postgres + Auth + RLS) |
| IA | Google Gemini 2.5 Flash-Lite via `api/assistant.js` (só-leitura, sob demanda) |
| Serverless | Vercel Functions (`api/*.js` = CommonJS, **nunca ESM**) |
| Deploy | push em `main` → Vercel (~2 min) |

**Regra de ouro:** feature só está pronta se funciona em **400×512px iOS Safari**.

---

## 4. Constraints / invariantes de arquitetura

- Dashboard live = `DashboardStudio` em `fides-studio.jsx` (NÃO `fides-dashboard.jsx`, que é fallback do `/teste`).
- `tokens.css` = primeiro CSS no `index.html`, sempre.
- Saldo derivado: `balance = opening_balance + SUM(value WHERE status='cleared')` via RPC `recalc_account_balance`. **Pendente nunca afeta saldo.**
- `tx.acct` = id de conta OU cartão (mesma chave) — distinção via `cardIdSet`.
- `is_transfer=true` exclui de agregações de gasto (mas afeta saldo).
- `mesFaturaFor` determina o mês de toda transação de cartão (convenção de **fechamento**, não vencimento).
- Mudanças de schema: MCP `apply_migration` + espelho em `supabase/*.sql`. **Nunca assumir schema — verificar via MCP.**
- Projeção ingênua proibida na UI.

### Arquivos protegidos (não tocar sem aprovação explícita)
```
fides-data.jsx   fides-charts.jsx   tokens.css
design-canvas.jsx   tweaks-panel.jsx   Fides-app.html
```

---

## 5. Workflow de execução (4 fases — herdado do projeto)

1. **Audit** (read-only, output bruto)
2. **Edit** (`str_replace` com strings exatas conferidas no blob)
3. **Verify** (`git diff` / `git show --stat HEAD` bruto + verificação independente de blob)
4. **Push** (só após o gesto consciente de colar o prompt de commit; merge `--no-ff`)

**REGRA INVIOLÁVEL Nº1** (linha 1 de todo prompt de Code): NÃO commitar nem pushar até receber o prompt de commit.

**Execução de código:** feita pelo Deyglison via Gemini 3.1 Pro (High) ou Sonnet 4.6 — este `.planning/` só **planeja**, não codifica o app.

---

## 6. Marcos (milestones)

| Milestone | Status |
|---|---|
| **M1 — Fundação** (infra Supabase, auth, store live/mock, saldo derivado) | ✅ Concluído (v2–v16) |
| **M2 — Núcleo de produto** (Transações, Planejamento+Insights, Contas, fatura selecionável) | ✅ Concluído (v6–v18) |
| **M3 — Polish pré-lançamento** (dead code, design polish, perfil mobile, motion, IA real) | 🔄 **Milestone ativo (v1.0 GSD)** |
| **M4 — Ciclo de fatura confiável** (faturas por mês, seletor, avisos, sincronia com fatura real) | ✅ Concluído (`ade84f7`) |
| **M5 — Expansão** (CRUD Metas, Dívidas/Família, import CSV/OFX, busca ⌘K, WRITE assistente, WhatsApp) | ⏳ Backlog |
| **M6 — Comercial** (landing, FAQ, pricing, monetização) | ⏳ Roadmap longo |

> Detalhe de cada fase em `ROADMAP.md`. Fase ativa detalhada em `phases/fatura-ciclo/`.

---

## Current Milestone: v1.0 Polish pré-lançamento

**Goal:** Finalizar a camada de qualidade visual e técnica do Fides Money antes de ampliar a base F&F — removendo débitos de código morto, alinhando identidade visual, habilitando acesso mobile ao perfil, adicionando micro-interações e conectando a IA real.

**Target features:**
- P1: Remover `fides-diario.*` (dead code jsx+css+`<link>`)
- P2: Design polish — roxo off-brand, `--warn` divergente, auditoria CSS
- P3: Acesso ao Perfil no mobile (engrenagem clicável)
- P4: Micro-interações CSS (`emilkowalski-motion`) em modais/cards
- P5: Gemini real no botão "Análise da IA" (hoje stub 2,2s)

---

## Evolution

Este documento evolui nas transições de fase e marcos de milestone.

**Após cada transição de fase** (via `/gsd-transition`):
1. Requisitos invalidados? → Mover para Out of Scope com razão
2. Requisitos validados? → Mover para Validated com referência de fase
3. Novos requisitos surgiram? → Adicionar em Active
4. Decisões a registrar? → Adicionar em Key Decisions
5. "What This Is" ainda preciso? → Atualizar se drifted

**Após cada milestone** (via `/gsd-complete-milestone`):
1. Revisão completa de todas as seções
2. Core Value check — ainda a prioridade certa?
3. Auditoria Out of Scope — razões ainda válidas?
4. Atualizar Context com estado atual

*Última atualização: 2026-06-29 — Milestone v1.0 iniciado*
