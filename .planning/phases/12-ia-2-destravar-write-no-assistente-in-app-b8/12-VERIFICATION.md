---
phase: 12-ia-2-destravar-write-no-assistente-in-app-b8
verified: 2026-07-14T00:00:00Z
status: human_needed
score: 7/9 must-haves verified
behavior_unverified: 2
overrides_applied: 0
gaps_closure_verification: true
scope: "Re-verificação goal-backward focada no fechamento dos 2 gaps do 12-UAT (plans 12-06 e 12-07). 12-01..12-05 não foram re-verificados do zero — apenas checados por regressão nos arquivos tocados."
behavior_unverified_items:
  - truth: "Um pedido WRITE via chat nunca mais volta 'Ok, cancelei então' sem o usuário ter clicado Cancelar (12-UAT Test 4 fechado)"
    test: "No chat: (1) mandar lançar e CANCELAR um card de verdade (semeia o desfecho de cancelamento no histórico visível); (2) em seguida pedir um novo lançamento (via follow-up de categoria OU tudo junto numa mensagem só); (3) recarregar a página e repetir o passo 2."
    expected: "O bot nunca responde 'Ok, cancelei então' para o novo pedido — sempre monta o card de confirmação (ou pergunta o campo faltante). O comportamento se mantém idêntico após reload."
    why_human: "Depende do Gemini (flash-lite) decidir, em tempo real, se espelha texto de histórico — não é determinístico e requer sessionStorage real de browser + chamada de rede ao /api/assistant; grep/leitura de código prova que os mecanismos de defesa (filtro writeOutcome, guard anti-espelho, bump de storage, remoção do addendum) estão implementados e wired, mas não prova que o modelo deixa de espelhar em produção."
  - truth: "Dizer 'cartão de crédito Bradesco' ao lançar resolve para o CARTÃO Bradesco (status Pendente, mês pela data de fechamento da fatura), nunca para a conta corrente Bradesco homônima (12-UAT Test 1 fechado)"
    test: "Com uma CONTA e um CARTÃO cadastrados com o mesmo nome (ex. 'Bradesco'): (1) 'lança 1 real na categoria natal, no cartão de crédito bradesco' → conferir que o card de confirmação aponta pro CARTÃO (status Pendente, mês pela fatura) e checar via Supabase MCP que `card_id` foi preenchido e `account_id` ficou nulo; (2) 'lança 1 real na conta corrente bradesco' → card aponta pra CONTA; (3) 'lança 1 real no bradesco' sem qualificar → o assistente pede desambiguação, não escolhe sozinho."
    why_human: "Depende do Gemini extrair `tipo_destino` corretamente da linguagem natural do usuário (não determinístico) e de existir de fato uma conta e um cartão homônimos nos dados de teste do usuário; leitura de código confirma que o resolver honra `tipo_destino` e desambigua quando ausente, mas não prova o comportamento fim-a-fim com o modelo real."
human_verification:
  - test: "Regressão 12-UAT Test 4 (falso cancelamento): cancelar um card de verdade, depois pedir um novo lançamento (follow-up e tudo-junto), recarregar e repetir."
    expected: "Nunca mais 'Ok, cancelei então' sem cancelamento real; card de confirmação monta normalmente; comportamento sobrevive a reload."
    why_human: "Comportamento de LLM (Gemini) não é determinístico; requer sessão real de chat no browser."
  - test: "Regressão 12-UAT Test 1 (cartão homônimo): com conta E cartão 'Bradesco' cadastrados, testar 'cartão de crédito bradesco', 'conta corrente bradesco' e 'bradesco' sem qualificar."
    expected: "Cartão → cartão (Pendente, mês pela fatura). Conta → conta. Sem qualificar → pedido de desambiguação explícito."
    why_human: "Depende do Gemini extrair tipo_destino da linguagem natural + de dados reais de conta/cartão homônimos no Supabase do usuário de teste."
---

# Phase 12: IA-2 Destravar WRITE no assistente in-app (B8) — Verificação (gap closure 12-06/12-07)

**Phase Goal:** O gate B8 abre — o chat "Assistente Fides" volta a poder ESCREVER (lançar/recategorizar/editar transação + criar categoria) com confirmação. Insert via RPC `wa_log_transaction` SECURITY DEFINER com guarda de dono, respeitando saldo derivado (nenhuma mutação incremental). Regra de honestidade: baixa confiança pede confirmação, nunca chuta valor/conta/categoria.

**Verificado:** 2026-07-14
**Status:** human_needed
**Re-verificação:** Sim — gap closure após 12-UAT (Test 1 major + Test 4 blocker). Não há `12-VERIFICATION.md` anterior neste diretório; esta é a primeira verificação formal da fase, escopada aos 2 gaps fechados por 12-06/12-07 conforme instruído (12-01..12-05 checados só por regressão, não re-verificados do zero).

## Contexto

O 12-UAT.md (4 testes manuais) reportou 2 issues:
- **Test 4 (BLOCKER):** o assistente respondia "Ok, cancelei então" sem o usuário ter cancelado — WRITE via chat inutilizável, persistindo após reload.
- **Test 1 (major):** "cartão de crédito bradesco" resolvia para a CONTA CORRENTE Bradesco homônima, ignorando "cartão de crédito".

12-06-PLAN.md e 12-07-PLAN.md foram criados para fechar esses gaps. Esta verificação confirma, no código real (não nos SUMMARYs), se os `must_haves` desses dois planos estão de fato presentes e conectados.

## Goal Achievement

### Observable Truths

| # | Truth | Origem | Status | Evidência |
|---|-------|--------|--------|-----------|
| 1 | Um pedido WRITE via chat nunca mais volta "Ok, cancelei então" sem o usuário ter clicado Cancelar | 12-06 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Mecanismos de defesa presentes e wired (truths 2-5 abaixo), mas o comportamento fim-a-fim depende do Gemini em produção — ver Human Verification |
| 2 | Textos de DESFECHO WRITE sintetizados (`synthesizeWriteReply`) não são reenviados verbatim ao Gemini | 12-06 | ✓ VERIFIED | `assets/fides-claude.jsx:644-646` — `history` é montado com `.filter(m => (m.role === 'user' \|\| m.role === 'assistant') && !m.writeOutcome)`; as duas mensagens sintéticas (`:664` degrade, `:706` no-call) carregam `writeOutcome: true` |
| 3 | Uma resposta de TEXTO do Gemini idêntica a um desfecho WRITE sintetizado (sem tool_call) é suprimida | 12-06 | ✓ VERIFIED | `assets/fides-claude.jsx:609-616` define `isSyntheticWriteOutcome`; `:725-734` chama o guard ANTES do `setMessages` do reply normal (`:735`) — se casar, insere mensagem neutra em vez do texto espelhado |
| 4 | Sessões já poluídas são invalidadas uma vez no deploy (bump da `STORAGE_KEY_MESSAGES`) | 12-06 | ✓ VERIFIED | `assets/fides-claude.jsx:20-21` — `STORAGE_KEY_MESSAGES = 'fides_assistant_messages_v2'` e `STORAGE_KEY_LAST_ACTIVITY = 'fides_assistant_last_activity_v2'` (versão `_v2`, antes sem sufixo) |
| 5 | O addendum de prompt de reconhecimento de cancelamento (5e161e9) é removido | 12-06 | ✓ VERIFIED | `grep -c "cancelled" api/assistant.js` → 0; `SYSTEM_PROMPT` (linhas 17-66) lido por completo — nenhum bullet de "reconhecer cancelamento"; seção `REGRA DE HONESTIDADE` (linhas 42-48) intacta com as demais regras |
| 6 | "Cartão de crédito Bradesco" resolve para o CARTÃO, nunca para a conta homônima | 12-07 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Mecanismo (`tipo_destino` + resolver fail-closed) presente e wired (truths 7-9 abaixo), mas depende do Gemini extrair o tipo corretamente + de dados reais homônimos — ver Human Verification |
| 7 | `lancar_transacao` ganha discriminador `tipo_destino` (enum `conta\|cartao`) | 12-07 | ✓ VERIFIED | `api/assistant.js:118` — `tipo_destino: { type: 'STRING', ..., enum: ['conta', 'cartao'] }`; `required` da tool (`:120`) permanece `['descricao','valor','categoria','conta_ou_cartao']` — `tipo_destino` opcional, como especificado |
| 8 | O resolver honra o tipo: `'cartao'` → `findCardByName` exclusivo; `'conta'` → `findAccountByName` exclusivo | 12-07 | ✓ VERIFIED | `assets/fides-claude.jsx:314-327` — `accMatch`/`cardMatch` sempre calculados; branch `tipo === 'cartao'` usa só `cardMatch` (erro se ausente); branch `tipo === 'conta'` usa só `accMatch` (erro se ausente) |
| 9 | Homônimo sem `tipo_destino` → desambiguação explícita, nunca escolha pela ordem conta-primeiro | 12-07 | ✓ VERIFIED | `assets/fides-claude.jsx:328-331` — `accMatch && cardMatch` retorna erro "Encontrei uma conta E um cartão..."; idioma antigo `!acc ? findCardByName` tem 0 ocorrências (`grep -c` confirma remoção completa da precedência conta-primeiro) |

**Score:** 7/9 truths verificadas estaticamente (2 presentes/wired, comportamento não exercido — requerem sessão real)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `assets/fides-claude.jsx` | Constantes `WRITE_OUTCOME_*`, tag `writeOutcome`, filtro do history, guard `isSyntheticWriteOutcome`, bump de storage key, resolver honrando `tipo_destino` + desambiguação | ✓ VERIFIED | Todas as peças presentes (linhas 20-21, 24-30, 609-616, 644-646, 725-734, 306-338) e conectadas ao fluxo `send()`/`resolveWriteToolArgs()` |
| `api/assistant.js` | `tipo_destino` no schema de `lancar_transacao`, `SYSTEM_PROMPT` sem addendum de cancelamento, regra de mapeamento tipo → prompt | ✓ VERIFIED | `tipo_destino` em `:118`; bullet de mapeamento em `:48`; `cancelled` com 0 ocorrências; `node -e "require('./api/assistant.js')"` carrega sem erro (smoke test rodado nesta verificação) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `send` (montagem do history, `fides-claude.jsx:644-646`) | `callAssistant` → Gemini | filtro exclui mensagens `writeOutcome` | ✓ WIRED | Confirmado por leitura direta — o `.filter` referencia `!m.writeOutcome` |
| `send` (branch de reply de texto, `fides-claude.jsx:717-734`) | guard anti-espelho | `isSyntheticWriteOutcome(reply)` chamado antes do `setMessages` normal (`:735`) | ✓ WIRED | Guard executa e retorna cedo (`return` em `:733`) antes de alcançar o branch normal |
| `api/assistant.js` (schema `lancar_transacao`, `:118`) | `resolveWriteToolArgs` (`fides-claude.jsx:306-338`) | `args.tipo_destino` lido e usado para escolher `findCardByName`/`findAccountByName` | ✓ WIRED | `const tipo = args.tipo_destino;` em `:310`, usado nas condições `:318`/`:323` |
| `resolveWriteToolArgs` (destino cartão, `:318-322`/`:335`) | `findCardByName` → caminho de fatura (`executeWriteTool`, `:437-442`) | `target = { type: 'card', ..., obj: cardMatch }` alcança `window.mesFaturaFor(r.dateStr, r.target.obj, r.ano)` e `p_status: 'pending'` | ✓ WIRED | Shape `obj: cardMatch` preservado nos dois pontos de construção do target de cartão (`:322` e `:335`); `executeWriteTool` consome `r.target.obj` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `api/assistant.js` carrega sem erro de parse (CommonJS) | `node -e "require('./api/assistant.js')"` | `PARSE_OK`, sem exceção | ✓ PASS |
| `assets/fides-claude.jsx` (JSX via Babel-standalone) sem lib de build local | tentativa de `@babel/core` transform | `Cannot find module '@babel/core'` | ? SKIP — projeto não tem bundler/lint/types (CLAUDE.md, débito ROADMAP B11); verificação de sintaxe feita por leitura manual completa do arquivo, sem chaves/parênteses desbalanceados nem hooks novos identificados |
| Nenhum hook React novo introduzido | inspeção manual das mudanças (constantes de módulo + funções puras + lógica de branch) | Nenhum `useState`/`useEffect`/`useRef` novo nas regiões alteradas | ✓ PASS |
| Idioma conta-primeiro removido | `grep -c '!acc ? findCardByName' assets/fides-claude.jsx` | `0` | ✓ PASS |
| Addendum de cancelamento removido | `grep -c 'cancelled' api/assistant.js` | `0` | ✓ PASS |
| 6 tools + gate de required intactos | `grep -n "required:"` (5 blocos, `lancar_transacao` sem `tipo_destino`) | Confirmado: `['descricao', 'valor', 'categoria', 'conta_ou_cartao']` | ✓ PASS |

### Anti-Patterns Found

Nenhum debt marker (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`) encontrado em `assets/fides-claude.jsx` ou `api/assistant.js`. Um match de `placeholder` em `fides-claude.jsx:947` é falso-positivo — atributo `placeholder` legítimo de `<input>`, não um stub.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| WRITE-01 | 12-06, 12-07 | Fluxo de lançamento via chat volta a ser usável; destino resolve corretamente para conta vs cartão | ✓ SATISFIED (código) / ? NEEDS HUMAN (fim-a-fim) | Mecanismos de código presentes e wired (truths 2-5, 7-9); regressão end-to-end pendente de sessão real (truths 1, 6) |
| HONEST-01 | 12-06, 12-07 | Nunca reportar desfecho que não aconteceu; nunca escolher destino ambíguo silenciosamente | ✓ SATISFIED (código) / ? NEEDS HUMAN (fim-a-fim) | Guard anti-espelho + desambiguação fail-closed presentes; comportamento fim-a-fim pendente de sessão real |
| WRITE-02, WRITE-03, WRITE-04, DERIVED-SAFE-01 | 12-01..12-05 (fora do escopo desta re-verificação) | Recategorizar/editar/criar-categoria + RPC `wa_log_transaction` com saldo derivado | Não regredido | Branches `recategorizar_transacao`, `editar_transacao`, `criar_categoria` em `resolveWriteToolArgs`/`executeWriteTool` não foram tocados pelos plans 12-06/12-07 (leitura confirma código idêntico ao de 12-01..12-05); chamada à RPC `wa_log_transaction` em `executeWriteTool` (`:444-453`) inalterada |

**Nota sobre .planning/REQUIREMENTS.md:** os IDs `WRITE-01..04`, `HONEST-01`, `DERIVED-SAFE-01` aparecem em REQUIREMENTS.md (linha 41) apenas como nota preliminar — "(a formalizar)" — e a Phase 12 não tem linha na tabela de Traceability (que só vai até Phase 11). Isso é consistente com o próprio ROADMAP.md (`### Phase 12`, linha 397: "Requirements: ... (a formalizar)") e é um débito de documentação pré-existente às fases 12-01..12-05, não introduzido nem agravado por 12-06/12-07. Sinalizado como item informativo — não bloqueia esta verificação de gap closure, mas recomenda-se formalizar a tabela de Traceability antes do `/gsd-ship` da fase.

### Human Verification Required

#### 1. Regressão 12-UAT Test 4 — falso "Ok, cancelei então"

**Test:** No chat "Assistente Fides": (1) pedir um lançamento e clicar CANCELAR no card de confirmação; (2) em seguida, pedir um novo lançamento — testar tanto por follow-up (bot pergunta a categoria, você responde) quanto mandando tudo numa mensagem só; (3) recarregar a página e repetir o passo 2.
**Expected:** O bot nunca mais responde "Ok, cancelei então. Se quiser, é só me pedir de novo. 👍" para o novo pedido — sempre monta o card de confirmação (ou pergunta o campo que falta). Comportamento idêntico após reload.
**Why human:** Depende de como o Gemini (flash-lite) se comporta em produção diante do histórico real — não é determinístico. A leitura de código confirma que os 4 mecanismos de defesa (tag `writeOutcome` + filtro do history, guard anti-espelho, bump de storage key, remoção do addendum do prompt) estão implementados e conectados, mas só uma sessão real de chat prova que o bug não volta a acontecer.

#### 2. Regressão 12-UAT Test 1 — cartão homônimo virando conta

**Test:** Com uma CONTA e um CARTÃO cadastrados com o mesmo nome (ex. "Bradesco") na conta do usuário de teste: (1) "lança 1 real na categoria natal, no cartão de crédito bradesco" → conferir que o card de confirmação aponta para o CARTÃO (status Pendente, mês pela data de fechamento da fatura) e, via Supabase MCP, que `transactions.card_id` foi preenchido e `account_id` ficou nulo; (2) "lança 1 real na conta corrente bradesco" → card aponta para a CONTA; (3) "lança 1 real no bradesco" sem qualificar → o assistente pede desambiguação explícita, não escolhe sozinho.
**Expected:** Os 3 cenários acima se comportam exatamente como descrito.
**Why human:** Depende do Gemini extrair `tipo_destino` corretamente a partir de linguagem natural (não determinístico) e de existir de fato uma conta e um cartão homônimos nos dados do usuário de teste. A leitura de código confirma que o resolver honra `tipo_destino` quando presente e desambigua com erro explícito quando ausente e há homônimo, mas não prova o comportamento fim-a-fim com o modelo real.

### Gaps Summary

Nenhum gap de código encontrado nos plans 12-06/12-07: todos os `must_haves.artifacts` e `must_haves.key_links` declarados nos dois PLANs estão presentes, substantivos e conectados no código atual (`api/assistant.js`, `assets/fides-claude.jsx`). As 7 truths estáticas (constantes, tags, filtro, guard, bump de storage, remoção do addendum, discriminador `tipo_destino`, resolução exclusiva por tipo, desambiguação fail-closed) foram todas verificadas por leitura direta do código-fonte + greps de confirmação (não por SUMMARY.md).

As 2 truths remanescentes (1 e 6) são o próprio comportamento fim-a-fim que motivou os gaps do 12-UAT (Test 4 blocker, Test 1 major) — por definição, exigem uma sessão de chat real com o Gemini decidindo em tempo real, o que grep/leitura de código não consegue provar. Isso não é um gap de implementação: é o limite do que verificação estática consegue certificar para comportamento de LLM não-determinístico. Rota correta: `/gsd-verify-work 12` (UAT humano) repetindo os cenários dos Tests 1 e 4.

---

_Verified: 2026-07-14T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
