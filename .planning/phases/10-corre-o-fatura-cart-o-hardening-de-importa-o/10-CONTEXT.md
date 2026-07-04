# Phase 10: Correção fatura cartão + hardening de importação - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Entrega três frentes, sem adicionar capacidade nova:

1. **FAT-01 (P1 — bug de confiança):** corrigir a EXIBIÇÃO de fechamento/vencimento/status da fatura de cartão. O dado no banco já está correto; só a lógica de exibição erra quando `closing_day > due_day` (ex.: Bradesco fecha 19 / vence 1). Inclui regressão obrigatória para `closing_day < due_day`.
2. **IMP-01/02 (P2 — débito):** transformar o import de CSV/OFX de "grava linha a linha sem checagem" em "preview → seleção → confirmação → dedupe", com mês/fatura correto por linha e `card_id` resolvido.
3. **UX-03/04 (P3 — polish):** botão rápido "Cartão" no masthead de Transações; modo Período com todas as categorias representadas e valor por categoria no hover/tap.

**Fora de escopo:** qualquer capacidade nova de import (ex.: mapeamento de colunas customizado, novos formatos), redesign de fatura, ou analytics além do fix pontual do modo Período. Domínio de cartão é sensível — rodar database/security review.

</domain>

<decisions>
## Implementation Decisions

### Escopo e entrega
- **D-01:** Fase ÚNICA (não dividir em 10a/10b/10c), organizada em ondas por prioridade. Onda 1 = FAT-01 (fix + regressão). Onda 2 = import IMP-01/IMP-02. Onda 3 = UX-03/UX-04. Entrega P1 primeiro, sem overhead de sub-fases.

### FAT-01 — convenção de fatura
- **D-02:** "Mês da fatura" = **mês em que FECHA** vira a única fonte da verdade. Alinhar `faturasDoCartao`/`faturasDoCartaoCompleto` (assets/fides-store.jsx) à convenção já usada por `mesFaturaFor` (assets/fides-data.jsx). Remover o branch `if (diaF > diaV) mesF = mes - 1`.
- **D-03:** Datas derivadas da convenção: `dtFechamento = Date(ano, mes, diaF)`; `dtVencimento = diaV >= diaF ? Date(ano, mes, diaV) : Date(ano, mes+1, diaV)`. Para a fatura "2026-07" do Bradesco → fecha 19/07 · vence 01/08 (não vence 01/07/vencida).
- **D-04:** Card da fatura exibe as DUAS datas + status explícito: formato `fecha DD/MM · vence DD/MM · <status>` (aberta/paga/vencida), como no success criteria. Fatura de junho paga permanece paga.
- **D-05:** Regressão obrigatória: cartão com `closing_day < due_day` (fecha e vence no mesmo mês) continua com datas corretas — o fix não pode inverter esse caso. É um must_have de verificação.

### IMP-01 — preview/seleção/confirmação
- **D-06:** Import abre um modal de preview com as linhas detectadas antes de gravar qualquer coisa. Confirmação obrigatória; **cancelar não grava nada**.
- **D-07:** Linhas NOVAS (não-duplicadas) vêm **marcadas por default** — importar tudo em 1 confirmação. Usuário pode desmarcar individualmente.
- **D-08:** Linhas detectadas como duplicatas aparecem no preview **desmarcadas e com marca visual** ("já importada"). Não ocultar — transparência sobre por que N linhas não serão importadas. Usuário pode forçar marcando manualmente.

### IMP-02 — dedupe, mês/fatura, card_id
- **D-09:** Chave de dedupe = `description` + `value` + `date`, comparação **normalizada**: description com trim + lowercase + colapso de espaços; value em centavos (inteiro); date pelo dia `YYYY-MM-DD`.
- **D-10:** Janela de data = **mesmo dia exato** (sem tolerância ±1 dia). Determinístico; casa com o incidente real (reimport do próprio CSV) e minimiza falso-positivo que esconderia tx legítima.
- **D-11:** Cada linha usa o `mes`/fatura correto **por data da própria linha** (parar de forçar `selectedMonth` — bug em fides-transacoes.jsx:612).
- **D-12:** Resolução de conta/`card_id` via **seletor de conta no preview**: o preview oferece dropdown para o usuário escolher a conta/cartão destino (por linha e/ou global). Quando a conta destino for do tipo cartão, gravar `card_id` (não deixar `account_id` com card_id null). Corrige o bug de mapeamento por nome.

### Claude's Discretion
- **UX-03** (botão "Cartão" no masthead) e **UX-04** (modo Período: mapeamento cor↔categoria + valor por categoria no hover/tap) não foram discutidos em detalhe — implementação a critério do planner/executor, seguindo os padrões visuais existentes (masthead de filtros "Conta"/"Valor"; centro do donut do modo Mês único como referência para o hover/tap do modo Período).
- Colunas exatas exibidas no modal de preview (data/descrição/valor/conta/categoria) — critério do Claude, desde que suficientes para o usuário decidir o que importar.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Diagnóstico da fase (fonte primária)
- `.planning/phases/09-transacoes-power-tools-analytics/09-FOLLOWUPS.md` — diagnóstico confirmado do bug FAT-01 (raiz: convenção mês-fatura inconsistente entre `mesFaturaFor` e `faturasDoCartao*`), incidente de import (196 txs duplicadas revertidas via SQL) e itens de UX. Contém o fix proposto.

### Escopo e requisitos
- `.planning/ROADMAP.md` §"Phase 10" — goal, success criteria (5 itens), key files, nota de escopo/split.
- `.planning/REQUIREMENTS.md` — FAT-01, IMP-01, IMP-02, UX-03, UX-04.

### Regras de projeto (domínio sensível)
- `CLAUDE.md` — cartão é caminho sensível: movimentação vs despesa (`is_transfer`), RPCs `pay_card_invoice`/`transfer_funds`; rodar revisão de segurança/database ao tocar em domínio de cartão. React via Babel-standalone → cuidado com Rules of Hooks (já causou bug na Fase 07).

### Arquivos-chave (código a modificar)
- `assets/fides-store.jsx` — `faturasDoCartao` (:1265-1293), `faturasDoCartaoCompleto` (:1334-1365).
- `assets/fides-data.jsx` — `mesFaturaFor` (:52-64), convenção canônica de mês da fatura.
- `assets/fides-transacoes.jsx` — `handleImport` (:554), força `selectedMonth` (:612); masthead de filtros; widget modo Período.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fides-ui` (`ConfirmDialog`/`Toast`/`useConfirm`): usar para a confirmação do import (evitar `confirm()`/`alert()` residuais — ROADMAP B9).
- `mesFaturaFor` (fides-data.jsx): já implementa a convenção "mês que fecha" — é o alvo de unificação, não reescrever.
- Centro do donut do modo Mês único: referência de UX para o valor por categoria no hover/tap do modo Período (UX-04).
- Masthead de filtros "Conta"/"Valor" em fides-transacoes.jsx: padrão para acoplar o botão "Cartão" (UX-03).

### Established Patterns
- Movimentação vs despesa: pagamento de fatura = movimentação (`is_transfer`), não despesa. Import não pode transformar pagamento em despesa.
- Contas de cartão têm `card_id`; o import atual não resolve isso (grava account_id, card_id null) — bug a corrigir.

### Integration Points
- `handleImport` → novo fluxo com modal de preview antes de `addTransaction`.
- `faturasDoCartao*` + `mesFaturaFor` → convergir numa única convenção compartilhada de mês-fatura.

</code_context>

<specifics>
## Specific Ideas

- Caso canônico de validação FAT-01: cartão Bradesco (fecha 19 / vence 1), compras 19/06→11/07, R$ 1.522,98 → deve exibir "fecha 19/07 · vence 01/08 · aberta"; a fatura de junho (settled) permanece paga.
- Caso de regressão FAT-01: cartão com `closing_day < due_day` (fecha e vence no mesmo mês) — datas não podem inverter.
- Incidente de import a prevenir: reimportar o próprio CSV exportado gerou 196 duplicatas; dedupe normalizado + preview desmarcando duplicatas deve reduzir isso a 0 novas gravações ao reimportar o mesmo arquivo.

</specifics>

<deferred>
## Deferred Ideas

None — discussão ficou dentro do escopo da fase. (Mapeamento de colunas customizado no import, novos formatos e redesign de fatura permanecem fora de escopo; abrir fase própria se surgirem.)

</deferred>

---

*Phase: 10-corre-o-fatura-cart-o-hardening-de-importa-o*
*Context gathered: 2026-07-04*
