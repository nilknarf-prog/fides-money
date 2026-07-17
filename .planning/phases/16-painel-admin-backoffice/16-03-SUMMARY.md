---
phase: 16-painel-admin-backoffice
plan: 03
subsystem: ui
tags: [react, babel-standalone, vercel-rewrites, clickjacking, csp, supabase-auth, admin-panel, bearer-jwt]

requires:
  - phase: 16-painel-admin-backoffice
    provides: "16-02 — api/admin.js (actions whoami/accounts/audit/set_plan) + contrato de resposta"
provides:
  - "painel.html — entrada isolada do /painel (storageKey próprio, tokens.css primeiro, supabase-js v2 UMD)"
  - "assets/fides-admin.jsx/.css — React (Babel-standalone): login, acesso negado, tabela de contas c/ busca+filtro+paginação, Alterar plano (motivo obrigatório + ConfirmDialog + toast), aba Auditoria"
  - "vercel.json — rewrite /painel antes do catch-all + headers anti-clickjacking em /painel E /painel.html"
affects: [16-04, painel-fase-2]

tech-stack:
  added: []
  patterns:
    - "Painel isolado como HTML próprio (não acopla à migração Vite/Next B11 — D-1a)"
    - "Single-page com abas por hash/estado — sem sub-paths (F5 não cai no catch-all, M10)"
    - "Todo dado do backend renderizado escapado via JSX {valor} (anti stored-XSS); zero dangerouslySetInnerHTML"
    - "Anti-clickjacking cobre a rota lógica E o arquivo físico (.html) — matcher de headers casa o path original"

key-files:
  created:
    - "painel.html"
    - "assets/fides-admin.jsx"
    - "assets/fides-admin.css"
  modified:
    - "vercel.json"

key-decisions:
  - "Variante A (sidebar) do sketch — escala melhor para a fase 2 (métricas/config)"
  - "storageKey 'fides-admin-auth' isola a sessão do painel da sessão do app principal (mesma origem)"
  - "Anti-clickjacking também em /painel.html (finding HIGH da revisão): painel.html é arquivo estático real, GET direto burlava os headers da rota /painel"

patterns-established:
  - "Consumo do backend admin exclusivamente via fetch('/api/admin?action=...') com Bearer JWT — nunca client SDK para dado admin"

requirements-completed: [ADMIN-03]

coverage:
  - id: D1
    description: "Painel carrega, login admin funciona, tabela de contas reais (email/nome/plano/criado/último login/IA-mês) com busca+filtro+paginação"
    requirement: "ADMIN-03"
    verification:
      - kind: manual_procedural
        ref: "dogfooding: login admin.fidesmoney em /painel → lista 2 contas reais; busca/filtro/paginação presentes (screenshots)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Ação Alterar plano: motivo obrigatório + ConfirmDialog + toast + linha na Auditoria (antes→depois+motivo)"
    requirement: "ADMIN-03"
    verification:
      - kind: manual_procedural
        ref: "dogfooding: set_plan na conta deyglison → linha set_plan 'pro→pro' + motivo na aba Auditoria (screenshot)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Anti-XSS (campos do backend escapados, sem dangerouslySetInnerHTML) + service_role nunca no bundle"
    requirement: "ADMIN-03"
    verification:
      - kind: other
        ref: "security-reviewer PASS (X1/X2/X4/X5); grep zero service_role/dangerouslySetInnerHTML"
        status: pass
    human_judgment: false
  - id: D4
    description: "Roteamento: rewrite /painel antes do catch-all + anti-clickjacking (X-Frame-Options/Referrer-Policy/CSP) em /painel e /painel.html; rewrites existentes intactos"
    requirement: "ADMIN-03"
    verification:
      - kind: other
        ref: "security-reviewer: finding HIGH (/painel.html sem headers) CORRIGIDO em 1e1c504; JSON válido; ordem OK"
        status: pass
    human_judgment: false
  - id: D5
    description: "App reflete a mudança de tier após F5 (gating premium liga/desliga) — dogfooding UAT 13"
    verification:
      - kind: manual_procedural
        ref: "dogfooding: conta free pediu lançamento pela IA → 'recurso exclusivo Premium' (WRITE bloqueado); Perfil free + CTA (screenshot)"
        status: pass
    human_judgment: true
    rationale: "Verificação humana visual do gating no app — confirmada parcialmente (free bloqueia WRITE + Perfil correto); premium (pro) confirmado pela conta deyglison ativa"

duration: ~1 sessão (código + 2 reviews + fix HIGH + dogfooding E2E)
completed: 2026-07-17
status: complete
---

# Phase 16 / Plano 03: Front do painel `/painel`

**Painel admin isolado (`painel.html` + React via Babel-standalone) com login próprio, tabela de contas com busca/filtro/paginação, Alterar plano (motivo obrigatório + confirmação + audit) e aba Auditoria — servido antes do catch-all com anti-clickjacking, consumindo só `api/admin.js` via Bearer. Verificado E2E em produção.**

## Performance
- **Tasks:** 3/3 (UI isolada · vercel.json rewrite+headers · dogfooding E2E)
- **Files:** 3 criados + 1 modificado (vercel.json)
- **Completed:** 2026-07-17

## Accomplishments
- **UI (Task 1):** `painel.html` isolado (storageKey próprio, tokens.css primeiro) + `fides-admin.jsx/.css` — telas login/negado/contas/alterar-plano/auditoria. Sidebar (variante A). Debounce na busca, paginação por `total_count`.
- **Roteamento (Task 2):** `/painel` rewrite antes do catch-all; headers `X-Frame-Options: DENY` + `Referrer-Policy: no-referrer` (+ CSP `frame-ancestors 'none'` no fix); rewrites existentes intactos.
- **Revisão (orquestrador):** 2 revisões adversariais — correctness PASS (Rules of Hooks OK, contrato 1:1 com o backend, ConfirmDialog/Toast, sem confirm/alert); security FAIL→PASS após corrigir 1 HIGH.
- **Dogfooding E2E:** login admin → lista contas reais → Alterar plano com motivo+confirmação → linha na Auditoria; app reflete gating (free bloqueia WRITE da IA, Perfil mostra free+CTA).

## Task Commits
1. **Task 1: painel.html + fides-admin.jsx/.css** - `f5668b1` (feat)
2. **Task 2: vercel.json rewrite + anti-clickjacking** - `eba5e7d` (feat)
3. **Fix pós-review (HIGH): anti-clickjacking em /painel.html + CSP** - `1e1c504` (fix)

## Files Created/Modified
- `painel.html` - entrada isolada do /painel
- `assets/fides-admin.jsx` - app React do painel (fetch /api/admin + telas)
- `assets/fides-admin.css` - estilos do painel (identidade Fides via tokens.css)
- `vercel.json` - rewrite /painel + headers anti-clickjacking

## Decisions Made
- Variante A (sidebar) do sketch. storageKey isolado. Anti-clickjacking estendido ao path físico `/painel.html`.

## Deviations from Plan
### Fix pós-review
**1. [Segurança — HIGH] Anti-clickjacking em /painel.html**
- **Found during:** revisão adversarial (orquestrador, pós-código)
- **Issue:** headers só casavam `source: '/painel'`; `GET /painel.html` (arquivo estático real) servia o painel sem X-Frame-Options → clickjacking sobre o botão de troca de plano
- **Fix:** bloco de headers p/ `/painel.html` + `Content-Security-Policy: frame-ancestors 'none'` nas duas rotas
- **Committed in:** `1e1c504`

---
**Total deviations:** 1 (segurança de review). **Impacto:** fecha vetor de clickjacking; sem scope creep.

## Issues Encountered
- Nenhum de código. Setup humano teve 2 tropeços (variável trocada no Vercel — `ADMIN_USER_IDS` vs `SUPABASE_SERVICE_ROLE_KEY`; deploy sem redeploy após env), resolvidos com passo-a-passo. Painel confirmado 100% funcional após corrigir.

## Next Phase Readiness
- Painel operacional em produção. 16-04 (hardening + dogfooding) fecha o gate da fase.
- Carry-forward do 16-02 (escapar `reason`) foi cumprido — renderização toda via JSX `{valor}`.

---
*Phase: 16-painel-admin-backoffice · Plano 03*
*Completed: 2026-07-17*
