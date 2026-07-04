---
status: testing
phase: 10-corre-o-fatura-cart-o-hardening-de-importa-o
source: [10-VERIFICATION.md]
started: 2026-07-04T21:15:00Z
updated: 2026-07-04T21:15:00Z
---

## Current Test

number: 1
name: Fatura Bradesco (fecha 19 / vence 1) exibe fechamento/vencimento corretos
expected: |
  Card exibe "Fecha 19/07 · Vence 01/08" com status "Aberta" (não "Vence 01/07 · Vencida")
awaiting: user response

## Tests

### 1. Fatura Bradesco (fecha 19 / vence 1)
expected: Abrir Contas com o cartão Bradesco (compras 19/06→11/07). Card exibe "Fecha 19/07 · Vence 01/08" com status "Aberta" (não "Vence 01/07 · Vencida").
result: [pending]

### 2. Fatura Bradesco de junho já paga
expected: Mesmo cartão com a fatura de junho paga (todas as txs settled) → status continua "Paga" (não reabre para vencida/fechada).
result: [pending]

### 3. Regressão closing_day < due_day
expected: Cartão com closing<due (ex.: Nubank fecha 5 / vence 15) no card de Contas → fechamento e vencimento no MESMO mês, sem inversão (regressão D-05).
result: [pending]

### 4. Reimport do próprio CSV → 0 duplicatas
expected: Exportar o CSV do próprio app e reimportar imediatamente o mesmo arquivo → todas as linhas aparecem no preview como "já importada" e DESMARCADAS; confirmar resulta em 0 novas gravações (contagem inalterada após refresh).
result: [pending]

### 5. Import destino=cartão grava card_id (não account_id)
expected: Importar CSV com 1 linha nova + destino = um CARTÃO; confirmar; conferir via Supabase `select account_id, card_id from transactions order by created_at desc limit 1` → card_id não é null; account_id é null.
result: [pending]

### 6. Cancelar import não grava nada
expected: Testar Cancelar num import com linhas novas (antes de confirmar) → nada é gravado.
result: [pending]

### 7. Chip "Cartão" no masthead de Transações
expected: Clicar o chip "Cartão" → lista mostra só transações de crédito (cartões); chip fica "on"; modal de Filtros avançados NÃO abre; clicar de novo desliga.
result: [pending]

### 8. Modo Período — Donut hover/tap + legenda completa
expected: No modo Período (3m/6m/12m/Ano) com várias categorias, passar mouse/tocar uma fatia do Donut → centro muda para categoria + valor + %; sair volta a "Total"; toda categoria da legenda completa (.fds-cats-list) tem representação, mesmo além das 7 barras do CategoryChart.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
