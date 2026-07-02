---
phase: 09
slug: transacoes-power-tools-analytics
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-02
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> **Nota:** projeto sem test runner (débito B11 — sem bundler = sem jest/vitest). Validação desta fase é **UAT conversacional manual** via `/gsd-verify-work 09`, padrão já usado nas Phases 06–08. Não há testes automatizados a criar.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Nenhum (Babel-standalone in-browser, sem bundler — ROADMAP B11) |
| **Config file** | — |
| **Quick run command** | — (validação manual no browser) |
| **Full suite command** | `/gsd-verify-work 09` (UAT conversacional dirigindo o app real) |
| **Estimated runtime** | Manual — ~1 min por roteiro TX-0x |

---

## Sampling Rate

- **After every task commit:** Smoke manual no browser da funcionalidade tocada (carrega Transações, exercita o controle novo).
- **After every plan wave:** Rodar o roteiro UAT das TX-0x concluídas na wave.
- **Before `/gsd-verify-work`:** App carrega sem erro no console; todos os controles novos respondem.
- **Max feedback latency:** Imediato (reload do browser — sem deploy necessário para testar client-only).

---

## Per-Task Verification Map

Mapa requisito → roteiro de UAT manual (derivado de `09-RESEARCH.md`). Cada TX-0x é validado dirigindo o app real, não por comando automatizado.

| Req | Plan | Comportamento | Threat Ref | Como verificar (UAT manual) | Test Type | Status |
|-----|------|---------------|------------|------------------------------|-----------|--------|
| TX-01 | TBD | Filtro Cartões isola transações de cartão | — | Abrir filtro avançado → marcar só cartões → lista só mostra `acctInfo.kind === 'cartao'` | manual | ⬜ pending |
| TX-02 | TBD | Paginação 20/50/100 + navegação de página | — | Trocar seletor de qtd → contagem renderizada muda; avançar/voltar página | manual | ⬜ pending |
| TX-03 | TBD | Gasto/categoria cross-month respeita range, exclui `is_transfer` | — | Range 3m → soma bate com soma manual das 3 mensalidades, sem pagamentos de fatura | manual | ⬜ pending |
| TX-04 | TBD | Lista em modo range mostra múltiplos meses | — | Ativar range → transações de >1 mês aparecem juntas | manual | ⬜ pending |
| TX-05 | TBD | Export CSV reflete filtro/range ativo + neutraliza CSV-injection | T-09-CSV | Aplicar filtro → exportar → CSV bate com filtro; descrição iniciando com `=+-@` sai prefixada/neutralizada | manual | ⬜ pending |
| TX-06 | TBD | Reload preserva filtro/sort/mês (localStorage) | — | Aplicar filtro+sort → F5 → estado preservado; localStorage corrompido não quebra app | manual | ⬜ pending |
| TX-07 | TBD | ⌘K abre palette e navega/busca | — | `Cmd+K` / `Ctrl+K` → digitar termo → navegar via resultado | manual | ⬜ pending |
| TX-08 | TBD | Preview de limite no modal Nova Transação | — | Nova Transação → categoria com limite → digitar valor → "restante" atualiza | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Plan column preenchida quando o planner numerar TX-0x → 09-0x-PLAN.md.*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* — Nenhum arquivo de teste a criar. Projeto não usa test runner (sem bundler, débito B11). Validação via roteiro de UAT manual acima, executado por `/gsd-verify-work 09` ao final da fase.

---

## Manual-Only Verifications

Todas as verificações desta fase são manuais (ver Per-Task Verification Map). Motivo comum a todas: sem test runner no projeto até B11. Instruções de teste = coluna "Como verificar" acima.

| Behavior | Req | Why Manual | Test Instructions |
|----------|-----|------------|-------------------|
| Todas TX-01..TX-08 | TX-01..08 | Sem test runner (B11) — Babel-standalone in-browser | Ver coluna "Como verificar (UAT manual)" no mapa acima |

---

## Validation Sign-Off

- [ ] Cada TX-0x tem roteiro de UAT manual explícito no PLAN.md (`<verify>` conversacional)
- [ ] Sampling continuity: smoke manual após cada commit; roteiro UAT após cada wave
- [ ] Wave 0 N/A (sem test runner) — documentado, não é gap silencioso
- [ ] Sem watch-mode flags (não aplicável — sem runner)
- [ ] Feedback latency imediato (reload browser, client-only)
- [ ] `nyquist_compliant: true` definido no frontmatter ao fim da fase

**Approval:** pending
