---
phase: 13
slug: ia-3-gating-premium-in-app
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-14
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Synced with the 4 PLAN.md task/threat IDs + RESEARCH §Validation Architecture Test Map.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Nenhum (débito rastreado B11 — React via Babel-standalone, `api/` = functions Vercel sem harness) |
| **Config file** | none |
| **Quick run command** | N/A — inspeção estática (grep/leitura) por commit |
| **Full suite command** | N/A — human-verify via `/gsd-verify-work` (batch dos 9 casos manuais) |
| **Estimated runtime** | ~0 seconds (sem runner) |

---

## Sampling Rate

- **After every task commit:** greps positivos/negativos da tabela abaixo (especialmente P1/T-13-01 e o `FREE_TIER_ADDENDUM`)
- **After every plan wave:** revisão estática dos grants da wave
- **Before `/gsd-verify-work`:** greps verdes + `security-reviewer` + `database-reviewer` sobre `api/assistant.js` (13-03) e `supabase/profiles-plan-privileges.sql` (13-02)
- **Max feedback latency:** ~0 seconds (estático); casos comportamentais no batch de UAT

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | GATE-01 | T-13-01 (ref) | Store lê `plan` fail-closed nos 2 selects | static | grep `select('name, group_targets, plan'` em `assets/fides-store.jsx` (2 hits) | ✅ | ⬜ pending |
| 13-01-02 | 01 | 1 | GATE-01 | T-13-02c | `userPlan`/`isPremium` (allow-list) no context value | static | grep `isPremium` + `plan === 'pro' \|\| plan === 'family'` em `assets/fides-store.jsx` | ✅ | ⬜ pending |
| 13-02-01 | 02 | 1 | GATE-03 (P1) | T-13-01, T-13-01b | REVOKE UPDATE + GRANT UPDATE (name, group_targets) escrito | static | grep `REVOKE UPDATE ON public.profiles` + `GRANT UPDATE (name, group_targets)` em `supabase/profiles-plan-privileges.sql` | ❌ W0 (arquivo novo) | ⬜ pending |
| 13-02-02 | 02 | 1 | GATE-03 (P1) | T-13-01, T-13-01c | **[BLOCKING] manual** apply no SQL Editor + confirmar policy live | manual-only | Console: `window.fidesDb.from('profiles').update({plan:'pro'}).eq('id', meuId)` → erro de permissão, linha inalterada | — | ⬜ pending |
| 13-03-01 | 03 | 1 | GATE-03 | T-13-02 | Ler `plan` fail-closed + 403 `PREMIUM_REQUIRED` em Análise free | static + manual | Static: grep `PREMIUM_REQUIRED` + allow-list em `api/assistant.js`. Manual: free forçar `mode:'analysis'` via fetch → 403 | ✅ | ⬜ pending |
| 13-03-02 | 03 | 1 | GATE-03 | T-13-04 | Split READ/WRITE + `buildToolsForPlan` + `FREE_TIER_ADDENDUM` | static + manual | Static: grep `buildToolsForPlan` + `FREE_TIER_ADDENDUM`. Manual: free pedir lançamento → recusa em texto, sem card de confirmação | ✅ | ⬜ pending |
| 13-03-03 | 03 | 1 | GATE-02 | T-13-06 | Cap 10/mês sobre `assistant_usage`, guardado por `isFirstCallOfTurn` (sem double-count) | static + manual | Static: grep `FREE_TIER_MONTHLY_LIMIT` + `isFirstCallOfTurn`. Manual: 11ª msg → 429 `FREE_MONTHLY_LIMIT`; turno com tool → só 1 linha nova em `assistant_usage` | ✅ | ⬜ pending |
| 13-04-01 | 04 | 2 | PAYWALL-01 | T-13-07 | Chat mapeia FREE_MONTHLY_LIMIT/PREMIUM_REQUIRED → copy de paywall | static | grep `FREE_MONTHLY_LIMIT`/`PREMIUM_REQUIRED` em `assets/fides-claude.jsx` (`friendlyError`) | ✅ | ⬜ pending |
| 13-04-02 | 04 | 2 | GATE-03, PAYWALL-01 | T-13-02b | Análise: copy + botão gated por `isPremium` (camada 2, D-01) | static | grep os 2 códigos em `assets/fides-orcamento.jsx` (`friendlyAiError`) + gate por `isPremium` | ✅ | ⬜ pending |
| 13-04-03 | 04 | 2 | PAYWALL-01 | T-13-08 | PerfilView badge + CTA upgrade + `UpgradeModal` (React.createElement) | static + manual | Static: grep `UpgradeModal` em `assets/fides-studio.jsx`; grep negativo `confirm(`/`alert(`. Manual: app carrega sem erro de hooks | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Existing infrastructure covers all phase requirements — projeto sem runner por design (débito B11 já rastreado). Nenhum fixture novo: contas/cartões/categorias de dev já existem das Fases 11/12; único dado novo = alternar `profiles.plan` via SQL Editor (D-04). O único "arquivo novo" é `supabase/profiles-plan-privileges.sql` (artefato de produção, não de teste).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| UI reflete tier real (não mock `Pro`) | GATE-01 | Sem runner; requer render do app | `UPDATE profiles SET plan='free'` (D-04) → recarregar → UI mostra estado free |
| Free: exatamente 10 msgs READ/mês; 11ª bloqueada com paywall (não erro cru) | GATE-02 | Comportamento server+UI end-to-end | Como free, mandar 11 mensagens → 11ª retorna `FREE_MONTHLY_LIMIT` com copy de paywall, não `USER_DAILY_LIMIT` |
| Cota não conta 2x por round-trip de tool (Pitfall 2) | GATE-02 | Requer inspeção do DB pós-turno | Free: pergunta que dispara `consultar_saldo` (2 HTTP, 1 turno) → só 1 linha nova em `assistant_usage` (SQL Editor) |
| Free NÃO recebe tools WRITE | GATE-03 | Comportamento do modelo | Como free, pedir "lança 50 no mercado" → recusa em texto, nunca abre card de confirmação |
| Free NÃO acessa Análise da IA (server-side, não só front) | GATE-03 | Bypass da UI escondida | Como free, forçar `mode:'analysis'` via `fetch` no console → 403 |
| Premium: chat+WRITE+Análise dentro do cap 100/dia (regressão P12) | GATE-03 | Fluxo end-to-end | `UPDATE profiles SET plan='pro'` → repetir fluxos → tudo como Phase 12 |
| **P1: usuário NÃO altera o próprio `plan` via client SDK** (trust anchor) | GATE-03 | Só verificável no runtime autenticado | Console: `window.fidesDb.from('profiles').update({plan:'pro'}).eq('id', meuId)` → erro de permissão |
| **Risco residual aceito (D-01):** RPC `wa_log_transaction` direto por free grava | GATE-03 | Documentar gap conhecido | Console: `window.fidesDb.rpc('wa_log_transaction', {...})` → **grava (esperado por D-01)**; registrar no UAT como aceito, não bug |

---

## Validation Sign-Off

- [x] All tasks have static-grep verify and/or manual-verify steps (projeto sem runner — grep é a camada automatizada, B11)
- [x] Sampling continuity: cada task tem grep/manual; nenhuma lacuna de 3 tasks
- [x] Wave 0 covers all references (nenhuma infra a criar por design)
- [x] No watch-mode flags (sem runner)
- [x] Feedback latency < 1s (estático)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-14 (synced com os 4 PLAN.md + RESEARCH Test Map)
