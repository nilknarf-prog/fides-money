---
phase: 10
slug: corre-o-fatura-cart-o-hardening-de-importa-o
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-03
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — projeto roda React via Babel-standalone no browser, sem build/test/bundler (ROADMAP B11) |
| **Config file** | none |
| **Quick run command** | `node <script de pureza aritmética>` — funções de data de fatura são puras e podem ser extraídas/exercitadas em Node; ver Wave 0 |
| **Full suite command** | manual (UAT) — carregar app, validar caso Bradesco + regressão + reimport |
| **Estimated runtime** | ~manual |

---

## Sampling Rate

- **After every task commit:** validar aritmética de data (caso Bradesco + regressão) via script Node quando aplicável
- **After every plan wave:** UAT manual do slice entregue
- **Before `/gsd-verify-work`:** todos os 5 success criteria (FAT-01, FAT-01 regressão, IMP-01, IMP-02, UX-03/04) verificados
- **Max feedback latency:** manual

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _(planner/executor preenche por task)_ | — | — | FAT-01 / IMP-01 / IMP-02 / UX-03 / UX-04 | — | — | — | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Extrair a lógica de data de fatura (`dtFechamento`/`dtVencimento` de D-03) para uma função pura testável em Node — permite validar caso Bradesco (fecha 19/07 · vence 01/08), regressão (`closing_day < due_day`) e virada de ano sem carregar o browser.
- [ ] Dataset/fixture de dedupe: um CSV pequeno + o mesmo CSV reimportado → asserção de 0 novas gravações (IMP-02).

*Projeto não tem framework de teste hoje; validação é majoritariamente manual (UAT) + scripts Node pontuais para as funções puras.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fatura Bradesco exibe "fecha 19/07 · vence 01/08 · aberta" | FAT-01 | Exibição no browser (React/Babel-standalone) | Abrir Contas → cartão Bradesco (fecha 19/vence 1) com compras 19/06→11/07; conferir texto e status; fatura de junho paga permanece paga |
| Cartão `closing_day < due_day` mantém datas corretas | FAT-01 (regressão) | Exibição no browser | Abrir cartão que fecha e vence no mesmo mês; datas não invertem |
| Modal de preview do import (seleção + confirmação + cancelar não grava) | IMP-01 | Fluxo de UI + gravação | Importar CSV/OFX; conferir preview, marcar/desmarcar, cancelar (0 gravações), confirmar (grava selecionadas) |
| Reimport do mesmo arquivo → 0 duplicatas | IMP-02 | Estado do banco pós-import | Importar CSV, depois reimportar o mesmo; duplicatas aparecem desmarcadas; 0 novas gravações |
| Botão "Cartão" no masthead + hover/tap por categoria no modo Período | UX-03/UX-04 | Interação visual | Clicar "Cartão" filtra crédito sem abrir Filtros; no modo Período cada categoria da legenda tem barra e valor aparece no hover/tap |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency documented
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
