---
phase: 10-corre-o-fatura-cart-o-hardening-de-importa-o
plan: 02
subsystem: ui
tags: [react, import, csv, ofx, dedupe, transacoes]

# Dependency graph
requires:
  - phase: 09-transacoes-filtros-avancados
    provides: fides-transacoes.jsx Transacoes component, addTransactions bulk-insert in fides-store.jsx
provides:
  - "dedupeKey/buildDedupeIndex — chave de dedupe normalizada (desc+valor+dia exato), sem tolerância"
  - "resolveRowForImport — resolve mes/fatura e conta/cartao POR LINHA (espelha FIX-EDIT-MES em lote)"
  - "parseCsvRows/parseOfxRows — parse puro sem gravar, dados prontos para preview e dedupe"
  - "ImportPreviewModal — preview/seleção/confirmação de import (parse-then-preview)"
affects: [10-03, fides-transacoes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Import de CSV/OFX sempre passa por preview + confirmação explícita antes de gravar (parse-then-preview) — contrato a herdar por qualquer import futuro"
    - "Dedupe client-side via Set normalizado sobre transactions já carregado pelo store — sem RPC"
    - "Resolução de mês/fatura POR LINHA no confirm, nunca dependendo do fallback implícito do txToRow (que só recalcula em modo live)"

key-files:
  created: []
  modified:
    - assets/fides-transacoes.jsx

key-decisions:
  - "card_id explicito incluído no payload de resolveRowForImport mesmo sabendo que txToRow (modo live) recomputa isCard a partir de tx.acct — mantém o contrato do PATTERNS.md e serve de documentação/teste explícito, sem alterar o resultado final gravado"
  - "Ano da linha (row.ano) cai no ano corrente (new Date().getFullYear()) quando o arquivo não traz ano explícito — o CSV exportado pelo próprio app só tem 'dd/mm' na coluna Data; assumption necessária para o dedupe funcionar no roteiro real de reimport (exportar e reimportar no mesmo ano)"
  - "ImportPreviewModal reaproveita as classes CSS pfm-* já existentes (fides-contas.css, carregado globalmente) em vez de criar CSS novo — plano só lista fides-transacoes.jsx em files_modified"
  - "Badge de duplicata usa a classe já existente `fds-tag warn` (sem CSS novo) em vez de um `pfm-status-chip` dedicado"

requirements-completed: [IMP-01, IMP-02]

# Metrics
duration: ~20min
completed: 2026-07-04
status: complete
---

# Phase 10 Plan 02: Hardening de importação CSV/OFX (parse-then-preview + dedupe) Summary

**Import de CSV/OFX reescrito de "grava linha a linha sem checagem" para parse → preview → seleção → confirmação, com dedupe normalizado (desc+valor+dia exato) e resolução de mês/conta-cartão por linha via `resolveRowForImport` + `ImportPreviewModal`.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-04T19:05:00Z
- **Completed:** 2026-07-04T19:25:00Z
- **Tasks:** 2 completed
- **Files modified:** 1

## Accomplishments
- `dedupeKey`/`buildDedupeIndex` — chave normalizada `desc|cents|day` (trim+lowercase+colapso de espaço; centavos inteiros; dia exato `YYYY-MM-DD`, sem tolerância ±1) — corrige o incidente real de 196 duplicatas por reimport.
- `resolveRowForImport(row, destAcctId, cards)` — resolve `mes`/fatura e `card_id` POR LINHA a partir da data da própria linha, espelhando o padrão `FIX-EDIT-MES` do `EditTxModal.handleSave`, agora em lote.
- `parseCsvRows`/`parseOfxRows` — extraem a lógica de parse existente em funções puras que retornam linhas (`desc`, `val`, `d`, `ano`, `date`, `mesFromCsv`, `cat`, `acctNameRaw`, `status`, `recur`, `_key`) sem gravar nada.
- `handleImport` reescrito: parse → calcula `_isDuplicate` por linha via `buildDedupeIndex(transactions)` → abre `ImportPreviewModal` via `setImportPreview`. Nenhuma gravação acontece nessa etapa. O bug de forçar `mes: selectedMonth` (linha 612 original) foi eliminado.
- `ImportPreviewModal` novo: linhas novas vêm marcadas por default, duplicatas vêm desmarcadas + badge "já importada" (nunca ocultas); seletor de conta/cartão de destino (dropdown agrupado); Cancelar/backdrop/X fecham sem gravar nada; Confirmar mapeia as linhas marcadas por `resolveRowForImport` e grava em lote via `addTransactions` (bulk insert já existente em `fides-store.jsx`).
- `addTransactions` adicionado ao destructure de `useFides()` no componente `Transacoes` (antes só tinha `addTransaction`).
- Renderização de `desc`/memo como texto React puro — sem `dangerouslySetInnerHTML` em nenhum ponto do modal novo (mitigação de Stored XSS, T-10-02-04).

## Task Commits

Each task was committed atomically:

1. **Task 1: Helpers de dedupe/resolução + reescrever handleImport para parse-then-preview** - `8698dea` (feat)
2. **Task 2: ImportPreviewModal + montar + confirmar via addTransactions** - `4487b26` (feat)

**Plan metadata:** pending (docs: complete plan — committed after this summary)

## Files Created/Modified
- `assets/fides-transacoes.jsx` — Adiciona `dedupeKey`, `buildDedupeIndex`, `resolveRowForImport`, `parseCsvRows`, `parseOfxRows` (helpers puros no topo do módulo); reescreve `handleImport` (parse-then-preview) e adiciona `handleImportConfirm` (gravação em lote via `addTransactions`); adiciona o componente `ImportPreviewModal` e o estado `importPreview`; adiciona `addTransactions` ao destructure de `useFides()`.

## Decisions Made
- Ver `key-decisions` no frontmatter: `card_id` explícito no payload de `resolveRowForImport` (documentação/contrato, mesmo com `txToRow` recomputando em modo live); ano fallback = ano corrente quando o arquivo não traz ano; reuso das classes CSS `pfm-*`/`fds-tag warn` já existentes em vez de CSS novo (plano só lista `fides-transacoes.jsx` em `files_modified`).

## Deviations from Plan

None - plan executed exatamente como especificado (Task 1 e Task 2 seguiram a ação e os acceptance criteria do PLAN.md ponto a ponto).

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Verification Status

- **Automatizado (executado nesta sessão):**
  - Task 1: `grep -c "function dedupeKey"` → 1; `grep -c "buildDedupeIndex"` → 3; `grep -c "resolveRowForImport"` → 5 (definição Task 1 + 4 usos incluindo Task 2); `grep -c "setImportPreview("` → 2; `grep -c 'mes: selectedMonth'` → 0; `grep -n "addTransactions"` confirma presença no destructure (linha 381). Script Node que extrai `dedupeKey` do arquivo shipado e valida normalização + janela dia-exato → `DEDUPE OK`.
  - Task 2: `grep -c "ImportPreviewModal"` → 6 (>=2 requerido); `grep -c "addTransactions("` → 2 (>=1 dentro de `handleImportConfirm`, requerido); `grep -c "resolveRowForImport"` → 5 (>=2 requerido); `grep -c "dangerouslySetInnerHTML"` → 0; revisão manual confirma nenhum `useState`/`useMemo`/`useCallback` dentro de `.map(` no corpo de `ImportPreviewModal` (todos os hooks declarados antes do primeiro `.map()` de renderização — Pitfall 3). Gate combinado `IMPORT_UI_OK` passou.
  - Sanidade estrutural do arquivo inteiro pós-edição (sem build/lint no projeto — Babel-standalone no browser): contagem de chaves `{`/`}` (999/999) e parênteses `(`/`)` (1351/1351) balanceada; revisão manual completa de ambos os diffs linha a linha.
- **Domínio de cartão sensível (CLAUDE.md — resolução account_id/card_id):** revisão de segurança/database feita inline nesta sessão (sem subagente `database-reviewer`/`security-reviewer` disponível neste ambiente de execução — recomenda-se rodar `/gsd-code-review` como passo adicional antes do deploy, se desejado):
  - T-10-02-01 (dedupe): determinístico, dia exato, duplicatas nunca ocultas — usuário pode forçar. OK.
  - T-10-02-02 (account_id/card_id): `resolveRowForImport` usa o destino explícito do dropdown (não heurística por nome); em modo live, `txToRow` recomputa `isCard` a partir do mesmo `tx.acct`/`cards` e grava `account_id: null, card_id: destAcctId` quando é cartão — consistente e correto. Em modo mock, o objeto gravado só usa `.acct` (convenção já usada em todo o app), sem regressão.
  - T-10-02-03 (is_transfer): nenhum campo `is_transfer`/`isTransfer` é setado em nenhum ponto do fluxo de import — comportamento atual preservado.
  - T-10-02-04 (Stored XSS): `{row.desc}` renderizado como texto React puro; `grep dangerouslySetInnerHTML` == 0 confirmado.
  - T-10-02-05 (Info disclosure): dropdown lista apenas `accounts`/`cards` já retornados por RLS owner-scoped via `useFides()` — nenhuma superfície nova.
  - T-10-02-SC (installs): zero dependências novas — parser continua regex vanilla.
- **Pendente (human-check, não bloqueante — plano é `autonomous: true`):** roteiro determinístico do incidente real, a rodar via `/gsd-verify-work 10` com o app deployado:
  1. Exportar o CSV do próprio app e reimportar imediatamente o mesmo arquivo → todas as linhas devem aparecer como "já importada" e desmarcadas; confirmar deve resultar em 0 novas gravações (contagem de transações inalterada após refresh).
  2. Importar um CSV com 1 linha nova + destino = um CARTÃO; confirmar; via Supabase MCP `select account_id, card_id from transactions order by created_at desc limit 1` — `card_id` não deve ser null e `account_id` deve ser null.
  3. Testar Cancelar num import com linhas novas — nada deve ser gravado.
  - **Nota de limitação conhecida:** o CSV exportado pelo próprio app (`handleExport`) só grava a data no formato `dd/mm` (sem ano) na coluna Data — `parseCsvRows` assume o ano corrente quando a coluna não traz ano explícito. Isso é suficiente para o roteiro de reimport imediato (exportar e reimportar no mesmo ano), mas um CSV com datas de anos anteriores reimportado sem coluna de ano explícita pode calcular o dedupe/mês com o ano errado. Fora do escopo desta fase (formato do arquivo não foi alterado); registrar como possível item futuro se o formato de export ganhar coluna de ano.

## Next Phase Readiness
- `dedupeKey`/`buildDedupeIndex`/`resolveRowForImport` ficam disponíveis no módulo `fides-transacoes.jsx` para qualquer extensão futura de import (novos formatos, mapeamento de colunas — fora de escopo agora).
- UAT humano (roteiro de reimport, card_id, cancelar-não-grava) segue como item a fechar em `/gsd-verify-work 10` após deploy, junto com a UAT pendente do plano 10-01.
- Plano 10-03 (onda 3, UX-03/UX-04) não depende de nenhum símbolo deste plano — arquivo distinto de escopo de mudança dentro do mesmo `fides-transacoes.jsx`, mas sem overlap de linhas tocadas.

---
*Phase: 10-corre-o-fatura-cart-o-hardening-de-importa-o*
*Completed: 2026-07-04*

## Self-Check: PASSED

- FOUND: assets/fides-transacoes.jsx
- FOUND: .planning/phases/10-corre-o-fatura-cart-o-hardening-de-importa-o/10-02-SUMMARY.md
- FOUND: 8698dea
- FOUND: 4487b26
