---
phase: 16-painel-admin-backoffice
verified: 2026-07-17T19:20:00Z
status: passed
score: 20/23 verificados + 3 fechados por decisão do dono (2026-07-17)
behavior_unverified: 0
overrides_applied: 1
gaps_resolution: >
  Os 2 gaps eram de PROCESSO/DECISÃO (nenhum de código ou segurança) e foram fechados
  pelo dono em 2026-07-17: (1) RETENÇÃO do audit log RATIFICADA (2 anos + expurgo manual) —
  docs/admin-lgpd.md atualizado de "a ratificar" para "ratificada". (2) UATs da Phase 13:
  3 verificados via dogfooding do painel (Tests 1 WRITE-block, 4 Perfil, 5 trava live via
  introspecção 16-01) → 13-UAT.md status:resolved; Tests 2 (403 Análise) e 3 (cap 10/mês)
  DEFERIDOS como débito rastreado por decisão explícita do dono (mesmo tratamento dos 2 UATs
  da Phase 12), registrados em STATE.md §Deferred/Open Items.
gaps:
  - truth: "ADMIN-04: os 5 UATs pendentes da Phase 13 (gating free/pro) foram re-executados VIA PAINEL (dogfooding), destravando o gate da fase"
    status: partial
    reason: >
      `.planning/phases/13-ia-3-gating-premium-in-app/13-UAT.md` — o arquivo autoritativo de
      rastreamento dos 5 testes humanos da Phase 13 — continua com `status: testing`,
      `passed: 0`, `pending: 5`, e cada um dos 5 testes individuais marcado
      `result: [pending]`. O commit que gravou esse estado (`efb9439`,
      "test(13): persist human verification items as UAT", 2026-07-16) nunca foi seguido de
      atualização, mesmo após os commits finais da Phase 16 (`2a58c42`, 2026-07-17). O
      `13-VERIFICATION.md` (fonte oficial da lista) também segue com `status: human_needed`
      e os mesmos 5 itens na seção "Human Verification Required", sem qualquer edição.
      A única evidência real de dogfooding no repositório é o `16-04-SUMMARY.md` (coverage D4)
      e o `16-03-SUMMARY.md` (coverage D5), que cobrem apenas ~2 dos 5 itens: (a) free pedir
      lançamento pela IA → recusa em texto ("recurso exclusivo Premium"), aproximando o item #1
      da lista mas sem confirmar explicitamente o caminho "servidor 403 antes do relay" nem o
      comportamento como pro (regressão); e (b) Perfil free mostra badge+CTA, cobrindo metade
      do item #4 (a parte "pro sem CTA" é atribuída à mesma conta "deyglison", não a uma conta
      pro dedicada testada separadamente). Os itens #2 (403 forçado na Análise da IA), #3 (cap
      de 10 msg/mês, 11ª mensagem) e #5 (reconfirmação da trava live de `profiles.plan`) não têm
      nenhuma evidência de execução em nenhum SUMMARY da Phase 16. `STATE.md` (linha 55, tabela
      "Deferred / Open Items") ainda lista "Phase 13 — 5 UATs humanos (gating free/pro)" como
      item aberto/adiado, não como fechado.
    artifacts:
      - path: ".planning/phases/13-ia-3-gating-premium-in-app/13-UAT.md"
        issue: "Todos os 5 testes seguem `result: [pending]`; `passed: 0`, `pending: 5` no Summary — nunca atualizado pós-dogfooding"
      - path: ".planning/phases/13-ia-3-gating-premium-in-app/13-VERIFICATION.md"
        issue: "status: human_needed inalterado; os 5 itens de 'Human Verification Required' seguem intactos, nenhum promovido a confirmado"
    missing:
      - "Executar (ou registrar explicitamente a execução prévia de) os itens #2, #3 e #5 dos 5 UATs da Phase 13 via /painel, e atualizar 13-UAT.md (result: pass/fail por teste) + 13-VERIFICATION.md"
      - "Para os itens #1 e #4 (parcialmente cobertos): confirmar explicitamente o comportamento 'como pro' (regressão) e re-testar com uma conta pro dedicada distinta da conta admin, fechando a lacuna que o próprio 16-03-SUMMARY já sinaliza como 'confirmada parcialmente'"
      - "Alternativa aceitável: se o dono decidir que a Phase 16 não precisa bloquear nisso, registrar override explícito ou mover este item para débito rastreado (como já foi feito para os 2 UATs da Phase 12) — hoje não há essa decisão registrada para os 5 UATs da Phase 13"
  - truth: "ADMIN-04: a retenção do audit log (proposta 2 anos, expurgo manual) está documentada E RATIFICADA com o dono"
    status: partial
    reason: >
      `docs/admin-lgpd.md` documenta a proposta de retenção com clareza (base legal,
      minimização, ASVS V7) — a parte "documentada" do must-have está cumprida. Porém o
      próprio arquivo declara explicitamente, no cabeçalho (linha 5) e na seção 3 (linha 34):
      "Status: proposta a ratificar com o dono... item ainda em aberto" / "precisa ser
      confirmada explicitamente pelo dono... Até a ratificação, tratar como proposta." O
      `16-04-SUMMARY.md` (seção "Resolução (orquestrador)") também registra: "Retenção do
      audit (2 anos): segue como proposta a ratificar — item aberto registrado no
      ROADMAP/STATE". Não há, em nenhum artefato do repositório, um registro de ratificação
      (aprovação explícita do dono) desta política — apenas a proposta documentada.
    artifacts:
      - path: "docs/admin-lgpd.md"
        issue: "Seção 3 e cabeçalho marcam retenção como 'proposta a ratificar', não uma decisão fechada"
    missing:
      - "Decisão explícita do dono (ratificação) sobre a política de retenção de 2 anos + expurgo manual, registrada em docs/admin-lgpd.md (remover a marca 'a ratificar') e no STATE.md/ROADMAP"
deferred: []
human_verification:
  - test: "Confirmar (ou reexecutar) os 5 UATs pendentes da Phase 13 via /painel"
    expected: "Ver `13-UAT.md` para os 5 testes exatos (WRITE bloqueado p/ free, 403 forçado na Análise da IA, cap de 10 msg/mês, Perfil free/pro, trava live de profiles.plan)"
    why_human: "Comportamento runtime do Gemini + sessão autenticada real + inspeção de banco — não verificável por leitura de código"
  - test: "Ratificar explicitamente a retenção do audit log (2 anos, expurgo manual) em docs/admin-lgpd.md"
    expected: "Dono aprova ou ajusta a proposta; o documento deixa de dizer 'a ratificar'"
    why_human: "Decisão de produto/compliance, não verificável por código"
---

# Phase 16: Painel de administração / backoffice — Verification Report

**Phase Goal:** Painel de administração acessível online (`fides-money.vercel.app/painel`) para o admin gerir o produto SEM depender do Supabase SQL Editor — listar contas cadastradas, ver usos/métricas, alternar o tier free/pro/family. Superfície admin SERVER-SIDE via `service_role` (NUNCA client SDK), audit log de toda ação admin, autenticação de admin dedicada. MVP = listar contas + trocar tier + audit log.

**Requirements:** ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04
**Verified:** 2026-07-17
**Status:** gaps_found
**Re-verificação:** Não — verificação inicial da Phase 16 completa (4 plans)

## Contexto herdado (não re-derivado)

Por instrução explícita do solicitante, os seguintes pontos foram tratados como verificação humana já registrada, não re-julgados do zero:
- MCP Supabase indisponível ao agente neste runtime — fundação SQL (16-01) aplicada e verificada manualmente pelo dono via SQL Editor (introspecção A1-A8 + `has_function_privilege`/`has_table_privilege` provando `authenticated` barrado / `service_role` permitido / trava 13-02 intacta).
- Backend (16-02) deployado e fail-closed verificado em produção (`GET /api/admin?action=whoami` sem token → `401 JWT_MISSING`).
- Front (16-03) verificado por dogfooding E2E (login → lista de contas reais → Alterar plano com motivo+ConfirmDialog+toast → linha na Auditoria; gating free/pro refletido no app).
- 2 revisões adversariais de segurança rodaram em cada caminho sensível (16-01/16-02/16-03), com 2 findings HIGH corrigidos (clickjacking em `/painel.html` → `1e1c504`; bypass do rate-limit → `f557735`).
- Os 2 UATs de regressão da Phase 12 (Test 1 homônimo, Test 4 falso-cancelamento) são débito ANTIGO da Phase 12 e ficam deferidos por decisão já registrada — **não contam como gap desta fase**.

Estes pontos NÃO aparecem como gaps abaixo. O que segue é verificação independente do que resta.

## Goal Achievement

### Observable Truths

#### ADMIN-01 — Fundação SQL (16-01)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | RPCs `admin_list_accounts`/`admin_set_plan` existem no banco live com `SECURITY DEFINER` + `set search_path = public` | ✓ VERIFIED | `supabase/admin-backoffice.sql:69-122,140-184` — ambas com `language plpgsql security definer set search_path to 'public'`; confirmado no live via SQL Editor pelo dono (16-01-SUMMARY.md D1, `has_function_privilege`) |
| 2 | Executar as RPCs como `authenticated` falha com `permission denied for function` | ✓ VERIFIED (human-confirmed) | `REVOKE EXECUTE ... FROM public, anon, authenticated` antes do `GRANT ... TO service_role` nas duas assinaturas exatas (`admin-backoffice.sql:126-127,187-188`); confirmado no live (16-01-SUMMARY.md D2) |
| 3 | `admin_audit_log` com RLS habilitada e ZERO policies; select como `authenticated` falha | ✓ VERIFIED (human-confirmed) | `admin-backoffice.sql:57-58`: `enable row level security` sem nenhuma `create policy`, mais `revoke all ... from anon, authenticated`; confirmado no live (16-01-SUMMARY.md D2) |
| 4 | `admin_set_plan` atualiza `profiles.plan` e insere audit na MESMA transação, retornando `{target, before, after}` | ✓ VERIFIED | `admin-backoffice.sql:160-183` — `select ... for update` captura `v_before`, `update profiles`, `insert admin_audit_log` no mesmo bloco `plpgsql`, `return jsonb_build_object('target',...,'before',...,'after',...)`. Exercido em produção via dogfooding: 16-03-SUMMARY.md D2 registra uma linha real `set_plan` na conta "deyglison" com before/after/reason na aba Auditoria |
| 5 | `admin_list_accounts` retorna metadados/contagens agregadas + `total_count`, nunca lançamentos individuais | ✓ VERIFIED | `admin-backoffice.sql:96-121` — `jsonb_agg` só de `email/name/plan/created_at/last_sign_in_at` + 5 `count(*)` agregados; `jsonb_build_object('accounts',...,'total_count', v_total)`; nenhuma coluna de valor/descrição de transação individual. Exercido em produção (16-03-SUMMARY.md D1 — lista real de 2 contas) |

#### ADMIN-02 — Guard + roteador (16-02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | `GET /api/admin?action=whoami` sem `Authorization` → `401 JWT_MISSING` | ✓ VERIFIED (produção) | `api/_lib/admin/guard.js:187-193`; confirmado em produção via browser (16-02-SUMMARY.md D1) |
| 7 | Bearer inválido → `401 JWT_INVALID` | ✓ VERIFIED | `guard.js:202-206` — `authClient.auth.getUser(token)`; erro/sem user → 401. Verificação estática + revisão adversarial (16-02-SUMMARY.md D2); não houve curl isolado deste caso específico, mas o código é idêntico ao padrão já em produção de `api/assistant.js` |
| 8 | `ADMIN_USER_IDS` ausente/vazia → 403 para TODOS (fail-closed) | ✓ VERIFIED | `guard.js:212-220` — `allowlist.length > 0 && allowlist.includes(...)`; lista vazia ⇒ `isAllowed=false` para qualquer `user.id`. Este é o teste que o checkpoint humano da Task 3 do 16-02-PLAN exigia rodar ANTES de preencher `ADMIN_USER_IDS` em produção; o checkpoint foi um gate bloqueante (`gate="blocking-human"`) e a Phase 16 só avançou para 16-03/16-04 após aprovação, o que corrobora a passagem |
| 9 | Usuário autenticado não-allowlisted → 403 + linha `denied_access` em `admin_audit_log` | ✓ VERIFIED | `guard.js:216-220` chama `auditDenied(user, req)` antes do `403`; `auditDenied` grava `action:'denied_access', status:'denied'` (linhas 106-113). Checkpoint humano do 16-02 exigia confirmar isso via MCP antes de aprovar |
| 10 | Flood de negados tem teto por janela (não 1:1 com as requisições) | ✓ VERIFIED | `guard.js:21-22,86-104` — `DENIED_THROTTLE_WINDOW_MS=60000`, `DENIED_THROTTLE_MAX=5`; conta linhas `status='denied'` do mesmo `admin_id`/`ip` na janela antes de inserir |
| 11 | Admin allowlisted → `whoami` 200 com `user.id/email`; `set_plan` muda plan + audit atômico | ✓ VERIFIED (dogfooding) | `api/admin.js:62-70`; exercido em produção (16-03-SUMMARY.md D1/D2 — login admin funcional, set_plan com audit) |
| 12 | Toda action grava audit (leituras = linha leve; `set_plan` = via RPC atômica) | ✓ VERIFIED | `api/admin.js` — todo branch do `switch` chama `audit({...})` ou já passa pela RPC atômica (16-01); inclusive erro/405/action desconhecida gravam `status:'error'` (linhas 64,75,88,99,107,118,132,138,158) |
| 13 | Respostas sempre com `Cache-Control: no-store` | ✓ VERIFIED | `api/admin.js:17` — `res.setHeader('Cache-Control', 'no-store')` incondicional, antes de qualquer branch |

#### ADMIN-03 — Front `/painel` (16-03)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 14 | `/painel` serve `painel.html` (rewrite antes do catch-all) | ✓ VERIFIED | `vercel.json:20-23` — entrada `/painel → /painel.html` antes de `/((?!api/).*)` (linha 25); confirmado em produção (16-03-SUMMARY.md, dogfooding "painel confirmado 100% funcional") |
| 15 | Headers `X-Frame-Options: DENY` e `Referrer-Policy: no-referrer` em `/painel` | ✓ VERIFIED | `vercel.json:36-51` — presentes em `/painel` E `/painel.html` (mais `Content-Security-Policy: frame-ancestors 'none'`, fix do finding HIGH `1e1c504`) |
| 16 | Admin loga, vê lista de contas reais (e-mail, nome, badge de plano, criado, último login, msgs IA/mês) com busca+filtro | ✓ VERIFIED (dogfooding) | `assets/fides-admin.jsx` — `fetchAdmin('accounts', ...)` com `search`/`plan`/paginação por `total_count`; dogfooding confirma lista de 2 contas reais (16-03-SUMMARY.md D1) |
| 17 | Alterar plano: select de tier + motivo obrigatório + `ConfirmDialog` → toast + linha na Auditoria | ✓ VERIFIED (dogfooding) | `fides-admin.jsx:266-348` — `reasonValid = reason.trim().length >= 4`, `FidesUI.useConfirm()`, `POST` com `{target_user,new_plan,reason}`; dogfooding confirma linha real na Auditoria (16-03-SUMMARY.md D2) |
| 18 | Trocar free↔pro de conta teste reflete no app após F5 | ⚠️ Parcialmente confirmado (ver gap ADMIN-04 abaixo) | Confirmado o lado "free bloqueia WRITE + Perfil free+CTA"; o lado "pro" foi confirmado só pela própria conta admin ativa (deyglison), não por uma conta de teste dedicada alternando free→pro→free como o plano pedia — tratado como parte do gap de dogfooding ADMIN-04, não como falha isolada |
| 19 | Usuário comum que loga em `/painel` vê "acesso restrito" (403) | ✓ VERIFIED | `fides-admin.jsx:50,214,654` — mapa de erro `FORBIDDEN: 'Acesso restrito.'` e branch dedicado de tela negada quando `err.status === 403` |

#### ADMIN-04 — Hardening + LGPD + dogfooding (16-04)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 20 | Rate-limit geral por user/IP requisitante (além do throttle de `denied_access`) | ✓ VERIFIED | `guard.js:24-31,144-185` (`checkGeneralRateLimit`, teto 30/60s, fail-open); `api/admin.js:31-35` chama-o logo após o guard passar, antes do dispatch. Fix pós-review (`f557735`) garante que toda requisição pós-guard grava exatamente 1 linha (fecha o bypass HIGH original) |
| 21 | Retenção do audit log documentada E ratificada com o dono | ✗ **FAILED (parcial)** | `docs/admin-lgpd.md` documenta a proposta com solidez, mas o próprio arquivo (linhas 5, 34) diz explicitamente "a ratificar... item ainda em aberto". Ver gap estruturado no frontmatter |
| 22 | Memória `testar-tier-free-pro` aponta para o painel como caminho primário (SQL Editor vira fallback) | ✓ VERIFIED | `~/.claude/.../memory/testar-tier-free-pro.md` — "Forma principal (a partir da Phase 16): o Painel Admin... Alternativa (fallback): Supabase SQL Editor"; passo do F5 preservado |
| 23 | Os 5 UATs pendentes da Phase 13 + UATs da Phase 12 foram re-executados VIA PAINEL, destravando o gate da fase | ✗ **FAILED (parcial)** | Phase 12 (2 itens): deferido por decisão explícita já registrada (débito rastreado, não é gap desta fase). Phase 13 (5 itens): `13-UAT.md` continua `pending: 5`/`passed: 0`; `13-VERIFICATION.md` continua `human_needed` com os 5 itens intactos. Só ~1,5 dos 5 itens têm qualquer evidência de execução (ver gap estruturado no frontmatter) |

**Score:** 20/23 truths verified (2 gaps estruturados; a truth #18 é consequência do mesmo gap de dogfooding da #23, contada uma vez no score de gaps)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/admin-backoffice.sql` | audit_log + 2 RPCs SECURITY DEFINER service_role-only | ✓ VERIFIED | 189 linhas; espelha exatamente o que o SUMMARY 16-01 descreve; comentário de retenção (doc-only) do 16-04 presente |
| `api/admin.js` | roteador único (whoami/accounts/audit/set_plan) | ✓ VERIFIED | Guard + rate-limit geral + dispatch + audit em toda branch; `node -c` limpo |
| `api/_lib/admin/guard.js` | `requireAdmin` fail-closed + throttle + rate-limit geral | ✓ VERIFIED | Ordem load-bearing 401→401→403(+audit)→adminClient confirmada por leitura direta; `checkGeneralRateLimit` presente e wired |
| `api/_lib/admin/accounts.js` | chama `admin_list_accounts` | ✓ VERIFIED | `rpc('admin_list_accounts', {...})`, repassa `{accounts, total_count}` |
| `api/_lib/admin/set-plan.js` | chama `admin_set_plan` com validação defensiva | ✓ VERIFIED | Valida UUID/enum/reason antes de chamar a RPC; não duplica audit |
| `api/_lib/admin/audit-list.js` | lê `admin_audit_log` paginado | ✓ VERIFIED | `select('*', {count:'exact'})`, `order by created_at desc` |
| `painel.html` | entrada isolada, tokens.css primeiro, storageKey próprio | ✓ VERIFIED | `tokens.css` antes de `fides-admin.css`; `storageKey: 'fides-admin-auth'`; nenhuma referência a service_role |
| `assets/fides-admin.jsx` | telas login/negado/contas/alterar-plano/auditoria | ✓ VERIFIED | 710 linhas; `fetchAdmin` único ponto de acesso com Bearer; zero `dangerouslySetInnerHTML` real (só comentário); zero `.from('profiles').update` |
| `vercel.json` | rewrite `/painel` antes do catch-all + headers anti-clickjacking | ✓ VERIFIED | JSON válido; ordem correta; headers em `/painel` E `/painel.html` |
| `docs/admin-lgpd.md` | base legal + minimização + retenção (ASVS V7) | ✓ VERIFIED (conteúdo) / ⚠️ retenção não ratificada | Documento completo e bem fundamentado; status da retenção explicitamente "a ratificar" |
| Memória `testar-tier-free-pro` | painel como caminho primário | ✓ VERIFIED | Ver truth #22 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `api/admin.js` | `api/_lib/admin/guard.js` | `requireAdmin(req)` chamado ANTES de qualquer dispatch | ✓ WIRED | Linha 20, `if (g.fail) { ...; return; }` antes de qualquer `switch` |
| `guard.js` (allowlist) | `adminClient` (service_role) | adminClient só instanciado após `isAllowed` | ✓ WIRED | Linhas 216-229 — bloco `(d)` estritamente depois do bloco `(c)` |
| `api/admin.js` | `api/_lib/admin/set-plan.js` → RPC `admin_set_plan` | `setPlan(adminClient, {...})` | ✓ WIRED | Linhas 123-129; RPC grava audit atômico, roteador não duplica |
| `assets/fides-admin.jsx` | `api/admin.js` | `fetch('/api/admin?action=...', {headers:{Authorization:'Bearer '+jwt}})` | ✓ WIRED | `fetchAdmin` (linha 73) único helper, usado por todas as telas |
| `vercel.json` rewrites | `painel.html` | `/painel → /painel.html` antes do catch-all | ✓ WIRED | Ordem confirmada no array (linha 21 antes de linha 25) |
| `13-UAT.md`/`13-VERIFICATION.md` | dogfooding da Phase 16 | resultado do painel deveria fechar os 5 testes | ✗ NOT WIRED | Nenhuma atualização desses arquivos após o dogfooding da Phase 16 — o "fechamento do gate" reivindicado pelo ADMIN-04 não se reflete na fonte oficial de rastreamento |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Sintaxe válida dos 5 arquivos serverless do painel | `node -c api/admin.js api/_lib/admin/{guard,accounts,set-plan,audit-list}.js` | sem erro | ✓ PASS |
| `requireAdmin` chamado antes de qualquer `switch`/dispatch | leitura direta `api/admin.js:16-24` | guard é a primeira instrução após `Cache-Control` | ✓ PASS |
| `adminClient` (service_role) só nasce pós-allowlist | leitura direta `guard.js:209-229` | bloco `(d)` estritamente após bloco `(c)` | ✓ PASS |
| Zero `service_role`/`SERVICE_ROLE` no client (`painel.html`, `fides-admin.jsx`, `fides-admin.css`) | `grep -n "service_role\|SERVICE_ROLE"` | 0 ocorrências | ✓ PASS |
| Zero mutação de `profiles` pelo client SDK no painel | `grep -n "\.from('profiles')\.update"` em `fides-admin.jsx` | 0 ocorrências | ✓ PASS |
| Curl real de `/painel` em produção | não executável neste ambiente (sem rede de saída) | não rodado | ? SKIP (compensado por evidência de dogfooding no SUMMARY + leitura estática do vercel.json) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ADMIN-01 | 16-01 | Fundação SQL: RPCs + audit table, grants service_role-only | ✓ SATISFIED | Truths 1-5 |
| ADMIN-02 | 16-02 | Guard fail-closed + roteador `api/admin.js` + throttle | ✓ SATISFIED | Truths 6-13 |
| ADMIN-03 | 16-03 | Front `/painel` isolado + rewrite + headers | ✓ SATISFIED (com ressalva truth 18, absorvida no gap ADMIN-04) | Truths 14-19 |
| ADMIN-04 | 16-04 | Hardening + LGPD + dogfooding UATs 12/13 | ✗ **PARCIALMENTE BLOQUEADO** | Truths 20-23 — rate-limit geral e memória OK; retenção não ratificada; dogfooding dos 5 UATs da Phase 13 não fechado na fonte oficial |

Todos os 4 IDs `ADMIN-01..04` aparecem em `.planning/REQUIREMENTS.md` (linhas 49-52) e no `Traceability` (linhas 102-105, status "Planned" — desatualizado, deveria refletir "Complete"/"Parcial" pós-fase). Nenhum requirement órfão encontrado.

### Anti-Patterns Found

Nenhum anti-pattern de débito (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER, implementação vazia, `console.log`-only, diálogo nativo `confirm`/`alert`) encontrado nos arquivos de código da fase (`supabase/admin-backoffice.sql`, `api/admin.js`, `api/_lib/admin/*.js`, `painel.html`, `assets/fides-admin.jsx`, `vercel.json`, `docs/admin-lgpd.md`). O texto "a ratificar" em `docs/admin-lgpd.md` não é um marcador de débito de código — é uma decisão de produto explicitamente sinalizada como pendente, tratada aqui como gap de processo (ver frontmatter), não como anti-pattern de implementação.

### Human Verification Required

### 1. Reexecutar/confirmar os 5 UATs pendentes da Phase 13 via `/painel`
**Test:** Ver os 5 testes exatos em `.planning/phases/13-ia-3-gating-premium-in-app/13-UAT.md` (WRITE bloqueado para free / 403 forçado na Análise da IA / cap de 10 msg/mês / Perfil free vs. pro / trava live de `profiles.plan`).
**Expected:** Cada teste registrado com `result: pass` em `13-UAT.md`, e `13-VERIFICATION.md` atualizado de `human_needed` para refletir o fechamento.
**Why human:** Comportamento runtime do Gemini, sessão autenticada real, e inspeção de banco — não verificável por leitura de código.

### 2. Ratificar a retenção do audit log
**Test:** Ler `docs/admin-lgpd.md` §3 e decidir explicitamente: 2 anos + expurgo manual está OK, ou ajustar.
**Expected:** O documento deixa de dizer "a ratificar" e passa a registrar a decisão fechada (com data/quem decidiu).
**Why human:** Decisão de produto/compliance, não verificável por código.

## Gaps Summary

A Phase 16 entrega solidamente as camadas de banco (ADMIN-01), backend (ADMIN-02) e front (ADMIN-03) do painel — código presente, substantivo, ligado e revisado adversarialmente (2 findings HIGH corrigidos ao longo do caminho). O ponto fraco está em ADMIN-04: das 4 truths desse plano, 2 estão sólidas (rate-limit geral, memória atualizada) e 2 ficam incompletas:

1. **Retenção do audit log** foi documentada com qualidade, mas nunca ratificada — o próprio artefato (`docs/admin-lgpd.md`) se autodeclara "proposta em aberto".
2. **Dogfooding dos 5 UATs da Phase 13** — que é o próprio motivo estrutural (D-seq) da Phase 16 existir antes da 14 — não foi fechado na fonte oficial (`13-UAT.md`/`13-VERIFICATION.md`). Há evidência parcial (aproximadamente 1,5 de 5 itens) espalhada pelos SUMMARYs do 16-03/16-04, mas nenhuma atualização dos arquivos de rastreamento da Phase 13, e `STATE.md` continua listando o item como aberto.

Diferente dos 2 UATs de regressão da Phase 12 (explicitamente aceitos como débito antigo, não-gap desta fase, por instrução do solicitante), os 5 UATs da Phase 13 não têm essa mesma decisão de descope registrada em nenhum artefato — por isso permanecem como gap, não como item deferido.

Nenhum dos 2 gaps é um problema de segurança ou de código: são itens de fechamento/processo (rodar os testes restantes e registrar a decisão do dono sobre retenção). Ambos são razoavelmente rápidos de fechar sem replanejamento.

---

_Verified: 2026-07-17_
_Verifier: Claude (gsd-verifier)_
