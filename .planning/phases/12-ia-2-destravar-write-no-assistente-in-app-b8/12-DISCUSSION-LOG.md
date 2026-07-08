# Phase 12: IA-2 Destravar WRITE no assistente in-app (B8) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-07
**Phase:** 12-ia-2-destravar-write-no-assistente-in-app-b8
**Areas discussed:** Caminho do insert (RPC vs código atual), Caminho de update, Fix do rate-limit bypass, Nonce design, Criar categoria no lançamento, Escopo de editar_transacao

---

## Adendo inicial (fora de escopo)

Usuário abriu a sessão com um adendo: "nas transações, as compras parceladas apareçam o número da parcela de cada mês." Esse pedido não pertence à fase 12 (que é sobre WRITE no assistente IA, não sobre exibição de transações parceladas) e nenhuma fase existente no ROADMAP cobre isso.

**Pergunta:** Como prosseguir com o adendo fora de escopo?

| Opção | Selecionada |
|---|---|
| Guardar para backlog, seguir fase 12 | ✓ |
| Criar nova fase agora para parcelas | |
| Considerar parte da fase 12 mesmo | |

**Resultado:** Registrado em Deferred Ideas do CONTEXT.md; discussão da fase 12 seguiu normalmente.

---

## Caminho do insert (lancar_transacao)

| Option | Description | Selected |
|--------|-------------|----------|
| Só assistente por agora | RPC `wa_log_transaction` nova, usada só por `lancar_transacao`. Modal "Nova Transação" continua como está. | ✓ |
| Migrar também o modal | RPC vira caminho único de insert (modal + assistente + futuro WhatsApp). | |

**User's choice:** Só assistente por agora (recomendado).
**Notes:** Reduz blast radius da fase 12 — modal já é fluxo estável em produção, migrar junto seria escopo extra e risco de regressão.

---

## Caminho de update (recategorizar_transacao / editar_transacao)

| Option | Description | Selected |
|--------|-------------|----------|
| Mantém updateTransaction atual | Update simples via RLS já é seguro; sem risco de saldo incremental. | ✓ |
| Tudo via RPC dedicada | Cria RPC(s) de update com guarda SECURITY DEFINER também para recategorizar/editar. | |

**User's choice:** Mantém updateTransaction atual (recomendado).
**Notes:** Sem mutação incremental de saldo em jogo nessas duas operações — RLS já basta.

---

## Fix do rate-limit bypass (toolResults forjado)

| Option | Description | Selected |
|--------|-------------|----------|
| Contar toda chamada HTTP | Simples, sem estado novo; turno com 2+ tool calls gasta 2x da cota. | |
| Nonce assinado de curta duração | Mais preciso; requer mais código/estado num arquivo já sensível. | ✓ |

**User's choice:** Nonce assinado de curta duração (não seguiu a recomendação — escolheu a alternativa mais precisa).
**Notes:** Fold do todo `ratelimit-bypass-toolresults.md` (severity high, achado do security-reviewer da fase 11) — usuário quis a solução mais granular em vez da mais simples.

### Follow-up: design do nonce

| Option | Description | Selected |
|--------|-------------|----------|
| JWT assinado stateless | HMAC/JWT curto (exp ~30-60s), sem tabela nova, sem estado no banco. | ✓ |
| Registro em tabela | Nonce de uso único gravado em tabela, mais garantia contra reuso, mas exige schema novo. | |

**User's choice:** JWT assinado stateless (recomendado).

---

## Criar categoria dentro do lançamento

| Option | Description | Selected |
|--------|-------------|----------|
| 1 fluxo | Card de confirmação já mostra "vou criar categoria X e lançar"; 1 confirmação cobre os dois. | ✓ |
| Mantém 2 passos | Assistente avisa que categoria não existe e sugere `criar_categoria` separado. | |

**User's choice:** 1 fluxo (recomendado).
**Notes:** Menos fricção, mantém confirmação única (honestidade preservada).

---

## Mover conta/cartão via chat (editar_transacao)

| Option | Description | Selected |
|--------|-------------|----------|
| Fora do assistente por agora | `editar_transacao` continua só valor/descricao/data/status. | ✓ |
| Habilitar também no chat | `editar_transacao` ganha campo `conta_ou_cartao`, reusando `updateTransaction`. | |

**User's choice:** Fora do assistente por agora (recomendado).
**Notes:** Trocar conta/cartão mexe em saldo de 2 entidades — risco maior fica restrito ao modal do app.

---

## Claude's Discretion

- Nome/formato exato do nonce (claims do JWT, algoritmo) — planner/researcher decide, desde que stateless e expiração curta.
- Estrutura interna de parâmetros da RPC `wa_log_transaction` — espelhar `pay_card_invoice`.

## Deferred Ideas

- Número da parcela do mês em compras parceladas (transações) — adendo inicial, fora de escopo da fase 12, vira fase própria no roadmap.
- Migrar o modal "Nova Transação" para `wa_log_transaction` — fase de hardening dedicada futura.
- Trocar conta/cartão de uma transação via chat — permanece só no modal do app.

### Todo reviewed e removido (fora do fold)

`analise-ia-resposta-autocontida.md` — já resolvido pelo commit `e40f7e7`; arquivo apagado de `.planning/todos/pending/` durante esta sessão por decisão do usuário.
