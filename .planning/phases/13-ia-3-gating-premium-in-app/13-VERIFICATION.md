---
phase: 13-ia-3-gating-premium-in-app
verified: 2026-07-16T21:50:00Z
status: passed
uat_resolution: "5 UATs humanos fechados via dogfooding do painel (Phase 16, 2026-07-17): 3 pass (Tests 1/4/5), 2 deferidos como débito rastreado (Tests 2/3). Ver 13-UAT.md."
score: 16/16 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 15/16
  gaps_closed:
    - "GATE-03 (garantia completa): a capacidade WRITE via IA é re-decidida server-side a cada request, com defesa em profundidade — não depende unicamente de o modelo Gemini nunca emitir uma tool_call para um nome não declarado"
  gaps_remaining: []
  regressions: []
---

# Phase 13: IA-3 Gating Premium in-app — Verification Report (Re-verificação)

**Phase Goal:** O app passa a gatear capacidades por tier real. `profiles.plan` (`free|pro|family`) vira a fonte da verdade. Premium = plan não-free (allow-list pro/family). Free: degustação de IA (~10 msg/mês de chat READ, sem WRITE) como funil de conversão. Premium: chat completo + WRITE + Análise da IA. Paywall suave + tela de upgrade apontando para o checkout do M6 (placeholder).

**Requirements:** GATE-01, GATE-02, GATE-03, PAYWALL-01
**Verified:** 2026-07-16 (código 16/16) · UATs fechados 2026-07-17
**Status:** passed
**Re-verificação:** Sim — após gap-closure (Plan 13-05, commits `20f7cd2`/`4ad26c1`)

> **UATs humanos fechados (2026-07-17):** os 5 itens `human_needed` foram exercidos via dogfooding do painel admin (Phase 16 / ADMIN-04). 3 verificados (Test 1 WRITE bloqueado no free, Test 4 Perfil badge/CTA, Test 5 trava live reconfirmada na introspecção do 16-01); 2 deferidos como débito rastreado por decisão do dono (Test 2 403 na Análise, Test 3 cap 10/mês). Detalhe em `13-UAT.md`.

## Contexto da re-verificação

A verificação anterior (`13-VERIFICATION.md`, `status: gaps_found`, score 15/16) apontou **1 gap bloqueante**: a truth #9 (garantia completa do GATE-03) — o gate dependia exclusivamente de o Gemini nunca emitir uma `tool_call` para um nome WRITE que não recebeu no payload, sem defesa em profundidade (achado CR-01 do `13-REVIEW.md`, mesma raiz do WR-04).

O plano gap-closure `13-05` (commits `20f7cd2` servidor, `4ad26c1` cliente, `13-05-SUMMARY.md`) entregou exatamente o fix esboçado no próprio review. Esta re-verificação focou integralmente em re-checar a truth #9 contra o código atual (leitura direta de `api/assistant.js` e `assets/fides-claude.jsx`, não o SUMMARY) e em fazer um regression-check das demais 15 truths que já estavam VERIFIED.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Store (`fides-store.jsx`) seleciona `plan` nos 2 caminhos de carga e expõe `userPlan`/`isPremium` via `useFides()` | ✓ VERIFIED (regressão OK) | `userPlan, isPremium: userPlan === 'pro' \|\| userPlan === 'family'` (linha 1380); `React.useState('free')` (linha 161); fallback `isPremium: false` (linha 1432) — inalterado desde a verificação anterior |
| 2 | `isPremium` usa allow-list, nunca negação `!=='free'` — fail-closed | ✓ VERIFIED (regressão OK) | Zero ocorrências de `userPlan !== 'free'`/`plan !== 'free'` em `fides-store.jsx` |
| 3 | UI reflete o tier real do banco, não mais o mock `USER.plan:'Pro'` | ✓ VERIFIED (regressão OK) | Sem alterações nesta re-verificação — mock morto continua isolado, sem consumidores vivos |
| 4 | Coluna `profiles.plan` protegida contra self-write via client SDK | ✓ VERIFIED (regressão OK) | `supabase/profiles-plan-privileges.sql` inalterado pelo Plan 13-05 (arquivo fora do escopo, `files_modified` do plan lista só `api/assistant.js` e `assets/fides-claude.jsx`) |
| 5 | Migração aplicada no banco live (D-04) | ✓ VERIFIED (human-confirmed, regressão OK) | Confirmação humana registrada em `13-02-SUMMARY.md`, não afetada por esta gap-closure |
| 6 | Servidor lê `profiles.plan` fail-closed por allow-list, default `'free'` | ✓ VERIFIED (regressão OK) | Linha 254 (renumerada após o diff de 13-05, era ~248): `isPremium = plan === 'pro' \|\| plan === 'family'`; guard 403 novo (truth #9) reutiliza esta mesma variável sem reler |
| 7 | Modo `analysis` é premium-only: free recebe 403 antes do Gemini | ✓ VERIFIED (código, regressão OK) | Linha 260: `res.status(403).json({ error: 'PREMIUM_REQUIRED', code: 403 })` no branch `isAnalysisMode && !isPremium`, inalterado |
| 8 | Gemini fisicamente NÃO recebe declarações WRITE quando `!isPremium` | ✓ VERIFIED (regressão OK) | `buildToolsForPlan(isPremium)` inalterado; `WRITE_NAMES` (novo, linha 190) é derivado da MESMA `WRITE_FUNCTIONS`, sem duplicar/hardcodar lista |
| 9 | **Garantia completa GATE-03**: capacidade WRITE é re-decidida/validada server-side a cada request, com defesa em profundidade | ✓ **VERIFIED** (gap fechado) | Ver seção dedicada abaixo — dupla camada servidor+cliente confirmada por leitura direta do código, não do SUMMARY |
| 10 | Free tem cap de 10 msg/mês, guardado por `isFirstCallOfTurn`, fail-open no erro de count | ✓ VERIFIED (código, regressão OK) | `FREE_TIER_MONTHLY_LIMIT = 10` e lógica de contagem inalterados pelo 13-05. **Nota de risco preservada** (não bloqueante): WR-01/CR-02 do review (replay de nonce, D-06, pré-existente Phase 12) segue rastreado em `.planning/todos/pending/ratelimit-bypass-toolresults.md`, fora do escopo do 13-05 (documentado explicitamente em `<assumptions_and_deferrals>` do plan) |
| 11 | `FREE_TIER_ADDENDUM` injetado no system prompt quando `!isPremium` | ✓ VERIFIED — **e a ressalva WR-04 foi corrigida** | Linha 347 (nova redação): `grep "const FREE_TIER_ADDENDUM" api/assistant.js \| grep -cE "lancar_transacao\|recategorizar_transacao\|editar_transacao\|criar_categoria"` → `0`. Concatenação em `fullSystem` inalterada (`grep -c FREE_TIER_ADDENDUM` → 2 ocorrências: declaração + uso) |
| 12 | Chat mapeia `FREE_MONTHLY_LIMIT`/`PREMIUM_REQUIRED` para copy de upgrade | ✓ VERIFIED (regressão OK) | `friendlyError` (linha 573: `PREMIUM_REQUIRED: 'Esse recurso é exclusivo do plano Premium...'`), inalterado |
| 13 | Análise da IA mapeia os mesmos 2 códigos e esconde/desabilita o botão quando `!isPremium` | ✓ VERIFIED (regressão OK) | Fora do escopo do 13-05 (`fides-orcamento.jsx` não está em `files_modified`); sem alterações |
| 14 | Os DOIS mapas de erro recebem os novos códigos juntos | ✓ VERIFIED (regressão OK) | Sem alterações desde a verificação anterior |
| 15 | `PerfilView` exibe badge de tier + CTA `UpgradeModal` | ✓ VERIFIED (regressão OK) | Fora do escopo do 13-05 (`fides-studio.jsx` não tocado); sem alterações |
| 16 | Nenhum diálogo nativo do browser introduzido (`window.confirm`/`alert`) | ✓ VERIFIED (regressão OK + novo código) | Zero `confirm(`/`alert(` em `fides-claude.jsx` após o diff do 13-05 (guard novo é bloqueio silencioso via `results.push`, conforme exigido pela plan) |

**Score:** 16/16 truths verified

### Truth #9 — Verificação detalhada da defesa em profundidade (CR-01)

**Camada servidor (`api/assistant.js`):**
- Linha 190: `const WRITE_NAMES = new Set(WRITE_FUNCTIONS.map(f => f.name));` — derivado da mesma constante `WRITE_FUNCTIONS` que alimenta `buildToolsForPlan`, sem lista re-hardcodada (confirmado por leitura: nenhum literal `['lancar_transacao', ...]` na declaração de `WRITE_NAMES`).
- Linhas 449-463 (bloco `if (toolCalls.length > 0)`), lidas integralmente:
  ```
  if (toolCalls.length > 0) {
    if (!isPremium && toolCalls.some(tc => WRITE_NAMES.has(tc.name))) {
      console.error('[assistant] GATE-03 violation: free tier got WRITE toolCall(s)', toolCalls.map(t => t.name));
      res.status(403).json({ error: 'PREMIUM_REQUIRED', code: 403 });
      return;
    }
    const nextNonce = NONCE_SECRET ? nonce.sign(userId, NONCE_SECRET) : null;
    res.status(200).json({ tool_calls: toolCalls, nonce: nextNonce });
    return;
  }
  ```
  O guard é a PRIMEIRA instrução do bloco, com `return` explícito ANTES da assinatura de `nextNonce` e do relay `res.status(200).json(...)` — nenhum caminho de código chega ao relay/nonce depois do 403. `isPremium` é o mesmo valor lido fail-closed anteriormente na função (truth #6), sem releitura nem nova superfície de confiança.

**Camada cliente (`assets/fides-claude.jsx`):**
- Linhas 511-514, dentro de `executeTools`, ANTES do ramo que chama `resolveWriteToolArgs`/`setPendingConfirmation`:
  ```
  if (TOOLS_REQUIRING_CONFIRMATION.includes(tc.name) && !fs.isPremium) {
    results.push({ name: tc.name, args: tc.args, id: tc.id, result: { error: 'PREMIUM_REQUIRED', message: '...' } });
    continue;
  }
  ```
  `fs` é o mesmo objeto de `useFides()` capturado no topo de `FidesAssistant` (linha 36) — confirmado por `git show 4ad26c1`: diff de 9 linhas, nenhum novo `useFides(`/hook introduzido (Rules of Hooks preservado, conforme exigido pelo CLAUDE.md). Zero `confirm(`/`alert(` no arquivo.

**Verificação independente das checagens do plan (não apenas confiança no SUMMARY):**
| Checagem | Comando | Resultado |
|---|---|---|
| `node -c api/assistant.js` | sintaxe válida | exit 0 |
| `const WRITE_NAMES` | `grep -c` | 1 |
| `WRITE_FUNCTIONS.map` | `grep -c` | 1 |
| `WRITE_NAMES.has` | `grep -c` | 1 |
| `toolCalls.some` | `grep -c` | 1 |
| FREE_TIER_ADDENDUM sem os 4 nomes literais | `grep` region-scoped | 0 |
| `FREE_TIER_ADDENDUM` (declaração + uso) | `grep -c` | 2 |
| `fs.isPremium` em `fides-claude.jsx` | `grep -c` | 2 (guard novo + comentário) |
| `PREMIUM_REQUIRED` em `fides-claude.jsx` | `grep -c` | 2 (guard novo + mapa `friendlyError`) |
| Brace-balance `fides-claude.jsx` | `node -e` contagem `{`/`}` | 0 diff (383/383) |
| Debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) nos 2 arquivos | `grep -n -E` | 0 ocorrências |
| Regressão: `plan !== 'free'`/`userPlan !== 'free'` | `grep -c` | 0 (fail-closed preservado) |
| Working tree limpo (só `.agents/` não relacionado) | `git status --short` | confirmado |

Conclusão: a truth #9 deixa de ser FAILED e passa a **VERIFIED** — não com base no SUMMARY (`13-05-SUMMARY.md`), mas em leitura direta e independente do código-fonte atual, incluindo os diffs (`git show 20f7cd2`, `git show 4ad26c1`), que confirmam commits cirúrgicos (21 e 9 linhas respectivamente) exatamente na forma prometida.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `assets/fides-store.jsx` | `userPlan`/`isPremium` no context value | ✓ VERIFIED | Inalterado, regressão OK |
| `supabase/profiles-plan-privileges.sql` | REVOKE/GRANT column-level | ✓ VERIFIED | Inalterado, regressão OK |
| `api/assistant.js` | `WRITE_NAMES`, guard 403 no relay, `FREE_TIER_ADDENDUM` reescrito | ✓ **VERIFIED** (antes ⚠️ HOLLOW) | Defesa em profundidade completa — camada de revalidação da resposta do Gemini agora existe e está corretamente posicionada |
| `assets/fides-claude.jsx` | guard `!fs.isPremium` em `executeTools` | ✓ **VERIFIED** (antes com gap CR-01) | Guard presente, antes de `setPendingConfirmation`, sem novo hook |
| `assets/fides-orcamento.jsx` | `friendlyAiError` + gate do botão | ✓ VERIFIED | Fora do escopo do 13-05, inalterado |
| `assets/fides-studio.jsx` | badge de tier + `UpgradeModal` | ✓ VERIFIED | Fora do escopo do 13-05, inalterado |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `assets/fides-store.jsx` (`isPremium`) | `assets/fides-orcamento.jsx` | prop `isPremium` | ✓ WIRED | Regressão OK |
| `assets/fides-store.jsx` (`isPremium`/`userPlan`) | `assets/fides-studio.jsx` (`PerfilView`) | `useFides()` | ✓ WIRED | Regressão OK |
| `api/assistant.js` (error codes) | `assets/fides-claude.jsx` (`friendlyError`) | fetch ladder | ✓ WIRED | Regressão OK |
| `api/assistant.js` (error codes) | `assets/fides-orcamento.jsx` (`friendlyAiError`) | `!res.ok` | ✓ WIRED | Regressão OK |
| `api/assistant.js` (`buildToolsForPlan`) | payload Gemini | `tools: buildToolsForPlan(isPremium)` | ✓ WIRED | Regressão OK |
| `api/assistant.js` (`tool_calls` na resposta) | `assets/fides-claude.jsx` (execução de WRITE tools) | resposta HTTP → `executeTools` | ✓ **RE-VALIDADO** (antes NOT RE-VALIDATED) | Servidor revalida nome contra `WRITE_NAMES` antes do relay (403 se free+WRITE); cliente revalida de novo contra `fs.isPremium` antes do card de confirmação — dupla camada confirmada |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `api/assistant.js` sintaxe válida (CommonJS) | `node -c api/assistant.js` | sem erro | ✓ PASS |
| Guard 403 posicionado antes do relay/nonce | leitura direta linhas 449-463 | confirmado por inspeção de código, não apenas grep de presença | ✓ PASS |
| Guard cliente posicionado antes de `setPendingConfirmation` | leitura direta linhas 502-515 + `git show 4ad26c1` (diff completo) | confirmado | ✓ PASS |
| Brace-balance `fides-claude.jsx` após o diff | `node -e` contagem `{`/`}` | 383/383, 0 diff | ✓ PASS |
| Fail-closed preservado (sem `plan !== 'free'`) | `grep -c` | 0 ocorrências | ✓ PASS |
| Debt markers nos 2 arquivos do gap-closure | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` | 0 ocorrências | ✓ PASS |
| `WRITE_FUNCTIONS` tem exatamente as 4 funções que `WRITE_NAMES`/`TOOLS_REQUIRING_CONFIRMATION` esperam | leitura do array `WRITE_FUNCTIONS` (linhas 115-176) | 4 entradas: `lancar_transacao`, `recategorizar_transacao`, `editar_transacao`, `criar_categoria` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| GATE-01 | 13-01 | Store lê `plan` real | ✓ SATISFIED | Truths 1-3 |
| GATE-02 | 13-03 | Free degustação limitada ~10 msg/mês | ✓ SATISFIED (com ressalva pré-existente) | Truth 10 — mecanismo correto; risco residual do replay de nonce (D-06) é pré-existente à Phase 13 e já rastreado em `.planning/todos/pending/ratelimit-bypass-toolresults.md`, fora do escopo desta fase |
| GATE-03 | 13-02, 13-03, 13-04, 13-05 | Premium libera WRITE/IA; free bloqueado, com defesa em profundidade | ✓ **SATISFIED** (antes PARCIALMENTE BLOQUEADO) | Truths 4-9: mecanismo primário + defesa em profundidade servidor+cliente confirmados por leitura direta do código atual |
| PAYWALL-01 | 13-04 | Paywall + tela de upgrade (M6 placeholder) | ✓ SATISFIED | Truths 12-16 |

**Traceability gap (não bloqueante, herdado da verificação anterior):** `.planning/REQUIREMENTS.md` ainda não formaliza GATE-01/02/03/PAYWALL-01 como linhas individuais na tabela de Traceability (só como nota de sumário, linha 43) — consistente com `milestone_formalized: false` do épico IA/WhatsApp. Todos os 4 IDs aparecem no frontmatter `requirements:` de pelo menos um plan (13-01: GATE-01; 13-02: GATE-03; 13-03: GATE-02, GATE-03; 13-04: GATE-03, PAYWALL-01; 13-05: GATE-03); nenhum requirement órfão encontrado. Gap de processo/rastreabilidade, não de implementação.

### Anti-Patterns Found

Nenhum anti-pattern de débito (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER, implementação vazia, dado hardcoded, `console.log`-only, diálogo nativo) encontrado nos arquivos tocados pelo gap-closure (`api/assistant.js`, `assets/fides-claude.jsx`). O `console.error` novo na guard servidor é telemetria de segurança intencional (loga só nomes de tools, sem PII/conteúdo), consistente com a regra de telemetria já existente no arquivo.

**Observações não bloqueantes carregadas do `13-REVIEW.md` (delta 13-05), nenhuma é BLOCKER:**
- **WR-01 (review):** `TOOLS_REQUIRING_CONFIRMATION` no cliente é uma lista hardcoded que pode divergir de `WRITE_FUNCTIONS` (servidor, derivada) se uma 5ª tool WRITE for adicionada no futuro sem atualizar as duas listas — a camada servidor continua protegendo mesmo nesse cenário (drift enfraquece só a redundância, não a garantia primária). Sugestão do review: comentário/assert de sincronização, ou constante compartilhada quando houver build step (ROADMAP B11). Não bloqueia esta fase.
- **WR-02 (review):** guard cliente reenvia resultado de erro ao Gemini em vez de encerrar localmente, gerando 1 round-trip/cota extra num cenário hoje inatingível (servidor já bloqueia antes). Observação de eficiência, não de segurança.
- **IN-01/IN-02/IN-03 (review):** notas informativas (guard cliente hoje inalcançável por design — defesa em profundidade pura; over-bloqueio fail-closed de lotes mistos; 1 slot de cota consumido em rejeição 403) — todas aceitas explicitamente pelo próprio review como comportamento correto/aceitável, sem ação obrigatória.

## Human Verification Required

Os itens abaixo permanecem (ou foram atualizados) como `human-check` — não automatizáveis por este verificador, conforme já registrado nas próprias plans e reafirmado pela `13-05-PLAN.md`. Não contam como falha; precisam de confirmação humana antes de considerar a fase 100% fechada em produção.

### 1. UAT direto do fix CR-01 — free pedindo "lança 50 no mercado" nunca abre o card
**Test:** Logado como conta free, pedir no chat "lança 50 no mercado".
**Expected:** O assistente NUNCA abre o card de confirmação de WRITE — recusa em texto apontando para o Premium (agora reforçado por 2 camadas: se o Gemini tentar a tool_call, o servidor responde 403 antes do relay; se por algum motivo relayasse, o cliente bloqueia antes do card). Como pro, o mesmo pedido abre o card normalmente (regressão limpa da Phase 12).
**Why human:** Depende do comportamento real do modelo Gemini + render de UI real em sessão autenticada live; é o próprio `13-05-PLAN.md` que marca este item como UAT humano (D5), não automatizável.

### 2. 403 forçado na Análise da IA como free
**Test:** Logado como conta free, forçar `fetch('/api/assistant', {..., mode:'analysis'})` diretamente no console do browser.
**Expected:** Resposta `403 PREMIUM_REQUIRED`, sem chamada ao Gemini. Como pro, funciona normalmente.
**Why human:** Requer sessão autenticada real contra o servidor live.

### 3. Free bate no cap de 10 msg/mês (11ª mensagem)
**Test:** Como free, mandar 10 mensagens de chat READ no mês; mandar a 11ª.
**Expected:** A 11ª retorna `429 FREE_MONTHLY_LIMIT`.
**Why human:** Requer 11 interações reais contra o servidor live + inspeção do banco.

### 4. Free vs. pro no Perfil + parse sem erro
**Test:** Carregar o app como free e como pro; abrir a aba Perfil.
**Expected:** Free vê badge "Free" + CTA que abre `UpgradeModal`; pro vê badge "Premium", sem CTA. App carrega sem erro de parse do Babel-standalone.
**Why human:** Renderização visual real + parse em runtime do browser.

### 5. Trava live de `profiles.plan` (regressão futura)
**Test:** Já confirmado uma vez pelo usuário no apply da Plan 13-02.
**Why human:** Estado do banco live, não verificável pelo código-fonte.

## Gaps Summary

**Nenhum gap bloqueante remanescente.** O único gap da verificação anterior (truth #9 / CR-01) foi fechado pelo Plan 13-05 e confirmado por leitura direta e independente do código (não do SUMMARY): `api/assistant.js` agora revalida o nome de cada `tool_call` retornada pelo Gemini contra `WRITE_NAMES` (derivado de `WRITE_FUNCTIONS`) e responde `403 PREMIUM_REQUIRED` sem relay quando `!isPremium`; `assets/fides-claude.jsx` bloqueia redundantemente a abertura do card de confirmação de WRITE quando `!fs.isPremium`. `FREE_TIER_ADDENDUM` (WR-04) foi reescrito sem os 4 nomes literais das funções WRITE.

O status final é `human_needed`, não `passed`, porque 5 itens de UAT humano permanecem pendentes (nenhum deles é automatizável, e o item #1 é o teste funcional direto do próprio fix desta rodada). Nenhum desses itens indica gap de implementação — são confirmações de comportamento runtime/visual que o próprio `13-05-PLAN.md` já classificou como human-only.

**Score final: 16/16 must-haves verified.** GATE-01, GATE-02 (com ressalva pré-existente já rastreada), GATE-03 (agora estruturalmente fechado com defesa em profundidade) e PAYWALL-01 estão implementados, presentes, substantivos e ligados no código real.

---

_Verified: 2026-07-16_
_Verifier: Claude (gsd-verifier)_
