---
phase: 13-ia-3-gating-premium-in-app
plan: 05
subsystem: api
tags: [gemini, gating, premium, security-hardening, defense-in-depth]

# Dependency graph
requires:
  - phase: 13-ia-3-gating-premium-in-app (13-01/13-02/13-03/13-04)
    provides: "profiles.plan fail-closed, buildToolsForPlan(isPremium), FREE_TIER_ADDENDUM, paywall UI"
provides:
  - "WRITE_NAMES (Set derivado de WRITE_FUNCTIONS) em api/assistant.js"
  - "guard 403 PREMIUM_REQUIRED no relay de tool_calls quando free tenta WRITE (CR-01 servidor)"
  - "guard !fs.isPremium em executeTools (assets/fides-claude.jsx) que bloqueia o card de confirmação de WRITE para free (CR-01 cliente)"
  - "FREE_TIER_ADDENDUM reescrito sem os 4 nomes literais das funções WRITE (WR-04)"
affects: [14-ia-4-bot-whatsapp]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Defesa em profundidade no caminho de retorno do Gemini: servidor revalida nome de tool_call contra tier ANTES do relay; cliente revalida de novo antes de executar (D-01)"
    - "Fonte única de verdade para listas de nomes de tool (WRITE_NAMES derivado de WRITE_FUNCTIONS.map, nunca re-hardcodado)"

key-files:
  created: []
  modified:
    - api/assistant.js
    - assets/fides-claude.jsx

key-decisions:
  - "Guard 403 fica DENTRO do bloco if (toolCalls.length > 0), ANTES da assinatura do próximo nonce — nenhum nonce é emitido no caminho bloqueado, evitando dar munição a um replay subsequente"
  - "Bloqueio é fail-closed por LOTE: se qualquer tool_call retornada tiver nome WRITE, a resposta inteira é rejeitada com 403 (não filtra individualmente) — mais simples e mais seguro que tentar podar seletivamente"
  - "FREE_TIER_ADDENDUM reescrito de forma comportamental, mantendo o formato de atribuição const de linha única (não quebra o grep region-scoped)"

requirements-completed: [GATE-03]

coverage:
  - id: D1
    description: "api/assistant.js revalida nome de cada tool_call retornada pelo Gemini contra WRITE_NAMES (derivado de WRITE_FUNCTIONS) quando !isPremium — responde 403 PREMIUM_REQUIRED sem relay, com console.error, ANTES de assinar novo nonce"
    requirement: "GATE-03"
    verification:
      - kind: unit
        ref: "grep 'const WRITE_NAMES' api/assistant.js -> 1; grep 'WRITE_FUNCTIONS.map' -> >=1; grep 'WRITE_NAMES.has' -> >=1; grep 'toolCalls.some' -> >=1; node -c api/assistant.js -> exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "FREE_TIER_ADDENDUM reescrito sem os 4 identificadores literais das funções WRITE (WR-04), mantido como const de linha única"
    requirement: "GATE-03"
    verification:
      - kind: unit
        ref: "grep region-scoped: grep 'const FREE_TIER_ADDENDUM' api/assistant.js | grep -cE 'lancar_transacao|recategorizar_transacao|editar_transacao|criar_categoria' -> 0; grep 'FREE_TIER_ADDENDUM' -> 2 ocorrências (const + uso em fullSystem)"
        status: pass
    human_judgment: false
  - id: D3
    description: "assets/fides-claude.jsx: executeTools bloqueia execução/confirmação de WRITE tool quando !fs.isPremium, empurrando resultado PREMIUM_REQUIRED e nunca abrindo o card de confirmação — sem novo hook (Rules of Hooks) e sem confirm()/alert()"
    requirement: "GATE-03"
    verification:
      - kind: unit
        ref: "grep 'fs.isPremium' assets/fides-claude.jsx -> 2; grep 'PREMIUM_REQUIRED' -> 2; brace-balance node -e check -> exit 0; git diff confirma zero novos useFides()"
        status: pass
    human_judgment: false
  - id: D4
    description: "Revisão de segurança inline do diff de api/assistant.js (caminho sensível) sem findings high/critical no gate WRITE"
    requirement: "GATE-03"
    verification:
      - kind: manual_procedural
        ref: "Revisão inline documentada na seção 'Revisão de Segurança' abaixo — veredito PASS"
        status: pass
    human_judgment: true
    rationale: "Revisão de segurança de código sensível (api/assistant.js) é julgamento qualificado, não redutível a um comando automatizado único — mesmo com todos os greps verdes, o veredito de 'nenhum bypass novo' exige leitura humana/IA do fluxo de dados completo"
  - id: D5
    description: "UAT #3 (VERIFICATION truth #9 / CR-01): free pedindo 'lança 50 no mercado' no chat nunca abre o card de confirmação de WRITE"
    verification: []
    human_judgment: true
    rationale: "Depende do comportamento real do modelo Gemini + render de UI real em sessão autenticada live — não automatizável por grep/leitura estática (já era item de UAT humano na 13-VERIFICATION.md, não novo)"

# Metrics
duration: ~15min
completed: 2026-07-16
status: complete
---

# Phase 13 Plan 05: Gap Closure CR-01/WR-04 Summary

**Defesa em profundidade servidor+cliente que revalida o nome de tool_calls WRITE contra o tier antes do relay/execução, fechando o gap bloqueante da VERIFICATION truth #9 (code review CR-01) sem tocar em 13-01/13-02/13-03/13-04.**

## Performance

- **Duration:** ~15min
- **Completed:** 2026-07-16T21:42:29Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- **CR-01 servidor** (`api/assistant.js`): `WRITE_NAMES` (Set derivado de `WRITE_FUNCTIONS.map(f => f.name)`, fonte única — sem re-hardcode) alimenta um guard 403 inserido dentro do bloco `if (toolCalls.length > 0)`, antes de assinar o próximo nonce e antes do relay. Quando `!isPremium` e alguma `tool_call` retornada pelo Gemini tem nome em `WRITE_NAMES`, o handler loga via `console.error` (tornando a violação observável) e responde `403 { error: 'PREMIUM_REQUIRED', code: 403 }` sem repassar `tool_calls` nem emitir novo nonce.
- **WR-04** (`api/assistant.js`): `FREE_TIER_ADDENDUM` reescrito de forma comportamental — não cita mais nenhum dos 4 identificadores literais das funções WRITE, reduzindo a superfície de prompt injection. Continua como atribuição const de linha única (grep region-scoped intacto) e `SYSTEM_PROMPT`/`WRITE_FUNCTIONS` não foram tocados.
- **CR-01 cliente** (`assets/fides-claude.jsx`): guarda redundante no topo do loop de `executeTools` — quando `TOOLS_REQUIRING_CONFIRMATION.includes(tc.name) && !fs.isPremium`, empurra resultado `PREMIUM_REQUIRED` e faz `continue`, impedindo que o card de confirmação de WRITE abra para conta free. Reusa `fs.isPremium` já capturado no topo do componente (nenhum novo `useFides()`/hook — Rules of Hooks preservado); nenhum `confirm()`/`alert()` introduzido.

## Task Commits

Each task was committed atomically:

1. **Task 1: Servidor — revalidar tool_calls contra o tier (CR-01) e reescrever FREE_TIER_ADDENDUM (WR-04)** - `20f7cd2` (feat)
2. **Task 2: Cliente — bloquear execução/confirmação de WRITE tool para conta free em executeTools (CR-01 redundante)** - `4ad26c1` (feat)
3. **Task 3: Revisão de segurança do caminho sensível api/ + gate de verificação antes do commit** - sem código adicional; revisão + suite de verificação documentadas abaixo (nenhum finding, nada a corrigir)

**Plan metadata:** commit deste SUMMARY (a seguir)

## Files Created/Modified

- `api/assistant.js` - `WRITE_NAMES` (const Set) + guard 403 dentro de `if (toolCalls.length > 0)`; `FREE_TIER_ADDENDUM` reescrito sem os 4 nomes literais
- `assets/fides-claude.jsx` - guard `!fs.isPremium` em `executeTools`, antes de `setPendingConfirmation`, com resultado `PREMIUM_REQUIRED`

## Decisions Made

- Guard 403 posicionado ANTES da assinatura de `nextNonce` — o caminho bloqueado não emite nonce novo algum, evitando que a violação detectada ainda alimente o mecanismo de continuação de turno (D-06).
- Bloqueio fail-closed por lote: uma única `tool_call` WRITE numa resposta com múltiplas `tool_calls` derruba a resposta inteira (403), em vez de filtrar seletivamente — mais simples de raciocinar e mais seguro (nenhuma tool_call daquele turno chega ao cliente).
- `FREE_TIER_ADDENDUM` manteve o formato de atribuição const de linha única deliberadamente, para não quebrar o grep region-scoped da verificação WR-04 (constraint explícita do plano).

## Deviations from Plan

None - plan executado exatamente como escrito. Nenhuma dependência nova, nenhum símbolo além de `WRITE_NAMES`, nenhuma tool nova.

## Issues Encountered

None.

## Revisão de Segurança (Task 3 — caminho sensível `api/`)

Per CLAUDE.md ("Ao tocar em `api/` ou `supabase/`, rode revisão de segurança antes de commitar") e per instrução da tarefa (sem Agent tool disponível para spawnar `security-reviewer` do ECC), a revisão foi conduzida **inline** contra o diff real de `api/assistant.js` (mesmo veículo já usado nas Phases 12-06/12-07), aplicando a rubrica dos 3 focos exigidos:

**(a) O novo guard 403 realmente bloqueia o relay de WRITE tool_calls para free e não abre novo bypass?**
✓ PASS. O guard é a primeira instrução dentro do bloco `if (toolCalls.length > 0)`, executa `return;` explícito, e ocorre ANTES tanto da assinatura de `nextNonce` quanto do `res.status(200).json({ tool_calls, nonce })` — nenhum caminho de código chega ao relay depois do 403. `isPremium` reutilizado é o mesmo valor já lido fail-closed na linha ~248 (D-02, allow-list `pro`/`family`, default `'free'` em erro/null/valor desconhecido) — nenhuma releitura, nenhuma nova superfície de confiança. O bloqueio é por lote (`toolCalls.some`): se qualquer nome retornado estiver em `WRITE_NAMES`, a resposta inteira cai em 403 — não há caminho onde uma tool_call WRITE escapa junto de tool_calls READ no mesmo array. `console.error` loga apenas os NOMES das tools tentadas (nenhum dado de usuário/PII), consistente com a regra de telemetria do arquivo (nunca logar conteúdo de prompt/resposta).

**(b) `WRITE_NAMES` deriva de `WRITE_FUNCTIONS` sem drift?**
✓ PASS. `const WRITE_NAMES = new Set(WRITE_FUNCTIONS.map(f => f.name));` é computado no escopo de módulo, uma única vez, diretamente da mesma constante (`WRITE_FUNCTIONS`) que já alimenta `buildToolsForPlan`. Não há lista de nomes re-hardcodada em nenhum ponto do diff — adicionar/remover uma tool WRITE em `WRITE_FUNCTIONS` atualiza `WRITE_NAMES` automaticamente, sem exigir edição paralela.

**(c) A reescrita do `FREE_TIER_ADDENDUM` não reintroduz nenhum dos 4 nomes literais?**
✓ PASS. Grep region-scoped na linha de atribuição confirma 0 ocorrências de `lancar_transacao|recategorizar_transacao|editar_transacao|criar_categoria`. O texto passou a descrever a restrição comportacionalmente ("ferramentas de consulta", "não pode lançar, editar, recategorizar ou criar nada"). `SYSTEM_PROMPT` e `WRITE_FUNCTIONS` não foram tocados — os nomes continuam existindo ali como fonte de `WRITE_NAMES`, conforme exigido.

**Observações adicionais (não bloqueantes):**
- O guard cliente em `assets/fides-claude.jsx` reusa `fs.isPremium` sem introduzir novo `useFides()` — confirmado via `git diff` (nenhuma linha nova contém `useFides(`), preservando Rules of Hooks (bug conhecido da Phase 07).
- Nenhuma dependência nova: `git diff` dos dois arquivos tocados não introduz nenhum novo `require(`/`import(`; nenhuma alteração em `package.json`.
- Risco residual (documentado no threat model do plano, T-13-05-01): a mutação real de dados ainda é governada por RLS na linha do próprio usuário — não há brecha cross-conta; o único risco que restava (bypass de monetização via alucinação/fallback/injection) é o que este plano fecha.

**Veredito: PASS — nenhum finding high/critical em aberto relacionado ao gate WRITE.** Suite completa de verificação (Tasks 1+2+3) confirmada verde antes deste commit (ver comandos/saídas na seção Task Commits acima e nos logs de execução).

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- GATE-03 estruturalmente fechado: defesa em profundidade (servidor + cliente) revalidando o nome de tool_calls WRITE contra o tier, conforme prometido pelo threat model das plans 13-01/13-03 (D-01).
- VERIFICATION truth #9 deve virar VERIFIED numa re-verificação (`/gsd-verify-work 13` ou nova rodada de verificação de fase).
- UAT #3 (pedir "lança 50 no mercado" como free, confirmar que o card de confirmação nunca abre) permanece como item humano — é o teste funcional direto deste fix, não substituível por grep/leitura estática.
- Itens explicitamente fora de escopo desta plan (WR-01/CR-02 nonce replay, WR-03 count-then-insert, WR-02 já confirmado, IN-01 TDZ pré-existente) seguem rastreados conforme `13-05-PLAN.md` `<assumptions_and_deferrals>` — nenhum foi tocado aqui.
- Nenhum bloqueio para a Phase 14 (bot WhatsApp) — o gate de tier em `api/assistant.js` agora tem defesa em profundidade que o bot também herdará ao reutilizar o mesmo endpoint/módulo.

---
*Phase: 13-ia-3-gating-premium-in-app*
*Completed: 2026-07-16*

## Self-Check: PASSED

- FOUND: `.planning/phases/13-ia-3-gating-premium-in-app/13-05-SUMMARY.md`
- FOUND: commit `20f7cd2` (Task 1 — servidor CR-01/WR-04)
- FOUND: commit `4ad26c1` (Task 2 — cliente CR-01)
