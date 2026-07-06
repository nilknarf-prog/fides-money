# Phase 11: IA-1 Hardening do assistente Gemini — Research

**Researched:** 2026-07-06
**Domain:** Hardening de superfície de IA (Gemini 2.5 Flash-Lite via Vercel Function CommonJS + React/Babel-standalone no front + Supabase)
**Confidence:** HIGH

## Summary

Este phase é **hardening puro** das duas superfícies de IA que já existem (chat `fides-claude.jsx` e botão "Análise da IA" em `fides-orcamento.jsx`), ambas só-leitura via `api/assistant.js`. Fecha as 3 dívidas do review da fase 05 (WR-01, WR-02, WR-03), extrai um módulo Gemini compartilhado (AI-SHARED-01) que o `api/whatsapp.js` da fase 14 vai reusar, e adiciona telemetria de tokens/latência (AI-TELEM-01) que os evals das fases 12–14 vão consumir. **Nenhum requisito adiciona WRITE, mexe em gating/premium ou troca de modelo** — tudo mantém só-leitura.

As duas incógnitas técnicas externas ficaram **resolvidas com fonte oficial**: (1) o campo Gemini para proibir tools é `toolConfig.functionCallingConfig.mode = 'NONE'` (camelCase no JSON REST v1beta), confirmado no proto oficial do `generativelanguage/v1beta`; (2) arquivos com prefixo `_` em `api/` **não** viram Serverless Functions na Vercel — `api/_lib/gemini.js` é a localização correta do helper, importável por `require('./_lib/gemini')`. As três mudanças restantes (cooldown, JWT header, telemetria) são portes diretos de padrões já existentes no próprio repositório, sem dependências novas.

Risco geral: **baixo**. Zero pacotes novos, zero mudança de contrato de dados do usuário, deploy atômico single-push (front + api sobem juntos, sem necessidade de compat retroativa). O único ponto de atenção estrutural é a ordem: AI-SHARED-01 (extração do helper) deve vir **antes** de WR-02 e AI-TELEM-01, porque ambos tocam exatamente o trecho de payload/parsing que o helper encapsula — fazer o helper primeiro evita retrabalho e divergência entre `api/assistant.js` e o futuro `api/whatsapp.js`.

**Primary recommendation:** Executar na ordem AI-SHARED-01 → WR-02 → WR-03 → AI-TELEM-01 → WR-01. Servidor primeiro (helper + toolConfig + JWT header + telemetria), front por último (cooldown do orçamento + os 2 callers migrados para header). Verificação por human-verify + inspeção estática (projeto não tem test runner — espelhar padrão da fase 05).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**WR-01 — throttle no "Análise da IA"**
- O `handleAiClick` (`fides-orcamento.jsx`) ganha o MESMO padrão de cooldown do chat (`fides-claude.jsx`: `COOLDOWN_NORMAL_SEC=4`, `COOLDOWN_RATELIMIT_SEC=60`). Duplo-tap no mobile não dispara 2ª chamada nem queima a cota de 100/dia.
- Reusar o mecanismo existente do chat onde possível, não inventar um novo.

**WR-02 — single-shot nunca morre em tool_calls**
- A chamada do "Análise da IA" passa a proibir tools na requisição (Gemini `toolConfig` com `functionCallingConfig.mode: 'NONE'`), então o modelo SEMPRE retorna texto — nunca `functionCall`. Elimina o caminho que hoje fecha com `GEMINI_ERROR` genérico gastando cota.
- Decisão travada: modo NONE (não executar round-trip READ agora). Round-trip de tools fica deferido. O chat conversacional MANTÉM suas tools READ — a proibição de tools é SÓ no caminho do botão de análise.

**WR-03 — JWT no header, não no body**
- Cliente envia o JWT em `Authorization: Bearer <token>`; o servidor `api/assistant.js` lê do header em vez de `req.body.jwt`. Os DOIS chamadores (`fides-claude.jsx` e `fides-orcamento.jsx`) são atualizados junto com o servidor — nenhum caller pode ficar mandando no body após a mudança.
- Compat retroativa NÃO é necessária (deploy é atômico via push single-file; front e api sobem juntos).

**AI-SHARED-01 — módulo Gemini compartilhado**
- Extrair um helper CommonJS único (payload builder + safetySettings + mapeamento de erros 429/400/502/EMPTY_REPLY) que `api/assistant.js` consome hoje e `api/whatsapp.js` vai consumir na Fase 14.
- **Restrição Vercel:** o helper NÃO pode virar um endpoint roteável. CommonJS obrigatório (nunca ESM). Escopo mínimo: extrair só o que é genuinamente comum. Não refatorar o handler inteiro.

**AI-TELEM-01 — telemetria de tokens**
- `assistant_usage` passa a gravar tokens de entrada/saída + latência por chamada. Fonte: `usageMetadata` da resposta Gemini (`promptTokenCount`, `candidatesTokenCount`) + medição de tempo no servidor.
- Migração via MCP `apply_migration` + espelho em `supabase/*.sql` com ALTER standalone `add column if not exists`. Colunas nullable (chamadas antigas ficam null, sem backfill).
- Objetivo: custo real por usuário observável. Não construir dashboard agora — só gravar o dado.

### Claude's Discretion
- Localização exata do helper compartilhado (`api/_lib/` vs `/lib` na raiz) — a decidir na pesquisa. **Resolvido nesta pesquisa: `api/_lib/gemini.js`** (ver AI-SHARED-01).
- Nomes das colunas de telemetria (sugestão do briefing: `prompt_tokens`, `completion_tokens`, `latency_ms`).
- Granularidade da extração do helper (o que é "genuinamente comum").

### Deferred Ideas (OUT OF SCOPE)
- Reativação das tools WRITE (`lancar_transacao` etc.) → Fase 12 (IA-2 / gate B8). IA-1 permanece só-leitura.
- Round-trip de execução de tools no "Análise da IA" (dados frescos) → quando houver necessidade; hoje mode NONE basta.
- Gating por `profiles.plan` / degustação free → Fase 13 (IA-3).
- Dashboard/relatório de custo a partir da telemetria → fora do escopo; IA-1 só grava o dado.
- Troca de modelo (Haiku/DeepSeek) → rejeitado no design (§B2).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Descrição | Research Support |
|----|-----------|------------------|
| WR-01 | Throttle/cooldown no botão "Análise da IA" | Padrão de cooldown extraído de `fides-claude.jsx:9-11,84-91,507-552`; porte para `handleAiClick` documentado abaixo |
| WR-02 | Single-shot proíbe tools via `toolConfig.mode=NONE` | Campo Gemini confirmado por doc oficial v1beta; ponto de injeção mapeado (`api/assistant.js:186-201`) |
| WR-03 | JWT em `Authorization: Bearer`, não no body | 3 pontos de mudança mapeados (servidor + 2 callers) abaixo |
| AI-SHARED-01 | Helper Gemini CommonJS compartilhado | Convenção Vercel `api/_lib/` confirmada por doc oficial; superfície de extração definida |
| AI-TELEM-01 | `assistant_usage` grava tokens + latência | `usageMetadata` já disponível no `geminiData`; ALTER pattern espelhado de `schema.sql:94-101` |
</phase_requirements>

## Standard Stack

**Nenhum pacote novo.** Este phase não instala dependências — é hardening de código existente. A stack em jogo já está no repositório:

| Componente | Versão/Fonte | Papel | Anchor |
|------------|--------------|-------|--------|
| `@supabase/supabase-js` | já em `package.json` | Validação JWT (`auth.getUser`), insert `assistant_usage` | `api/assistant.js:6` |
| Gemini API REST | `generativelanguage.googleapis.com/v1beta` | `generateContent` (Flash-Lite) | `api/assistant.js:8-9` |
| React via Babel-standalone | no browser, sem build | UI dos 2 callers | `fides-claude.jsx`, `fides-orcamento.jsx` |
| Vercel Functions | CommonJS, zero-config | Roteamento `api/*.js` | `api/assistant.js:93` |

**Seção Package Legitimacy Audit:** N/A — nenhum pacote externo instalado neste phase. (Gate de legitimidade dispensado por ausência de novos `require` de terceiros.)

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cooldown/throttle (WR-01) | Browser / Client (`fides-orcamento.jsx`) | — | Proteção UX de duplo-tap é responsabilidade do cliente; o servidor já tem rate limit de cota (`assistant_usage`) como segunda camada |
| Proibir tools (WR-02) | API / Backend (`api/assistant.js`) | — | O payload Gemini é montado no servidor; o front nunca vê `toolConfig` |
| Transporte do JWT (WR-03) | API + Client (ambos) | — | Contrato de transporte: servidor lê header, os 2 callers montam header. Mudança atômica em ambos os tiers |
| Helper compartilhado (AI-SHARED-01) | API / Backend (`api/_lib/`) | — | Módulo server-side puro, sem superfície HTTP |
| Telemetria (AI-TELEM-01) | API / Backend + Database | Database (`assistant_usage`) | Servidor lê `usageMetadata` e grava; schema no Postgres |

## Requisito por requisito

### WR-01 — Throttle no "Análise da IA"

**Abordagem recomendada:** portar o mecanismo de cooldown do chat para `PlnMesInsights`, adaptando de "chat multi-turn" para "clique único". O botão de análise é single-shot — não há histórico nem `MAX_TOOL_ITERATIONS` — então o porte é mais simples que o original.

**Padrão canônico a reusar (`fides-claude.jsx`):**
- Constantes: `COOLDOWN_NORMAL_SEC = 4`, `COOLDOWN_RATELIMIT_SEC = 60` (`fides-claude.jsx:9-10`). **Não redeclarar novas** — se possível expor as mesmas; se o escopo de módulo não permitir compartilhar entre os dois `.jsx` (são componentes separados carregados via Babel-standalone), replicar os MESMOS valores com o mesmo nome para não divergir.
- Estado: `const [cooldown, setCooldown] = React.useState(0)` (`fides-claude.jsx:49`). No `fides-orcamento.jsx` o padrão local usa array indexado (`var stX = React.useState(...); var x = stX[0]; var setX = stX[1];` — ver `fides-orcamento.jsx:986-993`). **Seguir o padrão local do arquivo de destino**, não o de origem.
- Countdown effect: decremento de 1s via `setTimeout` (`fides-claude.jsx:84-91`):
  ```js
  React.useEffect(function () {
    if (cooldown <= 0) return;
    var t = setTimeout(function () { setCooldown(function (c) { return Math.max(0, c - 1); }); }, 1000);
    return function () { clearTimeout(t); };
  }, [cooldown]);
  ```
- Guarda de entrada: `if (aiLoading || cooldown > 0) return;` no início de `handleAiClick` (`fides-orcamento.jsx:1037` hoje só checa `aiLoading`).
- Re-arme nos caminhos terminais: no chat, `setCooldown(COOLDOWN_NORMAL_SEC)` é chamado em TODOS os caminhos de saída (`fides-claude.jsx:507,511,515,533,539,546,552`) e `COOLDOWN_RATELIMIT_SEC` nos caminhos 429. No `handleAiClick` os caminhos terminais são: sucesso (`:1090-1091`), erro `!res.ok` (`:1069-1072`), tool_calls (`:1075-1081` — que WR-02 vai eliminar), empty reply (`:1084-1088`), catch NETWORK (`:1092-1095`). **Cada um deve armar o cooldown.**
- Rate-limit longo: quando `data.error === 'USER_DAILY_LIMIT'` (status 429), usar `COOLDOWN_RATELIMIT_SEC` (60s) como o chat faz em `:504-512`, não os 4s normais.

**Armadilhas:**
- **Rules of Hooks (CLAUDE.md + bug histórico da fase 07):** `PlnMesInsights` é um componente function; o novo `React.useState`/`React.useEffect` devem ficar no topo do corpo do componente (junto de `:986-993`), nunca dentro de `handleAiClick` nem condicionalmente.
- **IN-01 da fase 05 (débito conhecido):** `setAiLoading(false)` já está duplicado em 5+ caminhos de saída. Adicionar `setCooldown` a cada um multiplica o risco de esquecer um. Considerar (discrição do planner) centralizar cleanup num helper `finish()` ou `try/finally` — mas isso é refactor além do escopo mínimo; a versão segura é adicionar em cada caminho e verificar por inspeção.
- Botão: `disabled: aiLoading` (`:1131`) vira `disabled: aiLoading || cooldown > 0`. Opcional: mostrar `Aguarde {cooldown}s` como o chat (`fides-claude.jsx:711`).
- Não introduzir `rateLimitMode` a menos que se queira o texto de countdown — o mínimo travado é: bloquear reclique por N segundos.

**Verificável por:** inspeção estática (todos os caminhos terminais armam cooldown; guarda no topo) + human-verify (clicar 2× rápido → 2ª não dispara; erro 429 → espera 60s).

---

### WR-02 — Single-shot proíbe tools (`toolConfig.mode = NONE`)

**Abordagem recomendada:** adicionar `toolConfig` ao `geminiPayload` **apenas no caminho da análise single-shot**, mantendo as tools READ ativas no chat. Como hoje há UM servidor (`api/assistant.js`) servindo os dois callers, o servidor precisa distinguir "modo análise" de "modo chat". Recomendação: o caller de análise envia um flag (ex.: `mode: 'analysis'` ou `noTools: true` no body) e o servidor aplica `toolConfig` + omite/neutraliza `tools` quando presente.

**Campo exato (confirmado — doc oficial Gemini v1beta):**
```json
{
  "toolConfig": {
    "functionCallingConfig": { "mode": "NONE" }
  }
}
```
- `mode: 'NONE'` → o modelo **nunca** emite `functionCall`, sempre retorna texto — mesmo com `tools` declaradas. Modos: `AUTO` (modelo decide), `ANY` (obrigado a chamar), `NONE` (proibido). [CITED: ai.google.dev/api/generate-content + proto `generativelanguage/v1beta/generative_service.proto`]
- Nome do campo em camelCase no JSON REST v1beta: `toolConfig` → `functionCallingConfig` → `mode`. (O SDK Python usa snake_case `tool_config`/`function_calling_config`; no REST cru que este projeto usa é camelCase, consistente com `systemInstruction`/`generationConfig`/`safetySettings` já presentes.) [VERIFIED: doc oficial + payload atual `api/assistant.js:186-201` usa camelCase]

**Ponto de injeção (`api/assistant.js:186-201`):** o objeto `geminiPayload` hoje inclui incondicionalmente `tools: TOOLS_DECLARATION` (`:189`). No modo análise:
- Opção A (recomendada): **omitir** `tools` E setar `toolConfig.functionCallingConfig.mode = 'NONE'`. Omitir tools já basta para o modelo não ter o que chamar; o `toolConfig NONE` é o cinto+suspensório travado no CONTEXT.
- Opção B: manter `tools` e apenas `toolConfig: { functionCallingConfig: { mode: 'NONE' } }`. Válido tecnicamente, mas gasta tokens de input declarando tools que nunca serão usadas.
- **Decisão travada no CONTEXT:** mode NONE. Combinar com omissão de tools (Opção A) é o mais econômico e igualmente correto.

**Efeito colateral positivo:** o bloco `if (toolCalls.length > 0) { res.json({ tool_calls }) }` (`api/assistant.js:241-244`) nunca é atingido no modo análise → o caminho que hoje fecha com `GEMINI_ERROR` no front (`fides-orcamento.jsx:1075-1081`) vira **código morto** e pode ser removido do `handleAiClick`.

**Armadilhas:**
- Não aplicar `toolConfig NONE` globalmente — o chat (`fides-claude.jsx`) **depende** das tools READ (`consultar_saldo`/`consultar_extrato`). A distinção modo-análise vs modo-chat é obrigatória. Se o servidor não receber o flag, default = comportamento atual (chat com tools).
- `EMPTY_REPLY` ainda é possível se `finishReason` for `SAFETY`/`MAX_TOKENS` — WR-02 elimina o caminho `tool_calls`, não o `EMPTY_REPLY`. O cooldown do WR-01 cobre o reclique nesse caso.
- Interação com AI-SHARED-01: se o helper montar o payload, o parâmetro `noTools`/`mode` deve ser um argumento do builder — por isso **AI-SHARED-01 vem antes** (ver ordem).

**Verificável por:** inspeção estática (payload de análise contém `toolConfig.functionCallingConfig.mode='NONE'` e não contém `tools`, ou o servidor ramifica pelo flag) + human-verify (clicar "Análise da IA" várias vezes → sempre retorna texto de análise, nunca a mensagem "temporariamente indisponível").

---

### WR-03 — JWT em `Authorization: Bearer` (não no body)

**Abordagem recomendada:** mover o token do corpo JSON para o header `Authorization`. Mudança atômica em 3 arquivos (sem compat retroativa — deploy single-push).

**Ponto (a) — servidor lê hoje do body (`api/assistant.js:100-108`):**
```js
const { messages, context, jwt, toolResults } = req.body || {};   // :100
...
if (!jwt || typeof jwt !== 'string') { res.status(401)... }        // :105-108
```
**Passa a ler do header:**
```js
const authHeader = req.headers.authorization || '';
const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
```
Remover `jwt` da desestruturação de `req.body` (`:100`). O restante da validação (`supabase.auth.getUser(jwt)` em `:120`) **não muda** — só muda de ONDE o token vem (confirmado no CONTEXT: `getUser` aceita o token, a validação é idêntica).

**Ponto (b) — caller chat (`fides-claude.jsx:454-463`):**
```js
const res = await fetch('/api/assistant', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },   // :456
  body: JSON.stringify({ messages, context, jwt, toolResults }),  // :457-462 — remover jwt daqui
});
```
Passa a:
```js
headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt },
body: JSON.stringify({ messages: history, context: ctx, toolResults: toolResults || null }),
```
O `jwt` já é obtido em `send()` via `window.fidesAuth.getSession()` (`:479-483`) e passado a `callAssistant(history, toolResults, jwt)` (`:499`) — a assinatura da função pode manter `jwt` como parâmetro; só muda o destino (header em vez de body).

**Ponto (c) — caller análise (`fides-orcamento.jsx:1056-1065`):**
```js
var res = await fetch('/api/assistant', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },   // :1058
  body: JSON.stringify({ messages: [...], context: buildAiContext(), jwt: jwt, toolResults: null }),  // :1059-1064 — remover jwt: jwt
});
```
Passa a:
```js
headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt },
body: JSON.stringify({ messages: [...], context: buildAiContext(), toolResults: null, mode: 'analysis' }),
```
(O `mode: 'analysis'` aqui é o flag do WR-02, se essa for a via escolhida.)

**Armadilhas:**
- **Atomicidade:** se o servidor passar a exigir header e algum caller ainda mandar no body, aquele caller quebra com 401. Os DOIS callers e o servidor devem ir no mesmo commit/deploy. O CONTEXT confirma: deploy atômico, sem compat.
- **Não logar o header:** `console.error` no servidor não deve incluir `req.headers` cru (o Authorization vazaria o token nos logs Vercel). Os logs atuais (`:139,150,211,248,256`) logam erros do Supabase/Gemini, não headers — manter assim.
- Vercel entrega `req.headers.authorization` em minúsculas (Node normaliza header keys para lowercase). Usar `req.headers.authorization`, não `req.headers.Authorization`.
- Erro `JWT_MISSING` (`:106`) permanece — apenas a fonte muda.

**Segurança (por que header > body):** ver seção `## Security Domain`.

**Verificável por:** inspeção estática (nenhum dos 3 arquivos referencia `req.body.jwt`/`jwt:` no body após a mudança; ambos os callers montam `Authorization`) + human-verify (chat e análise continuam funcionando autenticados; DevTools Network mostra token no header, não no payload).

---

### AI-SHARED-01 — Módulo Gemini compartilhado (CommonJS)

**Localização recomendada (RESOLVIDO):** `api/_lib/gemini.js`.

**Justificativa (confirmada — doc oficial Vercel):** arquivos e diretórios com prefixo `_` dentro de `api/` **não** são registrados como Serverless Functions — a lógica de detecção da Vercel exclui qualquer caminho que contenha `/_`. Portanto `api/_lib/gemini.js` NÃO vira endpoint roteável (requisito travado no CONTEXT), e é importável por `require('./_lib/gemini')` a partir de `api/assistant.js`. [CITED: vercel/vercel Discussion #4983 — "Files and directories that start with an underscore are not turned into Serverless Functions"; corroborado por vercel/community Discussion #46]
- Alternativa `/lib` na raiz (fora de `api/`): também funciona (require `'../lib/gemini'`), mas `api/_lib/` é a convenção idiomática Vercel e mantém o código de IA colocalizado com as funções que o usam. **Recomendação: `api/_lib/gemini.js`.**
- **CommonJS obrigatório** (regra do projeto): `module.exports = { ... }` + `require(...)`. Nunca `import`/`export`.

**Superfície de extração (escopo mínimo — "só o que é genuinamente comum"):** o que `api/assistant.js` faz hoje e `api/whatsapp.js` vai reusar:
1. **Constantes de modelo/endpoint** (`api/assistant.js:8-9`): `GEMINI_MODEL`, `GEMINI_ENDPOINT`.
2. **Builder de payload** — `systemInstruction` + `contents` + `generationConfig` + `safetySettings` (`:186-201`), parametrizando: system prompt, contents, e o novo `toolConfig`/`tools` (para o WhatsApp da fase 14 usar structured output em vez de tools — ver §5 do research do épico).
3. **`safetySettings`** (`:195-200`) — bloco idêntico reusável.
4. **Chamada `fetch` + mapeamento de erro** (`:203-222`): 429→`RATE_LIMIT`, 400→`GEMINI_BAD_REQUEST`, outros→`GEMINI_ERROR`. Retornar um resultado normalizado (`{ ok, status, errorCode, data }`) em vez de escrever no `res` (o handler HTTP fica no caller).
5. **Parsing da resposta** (`:224-251`): extrair `candidate`, `parts`, separar `toolCalls`/`textReply`, detectar `EMPTY_REPLY`/`finishReason`. **Aqui também nasce o ponto de leitura do `usageMetadata` (AI-TELEM-01)** — o parser deve retornar `usageMetadata` junto.

**O que NÃO extrair (fica no handler `api/assistant.js`):**
- Validação JWT / `createClient` / `auth.getUser` (`:110-125`) — específico do handler autenticado; o webhook WhatsApp usa HMAC + service role, contrato diferente.
- Rate limit `assistant_usage` (`:127-152`) — lógica de cota específica.
- `SYSTEM_PROMPT` e `TOOLS_DECLARATION` (`:14-91`) — conteúdo do assistente in-app; o WhatsApp terá o seu (structured output). Podem ficar no handler e ser passados ao builder como argumentos.

**Assinatura sugerida do helper (design, não implementação):**
```
module.exports = {
  GEMINI_MODEL, GEMINI_ENDPOINT,
  buildPayload({ systemPrompt, contents, tools, toolMode, generationConfig }),  // toolMode: 'AUTO'|'NONE'
  callGemini(payload, apiKey),          // → { ok, status, errorCode, data }
  parseResponse(geminiData),            // → { toolCalls, textReply, finishReason, usageMetadata }
};
```

**Armadilhas:**
- Não refatorar o handler inteiro (escopo travado "mínimo"). O helper é builder+call+parse; o fluxo HTTP/auth/rate-limit continua em `api/assistant.js`.
- Manter os nomes de `errorCode` idênticos aos atuais (`RATE_LIMIT`, `GEMINI_BAD_REQUEST`, `GEMINI_ERROR`, `EMPTY_REPLY`) — o `friendlyError`/`friendlyAiError` dos dois fronts mapeia esses códigos (`fides-orcamento.jsx:1001-1015`). Renomear quebraria os fronts silenciosamente.
- `toolConfig` (WR-02) deve entrar como parâmetro do `buildPayload` (`toolMode`) — por isso o helper vem **antes** do WR-02 na ordem.
- `usageMetadata` no `parseResponse` deve ser tolerante a ausência (chamadas de erro não têm) — retornar `null` se ausente, para o insert nullable do AI-TELEM-01.

**Verificável por:** inspeção estática (`api/_lib/gemini.js` existe, é `require`d por `api/assistant.js`, não tem `module.exports = async (req,res)` de handler; nenhum endpoint `/api/_lib/...` novo) + human-verify (chat e análise seguem idênticos após a extração — comportamento inalterado, é refactor puro).

---

### AI-TELEM-01 — Telemetria de tokens em `assistant_usage`

**Estado atual da tabela (ACHADO IMPORTANTE):** `assistant_usage` **NÃO existe em nenhum arquivo `.sql`** do repositório. `grep` em `supabase/*.sql` retornou zero matches; a tabela é usada em `api/assistant.js:132-148` (`.from('assistant_usage')` com colunas `id`, `user_id`, `created_at`) mas foi criada **direto no banco via MCP**, sem espelho. Isto é consistente com o débito B10 do CLAUDE.md ("schema real vive no banco; `supabase/*.sql` pode estar desatualizado — a verdade é o MCP"). [VERIFIED: grep repo — nenhum `.sql` define a tabela]

**Implicação:** o plano precisa (a) rodar `apply_migration` via MCP Supabase para os ALTERs, E (b) criar/atualizar o espelho `.sql`. Como não há espelho da tabela, recomenda-se adicionar a `supabase/schema.sql` tanto um `create table if not exists public.assistant_usage (...)` defensivo (documentando a estrutura real) quanto os ALTERs — seguindo o padrão idempotente já usado em `schema.sql:94-101,96-101` (comentário literal no arquivo: *"`create table if not exists` above does NOT add columns"*, exatamente o learning registrado na MEMORY).

**ALTER standalone proposto (colunas nullable, sem backfill):**
```sql
-- assistant_usage: telemetria de custo (AI-TELEM-01). Colunas nullable — chamadas antigas ficam null.
alter table public.assistant_usage add column if not exists prompt_tokens     int;
alter table public.assistant_usage add column if not exists completion_tokens int;
alter table public.assistant_usage add column if not exists latency_ms        int;
```
(Nomes sugeridos no briefing; discrição do planner para ajustar. `prompt_tokens`/`completion_tokens` são a nomenclatura convencional de billing de LLM.)

**Leitura da fonte (`usageMetadata`):** a resposta Gemini inclui `usageMetadata` no corpo — já disponível no `geminiData` parseado em `api/assistant.js:224`, apenas não lido hoje. Campos:
- `geminiData.usageMetadata.promptTokenCount` → `prompt_tokens`
- `geminiData.usageMetadata.candidatesTokenCount` → `completion_tokens`
- (`totalTokenCount` também existe, redundante = soma dos dois; não precisa gravar)

**Latência:** medir no servidor. `const t0 = Date.now()` imediatamente antes do `fetch` Gemini (`:203`); `latency_ms = Date.now() - t0` após a resposta. Cobre só a chamada Gemini (o que interessa para custo/performance do modelo), não o overhead de auth/rate-limit.

**Onde gravar — ATENÇÃO ao fluxo atual:** hoje o insert em `assistant_usage` acontece **ANTES** da chamada Gemini (`:146-148`), no bloco de rate limit, e só no `isFirstCallOfTurn`. Nesse momento os tokens/latência **ainda não existem** (a chamada Gemini nem rodou). Duas opções:
- **Opção A (recomendada):** manter o insert de contagem atual (rate limit) como está, e fazer um **UPDATE** da mesma linha após a resposta Gemini com os tokens/latência. Exige capturar o `id` retornado do insert (`.insert({user_id}).select('id').single()`).
- **Opção B:** mover o insert para depois da resposta Gemini. **Não recomendado** — quebraria a semântica de rate limit (a linha precisa existir antes para contar cota mesmo se o Gemini falhar; fail-open depende disso).
- **Opção A** preserva o rate limit e adiciona telemetria sem regressão. Se a chamada Gemini falhar, a linha fica com tokens null (aceitável — colunas nullable, sem backfill, exatamente o travado).

**Espelho `.sql`:** `supabase/schema.sql` (arquivo principal de schema; onde os ALTERs de `goals`/`profiles` já vivem, `:94-101`). Alternativamente um arquivo dedicado `supabase/assistant-usage-telemetry.sql` seguindo o padrão de arquivos avulsos do projeto (`category-limits.sql`, `derived-balance.sql`). **Recomendação: adicionar ao `schema.sql`** para consolidar, já que a tabela sequer tinha espelho.

**Armadilhas:**
- **Learning MEMORY (supabase-schema-alter-not-create):** `create table if not exists` NÃO adiciona colunas a tabela existente. Os ALTERs standalone são obrigatórios; não confiar num `create table` reescrito.
- MCP `apply_migration` é a via de aplicação real (schema vive no banco); o `.sql` é só espelho/documentação. Ambos precisam ser feitos.
- Não construir dashboard nem query de agregação — escopo travado é **só gravar o dado**.
- Insert→update adiciona uma round-trip ao Supabase por chamada; latência trivial (mesmo região), aceitável.
- Se optar por Opção A, o `insertError` atual é fail-open (`:149-151`) — o update também deve ser fail-open (telemetria nunca deve derrubar a resposta ao usuário).

**Verificável por:** inspeção estática (ALTERs no `.sql`; leitura de `usageMetadata` + `Date.now()` no servidor; update fail-open) + human-verify via MCP (`SELECT prompt_tokens, completion_tokens, latency_ms FROM assistant_usage ORDER BY created_at DESC LIMIT 5` → linhas recentes têm valores não-null após uma chamada real).

## Ordem de implementação e dependências

```
AI-SHARED-01  ──►  WR-02  ──►  AI-TELEM-01
  (helper)         (toolMode)   (parseResponse retorna usageMetadata)
     │
     └──►  WR-03 (servidor lê header; toca o mesmo handler)
                    │
                    └──►  WR-01 (front: cooldown no orçamento) ── e migração dos 2 callers p/ header
```

**Justificativa da ordem:**
1. **AI-SHARED-01 primeiro.** WR-02 (toolConfig) e AI-TELEM-01 (usageMetadata) tocam exatamente o `buildPayload`/`parseResponse` que o helper encapsula. Extrair o helper depois de já ter modificado esses trechos = retrabalho + risco de divergência com o futuro `api/whatsapp.js`. Fazer o helper primeiro, com os pontos de extensão (`toolMode`, `usageMetadata`) já previstos.
2. **WR-02 depois do helper.** `toolMode: 'NONE'` entra como parâmetro do `buildPayload`.
3. **WR-03 em paralelo/depois** no servidor (independente do payload; só muda leitura do JWT). Pode ir junto do helper já que ambos tocam `api/assistant.js`.
4. **AI-TELEM-01 depois do parseResponse** existir (o helper retorna `usageMetadata`).
5. **WR-01 por último** — é só front (`fides-orcamento.jsx`), sem dependência do servidor. Naturalmente agrupa com a migração dos callers para header (WR-03 lado cliente), pois ambos editam o `fetch` do `handleAiClick`.

**Agrupamento sugerido para o planner (2 frentes):**
- **Frente servidor** (`api/`): AI-SHARED-01 + WR-02 + WR-03(servidor) + AI-TELEM-01. Um caminho sensível (`api/`) → `security-reviewer` + `database-reviewer` antes do commit (CLAUDE.md).
- **Frente cliente** (`assets/`): WR-01 (cooldown orçamento) + WR-03(callers → header) nos dois `.jsx`. Deploy atômico com a frente servidor (WR-03 exige simultaneidade).

## Validation Architecture

> Este projeto **não tem test runner** (sem bundler, sem Jest/Vitest — React via Babel-standalone no browser; `api/` são functions Vercel sem harness de teste). Verificação = **human-verify + inspeção estática**, espelhando o padrão da fase 05 (`05-REVIEW.md`: revisão manual dos arquivos + checagem cruzada contra o servidor). O nyquist aqui é: cada requisito tem um critério estático (grep/leitura) E um critério observável (clicar/consultar).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Nenhum (sem test runner no projeto) |
| Config file | none |
| Quick run command | N/A — verificação por inspeção estática + human-verify |
| Full suite command | N/A |

### Phase Requirements → Verification Map
| Req | Critério estático (inspeção) | Critério observável (human-verify) |
|-----|------------------------------|-------------------------------------|
| WR-01 | Todos os caminhos terminais de `handleAiClick` armam `setCooldown`; guarda `cooldown > 0` no topo; hook no topo do componente | Clicar "Análise da IA" 2× rápido → 2ª não dispara; botão mostra desabilitado por ~4s; erro 429 → ~60s |
| WR-02 | Payload de análise tem `toolConfig.functionCallingConfig.mode='NONE'` e não tem `tools`; caminho `tool_calls` removido do `handleAiClick` | Clicar análise 10× → sempre texto de análise, nunca "temporariamente indisponível" |
| WR-03 | Nenhum dos 3 arquivos referencia `req.body.jwt` / `jwt:` no body; 2 callers montam `Authorization: Bearer`; servidor lê `req.headers.authorization` | Chat + análise funcionam autenticados; DevTools → token no header, ausente do payload |
| AI-SHARED-01 | `api/_lib/gemini.js` existe, `require`d por `assistant.js`, sem handler `(req,res)`; nenhum endpoint novo | Chat + análise idênticos ao anterior (refactor sem mudança de comportamento) |
| AI-TELEM-01 | ALTERs `add column if not exists` no `.sql`; leitura de `usageMetadata` + `Date.now()`; update fail-open | MCP `SELECT ... FROM assistant_usage ORDER BY created_at DESC LIMIT 5` → tokens/latência não-null após chamada real |

### Sampling / Gate
- **Por commit:** inspeção estática do diff (grep dos critérios acima).
- **Gate de fase:** `/gsd-verify-work` conversacional cobrindo os 5 critérios observáveis (padrão UAT do projeto: apresentar todos os testes em bloco — MEMORY `uat-batch-all-tests`).
- **Caminho sensível `api/`:** `security-reviewer` + `database-reviewer` antes do commit (CLAUDE.md), especialmente para WR-03 (JWT) e AI-TELEM-01 (schema).

### Wave 0 Gaps
- Nenhuma infra de teste a criar (projeto sem runner por design — débito B11 rastreado). Verificação é human-verify; não introduzir framework de teste neste phase (fora de escopo).

## Security Domain

Caminho `api/` é sensível (CLAUDE.md): rodar `security-reviewer` antes do commit. Hook do repo injeta lembrete automático nesses paths.

### WR-03 — por que JWT em header é melhor que no body

| Vetor | JWT no body (hoje) | JWT no header `Authorization` (alvo) |
|-------|--------------------|--------------------------------------|
| Logging acidental | Request bodies são frequentemente logados por middleware/analytics/proxies → token de sessão Supabase ativo vaza para logs | Convenção universal trata `Authorization` como sensível; menos capturado por logging genérico |
| Caching/proxy | Corpo POST pode ser inspecionado/armazenado por camadas intermediárias | Headers de auth são o canal esperado; ferramentas os tratam como secretos |
| Padrão | Não-idiomático; inconsistente com o resto do ecossistema | Padrão HTTP (RFC 6750 Bearer) — o que `supabase.auth` já espera internamente |

(Origem: `05-REVIEW.md:96-101` WR-03 — "Tokens em request bodies são mais prováveis de serem capturados por request-logging/analytics middleware e proxies que um header Authorization; o valor é um token de sessão Supabase ativo".)

### Regras de segurança para este phase
| Ameaça | STRIDE | Mitigação |
|--------|--------|-----------|
| Vazamento de token em logs | Information Disclosure | Nunca `console.log(req.headers)` cru; logar só `errorCode`/status (padrão atual mantido) |
| Token de sessão em body (WR-03) | Information Disclosure | Mover para header `Authorization: Bearer`; remover de todos os bodies |
| Exposição via telemetria | Information Disclosure | `assistant_usage` grava só contagens de token + latência + `user_id` — **nunca** o texto do prompt/resposta (minimização; consistente com §9 LGPD do research do épico) |
| Escalada de privilégio | Elevation of Privilege | IA-1 mantém só-leitura; nenhuma tool WRITE reativada; `toolConfig NONE` reduz superfície no caminho de análise |
| Injeção via output do modelo | Tampering | Já mitigado na fase 05 — output renderizado como text nodes React (`split('\n').map`), sem `dangerouslySetInnerHTML` (`05-REVIEW.md:28`). WR-01/WR-02 não alteram a renderização |

### ASVS aplicável ao stack
| Categoria ASVS | Aplica | Controle |
|----------------|--------|----------|
| V2 Authentication | sim | `supabase.auth.getUser(jwt)` — inalterado; só muda transporte (WR-03) |
| V3 Session Management | sim | Token de sessão Supabase; mover para header (WR-03) reduz exposição |
| V5 Input Validation | sim | Validação de `messages` array (`:101`) mantida; novo flag `mode` deve ser validado (whitelist `'analysis'`) |
| V7 Logging | sim | Não logar tokens; telemetria sem dados pessoais/prompt |
| V9 Communication | sim | HTTPS (Vercel default); Bearer token em header |

## Environment Availability

| Dependência | Requerida por | Disponível | Versão | Fallback |
|-------------|---------------|------------|--------|----------|
| MCP Supabase | AI-TELEM-01 (`apply_migration`, verificar schema) | ✓ (usado no projeto) | — | — |
| Gemini API (`GEMINI_API_KEY`) | Todas (endpoint em produção) | ✓ (env Vercel Project) | v1beta | — |
| Vercel deploy (push→main) | Deploy atômico WR-03 | ✓ | — | — |

Sem dependências novas a instalar. Nenhuma dependência bloqueante ausente.

## Runtime State Inventory

> Este phase é hardening de código, não rename/refactor de strings. A única mutação de estado runtime é a de schema (AI-TELEM-01), coberta abaixo.

| Categoria | Itens encontrados | Ação |
|-----------|-------------------|------|
| Stored data | Tabela `assistant_usage` existe no banco (via MCP), **sem espelho `.sql`** | Adicionar colunas via `apply_migration` + criar espelho em `schema.sql` |
| Live service config | Nenhuma — sem workflows externos/cron tocando IA | None — verificado por ausência de referências |
| OS-registered state | Nenhum | None |
| Secrets/env vars | `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_*` — inalterados (só muda ONDE o JWT do usuário trafega, não os segredos de servidor) | None |
| Build artifacts | Nenhum (sem build step; Babel-standalone no browser) | None |

## State of the Art

| Abordagem antiga | Abordagem atual | Impacto |
|------------------|-----------------|---------|
| JWT no corpo do POST | `Authorization: Bearer` (WR-03) | Menos exposição em logs |
| Single-shot com `tools` sempre ativas → morre em `tool_calls` | `toolConfig.functionCallingConfig.mode='NONE'` no caminho análise | Elimina falha frequente que gastava cota (WR-02) |
| `assistant_usage` só conta chamadas | + tokens in/out + latência | Custo real por usuário observável (base evals fases 12–14) |
| Payload Gemini duplicável entre handlers | Helper `api/_lib/gemini.js` compartilhado | `api/whatsapp.js` (fase 14) reusa sem divergir |

## Assumptions Log

| # | Claim | Seção | Risco se errado |
|---|-------|-------|-----------------|
| A1 | O REST v1beta usa camelCase `toolConfig` (não snake_case) — inferido do payload atual que já usa `systemInstruction`/`generationConfig`/`safetySettings` camelCase e funciona | WR-02 | Baixo — se falhar, a API retorna 400 imediato; testável em 1 chamada. O SDK Python usa snake_case, mas este projeto faz REST cru |
| A2 | `usageMetadata.candidatesTokenCount` é o token de saída correto (vs `totalTokenCount`) | AI-TELEM-01 | Baixo — nomes são estáveis na API Gemini; confirmável no primeiro `SELECT` |
| A3 | Distinguir modo-análise vs modo-chat via flag no body é aceitável (vs endpoint separado) | WR-02 | Baixo — decisão de design do planner; alternativa é `/api/assistant-analysis`, mas duplicaria auth/rate-limit |

## Open Questions

1. **Flag de modo vs endpoint separado (WR-02).**
   - O que sabemos: o servidor precisa distinguir análise (tools NONE) de chat (tools READ).
   - O que falta: decidir entre flag no body (`mode:'analysis'`) — recomendado, reusa auth/rate-limit — ou endpoint dedicado. **Recomendação: flag no body.**
2. **Insert vs update para telemetria (AI-TELEM-01).**
   - O que sabemos: o insert de rate limit acontece ANTES da chamada Gemini; tokens só existem DEPOIS.
   - O que falta: confirmar Opção A (insert→update capturando `id`) no plano. **Recomendação: Opção A, update fail-open.**
3. **Constantes de cooldown compartilhadas entre os 2 `.jsx` (WR-01).**
   - O que sabemos: `fides-claude.jsx` e `fides-orcamento.jsx` são componentes separados carregados via Babel-standalone; não há módulo compartilhado no front hoje.
   - O que falta: confirmar se há um escopo global comum (ex.: `window.FIDES_*` ou `fides-data.jsx`) onde `COOLDOWN_NORMAL_SEC` possa viver, ou se replicar o valor é aceitável. **Recomendação: replicar os mesmos valores/nomes** (front sem módulos; duplicação mínima de 2 constantes é aceitável e o CONTEXT prioriza "não divergir o mecanismo", não "não duplicar a constante").

## Sources

### Primary (HIGH confidence)
- Gemini API reference — `ai.google.dev/api/generate-content` + proto `googleapis/google/ai/generativelanguage/v1beta/generative_service.proto` — campo `toolConfig.functionCallingConfig.mode` (AUTO/ANY/NONE).
- Vercel — `vercel/vercel` Discussion #4983 + `vercel/community` Discussion #46 — arquivos/dirs com prefixo `_` em `api/` não viram Serverless Functions.
- Código do repositório (leitura direta): `api/assistant.js` (inteiro), `assets/fides-claude.jsx` (cooldown + callAssistant + send), `assets/fides-orcamento.jsx` (`PlnMesInsights`/`handleAiClick`), `supabase/schema.sql` (padrão ALTER idempotente).
- `05-REVIEW.md` (WR-01/02/03), `.planning/research/whatsapp-e-ia-arquitetura.md` (§B1–B3, §5, §10), `11-CONTEXT.md` (decisões travadas).

### Secondary (MEDIUM confidence)
- gemilab.net — "Controlling Function Calls in Gemini API with tool_config" (exemplos AUTO/ANY/NONE) — corrobora o campo mas não é fonte oficial.

### Tertiary (LOW confidence)
- Nenhuma — todas as claims técnicas críticas têm fonte oficial ou verificação no código.

## Metadata

**Confidence breakdown:**
- WR-01 (cooldown): HIGH — porte direto de padrão existente no mesmo repo.
- WR-02 (toolConfig): HIGH — campo confirmado em doc/proto oficial Gemini v1beta.
- WR-03 (JWT header): HIGH — mudança mecânica, 3 anchors mapeados exatos.
- AI-SHARED-01 (helper): HIGH — convenção Vercel `_`-prefix confirmada oficialmente.
- AI-TELEM-01 (telemetria): MEDIUM-HIGH — `usageMetadata` disponível; ponto de atenção no fluxo insert-antes-de-Gemini resolvido (Opção A); tabela sem espelho `.sql` (achado).

**Research date:** 2026-07-06
**Valid until:** ~2026-08-06 (estável — API Gemini v1beta e convenção Vercel são maduras; reavaliar se a Gemini promover v1 GA com mudança de campo)
