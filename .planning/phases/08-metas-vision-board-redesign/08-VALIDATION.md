---
phase: 08
slug: metas-vision-board-redesign
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-02
---

# Phase 08 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> **Project constraint:** no build step / no test runner exists (Babel-standalone; zero `devDependencies`; ROADMAP B11 tracks the eventual Vite/Next migration where a real runner would land). Validation is **manual conversational UAT**, consistent with `07-UAT.md`. `nyquist_compliant` stays `false` by project design, not by omission — there is no automated framework to satisfy it.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | **None** — no bundler, no test runner in repo (`package.json` has zero scripts/devDeps). Manual UAT only. |
| **Config file** | none |
| **Quick run command** | Manual: open the app (local static server on `index.html`, or the Vercel preview) and exercise the changed flow in DevTools at a **400×512 iOS Safari** viewport, watching the console for React warnings. |
| **Full suite command** | Manual conversational UAT via `/gsd-verify-work` → persisted as `08-UAT.md` (mirrors `07-UAT.md`). |
| **Estimated runtime** | ~10–15 min manual pass |

---

## Sampling Rate

- **After every task commit:** open the affected view in a browser, exercise the changed flow, check DevTools console for errors/Rules-of-Hooks warnings. No automated command substitutes for this.
- **After every plan wave:** full manual pass through the 7 UAT criteria below at the 400×512 iOS Safari viewport (CLAUDE.md "regra de ouro").
- **Before `/gsd-verify-work`:** all 7 criteria green **and** the two-user RLS smoke test (below) passed.
- **Max feedback latency:** ~1 min (browser reload).

---

## Per-Task Verification Map

> No formal REQ-IDs (CONTEXT derives from a design-spec PRD, not REQUIREMENTS.md). Using the design spec §8 UAT criteria as traceable IDs.

| ID | Behavior | Test Type | Automated Command | File Exists | Status |
|----|----------|-----------|-------------------|-------------|--------|
| UAT-1 | Criar meta com capa da galeria → card renderiza a capa; persiste no reload | manual-only | — (browser + F5) | ❌ no framework | ⬜ pending |
| UAT-2 | Criar meta com upload próprio → Storage recebe o arquivo, card mostra a foto, persiste; outro usuário não acessa/escreve | manual + RLS check | — (upload flow; 2nd test user) | ❌ | ⬜ pending |
| UAT-3 | Busca por nome filtra; filtro Ativas/Concluídas segmenta corretamente | manual-only | — | ❌ | ⬜ pending |
| UAT-4 | "Atualizar saldo" inline reflete sem reload; Aportar soma com projeção | manual-only | — | ❌ | ⬜ pending |
| UAT-5 | Editar troca capa/tint/valores e persiste; excluir remove + apaga capa do Storage | manual + Storage object check | — | ❌ | ⬜ pending |
| UAT-6 | Hero de Metas distinto do hero da home; sem regressão em 400×512 iOS Safari | manual-only (visual) | — | ❌ | ⬜ pending |
| UAT-7 | Sem scroll horizontal no mobile; sem warning de Rules of Hooks no console | manual-only (DevTools) | — | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- No test framework exists and none is introduced — consistent with the project (ROADMAP B11 owns the future runner). Introducing one is out of scope.

*Otherwise: existing (manual) infrastructure covers all phase behaviors.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Galeria de capas + persistência | UAT-1 | No test runner | Criar meta, escolher preset SVG, salvar, F5 → capa persiste |
| Upload próprio + isolamento RLS | UAT-2 | No test runner; needs 2 accounts | Upload como user A; em sessão de user B tentar **ler/sobrescrever/apagar** o objeto de A direto pelo client Supabase → deve falhar |
| Busca + filtro de status | UAT-3 | No test runner | Digitar nome (filtra); alternar Todas/Ativas/Concluídas (segmenta por `completed`) |
| Update inline + Aportar | UAT-4 | No test runner | "Atualizar saldo" muda barra sem reload; Aportar soma + mostra projeção |
| Editar/Excluir + limpeza de Storage | UAT-5 | No test runner; Storage side-effect | Editar troca capa/tint; Excluir remove meta **e** apaga o objeto do Storage (se upload) |
| Hero distinto + sem regressão mobile | UAT-6 | Visual | Comparar `met-hero` vs hero da home; checar 400×512 iOS Safari |
| Sem scroll-x + Rules of Hooks limpas | UAT-7 | Console | DevTools: sem scroll horizontal, sem warning "Rendered more hooks…" |

**RLS two-user smoke test (obrigatório, gap identificado na pesquisa):** UAT-2 e UAT-5 exigem uma tentativa real de acesso cross-user (segunda conta) para provar as policies owner-only — não aceitar o happy-path de usuário único como prova.

---

## Validation Sign-Off

- [ ] Cada task tem verificação manual explícita OU depende de gate de wave
- [ ] Continuidade de amostragem: nenhuma sequência de tasks sem verificação
- [ ] UAT-2/UAT-5 incluem o teste RLS de dois usuários
- [ ] Verificação da migração aplicada ao vivo (Supabase MCP/dashboard) antes do `/gsd-verify-work`
- [ ] Sem flags de watch-mode
- [ ] `nyquist_compliant` permanece `false` por design do projeto (sem runner; ROADMAP B11)

**Approval:** pending
