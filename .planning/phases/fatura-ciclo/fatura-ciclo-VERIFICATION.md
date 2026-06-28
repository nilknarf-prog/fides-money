---
phase: fatura-ciclo
verified: 2026-06-28T19:30:00Z
status: human_needed
score: 6/6 must-haves present (3 verified, 3 present/behavior-unverified)
behavior_unverified: 3
behavior_unverified_items:
  - truth: "Pagamento envia ao pay_card_invoice apenas as txs da fatura ativa"
    test: "Abrir modal, selecionar mês, confirmar pagamento; conferir no Supabase que só as txs daquele mês ficaram settled"
    expected: "Apenas as transações da fatura do mês escolhido marcadas como quitadas; outros meses intactos"
    why_human: "Não há teste automatizado; o RPC roda no Supabase e o efeito só é observável no banco/app"
  - truth: "Card de Contas mostra fatura paga em Junho e fatura aberta em Julho conforme seletor do topo"
    test: "No app, alternar Junho↔Julho no seletor de mês e observar o card do cartão"
    expected: "Junho: 'Fatura paga · R$ X' sem botão Pagar; Julho: fatura aberta/fechada com botão Pagar"
    why_human: "Depende de dados live e estado settled; renderização condicional só verificável visualmente"
  - truth: "Valor real da fatura (cards.expected_invoice) persiste por mês"
    test: "No modal, digitar valor real numa fatura, fechar e reabrir; trocar de mês e voltar"
    expected: "Valor persiste por mesFatura; badge de divergência aparece só quando difere do total Fides"
    why_human: "Persistência via Supabase + leitura por chave mesFatura só observável em runtime"
---

# Phase fatura-ciclo: Ciclo de Fatura Confiável — Verification Report

**Phase Goal:** Usuário abre "Pagar fatura", vê a fatura do mês (só compras daquele ciclo, valor batendo), paga só ela, e troca pelo seletor para ver outro mês. O card de Contas avisa quando uma fatura fechou. Nada do agregado de gasto, saldo ou `is_transfer` muda de comportamento.
**Verified:** 2026-06-28T19:30:00Z
**Status:** human_needed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Modal separa faturas por mês (seletor + status + datas) | ✓ VERIFIED | `PagarFaturaModal` em fides-contas.jsx:177-258 — estado `idxFatura`, navegação `‹ ›`, chip `pfm-status-chip status-{status}`, header com mês/vencimento |
| 2 | Pagamento envia só txs da fatura ativa | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `activeFatura.txs` + `selected` (fides-contas.jsx:184-223); invariante `pay_card_invoice` não alterada — efeito no banco não exercido por teste |
| 3 | Card de Contas avisa fechamento da fatura | ✓ VERIFIED | fides-contas.jsx:946-957 — aviso "Fatura fechada. Vence dia N" / "O vencimento já passou!" |
| 4 | Card respeita o mês selecionado (paga em Junho / aberta em Julho) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `faturaDestaque = faturasMes.find(f => f.mesFatura === selectedMonth)` (fides-contas.jsx:881); estados paga/aberta/sem-fatura presentes — renderização não exercida em runtime |
| 5 | Sincronia com valor real do banco persiste por mês | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `card.expected_invoice[mesFatura]` + `updateCard` (fides-contas.jsx:188-205) — persistência Supabase não exercida |
| 6 | Agregado de gasto, saldo e is_transfer inalterados | ✓ VERIFIED | `pay_card_invoice` e `faturaAbertaPorCartao` (fides-store.jsx) intocados; nenhuma mudança em fides-data.jsx |

**Score:** 3/6 truths verified (3 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `assets/fides-store.jsx` | helpers de fatura por cartão | ✓ EXISTS + SUBSTANTIVE | `faturasDoCartao`, `faturasPorCartaoCompleto`, `faturasDoCartaoCompleto` com status/datas; expostos no context |
| `assets/fides-contas.jsx` | modal escopado + card por mês | ✓ EXISTS + SUBSTANTIVE | `PagarFaturaModal` completo; card escopa `faturaDestaque` a `selectedMonth` |
| `assets/fides-contas.css` | seletor/status/banner | ✓ EXISTS | classes `pfm-status-chip`, `pfm-nav-btn`, `pfm-banner-aberta` |
| `cards.expected_invoice` (Supabase) | coluna jsonb | ⚠️ NÃO VERIFICADO VIA MCP | lida/escrita pelo código; confirmar coluna no banco com `execute_sql` |

**Artifacts:** 3/4 verificados (1 pendente de confirmação no banco)

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| Card Contas | PagarFaturaModal | `setPayModal({faturas: faturasPagaveis})` | ✓ WIRED | fides-contas.jsx:888-892 |
| Modal | pay_card_invoice | `onConfirm` com txs da fatura ativa | ⚠️ WIRED (efeito não exercido) | escopo de `txIds` correto no código |
| Card | mês selecionado | `faturasMes.find(mesFatura === selectedMonth)` | ✓ WIRED | fides-contas.jsx:881 |
| Modal | cards.expected_invoice | `updateCard(expected_invoice)` | ✓ WIRED | fides-contas.jsx:199-204 |

**Wiring:** 3/4 conexões verificadas

## Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| Modal por fatura/mês + seletor | ✓ SATISFIED | - |
| Status aberta/fechada/vencida | ✓ SATISFIED | - |
| Aviso de fechamento no card | ✓ SATISFIED | - |
| Sincronia com valor real (coluna nova) | ? NEEDS HUMAN | confirmar coluna + persistência live |
| Card escopado ao mês | ? NEEDS HUMAN | verificar render Junho/Julho no app |

**Coverage:** 3/5 satisfeitos programaticamente

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| - | - | nenhum stub/placeholder | ℹ️ Info | sintaxe JSX validada via @babel/parser em ambos arquivos |

**Anti-patterns:** 0 (sem blockers)

## Human Verification Required

### 1. Pagamento escopado por mês
**Test:** Abrir "Pagar fatura", trocar o seletor de fatura para um mês, confirmar pagamento.
**Expected:** Só as txs daquele mês ficam quitadas; outros meses intactos no app e no Supabase.
**Why human:** Sem teste automatizado; efeito do RPC só observável no banco.

### 2. Card respeita o mês do topo
**Test:** Alternar Junho↔Julho no seletor de mês principal.
**Expected:** Junho → "Fatura paga · R$ X" sem botão Pagar; Julho → fatura aberta/fechada com Pagar.
**Why human:** Render condicional dependente de dados live (`settled`).

### 3. Persistência do valor real do banco
**Test:** Digitar "valor real da fatura (banco)", fechar/reabrir, trocar mês e voltar.
**Expected:** Valor persiste por mês; badge de divergência só quando difere.
**Why human:** Persistência Supabase + leitura por `mesFatura` só observável em runtime.

## Gaps Summary

**Sem gaps de código.** Todos os artefatos existem, são substantivos e estão conectados. Pendências são exclusivamente de **verificação comportamental humana** (3 itens) — esperado num projeto sem suíte de testes automatizados (React Babel standalone). Recomendação: rodar os 3 testes acima no app após o deploy automático do Vercel.

## Verification Metadata

**Verification approach:** Goal-backward (derivado do goal do PLAN.md/ROADMAP.md)
**Must-haves source:** PLAN.md (T1–T6) + goal backward
**Automated checks:** sintaxe JSX validada (2 arquivos OK via @babel/parser); sem suíte de testes no projeto
**Human checks required:** 3
**Total verification time:** ~5 min (retroativo)

---
*Verified: 2026-06-28T19:30:00Z*
*Verifier: Claude (retroativo — fase implementada fora do fluxo GSD)*
