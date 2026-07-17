---
phase: 16-painel-admin-backoffice
plan: 04
subsystem: api
tags: [serverless, vercel, commonjs, supabase, service-role, rate-limit, lgpd, audit, dogfooding]

requires:
  - phase: 16-painel-admin-backoffice
    provides: "16-02 — api/admin.js roteador + guard requireAdmin fail-closed + throttle denied_access + logAction"
provides:
  - "api/_lib/admin/guard.js — checkGeneralRateLimit (rate-limit geral 30 req/60s por admin_id/ip, pós-guard, fail-open, 429 RATE_LIMITED)"
  - "docs/admin-lgpd.md — base legal, minimização (V7.1), proposta de retenção do audit (2 anos, expurgo manual — A RATIFICAR)"
  - "supabase/admin-backoffice.sql — comentário de retenção (doc-only, sem DDL)"
affects: [painel /painel, "gate D-seq (dogfooding Phases 12/13)"]

tech-stack:
  added: []
  patterns:
    - "Rate-limit GERAL da superfície admin: mesmo padrão count de assistant.js:264-291, aplicado no roteador (api/admin.js) logo APÓS requireAdmin() ter sucesso — nunca antes da allowlist. Chave = admin_id OU ip; conta TODAS as linhas de admin_audit_log na janela (não só denied_access, que já tem seu próprio throttle desde o 16-02)."
    - "Retenção de audit log documentada como decisão de produto explícita (não como DDL) — expurgo manual via SQL Editor, sem job/cron no MVP."

key-files:
  created:
    - "docs/admin-lgpd.md"
  modified:
    - "api/_lib/admin/guard.js"
    - "api/admin.js"
    - "supabase/admin-backoffice.sql"

key-decisions:
  - "Rate-limit geral usa o adminClient (service_role) já autorizado do request corrente — não instancia client novo, reduz superfície e cold-start"
  - "Rate-limit geral conta TODAS as ações (whoami/accounts/audit/set_plan), não só denied — teto 30/60s por admin_id OU ip, acima do throttle de denied_access (5/60s) porque cobre tráfego legítimo também"
  - "Retenção do audit log (2 anos, expurgo manual) documentada em docs/admin-lgpd.md como PROPOSTA — não foi ratificada nesta sessão (exige decisão do dono, Task 3 checkpoint)"
  - "Delta em supabase/admin-backoffice.sql é só comentário (doc-of-record) — nenhuma coluna/policy/grant mudou, nada precisa ser reaplicado no banco"
  - "Memória de usuário testar-tier-free-pro NÃO foi tocada nesta sessão (fora do repositório, arquivo de config do harness Claude) — fica com o orquestrador (ver Issues Encountered)"
  - "Dogfooding dos UATs 12/13 (Task 3, checkpoint humano) NÃO foi executado — exige painel /painel deployado (16-03 ainda sem SUMMARY nesta árvore) + login humano real; retornado como checkpoint pendente"

patterns-established:
  - "Toda ação admin autenticada passa por DOIS controles de taxa em camadas: throttle de denied_access (não-admins martelando o guard) + rate-limit geral pós-guard (admin/token comprometido martelando as actions)"

requirements-completed: []

coverage:
  - id: D1
    description: "Rate-limit geral por admin_id/ip na superfície admin (T-16-15) — 429 no estouro, fail-open no erro de count, sem alterar a ordem load-bearing do guard"
    requirement: "ADMIN-04"
    verification:
      - kind: other
        ref: "node -c api/_lib/admin/guard.js && node -c api/admin.js — sintaxe válida; leitura direta confirma checkGeneralRateLimit chamado DEPOIS de g.fail (guard) e ANTES do switch(action)"
        status: pass
    human_judgment: true
    rationale: "Caminho sensível (api/) — revisão adversarial formal (security-reviewer) fica com o orquestrador, que roda após este retorno e antes do deploy (nota de runtime #5). Smoke test de 429 real (curl acima do limite) também exige deploy live."
  - id: D2
    description: "docs/admin-lgpd.md cobre base legal, minimização (V7.1) e retenção do audit (proposta 2 anos, expurgo manual, ASVS V7)"
    requirement: "ADMIN-04"
    verification:
      - kind: manual_procedural
        ref: "docs/admin-lgpd.md criado e lido nesta sessão — seções 1 (base legal), 2 (minimização), 3 (retenção), 4 (ASVS V7), 5 (direitos do titular) presentes"
        status: pass
    human_judgment: true
    rationale: "A retenção proposta (2 anos, expurgo manual) é uma decisão de produto — precisa ser ratificada explicitamente pelo dono no checkpoint humano (Task 3), não apenas documentada."
  - id: D3
    description: "Memória testar-tier-free-pro atualizada para apontar o painel como caminho primário de troca de tier (SQL Editor como fallback)"
    verification: []
    human_judgment: true
    rationale: "PULADA nesta sessão por instrução explícita de runtime (nota #3): o arquivo vive fora do repositório (~/.claude/.../memory/), não é artefato do projeto — fica com o orquestrador aplicar."
  - id: D4
    description: "Gate D-seq: dogfooding via painel dos UATs pendentes das Phases 12 e 13"
    verification: []
    human_judgment: true
    rationale: "Exige o painel /painel deployado (16-03) + login humano real — não executável por este agente (nota de runtime #4). Ver seção 'Checkpoint Pendente — Dogfooding' abaixo com a lista exata de UATs a re-rodar."
---

# Phase 16 / Plano 04: Hardening + LGPD (código/doc) — dogfooding pendente

**Rate-limit geral pós-guard (30 req/60s por admin_id/ip, fail-open) + `docs/admin-lgpd.md` (base legal, minimização, retenção 2 anos a ratificar) — dogfooding dos UATs 12/13 e ratificação de retenção seguem como checkpoint humano pendente.**

## Performance
- **Tasks executadas:** 1/3 (código/doc) — Task 2 (memória) deferida ao orquestrador; Task 3 (checkpoint) retornada pendente, não executada
- **Files modified:** 4 (`api/_lib/admin/guard.js`, `api/admin.js`, `supabase/admin-backoffice.sql`, `docs/admin-lgpd.md` criado)
- **Completed (código):** 2026-07-17

## Accomplishments
- **Rate-limit geral (Task 1a):** `checkGeneralRateLimit` em `guard.js` — teto 30 requisições/60s por `admin_id` (JWT verificado) OU `ip` do requisitante, contando TODAS as linhas de `admin_audit_log` na janela (não só `denied_access`). Chamado pelo roteador (`api/admin.js`) logo após `requireAdmin()` suceder — nunca antes da allowlist, ordem load-bearing do guard preservada. Fail-open no erro de leitura do count; `429 RATE_LIMITED` no estouro. Reusa o `adminClient` (service_role) já autorizado do request corrente, sem instanciar client novo.
- **`docs/admin-lgpd.md` (Task 1b):** base legal (LGPD art. 7º V/IX — execução de contrato + legítimo interesse), minimização (V7.1 — RPCs retornam só metadados/contagens, `admin_audit_log` nunca grava dado financeiro do usuário-alvo, só o delta de `plan`), proposta de retenção (2 anos, expurgo manual via SQL Editor, sem job automático no MVP — **marcada explicitamente como proposta a ratificar**), padrão ASVS V7.1/V7.2/V7.3, e nota sobre direitos do titular (art. 18).
- **Delta SQL (doc-only):** comentário adicionado em `supabase/admin-backoffice.sql` apontando para a política de retenção — **nenhuma DDL**, nada precisa ser reaplicado no banco (nota de runtime #2 seguida à risca).
- **Task 2 (memória) e Task 3 (checkpoint) NÃO executadas** — ver seções dedicadas abaixo.

## Task Commits
1. **Task 1: Rate-limit geral + docs/admin-lgpd.md** - `0e80064` (feat)

## Files Created/Modified
- `api/_lib/admin/guard.js` - `checkGeneralRateLimit` (nova função, exportada) + constantes `GENERAL_RATE_LIMIT_WINDOW_MS`/`GENERAL_RATE_LIMIT_MAX`
- `api/admin.js` - chama `checkGeneralRateLimit` após o guard suceder, antes do dispatch por `action`
- `docs/admin-lgpd.md` - novo, nota LGPD completa (base legal, minimização, retenção, ASVS V7, direitos do titular)
- `supabase/admin-backoffice.sql` - comentário de retenção acima da tabela `admin_audit_log` (doc-only)

## Decisions Made
- Rate-limit geral desenhado como camada ADICIONAL ao throttle de `denied_access` do 16-02 (não substitui): throttle existente protege contra não-admins martelando o guard (status='denied'); rate-limit novo protege TODAS as ações autenticadas contra um admin/token comprometido.
- Teto de 30/60s escolhido acima do throttle de denied (5/60s) porque cobre tráfego legítimo (dashboard carregando múltiplas actions) além de tráfego malicioso — número conservador para o volume friends-and-family do MVP, sem dado de produção para calibrar precisamente (ajustável se necessário).
- Retenção do audit log tratada como PROPOSTA no `docs/admin-lgpd.md`, não como fato consumado — a ratificação fica explicitamente para o checkpoint humano (Task 3).

## Deviations from Plan
None nos tasks de código — plano executado exatamente como escrito para a Task 1. As Tasks 2 e 3 foram deliberadamente não-executadas por instrução explícita de runtime (não são deviations, são escopo definido pelo orquestrador para esta sessão):
- **Task 2 (memória testar-tier-free-pro):** pulada por nota de runtime #3 — arquivo fora do repositório do projeto.
- **Task 3 (checkpoint dogfooding):** pulada por nota de runtime #4 — exige deploy + login humano, não executável por este agente.

## Issues Encountered

**1. Ordem de execução fora de sequência (16-03 ainda não executado):** o frontmatter de `16-04-PLAN.md` declara `depends_on: [16-03]`, mas nesta árvore `.planning/phases/16-painel-admin-backoffice/16-03-PLAN.md` existe SEM `16-03-SUMMARY.md` correspondente — ou seja, o front-end `/painel` (ADMIN-03) ainda não foi construído/deployado. As Tasks de código do 16-04 (rate-limit + LGPD doc) são independentes do front-end (só tocam `api/_lib/admin/guard.js`, `api/admin.js`, `supabase/admin-backoffice.sql`, `docs/admin-lgpd.md`) e puderam ser executadas normalmente. **Porém o checkpoint de dogfooding (Task 3) depende adicionalmente de o 16-03 estar completo e deployado** — sem o painel existir, não há como logar e trocar tier via UI. Sinalizado ao orquestrador: o gate da fase não pode ser fechado só com este plano; 16-03 precisa terminar primeiro.

**2. Memória `testar-tier-free-pro` — não tocada:** conforme nota de runtime #3, este agente não tem acesso de escrita esperado sobre `~/.claude/.../memory/testar-tier-free-pro.md` como parte do escopo do projeto. Conteúdo atual não foi lido/alterado. **Fica com o orquestrador** aplicar a atualização (painel como caminho primário, SQL Editor como fallback, passo do F5 preservado) conforme a Task 2 do plano.

**3. Revisão de segurança do `guard.js`:** este agente não tem a tool `Agent` (nota de runtime #5) — não foi possível spawnar `security-reviewer` formalmente. Autocrítica inline aplicada durante a implementação (ver checklist abaixo); a revisão adversarial formal deve rodar pelo orquestrador ANTES do deploy/push.

### Autocrítica inline (guard.js / admin.js) — checklist de autorrevisão
- ✅ `checkGeneralRateLimit` é chamado DEPOIS de `g.fail` (guard) já ter sido checado — não pode nunca ser alcançado por requisição sem token/JWT inválido/não-allowlisted.
- ✅ Usa `adminClient` (service_role) já instanciado — não cria segundo client, não duplica lógica de credencial.
- ✅ Fail-open: erro no `count` nunca bloqueia a requisição (mesmo padrão de `assistant.js:285-291`); só bloqueia quando o count é um número válido `>= GENERAL_RATE_LIMIT_MAX`.
- ✅ IP reusa `getClientIp` (já com o fix anti-spoof do 16-02 — `x-real-ip` preferido, fallback último elemento de XFF) — nenhuma nova superfície de IP forjável introduzida.
- ✅ `safeIp` sanitiza vírgulas/parênteses antes de entrar na cláusula `.or(...)` do Supabase — mesmo padrão defensivo já usado em `auditDenied`.
- ⚠️ Race condition read-then-continue (não atômico) sob concorrência real pode deixar passar um pouco acima do teto — mesma limitação best-effort já documentada e aceita para o throttle de `denied_access` no 16-02 (LOW/MEDIUM, não é buraco de segurança, é rate-limit aproximado).
- ✅ Nenhum dado sensível/segredo é logado pela resposta `429 RATE_LIMITED` (só o código de erro, sem detalhe interno).
- ✅ `node -c` limpo nos dois arquivos alterados.

## Checkpoint Pendente — Task 3 (dogfooding + ratificação, NÃO executado)

Este plano NÃO fechou o gate da Phase 16. O checkpoint humano abaixo precisa ser conduzido pelo orquestrador/dono, **depois** que o painel `/painel` (16-03) estiver deployado e a Task 2 (memória) e a revisão de segurança formal (Task 1) tiverem rodado.

### 1. Ratificar a retenção do audit log
`docs/admin-lgpd.md` propõe 2 anos + expurgo manual. Confirmar com o dono ou ajustar o documento.

### 2. Dogfooding — 5 UATs pendentes da Phase 13 (gating free/pro)
Fonte: `.planning/phases/13-ia-3-gating-premium-in-app/13-VERIFICATION.md` §"Human Verification Required" (código já verificado 16/16 truths; estes são os itens `human_needed`, não gaps de implementação):

1. **UAT do fix CR-01 (defesa em profundidade WRITE):** logado como conta free, pedir no chat "lança 50 no mercado" — o assistente NUNCA deve abrir o card de confirmação de WRITE (recusa em texto apontando para Premium). Como pro, o mesmo pedido abre o card normalmente.
2. **403 forçado na Análise da IA como free:** logado como free, forçar `fetch('/api/assistant', {..., mode:'analysis'})` no console → esperar `403 PREMIUM_REQUIRED` sem chamar o Gemini. Como pro, funciona normalmente.
3. **Cap de 10 msg/mês (11ª mensagem):** como free, mandar 10 mensagens de chat READ no mês; a 11ª deve retornar `429 FREE_MONTHLY_LIMIT`.
4. **Free vs. pro no Perfil + parse sem erro:** carregar o app como free e como pro; aba Perfil deve mostrar badge "Free" + CTA `UpgradeModal` (free) ou badge "Premium" sem CTA (pro); app carrega sem erro de parse do Babel-standalone.
5. **Trava live de `profiles.plan` (regressão futura):** já confirmado uma vez no apply da Plan 13-02 — reconfirmar que a trava de coluna (REVOKE/GRANT) segue intacta no banco live.

### 3. Dogfooding — UATs da Phase 12 (WRITE in-app)
Fonte: `.planning/phases/12-ia-2-destravar-write-no-assistente-in-app-b8/12-VERIFICATION.md` §"Human Verification Required" (re-verificação pós gap-closure 12-06/12-07; 7/9 truths já verificadas estaticamente por leitura de código — estes 2 exigem sessão real com o Gemini, comportamento não-determinístico):

1. **Regressão Test 4 — falso "Ok, cancelei então":** no chat, (a) pedir um lançamento e clicar CANCELAR num card de verdade; (b) em seguida pedir um NOVO lançamento (por follow-up de categoria OU tudo numa mensagem só); (c) recarregar a página e repetir (b). **Esperado:** o bot nunca mais responde "Ok, cancelei então" para o novo pedido — sempre monta o card de confirmação (ou pergunta o campo faltante), inclusive após reload.
2. **Regressão Test 1 — cartão homônimo virando conta:** com uma CONTA e um CARTÃO cadastrados com o MESMO nome (ex. "Bradesco"): (a) "lança 1 real na categoria natal, no cartão de crédito bradesco" → card deve apontar para o CARTÃO (status Pendente, mês pela fatura, `card_id` preenchido/`account_id` nulo); (b) "lança 1 real na conta corrente bradesco" → card aponta para a CONTA; (c) "lança 1 real no bradesco" sem qualificar → assistente pede desambiguação explícita, não escolhe sozinho.

**Nota de discrepância (para o orquestrador resolver):** `STATE.md` (Phase Overview) registra "Phase 12 ... UAT humano pendente (0/4)", citando os 4 testes originais de `12-UAT.md`. Porém `12-UAT.md` já marca os 4 testes como `result: pass` (2 deles com `resolved_2026-07-14` após os fixes 12-06/12-07), e o `12-VERIFICATION.md` mais recente (re-verificação pós gap-closure) já reduziu a lista de pendências humanas a exatamente os 2 itens acima (regressão dos Tests 1 e 4 — os únicos com risco residual de comportamento não-determinístico do Gemini). Recomendação: tratar os 2 itens do `12-VERIFICATION.md` como a lista autoritativa e atualizar `STATE.md` de "(0/4)" para refletir isso, em vez de repetir os 4 testes originais do zero.

### 4. Confirmar nada destrutivo no MVP
Sem banir/excluir/reset senha — escopo trava do MVP (D-1c).

### 5. Rodar `/gsd-verify-work 16`
Ao final de tudo acima, para a UAT conversacional da própria Phase 16.

## Next Phase Readiness
- **Bloqueio para fechar o gate da fase:** 16-03 (front `/painel`) ainda não tem `16-03-SUMMARY.md` nesta árvore — precisa ser executado e deployado antes de qualquer dogfooding real (Task 3 acima é literalmente impossível sem UI para logar).
- Rate-limit geral e `docs/admin-lgpd.md` estão prontos para revisão de segurança formal (security-reviewer) e para o deploy junto com o restante da fase.
- Task 2 (memória) e Task 3 (checkpoint completo) ficam para o orquestrador conduzir na sequência correta: 16-03 → revisão de segurança do 16-04 → Task 2 → Task 3 (dogfooding + ratificação) → `/gsd-verify-work 16`.

---
*Phase: 16-painel-admin-backoffice · Plano 04 (parcial — código/doc)*
*Completed (código): 2026-07-17*

## Self-Check: PASSED
- FOUND: docs/admin-lgpd.md
- FOUND: 0e80064 (git log --oneline --all)
- FOUND: .planning/phases/16-painel-admin-backoffice/16-04-SUMMARY.md
