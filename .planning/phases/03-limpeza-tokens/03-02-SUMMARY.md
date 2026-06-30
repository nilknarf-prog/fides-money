---
phase: 03-limpeza-tokens
plan: "02"
subsystem: frontend-css
status: complete
tags: [design-tokens, css-cleanup, audit, dead-code]
dependency_graph:
  requires: [03-01]
  provides: [warn-bg-token-resolved, css-audit-evidence]
  affects: [assets/fides-orcamento.css]
tech_stack:
  added: []
  patterns: [css-custom-properties, evidence-driven-dead-code-audit]
key_files:
  created: []
  modified:
    - assets/fides-orcamento.css
decisions:
  - "DESIGN-04: token fantasma --warn-bg resolvido para var(--warn-soft) (token de marca #FEF0D6)"
  - "Zero duplicatas verdadeiras: todas as repeticoes de seletor sao overrides @container/@media (propriedades diferentes), nao redundantes"
  - "Orfaos mantidos por precaucao: construcao dinamica via template string OU regras interleaved com codigo vivo OU slots de UI desenhados-mas-nao-ligados"
metrics:
  duration_seconds: 0
  completed_date: "2026-06-29"
  task_count: 3
  file_count: 1
---

# Phase 03 Plan 02: Auditoria CSS (Limpeza + Tokens) Summary

## One-liner

Auditoria conservadora dirigida por evidencia de `fides.css`, `fides-studio.css` e `fides-orcamento.css`: token fantasma `--warn-bg` resolvido para `var(--warn-soft)`; zero duplicatas verdadeiras encontradas (todas eram overrides responsivos); orfaos identificados mas mantidos por precaucao (construcao dinamica ou interleaving com codigo vivo).

## Status: COMPLETE

Todas as 3 tasks concluidas. Task 3 (checkpoint:human-verify) APROVADO via verificacao humana: zero regressao visual em todas as paginas e em 400×512px; alerta `.pln-resumo-alert--warn` confirmado com fundo ambar de marca (`--warn-soft` #FEF0D6).

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Mapear seletores vivos vs orfaos e tokens fantasma (auditoria) | — (sem edicao) | Done (evidencia abaixo) |
| 2 | Remover duplicatas/orfaos e resolver tokens fantasma | b89c682 | Done |
| 3 | Checkpoint — verificar ausencia de regressao visual | — | Approved (verificacao humana) |

---

## Task 1 — Evidencia de auditoria (3 listas)

### Lista A — TOKENS FANTASMA (`var(--x)` consumido sem `--x` definido em tokens.css/fides.css/fides-studio.css/fides-orcamento.css)

Todos concentrados em `fides-orcamento.css`, todos com fallback inline funcional:

| Token consumido | Linha | Fallback inline | Disposicao |
|-----------------|-------|-----------------|------------|
| `--warn-bg` | fides-orcamento.css:725 | `#fbf1e5` | **RESOLVIDO** → `var(--warn-soft)` (Task 2) |
| `--danger` | fides-orcamento.css:697, 722 | `#b33a3a` | Mantido (fallback funcional; fora do escopo explicito do plano) |
| `--danger-bg` | fides-orcamento.css:721 | `#f8e5e5` | Mantido (fallback funcional) |
| `--green-700` | fides-orcamento.css:696 | `#2d4f3a` | Mantido (fallback funcional) |
| `--ink-primary` | fides-orcamento.css:693 | `#1f1f1f` | Mantido (fallback funcional) |
| `--ink-secondary` | fides-orcamento.css:662 | `#6b6b6b` | Mantido (fallback funcional) |
| `--ink-tertiary` | fides-orcamento.css:668, 686, 698 | `#9a9a9a` | Mantido (fallback funcional) |
| `--surface` | fides-orcamento.css:647 | `#fff` | Mantido (fallback funcional) |
| `--surface-raised` | fides-orcamento.css:669 | `#f3f0e8` | Mantido (fallback funcional) |

Nota: o plano (Task 2) mandata explicitamente resolver apenas `--warn-bg` → `var(--warn-soft)`. Os demais tokens fantasma tem fallback inline coerente e renderizam corretamente hoje; substitui-los por tokens de marca seria mudanca de valor/cor (fora do escopo "so REMOVE/RESOLVE warn-bg"). Registrados aqui para fase futura de migracao de tokens.

`--font-serif` aparenta fantasma na primeira passada mas ESTA definido (fides.css:19 `'Instrument Serif'`; fides-studio.css:13 alias legacy). NAO e fantasma.

### Lista B — DUPLICATAS (mesmo seletor declarado 2+ vezes NO MESMO arquivo)

**Conclusao: ZERO duplicatas verdadeiras (redundantes).** Toda repeticao de seletor tem propriedades DIFERENTES = override intencional, nao redundancia. Detalhe:

| Arquivo | Seletor | Ocorrencias | Veredicto |
|---------|---------|-------------|-----------|
| fides.css | `.fds-seg` | L1037 (bloco grid) + L1046 (`margin` only) | Override intencional — props diferentes |
| fides-studio.css | `.fds-notif-panel` | L629 (base) + L697 (dentro de `@media max-width:768px`) | Override responsivo |
| fides-orcamento.css | `.pln-body`, `.pln-head`, `.pln-title`, `.pln-title-mark`, `.pln-copy-btn`, `.pln-group-cats`, `.pln-cat.open`, `.pln-sheet`, `.pln-sheet-backdrop`, `.pln-months-grid`, `.pln-head-top` | base + dentro de `@container (min-width:680px/960px)` (L533-575) | Overrides de container query |
| fides-orcamento.css | `.pln-resumo`, `.pln-rule-card`, `.pln-group`, `.pln-mes-insights` | declaracao `order:N` (L118-121) + bloco completo | Props diferentes (so layout order) — ambos necessarios |

Nenhuma remocao de duplicata aplicada porque nao existe par redundante (mesmo seletor + mesmas props no mesmo escopo).

### Lista C — SELETORES ORFAOS (classe `.xxx` em CSS sem `className` correspondente em nenhum `*.jsx` nem `*.html`)

Candidatos por busca de substring literal (484 classes auditadas nos 3 arquivos). Veredicto final apos checar construcao dinamica (template string / concatenacao) e interleaving com codigo vivo:

**MANTIDOS POR PRECAUCAO — construcao dinamica (classe construida em runtime):**

| Classe(s) | Prova de uso dinamico |
|-----------|------------------------|
| `.fds-notif-info`, `.fds-notif-warning` | fides-studio.jsx:503 `` `fds-notif-item fds-notif-${n.type}` `` — `n.type` e dado dinamico |
| `.pln-mi-card--ok`, `.pln-mi-card--warn`, `.pln-mi-card--bad` | fides-orcamento.jsx:1009 `'pln-mi-card pln-mi-card--' + card.tone` — tone ∈ {ok,warn,bad} (confirmado L925-968) |
| `.prf-msg--erro`, `.prf-msg--ok` | fides-studio.jsx:610 `'prf-msg prf-msg--' + msg.type` |
| `.pln-resumo-muted` | irmao de `.pln-resumo-pos`/`.pln-resumo-neg` construidos dinamicamente (fides-orcamento.jsx:134) |

**MANTIDOS POR PRECAUCAO — interleaved com regras vivas / slots desenhados:**

| Classe(s) | Razao |
|-----------|-------|
| Bloco legado `.fds-tx-*` v1 (`.fds-tx-table`, `.fds-tx-search`, `.fds-tx-bulk*`, `.fds-tx-actions`, `.fds-tx-amt`, `.fds-tx-chips`, `.fds-tx-count`, `.fds-tx-date`, `.fds-tx-desc*`, `.fds-tx-filter*`, `.fds-tx-foot`, `.fds-tx-kpis`, `.fds-tx-months`, `.fds-tx-pager`, `.fds-tx-row-act`, `.fds-tx-sum`, `.fds-tx-year*`), `.fds-month`, `.fds-pg` (fides.css L755-992) | **`.fds-tx-kpi`/`.fds-tx-kpi-head`/`.fds-tx-kpi-amt`/`.fds-tx-kpi-pending` (L760-771) SAO VIVOS** (fides-transacoes.jsx:916+) e estao interleaved no mesmo bloco. A view viva usa `fds-tx-v2-*`/`fds-tx-adv-*` (distintos). Remocao cirurgica do legado risca tocar regras vivas → mantido por precaucao. |
| `.fds-workspace-plan` (fides.css:175) | Irmao de `.fds-workspace`/`-mark`/`-meta`/`-name` vivos (fides-shell.jsx:65-70); slot de subtitulo de plano desenhado mas ainda nao renderizado |
| `.pln-toast`, `.pln-toast-wrap` (fides-orcamento.css:483-495) | Sistema de toast desenhado (com keyframe `pln-toast-in`) ainda nao ligado; sem estado visual atual para validar no checkpoint |
| `.pln-proj-warn` (fides-orcamento.css:638) | Indicador de projecao (Lote 4C) desenhado mas nao ligado |
| `.pln-resumo-alert--warn` (fides-orcamento.css:724) | Par de variante desenhado (`--danger` vivo; `--warn` e o par); alvo do fix de token --warn-bg |

**Veredicto Task 1→Task 2:** Nenhum seletor removido. A unica acao segura de alto valor e a resolucao do token fantasma `--warn-bg`. Regra conservadora aplicada integralmente: "se ha QUALQUER duvida, nao remover".

---

## Task 2 — Acoes aplicadas

**Arquivo editado:** `assets/fides-orcamento.css` (linha 725)
- De: `background: var(--warn-bg, #fbf1e5);`
- Para: `background: var(--warn-soft);`
- `--warn-soft` = `#FEF0D6` (token de marca, tokens.css:43)
- Alinha o alerta de orcamento (`.pln-resumo-alert--warn`) ao sistema de tokens; consistente com `.pln-status.warn` (L206) e `.pln-mi-card--warn` (L788) que ja usavam `var(--warn-soft)`

**Commit:** `b89c682`

Nenhuma outra edicao. Nenhuma duplicata removida (nao havia redundante). Nenhum orfao removido (todos mantidos por precaucao, evidencia acima).

## Verification Results

| Criterio | Resultado |
|---------|-----------|
| `grep -nE "var\(--warn-bg" assets/*.css` → 0 resultados | PASS (OK-NO-PHANTOM-WARNBG) |
| Chaves `{`/`}` balanceadas nos 3 arquivos | PASS (OK-BRACES-BALANCED) |
| `--warn-soft` definido em tokens.css | PASS (#FEF0D6, L43) |
| Nenhuma classe com className vivo em JSX removida | PASS (nenhuma classe removida) |
| Task 3 checkpoint visual | APPROVED (humano: zero regressao em todas paginas + 400×512px; alerta --warn ambar OK) |

## Deviations from Plan

Nenhuma remocao de orfao/duplicata aplicada — desvio conservador DENTRO da regra do plano ("se ha qualquer duvida, nao remover; registrar como mantido por precaucao"). Justificativa por item na Lista C acima. A auditoria comprovou que:
1. Nao existem duplicatas redundantes (todas sao overrides @container/@media).
2. Todos os orfaos candidatos sao dinamicos, interleaved com codigo vivo, ou slots desenhados nao-ligados.
A unica acao segura de valor (resolucao de token fantasma `--warn-bg`) foi aplicada.

## Threat Surface Scan

Nenhum endpoint de rede, path de auth, acesso a arquivo ou schema novo. Mudanca puramente cosmetica de valor de token CSS. T-03-03/T-03-04 mitigados: remocao dirigida por evidencia (grep className), chaves balanceadas verificadas, checkpoint humano percorre todas as paginas.

## Known Stubs

Slots de UI desenhados mas ainda nao ligados (mantidos por precaucao, nao sao regressao):
- `.pln-toast`/`.pln-toast-wrap` (sistema de toast) — fides-orcamento.css:483
- `.pln-proj-warn` (indicador de projecao Lote 4C) — fides-orcamento.css:638
- `.fds-workspace-plan` (subtitulo de plano) — fides.css:175
- Bloco legado `.fds-tx-*` v1 — fides.css:755-992 (superseded por `fds-tx-v2-*`, mantido por interleaving com `.fds-tx-kpi*` vivo)

Resolucao futura: fase dedicada de remocao do bloco legado `.fds-tx-*` v1 com extracao previa das regras vivas `.fds-tx-kpi*`.

## Checkpoint Task 3 — instrucoes de verificacao humana

Tipo: human-verify (regressao visual)

1. Abrir o app (push em main → Vercel auto-deploy).
2. Navegar: Dashboard, Transacoes, Orcamento/Planejamento, Contas, Metas, Perfil.
3. Confirmar que nada quebrou visualmente — cards, modais, badges (.pln-status.warn), graficos, avatares identicos ao estado anterior.
4. Em 400×512px (iOS Safari / DevTools responsivo) confirmar layout intacto.
5. ESPECIFICO: alerta de orcamento `.pln-resumo-alert--warn` — o fundo de aviso deve continuar ambar suave de marca (`--warn-soft` #FEF0D6).

Resume signal: "approved" se nada regrediu; ou descreva o que quebrou.

## Self-Check: PASSED

- assets/fides-orcamento.css — FOUND
- 03-02-SUMMARY.md — FOUND
- commit b89c682 — FOUND
