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
| **M3 — Polish pré-lançamento** (dead code, design polish, perfil mobile, motion, IA real) | ✅ **Concluído (v1.0 GSD · shipped 2026-07-01, tag `v1.0`)** |
| **M4 — Ciclo de fatura confiável** (faturas por mês, seletor, avisos, sincronia com fatura real) | ✅ Concluído (`ade84f7`) |
| **v1.1 — Metas + Transações** (CRUD/vision-board Metas, power tools Transações, fatura+import) | ✅ **Concluído (shipped 2026-07-06, tag `v1.1`)** |
| **M5 — Expansão** (épico IA/WhatsApp: hardening Gemini, WRITE in-app, gating premium, bot WhatsApp — Phases 11–14) | 🟡 Próximo |
| **M6 — Comercial** (landing, FAQ, pricing, monetização) | ⏳ Roadmap longo |

> Detalhe de cada fase em `ROADMAP.md`. Fase ativa detalhada em `phases/fatura-ciclo/`.

---

## Current State — v1.0 shipped (2026-07-01)

**Último milestone:** v1.0 Polish pré-lançamento (M3) — 4 fases, 9 plans, 21 tasks, 14/14 requisitos. Tag `v1.0`.

Entregue:
- ✅ Dead code `fides-diario.*` removido (CLEAN-01)
- ✅ Identidade visual alinhada a tokens de marca — avatares/perfil sem roxo hardcoded, `--warn`/`--warn-soft` consistentes (DESIGN-01/02/03/04)
- ✅ Perfil acessível no mobile via engrenagem clicável em 400×512px (MOBILE-01)
- ✅ Micro-interações CSS em modais e cards, incluindo os 8 modais de Metas (MOTION-01/02, DEBT-02)
- ✅ Botão "Análise da IA" conectado ao Gemini 2.5 Flash-Lite real com loading/erro (AI-01/02)
- ✅ 4 warnings da auditoria v1.0 fechadas na Phase 06 (DEBT-01/02/03/04)

**Item deferido:** UAT humano de `fatura-ciclo` (M4, já shipado `ade84f7`) — rodar no app pós-deploy.

### Key Decisions (v1.0)

| Decisão | Racional | Outcome |
|---|---|---|
| Análise IA single-shot, sem executar tool_calls READ | Falha-fecha com erro amigável em vez de travar; tools ficam para depois | ✓ Good |
| `useModalClose` como hook único de saída animada | Padrão reusado em todos os modais (fase 04 → metas na 06) | ✓ Good |
| `--warn-soft` convergido para `#FEF0D6` (tokens.css) | Fim da divergência de cascade frágil | ✓ Good |
| Fechamento de modal por via única (`requestClose→onClose`) | Elimina double `setModalOpen(false)` | ✓ Good |
| Auditoria CSS conservadora (não remover órfãos dinâmicos) | Evita regressão visual em regras interleaved vivas | — Pending (reavaliar se CSS crescer) |

---

## Current State — v1.1 shipped (2026-07-06)

**Último milestone:** v1.1 Metas + Transações — 4 fases (07-10), 22 plans, tag `v1.1`. UAT final 8/8 pass.

Entregue:
- ✅ Metas CRUD real em `goals` (criar/editar/excluir/listar) + colunas `target_date`/`description` (META-01..04)
- ✅ Metas vision-board — 16 capas SVG + upload (bucket `goal-covers` RLS owner-only), busca/filtro, hero editorial, aportar/concluir inline com auto-conclusão a >=alvo (UAT-1..7)
- ✅ Transações power tools — filtro Cartões, paginação 20/50/100, gasto cross-month, export CSV + fix CSV-injection, persistência de filtros, ⌘K (TX-01..08)
- ✅ Fatura corrigida p/ qualquer config de dias (`closing_day > due_day`) + import com preview/dedupe/confirmação (FAT-01, IMP-01/02, UX-03/04)

**Deferido:** fonte do valor atual da meta (aportes vs vínculo a conta) → M5+; épico IA/WhatsApp (Phases 11–14) → próximo milestone.

### Key Decisions (v1.1)

| Decisão | Racional | Outcome |
|---|---|---|
| Escopo v1.1 expandiu de CRUD Metas → Metas+Transações+fatura/import | Reativo ao UAT da Fase 09 (incidente de import); valor entregue > plano original | ✓ Good |
| `computeFaturaDates` em `fides-data.jsx` + remoção total do branch `diaF>diaV` | Causa raiz do bug de fatura, não caso especial; ordem de load como global | ✓ Good |
| Auto-conclusão de meta a >=alvo nunca reabre (`completed:false` proibido) | Semântica previsível; queda posterior de saldo não desfaz conquista | ✓ Good |
| Import: destino default = sentinel "Da origem do arquivo", status sempre explícito | Reimport idêntico = 0 gravações; nunca converte pendente→paga | ✓ Good |
| 08-08 no-op live + harden SQL (nenhum write LIVE de schema) | Colunas já live via MCP; evita mutação redundante, espelha `schema.sql` | ✓ Good |

---

## Next Milestone: Épico IA/WhatsApp (Phases 11–14)

**Goal:** Endurecer o assistente Gemini (WR-01/02/03 + módulo compartilhado + telemetria), destravar WRITE in-app (gate B8), gatear premium por `profiles.plan` e ligar o bot WhatsApp via Meta Cloud API.

**Ordem travada:** 11 → 12 → 13 → 14. Precificação P-2 (Free + Premium R$ 89,90/ano via Mercado Pago/Pix).

**Fonte de design:** `.planning/research/whatsapp-e-ia-arquitetura.md` (decisões D-1..D-11 travadas 2026-07-06, adendo D-8 = caminho sem CNPJ). Caminhos sensíveis (`api/`, `supabase/`) → `security-reviewer` + `database-reviewer` antes de commit.

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

*Última atualização: 2026-07-06 — Milestone v1.1 "Metas + Transações" shipped (tag v1.1); próximo: épico IA/WhatsApp (Phases 11–14)*
