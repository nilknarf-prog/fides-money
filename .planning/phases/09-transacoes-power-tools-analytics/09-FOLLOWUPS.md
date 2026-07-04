# Fase 09 — Follow-ups (backlog gerado no UAT 2026-07-04)

UAT da fase 09: **7/7 passou, 0 issues**. Os itens abaixo são fora do escopo da fase 09,
descobertos durante o teste. Prioridade decrescente.

---

## P1 — BUG: fatura de cartão com fechamento/vencimento um ciclo atrás

**Sintoma (usuário):** cartão Bradesco (fecha dia 19, vence dia 1). Fatura de junho paga
ainda em junho. Em julho o app mostra uma fatura "Vence 01/07 · Vencida", confundindo o
usuário. Valor exibido R$ 1.522,98, "Ver 24 lançamentos", "+6 em aberto em outros meses".

**Diagnóstico (confirmado — é lógica de exibição, NÃO dado):**
Dados no banco estão corretos:
- fatura 2026-06: 36 txs `settled=true` (paga), datas 19/05→18/06.
- fatura 2026-07: 24 txs `settled=false` (aberta real), R$ 1.522,98, datas 19/06→11/07.
- 2026-08..2027-01: 1 parcela de R$ 1,48 cada (settled=false).

Raiz: convenção de "mês da fatura" inconsistente entre dois pontos.
- `mesFaturaFor` (assets/fides-data.jsx:52) define mês da fatura = **mês em que FECHA**
  (`if (dd >= fechamento) monthClose = mm + 1`). Compra 19/06→18/07 → fatura "2026-07"
  = fecha 19/07, vence 01/08.
- `faturasDoCartao` (assets/fides-store.jsx:1265) e `faturasDoCartaoCompleto`
  (assets/fides-store.jsx:1334) tratam o mesmo mês como **mês em que VENCE**:
  `mes = mm-1`; `if (diaF > diaV) mesF = mes - 1`; `dtFechamento = Date(ano, mesF, diaF)`;
  `dtVencimento = Date(ano, mes, diaV)`. Para "2026-07" isso dá fecha 19/06 / vence 01/07.

Off-by-one-cycle quando `closing_day > due_day` (vencimento cai no mês seguinte ao
fechamento). Para "2026-07" o correto seria fecha **19/07** e vence **01/08**.

**Fix (proposto, a validar no planejamento):** unificar a convenção. Se mesFatura = mês
que fecha, então `dtFechamento = Date(ano, mes, diaF)` e
`dtVencimento = diaV >= diaF ? Date(ano, mes, diaV) : Date(ano, mes+1, diaV)`.
Remover o branch `if (diaF > diaV) mesF = mes - 1`.

**Regressão obrigatória:** testar também cartão com `closing_day < due_day`
(fecha e vence no mesmo mês) para não inverter esse caso. Domínio sensível de cartão —
rodar security/database review (CLAUDE.md: caminho sensível).

**Arquivos:** assets/fides-store.jsx:1265-1293 e :1334-1365; assets/fides-data.jsx:52-64.

---

## P2 — DEBT: Importar CSV/OFX sem preview, seleção, confirmação ou dedupe

**Incidente:** usuário reimportou o próprio CSV exportado → 196 transações duplicadas.
Revertido manualmente nesta sessão via SQL (delete do cluster `created_at` de 1s +
`recalc_account_balance` das 5 contas afetadas). Total voltou de 398 para 202.

**Raiz:** `handleImport` (assets/fides-transacoes.jsx:554) chama `addTransaction` linha a
linha sem: modal de preview, seleção de quais importar, confirmação, nem dedupe.
Bugs adicionais do import a corrigir junto:
- Ignora o `mes` do CSV e força `selectedMonth` (assets/fides-transacoes.jsx:612).
- Transações de cartão entram como `account_id` (card_id fica null) — mapeamento por nome
  de conta não resolve cartão.

**Fix (proposto):** modal de preview com checkboxes (selecionar todas / individuais),
dedupe por `description+value+date` contra o existente, e usar o `mes`/fatura correto por
linha. Usuário pediu para NÃO consertar agora, só registrar.

---

## P3a — UX: botão rápido "Cartão" no masthead de Transações

Ao lado dos filtros "Conta"/"Valor" existentes, um botão "Cartão" que já filtra as
transações de crédito sem precisar abrir "Filtros avançados".

## P3b — UX: modo Período (analytics)

- Nem toda cor da legenda tem barra representada no gráfico — revisar mapeamento
  cor↔categoria / itens ocultos.
- Adicionar valor gasto por categoria no hover/tap (equivalente ao centro do donut do
  modo Mês único) no gráfico do modo Período.
