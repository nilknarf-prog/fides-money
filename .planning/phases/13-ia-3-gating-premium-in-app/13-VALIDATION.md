---
phase: 13
slug: ia-3-gating-premium-in-app
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-14
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Nenhum (débito rastreado B11 — React via Babel-standalone, `api/` = functions Vercel sem harness) |
| **Config file** | none |
| **Quick run command** | N/A — inspeção estática (grep/leitura) |
| **Full suite command** | N/A — human-verify via `/gsd-verify-work` |
| **Estimated runtime** | ~0 seconds (sem runner) |

---

## Sampling Rate

- **After every task commit:** inspeção estática (greps positivos/negativos, especialmente P1 e o addendum do prompt)
- **After every plan wave:** revisão dos grants estáticos da wave
- **Before `/gsd-verify-work`:** greps positivos/negativos verdes + `security-reviewer` + `database-reviewer` nos caminhos `api/`/`supabase/`
- **Max feedback latency:** ~0 seconds (estático)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*(Populated by planner / gsd-nyquist-auditor from RESEARCH.md §Validation Architecture Test Map.)*

---

## Wave 0 Requirements

- [ ] Existing infrastructure covers all phase requirements — projeto sem runner por design (débito B11 já rastreado); nenhum fixture novo (contas/cartões/categorias de dev já existem das Fases 11/12; único dado novo = alternar `profiles.plan` via SQL Editor, D-04).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| {behavior} | REQ-{XX} | {reason} | {steps} |

*(Populated from RESEARCH.md §Validation Architecture Test Map — 9 casos manuais, incluindo o teste de RLS/P1 que é o mais crítico.)*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 1s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
