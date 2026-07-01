---
status: testing
phase: 07-crud-metas
source: [07-VERIFICATION.md]
started: 2026-07-01
updated: 2026-07-01
---

## Current Test

number: 1
name: Layout do modal + date picker nativo (400×512px iOS Safari)
expected: |
  Abrir CriarMetaModal em 400×512px iOS Safari mostra todos os campos (emoji, nome, descrição, alvo, prazo, cor) sem scroll horizontal; o input de prazo abre o date picker nativo do iOS e bloqueia datas passadas (min=hoje).
awaiting: user response

## Tests

### 1. Layout do modal + date picker nativo
expected: CriarMetaModal e AjustarPlanoModal abrem em 400×512px iOS Safari com os campos nome/alvo/prazo/emoji/cor/descrição sem scroll horizontal; input de prazo abre o date picker nativo e bloqueia datas passadas.
result: [pending]

### 2. CTAs de empty-state abrem CriarMetaModal
expected: Em conta sem metas, tanto "Criar primeira meta" (empty-state de topo, antes mal-cabeado ao modal de transação) quanto "+ Nova meta" abrem o CriarMetaModal — nenhum abre "Em breve" nem o modal de Nova Transação. Salvar cria a meta e ela aparece na lista sem reload (META-01).
result: [pending]

### 3. Dots menu Editar/Excluir
expected: No menu de 3 pontos de uma meta, "Editar meta" abre o AjustarPlanoModal preenchido (nome/alvo/prazo/descrição); "Excluir meta" abre o MetConfirmDeleteModal. Editar e salvar reflete na lista sem reload (META-02); confirmar exclusão remove a meta sem reload (META-03). "Concluir" ainda abre "Em breve" (deferido).
result: [pending]

### 4. Persistência cross-reload
expected: Após criar/editar/excluir uma meta, dar F5 (reload) — as mudanças persistem (escrita live em goals, não só UI otimista) (META-04).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
