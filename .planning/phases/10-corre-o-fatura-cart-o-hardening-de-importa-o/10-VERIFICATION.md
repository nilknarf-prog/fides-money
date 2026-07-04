---
phase: 10-corre-o-fatura-cart-o-hardening-de-importa-o
verified: 2026-07-04T21:15:00Z
status: human_needed
score: 12/13 must-haves verified
behavior_unverified: 1
overrides_applied: 0
human_verification:
  - test: "Abrir Contas com o cartão Bradesco (fecha 19 / vence 1) com compras 19/06→11/07"
    expected: "Card exibe 'Fecha 19/07 · Vence 01/08' com status 'Aberta' (não 'Vence 01/07 · Vencida')"
    why_human: "Renderização visual no browser (React via Babel-standalone); lógica de computeFaturaDates já validada por script Node contra o arquivo shipado e o data-flow até fides-contas.jsx (dtFechamento/dtVencimento/status) foi confirmado por leitura de código, mas o pixel final requer o app rodando"
  - test: "Verificar o mesmo cartão Bradesco com a fatura de junho já paga (todas as txs settled)"
    expected: "Status continua exibindo 'Paga' (não reabre para vencida/fechada)"
    why_human: "Precedência paga > vencida/fechada confirmada por leitura de código (fides-store.jsx:1333-1341), mas o rótulo final é renderizado no browser"
  - test: "Conferir um cartão com closing_day < due_day (ex.: Nubank fecha 5 / vence 15, mock CARDS) no card de Contas"
    expected: "Fechamento e vencimento no MESMO mês, sem inversão (regressão D-05)"
    why_human: "Lógica pura validada por script Node; confirmação visual da regressão pendente"
  - test: "Exportar o CSV do próprio app e reimportar imediatamente o mesmo arquivo"
    expected: "Todas as linhas aparecem no preview como 'já importada' e DESMARCADAS; confirmar resulta em 0 novas gravações (contagem de transações inalterada após refresh)"
    why_human: "Comportamento runtime fim-a-fim (parse real + dedupe contra transactions do store + gravação); o próprio PLAN 10-02 marca este item como 'must_have não-inferível' — não verificável estaticamente"
  - test: "Importar um CSV com 1 linha nova + destino = um CARTÃO; confirmar; consultar via Supabase MCP `select account_id, card_id from transactions order by created_at desc limit 1`"
    expected: "card_id não é null; account_id é null"
    why_human: "Requer gravação real em Supabase (modo live); a lógica de resolveRowForImport/txToRow foi confirmada por leitura de código, mas a gravação real não foi exercitada"
  - test: "Testar Cancelar num import com linhas novas (antes de confirmar)"
    expected: "Nada é gravado"
    why_human: "Confirmação de runtime de que nenhum addTransactions é chamado no caminho de cancelamento — o código confirma isso estaticamente (onCancel só chama setImportPreview(null)), mas o item consta como checkpoint humano no PLAN"
  - test: "Na tela de Transações, clicar o chip 'Cartão'"
    expected: "Lista mostra só transações de crédito (cartões); chip fica com estado 'on'; modal de Filtros avançados NÃO abre; clicar de novo desliga"
    why_human: "Confirmação visual de interação de UI; data-flow (advFilters.contasSelected → filtered) confirmado por leitura de código"
  - test: "Entrar no modo Período (3m/6m/12m/Ano) com várias categorias; passar mouse/tocar uma fatia do Donut"
    expected: "Centro do Donut muda para categoria + valor + %; sair volta a 'Total'; toda categoria da legenda completa (.fds-cats-list) tem representação, mesmo além das 7 barras do CategoryChart"
    why_human: "Interação de hover/tap requer o app rodando no browser; wiring (onActiveSlice/.fds-donut-center/.fds-cats-list) confirmado por leitura de código"
---

# Phase 10: Correção fatura cartão + hardening de importação Verification Report

**Phase Goal:** A fatura de cartão exibe fechamento/vencimento corretos para qualquer configuração de dias (incluindo `closing_day > due_day`, ex. Bradesco fecha 19 / vence 1), sem regressão para `closing_day < due_day`; e a importação de CSV/OFX deixa de duplicar dados silenciosamente — passa a ter preview/seleção/confirmação + dedupe.
**Verified:** 2026-07-04T21:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Fatura Bradesco (fecha 19/vence 1) exibe fecha 19/07 · vence 01/08 · aberta (não vencida) [D-03] | ✓ VERIFIED | `computeFaturaDates('2026-07',{diaFechamento:19,diaVencimento:1})` extraído do arquivo shipado retorna `dtFechamento=2026-07-19`, `dtVencimento=2026-08-01` (script Node, ver abaixo). Data-flow confirmado: `faturasDoCartao`/`faturasDoCartaoCompleto` (fides-store.jsx:1275,1331) chamam o helper; `fides-contas.jsx:955` renderiza `dtFechamento`/`dtVencimento` direto do objeto retornado. Confirmação visual final listada em Human Verification. |
| 2 | Cartão closing_day < due_day mantém fechamento/vencimento no mesmo mês (regressão D-05) | ✓ VERIFIED | `computeFaturaDates('2026-06',{diaFechamento:5,diaVencimento:15})` retorna ambas as datas em junho (script Node). Branch divergente `diaF > diaV` confirmado ausente: `grep -v '^\s*//' assets/fides-store.jsx \| grep -c 'diaF > diaV'` = 0. |
| 3 | Fatura de junho já paga (todas as txs settled) permanece 'paga' após o fix [D-04] | ✓ VERIFIED | Leitura de código: `faturasDoCartaoCompleto` (fides-store.jsx:1333-1341) calcula `paga = fat.txsAbertas.length === 0` e testa `if (paga) status='paga'` ANTES do else-if de vencida/fechada — precedência preservada. |
| 4 | computeFaturaDates é a única fonte de derivação de datas — nenhuma função gêmea recalcula mesF divergente [D-02] | ✓ VERIFIED | `grep -c "computeFaturaDates(fat.mesFatura" assets/fides-store.jsx` = 2 (ambas as funções); nenhum outro consumidor de `dtFechamento`/`dtVencimento` fora de fides-store.jsx/fides-contas.jsx. |
| 5 | Importar CSV/OFX abre preview ANTES de gravar; Cancelar não grava nada [D-06] | ✓ VERIFIED | `handleImport` (fides-transacoes.jsx:731-761) só faz parse + `setImportPreview(...)`; nenhuma chamada a `addTransaction(s)` nesse caminho. `onCancel={() => setImportPreview(null)}` (linha 1459) não grava. Gravação só ocorre em `handleImportConfirm`, chamada exclusivamente pelo botão "Importar (N)". |
| 6 | Linhas novas marcadas por default; duplicatas desmarcadas + badge "já importada" (não ocultas) [D-07/D-08] | ✓ VERIFIED | `ImportPreviewModal` (fides-transacoes.jsx:1513-1515): `selected` inicial = `rows.filter(r => !dupKeys.has(r._key))`; badge `<span className="fds-tag warn">já importada</span>` renderizado inline por linha (linha 1606), nunca oculta a linha. |
| 7 | Reimportar o mesmo arquivo resulta em 0 novas gravações (dedupe desc+valor+dia exato) [D-09/D-10] | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `dedupeKey`/`buildDedupeIndex` validados por script Node (normalização + janela dia-exato + isolamento por conta, ver abaixo) e wiring confirmado (`dupKeys` recalcula via `resolveRowForImport` contra `existingKeys`). O PRÓPRIO PLAN 10-02 marca este truth como "must_have não-inferível" — comportamento fim-a-fim requer app rodando. Roteado para Human Verification. |
| 8 | Cada linha usa mês/fatura correto pela DATA DA PRÓPRIA LINHA (não selectedMonth global) [D-11] | ✓ VERIFIED | `grep -c 'mes: selectedMonth' assets/fides-transacoes.jsx` = 0; `resolveRowForImport` (linha 108-124) deriva `mes` de `row.mesFromCsv` ou `window.mesFaturaFor(row.d, card, row.ano)`, nunca de `selectedMonth`. |
| 9 | Quando destino é cartão, gravação usa card_id (não account_id com card_id null) [D-12] | ✓ VERIFIED | `resolveRowForImport` retorna `card_id: isCard ? destAcctId : undefined`; `txToRow` (fides-store.jsx:230-232) grava `account_id: isCard ? null : tx.acct`, `card_id: isCard ? tx.acct : null`. |
| 10 | Import nunca marca is_transfer | ✓ VERIFIED | `grep -n "is_transfer\|isTransfer" assets/fides-transacoes.jsx` não mostra nenhuma atribuição no caminho de import; `txToRow` não inclui `is_transfer` no objeto retornado (default do banco aplica). |
| 11 | Chip "Cartão" no masthead filtra crédito sem abrir Filtros avançados [UX-03] | ✓ VERIFIED | `toggleCardChip` (fides-transacoes.jsx:906-913) chama `setAdvFilters` diretamente, sem tocar em `advFilterOpen`; `filtered` (linhas 575-577) já filtra por `advFilters.contasSelected` — mesmo campo. Confirmação visual final listada em Human Verification. |
| 12 | No modo Período, toda categoria da legenda tem representação (fix do mismatch top-7) [UX-04] | ✓ VERIFIED | `.fds-cats-list` (linha 1067-1078) itera `rangeSpend.map(...)` SEM truncar; `CategoryChart` (fides-charts.jsx:256) mantém `slice(0,7)` inalterado — confirmado por grep. |
| 13 | Hover/tap numa fatia do Donut mostra categoria+valor no centro [UX-04] | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Wiring completo confirmado: `onActiveSlice={setActiveSlice}` (linha 1049), `.fds-donut-center` (linha 1050-1059) consome `activeSlice.label`/`activeSlice.val`. Interação de hover/tap é comportamento de browser — não exercitável estaticamente. Roteado para Human Verification. |

**Score:** 11/13 truths verified automaticamente (2 present + wired, comportamento de runtime não exercitado — ver Human Verification)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `assets/fides-data.jsx` — `computeFaturaDates` | Helper puro único de derivação de datas de fatura | ✓ VERIFIED | Presente após `mesFaturaFor` (linha 72); testado com fixtures Bradesco/Nubank/virada de ano |
| `assets/fides-store.jsx` — `faturasDoCartao`/`faturasDoCartaoCompleto` | Consomem `computeFaturaDates`, sem branch `mesF` divergente | ✓ VERIFIED | Ambas chamam o helper (linhas 1275, 1331); branch antigo removido |
| `assets/fides-transacoes.jsx` — `dedupeKey`/`buildDedupeIndex` | Dedupe normalizado (D-09/D-10) | ✓ VERIFIED | Presentes e testados (linhas 86-102); WR-03 fix aplicado (sinal preservado + conta incluída) |
| `assets/fides-transacoes.jsx` — `resolveRowForImport` | Mês por linha + card_id resolvido (D-11/D-12) | ✓ VERIFIED | Presente (linha 108), usado em `handleImportConfirm` e em `ImportPreviewModal.dupKeys` |
| `assets/fides-transacoes.jsx` — `ImportPreviewModal` | Preview/seleção/confirmação (IMP-01) | ✓ VERIFIED | Componente completo (linha 1474-1633), montado condicionalmente no render de `Transacoes` (linha 1454-1462) |
| `assets/fides-transacoes.jsx` — chip "Cartão" + `onActiveSlice`/`.fds-donut-center` | UX-03/UX-04 | ✓ VERIFIED | Ambos presentes e wired (ver truths #11-13) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `assets/fides-store.jsx` (faturasDoCartao/Completo) | `assets/fides-data.jsx` (computeFaturaDates) | Chamada direta `computeFaturaDates(fat.mesFatura, card)` | ✓ WIRED | `grep -c` = 2 ocorrências |
| `handleImport` | `ImportPreviewModal` | `setImportPreview({...})` abre o modal, sem gravar | ✓ WIRED | Confirmado por leitura completa de `handleImport` |
| `ImportPreviewModal` (confirm) | `addTransactions` (fides-store.jsx) | `onConfirm` → `handleImportConfirm` → `resolveRowForImport` por linha → `addTransactions(payloads)` | ✓ WIRED | Confirmado; `addTransactions` no destructure de `useFides()` (linha ~381) |
| chip "Cartão" | `advFilters.contasSelected` | `setAdvFilters` altera o mesmo campo consumido por `filtered` | ✓ WIRED | Mesmo campo usado em ambos os pontos (linhas 575-577, 903-911) |
| Donut (modo Período) | `.fds-donut-center` | `onActiveSlice={setActiveSlice}` alimenta o centro dinâmico | ✓ WIRED | Confirmado, ver truth #13 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `fides-contas.jsx` (card de fatura) | `faturaDestaque.dtFechamento`/`dtVencimento`/`status` | `faturasDoCartao`/`faturasDoCartaoCompleto` → `computeFaturaDates` | Sim — dados reais de `transactions`/`cards` (RLS owner-scoped) | ✓ FLOWING |
| `ImportPreviewModal` (lista de linhas) | `preview.rows` | `parseCsvRows`/`parseOfxRows` sobre o arquivo real do usuário | Sim | ✓ FLOWING |
| Donut modo Período (centro) | `activeSlice` | `rangeSpend` (derivado de `transactions` reais) via `onActiveSlice` | Sim | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| computeFaturaDates — caso Bradesco (fecha 19/vence 1) | `node -e "...computeFaturaDates('2026-07',{diaFechamento:19,diaVencimento:1})..."` extraído do arquivo shipado | `dtFechamento=2026-07-19`, `dtVencimento=2026-08-01` | ✓ PASS |
| computeFaturaDates — regressão fecha<vence | `node -e "...computeFaturaDates('2026-06',{diaFechamento:5,diaVencimento:15})..."` | `dtVencimento=2026-06-15` (mesmo mês) | ✓ PASS |
| dedupeKey — normalização + janela dia-exato + isolamento por conta | `node -e "...dedupeKey({...})..."` extraído do arquivo shipado | trim/lowercase/espaço colapsado iguais; dia diferente → chave diferente; conta diferente → chave diferente | ✓ PASS |
| parseBRNumber (CR-01 fix) — valores agrupados BR | `node -e "...parseBRNumber('1.450,00')..."` | `1450` (correto, não `1.45`) | ✓ PASS |
| splitCsvLine (WR-02 fix) — campo entre aspas com separador | `node -e "...splitCsvLine('19/06;\"Compra; teste\";...', ';')..."` | 7 colunas corretas, campo `"Compra; teste"` atômico | ✓ PASS |
| txToRow (WR-01 fix) — preserva `tx.date` explícito | Leitura de código `fides-store.jsx:212-214` | `date` usa `tx.date` quando `YYYY-MM-DD` válido, só reconstrói senão | ✓ PASS (inspeção estática — lógica pura confirmada por leitura, sem harness de execução para esta função específica) |

### Probe Execution

Não aplicável — projeto não possui probes (`scripts/*/tests/probe-*.sh`); nenhum PLAN/SUMMARY desta fase declara probes.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|--------------|--------|----------|
| FAT-01 | 10-01-PLAN.md | Fatura exibe fechamento/vencimento/status corretos p/ qualquer config de dias | ✓ SATISFIED | Truths #1-4; REQUIREMENTS.md marcado `[x]` |
| IMP-01 | 10-02-PLAN.md | Import abre preview com seleção e exige confirmação; cancelar não grava | ✓ SATISFIED | Truths #5-6; REQUIREMENTS.md marcado `[x]` |
| IMP-02 | 10-02-PLAN.md | Dedupe + mês/fatura por linha + card_id resolvido | ✓ SATISFIED (dedupe fim-a-fim pendente de confirmação humana) | Truths #7-10; REQUIREMENTS.md marcado `[x]` |
| UX-03 | 10-03-PLAN.md | Botão "Cartão" filtra crédito sem abrir Filtros avançados | ✓ SATISFIED | Truth #11; REQUIREMENTS.md marcado `[x]` |
| UX-04 | 10-03-PLAN.md | Toda categoria da legenda tem barra + valor no hover/tap | ✓ SATISFIED (hover/tap pendente de confirmação humana) | Truths #12-13; REQUIREMENTS.md marcado `[x]` |

Nenhum requisito órfão encontrado — os 5 IDs declarados no PLAN frontmatter (FAT-01, IMP-01, IMP-02, UX-03, UX-04) batem exatamente com os 5 IDs listados em `.planning/REQUIREMENTS.md` para Phase 10, todos marcados `[x]` e mapeados na tabela de Traceability.

### Anti-Patterns Found

Nenhum debt marker (`TBD`/`FIXME`/`XXX`) ou marcador de aviso (`TODO`/`HACK`/`PLACEHOLDER`) encontrado nos três arquivos modificados (`fides-data.jsx`, `fides-store.jsx`, `fides-transacoes.jsx`) além de ocorrências de texto natural em comentários portugueses (ex. "Cartao"/"TODOS os hooks") que não são marcadores de débito. Nenhum `dangerouslySetInnerHTML`, `console.log`-only handler, ou stub (`return null`/`{}`/`[]`) introduzido pela fase.

O code-review desta fase (`10-REVIEW.md`) encontrou 1 blocker (CR-01) + 3 warnings (WR-01/02/03), todos corrigidos e comitados (`10-REVIEW-FIX.md`, commits `953f6e8`/`1d2a311`/`835dade`/`a205721`) e re-verificados nesta sessão diretamente contra o código atual (ver Behavioral Spot-Checks). 5 findings de nível `info` (IN-01..IN-05) permanecem intencionalmente fora de escopo — não bloqueiam o goal da fase:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `assets/fides-transacoes.jsx` | 131 | IN-01: header sempre descartado por `lines.slice(1)` | Info | Arquivo sem header perde a 1ª transação — fora do roteiro de reimport testado nesta fase |
| `assets/fides-transacoes.jsx` | 758 | IN-02: `readAsText(file, 'UTF-8')` mesmo com OFX declarando CHARSET:1252 | Info | Mojibake em memos acentuados de bancos BR reais |
| `assets/fides-transacoes.jsx` | 197 | IN-03: status `'agendado'` colapsa para `'pendente'` no import | Info | Perda do estado agendado ao reimportar export próprio |
| `assets/fides-data.jsx` | 72 vs 344 | IN-04: `computeFaturaDates` não exportado em `window` (inconsistente com `mesFaturaFor`) | Info | Funciona hoje (hoisting), mas quebra para qualquer `window.computeFaturaDates` futuro |
| `assets/fides-transacoes.jsx` | 1485/1513 | IN-05: reabrir o picker com o modal ainda montado reutiliza `selected`/`destAcct` do arquivo anterior | Info | Edge case (trocar de arquivo sem cancelar primeiro) |

### Human Verification Required

Ver lista completa em `human_verification` no frontmatter. Resumo:

1. **Visual: card Bradesco (Contas)** — fecha 19/07 · vence 01/08 · Aberta (lógica já validada por script Node + data-flow de código; falta o pixel final no browser).
2. **Visual: fatura de junho paga** — status permanece "Paga" (precedência já confirmada por leitura de código).
3. **Visual: cartão fecha<vence (regressão)** — datas no mesmo mês, sem inversão.
4. **Roteiro de reimport (IMP-02)** — exportar CSV do app e reimportar imediatamente → 0 novas gravações. O próprio PLAN 10-02 marca este item como "não-inferível" estaticamente.
5. **Card_id via Supabase MCP** — importar 1 linha nova com destino cartão; conferir `card_id` não-nulo / `account_id` nulo na tabela `transactions`.
6. **Cancelar sem gravar** — testar Cancelar num import com linhas novas.
7. **Visual: chip "Cartão"** — filtra crédito sem abrir Filtros avançados.
8. **Visual: hover/tap no Donut (modo Período)** — centro dinâmico + legenda completa.

### Gaps Summary

Nenhum gap bloqueante encontrado. Todo código, helpers, componentes e wiring descritos nos 3 PLANs desta fase existem, são substantivos (não-stub) e estão conectados ponta a ponta — confirmado por leitura de código e por scripts Node executados diretamente contra os arquivos shipados (não apenas contra o que o SUMMARY.md alega). Os 4 findings do code-review (1 blocker CR-01 + 3 warnings WR-01/02/03) foram corrigidos e as correções foram re-verificadas nesta sessão, não apenas aceitas por citação do commit.

O único fator que impede `status: passed` é a existência de comportamentos genuinamente dependentes de runtime/browser (renderização visual, hover/tap, e o roteiro fim-a-fim de reimport) que não podem ser observados por grep/leitura estática — nem o próprio PLAN os classifica como inferíveis. Nenhum desses itens é um gap de implementação; são checkpoints humanos pendentes antes do fechamento formal da fase via `/gsd-verify-work 10`.

---

_Verified: 2026-07-04T21:15:00Z_
_Verifier: Claude (gsd-verifier)_
