---
status: testing
phase: 06-fix-v1-0-tech-debt
source: [06-VERIFICATION.md]
started: 2026-06-30
updated: 2026-06-30
---

## Current Test

number: 1
name: Animação de saída nos 4 painéis reais de Metas
expected: |
  Em viewport 400×512 (mobile), abrir e fechar cada painel real de Metas
  (SimularPanel, RevisarPanel, AplicarPanel, EmBreveModal) pelo X, pelo backdrop
  e pelo botão de ação. Esperado: fade-out + slide-down visível (~180ms) na saída
  e reabertura limpa (sem estado "preso" de is-closing).
awaiting: user response

## Tests

### 1. Animação de saída nos 4 painéis reais de Metas
expected: Fechar via X / backdrop / botão dispara fade-out + slide-down (~180ms); reabre limpo em 400×512
result: [pending]

### 2. Reduced-motion nos modais de Metas
expected: Com `prefers-reduced-motion: reduce`, fechar os modais de Metas é instantâneo — sem movimento/slide
result: [pending]

### 3. Single-close no save-and-close do NovaTransacaoModal
expected: Salvar transação via "Lançar" fecha o modal com animação, reabre limpo, sem flicker de double-close
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
