# SPEC — Fase M4 · Ciclo de Fatura Confiável

> O QUE a fase entrega (não o COMO — isso é o `PLAN.md`).
> Estado: pré-execução. Nenhuma linha de código do app foi escrita.

---

## 1. Problema (evidência real, 28/06/2026)

Cartão Bradesco do usuário: **melhor data de compra (fechamento) = dia 19**, vencimento dia 01. Hoje é 28/06.

Comportamento esperado pelo usuário (texto do próprio modal de cartão do app):
> • Compras até dia 18 → fatura atual (vence dia 1)
> • Do dia 19 em diante → próxima fatura

Comportamento observado no modal **"Pagar fatura"**:
- Mostra **todas** as compras não quitadas do cartão — junho **e** as de 19/06 em diante (que pertencem à próxima fatura) — **misturadas**.
- Total exibido: R$ 4.274,96 (59 de 59 lançamentos) — **não corresponde** à fatura real de junho.
- **Não há** como pagar somente a fatura de um mês.

A lista de **Transações** já separa corretamente (19/06+ aparecem em Julho). O defeito está **isolado no fluxo de pagamento de fatura**.

### Causa raiz (confirmada no código)

| Local | Fato |
|---|---|
| `assets/fides-store.jsx:1099-1113` | `faturaAbertaPorCartao` agrega por `map[t.acct]` — **ignora o mês de fatura**. Comentário admite: "agrega TODAS as txs não quitadas… independente do mês". |
| `assets/fides-store.jsx:1080-1097` | `faturasPorCartao` **já** agrupa por `mesFaturaFor` (chave `cardId|fat`). **Existe e não é usado pelo modal.** |
| `assets/fides-contas.jsx:816-822` | Card de cartão lê `faturaAbertaPorCartao[c.id]` e injeta `txs` inteiras no `setPayModal`. |
| `assets/fides-contas.jsx:177-200` | `PagarFaturaModal` apenas recebe `modal.txs` e pré-seleciona tudo — sem noção de fatura/mês. |
| `supabase/derived-balance.sql:106-138` | `pay_card_invoice(p_card_id, p_account_id, p_tx_ids[])` soma **apenas o subconjunto** passado → **pagamento por fatura não exige mudança de RPC**. |

---

## 2. Requisitos (o que precisa ser verdade ao fim)

### R1 — Faturas separadas por mês no pagamento (decisão do usuário)
Ao abrir "Pagar fatura", o usuário vê **a fatura de cada mês com suas próprias compras** e **escolhe qual fatura pagar**. Nunca um balde único misturando meses.

### R2 — Seletor de fatura, uma por vez
Modal abre na **fatura mais antiga em aberto**; seletor (`< mês ›`) troca entre os meses com fatura pendente do cartão. O total e a lista refletem só a fatura selecionada. *(Decisão aprovada: "Uma fatura por vez, com seletor".)*

### R3 — Status e datas explícitas
Cada fatura mostra: **status** (Aberta / Fechada / Vencida), **data de fechamento** e **data de vencimento** concretas. Pagar fatura **ainda aberta** é permitido (adiantamento) mas com aviso "ainda não fechou / ainda recebe lançamentos".

### R4 — Aviso de fechamento no card de Contas
O card do cartão em "Contas & Cartões" exibe aviso quando a fatura está **fechada e a vencer** (ex.: "Fatura de junho fechada · vence em 3 dias · R$ X").

### R5 — Sincronia com a fatura real (escopo aprovado: "+ Sincronia com fatura real")
Mecanismo para o usuário **conferir/ajustar** o valor que o Fides calcula contra o valor **real** da fatura do banco, reduzindo divergência. Forma exata = decisão de design (ver §4). Requer **nova coluna** em `cards` (ex.: `expected_invoice` por mês ou ajuste de reconciliação) — exige MCP + migração + espelho SQL.

### R6 — Sem regressão nos invariantes
- `is_transfer` do pagamento permanece (não conta em despesa).
- Saldo derivado intacto (`recalc_account_balance`).
- `pay_card_invoice` continua atômico; passa **apenas** os ids da fatura selecionada.
- Funciona em 400×512px iOS.

---

## 3. Não-objetivos (fora desta fase)

- Reabrir a convenção de `mesFaturaFor` (fechamento) — **mantida**. (Ver decisão D1.)
- Parcelamento / faturas futuras projetadas.
- Integração bancária automática (open finance).
- Alterar `fides-data.jsx` (protegido) — só se D1 forçar, e aí com aprovação explícita.

---

## 4. Decisões

### Travadas (respostas do Deyglison, 28/06/2026)
- **D-A:** Pagamento por fatura/mês, com o usuário escolhendo qual mês pagar. *(R1)*
- **D-B:** Uma fatura por vez, com seletor; adiantamento de fatura aberta permitido com aviso. *(R2/R3)*
- **D-C:** Escopo = modal + agrupamento + avisos **+ sincronia com fatura real**. *(R5)*
- **D-D:** Documentação de projeto em `.planning/` (gsd real).

### Resolvidas (Deyglison, 28/06/2026)

**D1 — Rótulo da fatura: mês de fechamento vs mês de vencimento. → (a) Manter fechamento + rótulo duplo.** ✅
`mesFaturaFor` permanece por mês de **fechamento** (compra 19/06 → `2026-07`). Não toca `fides-data.jsx` nem dados, zero backfill. UI mostra **ambas** as datas para matar a ambiguidade: "Fatura fecha 18/07 · vence 01/08". O agrupamento do modal usa a chave `cardId|mesFatura` já existente.

**D2 — Forma da sincronia com fatura real (R5). → (i) Campo "valor real da fatura" + badge de divergência.** ✅
Coluna nova em `cards` (`expected_invoice jsonb`, mapa `mesFatura → valor real`). Modal mostra "Fides R$ X · banco R$ Y · diferença R$ Z". Sem lançamento de ajuste automático nesta fase.

### Aberta (menor — resolver no código)

**D3 — Mês do lançamento de pagamento.** Hoje `pay_card_invoice` grava o pagamento com `date = hoje`. Decidir se o pagamento de uma fatura fechada deve carimbar o mês da fatura ou o dia do pagamento (afeta em que mês o `is_transfer` aparece). Provável: manter hoje (não afeta agregados de gasto).

---

## 5. Critério de conclusão (verificável)

- [ ] Modal "Pagar fatura" mostra **uma** fatura por vez, com seletor de mês; total = soma só daquela fatura.
- [ ] Pré-seleção e `pay_card_invoice` recebem **apenas** os ids da fatura selecionada (verificar no diff que não passa `faturaAbertaPorCartao`).
- [ ] Cada fatura exibe status + data de fechamento + vencimento.
- [ ] Card de Contas avisa fatura fechada/vencendo.
- [ ] (R5) Usuário consegue conferir/ajustar valor vs fatura real; coluna criada via MCP + espelho em `supabase/*.sql`.
- [ ] Pagar fatura de junho **não** marca compras de julho como `settled`.
- [ ] Sem regressão: saldo derivado, `is_transfer`, agregados de gasto inalterados.
- [ ] Validado em 400×512px iOS (ritual anti-cache).
- [ ] Diff revisado + blob verificado independentemente após push.
