# Phase 13: IA-3 Gating premium in-app - Research

**Researched:** 2026-07-15
**Domain:** Tier gating (free/premium) sobre um assistente Gemini já em produção — leitura de `profiles.plan`, condicionamento de tools de function calling por tier, contador de cota mensal sobre log existente, RLS/privilégios Postgres, paywall UI com `fides-ui`.
**Confidence:** HIGH — a mecânica central (ler `plan`, condicionar `TOOLS_DECLARATION`, contar sobre `assistant_usage`) é composição direta de padrões já verificados no próprio repositório nesta sessão. MEDIUM no ponto de RLS (schema.sql pode estar desatualizado — ROADMAP B10 — live DB não pôde ser confirmado via MCP Supabase nesta sessão, ver Open Questions).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Enforcement & Segurança do Gate (discutido nesta fase)**
- **D-01:** O gate premium do WRITE/IA mora **server-side em `api/assistant.js`** — o endpoint lê `profiles.plan` e só expõe/emite as tools WRITE quando premium — **mais** uma camada de UI no front que esconde/desabilita as ações premium. Dupla camada, não burlável via chamada direta à API. Gate no banco (RLS/RPC) foi **descartado**: o app manual compartilha o mesmo caminho de INSERT, gatear ali arriscaria quebrar o fluxo manual do free.
- **D-02:** **Fail-closed.** Quando `profiles.plan` vier `null`, com erro de leitura ou valor desconhecido, trata como **free** — nunca libera premium por acidente. Custo aceito: usuário legítimo pode cair na degustação num bug raro de leitura; o oposto (vazar premium) é pior para um gate de segurança.
- **D-03:** **Corte limpo agora** para a regressão. Ao ligar o gate real, usuários `free` perdem o WRITE-via-IA que a Phase 12 abriu para todos; o **app manual continua 100%**. Intencional — é o funil de conversão — e barato pré-lançamento (sem base paga real). Sem grandfather, sem período de transição.
- **D-04:** Teste de dev/premium sem o checkout do M6: **`UPDATE profiles SET plan='pro'`** (e `'free'` para testar degustação) na conta de dev direto no Supabase. Zero código, **sem** env flag, **sem** allowlist de email, **sem** backdoor no app — nada que possa vazar para prod em caminho sensível.

**Carregado das decisões já fechadas (research 2026-07-06 — NÃO re-decidir)**
- **premium = `plan <> 'free'`**, usando a coluna `pro` que já existe (research D-4, zero migração).
- **Free = degustação de chat READ, ~10 msg/mês, sem WRITE** (research D-5) — funil de conversão.
- **Precificação P-2:** free (app manual completo) + premium R$ 89,90/ano (IA + WhatsApp + análises). Preço pago único mantido.

### Claude's Discretion
As demais gray areas ficam a critério de research/planner (dentro das decisões acima):
- **Mecânica exata do cap free** — número exato (~10 msg/mês baseline D-5), janela (mês calendário vs rolling 30d), onde o contador vive (coluna/tabela no Supabase vs local), o que conta como 1 msg, reset. Preferência: contador server-side (coerente com o gate server-side D-01). *→ Ver Pattern 3: resolvido como query sobre `assistant_usage` existente, janela mês calendário (UTC), 1 msg = 1 turno (`isFirstCallOfTurn`).*
- **Comportamento do paywall (PAYWALL-01)** — soft vs bloqueio duro ao bater o cap/tentar WRITE; onde aparece (modal, banner inline no chat, tela dedicada); tom da copy. Usar `fides-ui` (`ConfirmDialog`/`Toast`) — evitar `confirm()`/`alert()`. *→ Ver Standard Stack / Don't Hand-Roll: reusar `ConfirmDialog`/`useToast`/padrão `EmBreveModal`.*
- **Alvo da tela de upgrade** — para onde aponta já que o checkout do M6 não existe (placeholder "em breve" / notify-me / link externo). Não travar a entrega da fase nessa dependência. *→ Ver Open Question 3.*

### Deferred Ideas (OUT OF SCOPE)
- Nomear um tier de marketing "premium" distinto de `pro` interno — decidido manter `pro` (research D-4); revisitar só se surgir tier família real (P-3, M-família).
- Detalhes finos de cap/paywall/upgrade estão em Claude's Discretion acima; se crescerem, viram sub-decisões no plan-phase, não nova fase.
- `ratelimit-bypass-toolresults.md` (área `api/assistant.js`, score 0.2) — trata de bypass de rate limit via toolresults; é hardening do assistant, **não** gating de tier. Considerado e não incorporado; endereçar em hardening do assistente, não aqui.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| GATE-01 | Store lê `plan` real de `profiles` (hoje só `name, group_targets`) e expõe no contexto como fonte da verdade do tier | §Pattern "Front — expor tier no store", §Architecture Patterns Pattern 1, §Recommended Project Structure |
| GATE-02 | Free tem degustação limitada de IA (~10 msg/mês de chat READ, sem WRITE) | §Architecture Patterns Pattern 3 (cota sobre `assistant_usage`), §Common Pitfalls P2/P5, §Don't Hand-Roll |
| GATE-03 | Premium libera WRITE/IA completo (chat + WRITE + Análise da IA ilimitada dentro dos caps) | §Architecture Patterns Pattern 1/2/4, §Common Pitfalls P1/P3, §Validation Architecture (Test Map) |
| PAYWALL-01 | Paywall suave + tela de upgrade apontando para checkout do M6 (a formalizar) | §Standard Stack (reuso `fides-ui`/`EmBreveModal`), §Open Question 3, §Don't Hand-Roll |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Diretivas acionáveis de `./CLAUDE.md` aplicáveis a este phase (mesma autoridade de uma decisão travada em CONTEXT.md — o plano não pode contradizê-las):

| Diretiva | Fonte | Aplicação neste phase |
|---|---|---|
| Frontend HTML + React via Babel-standalone no browser, sem bundler/lint/types hoje | CLAUDE.md §Stack | Nenhum passo de build a introduzir; edições em `.jsx`/`api/*.js`/`.sql` puros, sem TypeScript nem transpilação fora do padrão existente |
| Backend Supabase; schema real vive no banco, `supabase/*.sql` pode estar desatualizado (verdade = MCP Supabase, ROADMAP B10) | CLAUDE.md §Stack | Confirmado nesta pesquisa: `group_targets` já é drift documentado (usado no código, ausente do `CREATE TABLE profiles`). A lista de colunas para o REVOKE/GRANT de P1 e a policy RLS real DEVEM ser confirmadas contra o banco live antes do commit (Open Question 1) |
| `api/assistant.js` — tools READ-only até fundação validada; WRITE proibido até B8 | CLAUDE.md §Stack | Já superado pela Phase 12 (B8 destravado) — esta fase adiciona a camada de tier por cima do WRITE já reaberto, não reabre nada novo |
| Ao tocar `api/` ou `supabase/`, rodar revisão de segurança antes de commitar (auth, RLS, RPCs, chaves/env, superfície do assistente IA) | CLAUDE.md §Segurança | `api/assistant.js` (gate de tier) e a nova migração de privilégios de `profiles` (P1) são exatamente os caminhos sensíveis descritos — `security-reviewer` + `database-reviewer` obrigatórios (ver §Validation Architecture / §Security Domain) |
| UI base `fides-ui` (`ConfirmDialog`/`Toast`/`useConfirm`) — evitar `confirm()`/`alert()` residuais (ROADMAP B9) | CLAUDE.md §Convenções | PAYWALL-01 deve usar esses componentes, nunca `confirm()`/`alert()` nativo (ver §Don't Hand-Roll, §Validation Architecture grep negativo) |
| Movimentação vs despesa; dashboard live = `DashboardStudio` | CLAUDE.md §Convenções | Não afetado por esta fase (nenhuma mudança em transações/dashboard) |

## Summary

Esta fase liga um interruptor que hoje não existe: o app inteiro trata todo mundo como Pro (mock `USER.plan:'Pro'` em `fides-data.jsx:31`, nunca lido por nenhum componente vivo) e o store live nem seleciona a coluna `profiles.plan` do Supabase. A boa notícia, confirmada nesta sessão via leitura direta do schema: `profiles.plan` já existe (`text not null default 'free' check (plan in ('free','pro','family'))`, `schema.sql:14`) — zero migração de dado, exatamente como a decisão D-4 do research anterior previa.

A implementação se resolve em 3 frentes já delineadas pelas decisões travadas (D-01..D-04 do CONTEXT): (1) o store passa a selecionar e propagar `plan`; (2) `api/assistant.js` lê o `plan` do usuário autenticado e **monta o array de tools condicionalmente** — hoje `TOOLS_DECLARATION` é um array único misturando 2 tools READ + 4 tools WRITE; a fase separa READ de WRITE e só inclui WRITE quando `plan` é `pro`/`family`; (3) a UI esconde/desabilita ações premium e mostra paywall suave, reaproveitando `ConfirmDialog`/`useToast` de `fides-ui.jsx` e o padrão `EmBreveModal` já usado em Metas para "funcionalidade futura".

A descoberta mais importante desta pesquisa **não estava no escopo declarado das 5 perguntas, mas ameaça invalidar todo o gate**: a policy RLS de `profiles` (`schema.sql:190-191`, `for all using (auth.uid() = id)`, sem `WITH CHECK` restritivo) permite hoje que **qualquer usuário autenticado altere o próprio `plan` direto pelo client SDK** (`window.fidesDb.from('profiles').update({plan:'pro'})...` no console do browser) — a mesma chamada que `updateProfile`/`setGroupTargets` já fazem legitimamente para `name`/`group_targets`. RLS restringe *linhas*, não *colunas*: sem uma trava adicional, o "gate defense-in-depth" do D-01 protege o **caminho da IA**, mas deixa a **fonte da verdade do tier** (`plan`) auto-editável pelo próprio usuário sem passar por nenhum checkout. Isso não é uma alternativa ao "gate no banco (RLS/RPC)" que D-01 descartou — aquela decisão era sobre gatear o *insert de transação* via RLS/RPC (que quebraria o app manual); isto é sobre proteger a *coluna que decide o tier*, um problema diferente e anterior a qualquer gate de IA. Ver Common Pitfalls P1 e Security Domain.

**Primary recommendation:** GATE-01 lê `plan` no store (2 pontos de `select`); GATE-03 divide `TOOLS_DECLARATION` em `READ_TOOLS`/`WRITE_TOOLS` e monta o array por tier no servidor, com fail-closed por allow-list (`plan === 'pro' || plan === 'family'`, nunca `plan !== 'free'`); GATE-02 conta o cap de degustação **sobre a tabela `assistant_usage` que já existe** (sem coluna/tabela nova) filtrando por mês corrente — a mesma linha que já é inserida por turno de chat hoje; PAYWALL-01 usa `fides-ui` + o padrão `EmBreveModal`/`ConfirmDialog` já em produção. Além disso, feche o buraco de RLS em `profiles.plan` (REVOKE/GRANT column-level, ver Common Pitfalls P1) como pré-requisito de segurança do gate inteiro — sem isso, "premium = `plan <> 'free'`" é auto-outorgável.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fonte da verdade do tier (`profiles.plan`) | Database / Storage | — | Coluna já existe, RLS já protege por linha; falta proteção por coluna (ver P1) |
| Leitura do tier para a UI (esconder/desabilitar) | Frontend (store + views) | — | Store é a única fonte de estado do client; views consomem via `useFides()` |
| Decisão de quais tools a IA recebe | API / Backend (`api/assistant.js`) | — | Único ponto que fala com o Gemini; cliente não decide o que o modelo pode chamar |
| Execução da tool WRITE confirmada | Browser / Client (`fides-claude.jsx` → RPC `wa_log_transaction`) | Database (RPC SECURITY DEFINER) | Já implementado na Phase 12; fora do escopo mudar o executor, só o *gate* de quem recebe a capacidade |
| Contador de cota mensal free | API / Backend (`api/assistant.js`, query sobre `assistant_usage`) | Database (tabela existente) | Servidor já é o único que insere linhas em `assistant_usage`; contar ali é coerente com D-01 (gate server-side) |
| Paywall / tela de upgrade | Frontend (modal/tela dedicada) | — | Sem lógica de negócio — só apresentação + CTA (placeholder até M6) |

## Standard Stack

Nenhuma biblioteca nova. A fase é 100% composição de padrões já em produção neste repositório:

| Peça | Onde já existe | Reuso nesta fase |
|---|---|---|
| Cliente Supabase autenticado (`Authorization: Bearer`) | `api/assistant.js:204-206` | Mesmo client já usado para `assistant_usage`/`auth.getUser` — reusar para `SELECT plan FROM profiles` |
| Contagem de uso por janela de tempo | `api/assistant.js:227-233` (`gte('created_at', ...)`, `count:'exact', head:true`) | Copiar o padrão trocando a janela de 24h por "início do mês corrente" |
| Toggle condicional de `tools`/`toolConfig` no payload Gemini | `api/assistant.js:307-308` (`tools: isAnalysisMode ? undefined : TOOLS_DECLARATION`) | Mesmo padrão, um nível a mais: `tools: isAnalysisMode ? undefined : buildToolsForPlan(isPremium)` |
| Modal "funcionalidade futura" | `EmBreveModal`, `fides-metas.jsx:972` | Modelo direto para a tela de upgrade (placeholder até checkout M6) |
| `ConfirmDialog`/`useConfirm`/`useToast` | `fides-ui.jsx:38-228` | Paywall soft (toast/aviso) e paywall duro (dialog bloqueante) — nunca `confirm()`/`alert()` |
| Mapa de erro amigável por `errCode` | `friendlyError` (`fides-claude.jsx:547`) e `friendlyAiError` (`fides-orcamento.jsx:1017`) — **duas cópias distintas, não compartilhadas** | Adicionar entradas para os novos códigos (`FREE_MONTHLY_LIMIT`, `PREMIUM_REQUIRED`) **nas duas** |
| Padrão de "addendum" condicional no system prompt | `ANALYSIS_ADDENDUM` (`api/assistant.js:266`) | Mesmo padrão para avisar o modelo, quando free, que WRITE não está disponível nesta sessão (ver Common Pitfalls P3) |

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Contar cota mensal sobre `assistant_usage` (linhas já existentes) | Coluna dedicada `profiles.free_msgs_used`/`free_msgs_reset_at` | Rejeitado: exige lógica de reset manual (mais um mecanismo hand-rolled de "zerar contador no dia X" — exatamente a classe de bug que o histórico do projeto já sofreu, ver `whatsapp-e-ia-arquitetura.md` "Lições dos logs"). Contar por `created_at >= início do mês` é stateless e se auto-reseta pela própria definição da query. |
| Contar cota mensal sobre `assistant_usage` | Nova tabela `ai_quota_usage` | Rejeitado: duplicaria o que `assistant_usage` já registra por linha/por chamada; mais uma tabela para manter sincronizada sem ganho. |
| Allow-list (`plan === 'pro' \|\| plan === 'family'`) | Negação direta (`plan !== 'free'`) | A semântica de negócio (D-4) é `plan <> 'free'`, mas fail-closed (D-02) exige que **valor desconhecido** também caia em free. Allow-list satisfaz as duas: implementa `<> 'free'` para os valores válidos conhecidos E fail-closed para qualquer outra coisa (typo, `null`, valor futuro não mapeado). Negação direta violaria D-02 (um valor inesperado não-`'free'` liberaria premium por acidente). |

**Installation:** Nenhuma — sem novo pacote npm/pip. Ver Package Legitimacy Audit.

## Package Legitimacy Audit

**Não aplicável — esta fase não instala nenhum pacote novo.** Toda a implementação usa `@supabase/supabase-js` (já em `package.json`) e código próprio. Nenhuma verificação de registry necessária.

## Architecture Patterns

### System Architecture Diagram

```
                         FRONT (browser)                              BACK (Vercel)                    DB (Supabase)
                    ┌─────────────────────┐                    ┌──────────────────────┐         ┌──────────────────────┐
Login/refresh  ───► │ fides-store.jsx      │                    │                       │         │ profiles              │
                    │  select('name,       │◄──────────────────┼───────────────────────┼────────►│  id, name, plan,      │
                    │   group_targets,     │   SELECT (RLS:     │                       │         │  group_targets        │
                    │   plan')  [GATE-01]  │    auth.uid()=id)  │                       │         │  (plan: free|pro|     │
                    │  → userPlan/isPremium│                    │                       │         │   family, default     │
                    └──────────┬───────────┘                    │                       │         │   'free')             │
                               │ context value                  │                       │         └──────────┬───────────┘
                               ▼                                │                       │                    │
                    ┌─────────────────────┐                    │                       │         RLS row-level only —
                    │ PerfilView            │                   │                       │         coluna plan É         
                    │  badge tier + CTA     │                   │                       │         self-writable hoje
                    │  upgrade [PAYWALL-01] │                   │                       │         (P1 — trava antes
                    └─────────────────────┘                    │                       │         de confiar no gate)
                               │
                               │ usuário abre chat/clica "Análise da IA"
                               ▼
                    ┌─────────────────────┐        POST /api/assistant        ┌──────────────────────┐
                    │ fides-claude.jsx /    │ ─────────────────────────────► │ 1. auth.getUser(jwt)  │
                    │ fides-orcamento.jsx   │   Authorization: Bearer <jwt>   │ 2. SELECT plan FROM   │
                    │  esconde/desabilita   │                                  │    profiles [NOVO]    │
                    │  WRITE/Análise se     │                                  │    → isPremium        │
                    │  free (camada UI,     │                                  │    (allow-list,       │
                    │  D-01 — NÃO única)    │                                  │    fail-closed D-02)  │
                    └─────────────────────┘                                  │ 3. free + analysis?   │
                                                                               │    → 403 PREMIUM_REQ  │
                                                                               │ 4. free? conta        │
                                                                               │    assistant_usage    │
                                                                               │    do mês [GATE-02]   │
                                                                               │    ≥10? → 429 LIMIT   │
                                                                               │ 5. monta tools:        │
                                                                               │    premium=READ+WRITE  │
                                                                               │    free=READ only      │
                                                                               │    [GATE-03]          │
                                                                               │ 6. chama Gemini        │
                                                                               └──────────┬─────────────┘
                                                                                          │ tool_calls (WRITE só se premium)
                                                                                          ▼
                                                                               cliente executa WRITE via
                                                                               RPC wa_log_transaction
                                                                               (já existe, Phase 12 —
                                                                               fora de escopo mudar aqui)
```

### Recommended Project Structure

Nenhum arquivo novo de estrutura — edições em arquivos existentes:

```
api/
└── assistant.js          # + leitura de plan, split READ_TOOLS/WRITE_TOOLS, gate de análise, cap mensal free
assets/
├── fides-store.jsx       # + 'plan' no select (2 pontos), + userPlan/isPremium no context value
├── fides-data.jsx        # mock USER.plan vira irrelevante (já não é lido por ninguém — confirmar/remover)
├── fides-claude.jsx      # + entradas de erro (FREE_MONTHLY_LIMIT/PREMIUM_REQUIRED), + UI de paywall/cap
├── fides-orcamento.jsx   # + gate do botão "Análise da IA" (esconder/CTA upgrade se free)
└── fides-studio.jsx      # PerfilView: + badge de tier + CTA de upgrade [PAYWALL-01]
supabase/
└── (novo) profiles-plan-privileges.sql   # REVOKE/GRANT column-level em profiles.plan (ver P1) — security-review obrigatório
```

### Pattern 1: Split de tools por tier no servidor (GATE-03)
**What:** hoje `TOOLS_DECLARATION` é um único array `[{ functionDeclarations: [...6 tools...] }]`. Separar em duas constantes e montar o payload condicionalmente.
**When to use:** sempre que o Gemini for chamado em modo chat (não-análise).
**Example:**
```js
// Source: padrão adaptado de api/assistant.js:70-170 (TOOLS_DECLARATION atual) — [VERIFIED: leitura direta do arquivo nesta sessão]
const READ_FUNCTIONS = [ /* consultar_saldo, consultar_extrato — como hoje */ ];
const WRITE_FUNCTIONS = [ /* lancar_transacao, recategorizar_transacao, editar_transacao, criar_categoria — como hoje */ ];

function buildToolsForPlan(isPremium) {
  const fns = isPremium ? [...READ_FUNCTIONS, ...WRITE_FUNCTIONS] : READ_FUNCTIONS;
  return [{ functionDeclarations: fns }];
}

// no payload:
tools: isAnalysisMode ? undefined : buildToolsForPlan(isPremium),
toolMode: isAnalysisMode ? 'NONE' : 'AUTO',
```
O modelo Gemini **fisicamente não recebe** a declaração das tools WRITE quando `isPremium` é falso — não é um filtro pós-resposta, é ausência de capacidade na chamada. Isso é o que torna o gate "não burlável via chamada direta à API" (a API é o próprio `api/assistant.js`; chamar o Gemini direto exigiria a chave privada, que não sai do servidor).

### Pattern 2: Leitura de plan fail-closed por allow-list (D-02 + D-4)
**What:** ler `profiles.plan` e reduzir a um booleano `isPremium`, nunca deixando um valor inesperado liberar premium.
**When to use:** logo após validar o JWT, antes de qualquer outra decisão de negócio na request.
**Example:**
```js
// Source: adaptado do padrão de auth.getUser já existente em api/assistant.js:207-212 — [VERIFIED: leitura direta do arquivo]
let plan = 'free'; // fail-closed default (D-02)
try {
  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();
  if (!profileError && profileRow && typeof profileRow.plan === 'string') {
    plan = profileRow.plan;
  }
} catch (e) {
  console.error('[assistant] profile plan fetch exception', e);
  // plan permanece 'free' — fail-closed
}
// Allow-list, não negação: valor desconhecido (typo, plan futuro não mapeado) também cai em free.
const isPremium = plan === 'pro' || plan === 'family';
```

### Pattern 3: Cota mensal sobre tabela existente (GATE-02)
**What:** contar linhas de `assistant_usage` do usuário desde o início do mês corrente, no mesmo ponto onde o rate-limit diário já é verificado.
**When to use:** só para usuários free, só na primeira chamada do turno (`isFirstCallOfTurn`) — mesma granularidade que o rate-limit diário já usa, então uma tool WRITE bloqueada não gera 2 "mensagens" por engano.
**Example:**
```js
// Source: adaptado do bloco de rate-limit diário existente, api/assistant.js:227-254 — [VERIFIED: leitura direta do arquivo]
const FREE_TIER_MONTHLY_LIMIT = 10; // D-5 do research anterior: "~10 msg/mês"

if (isFirstCallOfTurn && !isPremium) {
  const now = new Date();
  const startOfMonthUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { count: monthlyCount, error: monthlyErr } = await supabase
    .from('assistant_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfMonthUTC);

  if (!monthlyErr && (monthlyCount || 0) >= FREE_TIER_MONTHLY_LIMIT) {
    res.status(429).json({ error: 'FREE_MONTHLY_LIMIT', code: 429, limit: FREE_TIER_MONTHLY_LIMIT });
    return;
  }
  // countError aqui é fail-open (mesma filosofia do rate-limit diário existente) — não travar o usuário
  // por um erro transitório de leitura, só por atingir o cap de fato.
}
```
Nenhuma coluna nova, nenhuma tabela nova, nenhum job de reset — o filtro `gte('created_at', startOfMonthUTC)` recalculado a cada request já "reseta" sozinho no dia 1.

### Pattern 4: Addendum de system prompt condicional por tier
**What:** hoje `ANALYSIS_ADDENDUM` já é concatenado condicionalmente ao `SYSTEM_PROMPT` (`api/assistant.js:266-270`). O `SYSTEM_PROMPT` fixo, porém, descreve as 4 tools WRITE incondicionalmente (`"Você pode lançar transações, recategorizar..."`) mesmo quando o array de tools enviado ao modelo não as contém para free — ver Common Pitfalls P3.
**When to use:** sempre que `!isPremium`.
**Example:**
```js
// Source: mesmo padrão de ANALYSIS_ADDENDUM, api/assistant.js:266 — [VERIFIED: leitura direta do arquivo]
const FREE_TIER_ADDENDUM = '\n\n═══ CONTA GRATUITA (degustação) ═══\nEste usuário está no plano gratuito: você só tem as ferramentas de LEITURA (consultar_saldo, consultar_extrato) — as ferramentas de escrita (lançar, recategorizar, editar, criar categoria) NÃO estão disponíveis nesta conversa. Se o usuário pedir para lançar/editar/recategorizar algo, explique com gentileza que essa função é do plano premium e sugira conhecer o upgrade — nunca finja executar, nunca chame uma ferramenta que não existe.';

const fullSystem = SYSTEM_PROMPT
  + (isAnalysisMode ? ANALYSIS_ADDENDUM : '')
  + (!isPremium ? FREE_TIER_ADDENDUM : '')
  + (context ? `\n\n═══ CONTEXTO ATUAL DO USUÁRIO ═══\n${context}` : '');
```

### Anti-Patterns to Avoid
- **Gate só no front:** esconder o botão de WRITE na UI sem o servidor também recusar a tool é burlável por DevTools/chamada direta a `/api/assistant`. D-01 já resolve isso — só reforçando que a ordem de implementação importa: o servidor é a fonte de verdade, o front é conveniência.
- **`plan !== 'free'` em vez de allow-list:** viola D-02 fail-closed para valores desconhecidos (ver Pattern 2).
- **Nova tabela/coluna para o contador de degustação:** hand-rolled state que precisa de reset — viola "Don't Hand-Roll" quando `assistant_usage` já resolve por query.
- **Confiar em RLS de `profiles` como estava:** a policy atual não impede o próprio usuário de escrever `plan` — ver Common Pitfalls P1. Sem corrigir isso, o gate de IA é sólido mas o *tier em si* é auto-outorgável.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Cota mensal de mensagens free | Coluna(s) de contador + timestamp de reset em `profiles` | Query `COUNT` sobre `assistant_usage` filtrada por `created_at >= início do mês` | Stateless, auto-reseta, sem job/cron; a tabela já é escrita a cada turno de chat (ver Pattern 3) |
| Restringir campo `plan` a escrita só por processo confiável | Trigger custom em PL/pgSQL validando quem está chamando | `REVOKE UPDATE ON profiles FROM authenticated; GRANT UPDATE (name, group_targets) ON profiles TO authenticated;` (privilégio de coluna, padrão documentado pelo próprio Supabase) | Mecanismo nativo do Postgres, testado, sem lógica de aplicação para manter — ver Common Pitfalls P1 |
| Paywall modal | Componente novo do zero | `ConfirmDialog`/`useConfirm` (bloqueio duro) ou `useToast` (aviso soft) de `fides-ui.jsx`, ou clonar `EmBreveModal` (`fides-metas.jsx:972`) | Convenção do projeto já pede evitar `confirm()`/`alert()` residuais (ROADMAP B9); reuso reduz CSS/JS novo |

**Key insight:** as duas peças de estado que esta fase precisa (contador de cota, flag de tier) **já existem** no schema (`assistant_usage`, `profiles.plan`). O trabalho é de leitura/composição, não de modelagem de dado nova — risco de regressão é baixo se a tentação de "criar uma tabelinha de controle" for resistida.

## Common Pitfalls

### Pitfall 1 (CRÍTICO): `profiles.plan` é self-writable via RLS hoje
**What goes wrong:** qualquer usuário autenticado pode rodar `window.fidesDb.from('profiles').update({plan:'pro'}).eq('id', meuId)` no console do browser e virar premium sem pagar — a mesma chamada client-side que `updateProfile` (`fides-store.jsx:1024-1037`) e `setGroupTargets` (`fides-store.jsx:1039-1052`) já fazem legitimamente para `name`/`group_targets`.
**Why it happens:** a policy RLS de `profiles` é `for all using (auth.uid() = id)` (`schema.sql:190-191`) **sem `WITH CHECK`** — no Postgres, quando uma policy `FOR ALL` só declara `USING`, essa mesma expressão vale como `WITH CHECK` implícito para INSERT/UPDATE. RLS restringe **linhas** (só a própria), não **colunas** — nada impede o dono da linha de escrever em qualquer coluna, incluindo `plan`.
**How to avoid:** aplicar o padrão de column-level privilege que o próprio Supabase documenta oficialmente: `REVOKE UPDATE ON public.profiles FROM authenticated;` seguido de `GRANT UPDATE (name, group_targets) ON public.profiles TO authenticated;` (lista exata de colunas editáveis pelo usuário deve ser confirmada contra o banco live — `group_targets` não está no `CREATE TABLE` do `schema.sql`, é drift documentado, ROADMAP B10). Isso preserva D-04 (`UPDATE profiles SET plan='pro'` direto no SQL Editor do Supabase, que roda como owner/`service_role` e ignora privilégios de coluna de `authenticated`) enquanto fecha a mesma chamada feita pelo client SDK autenticado do app. [CITED: supabase.com/docs/guides/database/postgres/column-level-security]
**Warning signs:** qualquer teste manual que confirme "free" via UI mas não verifique que uma tentativa de auto-`UPDATE plan` pelo client falha; ausência de teste explícito para esse caso no UAT desta fase.

### Pitfall 2: Contagem de "1 mensagem" duplicada por round-trip de tool
**What goes wrong:** se o contador de cota mensal for incrementado a cada chamada HTTP a `/api/assistant` (em vez de por turno), uma pergunta que dispara `consultar_saldo` (1ª chamada) + resposta final (2ª chamada) consumiria 2 do cap de 10, cobrando o dobro do que o usuário percebe como "1 mensagem".
**Why it happens:** o próprio rate-limit diário existente já resolveu isso com `isFirstCallOfTurn = !hasToolResults || !nonceValid` (`api/assistant.js:221`) — é fácil esquecer de aplicar a mesma guarda ao cap mensal novo e contar em todo POST.
**How to avoid:** o cap mensal DEVE usar a mesma flag `isFirstCallOfTurn` que já governa o insert em `assistant_usage` (ver Pattern 3) — são o mesmo conceito de "mensagem", reusar a mesma guarda em vez de reinventar.
**Warning signs:** usuário free relata "só mandei 5 mensagens e já travou" — sintoma direto de contagem duplicada por round-trip.

### Pitfall 3: System prompt promete WRITE que o array de tools não entrega
**What goes wrong:** `SYSTEM_PROMPT` (`api/assistant.js:17-67`) descreve as 4 tools WRITE de forma incondicional e fixa ("Você pode lançar transações, recategorizar, editar e criar categorias..."). Se só o array `tools` for gateado por tier e o prompt continuar fixo, o modelo é informado de uma capacidade que não está de fato disponível na chamada — risco de resposta confusa ou (mitigado, mas não eliminado) tentativa de fabricar um resultado.
**Why it happens:** fácil implementar GATE-03 só no array `TOOLS_DECLARATION`/payload e esquecer que o prompt textual é uma segunda fonte da mesma informação, que precisa ficar coerente.
**How to avoid:** aplicar o `FREE_TIER_ADDENDUM` (Pattern 4) sempre que `!isPremium`, espelhando o padrão já existente de `ANALYSIS_ADDENDUM`.
**Warning signs:** usuário free pede para lançar algo e o assistente responde com texto ambíguo em vez de recusar claramente e apontar para o upgrade. Nota: o guard `claimsWriteCompletion` (`fides-claude.jsx:642-646`, da Phase 12) já pega o caso extremo de o modelo *afirmar* ter executado sem ter chamado a ferramenta — mas ele reage depois do fato; o `FREE_TIER_ADDENDUM` prevê o problema.

### Pitfall 4: Duas cópias de mapa de erro amigável fora de sincronia
**What goes wrong:** `friendlyError` vive em `fides-claude.jsx:547-565` e `friendlyAiError` vive **separadamente** em `fides-orcamento.jsx:1017-1031` — não é um módulo compartilhado. Adicionar `FREE_MONTHLY_LIMIT`/`PREMIUM_REQUIRED` só em um dos dois deixa o outro caminho (chat OU "Análise da IA") sem mensagem amigável, caindo no fallback genérico.
**Why it happens:** os dois arquivos evoluíram em paralelo (histórico do projeto: WR-01/02/03 já tocaram os dois separadamente).
**How to avoid:** ao adicionar os novos `errCode`, editar as duas listas juntas — igual ao padrão que a Phase 11 já seguiu para WR-03 (JWT no header, "os 2 callers atualizados juntos").
**Warning signs:** grep por `FREE_MONTHLY_LIMIT` ou `PREMIUM_REQUIRED` deve retornar hits em ambos os arquivos antes do commit.

### Pitfall 5: Boundary de mês em UTC vs America/Sao_Paulo
**What goes wrong:** calcular "início do mês corrente" em UTC (`Date.UTC(y, m, 1)`) faz o cap resetar até 3h mais cedo/tarde que a meia-noite local de Brasília, dependendo do horário de verão.
**Why it happens:** o padrão existente do rate-limit diário (`api/assistant.js:228`) já usa `Date.now()`/`toISOString()` em UTC — é o caminho de menor atrito copiar o mesmo estilo.
**How to avoid:** aceitar a imprecisão de poucas horas como trade-off deliberado (é um cap de degustação, não uma cobrança financeira) e documentar a escolha — **não** introduzir uma dependência de timezone (`Intl.DateTimeFormat` com `America/Sao_Paulo`) só para isso, seria complexidade desproporcional ao risco.
**Warning signs:** nenhum — é uma decisão consciente de escopo, não um bug a caçar. Registrado aqui só para não ser "descoberto" como suposto bug durante o UAT.

## Runtime State Inventory

Não aplicável — esta fase não é rename/refactor/migração. Nenhuma tabela/coluna é renomeada; `profiles.plan` já existe com o nome e domínio finais (D-4).

## Code Examples

### Verificar plan + montar tools (ponto de integração completo)
```js
// Source: composição dos padrões existentes em api/assistant.js (auth, rate-limit, payload) — [VERIFIED: leitura direta do arquivo nesta sessão]
// Inserir logo após `const userId = userData.user.id;` (api/assistant.js:212), antes do bloco de rate-limit.

let plan = 'free';
try {
  const { data: profileRow, error: profileError } = await supabase
    .from('profiles').select('plan').eq('id', userId).single();
  if (!profileError && profileRow && typeof profileRow.plan === 'string') plan = profileRow.plan;
} catch (e) {
  console.error('[assistant] profile plan fetch exception', e);
}
const isPremium = plan === 'pro' || plan === 'family';

// GATE-03 (parte 1): Análise da IA é premium-only
if (isAnalysisMode && !isPremium) {
  res.status(403).json({ error: 'PREMIUM_REQUIRED', code: 403 });
  return;
}
```

### Front — expor tier no store (GATE-01)
```jsx
// Source: mesmo padrão dos dois pontos de select('name, group_targets') já existentes,
// fides-store.jsx:330 e :364 — [VERIFIED: leitura direta do arquivo nesta sessão]
const { data: profile } = await window.fidesDb
  .from('profiles')
  .select('name, group_targets, plan')   // + 'plan'
  .eq('id', user.id)
  .single();
if (mounted) {
  setUserName(profile?.name || '');
  setUserPlan(profile?.plan || 'free');   // novo estado, default fail-closed no client também
  // ...group_targets como já está
}
```
E no objeto `value` retornado pelo Provider (`fides-store.jsx:1370-1409`): adicionar `userPlan, isPremium: userPlan === 'pro' || userPlan === 'family',` — mesma allow-list do backend, por consistência.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `USER.plan:'Pro'` mock hardcoded (`fides-data.jsx:31`), nunca lido por componente vivo | `profiles.plan` real via store, lido em `api/assistant.js` e propagado ao front | Esta fase | Fecha o gap entre "código morto" e "gate real" — a mudança visível é pequena (o mock já não era consultado), a mudança de fundo é grande (agora existe gate de verdade) |
| Assistente trata todo usuário autenticado como igual (só rate-limit diário de 100 msg) | Assistente diferencia por tier: free = READ + cap 10/mês, premium = READ+WRITE + cap 100/dia | Esta fase | Primeira vez que o produto tem um "produto free" real dentro do assistente — antes, WRITE era global (Phase 12) ou inexistente (pré-Phase 12) |

**Deprecated/outdated:** o mock `USER` em `fides-data.jsx` (linha 31) fica ainda mais órfão após esta fase — nenhuma referência viva restante além da própria definição/export. Não é escopo desta fase remover o arquivo mock inteiro (usado por outros dados de demonstração/design-canvas), só confirmar que `USER.plan` não vaza para nenhum caminho live.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | A lista exata de colunas de `profiles` editáveis pelo client (`name`, `group_targets`) é completa — não há um terceiro campo hoje editável pelo usuário via client SDK que o REVOKE/GRANT de P1 esqueceria de re-conceder | Common Pitfalls P1, Don't Hand-Roll | Se houver mais um campo (ex. preferência de UI salva em `profiles`), o REVOKE quebraria silenciosamente esse update — checar todo grep de `.from('profiles').update(` antes de aplicar o REVOKE |
| A2 | A policy RLS real de `profiles` no banco live é idêntica à de `schema.sql:190-191` (`for all using`, sem `WITH CHECK`) | Summary, Common Pitfalls P1, Security Domain | `schema.sql` está comprovadamente desatualizado em outros pontos (`group_targets`, colunas de `transactions` — ROADMAP B10); se a policy live já tiver sido endurecida por fora do repo, o "achado crítico" pode já estar mitigado — **verificar via MCP Supabase ou dashboard antes de tratar P1 como bloqueante** |
| A3 | "1 mês calendário" (não rolling 30 dias) é a janela correta para o cap de degustação | Pattern 3, Pitfall 5 | Item explicitamente de discretion no CONTEXT — se o usuário preferir rolling 30d, a query muda de `gte(startOfMonth)` para `gte(now - 30d)`, mudança pequena mas precisa ser decidida no plan-phase/discuss, não assumida como fechada |
| A4 | Nenhum outro componente vivo além dos já grepados lê `USER.plan` ou `USER` de `fides-data.jsx` | State of the Art | Grep rodado nesta sessão cobriu `assets/*.jsx`; se houver leitura dinâmica (string concatenada, `window['USER']`) o grep não pega — baixo risco dado o estilo de código do projeto, mas não 100% descartado |

**Se a tabela acima tiver itens:** todos exigem confirmação leve (grep adicional ou consulta MCP) antes ou durante o plan-phase — nenhum bloqueia o início do planejamento, mas A1/A2 devem ser confirmados antes de escrever a migração SQL de P1.

## Open Questions

1. **A policy RLS de `profiles` no banco live é exatamente a de `schema.sql`?**
   - What we know: o arquivo `.sql` documenta `for all using (auth.uid() = id)` sem `WITH CHECK`, e o código (`updateProfile`, `setGroupTargets`) confirma que o client de fato faz `UPDATE` direto contra `profiles` sob essa policy.
   - What's unclear: se alguém já endureceu isso fora do repo (drift documentado em outros pontos do schema — ROADMAP B10) — não há como confirmar sem MCP Supabase, indisponível nesta sessão de pesquisa.
   - Recommendation: primeira ação do plan/execute desta fase (ou uma sub-task dedicada) deve confirmar a policy live antes de escrever a migração de P1 — se o MCP Supabase estiver disponível na sessão de planning/execução, usar `list_tables`/introspecção de policies; senão, checar no dashboard do Supabase (Authentication → Policies) manualmente.

2. **`assistant_usage` deveria gravar o `plan` no momento da chamada (snapshot) para auditoria?**
   - What we know: hoje a tabela não tem essa coluna; contar por `user_id` + janela de tempo funciona sem ela porque cada linha free é implicitamente "chat READ" (analysis é bloqueado antes do insert para free).
   - What's unclear: se telemetria futura (upsell, funil de conversão) vai querer saber "quantas mensagens o usuário mandou como free antes de virar premium" de forma histórica precisa — hoje isso só dá para inferir cruzando `assistant_usage.created_at` com o momento em que `profiles.plan` mudou (não registrado com timestamp de mudança).
   - Recommendation: fora de escopo desta fase (nenhum requirement pede isso); se motivar mais adiante, é uma coluna nova simples (`ALTER TABLE assistant_usage ADD COLUMN IF NOT EXISTS plan_at_call text`), não bloqueia GATE-01/02/03/PAYWALL-01.

3. **O placeholder de "tela de upgrade" (D-4/D-5 já resolvidos, mas o alvo do CTA é discretion) deveria já registrar interesse (ex. capturar email/"me avise")?**
   - What we know: checkout do M6 não existe; CONTEXT.md deixa aberto entre "em breve"/"notify-me"/link externo, e explicitamente instrui "não travar a entrega da fase nessa dependência".
   - What's unclear: se vale a pena, dentro do escopo desta fase, gravar um sinal mínimo de intenção (nem que seja um `console.log`/toast "anotado!" sem persistência) versus só mostrar copy estática.
   - Recommendation: o mais barato e alinhado ao "não travar a fase" é reusar `EmBreveModal` como está (sem captura de dado nenhum) — se o discuss-phase já não fechou isso, é uma pergunta rápida de 1 escolha múltipla para o usuário no plan-phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Supabase (Postgres + Auth + RLS) | GATE-01/02/03, correção de RLS (P1) | ✓ (já em produção) | — | — |
| Gemini API (`GEMINI_API_KEY`) | GATE-03 (tools condicionais) | ✓ (já em produção, Phase 11/12) | `gemini-2.5-flash-lite` (`api/_lib/gemini.js`) | — |
| MCP Supabase (introspecção live do schema/policies) | Confirmar A1/A2 antes de escrever a migração de P1 | ✗ nesta sessão de pesquisa | — | Verificar manualmente via Supabase Dashboard (SQL Editor / Authentication → Policies) antes de aplicar a migração; não bloqueia o restante da fase (GATE-01/02/03/PAYWALL-01 não dependem disso) |

**Missing dependencies with no fallback:** nenhuma.

**Missing dependencies with fallback:** MCP Supabase (fallback = inspeção manual via dashboard, documentado acima).

## Validation Architecture

> Projeto não tem test runner (sem bundler, sem Jest/Vitest — React via Babel-standalone; `api/` são functions Vercel sem harness). Verificação = inspeção estática (grep/leitura) + human-verify via `/gsd-verify-work`, mesmo padrão das Fases 11/12.

### Test Framework
| Property | Value |
|---|---|
| Framework | Nenhum (débito rastreado B11) |
| Config file | none |
| Quick run command | N/A — inspeção estática + human-verify |
| Full suite command | N/A |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| GATE-01 | Store seleciona `plan` de `profiles` e expõe `userPlan`/`isPremium` no contexto | static | grep `select('name, group_targets, plan'` em `fides-store.jsx` (2 ocorrências) | ❌ Wave 0 (grep manual, sem arquivo de teste) |
| GATE-01 | UI reflete o tier real (não mais o mock `Pro` fixo) | manual-only | `UPDATE profiles SET plan='free'` no dev (D-04) → recarregar app → UI mostra estado free | — |
| GATE-02 | Usuário free consegue exatamente 10 mensagens de chat READ no mês; a 11ª é bloqueada com paywall, não com erro genérico | manual-only | `UPDATE profiles SET plan='free'`; mandar 11 mensagens no chat; a 11ª deve responder `FREE_MONTHLY_LIMIT` com copy de paywall, não `USER_DAILY_LIMIT`/erro cru | — |
| GATE-02 | Cota mensal não conta 2x por causa de round-trip de tool (Pitfall 2) | manual-only | Como free, perguntar algo que dispara `consultar_saldo` (2 chamadas HTTP, 1 turno) → confirmar que só 1 linha nova aparece em `assistant_usage` (via SQL Editor) | — |
| GATE-03 | Free NÃO recebe tools WRITE — pedir "lança 50 no mercado" nunca abre card de confirmação, sempre recusa em texto | manual-only | Como free, pedir lançamento via chat → assistente explica que é premium, sem card de confirmação | — |
| GATE-03 | Free NÃO acessa "Análise da IA" (bloqueio server-side, não só front) | manual-only + static | Static: grep `PREMIUM_REQUIRED` cobre `fides-orcamento.jsx`; Manual: como free, forçar `mode:'analysis'` via `fetch` direto no console (bypassando a UI escondida) → deve voltar 403 | ❌ Wave 0 |
| GATE-03 | Premium mantém chat completo + WRITE + Análise da IA ilimitada dentro do cap diário de 100 | manual-only | `UPDATE profiles SET plan='pro'` → repetir os 2 fluxos acima → tudo funciona como na Phase 12 (regressão) | — |
| GATE-03 (defense-in-depth) | Chamar `wa_log_transaction` direto (bypass do front) como usuário free não deveria bastar para gravar — **verificar se este é o comportamento esperado dado D-01** | manual-only, resultado esperado documentado como gap aceito | Como free, no console: `window.fidesDb.rpc('wa_log_transaction', {...})` com payload válido → **esperado (D-01 aceito): a RPC grava mesmo assim**, porque D-01 explicitamente não gateia a RPC. Documentar esse resultado no UAT como comportamento conhecido/aceito, não como bug | — |
| P1 (RLS de `plan`) | Usuário autenticado NÃO consegue alterar o próprio `plan` via client SDK após a correção | manual-only | Como free, no console: `window.fidesDb.from('profiles').update({plan:'pro'}).eq('id', meuId)` → deve retornar erro de permissão (não deve alterar a linha) | — |
| PAYWALL-01 | Paywall aparece ao bater o cap/tentar WRITE, sem `confirm()`/`alert()` nativo | static | grep negativo: nenhum `confirm(`/`alert(` novo introduzido nos arquivos tocados | ❌ Wave 0 |

### Sampling Rate
- **Por commit:** inspeção estática dos grants acima (greps negativos/positivos, especialmente P1 e o addendum do prompt).
- **Gate de fase:** `/gsd-verify-work` conversacional cobrindo os 9 casos manuais acima em bloco (padrão do projeto — MEMORY `uat-batch-all-tests`), incluindo o teste de RLS (P1) que é o mais crítico e o mais fácil de esquecer.
- **Caminho sensível `api/` + `supabase/`:** `security-reviewer` + `database-reviewer` obrigatórios antes de qualquer commit tocando `api/assistant.js` ou a nova migração de privilégios de `profiles` (CLAUDE.md) — este é o phase com o maior peso de segurança do épico até aqui, porque decide dinheiro real (quem paga vs quem não paga).

### Wave 0 Gaps
Nenhuma infra de teste a criar (projeto sem runner por design, débito B11 já rastreado). Nenhum fixture novo — contas/cartões/categorias de dev já existem dos testes das Fases 11/12; o único dado novo necessário é alternar `profiles.plan` via SQL Editor (D-04), sem custo de setup.

## Security Domain

Caminhos `api/` e `supabase/` são sensíveis (CLAUDE.md) — `security-reviewer` + `database-reviewer` obrigatórios antes de commit desta fase inteira. Este phase é particularmente sensível porque, pela primeira vez no épico, o gate decide **quem paga** — um bypass aqui é perda de receita direta, não só um bug funcional.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | Não muda | `auth.getUser(jwt)` via header `Authorization: Bearer`, inalterado desde WR-03 (Phase 11) |
| V3 Session Management | Não muda | Sessão Supabase padrão, inalterada |
| V4 Access Control | **Sim — núcleo desta fase** | (a) `api/assistant.js` decide capacidade por tier lendo `profiles.plan` server-side (D-01); (b) RLS de `profiles` precisa de column-level privilege para impedir auto-escrita de `plan` (P1) — sem isso, V4 falha na origem: o próprio dado que decide o controle de acesso é editável pelo sujeito controlado |
| V5 Input Validation | Sim | `plan` lido do banco (não do request) — não há input de usuário a validar para a decisão de tier em si; o `mode` do request já é validado por whitelist (`isAnalysisMode = mode === 'analysis'`, herdado de WR-02) |
| V6 Cryptography | Não se aplica | Nenhum segredo novo nesta fase |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Self-elevation de privilégio via RLS sem `WITH CHECK` restritivo por coluna | Elevation of Privilege | REVOKE/GRANT column-level em `profiles.plan` (P1) — ver Common Pitfalls |
| Bypass do gate de tier chamando `/api/assistant` direto (fora da UI) com `mode:'analysis'` ou toolResults forjados | Elevation of Privilege / Tampering | Gate roda no servidor antes de qualquer chamada ao Gemini (Pattern 1/2) — a UI escondida é só a segunda camada (D-01); o nonce anti-replay de D-06 (Phase 12) já cobre o caso de `toolResults` forjado para pular o rate-limit, mas **não** cobre pular o gate de tier em si (o gate de tier roda sempre, `toolResults` ou não — confirmar isso explicitamente no code review) |
| Chamada direta à RPC `wa_log_transaction` por usuário free, sem passar pelo `api/assistant.js` | Elevation of Privilege | **Gap aceito por D-01** — a RPC não valida `plan` (fora de escopo desta fase por decisão do usuário). Documentar como risco residual conhecido, não como falha de implementação (ver Test Map, linha "GATE-03 defense-in-depth") |
| Corrida entre leitura de `plan` e um downgrade concorrente (usuário lê `plan='pro'`, é rebaixado no meio da sessão) | Tampering (baixo risco) | Não mitigar nesta fase — cada request relê `plan` do banco (sem cache), então o pior caso é 1 request "atrasada" em até a duração de uma chamada; irrelevante para um produto sem SLA de billing em tempo real |

## Sources

### Primary (HIGH confidence)
- Leitura direta do código-fonte nesta sessão (`api/assistant.js`, `assets/fides-store.jsx`, `assets/fides-claude.jsx`, `assets/fides-orcamento.jsx`, `assets/fides-studio.jsx`, `assets/fides-ui.jsx`, `assets/fides-data.jsx`, `supabase/schema.sql`, `supabase/wa-log-transaction.sql`) — todos os padrões de código citados são `[VERIFIED: leitura direta do arquivo nesta sessão]`, não memória de treino.
- `.planning/phases/13-ia-3-gating-premium-in-app/13-CONTEXT.md` — decisões travadas D-01..D-04 e discretion areas.
- `.planning/research/whatsapp-e-ia-arquitetura.md` §4, §B3, §B4, bloco "Decisões RESOLVIDAS 2026-07-06" — fonte da verdade de D-4/D-5/P-2 (research anterior, não re-decidido aqui).
- `.planning/phases/12-ia-2-destravar-write-no-assistente-in-app-b8/12-RESEARCH.md` — padrão de Validation Architecture/Security Domain seguido para consistência entre fases do mesmo épico.

### Secondary (MEDIUM confidence)
- [Supabase Docs — Column Level Security](https://supabase.com/docs/guides/database/postgres/column-level-security) — confirma o padrão `REVOKE UPDATE ON table FROM authenticated; GRANT UPDATE (col1, col2) ON table TO authenticated;` para restringir colunas editáveis sob RLS. Fonte oficial, consultada via WebSearch nesta sessão.
- [PostgreSQL Docs — Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) — confirma que uma policy `FOR ALL` só com `USING` (sem `WITH CHECK`) usa a mesma expressão como check implícito, e que RLS não restringe colunas.

### Tertiary (LOW confidence)
- Nenhuma — esta pesquisa não se apoiou em fontes não verificadas para nenhuma claim central. Itens de incerteza genuína estão documentados em `## Assumptions Log` e `## Open Questions`, não apresentados como fato.

## Metadata

**Confidence breakdown:**
- Standard stack / composição de código: HIGH — toda a mecânica (leitura de plan, split de tools, cota sobre `assistant_usage`) foi verificada lendo o código-fonte real nesta sessão, não assumida de memória.
- Arquitetura / gate server-side: HIGH — segue diretamente D-01/D-02/D-04 (decisões já travadas pelo usuário) compostas com padrões existentes (`isFirstCallOfTurn`, `ANALYSIS_ADDENDUM`, `TOOLS_DECLARATION`).
- RLS de `profiles.plan` (Pitfall 1 / Security Domain): MEDIUM — a policy documentada em `schema.sql` e o comportamento client-side (`updateProfile`/`setGroupTargets`) são consistentes e apontam para o mesmo gap, mas o banco live não foi confirmado via MCP Supabase nesta sessão (ROADMAP B10 já documenta que `schema.sql` diverge do live em outros pontos) — tratar como achado de alta prioridade a confirmar, não como fato 100% garantido sem checagem adicional (Open Question 1).
- Pitfalls / Common Pitfalls: HIGH — todos derivados de padrões já observados no histórico do próprio projeto (guards existentes em `fides-claude.jsx`, "Lições dos logs" do research anterior) ou de leitura direta do código atual.

**Research date:** 2026-07-15
**Valid until:** ~30 dias (stack estável — sem dependência de API externa nova; revalidar se o banco live divergir do `schema.sql` documentado aqui, especialmente a policy RLS de `profiles`)
