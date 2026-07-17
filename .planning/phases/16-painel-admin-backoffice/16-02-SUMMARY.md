---
phase: 16-painel-admin-backoffice
plan: 02
subsystem: api
tags: [serverless, vercel, commonjs, supabase, service-role, auth-guard, bearer-jwt, rate-limit, audit]

requires:
  - phase: 16-painel-admin-backoffice
    provides: "16-01 — RPCs admin_list_accounts/admin_set_plan (service_role-only) + tabela admin_audit_log"
provides:
  - "api/admin.js — roteador único (actions whoami/accounts/audit/set_plan), guard SEMPRE antes do dispatch, Cache-Control no-store"
  - "api/_lib/admin/guard.js — requireAdmin fail-closed (401→401→403+auditDenied→adminClient service_role) + throttle denied_access + logAction"
  - "api/_lib/admin/{accounts,set-plan,audit-list}.js — handlers que consomem as RPCs/tabela via service_role"
affects: [16-03, 16-04, painel /painel]

tech-stack:
  added: []
  patterns:
    - "Guard serverless fail-closed: ordem load-bearing 401 sem token → 401 JWT inválido (auth.getUser ANON) → 403 não-allowlisted (+audit denied throttled) → só então adminClient service_role"
    - "service_role nunca serializado em resposta; adminClient criado só pós-allowlist; audit-client separado só p/ admin_audit_log"
    - "Roteador único por action (economiza slots de function Vercel; ponto único de no-store)"
    - "IP anti-spoof: x-real-ip (edge-set) → fallback último elemento de x-forwarded-for"

key-files:
  created:
    - "api/admin.js"
    - "api/_lib/admin/guard.js"
    - "api/_lib/admin/accounts.js"
    - "api/_lib/admin/set-plan.js"
    - "api/_lib/admin/audit-list.js"
  modified: []

key-decisions:
  - "p_admin_id/p_admin_email preenchidos do JWT VERIFICADO (auth.getUser), nunca do body do cliente — fecha o confused-deputy da RPC 16-01"
  - "Throttle de denied_access antecipado do 16-04 (M1): teto 5/60s por admin_id (JWT) OR ip, estado durável no admin_audit_log (serverless-safe)"
  - "Verificação fail-closed feita em produção via navegador (JWT_MISSING); caminho admin-happy-path + throttle deferidos ao dogfooding via painel (16-04) — inviável testar com curl/token para usuário leigo"

patterns-established:
  - "Todo acesso admin passa pelo roteador único com guard fail-closed — impossível criar endpoint admin sem guard"

requirements-completed: [ADMIN-02]

coverage:
  - id: D1
    description: "Guard bloqueia requisição sem token (fail-closed) — endpoint deployado responde 401 JWT_MISSING"
    requirement: "ADMIN-02"
    verification:
      - kind: manual_procedural
        ref: "browser GET https://fides-money.vercel.app/api/admin?action=whoami → {\"error\":\"JWT_MISSING\"}"
        status: pass
    human_judgment: false
  - id: D2
    description: "Guard ordem load-bearing + fail-closed (ADMIN_USER_IDS vazia = 403 p/ todos) + no vazamento de service_role"
    requirement: "ADMIN-02"
    verification:
      - kind: other
        ref: "2 revisões adversariais (security + correctness) PASS; grep estático da ordem do guard; node -c nos 5 arquivos"
        status: pass
    human_judgment: false
  - id: D3
    description: "Usuário logado comum (JWT válido, não-allowlisted) recebe 403 + linha denied_access; admin recebe 200"
    verification: []
    human_judgment: true
    rationale: "Exige JWT real — inviável via curl p/ usuário leigo. Será exercido pelo painel no dogfooding (16-04): login admin → 200; usuário comum → acesso negado + audit"
  - id: D4
    description: "Throttle anti-flood de denied_access (teto por requisitante/janela)"
    verification: []
    human_judgment: true
    rationale: "Lógica confirmada por review (estado durável no banco, count>=5 barra); teste de rajada via painel/script no dogfooding (16-04)"
  - id: D5
    description: "set_plan muda tier + audit atômico (via RPC 16-01); accounts/audit listam via service_role"
    verification: []
    human_judgment: true
    rationale: "Nomes de param RPC e mapeamento de erro confirmados por review; execução real via painel (16-03/16-04)"

duration: ~1 sessão (código + 2 reviews + fix + deploy + verificação fail-closed)
completed: 2026-07-17
status: complete
---

# Phase 16 / Plano 02: Backend serverless do painel admin

**`api/admin.js` roteador único protegido pelo guard `requireAdmin` fail-closed (Bearer + auth.getUser + allowlist server-side), com throttle de denied_access e handlers que consomem as RPCs service_role-only — deployado e com fail-closed verificado em produção.**

## Performance
- **Tasks:** 3/3 (guard · roteador+handlers · checkpoint deploy+verificação)
- **Files created:** 5 (`api/admin.js` + 4 em `api/_lib/admin/`)
- **Completed:** 2026-07-17

## Accomplishments
- **Guard fail-closed (Task 1):** ordem load-bearing 401 sem token → 401 JWT inválido → 403 não-allowlisted (+ auditDenied throttled) → só então instancia `adminClient` service_role. `ADMIN_USER_IDS` vazia ⇒ 403 para todos. Normalização trim/lowercase dos dois lados (M9).
- **Roteador + handlers (Task 2):** actions whoami/accounts/audit/set_plan; guard SEMPRE antes do dispatch; `Cache-Control: no-store` incondicional; `p_admin_id/p_admin_email` vêm do JWT verificado (fecha confused-deputy); set_plan não duplica audit (a RPC 16-01 já grava atômico).
- **Revisão de segurança (orquestrador):** 2 revisões adversariais independentes (security + correctness) → ambas PASS, zero high/critical. 1 MEDIUM corrigido (getClientIp anti-spoof). LOW/INFO documentados.
- **Deploy + verificação fail-closed:** push → Vercel; `GET /api/admin?action=whoami` sem token → `{"error":"JWT_MISSING"}` em produção. ✓

## Task Commits
1. **Task 1: Guard requireAdmin + auditDenied throttle + logAction** - `776512c` (feat)
2. **Task 2: Roteador api/admin.js + handlers** - `0aa4c0b` (feat)
3. **Fix pós-review: getClientIp anti-spoof** - `474ce99` (fix, MEDIUM da revisão)

## Files Created/Modified
- `api/admin.js` - roteador único por action, guard antes do dispatch, no-store
- `api/_lib/admin/guard.js` - requireAdmin fail-closed + auditDenied throttled + logAction + getClientIp
- `api/_lib/admin/accounts.js` - handler da RPC admin_list_accounts
- `api/_lib/admin/set-plan.js` - handler da RPC admin_set_plan (valida UUID + enum antes)
- `api/_lib/admin/audit-list.js` - handler de leitura do admin_audit_log

## Decisions Made
- **Verificação fail-closed via navegador** (não curl): confirmado 401 JWT_MISSING live. Caminho admin-happy-path + throttle deferidos ao dogfooding pelo painel (16-04) — mais acessível ao dono que curl com token.
- **ADMIN_USER_IDS**: setada pelo dono após o teste fail-closed (ativa o admin); verificação do 200 será via login no painel.

## Deviations from Plan
### Ajuste pós-review
**1. [Segurança — MEDIUM] getClientIp anti-spoof**
- **Found during:** revisão adversarial (orquestrador, pós-código)
- **Issue:** pegava o 1º elemento de x-forwarded-for (forjável pelo cliente) → permitia forjar o campo `ip` no audit trail de toda ação (quebra de não-repúdio) e variar o componente ip do throttle
- **Fix:** preferir x-real-ip (edge-set), fallback último elemento de XFF
- **Committed in:** `474ce99`

---
**Total deviations:** 1 (segurança de review). **Impacto:** reforça integridade do audit; sem scope creep.

## Issues Encountered
- Nenhum bloqueante. O gsd-executor não tem a tool `Agent`, então a revisão adversarial formal foi conduzida pelo orquestrador antes do deploy (como planejado).

## Carry-forward para 16-03 (front)
- **[SEGURANÇA — obrigatório] Stored XSS:** o campo `reason` (texto livre do admin) é gravado sem sanitização e listado na aba Auditoria. O painel DEVE escapar/renderizar como texto (nunca innerHTML cru) ao exibir `reason` e demais campos vindos do backend.
- **LOW (accounts.js):** `p_limit: limit || undefined` → `limit=0` cai no default 50 (zero-falsy). Inócuo (RPC clampa mín 1); o front não manda 0. Corrigir se conveniente.
- **LOW/MEDIUM (throttle):** read-then-insert não atômico sob concorrência real pode exceder o teto de 5 linhas/janela. Best-effort (já documentado); não é buraco de segurança.

## Next Phase Readiness
- Backend live e fail-closed em produção. 16-03 pode construir o front consumindo `fetch /api/admin?action=...` com Bearer JWT.
- **Pendência do dono (paralela):** setar `ADMIN_USER_IDS` = UUID da conta admin no Vercel (Parte 4) para ativar o caminho autorizado antes do dogfooding.

---
*Phase: 16-painel-admin-backoffice · Plano 02*
*Completed: 2026-07-17*
