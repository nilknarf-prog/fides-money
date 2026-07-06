---
status: complete
phase: 10-corre-o-fatura-cart-o-hardening-de-importa-o
source: [10-VERIFICATION.md]
started: 2026-07-04T21:15:00Z
updated: 2026-07-06T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Fatura Bradesco (fecha 19 / vence 1)
expected: Abrir Contas com o cartão Bradesco (compras 19/06→11/07). Card exibe "Fecha 19/07 · Vence 01/08" com status "Aberta" (não "Vence 01/07 · Vencida").
result: pass

### 2. Fatura Bradesco de junho já paga
expected: Mesmo cartão com a fatura de junho paga (todas as txs settled) → status continua "Paga" (não reabre para vencida/fechada).
result: pass

### 3. Regressão closing_day < due_day
expected: Cartão com closing<due (ex.: Nubank fecha 5 / vence 15) no card de Contas → fechamento e vencimento no MESMO mês, sem inversão (regressão D-05).
result: pass

### 4. Reimport do próprio CSV → 0 duplicatas
expected: Exportar o CSV do próprio app e reimportar imediatamente o mesmo arquivo → todas as linhas aparecem no preview como "já importada" e DESMARCADAS; confirmar resulta em 0 novas gravações (contagem inalterada após refresh).
result: pass
note: "Re-testado pós gap-closure (10-04) + fix CR-01/WR-01/WR-02 (c2cd89d). T4a same-year=ok, T4b cross-year=ok (ano preservado no round-trip), T4c destino/status pills=ok, T4d troca de destino desmarca duplicatas=ok."

### 5. Import destino=cartão grava card_id (não account_id)
expected: Importar CSV com 1 linha nova + destino = um CARTÃO; confirmar; conferir via Supabase `select account_id, card_id from transactions order by created_at desc limit 1` → card_id não é null; account_id é null.
result: pass
note: "Re-testado (T5): destino cartão grava card_id preenchido / account_id nulo."

### 6. Cancelar import não grava nada
expected: Testar Cancelar num import com linhas novas (antes de confirmar) → nada é gravado.
result: pass
note: "Cancelar não grava (OK). PORÉM bug adjacente: trocar de aba do Chrome ou minimizar por 1s reseta todo o modal de import (seleções perdidas, página recarrega ~1s). Sem persistência de estado. Registrado como gap."

### 7. Chip "Cartão" no masthead de Transações
expected: Clicar o chip "Cartão" → lista mostra só transações de crédito (cartões); chip fica "on"; modal de Filtros avançados NÃO abre; clicar de novo desliga.
result: pass

### 8. Modo Período — Donut hover/tap + legenda completa
expected: No modo Período (3m/6m/12m/Ano) com várias categorias, passar mouse/tocar uma fatia do Donut → centro muda para categoria + valor + %; sair volta a "Total"; toda categoria da legenda completa (.fds-cats-list) tem representação, mesmo além das 7 barras do CategoryChart.
result: pass
note: "Re-testado pós 10-06. T8a legenda=top-7 (termina Restaurante/Delivery, sem repetição). T8b donut/total=mês do masthead. T8c hover/tap fatia=categoria+valor+%, volta a Total."

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

Todos os 6 gaps do UAT + os achados de code-review (CR-01 blocker, WR-01/WR-02) fechados e re-testados pelo usuário (9/9 pass). Ver 10-VERIFICATION.md.

- truth: "Reimport do CSV (mesmo ano e cross-year) = 0 novas gravações; pendentes já lançadas voltam desmarcadas"
  status: resolved
  fix: "10-04 (dedup/destino por linha) + c2cd89d (CR-01: export grava DD/MM/YYYY)"
  test: 4

- truth: "Import nunca converte pendente→paga; nunca duplica"
  status: resolved
  fix: "10-04 (status explícito no payload)"
  test: 4

- truth: "Modal oferece destino (Da origem do arquivo) + status (Do arquivo/Pendente/Paga)"
  status: resolved
  fix: "10-04 (G3)"
  test: 4

- truth: "Trocar destino no modal desmarca linhas que viram duplicata"
  status: resolved
  fix: "c2cd89d (WR-01: effect reconcilia selected↔dupKeys)"
  test: 4

- truth: "Legenda período = top-7, sem repetição/sem-barra"
  status: resolved
  fix: "10-06 (G4)"
  test: 8

- truth: "Donut/total período refletem o mês do masthead; hover/tap mostra categoria+valor+%"
  status: resolved
  fix: "10-06 (G5)"
  test: 8

- truth: "Modal de import preserva seleções ao trocar aba/minimizar"
  status: resolved
  fix: "10-05 (G6: guarda loadedUid no onAuthStateChange)"
  test: 6
