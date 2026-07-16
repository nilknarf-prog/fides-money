---
phase: 13-ia-3-gating-premium-in-app
verified: 2026-07-16T00:00:00Z
status: gaps_found
score: 15/16 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "GATE-03 (garantia completa): a capacidade WRITE via IA é re-decidida server-side a cada request, com defesa em profundidade — não depende unicamente de o modelo Gemini nunca emitir uma tool_call para um nome não declarado"
    status: partial
    reason: >
      buildToolsForPlan(isPremium) implementa corretamente o mecanismo PRIMÁRIO: quando !isPremium,
      o array de tools enviado ao Gemini contém só READ_FUNCTIONS — as 4 declarações WRITE
      (lancar_transacao, recategorizar_transacao, editar_transacao, criar_categoria) fisicamente
      não vão no payload. Isso está verificado e funcionando.
      Porém NENHUM lado do sistema revalida o NOME da tool_call retornada pelo Gemini contra o
      tier do usuário antes de repassá-la ao cliente (api/assistant.js) ou de executá-la
      (assets/fides-claude.jsx). Isso é o achado crítico CR-01 do próprio code review da fase
      (13-REVIEW.md), permanece sem correção nos commits da fase, e não está registrado em nenhum
      todo/débito rastreado (diferente do achado de nonce replay, que já tinha um todo prévio).
      Caminho de exploração concreto e plausível: (a) fallback automático para
      gemini-2.0-flash (GEMINI_FALLBACK_MODEL, comportamento de tool-calling diferente do modelo
      primário), (b) alucinação do modelo, ou (c) prompt injection — agravado pelo próprio
      FREE_TIER_ADDENDUM (linha 338 de api/assistant.js) que expõe os 4 nomes exatos das funções
      WRITE no system prompt de contas free (achado WR-04 do review, mesma causa raiz).
      O próprio threat model das plans 13-01 (T-13-02c) e 13-03 (T-13-02) promete que "a capacidade
      real é re-decidida server-side a cada request" (D-01) — essa promessa não é honrada para o
      caminho de resposta do Gemini (tool_calls), só para a montagem do payload de saída.
    artifacts:
      - path: "api/assistant.js"
        issue: "Linhas ~438-444: toolCalls (de parseResponse, sem checagem de schema/tier) são repassados ao cliente em res.status(200).json({tool_calls...}) sem checar se algum nome pertence a WRITE_FUNCTIONS quando !isPremium"
      - path: "assets/fides-claude.jsx"
        issue: "TOOLS_REQUIRING_CONFIRMATION (linha 33) e o fluxo de execução (executeTools/resolveWriteToolArgs/executeWriteTool, linhas ~306-545) não verificam fs.isPremium antes de executar uma WRITE tool retornada pelo servidor"
    missing:
      - "api/assistant.js: antes de responder tool_calls ao cliente, checar `!isPremium && toolCalls.some(tc => WRITE_NAMES.has(tc.name))` → 403 PREMIUM_REQUIRED (fix já esboçado literalmente em 13-REVIEW.md CR-01)"
      - "assets/fides-claude.jsx: checagem client-side redundante em executeTools — bloquear execução de uma WRITE tool se `!fs.isPremium`"
      - "(recomendado, não bloqueante por si só) reescrever FREE_TIER_ADDENDUM para não citar os 4 nomes literais das funções WRITE (WR-04), reduzindo a superfície de prompt injection enquanto CR-01 não é corrigido"
---

# Phase 13: IA-3 Gating Premium in-app — Verification Report

**Phase Goal:** O app passa a gatear capacidades por tier real. `profiles.plan` (`free|pro|family`) vira a fonte da verdade. Premium = plan não-free (allow-list pro/family). Free: degustação de IA (~10 msg/mês de chat READ, sem WRITE) como funil de conversão. Premium: chat completo + WRITE + Análise da IA. Paywall suave + tela de upgrade apontando para o checkout do M6 (placeholder).

**Requirements:** GATE-01, GATE-02, GATE-03, PAYWALL-01
**Verified:** 2026-07-16
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Store (`fides-store.jsx`) seleciona `plan` nos 2 caminhos de carga e expõe `userPlan`/`isPremium` via `useFides()` | ✓ VERIFIED | `grep` confirma `select('name, group_targets, plan')` (linhas 333, 368), `setUserPlan(profile?.plan \|\| 'free')` (linhas 336, 371), `userPlan, isPremium: ...` no `value` do Provider (linha 1380) |
| 2 | `isPremium` usa allow-list (`plan==='pro'\|\|plan==='family'`), nunca negação `!=='free'` — fail-closed | ✓ VERIFIED | Linha 1380: `isPremium: userPlan === 'pro' \|\| userPlan === 'family'`; fallback (linha 1432): `userPlan: 'free', isPremium: false`; zero ocorrências de `userPlan !== 'free'` |
| 3 | UI reflete o tier real do banco, não mais o mock `USER.plan:'Pro'` (`fides-data.jsx:31`) | ✓ VERIFIED | Mock `USER.plan:'Pro'` ainda existe em `fides-data.jsx:31` (código morto, não removido), mas zero ocorrências de `USER.plan` em qualquer componente `.jsx` vivo — nenhum consumidor lê o mock |
| 4 | Coluna `profiles.plan` protegida contra self-write via client SDK (SQL: REVOKE all + GRANT apenas `name, group_targets`, `plan` fora) | ✓ VERIFIED | `supabase/profiles-plan-privileges.sql` lido integralmente: `revoke update on public.profiles from authenticated;` + `grant update (name, group_targets) on public.profiles to authenticated;` — `plan` só aparece em comentário |
| 5 | Migração aplicada no banco live: self-UPDATE de `plan` falha; `name`/`group_targets` continuam salvando; toggle de dev via SQL Editor funciona (D-04) | ✓ VERIFIED (human-confirmed) | Não reverificável pelo codebase (estado do banco live). Per instrução da tarefa, tratado como autoritativo: usuário confirmou verbatim em 13-02-SUMMARY.md ("Aplicado, testes feitos e comando rodado no SQL do Supabase") os 3 eixos (a) trava de plan, (b) não-regressão, (c) D-04 |
| 6 | Servidor (`api/assistant.js`) lê `profiles.plan` fail-closed por allow-list, default `'free'` em erro/null/valor desconhecido | ✓ VERIFIED | Linha 232: `let plan = 'free'`; linha 248: `const isPremium = plan === 'pro' \|\| plan === 'family'`; zero ocorrências de `plan !== 'free'` |
| 7 | Modo `analysis` é premium-only: free recebe 403 `PREMIUM_REQUIRED` antes de qualquer chamada ao Gemini | ✓ VERIFIED (código) | Linha 254: `res.status(403).json({ error: 'PREMIUM_REQUIRED', code: 403 })` dentro do branch `isAnalysisMode && !isPremium`, executado antes do `gemini.buildPayload`. Confirmação funcional (fetch forçado como free) fica para UAT — ver Human Verification |
| 8 | O Gemini fisicamente NÃO recebe as declarações das 4 tools WRITE quando `!isPremium` | ✓ VERIFIED | `buildToolsForPlan(isPremium)` (linhas 181-184): `isPremium ? [...READ_FUNCTIONS, ...WRITE_FUNCTIONS] : READ_FUNCTIONS`; call-site (linha 380) usa `buildToolsForPlan(isPremium)` em vez da constante estática antiga |
| 9 | **Garantia completa GATE-03**: capacidade WRITE é re-decidida/validada server-side a cada request, com defesa em profundidade (não só na montagem do payload de saída) | ✗ **FAILED** | Ver bloco `gaps` no frontmatter — achado CR-01 do code review (13-REVIEW.md), não corrigido: `tool_calls` retornados pelo Gemini nunca são revalidados contra o tier, nem em `api/assistant.js` (linhas 438-444) nem em `assets/fides-claude.jsx` (`TOOLS_REQUIRING_CONFIRMATION`, linhas 306-545) |
| 10 | Free tem cap de 10 msg/mês sobre `assistant_usage` (mês UTC), guardado por `isFirstCallOfTurn`, fail-open no erro de count | ✓ VERIFIED (código) | Linha 18: `FREE_TIER_MONTHLY_LIMIT = 10`; linha 294: `startOfMonthUTC` via `getUTCMonth`; linha 304-305: `429 FREE_MONTHLY_LIMIT` no `else if (>=)`. **Nota de risco** (não bloqueante desta fase): WR-01/CR-02 do review mostra que o replay do nonce (D-06, Phase 12, pré-existente) permite pular esse cap indefinidamente — já rastreado em `.planning/todos/pending/ratelimit-bypass-toolresults.md` antes desta fase; ver narrativa |
| 11 | `FREE_TIER_ADDENDUM` injetado no system prompt quando `!isPremium` | ✓ VERIFIED (código) | Linha 338 (texto presente) + linha 342: `+ (!isPremium ? FREE_TIER_ADDENDUM : '')`. **Nota de qualidade** (WR-04): o texto cita os 4 nomes literais das funções WRITE, o que piora a exposição de CR-01 — ver narrativa |
| 12 | Chat (`fides-claude.jsx`) mapeia `FREE_MONTHLY_LIMIT`/`PREMIUM_REQUIRED` para copy de upgrade, não fallback genérico | ✓ VERIFIED | Linhas 563-564 (`friendlyError`); linhas 709-710 (`else if (errCode === 'FREE_MONTHLY_LIMIT')` no ladder 429, paralelo a `USER_DAILY_LIMIT`) |
| 13 | Análise da IA (`fides-orcamento.jsx`) mapeia os mesmos 2 códigos E esconde/desabilita o botão com CTA quando `!isPremium` | ✓ VERIFIED | Linhas 1030-1031 (`friendlyAiError`); linhas 1151/1559 (`isPremium` como prop de `store.isPremium`); linhas 1150-1166: botão ativo só quando `isPremium`, senão `.pln-mi-ai-upsell` |
| 14 | Os DOIS mapas de erro (`friendlyError` + `friendlyAiError`) recebem os novos códigos juntos (Pitfall 4) | ✓ VERIFIED | Confirmado nos 2 arquivos (linhas 563-564 e 1030-1031) — cópias editadas em conjunto na mesma plan/commit |
| 15 | `PerfilView` exibe badge de tier e, quando free, CTA que abre `UpgradeModal` (placeholder M6, sem checkout real) | ✓ VERIFIED | Linhas 754-761 (`prf-badge` + botão `✨ Vire Premium`); linhas 802-841 (`function UpgradeModal`, `window.FidesUI.useModalClose`, copy "R$ 89,90/ano — checkout em breve") |
| 16 | Nenhum diálogo nativo do browser introduzido (`window.confirm`/`alert`) nos arquivos tocados | ✓ VERIFIED | Zero ocorrências de `window.confirm(` e `alert(` em `fides-claude.jsx`, `fides-orcamento.jsx`, `fides-studio.jsx` |

**Score:** 15/16 truths verified (1 gap: #9, defesa em profundidade do gate WRITE)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `assets/fides-store.jsx` | estado `userPlan` + `isPremium` no context value e fallback | ✓ VERIFIED | Presente, substantivo, ligado a todos os 3 planos consumidores |
| `supabase/profiles-plan-privileges.sql` | REVOKE/GRANT column-level, `plan` excluído | ✓ VERIFIED | Arquivo correto; aplicação live confirmada por humano (não reverificável pelo código) |
| `api/assistant.js` | `READ_FUNCTIONS`/`WRITE_FUNCTIONS`, `buildToolsForPlan`, `FREE_TIER_ADDENDUM`, `FREE_TIER_MONTHLY_LIMIT`, `PREMIUM_REQUIRED`/`FREE_MONTHLY_LIMIT` | ⚠️ **HOLLOW (defesa incompleta)** | Todos os símbolos existem e a montagem do payload está correta, mas falta a camada de revalidação da resposta do Gemini (CR-01) — ver truth #9 |
| `assets/fides-claude.jsx` | entradas `friendlyError` + dispatch | ✓ VERIFIED | Presente e ligado; **porém** sem checagem de `isPremium` antes de executar WRITE tools retornadas (mesmo gap CR-01) |
| `assets/fides-orcamento.jsx` | entradas `friendlyAiError` + gate do botão | ✓ VERIFIED | Presente, substantivo, ligado (`isPremium` via prop de `store.isPremium`) |
| `assets/fides-studio.jsx` | badge de tier + CTA + `UpgradeModal` | ✓ VERIFIED | Presente, substantivo, ligado; `React.createElement` consistente (zero JSX novo) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `assets/fides-store.jsx` (`isPremium`) | `assets/fides-orcamento.jsx` (`PlnMesInsights`) | prop `isPremium: !!store.isPremium` (linha 1559) | ✓ WIRED | Confirmado por leitura da call-site |
| `assets/fides-store.jsx` (`isPremium`/`userPlan`) | `assets/fides-studio.jsx` (`PerfilView`) | destructuring de `window.useFides()` (linhas 711-712) | ✓ WIRED | Confirmado |
| `api/assistant.js` (error codes) | `assets/fides-claude.jsx` (`friendlyError`) | fetch response `errCode`/`status===429` ladder | ✓ WIRED | Confirmado (linhas 703-717) |
| `api/assistant.js` (error codes) | `assets/fides-orcamento.jsx` (`friendlyAiError`) | `!res.ok` handling | ✓ WIRED | Confirmado (mapa presente, mesmos 2 códigos) |
| `api/assistant.js` (`buildToolsForPlan`) | Gemini payload (`gemini.buildPayload`) | `tools: isAnalysisMode ? undefined : buildToolsForPlan(isPremium)` (linha 380) | ✓ WIRED | Confirmado — o call-site antigo (`TOOLS_DECLARATION` estático) foi substituído |
| `api/assistant.js` (`tool_calls` na resposta) | `assets/fides-claude.jsx` (execução de WRITE tools) | resposta HTTP → `executeTools`/`TOOLS_REQUIRING_CONFIRMATION` | ✗ **NOT RE-VALIDATED** | Nenhum dos dois lados checa `isPremium`/tier neste link — é exatamente o gap da truth #9 (CR-01) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `api/assistant.js` sintaxe válida (CommonJS) | `node -c api/assistant.js` | sem erro | ✓ PASS |
| Balanceamento grosseiro de chaves nos 4 `.jsx` tocados | contagem de `{`/`}` via `node -e` | 0 diff em todos os 4 arquivos | ✓ PASS (indicativo; não substitui parse real do Babel-standalone no browser — ver Human Verification) |
| Fail-closed: nenhuma negação direta `plan !== 'free'` / `userPlan !== 'free'` em qualquer arquivo tocado | `grep -c` nos 2 arquivos | 0 ocorrências em ambos | ✓ PASS |
| Debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) nos 6 arquivos da fase | `grep -n -E` | 0 ocorrências | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| GATE-01 | 13-01 | Store lê `plan` real | ✓ SATISFIED | Truths 1-3 |
| GATE-02 | 13-03 | Free degustação limitada ~10 msg/mês | ✓ SATISFIED (com ressalva) | Truth 10 — mecanismo correto; enforcement real depende do nonce D-06 não estar quebrado (WR-01, pré-existente, já rastreado separadamente) |
| GATE-03 | 13-02, 13-03, 13-04 | Premium libera WRITE/IA; free bloqueado | ⚠️ **PARCIALMENTE BLOQUEADO** | Truths 4-9: mecanismo primário (montagem do payload) correto e verificado, mas a garantia completa ("free bloqueado", com defesa em profundidade) FALHA — CR-01 não corrigido |
| PAYWALL-01 | 13-04 | Paywall + tela de upgrade (M6 placeholder) | ✓ SATISFIED | Truths 12-16 |

**Traceability gap (não bloqueante):** `.planning/REQUIREMENTS.md` ainda não formaliza GATE-01/02/03/PAYWALL-01 como linhas individuais rastreáveis — hoje é só a nota de sumário "Phase 13 (IA-3 · gating): GATE-01/02/03, PAYWALL-01" (linha 42), consistente com `STATE.md`: `milestone_formalized: false` (o épico IA/WhatsApp, Phases 11-14, ainda não foi aberto formalmente via `/gsd-new-milestone`). Todos os 4 IDs aparecem no frontmatter `requirements:` de pelo menos um plan; nenhum requirement órfão encontrado. Este gap é de processo/rastreabilidade, não de implementação — registrado aqui, não tratado como falha.

### Anti-Patterns Found

Nenhum anti-pattern de débito (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER, implementação vazia, dado hardcoded, `console.log`-only) encontrado nos 6 arquivos tocados pela fase.

**Achado de arquitetura/segurança (não é anti-pattern de código, é gap de defesa em profundidade):** ver truth #9 e bloco `gaps` — CR-01 do `13-REVIEW.md`, classificado como 🛑 CRITICAL pelo próprio code-reviewer da fase, permanece sem correção nos commits (`2221196`, `438826a`, `0ac1dbc`, `977cc99`, `bfdb61c`, `87b51dc`).

## Julgamento sobre os 2 achados críticos do 13-REVIEW.md (CR-01 / WR-01=CR-02)

O contexto da tarefa pediu julgamento explícito sobre se os 2 achados críticos do code review afetam a CONQUISTA DO OBJETIVO da fase (o gate sendo implementado) ou se são apenas hardening de acompanhamento. Minha avaliação:

- **CR-01 (tool_calls não revalidados) — AFETA o objetivo da fase, tratado como GAP bloqueante (truth #9).** A fase existe para que "premium libere WRITE/IA; free bloqueado" seja verdade. O mecanismo implementado (não enviar declarações WRITE ao Gemini) é necessário mas, pelo próprio design documentado nas plans (D-01: "capacidade real é re-decidida server-side a cada request"), não deveria ser a ÚNICA camada — deveria haver defesa em profundidade explícita no caminho de retorno do Gemini. Sem ela, a garantia "free bloqueado" depende inteiramente de o modelo nunca alucinar/ser trocado para fallback/sofrer prompt injection — uma suposição não verificada, e agravada pelo próprio `FREE_TIER_ADDENDUM` que expõe os nomes das tools. É um achado NOVO desta fase (não pré-existente), sem débito rastreado em `.planning/todos/`, com fix concreto já esboçado no próprio review e não aplicado. Por isso entra como gap formal, não como nota de rodapé.

- **WR-01/CR-02 (replay de nonce pula os 2 caps) — NÃO tratado como gap novo desta fase; documentado como risco herdado.** Este achado é PRÉ-EXISTENTE (Phase 12, D-06), já capturado em `.planning/todos/pending/ratelimit-bypass-toolresults.md` (criado 2026-07-06, antes da Phase 13) cobrindo exatamente o `USER_DAILY_LIMIT`. A Phase 13 estende o MESMO padrão (`isFirstCallOfTurn`) para o novo cap mensal `FREE_TIER_MONTHLY_LIMIT`, herdando a mesma fraqueza — mas não introduz um mecanismo novo quebrado, e a correção já está no radar do backlog do projeto. Registrado aqui como ressalva de qualidade sobre a robustez do GATE-02 (o cap "de papel" existe e está correto; o cap "de fato" depende de uma correção pendente e rastreada em outro lugar), não como um blocker desta verificação.

## Human Verification Required (Deferred to `/gsd-verify-work 13`)

Os itens abaixo já eram esperados como `human-check` nas próprias plans (checkpoint humano em lote) e não são automatizáveis por este verificador — não contam como falha, mas precisam ser confirmados por um humano antes de considerar a fase 100% fechada:

### 1. 403 forçado na Análise da IA como free
**Test:** Logado como conta free, forçar `fetch('/api/assistant', {..., mode:'analysis'})` diretamente no console do browser (bypassando a UI).
**Expected:** Resposta `403 PREMIUM_REQUIRED`, sem chamada ao Gemini. Como conta pro, a Análise funciona normalmente.
**Why human:** Requer sessão autenticada real contra o servidor live; não reproduzível por grep/leitura estática.

### 2. Free bate no cap de 10 msg/mês (11ª mensagem)
**Test:** Como free, mandar 10 mensagens de chat READ no mês; mandar a 11ª.
**Expected:** A 11ª retorna `429 FREE_MONTHLY_LIMIT` com a copy de paywall (não o erro genérico de limite diário). Uma pergunta que dispara `consultar_saldo` (2 chamadas HTTP, 1 turno) grava só 1 linha em `assistant_usage` (checagem via SQL Editor).
**Why human:** Requer 11 interações reais contra o servidor live + inspeção do banco.

### 3. Free não consegue lançar transação via chat (ausência de card de confirmação)
**Test:** Como free, pedir "lança 50 no mercado" no chat.
**Expected:** O assistente nunca abre o card de confirmação de WRITE — recusa em texto apontando para o Premium. Como pro, o mesmo pedido abre o card (regressão limpa da Phase 12).
**Why human:** Comportamento de modelo (Gemini) + fluxo de UI real; também é o teste mais direto do gap CR-01 registrado acima — se por algum motivo o card ABRIR para uma conta free, isso confirma a exploração do gap em produção e deve ser tratado como incidente, não como achado de verificação.

### 4. Free vs. pro no Perfil + parse sem erro
**Test:** Carregar o app como free e como pro; abrir a aba Perfil.
**Expected:** Free vê badge "Free" + botão "✨ Vire Premium" que abre o `UpgradeModal` (copy "checkout em breve"); pro vê badge "Premium", sem CTA. App carrega sem erro de parse do Babel-standalone (T-13-08 do threat model da própria plan).
**Why human:** Renderização visual real + parse em runtime do browser; a checagem de balanceamento de chaves feita nesta verificação é só indicativa, não substitui o parse real do Babel-standalone.

### 5. Trava live de `profiles.plan` (regressão futura)
**Test:** Já confirmado uma vez pelo usuário no apply da Plan 13-02 (ver truth #5). Não é um novo item, mas fica registrado que qualquer futura alteração de schema/policy em `profiles` deve reconfirmar os 3 eixos (self-UPDATE de `plan` falha; `name`/`group_targets` salvam; toggle via SQL Editor funciona).
**Why human:** Estado do banco live, não verificável pelo código-fonte.

## Gaps Summary

**1 gap bloqueante (truth #9 / CR-01):** o mecanismo primário do GATE-03 (não enviar declarações WRITE ao Gemini para contas free) está corretamente implementado e verificado — mas a fase não entrega a defesa em profundidade que o seu próprio threat model promete (D-01: "capacidade real é re-decidida server-side a cada request"). Falta uma checagem explícita, em `api/assistant.js` e em `assets/fides-claude.jsx`, revalidando o NOME de qualquer `tool_call` retornado pelo Gemini contra `isPremium` antes de repassá-lo/executá-lo. O `13-REVIEW.md` já contém um fix concreto e pronto para aplicar (CR-01). Recomenda-se uma quinta plan curta (ou reabertura da 13-03/13-04) dedicada a fechar CR-01 + WR-04 antes de considerar o GATE-03 estruturalmente fechado, mesmo que os itens de UAT (`/gsd-verify-work 13`) passem — porque os testes manuais de UAT descritos nas plans (pedir "lança 50 no mercado" como free) testam o comportamento ESPERADO do modelo, não o caminho de exceção que CR-01 deixa aberto.

Todos os demais 15 must-haves (GATE-01 completo, GATE-02 no nível de mecanismo, GATE-03 no nível de montagem de payload e Análise premium-only, PAYWALL-01 completo) estão implementados, presentes, substantivos e ligados no código real — não são achados de placeholder/stub, e a maior parte já tem confirmação humana registrada (Plan 13-02) ou grep/leitura de código consistente com o que o SUMMARY reivindica.

---

_Verified: 2026-07-16_
_Verifier: Claude (gsd-verifier)_
