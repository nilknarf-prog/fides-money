---
status: complete
phase: 12-ia-2-destravar-write-no-assistente-in-app-b8
source: [12-01-SUMMARY.md, 12-02-SUMMARY.md, 12-03-SUMMARY.md, 12-04-SUMMARY.md, 12-05-SUMMARY.md]
started: 2026-07-12T20:55:00Z
updated: 2026-07-14T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Lançar transação com nova categoria (Bundled)
expected: |
  1. No chat, peça para adicionar uma despesa num cartão em uma categoria que **não existe** (ex: "Gastei 50 no cartão Nubank em dezembro com 'Presentes de Natal'").
  2. O assistente deve exibir um **único card de confirmação** informando que vai criar a categoria "Presentes de Natal" E lançar os 50 reais no cartão.
  3. Ao clicar em "Confirmar", a transação é criada, o status no cartão fica como "Pendente" e o mês da transação segue a data de fechamento da fatura (ignorando o mês selecionado atualmente na UI).
result: issue
reported: "Pedi 'lança 1 real na categoria natal, no cartão de crédito bradesco' e o modal ia lançar na CONTA CORRENTE Bradesco, ignorando 'cartão de crédito'. Quando o usuário fala 'cartão', o bot precisa resolver o CARTÃO, não a conta homônima."
severity: major

### 2. Confirmação obrigatória para criar categoria isolada
expected: |
  1. Peça para o assistente apenas criar uma categoria: "Crie a categoria 'Viagens'".
  2. O assistente **NÃO** deve exibir um toast de sucesso imediatamente.
  3. Em vez disso, ele deve mostrar o card de confirmação. O toast "✓ Categoria criada" só aparece DEPOIS que você clicar em confirmar.
result: pass

### 3. Guardião do atalho ⌘K (Cmd+K)
expected: |
  1. Peça para lançar uma despesa.
  2. Quando o card de confirmação aparecer na tela, pressione o atalho de busca `Cmd+K` (ou `Ctrl+K`).
  3. O Command Palette **NÃO** deve abrir por cima do card.
  4. Feche ou cancele o card, e pressione `Cmd+K` novamente. Agora o Command Palette deve abrir normalmente.
result: pass

### 4. Bloqueio de replay (Nonce Anti-Duplicação)
expected: |
  1. Realize um lançamento com sucesso e confirme.
  2. Inspecione a rede (DevTools) ou use o app normalmente repetindo a operação num cenário simulado de retry/lag de rede (ou simplesmente não haverá erros de 'Rate Limit' em uso contínuo se o LLM decidir usar tools repetidamente na mesma iteração sem quebrar a cota real).
  3. Apenas certifique-se de que operações normais fluem sem erro 429 indevido.
result: issue
reported: "Durante uso real do lançamento via chat, o assistente respondeu 'Ok, cancelei então. Se quiser, é só me pedir de novo. 👍' SEM o usuário ter cancelado. Repro: (1) 'Lance 134,20 Compra Ádria, conta Mercado Pago' → bot pergunta a categoria → usuário responde 'categoria compras' → bot responde 'Ok, cancelei então'. (2) Mandando tudo junto 'Lance 134,20 Compra Ádria, categoria compras, conta Mercado Pago' → bot também responde 'Ok, cancelei então'. (3) Persiste após atualizar a página. Fluxo de WRITE via chat fica inutilizável."
severity: blocker

## Summary

total: 4
passed: 2
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Ao lançar com destino explícito 'cartão de crédito Bradesco', a transação deve ir para o CARTÃO Bradesco (status Pendente, mês pela data de fechamento da fatura), nunca para a conta corrente Bradesco homônima"
  status: failed
  reason: "User reported: 'lança 1 real na categoria natal, no cartão de crédito bradesco' abriu o modal apontando para a CONTA CORRENTE Bradesco, ignorando 'cartão de crédito'. A resolução de conta/cartão por nome (findAccountByName/findCardByName no cliente + args da tool) não desambigua cartão vs conta de mesmo nome quando o usuário diz 'cartão'."
  severity: major
  test: 1
  artifacts: []
  missing: []

- truth: "Ao fornecer os dados de um lançamento via chat (numa mensagem ou em follow-up com a categoria/conta), o assistente deve montar o card de confirmação de WRITE — nunca responder 'Ok, cancelei então' sem o usuário ter cancelado"
  status: failed
  reason: "User reported: fluxo de lançamento via chat responde 'Ok, cancelei então. Se quiser, é só me pedir de novo. 👍' sem cancelamento. Ocorre tanto no follow-up (usuário responde 'categoria compras') quanto mandando tudo junto; persiste após reload. Provável falso-positivo na detecção de tool cancelada (commit 5e161e9 'recognize cancelled write tools correctly') interpretando resposta/tool_result normal como cancelamento."
  severity: blocker
  test: 4
  artifacts: []
  missing: []

