---
phase: 13-ia-3-gating-premium-in-app
reviewed: 2026-07-16T00:00:00Z
depth: standard
scope: delta 13-05 (20f7cd2^..HEAD)
files_reviewed: 2
files_reviewed_list:
  - api/assistant.js
  - assets/fides-claude.jsx
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 13: Code Review Report (delta 13-05)

**Reviewed:** 2026-07-16
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

> Nota: revisão focada exclusivamente na delta do plano gap-closure 13-05
> (`20f7cd2^..HEAD`). A revisão dos planos 13-01..13-04 (8 arquivos) está no
> histórico git (commit e926169).

## Summary

Delta do 13-05: defesa em profundidade do GATE-03 (gating premium do assistente IA). Três mudanças: (1) `WRITE_NAMES` derivada de `WRITE_FUNCTIONS`; (2) guard 403 no caminho de retorno do Gemini em `api/assistant.js`; (3) guard cliente em `executeTools` de `fides-claude.jsx`.

Avaliação geral: **a delta é sólida e correta.** Verifiquei os quatro pontos pedidos:

- **(a) Guard 403 impede relay/execução de WRITE para conta free sem novo bypass nem "headers already sent"** — CONFIRMADO. O guard (linhas 455-459) roda dentro de `if (toolCalls.length > 0)`, ANTES de assinar o nonce e do `res.status(200).json({ tool_calls })`. É o único `res.*` daquele caminho; a telemetria anterior (linhas 433-447) só faz UPDATE no banco, não envia headers. Fail-closed: `isPremium` lido do banco por request (linha 254) com default `free` (linhas 238-254).
- **(b) `WRITE_NAMES` deriva de `WRITE_FUNCTIONS` sem drift** — CONFIRMADO. `new Set(WRITE_FUNCTIONS.map(f => f.name))` (linha 190). Fonte única, sem re-hardcode.
- **(c) `FREE_TIER_ADDENDUM` não reintroduz os 4 nomes literais** — CONFIRMADO. A nova string (linha 347) descreve a restrição de forma comportamental ("ferramentas de consulta (saldo e extrato)", "não pode lançar, editar, recategorizar ou criar") sem citar `lancar_transacao`/`recategorizar_transacao`/`editar_transacao`/`criar_categoria`.
- **(d) Guard cliente não viola Rules of Hooks nem usa diálogo nativo** — CONFIRMADO. Reusa `fs.isPremium` do `useFides()` do topo do componente (linha 36); nenhum hook novo dentro do loop/callback; nenhum `confirm()`/`alert()`. `fs.isPremium` existe no contexto (fides-store.jsx:1380) e é fail-closed `false` por padrão (fides-store.jsx:1432).

Nenhum BLOCKER encontrado. As observações abaixo são de maintainability e comportamento de borda; o servidor permanece a autoridade e está correto.

## Warnings

### WR-01: Guard cliente decide segurança por lista hardcoded que pode divergir da fonte derivada do servidor

**File:** `assets/fides-claude.jsx:33` e `assets/fides-claude.jsx:511`
**Issue:** O guard de gating do lado cliente decide com base em `TOOLS_REQUIRING_CONFIRMATION`, uma lista **hardcoded** (`['lancar_transacao', 'recategorizar_transacao', 'editar_transacao', 'criar_categoria']`). No servidor, a mesma decisão usa `WRITE_NAMES`, **derivada** de `WRITE_FUNCTIONS`. Se no futuro uma 5ª função WRITE for adicionada a `WRITE_FUNCTIONS` (servidor) e alguém esquecer de atualizar `TOOLS_REQUIRING_CONFIRMATION` (cliente), a camada cliente do defense-in-depth silenciosamente deixa de gatear a nova tool — sem erro, sem teste que pegue. O servidor ainda protege, mas o propósito do 13-05 é redundância; um drift derrota uma das camadas sem sinal.
**Fix:** Tornar explícito o acoplamento das duas listas, ou adicionar comentário/asserção de sincronização:
```js
// DEVE espelhar WRITE_FUNCTIONS de api/assistant.js — ao adicionar uma tool WRITE,
// atualize as DUAS listas (server WRITE_NAMES é derivada; esta é hardcoded).
const TOOLS_REQUIRING_CONFIRMATION = ['lancar_transacao', 'recategorizar_transacao', 'editar_transacao', 'criar_categoria'];
console.assert(TOOLS_REQUIRING_CONFIRMATION.length === 4, 'sync com WRITE_FUNCTIONS (api/assistant.js)');
```
Quando houver build step (ROADMAP B11), importar de uma constante compartilhada.

### WR-02: Guard cliente reenvia resultado de erro ao Gemini em vez de encerrar localmente (round-trip + cota extra)

**File:** `assets/fides-claude.jsx:511-514` (interação com `assets/fides-claude.jsx:748-757`)
**Issue:** Quando o guard cliente dispara, faz `results.push({ ...result: { error: 'PREMIUM_REQUIRED' } })` e `continue`. Esse resultado NÃO tem `success` nem `cancelled`, então o short-circuit `allWrite && allTerminal` (linha 751) fica `false` e o loop segue para `iteration++; continue`, disparando **outra chamada ao Gemini** só para o texto explicativo — consumindo mais um slot de `USER_DAILY_LIMIT`. Em operação normal o caminho é inatingível (servidor já 403 antes de relayar WRITE para free), mas se o servidor um dia relayasse — justamente o cenário que este guard cobre — o custo seria um round-trip e uma cota a mais por rejeição.
**Fix:** Tratar o resultado do guard como estado terminal para o short-circuit (incluí-lo na condição de terminalidade) ou encerrar localmente com mensagem premium sintetizada, sem nova chamada ao modelo.

## Info

### IN-01: Guard cliente é atualmente inalcançável (defense-in-depth puro)

**File:** `assets/fides-claude.jsx:506-514`
**Issue:** Como o guard 403 do servidor (api/assistant.js:455-459) retorna antes de relayar qualquer `tool_calls` WRITE para conta free, o guard cliente nunca recebe uma WRITE tool_call em operação normal — é redundância intencional. Aceitável e alinhado ao 13-05; o valor dele é condicional a uma futura falha/bypass do servidor (reforça WR-01).
**Fix:** Nenhuma ação obrigatória. Considerar comentário explicitando "camada só exercida se o servidor falhar em gatear".

### IN-02: Guard 403 do servidor over-bloqueia lote misto READ+WRITE

**File:** `api/assistant.js:455`
**Issue:** `toolCalls.some(tc => WRITE_NAMES.has(tc.name))` retorna 403 para o lote inteiro se qualquer tool for WRITE. Um lote misto (READ legítima + WRITE alucinada) de conta free perde também a READ. Como free só declara READ (`buildToolsForPlan(false)`), lotes mistos com WRITE só surgem por alucinação/injeção — bloquear tudo é o lado seguro (fail-closed). Sem impacto prático.
**Fix:** Nenhuma ação necessária. Se um dia quiser preservar as READs, filtrar as WRITE e prosseguir só com as READ — complexidade sem ganho real hoje.

### IN-03: Rejeição 403 por WRITE alucinada consome um slot da cota diária

**File:** `api/assistant.js:277-327` (interação com o guard 455-459)
**Issue:** O insert de rate-limit (`assistant_usage`, linha 316) ocorre em `isFirstCallOfTurn`, antes do retorno do Gemini. Um usuário free cujo Gemini alucine uma WRITE é cobrado 1 slot mesmo recebendo 403. Consistente com o comentário de que "cada request que chega ao backend consome 1 slot", mas cria vetor de desperdício de cota via prompts que induzem alucinação WRITE.
**Fix:** Nenhuma ação obrigatória; volume esperado é irrelevante. Se virar abuso, considerar não contabilizar turnos que terminam em 403 de gating.

---

_Reviewed: 2026-07-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
