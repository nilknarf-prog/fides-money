---
status: diagnosed
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
  root_cause: "resolveWriteToolArgs (fides-claude.jsx:298-304) resolve conta-primeiro: findAccountByName (:148) usa substring frouxo (.includes) e retorna no 1º acerto; findCardByName só é consultado se NENHUMA conta casar. O qualificador 'cartão' do usuário nunca entra na decisão. Reforço: schema de lancar_transacao (api/assistant.js:117) tem só um STRING opaco conta_ou_cartao, sem discriminador de tipo — o modelo não tem canal para sinalizar 'é cartão'. O caminho correto de cartão (mesFaturaFor + status pending + p_card_id) existe mas fica inalcançável para homônimos."
  artifacts:
    - path: "assets/fides-claude.jsx"
      issue: "resolveWriteToolArgs (:298-304) + findAccountByName (:148): resolução conta-primeiro por substring, ignora o qualificador 'cartão'"
    - path: "api/assistant.js"
      issue: "schema lancar_transacao (:117): destino é STRING único sem discriminador conta/cartão; exemplos induzem a mandar só o nome do banco"
  missing:
    - "Adicionar discriminador de tipo à tool (ex. tipo_destino: enum['conta','cartao'] ou is_cartao) + instrução no system prompt"
    - "Resolver honra o tipo: quando cartão, consultar findCardByName primeiro/exclusivamente (e vice-versa)"
    - "Em match ambíguo entre conta e cartão homônimos, pedir desambiguação em vez de escolher pela ordem"
  debug_session: .planning/debug/cartao-homonimo-vira-conta.md

- truth: "Ao fornecer os dados de um lançamento via chat (numa mensagem ou em follow-up com a categoria/conta), o assistente deve montar o card de confirmação de WRITE — nunca responder 'Ok, cancelei então' sem o usuário ter cancelado"
  status: failed
  reason: "User reported: fluxo de lançamento via chat responde 'Ok, cancelei então. Se quiser, é só me pedir de novo. 👍' sem cancelamento. Ocorre tanto no follow-up (usuário responde 'categoria compras') quanto mandando tudo junto; persiste após reload. Provável falso-positivo na detecção de tool cancelada (commit 5e161e9 'recognize cancelled write tools correctly') interpretando resposta/tool_result normal como cancelamento."
  severity: blocker
  test: 4
  root_cause: "Poluição de histórico + espelhamento pelo modelo. synthesizeWriteReply (fides-claude.jsx:566, commit 68ed3ca) gera a string verbatim 'Ok, cancelei então...' e a persiste como TEXTO de assistente em sessionStorage (TTL 2h, :10/:68-75). O history enviado ao Gemini é montado text-only (:593-595), descartando os turnos de tool_call/tool_result. Quando um cancelamento REAL semeia esse texto (ex. UAT Test 3 mandou cancelar um card antes), o flash-lite — ainda induzido pela regra de prompt de 5e161e9 (api/assistant.js:48) — copia a string verbatim como reply de TEXTO (sem tool_call) nos WRITEs seguintes; o cliente renderiza direto (:674, sem card) e re-persiste → auto-reforço que sobrevive a reload. Caminho de cancelamento local (cancelled:true em :476) foi refutado: só dispara via botão Cancelar."
  artifacts:
    - path: "assets/fides-claude.jsx"
      issue: "history montado só com texto (:593-595) dropa turnos de tool; synthesizeWriteReply (:566) persiste desfecho WRITE como texto espelhável; sessionStorage TTL 2h (:10, :68-75) faz a poluição sobreviver a reload; reply de texto renderizado sem card (:674)"
    - path: "api/assistant.js"
      issue: "regra de prompt (:48, commit 5e161e9) que induz o modelo a falar em cancelamento — amplifica o espelhamento"
  missing:
    - "Não alimentar desfechos WRITE sintetizados como texto espelhável: threadar tool_call/tool_result reais no history OU substituir/omitir as mensagens de desfecho WRITE por nota neutra antes de enviar ao Gemini"
    - "Guard: se um pedido claramente WRITE volta com texto de desfecho ('cancelei'/'lancei') SEM tool_call, não exibir esse texto — forçar a chamada da tool"
    - "Reavaliar a necessidade do addendum de prompt de 5e161e9 agora que cancelamentos são resolvidos localmente"
    - "Desbloqueio imediato da sessão do usuário: limpar sessionStorage fides_assistant_messages"
  debug_session: .planning/debug/assistant-falso-cancelei.md

