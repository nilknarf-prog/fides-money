---
phase: 10-corre-o-fatura-cart-o-hardening-de-importa-o
verified: 2026-07-05T18:20:00Z
status: gaps_found
score: 11/13 must-haves verified
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 12/13
  gaps_closed:
    - "G1 — reimport dedup ignorava compras de cartão pendentes (destino resolvia p/ débito default)"
    - "G2 — import convertia pendente→paga (fallback silencioso 'cleared' do txToRow)"
    - "G3 — modal sem opção de destino/status (agora 'Da origem do arquivo' + pills Do arquivo/Pendente/Paga)"
    - "G4 — legenda de categorias longa/repetida/sem barra no modo Período (voltou ao top-7 do CategoryChart)"
    - "G5 — donut/total do modo Período mostravam o range agregado (agora escopados ao mês do masthead)"
    - "G6 — trocar aba/minimizar resetava o modal de import (guarda loadedUid no onAuthStateChange)"
  gaps_remaining: []
  regressions:
    - "CR-01 (NOVO blocker do code-review) — export CSV omite o ano; reimport de linhas de outro ano-calendário fura o dedupe e corrompe a data → reintroduz a classe de duplicata silenciosa que a fase visa eliminar (IMP-02)"
gaps:
  - truth: "Reimportar o próprio CSV exportado resulta em 0 novas gravações, também para transações de outro ano-calendário (dedupe por description+value+date normalizado)"
    status: failed
    reason: "CR-01: o export CSV grava a coluna Data como `t.d` (DD/MM, sem ano — normalizeTx só produz dia/mês). No reimport, parseCsvRows não tem ano para ler e assume o ano corrente (nowY=2026). A dedupeKey usa a data completa (`date.slice(0,10)`), então uma compra de 2025-12-28 reimportada em 2026 vira 2026-12-28: a chave NÃO bate com a tx existente → não é marcada 'já importada' → é reinserida (duplicata silenciosa) com a data corrompida. O fix WR-01 de txToRow preserva fielmente a data já-errada, então a corrupção chega ao banco. Confirmado por simulação da lógica shipada: existing day 2025-12-28 vs reimport day 2026-12-28 → MATCH=false. Dedupe só funciona quando o ano da compra == ano corrente."
    artifacts:
      - path: "assets/fides-transacoes.jsx"
        issue: "handleExport (linha 747) grava `t.d || ''` (DD/MM, sem ano) na coluna Data do CSV; parseCsvRows (linhas 217-220) faz `ano = parseInt(parts[2],10) || nowY` → cai no ano corrente quando o ano falta"
      - path: "assets/fides-transacoes.jsx"
        issue: "OFX (WR-02, linha 706): handleExport carimba `DTPOSTED` com `selectedMonth.split('-')[0]` (ano do mês VISTO), não o ano da própria transação — mesmo modo de falha para linhas de cartão cross-year e para exports de range multi-ano"
    missing:
      - "Carregar o ano no round-trip do CSV: exportar a data ISO completa que o store já tem (`t.date`, YYYY-MM-DD) na coluna Data, e fazer parseCsvRows aceitar YYYY-MM-DD (fallback p/ DD/MM legado)"
      - "No OFX, derivar o ano de DTPOSTED da própria data resolvida da transação (`t.date`), não de selectedMonth (WR-02)"
      - "Após o fix, re-exercitar o roteiro de reimport com uma linha de dezembro/ano anterior e confirmar 0 novas gravações + data preservada"
  - truth: "No modal de import, trocar o destino no dropdown para uma conta/cartão específico desmarca as linhas que passam a ser duplicatas (evita reimport de duplicata pela UI)"
    status: partial
    reason: "WR-01 (warning): `dupKeys` é um useMemo que recalcula quando `destAcct` muda, mas `selected` é semeado UMA vez via inicializador lazy de useState contra o destino inicial (IMPORT_DEST_ORIGEM) e nunca é reconciliado. Se o usuário abre o modal (default 'origem') e depois troca 'Importar para' para uma conta/cartão que faz linhas antes novas resolverem para tx existentes, o badge 'já importada' aparece (dupKeys atualizado) mas as linhas continuam MARCADAS (selected inalterado) → clicar Importar reinsere duplicatas. Não afeta o caminho default 'origem' (dupKeys correto na montagem), mas é alcançável pela UI."
    artifacts:
      - path: "assets/fides-transacoes.jsx"
        issue: "ImportPreviewModal (linhas 1527-1541): falta um React.useEffect que reconcilie `selected` quando `dupKeys` muda (remover das seleções as chaves que viraram duplicata)"
    missing:
      - "Adicionar effect: `React.useEffect(() => setSelected(prev => { const n=new Set(prev); dupKeys.forEach(k=>n.delete(k)); return n; }), [dupKeys])`"
behavior_unverified_items:
  - truth: "Hover/tap numa fatia do Donut (modo Período) mostra categoria+valor+% no centro e volta a 'Total' ao sair"
    test: "No modo Período com várias categorias, passar mouse/tocar uma fatia do Donut e depois sair"
    expected: "Centro muda para categoria + valor + % (relativo ao total do mês selecionado); sair volta a 'Total'"
    why_human: "Interação de hover/tap requer o app rodando no browser (React via Babel-standalone); wiring onActiveSlice/.fds-donut-center confirmado por leitura de código, mas o comportamento de runtime não é exercitável estaticamente"
---

# Phase 10: Correção fatura cartão + hardening de importação — Verification Report (Re-verificação pós gap-closure)

**Phase Goal:** A fatura de cartão exibe fechamento/vencimento corretos para qualquer configuração de dias (incluindo `closing_day > due_day`, ex. Bradesco fecha 19 / vence 1), sem regressão para `closing_day < due_day`; e a importação de CSV/OFX deixa de duplicar dados silenciosamente — passa a ter preview/seleção/confirmação + dedupe.
**Verified:** 2026-07-05T18:20:00Z
**Status:** gaps_found
**Re-verification:** Yes — após gap-closure dos planos 10-04/10-05/10-06 (fecha 10-UAT) e do code-review 10-REVIEW.md

## Resumo executivo

Os 6 gaps do 10-UAT (2 blockers G1/G2 + 4 majors G3/G4/G5/G6) estão **fechados no código** — verifiquei cada fix diretamente contra os arquivos shipados, não por citação de SUMMARY. Porém, o code-review desta rodada (10-REVIEW.md) encontrou um **NOVO blocker CR-01** que **não foi corrigido** e que reintroduz exatamente a classe de duplicata silenciosa que a segunda metade do goal ("importação deixa de duplicar dados silenciosamente") existe para eliminar. Por isso o status é `gaps_found`, não `passed`.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Fatura Bradesco (fecha 19/vence 1) exibe fecha 19/07 · vence 01/08 · aberta [FAT-01] | ✓ VERIFIED | Código de FAT-01 inalterado desde a verificação inicial; UAT teste 1 = pass. computeFaturaDates validado por script Node. |
| 2 | closing_day < due_day mantém datas no mesmo mês (regressão D-05) | ✓ VERIFIED | Inalterado; UAT teste 3 = pass. |
| 3 | Fatura de junho já paga permanece 'paga' [D-04] | ✓ VERIFIED | Inalterado; UAT teste 2 = pass (precedência paga>vencida em fides-store.jsx). |
| 4 | computeFaturaDates é a única fonte de derivação de datas [D-02] | ✓ VERIFIED | Inalterado desde a verificação inicial. |
| 5 | Import abre preview ANTES de gravar; Cancelar não grava [IMP-01, G6] | ✓ VERIFIED | `handleImport` (linha 768-798) só parseia + `setImportPreview`; `onCancel` não grava. UAT teste 6 = pass. |
| 6 | Import não converte pendente→paga; nunca auto-paga [G2] | ✓ VERIFIED | `resolveRowForImport` (linha 151) devolve status SEMPRE explícito (`row.status||'pendente'` ou o modo escolhido) → nunca cai no fallback 'cleared'/pago do txToRow (fides-store.jsx:228). Confirma o fix do medo do usuário. |
| 7 | Reimportar o mesmo CSV = 0 novas gravações, inclui cross-year (dedupe date normalizado) [IMP-02, G1] | ✗ FAILED | Para linhas do MESMO ano-calendário o dedupe casa (fix G1 correto: export grava nome do cartão, resolução por linha via acctNameRaw). MAS **CR-01**: export omite o ano (linha 747 `t.d`=DD/MM) → reimport assume ano corrente (linha 220) → dedupeKey (linha 91, data completa) não casa p/ linha de 2025 reimportada em 2026 → duplicata silenciosa + data corrompida. Simulação da lógica shipada: existing 2025-12-28 vs reimport 2026-12-28 → MATCH=false. |
| 8 | Cada linha usa mês/fatura correto pela DATA da própria linha [D-11] | ⚠️ degradado por CR-01 | `resolveRowForImport` deriva `mes` de `window.mesFaturaFor(row.d, card, row.ano)` (nunca de selectedMonth) — mecanismo correto. Porém `row.ano` vem corrompido do round-trip export→reimport para linhas cross-year (CR-01), então a data/mês gravados ficam errados nesse caso. Contabilizado no gap CR-01 (não como truth verde separada). |
| 9 | Destino cartão grava card_id (não account_id null) [D-12] | ✓ VERIFIED | `resolveRowForImport` retorna `card_id: isCard ? destId : undefined`; `txToRow` (fides-store.jsx:231-232) grava account_id=null/card_id=acct p/ cartão. UAT teste 5 estava blocked (adiado); lógica confirmada por código. |
| 10 | Import nunca marca is_transfer | ✓ VERIFIED | Nenhuma atribuição de is_transfer no caminho de import; payload (linha 807-818) não inclui o campo. |
| 11 | Chip "Cartão" filtra crédito sem abrir Filtros avançados [UX-03] | ✓ VERIFIED | Inalterado; UAT teste 7 = pass. |
| 12 | Modo Período: quebra por categoria = top-7, sem legenda redundante/sem-barra/repetida [UX-04, G4] | ✓ VERIFIED | `fds-cats-list`/`fds-cat-row`/`rangeSpend`/`rangeTotal`/`spendByCategoryRange` REMOVIDOS (grep = 0 matches). CategoryChart (slice 0,7) é a única legenda. Fecha G4. |
| 13 | Modo Período: donut/total refletem o MÊS do masthead + hover/tap mostra categoria+valor [UX-04, G5] | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | G5 fechado no código: widget consome `spendByCategory`/`monthTotal` (linhas 457, 570-572, 1079, 1086, 1104), não mais o range. Hover/tap (`onActiveSlice`/`.fds-donut-center`) presente e wired, mas é comportamento de browser — roteado p/ Human Verification. |

**Score:** 11/13 truths verificados · 1 FAILED (#7, CR-01) · 1 present-behavior-unverified (#13). Truth #8 degradado é absorvido no gap CR-01.

### Gap Fixes (10-UAT) — verificação no código

| Gap | Plano | Fix esperado | Status no código |
|-----|-------|--------------|------------------|
| G1 (dedup ignorava pendentes / destino default errado) | 10-04 | export grava nome do cartão + resolução de destino POR LINHA via acctNameRaw | ✓ PRESENTE (linhas 740-743, 120-158) — correto p/ mesmo ano; furado cross-year por CR-01 |
| G2 (pendente→paga silencioso) | 10-04 | status sempre explícito no payload | ✓ PRESENTE (linha 151) |
| G3 (sem opção destino/status) | 10-04 | modal "Da origem do arquivo" + pills de status | ✓ PRESENTE (linhas 1514, 1519, 1591, 1614) |
| G4 (legenda longa/repetida) | 10-06 | remover legenda textual, voltar ao top-7 | ✓ PRESENTE (grep fds-cat-row/fds-cats-list = 0) |
| G5 (donut/total = range, não mês) | 10-06 | escopar analytics ao mês (spendByCategory/monthTotal) | ✓ PRESENTE (linhas 457, 570-572, 1079-1104) |
| G6 (trocar aba reseta modal) | 10-05 | guarda loadedUid no onAuthStateChange | ✓ PRESENTE (fides-store.jsx:318, 356, 382) |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `assets/fides-transacoes.jsx` — `resolveRowForImport` | Destino/mês/status POR LINHA (nova assinatura +accounts +statusMode) | ✓ VERIFIED | Linha 120; assinatura `(row, fallbackDestId, accounts, cards, statusMode)`; status explícito |
| `assets/fides-transacoes.jsx` — `ImportPreviewModal` | Preview + destino "origem" + controle de status | ✓ VERIFIED | Destino sentinel (1514), statusMode (1519), option "Da origem do arquivo" (1591), pills (1614) |
| `assets/fides-transacoes.jsx` — `handleExport` (CSV) | Round-trip export→reimport casável | ⚠️ HOLLOW | Grava nome do cartão (fix G1) MAS omite o ano (CR-01, linha 747) — round-trip incompleto p/ cross-year |
| `assets/fides-transacoes.jsx` — bloco analytics modo Período | Escopado ao mês, sem legenda redundante | ✓ VERIFIED | spendByCategory/monthTotal; legenda removida |
| `assets/fides-store.jsx` — guarda `loadedUid` | Ignora SIGNED_IN re-emitido do mesmo usuário | ✓ VERIFIED | Linhas 318/324/356/377/382 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `handleImportConfirm` | `resolveRowForImport` → `addTransactions` | payload com status/card_id/mes por linha | ✓ WIRED | Linhas 804-818 |
| `ImportPreviewModal.dupKeys` | `resolveRowForImport` + `existingKeys` | recalcula duplicatas por linha contra destino | ✓ WIRED (default 'origem') | Linha 1527-1534; mas `selected` não reconcilia ao trocar destino (WR-01, gap parcial) |
| `handleExport` (CSV) | `parseCsvRows` (reimport) | coluna Data faz round-trip do ano | ✗ NOT_WIRED (ano) | Ano perdido no export → dedupe fura cross-year (CR-01) |
| `onAuthStateChange` (SIGNED_IN) | `setTransactions([])`/`refreshData` | só executa quando user.id muda | ✓ WIRED | Guarda `if (user.id === loadedUid) return;` (linha 356) |
| Donut modo Período | `.fds-donut-center` | `onActiveSlice={setActiveSlice}` + monthTotal | ✓ WIRED | Linhas 1086-1094 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CR-01 — round-trip cross-year (Dez/2025 → reimport 2026) | `node -e` simulando normalizeTx + parseCsvRows + dedupeKey da lógica shipada | export "28/12" (ano perdido) → reimport "2026-12-28" → dedupe day mismatch (2025 vs 2026) → MATCH=false (duplicata NÃO detectada) | ✗ FAIL (confirma CR-01) |
| Guarda de auth idempotente | Leitura fides-store.jsx:356 | `if (user.id === loadedUid) return;` presente no ramo SIGNED_IN/INITIAL_SESSION | ✓ PASS |
| Legenda redundante removida | grep `fds-cat-row\|fds-cats-list\|rangeSpend\|rangeTotal\|spendByCategoryRange` | 0 matches | ✓ PASS |
| Status explícito no import | Leitura linha 151 | `(!statusMode||statusMode==='arquivo') ? (row.status||'pendente') : statusMode` — nunca undefined | ✓ PASS |

### Probe Execution

Não aplicável — projeto sem probes (`scripts/*/tests/probe-*.sh`); nenhum PLAN/SUMMARY desta fase declara probes.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|--------------|--------|----------|
| FAT-01 | 10-01 | Fatura fechamento/vencimento/status corretos | ✓ SATISFIED | Truths #1-4; inalterado, UAT testes 1-3 pass |
| IMP-01 | 10-02, 10-04, 10-05 | Preview + seleção + confirmação; cancelar não grava | ✓ SATISFIED | Truths #5-6; G6 fechado |
| IMP-02 | 10-02, 10-04 | Dedupe + mês/fatura por linha + card_id | ✗ BLOCKED | Truth #7 FAILED por CR-01 (dedupe fura cross-year + data corrompida); G1/G2/G3 fechados mas o round-trip de ano quebra o dedupe |
| UX-03 | 10-03 | Chip "Cartão" filtra crédito | ✓ SATISFIED | Truth #11; UAT teste 7 pass |
| UX-04 | 10-03, 10-06 | Legenda com barra + valor no hover/tap | ✓ SATISFIED (hover/tap pendente humano) | Truths #12-13; G4/G5 fechados |

Nenhum requisito órfão: os 5 IDs do PLAN frontmatter (FAT-01, IMP-01, IMP-02, UX-03, UX-04) batem com os 5 de REQUIREMENTS.md para Phase 10. **Nota:** REQUIREMENTS.md marca IMP-02 como `[x]` e Traceability como "Planned" — inconsistente com o blocker CR-01; IMP-02 não deveria ser considerado completo até CR-01 fechar.

### Anti-Patterns Found

Nenhum debt marker (`TBD`/`FIXME`/`XXX`) introduzido pelos gap plans. CR-01 não é um marcador de débito — é um defeito de correção funcional (silent data corruption + duplicata), classificado como blocker pelo code-review e confirmado por simulação aqui.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `assets/fides-transacoes.jsx` | 747 / 217-220 | CR-01: export omite ano → reimport assume ano corrente | 🛑 Blocker | Duplicata silenciosa + data corrompida p/ linhas de outro ano; fura IMP-02 |
| `assets/fides-transacoes.jsx` | 706 | WR-02: OFX carimba ano de selectedMonth, não da tx | ⚠️ Warning | Mesmo modo de falha na trilha OFX (cross-year/range) |
| `assets/fides-transacoes.jsx` | 1527-1541 | WR-01: `selected` não reconcilia com `dupKeys` ao trocar destino | ⚠️ Warning | Trocar dropdown deixa duplicatas marcadas → reimport de duplicata pela UI |
| `assets/fides-store.jsx` | 320-347 | WR-03: bootstrap `getAuthUser().then` sem guarda loadedUid | ⚠️ Warning | Double-load/flash possível no cold start (não é quebra de correção) |

### Human Verification Required

Itens de runtime que permanecem (não bloqueiam, mas pendentes antes do fechamento formal via `/gsd-verify-work 10`), a serem re-testados APÓS o fix de CR-01:

1. **Hover/tap no Donut (modo Período)** — centro dinâmico categoria+valor+% (do mês) e volta a "Total" ao sair.
2. **Reimport do próprio CSV com linha de dezembro/ano anterior** — após o fix de CR-01, 0 novas gravações e data preservada (este é o teste que expõe CR-01 hoje).
3. **card_id via Supabase MCP** — importar 1 linha nova com destino cartão → card_id não-nulo / account_id nulo (UAT teste 5 estava adiado).
4. **Trocar aba/minimizar com modal de import aberto** — seleções preservadas (G6).

### Gaps Summary

Os 6 gaps do 10-UAT foram fechados no código e re-verificados diretamente (não por citação de SUMMARY): G1/G2/G3 no import (10-04), G6 na guarda de auth (10-05), G4/G5 no analytics do modo Período (10-06). Todos presentes, substantivos e wired.

O bloqueio ao `passed` é o **novo blocker CR-01**: o export CSV nunca grava o ano da transação, então o reimport de qualquer linha de outro ano-calendário (compra de dezembro do ano anterior, export de range multi-ano) recebe o ano corrente, corrompendo a data gravada E furando a dedupeKey — reinserindo a linha como duplicata silenciosa. Isso contradiz diretamente a segunda metade do goal da fase ("a importação deixa de duplicar dados silenciosamente") e o requisito IMP-02 (dedupe por data normalizada + mês/fatura correto por linha). O fix G1 (resolução de destino por linha) só resolve o caso do MESMO ano; o eixo do ano continua aberto. A trilha OFX tem o defeito análogo (WR-02). Ambos devem ser fechados carregando o ano no round-trip (exportar `t.date` ISO completo e aceitá-lo no parse) antes de considerar IMP-02 satisfeito.

Gap secundário (WR-01): reconciliar `selected` com `dupKeys` quando o destino muda no modal, para não deixar duplicatas marcadas ao trocar o dropdown.

---

_Verified: 2026-07-05T18:20:00Z_
_Verifier: Claude (gsd-verifier)_
