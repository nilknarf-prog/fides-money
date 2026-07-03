---
phase: 9
reviewers: [gsd-plan-checker]
review_type: internal
reviewed_at: 2026-07-03
plans_reviewed: [09-01-PLAN.md, 09-02-PLAN.md, 09-03-PLAN.md, 09-04-PLAN.md, 09-05-PLAN.md]
note: >
  Cross-AI review (/gsd-review --all) não pôde rodar — nenhuma CLI externa autenticável
  (gemini free tier capado: -m ignorado→gemini-3.5-flash, input_token free quota bloqueada,
  pro limit:0; OAuth pessoal falhou repetidamente em "Premature close" no token exchange).
  Fallback: review interno independente via gsd-plan-checker (goal-backward, Sonnet).
  Não é cross-AI verdadeiro, mas cobre gaps/deps/segurança/meta.
verdict: ISSUES FOUND
---

# Plan Review — Phase 9: Transações (power tools + analytics)

Reviewer: `gsd-plan-checker` (interno, goal-backward). Escopo: 09-01..09-05 vs ROADMAP (TX-01..TX-08) + 09-RESEARCH.md + 09-PATTERNS.md.

## 09-01 — store: monthsInRange / spendByCategoryRange / rangeTransactions
**Summary:** Fundação cross-month no store. Deriva `spendByCategoryRange`/`rangeTransactions` sem alterar `spendByCategory`/`monthTransactions` (protege Dashboard + fides-claude.jsx).
**Strengths:** preserva assinatura de `spendByCategory` (byte-identidade testada); replica predicado `t.val < 0 && !t.isTransfer`; usa `txMonth(t)` preservando correção de ciclo de fatura da Fase 6.
**Concerns:** LOW — `rangeTransactions` não filtra `is_transfer` (correto: lista mostra tudo com badge); dependência implícita cross-checada em 09-04.

## 09-02 — CommandPalette ⌘K
**Summary:** Liga afordance morto do masthead a componente novo, busca em memória, nav via `setActive`.
**Strengths:** threat model proíbe `dangerouslySetInnerHTML` (mitiga XSS); trata Rules of Hooks explicitamente; resolve Open Question 3 do research; sem overlap de arquivo na wave 1.
**Concerns:** LOW — não especifica auto-fechar palette ao navegar por fora dele (gap UX menor).

## 09-03 — TX-01 filtro Cartões + TX-02 paginação
**Summary:** Subseções Contas/Cartões no `TxAdvFiltersModal` + paginação client-side (`sorted → pagedSorted → grouped`).
**Strengths:** pagina sobre `sorted` ANTES de `grouped` (evita Pitfall 1: totais de grupo quebrados); "selecionar todas" opera sobre `sorted` completo com sinalização UI (Pitfall 2 consciente); reusa `acctNameOf`/`toggleAcct` sem nova fonte de verdade.
**Concerns:** LOW — `M = Math.ceil(sorted.length/pageSize)` protegido por `Math.max(1,...)` p/ lista vazia (coberto).

## 09-04 — TX-03/TX-04: range mode na lista + widget analytics
**Summary:** Introduz `rangeMode`/`rangePreset`/`fromYM`/`toYM`, alterna `baseList`, alimenta `Donut`/`CategoryChart` com `spendByCategoryRange`.
**Strengths:** troca só a fonte (`baseList`), deixa `filtered/sorted/...` reagirem; memoiza chamadas de range (Pitfall 4); reusa charts sem alterá-los.
**Concerns:**
- **MEDIUM** — derivação de `[fromYM,toYM]` ambígua: não define se são `useState` sempre (sync via `useEffect`) ou computados. Risco de hooks condicionais indiretos / loop de re-render. Forçar: `fromYM`/`toYM` SEMPRE `useState`, atualizados por um único `useEffect` quando `rangePreset !== 'custom'`.
- **MEDIUM** — estado inicial de `fromYM`/`toYM` não especificado. Se calculados no 1º render com `undefined`, `monthsInRange` (09-01, `fromYM.split('-')`) lança erro → quebra app ao ativar range mode. Inicializar via lazy `useState` com `rangeFromPreset(selectedMonth,'3m')`, não depender de efeito assíncrono.

## 09-05 — TX-05 CSV audit + TX-06 persistência + TX-08 preview de limite
**Summary:** 3 acabamentos independentes no mesmo arquivo (wave 3, depende de 09-04).
**Strengths:** TX-05 tratado como auditoria (não reimplementa `handleExport`, Pitfall 5); TX-06 força `try/catch` em todo localStorage + teste de dado corrompido (mitiga T-09-LS); TX-08 documenta limitação (Pitfall 3) na UI em vez de generalizar fora de escopo.
**Concerns:**
- **HIGH (security)** — `csvSafeCell` aplicado SÓ a `t.desc`. `catLabel` (categorias custom, `user_categories`) e `acctName` (nomes de conta editáveis) também são strings user-controlled, escritas cruas no CSV → CSV-injection não mitigada. Fix: aplicar `csvSafeCell` também a `catLabel` e `acctName` (mesma função, custo zero).
- **MEDIUM (side-effect)** — TX-06 restaura `selectedMonth` GLOBAL (via `setSelectedMonth` mount-only). `selectedMonth` é consumido por Dashboard/Orçamento/PlnMesInsights — abrir Transações pode mudar silenciosamente o mês em todo o app. ROADMAP TX-06 só pede persistir no escopo de Transações. Decidir com produto OU isolar em estado local de página.

## Consensus / Top Risks (priorizado)
1. **[HIGH] CSV-injection parcial (09-05 T1)** — cobrir `catLabel`/`acctName` além de `t.desc`. Fix trivial. Segurança em `assets/` = tratar como completo (CLAUDE.md).
2. **[MEDIUM] `selectedMonth` global restaurado por Transações (09-05 T2)** — decisão de produto ou isolar side-effect cross-page.
3. **[MEDIUM] Init ambíguo de `[fromYM,toYM]` (09-04 T1)** — risco `undefined.split('-')` no 1º render; forçar lazy `useState`.
4. **[LOW] Open Questions do research sem marcador RESOLVED** — processo, não bloqueia.
5. **[LOW] Rules of Hooks** — bem coberto nos 5 plans (bug Phase 07 citado). Sem gap.

**Cobertura:** TX-01..TX-08 100% cobertos nas frontmatter dos 5 plans. Deps waves 1→2→3 corretas e acíclicas, sem overlap de arquivo intra-wave. Sem uso de RPC sensível (`transfer_funds`/`pay_card_invoice`); fase client-only, RLS não tocada.

## Veredito: ISSUES FOUND
Nenhum blocker estrutural de cobertura/dependência — a fase atinge a meta do ROADMAP. Resolver itens 1–3 (esp. #1 trivial, #2 decisão de produto) antes de executar, evitando retrabalho em `assets/fides-transacoes.jsx`.
