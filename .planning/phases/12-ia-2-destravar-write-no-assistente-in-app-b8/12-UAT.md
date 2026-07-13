---
status: testing
phase: 12-ia-2-destravar-write-no-assistente-in-app-b8
source: [12-01-SUMMARY.md, 12-02-SUMMARY.md, 12-03-SUMMARY.md, 12-04-SUMMARY.md, 12-05-SUMMARY.md]
started: 2026-07-12T20:55:00Z
updated: 2026-07-12T20:55:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Lançar transação com nova categoria (Bundled)
expected: |
  1. No chat, peça para adicionar uma despesa num cartão em uma categoria que **não existe** (ex: "Gastei 50 no cartão Nubank em dezembro com 'Presentes de Natal'").
  2. O assistente deve exibir um **único card de confirmação** informando que vai criar a categoria "Presentes de Natal" E lançar os 50 reais no cartão.
  3. Ao clicar em "Confirmar", a transação é criada, o status no cartão fica como "Pendente" e o mês da transação segue a data de fechamento da fatura (ignorando o mês selecionado atualmente na UI).
awaiting: user response

## Tests

### 1. Lançar transação com nova categoria (Bundled)
expected: |
  1. No chat, peça para adicionar uma despesa num cartão em uma categoria que **não existe** (ex: "Gastei 50 no cartão Nubank em dezembro com 'Presentes de Natal'").
  2. O assistente deve exibir um **único card de confirmação** informando que vai criar a categoria "Presentes de Natal" E lançar os 50 reais no cartão.
  3. Ao clicar em "Confirmar", a transação é criada, o status no cartão fica como "Pendente" e o mês da transação segue a data de fechamento da fatura (ignorando o mês selecionado atualmente na UI).
result: [pending]

### 2. Confirmação obrigatória para criar categoria isolada
expected: |
  1. Peça para o assistente apenas criar uma categoria: "Crie a categoria 'Viagens'".
  2. O assistente **NÃO** deve exibir um toast de sucesso imediatamente.
  3. Em vez disso, ele deve mostrar o card de confirmação. O toast "✓ Categoria criada" só aparece DEPOIS que você clicar em confirmar.
result: [pending]

### 3. Guardião do atalho ⌘K (Cmd+K)
expected: |
  1. Peça para lançar uma despesa.
  2. Quando o card de confirmação aparecer na tela, pressione o atalho de busca `Cmd+K` (ou `Ctrl+K`).
  3. O Command Palette **NÃO** deve abrir por cima do card.
  4. Feche ou cancele o card, e pressione `Cmd+K` novamente. Agora o Command Palette deve abrir normalmente.
result: [pending]

### 4. Bloqueio de replay (Nonce Anti-Duplicação)
expected: |
  1. Realize um lançamento com sucesso e confirme.
  2. Inspecione a rede (DevTools) ou use o app normalmente repetindo a operação num cenário simulado de retry/lag de rede (ou simplesmente não haverá erros de 'Rate Limit' em uso contínuo se o LLM decidir usar tools repetidamente na mesma iteração sem quebrar a cota real).
  3. Apenas certifique-se de que operações normais fluem sem erro 429 indevido.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0

## Gaps

