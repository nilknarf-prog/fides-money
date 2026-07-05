---
phase: 10-corre-o-fatura-cart-o-hardening-de-importa-o
plan: 04
subsystem: transacoes-import
tags: [import, csv, ofx, dedupe, cartao, status, gap-closure]
requires:
  - resolveRowForImport (10-02)
  - dedupeKey WR-03 acct+sinal (10-02)
  - window.mesFaturaFor (10-01)
provides:
  - "resolveRowForImport(row, fallbackDestId, accounts, cards, statusMode): resolução de destino POR LINHA via acctNameRaw + status explícito"
  - "handleExport grava nome do cartão na coluna Conta (round-trip export→reimport)"
  - "ImportPreviewModal: destino 'Da origem do arquivo' (default) + controle de status (arquivo/pendente/paga)"
affects:
  - assets/fides-transacoes.jsx
tech-stack:
  added: []
  patterns:
    - "Sentinel de destino (IMPORT_DEST_ORIGEM) = resolução por linha; id real = override que força todas as linhas"
    - "Status sempre explícito no payload de import (nunca undefined → nunca fallback 'cleared'/pago do txToRow)"
key-files:
  created: []
  modified:
    - assets/fides-transacoes.jsx
decisions:
  - "Destino default do modal = sentinel 'Da origem do arquivo' (resolução por linha); escolher conta/cartão específico força TODAS as linhas"
  - "Override explícito (id real em fallbackDestId) tem precedência sobre acctNameRaw da linha; sentinel/ausente resolve por linha"
  - "semDestino = zero contas E zero cartões (sentinel é truthy, não serve como sinal de vazio)"
metrics:
  duration: ~12min
  completed: 2026-07-05
  tasks: 2
  files: 1
status: complete
---

# Phase 10 Plan 04: Correção do import (G1/G2/G3) Summary

Fecha os 2 BLOCKERS de import (G1 dedup ignorava pendentes / destino default errado; G2 import convertia pendente→paga / duplicava lançada) e o MAJOR G3 (opções de destino + status no modal) do 10-UAT, editando apenas `assets/fides-transacoes.jsx`.

## What Was Built

- **G1 (raiz — export não fazia round-trip):** `handleExport` agora resolve o nome da coluna "Conta" também em `cards` (`accounts.find || cards.find || t.acct`). Antes, para uma tx de cartão, `t.acct` é um card_id que não está em `accounts`, então gravava o id cru — o modal casava `acctNameRaw` por NOME e nunca casava cartão, caindo no débito e não detectando a duplicata. Com o nome do cartão no CSV, o reimport casa o cartão de origem por nome. `cards` adicionado às deps do `useCallback`.

- **G1/G2 (resolução por linha + status explícito):** `resolveRowForImport` passou de `(row, destAcctId, cards)` para `(row, fallbackDestId, accounts, cards, statusMode)`:
  - Destino resolvido POR LINHA a partir de `row.acctNameRaw` (normaliza String/trim/lowercase; casa em `accounts` primeiro, depois `cards`). Se não casar, usa `fallbackDestId` quando for id real; se for o sentinel `IMPORT_DEST_ORIGEM` sem match, cai na 1ª conta / 1º cartão.
  - Override: quando `fallbackDestId` é um id real (usuário escolheu no dropdown), força TODAS as linhas para esse destino.
  - Status SEMPRE explícito: `statusMode==='arquivo'`/ausente → `row.status || 'pendente'`; senão o modo escolhido. Impede o fallback silencioso `'cleared'` (pago) do `txToRow` (medo real do usuário: "seriam lançadas como PAGAS").
  - `window.mesFaturaFor` (WR-01) preservado, agora sobre o destino resolvido por linha.

- **G3 (modal — DECISÃO 1+2):** `ImportPreviewModal`:
  - `destAcct` inicializa com o sentinel `IMPORT_DEST_ORIGEM`; `<select>` ganha a primeira `<option>` "Da origem do arquivo", mantendo os optgroups "Contas"/"Cartões" como override explícito.
  - Novo estado `statusMode` (`useState('arquivo')`) declarado antes de `selected` (Rules of Hooks — nenhum hook dentro do `.map`), renderizado como controle segmentado (pills `fds-tx-v2-sort-pill`, sem CSS novo): "Do arquivo" (default) / "Pendente" / "Paga".
  - `dupKeys` e `handleImportConfirm` usam a nova assinatura com `safeAccounts`; `onConfirm` passa `statusMode`.
  - `semDestino` recomputado como `safeAccounts.length === 0 && safeCards.length === 0` (o sentinel é truthy).

## Key Implementation Details

- `handleImportConfirm(selectedRows, destAcctId, statusMode)` chama `resolveRowForImport(row, destAcctId, safeAccounts, safeCards, statusMode)`; `safeAccounts` adicionado às deps.
- O botão Importar extrai `picked` antes de chamar `onConfirm(picked, destAcct, statusMode)` (evita parens aninhados; também satisfaz o guard estático do plano).
- No default "origem", cada linha do reimport casa a tx existente pela `dedupeKey` (que inclui `acct` + sinal, WR-03) → entra no set de duplicatas → desmarcada; `selected` inicial já exclui `dupKeys`.

## Deviations from Plan

Nenhuma deviation de comportamento. Único ajuste de forma: o `onClick` do botão Importar foi reescrito para extrair `const picked = rows.filter(...)` antes de `onConfirm(...)`, porque o guard estático do plano (`onConfirm\([^)]*destAcct, statusMode\)`) não tolera os parens aninhados de `rows.filter(r => selected.has(r._key))`. Mesmo comportamento, assinatura idêntica.

## TDD Gate Compliance

Task 1 declara `tdd="true"`, mas o projeto roda React via Babel-standalone no browser **sem build/lint/test runner** (débito ROADMAP B11) e `config.json` tem `tdd_mode: false`. Não há infraestrutura de teste unitário para JSX de browser. A verificação seguiu os guards estáticos `<automated>` do próprio plano (node `-e` sobre o fonte) como gate, complementados por checagem de balanceamento de chaves/parênteses/colchetes. Sem commit `test(...)` separado por ausência de framework.

## Verification

- Task 1 automated guard: `sig true export true status true confirm true braces true`.
- Task 2 automated guard: `origem true statusState true dupSig true confirmSig true noMapHook true`.
- Balanceamento no arquivo inteiro: braces 1060/1060, parens 1464/1464, brackets 248/248.
- WR-01 (date com ano da compra), WR-02 (splitCsvLine quote-aware), WR-03 (sinal + acct na chave) preservados — nenhum foi tocado; a duplicata passa a casar porque a origem agora faz round-trip pelo export/import.

## Runtime UAT pendente (precisa do app deployado + sessão logada)

1. Exportar o extrato → reimportar sem editar, destino "Da origem do arquivo" → todas com badge "já importada" e desmarcadas; confirmar (0 marcadas) = 0 novas gravações; contagem inalterada após refresh.
2. Compra de cartão pendente (ex. "Bota Ádria") no reimport aparece como duplicata (não regravada nem convertida para paga).
3. Import de 1 linha nova com destino = cartão → `select account_id, card_id from transactions order by created_at desc limit 1`: `card_id` não-null, `account_id` null.
4. Status: "Pendente"/"Paga" refletem no gravado; "Do arquivo" respeita a coluna Status.

## Commits

- `e798d7e` feat(10-04): export grava nome do cartão; resolveRowForImport resolve destino/status por linha (G1/G2)
- `c5131da` feat(10-04): ImportPreviewModal opções de destino (origem/conta/cartão) + status (G3)

## Self-Check: PASSED
