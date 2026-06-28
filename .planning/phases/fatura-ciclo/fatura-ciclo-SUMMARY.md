---
phase: fatura-ciclo
plan: 01
subsystem: faturas-cartao
tags: [react, supabase, faturas, ciclo-fatura, cards]
provides:
  - Modal "Pagar fatura" escopado por mês/fatura com seletor e status
  - Sincronia opcional com valor real do banco (cards.expected_invoice)
  - Aviso de fechamento no card de Contas
  - Card de Contas escopado ao mês selecionado (fatura paga / aberta por mês)
affects: [contas, transacoes]
tech-stack:
  added: []
  patterns:
    - Reaproveitamento de faturasPorCartao (sem nova lógica de agrupamento)
    - Derivação paralela faturasDoCartaoCompleto (inclui txs settled p/ exibir fatura paga)
key-files:
  created: []
  modified:
    - assets/fides-store.jsx
    - assets/fides-contas.jsx
    - assets/fides-contas.css
key-decisions:
  - "D1=(a): manter fechamento + rótulo duplo; não tocar fides-data.jsx nem dados"
  - "D2=(i): coluna cards.expected_invoice jsonb (mesFatura→valor real) + badge de divergência"
  - "Card de Contas exibe a fatura do mês selecionado; mês pago mostra valor pago, sem reabrir para pagamento"
  - "Modal continua recebendo apenas faturas pagáveis (não-quitadas); default na 1ª fechada/vencida"
duration: 2 sessões
completed: 2026-06-28
status: complete
---

# Phase fatura-ciclo: Ciclo de Fatura Confiável — Summary

**Modal "Pagar fatura" passou a separar faturas por mês (seletor + status + datas), com sincronia opcional ao valor real do banco; o card de Contas agora respeita o mês selecionado no topo.**

## Performance
- **Duration:** ~2 sessões (entrega principal + fix de escopo de mês)
- **Tasks:** T1–T6 entregues (T0 auditoria absorvida na implementação)
- **Files modified:** 3 (`fides-store.jsx`, `fides-contas.jsx`, `fides-contas.css`)

## Accomplishments
- **T1 — Store:** helper `faturasDoCartao(cardId)` derivado de `faturasPorCartao`, retornando faturas pendentes ordenadas com `dtFechamento`/`dtVencimento`/`status` (aberta/fechada/vencida).
- **T2 — Contas:** card abre o modal com a lista de faturas separadas (não `txs` flat).
- **T3 — Modal:** `PagarFaturaModal` com seletor `‹ Mês · vence DD/MM ›`, chip de status, banner para fatura aberta, e pagamento escopado apenas às txs da fatura ativa (invariante `pay_card_invoice` preservada).
- **T5 — Sincronia:** coluna `cards.expected_invoice jsonb`; input "valor real da fatura (banco)" por fatura; persistência via `updateCard`.
- **T6 — Aviso de fechamento:** linha de aviso no card quando fatura fechada/vencida.
- **Fix pós-entrega — escopo de mês:** o card mostrava a 1ª fatura fechada/vencida de qualquer mês (porque `faturasPorCartao` exclui txs quitadas), ignorando o seletor do topo. Adicionada derivação `faturasDoCartaoCompleto` (inclui txs `settled`, status `paga`) e o card passou a escopar `faturaDestaque` a `selectedMonth`.

## Task Commits
1. **Entrega principal (T1–T6)** — `ade84f7` feat(faturas): ciclo confiavel de faturas e modal escopado (M4)
2. **Fix tela branca (parsing data/ícone)** — `8be3f4c`
3. **Fix tela branca (faturaTxs ausente)** — `eb89da7`
4. **Fix escopo de mês no card** — `95ebfe7` fix(faturas): card de cartao respeita o mes selecionado

## Files Created/Modified
- `assets/fides-store.jsx` — `faturasDoCartao`, `faturasPorCartaoCompleto`, `faturasDoCartaoCompleto` (com status `paga`); expostos no context.
- `assets/fides-contas.jsx` — `PagarFaturaModal` (seletor/status/sincronia); card de Contas escopado ao mês, com estados fatura paga / aberta / sem fatura.
- `assets/fides-contas.css` — classes do seletor, chips de status, banner de fatura aberta.

## Decisions & Deviations
- D1=(a) e D2=(i) conforme PLAN (resolvidas em 28/06/2026).
- **Desvio de processo:** fase implementada fora do fluxo GSD (commits diretos), SUMMARY/VERIFICATION gerados retroativamente.
- **Adição não prevista no PLAN:** `faturasDoCartaoCompleto` para exibir fatura paga do mês selecionado (decisão do usuário: mostrar valor pago, não só "em dia").

## Next Phase Readiness
- `faturaAbertaPorCartao` ainda existe (consumido por `fides-claude.jsx`); remoção fica para limpeza futura (T7 parcial).
- Pendente verificação humana no app (alternar Junho↔Julho; pagar fatura escopada). Ver VERIFICATION.md.
