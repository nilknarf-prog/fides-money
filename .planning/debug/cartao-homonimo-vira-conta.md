---
status: diagnosed
trigger: "UAT Phase 12: 'lança 1 real na categoria natal, no cartão de crédito bradesco' — modal WRITE abriu apontando para a CONTA CORRENTE Bradesco em vez do CARTÃO de crédito Bradesco (nomes homônimos)"
created: 2026-07-14T00:00:00Z
updated: 2026-07-14T00:00:00Z
mode: find_root_cause_only
---

## Current Focus

hypothesis: A resolução de destino em `resolveWriteToolArgs` é "conta-primeiro" e retorna no primeiro acerto por substring, ignorando o qualificador "cartão". Além disso, o schema da tool `lancar_transacao` não tem campo de tipo (conta vs cartão), então o modelo não tem canal para sinalizar "isto é um cartão".
test: Ler o caminho de execução WRITE (findAccountByName/findCardByName, resolveWriteToolArgs, schema da tool).
expecting: Confirmado — conta resolvida antes do cartão, cartão só consultado se NENHUMA conta casar.
next_action: Retornar ROOT CAUSE FOUND ao orquestrador (modo diagnose-only; NÃO corrigir código).

## Symptoms

expected: Quando o usuário diz explicitamente "cartão"/"cartão de crédito", o destino deve resolver para o CARTÃO (status Pendente, mês derivado do fechamento da fatura), nunca para uma conta corrente homônima.
actual: O modal de confirmação abriu apontando para a CONTA CORRENTE Bradesco (type: account) em vez do CARTÃO de crédito Bradesco.
errors: nenhum erro lançado — silenciosamente escolheu o alvo errado.
reproduction: Ter uma conta E um cartão com nomes homônimos ("Bradesco"). No chat: "lança 1 real na categoria natal, no cartão de crédito bradesco". O modal aponta para a conta.
started: Phase 12 (reativação das tools WRITE — gate B8).

## Evidence

- timestamp: 2026-07-14T00:00:00Z
  checked: fides-claude.jsx:296-346 (resolveWriteToolArgs → lancar_transacao)
  found: |
    const ref = args.conta_ou_cartao || '';
    const acc = findAccountByName(ref);
    const card = !acc ? findCardByName(ref) : null;   // cartão SÓ se conta não casar
    ...
    target: acc ? { type: 'account', ... } : { type: 'card', ... }
  implication: Precedência absoluta da conta. Se qualquer conta casar o nome, o cartão nunca é sequer consultado, e target = account.

- timestamp: 2026-07-14T00:00:00Z
  checked: fides-claude.jsx:145-149 (findAccountByName)
  found: |
    return (accounts||[]).find(a => a.name && a.name.toLowerCase().includes(q)) || null;
  implication: Match por substring frouxo. ref="bradesco" casa "Conta Corrente Bradesco". Homônimos são inerentemente ambíguos e a conta ganha por ordem.

- timestamp: 2026-07-14T00:00:00Z
  checked: api/assistant.js:117 (declaração da tool lancar_transacao)
  found: |
    conta_ou_cartao: { type: 'STRING', description: 'Nome da conta ou cartão de destino. Ex: "Nubank", "Bradesco", "Inter". Obrigatório.' }
  implication: Um único campo STRING opaco. Não há discriminador tipo_destino / is_cartao. Os exemplos ("Nubank", "Bradesco", "Inter") ainda incentivam o modelo a enviar só o nome do banco, descartando a palavra "cartão". O qualificador do usuário é perdido no schema.

- timestamp: 2026-07-14T00:00:00Z
  checked: fides-claude.jsx:138-139 (buildContext) e fides-claude.jsx:402-407 (executeWriteTool card path)
  found: |
    Contexto lista Contas e Cartões SEPARADAMENTE (o modelo sabe qual é qual).
    O caminho de cartão (mesFaturaFor + p_status 'pending' + p_card_id) existe e está correto —
    mas só roda quando isCard = (target.type === 'card'), que nunca ocorre no caso homônimo.
  implication: O comportamento esperado (Pendente, mês pela fatura) está codificado porém inalcançável para homônimos, porque a precedência conta-primeiro decide antes.

## Eliminated

- hypothesis: O erro está no cálculo de mês/fatura (mesFaturaFor) do cartão.
  evidence: Esse código (linhas 402-407) nunca é atingido no caso homônimo — target já vira 'account' antes. O sintoma não é "mês errado no cartão", é "virou conta".
  timestamp: 2026-07-14T00:00:00Z

## Resolution

root_cause: |
  Dois defeitos convergentes, ambos empurrando homônimos para a conta:
  (1) fides-claude.jsx:298-304 — resolveWriteToolArgs resolve conta ANTES do cartão e retorna no
      primeiro acerto: `const acc = findAccountByName(ref); const card = !acc ? findCardByName(ref) : null;`
      com `target: acc ? account : card`. Qualquer conta que case o nome vence; o cartão nunca é
      consultado. findAccountByName (linha 148) usa `.includes(q)` frouxo, então "bradesco" casa a
      conta corrente homônima.
  (2) api/assistant.js:117 — o schema de lancar_transacao expõe apenas um STRING `conta_ou_cartao`,
      sem discriminador de tipo (tipo_destino/is_cartao). O modelo sabe distinguir conta de cartão
      (o contexto lista os dois separadamente), mas não tem canal na tool para transmitir isso, e os
      exemplos "Nubank/Bradesco/Inter" o induzem a mandar só o nome do banco. A palavra "cartão"
      dita pelo usuário se perde entre o schema e o resolver.
fix: (pendente — modo diagnose-only)
verification: (pendente)
files_changed: []
