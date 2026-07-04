# Phase 10: Correção fatura cartão + hardening de importação - Research

**Researched:** 2026-07-04
**Domain:** Lógica de data/ciclo de fatura de cartão (client-side) + hardening de importação CSV/OFX (client-side) — SPA React via Babel-standalone, sem backend a alterar
**Confidence:** HIGH

## Summary

Esta fase é 100% client-side (`assets/*.jsx`) — nenhum ALTER de schema é necessário. O dado no banco já está correto (D-01 confirmado por leitura direta do código); os dois bugs são de **lógica de exibição/gravação no cliente**.

**FAT-01** tem causa raiz já isolada com precisão cirúrgica: `faturasPorCartao`/`faturasPorCartaoCompleto` (os `useMemo` que agrupam transações por fatura) **já usam a convenção correta** ("mês da fatura = mês em que fecha", via `mesFaturaFor`). O bug vive exclusivamente dentro dos `.map()` de `faturasDoCartao` (linhas 1265-1293) e `faturasDoCartaoCompleto` (linhas 1334-1365) em `assets/fides-store.jsx`, que **redemonstram** `mesF` com uma fórmula divergente (`if (diaF > diaV) mesF = mes - 1`) só para derivar `dtFechamento`/`dtVencimento`. O fix é: parar de recalcular `mesF` e aplicar a fórmula D-03 diretamente sobre o `mes` (0-based) que já vem certo do `mesFatura` do grupo. Os dois únicos consumidores de `dtFechamento`/`dtVencimento`/`status` são pontos de exibição em `assets/fides-contas.jsx` (card de fatura + modal de pagamento) — nenhum efeito colateral em dinheiro/pagamento.

**IMP-01/IMP-02** — o import atual (`handleImport`, `fides-transacoes.jsx:554`) grava linha a linha via `addTransaction`, sem preview, sem dedupe, forçando `mes: selectedMonth` (CSV) e resolvendo conta só por nome exato contra `accounts` (nunca contra `cards`) — por isso toda transação de cartão importada cai numa conta corrente aleatória com `card_id` nulo. **Achado-chave:** o `EditTxModal` (mesmo arquivo, `handleSave`, comentário `FIX-EDIT-MES`) já resolve exatamente esses dois problemas para edição manual — toggle Conta/Cartão + recálculo explícito de `mes` via `mesFaturaFor(dd/mm, card, yr)`. Esse é o padrão a replicar no modal de preview do import, não uma solução nova.

**UX-03/UX-04** têm mecanismos prontos para reaproveitar: o filtro por conta/cartão já existe (`advFilters.contasSelected` + `toggleAllCards` no `TxAdvFiltersModal`) — falta só um atalho de 1 clique no masthead. O `Donut` (`fides-charts.jsx`) já suporta `onActiveSlice` e o padrão de "centro do donut" dinâmico já está implementado em `DashboardStudio` (`fides-studio.jsx:1005-1017`) — só não foi conectado no Donut do modo Período (`fides-transacoes.jsx:867-868`, que roda sem `onActiveSlice` e sem `.fds-donut-center`). O bug "nem toda cor tem barra" é causado por `CategoryChart` truncar em top-7 (`fides-charts.jsx:256`) enquanto o `Donut` desenha todas as fatias — mismatch de truncamento, não bug de dado.

**Primary recommendation:** Fase única, sem novas dependências, tocando somente `assets/fides-store.jsx`, `assets/fides-transacoes.jsx` e `assets/fides-contas.jsx` (leitura, sem edição esperada). Onda 1 (FAT-01) é a menor e mais isolada — um fix de ~15 linhas em 2 funções gêmeas, ideal para extrair um helper compartilhado `computeFaturaDates(mesFatura, card)` para nunca mais divergir. Onda 2 (import) é a mais arriscada — envolve um modal novo, mas reaproveita 100% dos padrões de UI/estado já existentes no próprio arquivo. Onda 3 (UX) é puramente aditiva sobre componentes já preparados para isso.

<phase_requirements>
## Phase Requirements

| ID | Descrição | Suporte da pesquisa |
|----|-----------|----------------------|
| FAT-01 | Fatura de cartão exibe fechamento/vencimento corretos para qualquer config. de dias (incl. `closing_day > due_day`), sem regressão para `closing_day < due_day` | Causa raiz isolada em `faturasDoCartao`/`faturasDoCartaoCompleto` (fides-store.jsx). Fórmula D-03 verificada contra caso Bradesco e caso de regressão (ver `## Common Pitfalls` e `## Code Examples`). Consumidores mapeados (fides-contas.jsx) — só exibição, sem side-effect financeiro. |
| IMP-01 | Import CSV/OFX abre modal de preview com seleção e exige confirmação; cancelar não grava nada | Fluxo atual de `handleImport` mapeado linha a linha. Padrão de checklist reaproveitável já existe em `PagarFaturaModal` (fides-contas.jsx, `toggle`/`toggleAll`/`pfm-checkbox`). Shell de modal reaproveitável: `.fds-tx-adv-backdrop`/`.fds-tx-adv-sheet` ou `.fds-modal-backdrop`/`.fds-modal`. |
| IMP-02 | Dedupe normalizado contra existente; mês/fatura correto por linha; `card_id` resolvido quando destino é cartão | Padrão de resolução conta/cartão + recálculo de mês **já implementado** em `EditTxModal.handleSave` (`FIX-EDIT-MES`, fides-transacoes.jsx:1299-1320) — replicar, não reinventar. `addTransactions` (bulk insert, fides-store.jsx:411) já existe para gravar a seleção confirmada de uma vez. |
| UX-03 | Botão "Cartão" no masthead filtra crédito sem abrir Filtros avançados | Mecanismo de filtro já existe: `advFilters.contasSelected` + `toggleAllCards()` (já implementado dentro do `TxAdvFiltersModal`, fides-transacoes.jsx:126-141). Só falta expor um atalho fora do modal. |
| UX-04 | Modo Período: toda categoria da legenda tem barra; valor por categoria no hover/tap | Bug de truncamento identificado (`CategoryChart` corta em top-7, `Donut` não corta). Padrão de hover/tap dinâmico já implementado em `DashboardStudio` (`Donut onActiveSlice` + `.fds-donut-center` condicional) — replicar no Donut do modo Período. |

</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Escopo e entrega**
- **D-01:** Fase ÚNICA (não dividir em 10a/10b/10c), organizada em ondas por prioridade. Onda 1 = FAT-01 (fix + regressão). Onda 2 = import IMP-01/IMP-02. Onda 3 = UX-03/UX-04. Entrega P1 primeiro, sem overhead de sub-fases.

**FAT-01 — convenção de fatura**
- **D-02:** "Mês da fatura" = **mês em que FECHA** vira a única fonte da verdade. Alinhar `faturasDoCartao`/`faturasDoCartaoCompleto` (assets/fides-store.jsx) à convenção já usada por `mesFaturaFor` (assets/fides-data.jsx). Remover o branch `if (diaF > diaV) mesF = mes - 1`.
- **D-03:** Datas derivadas da convenção: `dtFechamento = Date(ano, mes, diaF)`; `dtVencimento = diaV >= diaF ? Date(ano, mes, diaV) : Date(ano, mes+1, diaV)`. Para a fatura "2026-07" do Bradesco → fecha 19/07 · vence 01/08 (não vence 01/07/vencida).
- **D-04:** Card da fatura exibe as DUAS datas + status explícito: formato `fecha DD/MM · vence DD/MM · <status>` (aberta/paga/vencida), como no success criteria. Fatura de junho paga permanece paga.
- **D-05:** Regressão obrigatória: cartão com `closing_day < due_day` (fecha e vence no mesmo mês) continua com datas corretas — o fix não pode inverter esse caso. É um must_have de verificação.

**IMP-01 — preview/seleção/confirmação**
- **D-06:** Import abre um modal de preview com as linhas detectadas antes de gravar qualquer coisa. Confirmação obrigatória; **cancelar não grava nada**.
- **D-07:** Linhas NOVAS (não-duplicadas) vêm **marcadas por default** — importar tudo em 1 confirmação. Usuário pode desmarcar individualmente.
- **D-08:** Linhas detectadas como duplicatas aparecem no preview **desmarcadas e com marca visual** ("já importada"). Não ocultar — transparência sobre por que N linhas não serão importadas. Usuário pode forçar marcando manualmente.

**IMP-02 — dedupe, mês/fatura, card_id**
- **D-09:** Chave de dedupe = `description` + `value` + `date`, comparação **normalizada**: description com trim + lowercase + colapso de espaços; value em centavos (inteiro); date pelo dia `YYYY-MM-DD`.
- **D-10:** Janela de data = **mesmo dia exato** (sem tolerância ±1 dia). Determinístico; casa com o incidente real (reimport do próprio CSV) e minimiza falso-positivo que esconderia tx legítima.
- **D-11:** Cada linha usa o `mes`/fatura correto **por data da própria linha** (parar de forçar `selectedMonth` — bug em fides-transacoes.jsx:612).
- **D-12:** Resolução de conta/`card_id` via **seletor de conta no preview**: o preview oferece dropdown para o usuário escolher a conta/cartão destino (por linha e/ou global). Quando a conta destino for do tipo cartão, gravar `card_id` (não deixar `account_id` com card_id null). Corrige o bug de mapeamento por nome.

### Claude's Discretion
- **UX-03** (botão "Cartão" no masthead) e **UX-04** (modo Período: mapeamento cor↔categoria + valor por categoria no hover/tap) não foram discutidos em detalhe — implementação a critério do planner/executor, seguindo os padrões visuais existentes (masthead de filtros "Conta"/"Valor"; centro do donut do modo Mês único como referência para o hover/tap do modo Período).
- Colunas exatas exibidas no modal de preview (data/descrição/valor/conta/categoria) — critério do Claude, desde que suficientes para o usuário decidir o que importar.

### Deferred Ideas (OUT OF SCOPE)
None — discussão ficou dentro do escopo da fase. (Mapeamento de colunas customizado no import, novos formatos e redesign de fatura permanecem fora de escopo; abrir fase própria se surgirem.)
</user_constraints>

## Project Constraints (from CLAUDE.md)

| Diretiva | Implicação para esta fase |
|----------|----------------------------|
| Frontend sem bundler (Babel-standalone no browser) | Nenhuma lib npm nova pode ser usada a menos que via `<script>` CDN — e mesmo isso está fora de escopo aqui. Parser CSV/OFX continua vanilla/regex. |
| Schema real vive no banco; `supabase/*.sql` pode estar desatualizado | Confirmado via leitura de `supabase/schema.sql`/`derived-balance.sql` que `card_id`, `account_id`, `closing_day`, `due_day`, `is_transfer`, `settled` já existem — nenhum ALTER necessário. |
| `api/assistant.js` é READ-only | Não relevante — assistente não é tocado nesta fase. |
| Domínio de cartão é caminho sensível → rodar revisão de segurança/database ao tocar `api/`/`supabase/` | Esta fase **não toca** `api/` nem `supabase/*.sql` (é client-side puro). Ainda assim, por prudência (D-12 muda como `card_id`/`account_id` são gravados), recomenda-se rodar `database-reviewer` sobre o diff de `txToRow`-equivalente na tela de import antes de commitar (ver `## Security Domain`). |
| Movimentação vs despesa (`is_transfer`) | Import não seta `is_transfer` hoje (correto — CSV/OFX só descreve despesas/receitas normais, nunca pagamento de fatura). Preservar esse comportamento; não inventar heurística de auto-detecção de pagamento de fatura nesta fase (fora de escopo). |
| `fides-ui` (`ConfirmDialog`/`Toast`/`useConfirm`) — evitar `confirm()`/`alert()` | `handleImport` atual já usa `window.FidesUI.toast.success/error` (nenhum `alert()` residual encontrado). O modal de preview novo deve seguir o mesmo padrão: toast para o resumo pós-confirmação, shell de modal customizado (não `ConfirmDialog` puro, que não suporta tabela de linhas) para a UI de seleção. |
| Rules of Hooks (já causou bug na Phase 07) | Modal de preview terá lista de tamanho variável (N linhas do CSV/OFX) — todo `useState`/`useMemo`/`useCallback` deve ficar incondicional no topo do componente, nunca dentro de `.map()` ou atrás de `if`. Ver `## Common Pitfalls`. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cálculo de fechamento/vencimento/status da fatura (FAT-01) | Browser/Client | — | Dado (`transactions.date`, `cards.closing_day/due_day`) já correto no Postgres; o bug é 100% na derivação client-side (`fides-store.jsx`). Nenhuma query nova. |
| Exibição do card de fatura + modal de pagamento | Browser/Client | — | `fides-contas.jsx` — puro consumo de `dtFechamento`/`dtVencimento`/`status`, sem lógica de negócio adicional. |
| Parsing de arquivo CSV/OFX | Browser/Client | — | `FileReader` + regex no próprio browser, sem upload a servidor. Mantido como está (fora de escopo trocar parser). |
| Preview/seleção/confirmação de import (IMP-01) | Browser/Client | — | Novo modal React, estado local (`useState`), sem round-trip a servidor até a confirmação final. |
| Dedupe normalizado (IMP-02, D-09/D-10) | Browser/Client | Database (indireto) | Comparação roda em memória contra `transactions` já carregado (store), sem query nova. RLS do Postgres já garante que `transactions` só contém dados do usuário logado — pré-condição que o dedupe assume. |
| Resolução `account_id`/`card_id` na gravação (D-12) | Browser/Client | Database | Client resolve o destino (dropdown) e monta o payload; `addTransactions`/`txToRow` (já existentes) persistem `account_id` xor `card_id` conforme schema (`supabase/schema.sql:67-68`, ambos nullable, um dos dois preenchido). |
| Botão rápido "Cartão" no masthead (UX-03) | Browser/Client | — | Reutiliza estado de filtro já existente (`advFilters.contasSelected`), sem nova fonte de dado. |
| Valor por categoria no hover/tap — modo Período (UX-04) | Browser/Client | — | `Donut` já expõe `onActiveSlice`; é puramente um wire-up de UI sobre dado já computado (`rangeSpend`). |

## Standard Stack

### Core

Nenhuma biblioteca nova é necessária ou recomendada. A stack desta fase é 100% o que já existe:

| Tecnologia | Versão | Uso nesta fase |
|------------|--------|-----------------|
| React (UMD, via Babel-standalone) | 18.3.1 `[VERIFIED: index.html script tag]` | Modal de preview, wiring de hover/tap, toggle de filtro. |
| `FileReader` (Web API nativa) | — | Já usado por `handleImport`; sem mudança de parser. |
| `window.FidesUI` (toast/useModalClose) | interno | Reaproveitar para toasts de resumo e animação de abrir/fechar do novo modal. |

### Alternativas Consideradas

| Ao invés de | Poderia usar | Tradeoff |
|-------------|---------------|----------|
| Parser CSV/OFX regex atual (hand-rolled) | PapaParse / ofx-js via CDN `<script>` | **Rejeitado nesta fase** — fora de escopo explícito no CONTEXT.md ("qualquer capacidade nova de import... está fora de escopo") e violaria a restrição de zero-bundler sem justificativa forte. Manter parser atual, só envelopar com preview/dedupe. |
| Dedupe client-side (Set em memória) | RPC Postgres de dedupe server-side | Client-side é suficiente no volume atual do app (finanças pessoais, centenas/poucos milhares de transações carregadas de uma vez pelo `refreshData`). RPC adicionaria round-trip e superfície de API nova sem necessidade — despriorizado. |

**Instalação:** nenhuma — zero pacotes novos.

## Package Legitimacy Audit

**Não aplicável.** Esta fase não introduz nenhuma dependência externa (nenhum `npm install`, nenhum novo `<script src="https://...">`). Todo o trabalho é edição de `.jsx` já existente. Gate de legitimidade de pacotes pulado por não haver pacotes a auditar.

## Architecture Patterns

### Diagrama — Onda 1 (FAT-01)

```
transactions (Postgres, já correto)
        │
        ▼
faturasPorCartao / faturasPorCartaoCompleto  (fides-store.jsx, useMemo)
   agrupa por chave `${cardId}|${mesFaturaFor(t.d, card, yr)}`
   → mesFatura JÁ está correto (convenção "mês que fecha")
        │
        ▼
faturasDoCartao(cardId) / faturasDoCartaoCompleto(cardId)   ◄── BUG AQUI
   .map(fat => {
     mes = mesFatura - 1 (0-based)          ✅ correto
     mesF = (diaF > diaV) ? mes - 1 : mes   ❌ diverge da convenção do grupo
     dtFechamento = Date(ano, mesF, diaF)   ❌ resultado: 1 ciclo atrás
     dtVencimento = Date(ano, mes, diaV)    ❌ não avança pro mês seguinte
   })
        │
        ▼
fides-contas.jsx  (único consumidor)
   - card "Fatura de {mês}" → fecha DD/MM · vence DD/MM · status
   - PagarFaturaModal → header "{mês} · vence DD/MM"
   (ambos puramente exibição — payCartaoFatura usa txIds selecionados, não as datas)
```

### Diagrama — Onda 2 (IMP-01/IMP-02)

```
Usuário clica "Importar" (fds-tx-v2-actions)
        │
        ▼
handleImport(fmt)                         ◄── hoje: parse + addTransaction() por linha, sem preview
   FileReader.readAsText
   parse CSV (regex split ';'/',')  ou  OFX (regex <STMTTRN>...)
        │
        ▼  [MUDANÇA DESTA FASE]
Monta lista de linhas parseadas (sem gravar ainda)
        │
        ▼
Para cada linha:
   - normaliza chave dedupe (desc trim+lower+colapso espaço, val em centavos, date YYYY-MM-DD)
   - compara contra Set de chaves de `transactions` (já em memória, useFides())
   - marca isDuplicate (true/false)
        │
        ▼
Abre ImportPreviewModal (novo componente)
   - linhas novas: checkbox marcado por default (D-07)
   - linhas duplicadas: checkbox desmarcado + badge "já importada" (D-08)
   - seletor de conta/cartão destino (global e/ou por linha) — reusa padrão
     "pay: debito|credito" + <select> de EditTxModal/NovaTransacaoModal (D-12)
   - Cancelar → fecha modal, NADA é gravado (D-06)
   - Confirmar → para cada linha marcada:
       acct = conta/cartão escolhido no seletor
       isCard = cardIdSet.has(acct)
       mes = isCard ? mesFaturaFor(dd/mm, card, ano) : `${ano}-${mm}`   (D-11, padrão FIX-EDIT-MES)
       card_id/account_id resolvido no payload (D-12)
        │
        ▼
addTransactions([...linhas selecionadas])   ◄── já existe (fides-store.jsx:411), bulk insert
        │
        ▼
toast.success(`${n} transação(ões) importada(s)`)
```

### Recommended Project Structure

Nenhum arquivo novo é estritamente necessário — tudo cabe nos três arquivos já mapeados no CONTEXT.md:

```
assets/
├── fides-store.jsx       # Onda 1: fix em faturasDoCartao/faturasDoCartaoCompleto
│                          # (opcional, recomendado: extrair computeFaturaDates())
├── fides-transacoes.jsx  # Onda 2: novo componente ImportPreviewModal + handleImport
│                          #         reescrito para parse-then-preview
│                          # Onda 3: botão "Cartão" no masthead + Donut/onActiveSlice
│                          #         no modo Período
└── fides-contas.jsx      # Onda 1: NENHUMA mudança de lógica esperada — só valida
                           #         visualmente que o texto "fecha/vence" ficou certo
```

Se o planner preferir isolar o modal de preview em arquivo próprio (`assets/fides-import.jsx`), é uma escolha válida de organização — mas exige adicionar `<script type="text/babel" src="assets/fides-import.jsx">` em `index.html` **antes** de `fides-transacoes.jsx` (ordem de carregamento importa, ver Pitfall 5) ou expor o componente via `window`. Recomendação: manter no mesmo arquivo (`fides-transacoes.jsx`) para não adicionar essa complexidade — o arquivo já contém `TxAdvFiltersModal` e `EditTxModal` como componentes-irmãos no mesmo módulo.

### Pattern 1: Convenção única de mês-fatura (extrair helper compartilhado)

**What:** Hoje `faturasDoCartao` e `faturasDoCartaoCompleto` duplicam byte-a-byte a lógica de derivar `dtFechamento`/`dtVencimento`/status a partir de `mesFatura` + `card`. É exatamente essa duplicação assimétrica (uma cópia ganhou o branch errado, a outra também, mas ambas divergem do `mesFaturaFor` usado no agrupamento) que causou o bug original.

**When to use:** Ao aplicar o fix D-02/D-03, extrair a lógica comum para uma função pura, chamada pelas duas.

**Example:**
```javascript
// Source: derivado de D-02/D-03 do 10-CONTEXT.md + fides-store.jsx:1265-1293/:1334-1365
// Nova função pura, sem dependência de React — pode viver perto de mesFaturaFor
// em fides-data.jsx OU como helper local no topo de fides-store.jsx.
function computeFaturaDates(mesFatura, card) {
  const [yy, mm] = mesFatura.split('-');
  const ano = parseInt(yy, 10);
  const mes = parseInt(mm, 10) - 1; // 0-based — mês em que a fatura FECHA

  const diaF = parseInt(card.diaFechamento, 10) || 5;
  const diaV = parseInt(card.diaVencimento, 10) || parseInt(card.due, 10) || 10;

  const dtFechamento = new Date(ano, mes, diaF);
  // D-03: vencimento no mesmo mês do fechamento se diaV >= diaF,
  // senão no mês seguinte (cobre o caso Bradesco: fecha 19, vence 1 → mês+1).
  const dtVencimento = diaV >= diaF
    ? new Date(ano, mes, diaV)
    : new Date(ano, mes + 1, diaV);

  return { dtFechamento, dtVencimento };
}
```

Uso dentro de `faturasDoCartao`:
```javascript
const mapped = faturas.map(fat => {
  const { dtFechamento, dtVencimento } = computeFaturaDates(fat.mesFatura, card);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  let status = 'aberta';
  if (hoje > dtVencimento) status = 'vencida';
  else if (hoje >= dtFechamento) status = 'fechada';
  return { ...fat, dtFechamento, dtVencimento, status };
});
```
E de forma idêntica (mais o cálculo de `paga`) em `faturasDoCartaoCompleto`. Isso elimina a possibilidade de as duas funções voltarem a divergir no futuro.

### Pattern 2: Resolução conta/cartão + mês por linha (reaproveitar FIX-EDIT-MES)

**What:** `EditTxModal.handleSave` já resolve — para uma única transação editada — exatamente o par de problemas do import (mês errado + card_id não resolvido). O import precisa do mesmo cálculo, só que em lote.

**When to use:** No confirm do `ImportPreviewModal`, para cada linha selecionada, antes de montar o payload de `addTransactions`.

**Example:**
```javascript
// Source: padrão real já em produção — fides-transacoes.jsx:1299-1320 (EditTxModal.handleSave)
// Replicar por linha no confirm do import:
function resolveRowForImport(row, destAcctId, cards) {
  const cardIdSet = new Set((cards || []).map(c => c.id));
  const isCard = cardIdSet.has(destAcctId);
  let mes = row.mesFromCsv; // fallback: mês calendário da própria data da linha
  if (isCard) {
    const card = cards.find(c => c.id === destAcctId);
    if (card) {
      const mesCalc = window.mesFaturaFor(row.d, card, row.ano); // row.d = 'dd/mm'
      if (mesCalc) mes = mesCalc;
    }
  }
  return { ...row, acct: destAcctId, mes };
}
```

### Pattern 3: Checklist de seleção com "selecionar todos" (reaproveitar PagarFaturaModal)

**What:** `PagarFaturaModal` (`fides-contas.jsx`, próximo a `handleRealValueBlur`) já implementa `toggle(id)` / `toggleAll()` sobre um `Set` de ids selecionados, com contagem de `allSelected`/`noneSelected` — exatamente a interação que IMP-01 pede (D-07/D-08).

**Example:**
```javascript
// Source: fides-contas.jsx:209-228 (PagarFaturaModal) — adaptar txId → row index/key
const toggle = (id) => setSelected(prev => {
  const next = new Set(prev);
  next.has(id) ? next.delete(id) : next.add(id);
  return next;
});
const toggleAll = () => {
  if (selected.size === rows.length) setSelected(new Set());
  else setSelected(new Set(rows.map(r => r._key)));
};
```
Diferença para IMP-01: o `Set` inicial não começa vazio nem cheio — começa com **todas as linhas novas marcadas e todas as duplicatas desmarcadas** (D-07/D-08), calculado uma única vez ao abrir o modal (não recalculado a cada render).

### Pattern 4: Donut com hover/tap dinâmico (reaproveitar DashboardStudio)

**What:** `Donut` (`fides-charts.jsx:116`) já aceita `onActiveSlice` e gerencia `activeIdx` internamente. `DashboardStudio` já implementa o "centro dinâmico" — é literalmente a referência que o CONTEXT.md pede para UX-04.

**Example:**
```jsx
// Source: fides-studio.jsx:1005-1017 (DashboardStudio) — replicar no modo Período
// fides-transacoes.jsx, dentro do bloco `{rangeMode && (...)}` que hoje é:
//   <div className="fds-donut-wrap"><Donut data={rangeSpend} size={160} thickness={20}/></div>
// Trocar por:
const [activeSlice, setActiveSlice] = React.useState(null); // topo do componente Transacoes — nunca condicional
const rangeTotal = rangeSpend.reduce((s, d) => s + d.val, 0);
// ...
<div className="fds-donut-wrap">
  <Donut data={rangeSpend} size={160} thickness={20} onActiveSlice={setActiveSlice}/>
  <div className="fds-donut-center">
    {activeSlice ? <>
      <div className="fds-donut-label">{activeSlice.label}</div>
      <div className="fds-donut-value">{fmtBRL(activeSlice.val, { compact: true })}</div>
      <div className="fds-donut-label">{Math.round((activeSlice.val / rangeTotal) * 100)}%</div>
    </> : <>
      <div className="fds-donut-label">Total</div>
      <div className="fds-donut-value">{fmtBRL(rangeTotal, { compact: true })}</div>
    </>}
  </div>
</div>
```
CSS `.fds-donut-center`/`.fds-donut-label`/`.fds-donut-value` já existe em `fides.css:609` — zero CSS novo necessário.

### Pattern 5: Atalho de filtro "Cartão" (reaproveitar toggleAllCards)

**What:** `TxAdvFiltersModal` já tem `toggleAllCards()` — seleciona/deseleciona todos os ids de `cards` dentro de `advFilters.contasSelected`. Um botão no masthead só precisa chamar essa mesma transformação sem abrir o modal.

**Example:**
```jsx
// Source: padrão de fides-transacoes.jsx:126-141 (toggleAllCards do TxAdvFiltersModal),
// exposto como ação direta no masthead (seção "fds-tx-v2-filters" ou "fds-tx-v2-chips")
const cardIds = safeCards.map(c => c.id);
const allCardsActive = cardIds.length > 0 && cardIds.every(id => advFilters.contasSelected.includes(id));
<button type="button"
        className={'fds-chip' + (allCardsActive ? ' on' : '')}
        onClick={() => {
          setAdvFilters(prev => ({
            ...prev,
            contasSelected: allCardsActive
              ? prev.contasSelected.filter(id => !cardIds.includes(id))
              : Array.from(new Set([...prev.contasSelected, ...cardIds])),
          }));
        }}>
  <Icon.Card size={13}/> Cartão
</button>
```
Local de inserção recomendado: dentro de `fds-tx-v2-chips` (seção `tx-filtros`, ao lado de Todas/Receitas/Despesas/Pendentes) — é a linha de chips de filtro efetivamente ativa hoje (ver `Open Questions` sobre a nomenclatura "Conta"/"Valor" do CONTEXT.md).

### Anti-Patterns to Avoid
- **Recalcular `mesF` dentro de `faturasDoCartao*`:** o grupo (`faturasPorCartao`) já calculou o mês correto via `mesFaturaFor`. Qualquer nova derivação de mês dentro do `.map()` de exibição é, por definição, uma segunda fonte de verdade — é isso que causou o bug. O `.map()` só deve **usar** `fat.mesFatura`, nunca recalculá-lo.
- **Forçar `mes`/`selectedMonth` no import:** qualquer `mes: selectedMonth` fixo (o bug de `fides-transacoes.jsx:612`) ignora a data real da linha. Cada linha deve calcular seu próprio mês a partir da própria data + conta/cartão de destino.
- **Resolver conta só por nome (`accounts.find(a => a.name === ...)`):** nunca inclui `cards`, e nomes duplicados/variantes (acentos, maiúsculas) quebram silenciosamente, caindo no fallback `safeAccounts[0]`. Substituir por seleção explícita do usuário (D-12), não por heurística de nome.
- **Usar `confirm()`/`alert()` nativos no fluxo de import:** já evitado hoje (usa `toast`); não reintroduzir ao construir o modal de confirmação.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Parser de CSV/OFX mais robusto | Parser CSV RFC-4180 completo ou lib de OFX | Manter o parser regex atual | Fora de escopo explícito (CONTEXT.md) — qualquer capacidade nova de parsing é uma fase própria. |
| Checklist de seleção múltipla com "selecionar todos" | Componente novo do zero | `toggle`/`toggleAll` de `PagarFaturaModal` (Pattern 3) | Já testado em produção, mesmo domínio (faturas), mesmo shape de interação. |
| Center-label dinâmico de donut on hover/tap | Novo componente de tooltip/label flutuante | `Donut.onActiveSlice` + `.fds-donut-center` (Pattern 4) | Já existe, já estilizado, já usado em `DashboardStudio`. |
| Dedupe de transações | RPC Postgres, índice único parcial, ou lib de fuzzy-matching | Set normalizado em memória sobre `transactions` (já carregado pelo store) | Volume de dados do app (finanças pessoais) não justifica ida ao servidor; o dado já está 100% no cliente via `refreshData`. |
| Recalcular mês de fatura por linha | Nova função de cálculo de data | `mesFaturaFor` (já existe, já é a fonte de verdade) + padrão `FIX-EDIT-MES` do `EditTxModal` | Já implementado e em produção para o caso de edição manual — import é o mesmo problema em lote. |
| Modal de confirmação com bloqueio de fechar-sem-confirmar | Novo sistema de modal | Shell `.fds-modal`/`.fds-tx-adv-sheet` + `useModalClose` (fides-ui.jsx) | Animação de abrir/fechar e a11y (Escape/backdrop) já resolvidos. |

**Key insight:** Todo comportamento que IMP-01/IMP-02 pedem já tem um análogo funcionando em produção neste mesmo arquivo (`fides-transacoes.jsx`) ou no arquivo irmão (`fides-contas.jsx`). O risco desta fase não é "não saber como construir" — é **não copiar o padrão certo** e reintroduzir uma segunda implementação divergente (o mesmo tipo de erro que causou o bug FAT-01 original).

## Common Pitfalls

### Pitfall 1: Corrigir só uma das duas funções gêmeas
**What goes wrong:** `faturasDoCartao` (usada para decidir quais faturas são pagáveis) e `faturasDoCartaoCompleto` (usada para exibição, inclui pagas) têm o **mesmo bug duplicado** em blocos de código quase idênticos. É fácil corrigir uma e esquecer a outra.
**Why it happens:** Duplicação de lógica sem abstração compartilhada (é literalmente a causa raiz do bug original).
**How to avoid:** Extrair `computeFaturaDates(mesFatura, card)` (Pattern 1) e chamar dos dois lugares — impossível divergir de novo.
**Warning signs:** Se o card de fatura mostrar data certa mas o modal de "Pagar faturas" mostrar data errada (ou vice-versa), é sinal de fix parcial.

### Pitfall 2: Regressão no caso `closing_day < due_day` (D-05)
**What goes wrong:** A fórmula D-03 (`diaV >= diaF ? mesmo mês : mês seguinte`) precisa ser testada explicitamente contra um cartão onde fecha e vence no mesmo mês (ex.: fecha dia 5, vence dia 15 — como o cartão mock `nu` em `fides-data.jsx:40-41`). Se o fix for feito "de olho" só no caso Bradesco, é fácil inverter esse ramo.
**Why it happens:** O código antigo tinha DOIS branches (`diaF > diaV` para fechamento, comparação direta para vencimento) que coincidentemente funcionavam para o caso comum e quebravam só no caso Bradesco. A tentação é "consertar só o branch que quebrou".
**How to avoid:** Testar os dois casos lado a lado antes de considerar o fix pronto: cartão `nu` (fecha 5/vence 15) e cartão `inter` (fecha 22/vence 2) já existem como mocks prontos em `fides-data.jsx` — usar ambos como fixtures de verificação.
**Warning signs:** Card mock `nu` (fecha 5, vence 15) passando a mostrar vencimento no mês errado após o fix.

### Pitfall 3: Rules of Hooks no modal de preview (lista de tamanho variável)
**What goes wrong:** O modal de preview terá uma lista de N linhas (tamanho dinâmico vindo do arquivo importado) com checkbox por linha. É tentador declarar um `useState` dentro do `.map()` de renderização de linhas, ou colocar um hook depois de um `if (rows.length === 0) return null`.
**Why it happens:** Já aconteceu nesta mesma codebase — `MetasStudio` (Phase 07) tinha exatamente esse padrão (hooks declarados depois de um early-return condicional), documentado em `.planning/STATE.md` (fix: "moved MetasStudio useState declarations above the isEmpty early return").
**How to avoid:** Todo estado de seleção deve ser **um único** `Set`/objeto no componente pai do modal (chave = índice ou id estável da linha), nunca um hook por linha. Nenhum `return null` condicional antes de todos os hooks estarem declarados.
**Warning signs:** Warning do React "Rendered more hooks than during the previous render" no console ao abrir/filtrar o preview.

### Pitfall 4: `CategoryChart` trunca em top-7, `Donut` não trunca (causa raiz de UX-04 item 1)
**What goes wrong:** `CategoryChart` (`fides-charts.jsx:256`, `sorted.slice(0, 7)`) só desenha as 7 maiores categorias; `Donut` (`fides-charts.jsx:124`, `data.map(...)`) desenha TODAS. Se houver 8+ categorias com gasto no período, o Donut mostra uma fatia (cor) que não aparece em nenhuma barra do `CategoryChart` — exatamente o sintoma reportado ("nem toda cor da legenda tem barra representada").
**Why it happens:** `CategoryChart` foi desenhado para caber num espaço fixo (`height`) sem virar uma lista rolável, então trunca; ninguém sincronizou esse limite com o `Donut`.
**How to avoid:** Ou (a) aplicar o mesmo top-N + agrupamento "outros" em ambos os componentes, ou (b) adicionar uma legenda textual completa ao lado do Donut (como `fds-cats-list` em `DashboardStudio`/`CategoriesCard`) que já lista todas as categorias, tornando o truncamento do `CategoryChart` irrelevante para a legenda. Opção (b) é mais barata e não altera `CategoryChart` (menor risco).
**Warning signs:** Período com muitas categorias pequenas (ex.: 3+ meses agregados) mostrando fatias sem barra correspondente.

### Pitfall 5: Ordem de carregamento dos scripts (`index.html`)
**What goes wrong:** `assets/fides-data.jsx` (define `mesFaturaFor`) carrega **antes** de `assets/fides-store.jsx`, que carrega **antes** de `assets/fides-transacoes.jsx` e `assets/fides-contas.jsx`. Se o planner decidir extrair `computeFaturaDates` (Pattern 1) para um arquivo novo ou mover para depois de onde é usado, a função vira `undefined` em runtime (sem erro de build, porque não há build — só um erro em runtime no browser).
**Why it happens:** Scripts `type="text/babel"` sem `type="module"` compartilham escopo global na ordem em que aparecem no `<script>` tag; não há resolução de import/export.
**How to avoid:** Se extrair `computeFaturaDates`, colocá-la em `fides-data.jsx` (ao lado de `mesFaturaFor`, que já carrega antes de `fides-store.jsx`) ou como função local dentro do próprio `fides-store.jsx` — nunca em um arquivo que carrega depois de `fides-store.jsx`.
**Warning signs:** `ReferenceError: computeFaturaDates is not defined` no console do browser.

### Pitfall 6: Confiar só no `txToRow` (modo `live`) para corrigir o mês do import
**What goes wrong:** `txToRow` (fides-store.jsx:192-225) já recalcula `month` via `mesFaturaFor` automaticamente **quando `tx.acct` já é um card id válido** — mas só roda em modo `live` (`addTransaction`/`addTransactions` com `mode === 'live'`). Em modo `mock` (sem Supabase/usuário deslogado), essa correção nunca acontece porque `ensureMes` não conhece cartões.
**Why it happens:** O app tem dois caminhos de gravação (live via Supabase, mock em memória) e só um deles tem a lógica de fatura embutida.
**How to avoid:** Seguindo D-11 ("cada linha usa o mês/fatura correto"), calcular `mes` explicitamente na hora da confirmação do import (Pattern 2), **antes** de chamar `addTransactions` — não depender do fallback implícito de `txToRow`. Isso garante correção em ambos os modos e documenta a intenção no próprio código do import (mais legível que depender de um efeito colateral de outra função).
**Warning signs:** Import funcionando certo em produção (live) mas errado ao testar localmente sem login (mock).

## Code Examples

### Fix completo de FAT-01 (D-02/D-03) aplicado às duas funções

```javascript
// Source: fides-store.jsx — antes (bug), linhas 1265-1293 e 1334-1365 (duplicado)
const mapped = faturas.map(fat => {
  const [yy, mm] = fat.mesFatura.split('-');
  const ano = parseInt(yy, 10);
  const mes = parseInt(mm, 10) - 1;

  const diaF = parseInt(card.diaFechamento, 10) || 5;
  const diaV = parseInt(card.diaVencimento, 10) || parseInt(card.due, 10) || 10;

  let mesF = mes;
  if (diaF > diaV) {           // ❌ diverge da convenção "mesFatura = mês que fecha"
    mesF = mes - 1;
  }

  const dtFechamento = new Date(ano, mesF, diaF);   // ❌ 1 ciclo atrás quando diaF > diaV
  const dtVencimento = new Date(ano, mes, diaV);     // ❌ nunca avança de mês
  // ...
});
```

```javascript
// Source: aplicando D-02/D-03 + Pattern 1 (helper compartilhado) — depois (fix)
const mapped = faturas.map(fat => {
  const { dtFechamento, dtVencimento } = computeFaturaDates(fat.mesFatura, card);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  let status = 'aberta';
  if (hoje > dtVencimento) status = 'vencida';
  else if (hoje >= dtFechamento) status = 'fechada';
  return { ...fat, dtFechamento, dtVencimento, status };
});
```

**Verificação manual do caso canônico (Bradesco, fecha 19/vence 1):**
`mesFatura = '2026-07'` → `ano=2026, mes=6` (0-based, julho) → `diaF=19, diaV=1` → `diaV(1) < diaF(19)` → `dtVencimento = new Date(2026, 7, 1)` = **01/08/2026** ✓. `dtFechamento = new Date(2026, 6, 19)` = **19/07/2026** ✓. Bate exatamente com o success criteria do ROADMAP.

**Verificação manual da regressão (cartão mock `nu`, fecha 5/vence 15):**
`mesFatura = '2026-06'` → `ano=2026, mes=5` (junho) → `diaF=5, diaV=15` → `diaV(15) >= diaF(5)` → `dtVencimento = new Date(2026, 5, 15)` = **15/06/2026** ✓ (mesmo mês, não regride). `dtFechamento = new Date(2026, 5, 5)` = **05/06/2026** ✓.

**Verificação de virada de ano:** cartão fecha 20/vence 5, `mesFatura = '2026-12'` → `mes = 11` (dezembro, 0-based) → `diaV(5) < diaF(20)` → `dtVencimento = new Date(2026, 12, 5)`. `new Date` normaliza mês 12 automaticamente para janeiro do ano seguinte — resultado real: **05/01/2027** ✓ (comportamento nativo do `Date`, não precisa de tratamento manual de overflow).

### Import: parse-then-preview (esqueleto)

```javascript
// Source: reestruturação de handleImport (fides-transacoes.jsx:554) para IMP-01
const handleImport = React.useCallback((fmt = 'csv') => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = fmt === 'ofx' ? '.ofx,.qfx' : '.csv,text/csv';
  input.onchange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const parsedRows = fmt === 'ofx' ? parseOfx(text) : parseCsv(text); // lógica de parse existente, extraída
      if (parsedRows.length === 0) {
        window.FidesUI.toast.error('Nenhuma transação encontrada no arquivo.');
        return;
      }
      const existingKeys = buildDedupeIndex(transactions); // Set<string>, D-09
      const rowsWithFlags = parsedRows.map(r => ({
        ...r,
        _key: dedupeKey(r),                       // D-09: normalizado
        _isDuplicate: existingKeys.has(dedupeKey(r)),
      }));
      setImportPreview({ rows: rowsWithFlags, fmt }); // abre o modal — NADA gravado ainda
    };
    reader.readAsText(file, 'UTF-8');
  };
  input.click();
}, [transactions]);
```

### Chave de dedupe normalizada (D-09)

```javascript
// Source: D-09 do 10-CONTEXT.md
function dedupeKey(tx) {
  const desc = String(tx.desc || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const cents = Math.round(Math.abs(Number(tx.val)) * 100); // valor em centavos, inteiro
  const day = String(tx.date || '').slice(0, 10); // YYYY-MM-DD — dia exato (D-10, sem tolerância)
  return `${desc}|${cents}|${day}`;
}

function buildDedupeIndex(transactions) {
  return new Set(transactions.map(dedupeKey));
}
```

**Nota:** transações vindas do store (`normalizeTx`) já têm `date` no formato `YYYY-MM-DD` (live) — para linhas recém-parseadas do CSV/OFX, montar a mesma string (`${yyyy}-${mm}-${dd}`) antes de chamar `dedupeKey`, para garantir que as duas pontas comparam o mesmo formato.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| `faturasDoCartao*` recalculava `mesF` internamente com heurística própria | `mesFaturaFor` como única fonte de verdade para "mês da fatura", consumida (não recalculada) por todo o resto do código | Fase 10 (esta fase) | Elimina a classe de bug "duas convenções de mês coexistindo" — qualquer novo consumidor de fatura deve ler `mesFatura` do grupo, nunca redemonstrar. |
| Import grava direto, sem preview | Import sempre passa por preview + confirmação explícita | Fase 10 (esta fase) | Padrão a manter para qualquer import futuro (novos formatos, mapeamento de colunas — fora de escopo agora, mas herdam esse contrato). |

**Deprecated/outdated:**
- O branch `if (diaF > diaV) mesF = mes - 1` deve ser removido por completo — não é um caso de compatibilidade a preservar, é o próprio bug.
- `mes: selectedMonth` forçado no import (`fides-transacoes.jsx:612`) deve ser removido — substituído pelo cálculo por linha (D-11).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|-----------------|
| A1 | O "masthead de filtros 'Conta'/'Valor'" citado no CONTEXT.md como referência de posicionamento para o botão "Cartão" (UX-03) não existe literalmente como filtro — o mais próximo são os pills "Organizar por" (`data/categoria/conta/valor`, que são de **ordenação**, não filtro) e a linha `fds-tx-v2-chips` (Todas/Receitas/Despesas/Pendentes + Filtros avançados), que É o filtro efetivamente ativo hoje via `advFilters`/`filterType`. Esta pesquisa recomenda inserir o botão "Cartão" em `fds-tx-v2-chips`. `[ASSUMED]` | Architecture Patterns (Pattern 5), Common Pitfalls | Baixo — é polish (P3/Claude's Discretion). Se o planner/executor preferir outro local visual, o `toggleAllCards`-equivalente funciona igual em qualquer container; só muda o JSX de posicionamento, não a lógica. |
| A2 | Nenhum outro consumidor de `dtFechamento`/`dtVencimento`/`faturasDoCartao*` existe além de `fides-contas.jsx` (confirmado por grep em todo `assets/`, `api/`) — logo o fix de FAT-01 não tem side-effect fora da exibição. `[VERIFIED: grep no repositório]` | Summary, Architectural Responsibility Map | Baixo-médio — se um consumidor não-óbvio existir (ex.: dentro de uma string de prompt do assistente IA montada dinamicamente), o grep léxico não pegaria referências indiretas via `window[...]`. Recomenda-se ao executor rodar o mesmo grep antes de finalizar, como smoke-check. |
| A3 | O volume de transações carregado em memória pelo store (`transactions`) é pequeno o suficiente (finanças pessoais, uso individual) para que um dedupe client-side em `Set` seja performático sem paginação/streaming. `[ASSUMED]` | Don't Hand-Roll, Standard Stack | Baixo — mesmo com milhares de linhas, um `Set` de strings é O(1) por lookup; risco só se o usuário tiver dezenas de milhares de transações, o que é atípico para o domínio do produto. |

**Se esta tabela estivesse vazia:** não estaria — as 3 entradas acima precisam de atenção do planner (A1 é a única com decisão de posicionamento em aberto; A2/A3 são baixo risco e só pedem um smoke-check).

## Open Questions (RESOLVED — resolvidas durante o planejamento da Fase 10)

> Q1 resolvida: `10-03-PLAN.md` posiciona o chip "Cartão" em `fds-tx-v2-chips`. Q2 resolvida: `10-03-PLAN.md` usa a legenda textual completa `fds-cats-list` (recomendação b), corrigindo o mismatch de truncamento top-7 entre `Donut` e `CategoryChart`.

1. **Onde exatamente inserir o botão "Cartão" no masthead (UX-03)?**
   - O que sabemos: o mecanismo de filtro (`advFilters.contasSelected` + `toggleAllCards`) já existe e funciona; a linha de chips ativa hoje é `fds-tx-v2-chips` (Todas/Receitas/Despesas/Pendentes).
   - O que é incerto: o CONTEXT.md menciona "filtros 'Conta'/'Valor'" que não correspondem 1:1 a nenhum elemento visual atual (ver Assumption A1).
   - Recommendation: planner decide o posicionamento exato durante o planejamento visual da onda 3 (é discretion do Claude por design, D-04 do CONTEXT.md); a lógica de toggle já está pronta independente de onde o botão for colocado.

2. **UX-04 item 1 ("nem toda cor tem barra") deve ser resolvido igualando os top-N de `Donut` e `CategoryChart`, ou adicionando uma legenda textual completa?**
   - O que sabemos: causa raiz é truncamento assimétrico (`CategoryChart` corta em 7, `Donut` não corta).
   - O que é incerto: qual solução visual o usuário prefere — henüz não decidido em CONTEXT.md (Claude's Discretion).
   - Recommendation: opção (b) do Pitfall 4 (legenda textual completa tipo `fds-cats-list`) é mais barata e replica o padrão já usado em `DashboardStudio`/`CategoriesCard` — recomendação desta pesquisa, mas o planner pode optar por (a) se preferir consistência visual estrita entre os dois gráficos.

## Environment Availability

Não aplicável — fase sem dependências externas novas (sem CLI, sem serviço, sem runtime adicional). Todo o trabalho roda no browser com o stack já carregado via `index.html` (React/Babel-standalone via CDN, já verificados como presentes).

## Validation Architecture

> O projeto não tem framework de teste, bundler nem CI hoje (CLAUDE.md: "Sem bundler/lint/types hoje"). A validação desta fase é necessariamente manual (UAT no app rodando), mas a lógica pura de datas (FAT-01) pode e deve ser verificada de forma automatizável via um script Node standalone, sem precisar de framework.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Nenhum (projeto sem bundler/test runner — CLAUDE.md) |
| Config file | none |
| Quick run command | `node -e "<script standalone de verificação>"` (ver abaixo) para a lógica pura de `computeFaturaDates`; para o resto, manual no browser |
| Full suite command | UAT manual via `/gsd-verify-work 10` (mesmo padrão das fases 07-09) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| FAT-01 | Caso Bradesco (fecha 19/vence 1) exibe "fecha 19/07 · vence 01/08 · aberta" | pure-logic (Node standalone) | `node -e` script isolando `computeFaturaDates('2026-07', {diaFechamento:19, diaVencimento:1})` e comparando contra `new Date(2026,7,1)`/`new Date(2026,6,19)` | ❌ Wave 0 — criar script ad-hoc de verificação (não precisa virar arquivo permanente) |
| FAT-01 (regressão, D-05) | Cartão `closing_day < due_day` (ex.: fecha 5/vence 15) mantém datas no mesmo mês | pure-logic (Node standalone) | mesmo script, segundo caso de fixture | ❌ Wave 0 |
| FAT-01 | Fatura de junho já paga permanece "paga" após o fix | manual (UI) | abrir app, conferir card do cartão Bradesco no mês de junho | — (manual-only, depende de dado real do usuário) |
| IMP-01 | Importar CSV abre preview; cancelar não grava nada | manual (UI) | importar arquivo de teste, clicar Cancelar, conferir que a lista de transações não mudou | — (manual-only, sem test runner) |
| IMP-01 | Confirmar grava só as linhas marcadas | manual (UI) | desmarcar 1 linha, confirmar, conferir contagem de transações importadas | — |
| IMP-02 | Reimportar o mesmo CSV → 0 duplicatas novas | manual (UI), roteiro determinístico | exportar CSV do próprio app, reimportar imediatamente, todas as linhas devem aparecer como duplicata (D-08) e a confirmação deve resultar em 0 gravações novas | — |
| IMP-02 | `card_id` resolvido corretamente quando destino é cartão | manual (UI) + inspeção Supabase | importar linha com destino = cartão, checar via Supabase MCP (`select account_id, card_id from transactions order by created_at desc limit 1`) que `card_id` não é null e `account_id` é null | — |
| UX-03 | Botão "Cartão" filtra só transações de cartão sem abrir Filtros avançados | manual (UI) | clicar botão, conferir lista filtrada e chip "Filtros avançados" continuar sem badge de contagem alterada indevidamente | — |
| UX-04 | Hover/tap no Donut do modo Período mostra categoria + valor | manual (UI) | passar mouse/tocar fatia do donut em modo Período, conferir texto central muda | — |

### Sampling Rate
- **Por task/commit:** rodar o script Node standalone (FAT-01) sempre que `computeFaturaDates`/`faturasDoCartao*` for tocado; para import/UX, smoke visual rápido no app local.
- **Por wave:** ao fechar Onda 1, rodar os dois casos de fixture (Bradesco + regressão) antes de prosseguir para Onda 2. Ao fechar Onda 2, executar o roteiro de reimport determinístico (é o teste de regressão do incidente real das 196 duplicatas).
- **Phase gate:** `/gsd-verify-work 10` cobrindo os 5 success criteria do ROADMAP antes de considerar a fase completa.

### Wave 0 Gaps
- [ ] Script Node ad-hoc para `computeFaturaDates` (2 fixtures: Bradesco e regressão) — não precisa virar arquivo de teste permanente dado que o projeto não tem test runner, mas deve ser executado e seu output colado na verificação da task correspondente.
- [ ] Massa de dados de teste para o roteiro de reimport (D-10): usar o próprio botão "Exportar" do app para gerar o CSV, depois reimportar — não precisa de fixture externa.

## Security Domain

> `security_enforcement` não está desabilitado em `.planning/config.json` → seção obrigatória. CLAUDE.md trata domínio de cartão como caminho sensível, mas esta fase não altera `api/` nem `supabase/*.sql`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V4 Access Control | Indireto | Não alterado — `accounts`/`cards`/`transactions` já chegam ao cliente pré-filtrados por RLS (owner-scoped); o seletor de conta/cartão do preview (D-12) só pode oferecer opções da lista já retornada pelo backend, então não há como o usuário escolher `card_id`/`account_id` de outro usuário via essa tela. |
| V5 Input Validation | Sim | Conteúdo de CSV/OFX é texto arbitrário fornecido pelo usuário. React já escapa texto em JSX por padrão (sem `dangerouslySetInnerHTML` nos componentes tocados) — confirmar que o `ImportPreviewModal` novo renderiza `desc`/`memo` como texto simples (`{row.desc}`), nunca via HTML bruto, para não abrir um vetor de XSS armazenado via descrição maliciosa. |
| V6 Cryptography | Não aplica | Nenhuma mudança de segredo/criptografia nesta fase. |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Duplicação silenciosa de dados financeiros (reimport) | Tampering / integridade de dado | Preview + confirmação explícita + dedupe normalizado (D-06..D-10) — já é a mitigação desta fase. |
| Resolução incorreta de conta/cartão gravando valor na conta errada | Tampering / integridade de dado | Seletor explícito de destino (D-12) em vez de heurística de nome — elimina a classe de bug do incidente original. |
| Stored XSS via descrição de transação importada | Tampering | Garantir que o preview e a listagem final renderizem `desc` como texto React puro (já é o padrão em `fides-transacoes.jsx` hoje — só validar que o componente novo segue o mesmo padrão). |
| Arquivo CSV/OFX extremamente grande travando a aba (DoS local) | Denial of Service (client-side) | Fora de escopo endurecer nesta fase (CONTEXT.md não pede), mas recomenda-se ao executor não introduzir nenhum loop que trave a UI de forma pior que o `handleImport` atual — não é um requisito, é uma nota de cautela. |

**Recomendação prática:** mesmo sem tocar `api/`/`supabase/`, rodar `database-reviewer` (ou revisão manual equivalente) sobre o diff da lógica de resolução `account_id`/`card_id` do import (D-12) antes de commitar, por ser o ponto onde a fase mais se aproxima do domínio sensível de cartão citado no CLAUDE.md — não porque o schema muda, mas porque a fase muda **como o cliente decide** qual `card_id`/`account_id` gravar.

## Sources

### Primary (HIGH confidence)
- Leitura direta do código-fonte: `assets/fides-store.jsx` (linhas 1-225, 190-260, 378-450, 1210-1370), `assets/fides-data.jsx` (linhas 1-90), `assets/fides-transacoes.jsx` (linhas 37-960, 1270-1410), `assets/fides-contas.jsx` (linhas 200-280, 860-990), `assets/fides-charts.jsx` (arquivo completo), `assets/fides-studio.jsx` (linhas 975-1025), `assets/fides-ui.jsx` (arquivo completo), `assets/fides-dashboard.jsx` (linhas 215-268), `index.html` (linhas 118-136), `supabase/schema.sql`, `supabase/derived-balance.sql`, `supabase/fix-delete-transaction.sql`.
- `.planning/phases/09-transacoes-power-tools-analytics/09-FOLLOWUPS.md` — diagnóstico primário do bug FAT-01 e do incidente de import.
- `.planning/phases/10-corre-o-fatura-cart-o-hardening-de-importa-o/10-CONTEXT.md` — decisões travadas D-01..D-12.
- `.planning/ROADMAP.md` §"Phase 10" — success criteria formais.
- `CLAUDE.md` — restrições de stack e convenções do projeto.

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — histórico de decisões de fases anteriores (referência ao bug de Rules of Hooks na Phase 07/MetasStudio, usado como precedente de pitfall).

### Tertiary (LOW confidence)
- Nenhuma — toda a pesquisa desta fase foi feita por leitura direta do código-fonte real do repositório, sem necessidade de busca web (domínio é 100% interno ao projeto, sem dependência de biblioteca externa a validar).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nenhuma lib nova, stack 100% já em produção e lida diretamente.
- Architecture: HIGH — causa raiz de FAT-01 confirmada por leitura de código + verificação aritmética manual dos 3 casos (Bradesco, regressão, virada de ano); padrões de reuso para IMP-01/02/UX-03/04 confirmados como já existentes e funcionando em produção no mesmo arquivo.
- Pitfalls: HIGH — pitfalls derivados de bugs reais já documentados no histórico do projeto (`.planning/STATE.md`) ou de inspeção direta de duplicação de código.

**Research date:** 2026-07-04
**Valid until:** enquanto `assets/fides-store.jsx`, `assets/fides-transacoes.jsx`, `assets/fides-contas.jsx` e `assets/fides-charts.jsx` não sofrerem refactor divergente — não há prazo de validade por "biblioteca desatualizando" (não há libs), só por drift de código-fonte. Recomenda-se re-verificar números de linha citados se muito tempo passar antes do planejamento.
