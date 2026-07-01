---
phase: 01
slug: veracidade-do-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-28
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — React Babel standalone; sem suíte de testes automatizados |
| **Config file** | none |
| **Quick run command** | `open https://fides-money.vercel.app` (deploy manual) |
| **Full suite command** | observação manual pós-deploy Vercel |
| **Estimated runtime** | ~5 min (deploy automático via push) |

---

## Sampling Rate

- **After every task commit:** push → aguardar deploy Vercel (~60s) → verificar no app
- **After every plan wave:** verificação completa dos requisitos afetados
- **Before `/gsd-verify-work`:** todos os ACs de SPEC.md validados manualmente no app
- **Max feedback latency:** ~120 seconds (deploy Vercel)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| budgetGroups-fix | 01 | 1 | R1 | — | N/A | manual | observação: card "Para onde foi" exibe limite > 0 | ✅ | ⬜ pending |
| donut-tooltip | 01 | 1 | R2 | — | N/A | manual | hover fatia = tooltip; tap mobile = tooltip; tap fora = fecha | ✅ | ⬜ pending |
| saldo-projetado | 01 | 2 | R3 | — | N/A | manual | hero = saldo contas + pendentes; sem dupla contagem | ✅ | ⬜ pending |
| prohibition-p1 | 01 | 2 | R3/P1 | — | N/A | manual | fluxo negativo visível mesmo com saldo projetado positivo | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements (nenhuma suíte de testes; verificação por observação no app pós-deploy).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Card "Para onde foi" mostra limite real por grupo | R1 | Sem suíte de testes; stack Babel standalone | No app: Planejamento → definir limite para ≥1 categoria → Dashboard → verificar card com valor > 0 e % real |
| Limite grupo com soma null → "Sem limite" | R1 (edge) | idem | Remover todos os limites de um macro-grupo → verificar estado "Sem limite" no card |
| Donut tooltip hover (desktop) | R2 | idem | Desktop: passar mouse sobre fatia → verificar "{categoria} · {R$ valor} · {%}" no centro do donut |
| Donut tooltip tap (mobile) | R2 | idem | Mobile (400×512): tocar fatia → verificar tooltip; tocar fora → tooltip some |
| Saldo projetado = saldo contas + pendentes | R3 | idem | Verificar que saldo hero = Σ(balance contas não-cartão) + receitas pendentes − despesas pendentes; confirmar no calculando manualmente |
| Sem dupla contagem de settled | R3 | idem | Verificar que transações liquidadas não aparecem no delta acima do balance |
| Headline alterna positivo/negativo | R3 | idem | Manipular dados para forçar ambos os sinais; verificar "terminará livre" vs "fechará no vermelho" |
| Fluxo mensal negativo visível com saldo positivo | R3/P1 | idem | Mês com fluxo negativo mas saldo de contas alto → verificar comunicação do déficit no hero |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
