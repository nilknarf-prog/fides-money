# PLAN — Fase M4 · Ciclo de Fatura Confiável

> Como entregar o `SPEC.md`. Plano de execução (não código do app). Quem codifica: Deyglison via Gemini 3.1 Pro (High) ou Sonnet 4.6.
> Base: working tree `714872e`. Segue o workflow de 4 fases do projeto.

---

## Goal (backward)

> Ao terminar, o usuário abre "Pagar fatura", vê **a fatura de junho** (só compras de junho, valor batendo com o cartão real), paga só ela, e troca pelo seletor para ver julho. O card de Contas avisa quando uma fatura fechou. Nada do agregado de gasto, saldo ou `is_transfer` muda de comportamento.

Para isso ser verdade, três peças precisam existir e conectar:
1. **Dado por fatura** chegando ao modal (já existe em `faturasPorCartao`, falta consumir).
2. **UI de seleção** (seletor + status + datas).
3. **Sincronia de valor** (nova coluna + badge de divergência).

---

## Pré-requisitos de decisão — RESOLVIDOS (28/06/2026)

- **D1 = (a)** Manter fechamento + rótulo duplo ("Fecha 18/07 · vence 01/08"). Não toca `fides-data.jsx` nem dados. ✅
- **D2 = (i)** Coluna `cards.expected_invoice jsonb` (`mesFatura → valor real`) + badge de divergência. ✅

→ Nada bloqueia a geração de prompts de Code. T5 com schema já definido.

---

## Arquitetura da solução (decisão de design)

**Reaproveitar `faturasPorCartao` (não criar lógica nova de agrupamento).** Ele já entrega `{ cardId, mesFatura, total, txs[] }` por chave `cardId|fat`. O trabalho é:

- **Store**: expor um helper `faturasDoCartao(cardId)` → array ordenado de faturas pendentes daquele cartão (derivado de `faturasPorCartao`), e incluir datas de fechamento/vencimento calculadas a partir de `diaFechamento`/`diaVencimento` + `mesFatura`.
- **Contas**: o card passa a abrir o modal com a **lista de faturas** (não `txs` flat). O `faturaValor` do card vira "fatura mais recente fechada" ou soma rotulada — a definir na discussão (não misturar no número principal).
- **Modal**: ganha estado `faturaAtiva` (índice), seletor, status/datas, e só envia ao `payCartaoFatura` os ids de `faturaAtiva.txs`.
- **Sincronia (R5)**: nova coluna em `cards` + UI de "valor real" + badge de divergência.

**Invariante a preservar:** `pay_card_invoice` **não muda** — só recebe um subconjunto de ids. Confirmado em `supabase/derived-balance.sql:117-119`.

---

## Tarefas (atômicas, ordenadas)

### T0 · Auditoria (Fase 1 — read-only, antes de tocar nada)
**Objetivo:** confirmar o estado real e descartar surpresas de schema.
- MCP Supabase: `list_tables` em `cards` → confirmar colunas `closing_day`, `due_day`; confirmar que NÃO existe coluna de fatura esperada.
- MCP: amostrar transações de cartão não quitadas do usuário → conferir distribuição de `month` vs `mesFaturaFor` esperado (validar a hipótese da causa raiz com dado real).
- `grep` por consumidores de `faturaAbertaPorCartao` e `faturasPorCartao` em `assets/` (garantir que mexer não quebra Transações/Claude).
- **Saída:** relatório bruto. PARAR.

### T1 · Store — helper de faturas por cartão
**Arquivo:** `assets/fides-store.jsx`
- Adicionar derivação `faturasDoCartao(cardId)` a partir de `faturasPorCartao`: retorna `[{ mesFatura, total, txs, dtFechamento, dtVencimento, status }]` ordenado por `mesFatura` asc.
- `status` ∈ {`aberta`, `fechada`, `vencida`} calculado de `dtFechamento`/`dtVencimento` vs hoje.
- Datas derivadas de `diaFechamento`/`diaVencimento` do cartão + `mesFatura`. **Não** reimplementar `mesFaturaFor`; reusar.
- Expor no context value (junto de `faturasPorCartao`).
- **Não remover** `faturaAbertaPorCartao` ainda (outros consumidores podem usar; T0 confirma) — depreciar só após T2 verde.
- **Verificação:** em mock/live, `faturasDoCartao(card)` separa junho de julho; soma de cada `total` = soma de `faturaAbertaPorCartao[card].total`.

### T2 · Contas — card abre modal com faturas separadas
**Arquivo:** `assets/fides-contas.jsx` (`cards.map`, ~L813-880; `handlePay` ~L819)
- `handlePay` passa `faturas = faturasDoCartao(c.id)` para `setPayModal` (não `faturaAberta.txs`).
- Card mostra a fatura **fechada mais próxima** como destaque + nº de faturas pendentes; não somar meses no número principal.
- Texto-meta passa a citar fechamento/vencimento reais.
- **Verificação:** abrir modal pelo cartão real → vê fatura de junho isolada.

### T3 · Modal — seletor + status + datas + pagamento escopado
**Arquivo:** `assets/fides-contas.jsx` (`PagarFaturaModal`, L177-310)
- Novo estado `idxFatura` (default = fatura mais antiga em aberto / mais antiga fechada).
- Header ganha seletor `‹ Junho · vence 01/07 ›` + chip de status (Aberta/Fechada/Vencida).
- Lista e `totalSelecionado` derivam de `faturas[idxFatura].txs`.
- Se fatura `aberta`: banner "ainda não fechou — ainda pode receber lançamentos".
- `onConfirm` envia ao `payCartaoFatura` **apenas** `faturas[idxFatura].txs` selecionadas → `txIds` escopados.
- iOS: seletor com `<button>` nativo, `touch-action: manipulation`, `min-height:44`, `onPointerUp` em itens.
- **Verificação:** pagar junho → grep no payload de `pay_card_invoice` só com ids de junho; julho intacto.

### T4 · CSS do seletor/status/banner
**Arquivo:** `assets/fides-contas.css`
- Classes do seletor de fatura, chips de status, banner de aberta. Reusar tokens; nada em `tokens.css`.
- **Verificação:** 400×512px sem overflow; sem cor off-brand hardcoded.

### T5 · Sincronia com fatura real (R5 / D2=(i))
**Arquivos:** migração Supabase (MCP `apply_migration`) + espelho `supabase/*.sql` + `fides-store.jsx` + `fides-contas.jsx`/`.css`
- Migração: `ALTER TABLE cards ADD COLUMN expected_invoice jsonb DEFAULT '{}'::jsonb` — mapa `mesFatura (YYYY-MM) → valor real informado pelo usuário`. RLS herdada de `cards` (já filtra `user_id=auth.uid()`).
- Store: `updateCard` já mapeia patches → estender p/ aceitar `expected_invoice`; leitura por `card.expected_invoice[mesFatura]`.
- Modal: input "valor real da fatura (banco)" por fatura selecionada + badge de divergência ("Fides R$ X · banco R$ Y · diferença R$ Z"). Sem lançamento de ajuste automático nesta fase.
- **Regra do projeto:** aplicar SQL no mesmo chat que cria; rodar `get_advisors` pós-migração; espelhar em `supabase/`.
- **Verificação:** MCP `execute_sql` confirma coluna + default; badge aparece só quando valores divergem; valor persiste por mês.

### T6 · Aviso de fechamento no card de Contas (R4)
**Arquivo:** `assets/fides-contas.jsx` (`ctn-card-fatura-meta`)
- Quando há fatura `fechada`/`vencida`: linha de aviso com dias até o vencimento.
- **Verificação:** com a data atual (28/06) e cartão fechando dia 19, card mostra fatura de junho fechada.

### T7 · Regressão & limpeza
- Confirmar Transações, Assistente e Dashboard inalterados (T0 listou consumidores).
- Se `faturaAbertaPorCartao` ficou órfão após T2/T6 → remover em commit separado (decisão consciente, não no mesmo diff da feature).
- Ritual anti-cache iOS; testar pagamento real ponta a ponta.

---

## Ordem de execução / dependências

```
T0 (audit) ─► T1 (store) ─► T2 (contas card) ─► T3 (modal) ─► T4 (css)
                                                        └─► T6 (aviso)
D2 decidida ─► T5 (sincronia)  ──────────────────────────────► T7 (regressão/limpeza)
```
T1–T4+T6 = entrega mínima utilizável (faturas separadas + seletor). T5 = camada de sincronia. T7 fecha.

---

## Risco / threat model

| Risco | Severidade | Mitigação |
|---|---|---|
| Pagar fatura errada marca `settled` em txs de outro mês | **Alta** | T3 escopa `txIds` à fatura ativa; verificação por grep no payload |
| Re-rotular por vencimento (se D1=b) corromper lista de Transações | Alta | Default D1=(a) não toca dado; se (b), backfill + revalidação obrigatória |
| Migração de coluna (T5) sem RLS → vazamento | Alta | Coluna em `cards` herda RLS; revisar advisor MCP pós-migração |
| `mesFaturaFor` com `year` fixo 2026 em virada de ano | Média | Já há wrapper dinâmico no store; cobrir no T0/T1 |
| Tocar `fides-data.jsx` (protegido) sem aprovação | Média | Só se D1=(b); exige autorização explícita (PARAR-E-PERGUNTAR) |
| Quebra de layout iOS no seletor | Média | T4 valida 400×512px antes do push |

---

## Rollback

- Branch de feature `feat/fatura-ciclo` a partir de `714872e`; merge `--no-ff`.
- T5 (DB) é o único passo não trivial de reverter: migração de coluna é aditiva (drop column reverte sem perda de tx). Não alterar `pay_card_invoice`.
- Cada T = commit atômico → `gsd-undo` / `git revert` por tarefa.

---

## Prompt-mold para o Code (Fase 1 — colar no executor)

```
REGRA INVIOLÁVEL Nº1: NÃO faça commit nem push em nenhum momento.
Pare após mostrar o output. Se o stop hook pedir push, IGNORE.

PAPEL: engenheiro sênior React/Supabase no Fides Money (React 18 Babel
standalone, CSS puro, Supabase, Vercel). Viewport 400×512px iOS.

CONTEXTO:
- Working tree autenticado; último commit main: 714872e
- Arquivos protegidos (NÃO tocar): fides-data.jsx, fides-charts.jsx,
  tokens.css, design-canvas.jsx, tweaks-panel.jsx, Fides-app.html
- Causa raiz já mapeada: faturaAbertaPorCartao (fides-store.jsx:1099-1113)
  mistura faturas; faturasPorCartao (1080-1097) já separa por mesFaturaFor.

TAREFA — FASE 1 AUDITORIA (read-only, PARAR e reportar bruto):
1. grep -rn "faturaAbertaPorCartao\|faturasPorCartao\|faturasDoCartao" assets/
2. Mostrar fides-store.jsx linhas 1079-1114 e fides-contas.jsx 177-200, 813-880
3. (Se MCP disponível) list_tables cards → confirmar closing_day/due_day e
   ausência de coluna de fatura esperada.
→ Reporte output BRUTO e PARE. Aguarde "ok, segue Fase 2".
```
> Fases 2–4 (Edit/Verify/Push) só após D1/D2 decididas e auditoria revisada.

---

## Próximos passos imediatos

1. ~~Decidir D1/D2~~ ✅ resolvidos (D1=a, D2=i).
2. Rodar T0 (auditoria) no executor com o prompt-mold acima.
3. Executar T1→T4+T6 (entrega mínima), validar no iOS, então T5 (sincronia), T7.
