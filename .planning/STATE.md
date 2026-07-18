---
gsd_state_version: 1.0
milestone: ia-whatsapp
milestone_name: Épico IA/WhatsApp (Phases 11–14) — milestone formal pendente
current_phase: 16
current_phase_name: painel-admin-backoffice
status: executing
stopped_at: "Phase 14 planejada (7 plans, 4 waves, checker PASS iter 2). Override registrado: gate decision-coverage falhou por formato (CONTEXT usa IDs AC-/CU-/TE-/ES- em vez de D-NN; uncovered=[]; fidelidade às decisões verificada semanticamente pelo plan-checker). Próximo: /gsd-execute-phase 14"
last_updated: "2026-07-18T01:49:07.356Z"
last_activity: 2026-07-17
last_activity_desc: Phase 16 complete (painel admin no ar + dogfooding)
progress:
  total_phases: 7
  completed_phases: 4
  total_plans: 27
  completed_plans: 20
  percent: 57
---

# Project State

> **Nota de saúde (2026-07-14):** o milestone atual (épico IA/WhatsApp, Phases 11–14) ainda **não foi aberto formalmente** — v1.0 e v1.1 já foram shipadas com tag. Próximo passo estrutural: `/gsd-new-milestone` para versionar o épico. Enquanto isso, `milestone_formalized: false`.

## Current Position

Phase: 16 (painel-admin-backoffice) — ✅ COMPLETE (4/4 planos, VERIFICATION: passed)
Plan: —
Status: Phase 16 concluída — próximo alvo: Phase 14 (Bot WhatsApp)
Last activity: 2026-07-17 — Phase 16 complete (painel admin no ar + dogfooding)

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-06)

**Core value:** Finanças pessoais por registro manual (fricção intencional → consciência); nunca número que impressiona mas engana.
**Current focus:** Phase 16 — painel-admin-backoffice

## Phase Overview

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 11 | IA-1 Hardening Gemini | WR-01/02/03, AI-SHARED-01, AI-TELEM-01 | ✅ Complete (VERIFICATION: PASSED, UAT A–D) |
| 12 | IA-2 WRITE in-app (B8) | WRITE-01..04, HONEST-01, DERIVED-SAFE-01 | ✅ Implementado (gap-closure 12-06/12-07) — ⚠️ 2 UATs de regressão pendentes (Tests 1+4), ver `12-VERIFICATION.md` |
| 13 | IA-3 Gating Premium | GATE-01/02/03, PAYWALL-01 | ✅ Complete (VERIFICATION: passed 16/16; UATs fechados via painel 2026-07-17) |
| 14 | IA-4 Bot WhatsApp | WA-* (a formalizar) | 🟡 Próxima — não iniciada (0 planos) |
| 15 | UI Polish (favicon) | — | ⏳ Polish avulso, não iniciado |
| 16 | Painel admin/backoffice | ADMIN-01..04 | ✅ Complete (VERIFICATION: passed; painel live + dogfooding, 2026-07-17) |

> v1.0 (Phases 03–06) e v1.1 (Phases 07–10) shipadas — detalhe em `MILESTONES.md` e `milestones/`.

## Deferred / Open Items

| Categoria | Item | Status |
|-----------|------|--------|
| verification | Phase 12 — 2 UATs de regressão (Test 1 cartão homônimo + Test 4 falso "cancelei") | **débito rastreado** (deferido na Phase 16, 2026-07-17 — decisão do dono) — rodar quando conveniente; código verificado, comportamento Gemini não-determinístico |
| verification | Phase 13 — UATs gating free/pro | **fechado 2026-07-17**: 3 verificados via dogfooding do painel (Tests 1/4/5); 2 deferidos como **débito rastreado** (Test 2 403 na Análise, Test 3 cap 10/mês). Ver `13-UAT.md` (status: resolved) |
| verification | `fatura-ciclo-VERIFICATION.md` (feature v1.0/M4 `ade84f7`) | human_needed (desde 2026-07-01) |
| security todo | `todos/pending/ratelimit-bypass-toolresults.md` (high) | aberto — endereçar durante o épico IA |
| bug (assistente WRITE) | `todos/pending/2026-07-16-assistente-modais-write-stale-acumulados.md` (high) | aberto — modais de confirmação stale/acumulados; puxar p/ próxima fase de IA in-app |
| deploy setup | `ASSISTANT_NONCE_SECRET` no Vercel Project (nonce D-06) | verificar setado pós-deploy |
| demanda (nova fase) | Painel admin/backoffice — ver/gerir contas, trocar tier free/pro, audit, etc. | contexto em `.planning/research/painel-admin-backoffice.md` — planejar em sessão dedicada |
| product | Fonte do valor atual da meta (aportes vs vínculo a conta) | deferido p/ M5+ |

## Next Action

**Phase 16 (painel admin) fechada 2026-07-17. Próximo alvo escolhido pelo dono: Phase 14 (Bot WhatsApp).**

1. `/gsd-plan-phase 14` — quebrar a IA-4 (bot WhatsApp via Meta Cloud API) em planos. Caminho sensível (`api/whatsapp.js` webhook público + service_role) → security-reviewer + database-reviewer obrigatórios.
2. (housekeeping, quando conveniente) `/gsd-new-milestone` — abrir formalmente o épico IA/WhatsApp (`milestone_formalized: false`).
3. (opcional) M6 checkout/billing (Mercado Pago/Pix) — monetiza o premium que agora liga/desliga de verdade.

Débito rastreado aberto: 2 UATs de regressão da Phase 12 (Gemini não-determinístico); UATs 2/3 da Phase 13 (baixo risco). Ver §Deferred/Open Items.

## Plan Execution Log

| Phase / Plan | Duração | Tasks | Arquivos |
|--------------|---------|-------|----------|
| 03 P01 | 112 | 3 | 2 |
| 03 P01 | 208 | 4 | 2 |
| 03 P02 | audit | 3 (T3 checkpoint aprovado) | 1 |
| 04 P03 | 8min | 3 | 3 |
| 04 P02 | ~15min | 3 | 3 |
| 04 P04 | 5min | 2 | 2 |
| 05 P01 | ~20min | 4 | 2 |
| 06 P01 | 8min | 3 | 3 |
| 06 P02 | ~10min | 2 | 1 |
| 07 P02 | 6min | 3 | 1 |
| 07 P03 | 12min | 3 | 1 |
| 08 P07 | 12min | 3 | 2 |
| 08 P08 | 20min | 3 | 3 |
| 09 P01 | 8min | 2 | 1 |
| 09 P02 | ~15min | 2 | 2 |
| 09 P03 | 7min | 3 | 2 |
| 09 P04 | 12min | 3 | 2 |
| 09 P05 | ~15min | 3 | 2 |
| 10 P01 | 6min | 2 | 2 |
| 10 P02 | ~20min | 2 | 1 |
| 10 P03 | ~15min | 2 | 1 |
| 10 P04 | ~12min | 2 | 1 |
| 10 P06 | ~5min | 1 | 1 |
| 11 P01 | ~5min | 2 | 2 |
| 11 P02 | ~10min | 2 | 1 |
| 11 P04 | ~10min | 3 | 2 |
| 12 P01 | 15min | 3 | 2 |
| 12 P02 | 25min | 3 | 2 |
| 12 P03 | 20min | 2 | 1 |
| 12 P04 | 15min | 2 | 1 |
| 12 P05 | 5min | 1 | 1 |
| 13 P01 | — | — | — |

## Decisions

- [Phase ?]: DESIGN-02: .prf-avatar já usava var(--accent) — auditado e confirmado on-brand sem edição
- [Phase ?]: CLEAN-01: fides-diario.* removido pelo commit d4db34f — estado verificado sem ação adicional
- [Phase ?]: DESIGN-04: token fantasma --warn-bg resolvido para var(--warn-soft); auditoria conservadora nao removeu orfaos (dinamicos/interleaved com .fds-tx-kpi vivo) nem duplicatas (todas overrides @container). Checkpoint visual aprovado — DESIGN-04 complete.
- [Phase ?]: MOBILE-01: goPerfil useCallback with functional updater + lastView toggle
- [Phase ?]: 04-02: CategoriaModal footer Fechar button completed to route through requestClose (finishing partial Task 2)
- [Phase ?]: 04-02: ConfirmDeleteModal Excluir uses handleConfirm wrapper (onConfirm then requestClose) for animated exit on delete confirm
- [Phase ?]: 04-04: .stu-acct hover values unchanged, only moved inside @media (hover:hover)
- [Phase ?]: 04-04: .cat-card border-color hover kept as-is; new lift added additively inside @media (hover:hover), shadow values mirrored from .stu-acct
- [Phase 05]: 05-01: single-shot analysis intentionally does not execute READ tool_calls from api/assistant.js; fails closed with friendlyAiError('GEMINI_ERROR') rather than hanging. To add tool round-trips later, port executeTools from fides-claude.jsx.
- [Phase ?]: 06-01: DEBT-01 bloco morto removido por deleção pura, sem repurpose com totals.planned/realized
- [Phase ?]: 06-01: DEBT-03 --warn-soft convergiu para #FEF0D6 (tokens.css); --accent-soft (#FEF3C7) é token distinto, fora do escopo
- [Phase ?]: 06-01: DEBT-04 onSave do NovaTransacaoModal só grava; fechar passa a vir exclusivamente do onClose via requestClose
- [Phase ?]: 06-02: overlay inline Em breve extraido para componente EmBreveModal para poder consumir useModalClose
- [Phase ?]: 06-02: os 4 paineis montados (Simular/Revisar/Aplicar/EmBreve) migraram de mount condicional pelo pai para mount sempre + prop open, gate interno via rendered
- [Phase ?]: 06-02: os 4 modais placeholder (Aportar/AjustarPlano/MetConfirmDelete/Configurar) recebem wiring completo mas seguem sem mount site - Metas continua read-only
- [Phase ?]: 07-02: normalizeGoal maps prazo/descricao from target_date/description with row.field || default idiom, no Date parsing (D-02/D-05/D-10)
- [Phase ?]: 07-02: addGoal payload omits current/monthly_contrib entirely, left to schema defaults (D-07/D-08)
- [Phase ?]: 07-02: updateGoal stays DB-shaped (no __targetBal-style RPC branch); UI to DB key translation deferred to Plan 03's modal onConfirm handlers
- [Phase ?]: 07-03: UI->DB translation for goal edits lives in MetasStudio onConfirm wrapper, not in the modal or updateGoal (mirrors updateAccount call-site pattern)
- [Phase ?]: 07-03: moved MetasStudio useState declarations above the isEmpty early return to fix a Rules of Hooks violation; also fixed the top empty-state CTA which was wrongly wired to the parent onAdd prop
- [Phase 08]: 08-07: mesesLabel guards Infinity across hero lede, Maior meta strip, and vcard Chega em stat; hero lede uses natural 'sem previsão de chegada' phrasing
- [Phase 08]: 08-07: EmojiPicker CSS namespaced met-emoji-select* (not met-emoji-picker*) to keep 'emoji-picker' out of fides-metas.jsx, satisfying the plan's own no-npm-emoji-package grep guard
- [Phase ?]: 08-08: Root cause = (a-schema) create-table-if-not-exists never adds columns to a pre-existing table — completed/completed_at were declared only inside the CREATE block and never reached the live goals table; healed live out-of-band, hardened schema.sql with standalone idempotent ALTERs
- [Phase ?]: 08-08: patchComAutoConclusao helper auto-completes a goal when balance reaches target on aporte/atualizar-saldo, never sets completed:false (no auto-reopen on later balance drop — locked decision)
- [Phase ?]: 08-08: No live database write performed (checkpoint decision: no-op live + harden SQL); live completed/completed_at columns and owner-scoped RLS UPDATE policy confirmed already correct via Supabase MCP introspection
- [Phase 09]: 09-01: usou txMonth(t) (nao t.mes cru) para membership de mes em spendByCategoryRange/rangeTransactions, mantendo semantica de monthTransactions e mes de fatura do cartao
- [Phase 09]: 09-02: CommandPalette reusa shell .fds-modal-backdrop/.fds-modal (sem CSS de overlay novo, so posicionamento via .stu-cmdk-backdrop)
- [Phase 09]: 09-02: resultados de transacao usam t._id (campo real de normalizeTx), nao t.id
- [Phase 09]: 09-02: busca cobre transacoes + contas/cartoes/categorias navegaveis, resolvendo Open Question 3 do 09-RESEARCH
- [Phase ?]: 09-03: TxAdvFiltersModal mantem o mesmo contasSelected para contas/cartoes (sem novo estado); atalho selecionar-todos-cartoes e' toggle de grupo
- [Phase ?]: 09-03: paginacao (pagedSorted) roda sobre sorted antes do agrupamento; grouped agrupa so a fatia paginada, evitando quebrar totais de categoria/conta
- [Phase ?]: 09-03: toggleSelectAll/selTxs seguem operando sobre sorted inteiro (bulk-action); UI sinaliza explicitamente quando ha mais de 1 pagina
- [Phase 09-04]: fromYM/toYM sempre React.useState com lazy init via rangeFromPreset(selectedMonth, '3m') — nunca undefined no 1o render, protegendo monthsInRange do store
- [Phase 09-04]: rangeList/rangeSpend memoizados no consumidor via React.useMemo(deps=[fn, fromYM, toYM]) porque o store expoe rangeTransactions/spendByCategoryRange como React.useCallback, nao useMemo
- [Phase 09-04]: baseList alternavel (rangeMode ? rangeList : monthTransactions) — cadeia filtered/sorted/pagedSorted/grouped/totals/chipCounts ja deriva de baseList, sem duplicar logica
- [Phase 09-04]: painel de analytics cross-month (Donut/CategoryChart) so renderiza em rangeMode; custom range usa input type=month nativo
- [Phase 09-05]: Nome do arquivo CSV inclui o intervalo (fides-extrato-{fromYM}_a_{toYM}.csv) quando rangeMode ativo
- [Phase 09-05]: Cor do preview de limite (TX-08) usa projectedStatus proprio (over/warn/ok sobre projectedSpent/limit), nao usage.status
- [Phase 09-05]: fromYM/toYM hidratados via readTxState() com fallback a rangeFromPreset(selectedMonth, rangePreset ja hidratado)
- [Phase 10-01]: computeFaturaDates vive em fides-data.jsx (nao fides-store.jsx) para garantir ordem de carregamento de script como global compartilhado
- [Phase 10-01]: branch diaF > diaV removido por completo (era a causa raiz do bug D-02), nao mantido como caso especial
- [Phase ?]: card_id explicito no payload de resolveRowForImport mesmo com txToRow recomputando em modo live (documentacao/contrato, sem alterar o resultado gravado)
- [Phase ?]: Ano fallback = ano corrente quando o CSV nao traz coluna de ano explicita (export do proprio app so grava dd/mm)
- [Phase 10-03]: chip Cartao reusa advFilters.contasSelected (nenhum estado novo); rangeTotal extraido para useMemo unico reusado no cabecalho/centro do Donut/legenda; legenda completa sem limite de itens (diferente do top5 do DashboardStudio) para cobrir todas as fatias
- [Phase 10-04]: destino default do import = sentinel 'Da origem do arquivo' (resolucao por linha via acctNameRaw); id real no dropdown forca todas as linhas; status sempre explicito no payload (nunca fallback pago do txToRow)
- [Phase ?]: 11-01: toolMode 'AUTO' explicito no call-site do chat em api/assistant.js — facilita diff do 11-02 (toolMode NONE no caminho de analise)
- [Phase ?]: 11-02: isAnalysisMode = mode === 'analysis' (comparacao estrita) - unico valor aceito e a string exata, resto cai no default chat com tools AUTO
- [Phase ?]: 11-02: tools: isAnalysisMode ? undefined : TOOLS_DECLARATION - modo analise nem envia o array de tools ao buildPayload (opcao A da pesquisa)
- [Phase ?]: 11-04: cooldown do botao de analise nao arma no caminho JWT_MISSING, espelhando o chat
- [Phase ?]: 11-04: erro !res.ok arma 60s quando res.status===429 OU errCode USER_DAILY_LIMIT/RATE_LIMIT; demais erros armam 4s
- [Phase ?]: 11-04: branch morto de function-calling removido do handleAiClick (servidor em mode=analysis nunca retorna tool_calls)
- [Phase 12]: 12-01: wa_log_transaction RPC — SECURITY DEFINER + owner-guard + recalc_account_balance (D-01)
- [Phase 12]: 12-02: 4 tools WRITE restauradas (lancar/recategorizar/editar/criar_categoria) + system prompt honestidade + nonce anti-replay (D-06, TTL 120s) + security-reviewer PASS
- [Phase 12]: 12-03: lancar_transacao reescrito p/ RPC + mês derivado de data real (mesFaturaFor) + status pendente em cartão + D-04 categoria bundlada
- [Phase 12]: 12-04: criar_categoria em TOOLS_REQUIRING_CONFIRMATION (SD-1) + await addCategory (P5 morto) + nonce round-trip + window.__fidesWriteConfirmPending
- [Phase 12]: 12-05: guard ⌘K — early-return quando __fidesWriteConfirmPending (P6)
- [Phase 13]: P01: planejamento gating premium via profiles.plan — pendente
- [Phase 12]: 12-06: writeOutcome flag + history filter + guard anti-espelho (isSyntheticWriteOutcome) fecham o espelhamento de desfecho WRITE via chat
- [Phase 12]: 12-06: STORAGE_KEY_MESSAGES/STORAGE_KEY_LAST_ACTIVITY versionadas para _v2 (purga sessoes poluidas no deploy sem esperar TTL)
- [Phase 12]: 12-06: bullet ATENCAO AO CANCELAMENTO removido do SYSTEM_PROMPT (5e161e9) - letra morta pos-68ed3ca; security-review sem findings
- [Phase 12]: 12-07: tipo_destino enum ['conta','cartao'] opcional em lancar_transacao; findAccountByName/findCardByName sempre consultados no resolver (precedencia conta-primeiro removida); homonimo sem tipo retorna erro de desambiguacao fail-closed
- [Phase 12]: 12-07: security-review conduzida diretamente pelo executor (sem Task-launcher de subagente ECC disponivel) - PASS zero findings, mesmo veiculo ja usado em 12-06
- [Phase 13-01]: resetToMock zera userPlan no logout (fail-closed D-02) - extensao do escopo literal da plan, evita isPremium stale apos logout
- [Phase 13]: 13-03: gate de tier server-side em api/assistant.js (GATE-02/GATE-03) - plan lido fail-closed via allow-list, Analise da IA 403 premium-only, buildToolsForPlan(isPremium) monta READ/WRITE por tier, FREE_TIER_ADDENDUM, cap mensal 10 msg/mes sobre assistant_usage (429 FREE_MONTHLY_LIMIT)
- [Phase ?]: 13-02: REVOKE/GRANT column-level em profiles.plan trava self-elevation de tier via client SDK - authenticated so escreve name/group_targets; owner/service_role (SQL Editor, D-04) ignora e segue alternando tier. Aplicado no banco live (checkpoint human-action), verificado (trava de plan/nao-regressao/D-04). database+security review PASS zero findings.
- [Phase 13]: 13-05: guard 403 CR-01 fica dentro de if(toolCalls.length>0), antes de assinar nextNonce - bloqueio nao emite nonce novo no caminho detectado
- [Phase 13]: 13-05: WRITE_NAMES deriva de WRITE_FUNCTIONS.map(f=>f.name), fonte unica, sem re-hardcode; FREE_TIER_ADDENDUM reescrito comportacionalmente (WR-04) sem os 4 nomes literais
- [Phase 13]: 13-05: guard cliente !fs.isPremium em executeTools reusa fs ja capturado no topo de FidesAssistant - sem novo useFides()/hook (Rules of Hooks)
- [Sequência 2026-07-16]: decisão do usuário — PULAR os UATs humanos das Phases 12 e 13 por ora (código já live + verificado 16/16); rodá-los depois via o painel admin da Phase 16 (alternar tier na UI do Fides) em vez do Supabase SQL Editor. Próxima etapa = planejar+construir a Phase 16. 14/15 ficam depois.
- [Phase 16]: 16-04 (parcial): rate-limit geral pos-guard (30 req/60s admin_id/ip, fail-open) em guard.js + docs/admin-lgpd.md (base legal/minimizacao/retencao 2 anos a ratificar). Memoria testar-tier-free-pro e checkpoint de dogfooding (UATs 12/13) NAO executados nesta sessao (ver 16-04-SUMMARY.md)

## Session

**Last session:** 2026-07-18T01:49:07.275Z
**Stopped at:** Phase 14 planejada (7 plans, 4 waves, checker PASS iter 2). Override registrado: gate decision-coverage falhou por formato (CONTEXT usa IDs AC-/CU-/TE-/ES- em vez de D-NN; uncovered=[]; fidelidade às decisões verificada semanticamente pelo plan-checker). Próximo: /gsd-execute-phase 14
**Resume file:** .planning/phases/14-ia-4-bot-whatsapp-via-meta-cloud-api/14-01-PLAN.md

## Accumulated Context

Milestone v1.0 e v1.1 shipadas (tags `v1.0`/`v1.1`); decisões arquivadas em PROJECT.md Key Decisions e MILESTONES.md. Épico IA/WhatsApp (Phases 11–14) em andamento — Phase 11 completa (VERIFICATION PASSED), Phase 12 implementada com UAT humano pendente. Sem blockers de código.

### Roadmap Evolution

- Phase 06 added mid-milestone: Fix v1.0 tech debt (dead AI-context block, metas modal motion, --warn-soft align) — closed the 4 audit warnings.
- Phase 07 added for milestone v1.1: CRUD Metas — continues phase numbering from v1.0 (06 → 07), single phase covering all 4 META requirements.
- Phase 08 added: Metas vision-board redesign — spec em docs/superpowers/specs/2026-07-02-metas-vision-board-design.md; eleva a tela Metas ao nível visual do PlannerFin.
- Phases 11–14 added (2026-07-06): épico IA/WhatsApp. Fonte de design `.planning/research/whatsapp-e-ia-arquitetura.md` (decisões D-1..D-11 resolvidas). Ordem travada 11→12→13→14. Phase 11 (IA-1 hardening WR-01/02/03 + módulo Gemini + telemetria); Phase 12 (IA-2 destravar B8/WRITE in-app); Phase 13 (IA-3 gating premium `profiles.plan`); Phase 14 (IA-4 bot WhatsApp Meta Cloud API — sem CNPJ não bloqueia, adendo D-8). Precificação P-2 (Free + Premium R$ 89,90/ano Mercado Pago/Pix).
- Phase 15 added: UI Polish (favicon) — polish avulso, fora do épico IA.
- Phase 16 added (2026-07-16): Painel de administração / backoffice (admin online, ex. `/painel`) — ver/gerir contas, usos, privilégios e tier free/pro/family sem depender do Supabase SQL Editor; superfície server-side via `service_role` (não reabrir a trava do 13-02) + audit log. Demanda-contexto em `.planning/research/painel-admin-backoffice.md`; **ainda não planejada** — planejar em sessão dedicada.

## Operator Next Steps

- **Phase 11 (IA-1) completa e verificada (VERIFICATION: PASSED, 2026-07-07).** 4 plans, push atômico `e40f7e7`/`9a39110`, migração de telemetria aplicada, UAT humana A–D aprovada.
- **Phase 12 (IA-2 B8) implementada em 5 commits (`9a9ead5` → `6714d3f`). UAT pendente (4 testes humanos no app).**
  - 12-01 (`9a9ead5`): RPC `wa_log_transaction` (SECURITY DEFINER + owner-guard + recalc_account_balance)
  - 12-02 (`9abd83e`): 4 tools WRITE restauradas + system prompt honestidade + nonce anti-replay (D-06)
  - 12-03 (`d6fddaa`): `lancar_transacao` → RPC + mês derivado de data real (mesFaturaFor) + status pendente em cartão + D-04 bundlada
  - 12-04 (`eb9c63f`): `criar_categoria` confirmado (SD-1) + await addCategory (P5 morto) + nonce round-trip + flag `__fidesWriteConfirmPending`
  - 12-05: guard ⌘K (P6)
  - ⚠️ Verificar `ASSISTANT_NONCE_SECRET` setado no Vercel Project (nonce D-06). Rodar `/gsd-verify-work 12`.
- **Phase 13 (IA-3):** gating premium via `profiles.plan` — ainda não planejada (`/gsd-plan-phase 13`).

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 12 P06 | 12min | 3 tasks | 2 files |
| Phase 12 P07 | ~10min | 2 tasks | 2 files |
| Phase 13 P01 | 3min | 2 tasks | 1 files |
| Phase 13 P03 | ~10min | 3 tasks | 1 files |
| Phase 13 P02 | 18min | 2 tasks | 1 files |
| Phase 13 P05 | ~15min | 3 tasks | 2 files |
| Phase 16 P04 (parcial) | ~25min | 1/3 tasks | 4 files |

### Blockers

- 16-01: MCP Supabase indisponivel nesta sessao de execucao (sem tool mcp__supabase__* no ambiente do agente executor). Task 1 exige introspeccao live ANTES de qualquer DDL (VALIDATION Wave 0). O servidor MCP configurado roda com flag --read-only, o que bloquearia apply_migration da Task 2 mesmo se a introspeccao fosse possivel por outra via. Nenhuma DDL foi escrita; plano 16-01 pausado no Task 1.
- 16-04 Task 3 (checkpoint dogfooding UATs 12/13) bloqueado: 16-03 (front /painel) ainda sem 16-03-SUMMARY.md nesta arvore - painel precisa estar deployado antes do login humano para o dogfooding
