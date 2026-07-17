---
phase: 16
slug: painel-admin-backoffice
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-16
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derivado de `16-RESEARCH.md` §Validation Architecture + §Security Domain. **Verificação é necessariamente manual (curl + SQL via MCP + UAT conversacional)** — o projeto não tem, e conscientemente não introduz nesta fase, framework de teste automatizado (stack HTML + Babel-standalone, sem bundler; ROADMAP B11). Isso é o padrão de todas as fases anteriores (11-13), não uma lacuna desta fase.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Nenhum framework automatizado (sem pytest/jest/vitest; `package.json` sem script `test`) |
| **Config file** | none — verificação por `curl` + SQL via MCP Supabase + UAT conversacional |
| **Quick run command** | `curl -i https://<deploy>/api/admin?action=whoami` (smoke tests por requisito, ver mapa abaixo) |
| **Full suite command** | `/gsd-verify-work 16` (UAT conversacional) + checklist de segurança do 16-04 + `security-reviewer` + `database-reviewer` |
| **Estimated runtime** | manual (~minutos por checklist; sem suíte a cronometrar) |

---

## Sampling Rate

- **After every task commit:** rodar os `curl` smoke tests dos itens "smoke" relevantes contra o deploy de preview do Vercel (push-to-main auto-deploya — CLAUDE.md).
- **After every plan wave:** checklist completo do 16-04 (todos os critérios "Pronto" do draft §3 para 16-01..16-04) + revisão `security-reviewer` + `database-reviewer` (caminho sensível, ROADMAP §Phase 16).
- **Before `/gsd-verify-work`:** os 5 UATs pendentes da Phase 13 + os UATs da Phase 12 re-executados **via painel** (dogfooding, decisão D-seq) devem passar.
- **Max feedback latency:** manual — `curl` smoke é imediato pós-deploy; SQL exige sessão com MCP Supabase.

---

## Per-Task Verification Map

> Task IDs concretos (`16-0X-0Y`) são atribuídos pelo planner. Aqui o mapa é por plano+requisito (fonte: RESEARCH §Phase Requirements → Test Map). Cada plano deve reconciliar seus tasks contra estas linhas.

| Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Comando / Verificação | File Exists | Status |
|------|------|-------------|------------|-----------------|-----------|-----------------------|-------------|--------|
| 16-01 | 1 | ADMIN-01 | M8 EoP | RPCs só executáveis por `service_role` | manual (SQL) | `select public.admin_set_plan(...)` como `authenticated` no SQL Editor → `permission denied for function` | ❌ W1 (RPC criada no 16-01) | ⬜ pending |
| 16-01 | 1 | ADMIN-01 | V7.3 | `admin_audit_log` inacessível a `anon`/`authenticated` | manual (SQL) | `select * from admin_audit_log` como `authenticated` → falha (RLS on, 0 policies + REVOKE) | ❌ W1 | ⬜ pending |
| 16-01/16-04 | 1 | ADMIN-04 | V7.2 | Mutação grava audit before/after/reason na MESMA transação | manual (SQL) | via MCP: `admin_audit_log` tem linha com `before`/`after` batendo com o `set_plan` mais recente | ❌ W1 | ⬜ pending |
| 16-02 | 2 | ADMIN-02 | — | Guard fail-closed: sem token → 401 | smoke | `curl -i https://<deploy>/api/admin?action=whoami` (sem header) → `401 JWT_MISSING` | ❌ W2 (guard criado no 16-02) | ⬜ pending |
| 16-02 | 2 | ADMIN-02 | V2 | Guard fail-closed: token inválido → 401 | smoke | `curl -i -H "Authorization: Bearer invalido" .../api/admin?action=whoami` → `401 JWT_INVALID` | ❌ W2 | ⬜ pending |
| 16-02 | 2 | ADMIN-02 | V4 EoP | `ADMIN_USER_IDS` ausente/vazia → 403 para TODOS (fail-closed crítico) | smoke | deploy de teste com env vazia + JWT válido → `403 FORBIDDEN` em 100% dos casos (rodar ANTES de setar a env em produção) | ❌ W2 | ⬜ pending |
| 16-02 | 2 | ADMIN-02 | V7.2 EoP | Usuário comum não-admin → 403 + audit `denied_access` | smoke+SQL | `curl` com JWT comum → `403`; depois `select ... from admin_audit_log where action='denied_access'` via MCP | ❌ W2 | ⬜ pending |
| 16-02 | 2 | ADMIN-02 | DoS | Throttle de `denied_access` (anti-flood) | smoke+SQL | N requisições negadas rápidas do mesmo user/IP → linhas `denied_access` têm teto (não 1:1) | ❌ W2 | ⬜ pending |
| 16-02 | 2 | ADMIN-02 | V4 | Admin válido → `whoami` 200 | smoke | `curl` com JWT do admin dedicado + allowlist → `200` com `user.id`/`email` | ❌ W2 | ⬜ pending |
| 16-03 | 3 | ADMIN-03 | — | `/painel` servido antes do catch-all | smoke | `curl -sI https://<deploy>/painel` → corpo/headers de `painel.html`, não `index.html` | ❌ W3 | ⬜ pending |
| 16-03 | 3 | ADMIN-03 | M11 clickjacking | Headers anti-clickjacking na rota `/painel` | smoke | `curl -sI .../painel \| grep -i "x-frame-options\|referrer-policy"` → `DENY` / `no-referrer` | ❌ W3 | ⬜ pending |
| 16-03/16-04 | 3+ | ADMIN-02/03 | — | Troca de tier reflete no app após F5 | E2E manual (UAT) | via painel trocar `free↔pro` de conta teste → logar no app → F5 → tier mudou (`useFides()` fail-closed, Phase 13-01/13-03) | ❌ W3+ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **Nenhum framework de teste a instalar** — decisão consistente com o resto do projeto (sem bundler, ROADMAP B11); os comandos acima são `curl`/SQL manuais, não scripts de suíte.
- [ ] `api/_lib/admin/guard.js` (e demais artefatos) não existem ainda — são os próprios entregáveis do 16-02, não há teste a rodar antes de existirem.
- [ ] **MCP Supabase deve estar disponível na sessão de execução do 16-01** para: (a) introspectar o schema live (`profiles`, `assistant_usage`, `auth.users`) e revalidar os 8 pressupostos do RESEARCH §Assumptions Log ANTES de escrever a migração; (b) rodar os testes marcados "manual (SQL)".

*Não há infraestrutura de teste automatizado a criar — a "Wave 0" real desta fase é garantir acesso ao MCP Supabase e revalidar os pressupostos de schema.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Grants de RPC (anon/authenticated não executam) | ADMIN-01 | Requer sessão SQL com role específica; sem suíte automatizada no projeto | Executar as RPCs como `authenticated` no SQL Editor / via MCP e confirmar `permission denied for function` |
| Fail-closed do guard (env vazia → 403 all) | ADMIN-02 | Depende de deploy real com env manipulada; não há harness de request local | Deploy de preview com `ADMIN_USER_IDS` vazia + `curl` com JWT válido → `403` |
| Auditoria de toda ação (leitura leve; mutação before/after/reason) | ADMIN-04 | Verificação por inspeção de linhas no Postgres via MCP | Após cada ação no painel, inspecionar `admin_audit_log` via MCP |
| Troca de tier reflete no app | ADMIN-02/03 | Fluxo E2E entre painel e app (dois clients, F5) | UAT conversacional `/gsd-verify-work 16` + dogfooding dos UATs 12/13 |
| Revisão de segurança do caminho sensível | todos | Julgamento humano/agente sobre auth+RLS+service_role+LGPD | `security-reviewer` + `database-reviewer` obrigatórios (CLAUDE.md, ROADMAP) antes do merge do MVP |

*Todas as verificações desta fase são manuais por natureza do stack — não há regressão automatizada a manter.*

---

## Validation Sign-Off

- [ ] Todo requisito ADMIN-0X tem uma verificação manual (curl/SQL/UAT) mapeada acima
- [ ] Sampling continuity: nenhum plano sem verificação associada
- [ ] Wave 0: acesso ao MCP Supabase garantido + 8 pressupostos de schema revalidados no início do 16-01
- [ ] `security-reviewer` + `database-reviewer` executados no caminho sensível antes do merge
- [ ] 5 UATs da Phase 13 + UATs da Phase 12 re-executados via painel (dogfooding) antes do gate final
- [ ] `nyquist_compliant: true` só após reconciliar task IDs concretos do planner contra o Per-Task Verification Map

**Approval:** pending
