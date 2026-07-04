---
phase: 10-corre-o-fatura-cart-o-hardening-de-importa-o
plan: 01
subsystem: ui
tags: [react, dates, fatura, cartao]

# Dependency graph
requires:
  - phase: 09-transacoes-filtros-avancados
    provides: mesFaturaFor convention and fides-store fatura grouping this plan corrects
provides:
  - "computeFaturaDates(mesFatura, card) — single pure source of fatura dtFechamento/dtVencimento derivation"
  - "faturasDoCartao and faturasDoCartaoCompleto consuming the shared helper (no divergent mesF branch)"
affects: [10-02, 10-03, fides-contas]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared pure date-derivation helper defined in fides-data.jsx (loads before fides-store.jsx) instead of duplicating logic in each consumer function"

key-files:
  created: []
  modified:
    - assets/fides-data.jsx
    - assets/fides-store.jsx

key-decisions:
  - "computeFaturaDates lives in fides-data.jsx (not fides-store.jsx) to guarantee script-load order as a global, matching mesFaturaFor's placement"
  - "Removed the diaF > diaV branch entirely rather than special-casing it — it was the root-cause bug (D-02), not a compatibility case to preserve"

patterns-established:
  - "Twin-function fatura derivation (faturasDoCartao / faturasDoCartaoCompleto) must always consume the same shared helper — never redemonstrate date math inline in either"

requirements-completed: [FAT-01]

# Metrics
duration: 6min
completed: 2026-07-04
status: complete
---

# Phase 10 Plan 01: Corrigir exibição de fechamento/vencimento de fatura de cartão Summary

**Extraído `computeFaturaDates` como fonte única de dtFechamento/dtVencimento em fides-data.jsx, eliminando o branch `mesF` divergente duplicado em `faturasDoCartao`/`faturasDoCartaoCompleto` que fazia cartões com `closing_day > due_day` (ex.: Bradesco fecha 19/vence 1) exibirem "vencida" incorretamente.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-04T18:47:00Z
- **Completed:** 2026-07-04T18:53:00Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- Novo helper puro `computeFaturaDates(mesFatura, card)` em `assets/fides-data.jsx`, logo após `mesFaturaFor` — única fonte de derivação de fechamento/vencimento de fatura.
- `faturasDoCartao` e `faturasDoCartaoCompleto` (fides-store.jsx) agora consomem o helper compartilhado; o branch `diaF > diaV` que recalculava um `mesF` divergente foi removido de ambas.
- Regra D-03 corrigida: quando `diaVencimento < diaFechamento` (caso Bradesco: fecha 19, vence 1), o vencimento agora cai corretamente no mês SEGUINTE ao fechamento, em vez de reaproveitar o mesmo mês do fechamento com o vencimento do mês errado.
- Regressão D-05 preservada: cartões com `closing_day < due_day` (ex.: Nubank fecha 5/vence 15) continuam com fechamento e vencimento no MESMO mês.
- `paga = txsAbertas.length === 0` e a ordem de precedência do status (`paga` antes de `vencida`/`fechada`) preservados intactos em `faturasDoCartaoCompleto` (D-04).

## Task Commits

Each task was committed atomically:

1. **Task 1: Criar helper puro computeFaturaDates em fides-data.jsx (D-02/D-03)** - `2b4bca4` (feat)
2. **Task 2: Fazer faturasDoCartao e faturasDoCartaoCompleto consumirem computeFaturaDates** - `e703b34` (fix)

**Plan metadata:** pending (docs: complete plan — committed after this summary)

## Files Created/Modified
- `assets/fides-data.jsx` - Adiciona `computeFaturaDates(mesFatura, card)` imediatamente após `mesFaturaFor`; função pura, sem React, sem dependências novas.
- `assets/fides-store.jsx` - `faturasDoCartao` e `faturasDoCartaoCompleto` substituem o bloco local de cálculo de datas (incluindo o branch `mesF` divergente) por uma única chamada a `computeFaturaDates(fat.mesFatura, card)`.

## Decisions Made
- `computeFaturaDates` foi colocado em `fides-data.jsx` (não em `fides-store.jsx`) porque esse arquivo carrega ANTES via `<script type="text/babel">` sem import/export — garante que o helper esteja em escopo global quando `fides-store.jsx` executa (Pitfall 5 do RESEARCH).
- O branch `if (diaF > diaV) mesF = mes - 1;` foi removido por completo em vez de mantido como caso especial — ele era a própria causa raiz do bug (D-02), não uma regra de compatibilidade a preservar.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Verification Status

- **Automatizado (executado nesta sessão):**
  - Task 1: script Node que extrai e avalia `computeFaturaDates` do arquivo shipado — cobre caso Bradesco (fecha 19/07 · vence 01/08), regressão fecha<vence (mesmo mês) e virada de ano → imprimiu `FAT-01 OK`.
  - Task 2: `grep -c "computeFaturaDates(fat.mesFatura" assets/fides-store.jsx` → 2; `grep -v '^[[:space:]]*//' assets/fides-store.jsx | grep -c 'diaF > diaV'` → 0; `grep -c "fat.txsAbertas.length === 0" assets/fides-store.jsx` → 1; smoke de `dtFechamento`/`dtVencimento` fora de fides-store.jsx/fides-contas.jsx → apenas a própria definição do helper em fides-data.jsx (esperado). Combined `STORE_OK` gate passou.
- **Pendente (human-check, não é checkpoint bloqueante — plano é `autonomous: true` sem tasks de checkpoint):** abrir o app com o cartão Bradesco (fecha 19/vence 1) e confirmar visualmente "Fecha 19/07 · Vence 01/08 · Aberta"; confirmar fatura de junho já paga permanece "Paga"; confirmar cartão fecha<vence (Nubank/Inter mocks) sem inversão. Recomendado rodar via `/gsd-verify-work 10` junto com os demais planos da fase.
- Domínio de cartão sensível (CLAUDE.md) mas a mudança é 100% client-side, derivação de exibição sobre dados já vindos filtrados por RLS (`transactions`/`cards`) — nenhuma escrita, nenhuma nova rota `api/` ou `supabase/` tocada, portanto o gatilho de revisão de segurança obrigatória (paths `api/`/`supabase/`) do CLAUDE.md não se aplica a este plano.

## Next Phase Readiness
- `computeFaturaDates` está disponível globalmente para os planos 10-02/10-03 desta fase, caso precisem da mesma convenção de datas de fatura.
- UAT humano (fecha 19/vence 1, regressão fecha<vence, fatura paga) segue como item a fechar em `/gsd-verify-work 10` após deploy.

---
*Phase: 10-corre-o-fatura-cart-o-hardening-de-importa-o*
*Completed: 2026-07-04*

## Self-Check: PASSED

- FOUND: assets/fides-data.jsx
- FOUND: assets/fides-store.jsx
- FOUND: .planning/phases/10-corre-o-fatura-cart-o-hardening-de-importa-o/10-01-SUMMARY.md
- FOUND: 2b4bca4
- FOUND: e703b34
