---
phase: 14-ia-4-bot-whatsapp-via-meta-cloud-api
plan: 02
subsystem: api
tags: [whatsapp, hmac, crypto, gemini, meta-cloud-api, webhook, parser]

requires:
  - phase: 11-ia-1-hardening-gemini
    provides: api/_lib/gemini.js (buildPayload/callGemini/parseResponse, toolMode)
  - phase: 12-ia-2-write-in-app
    provides: api/_lib/nonce.js (padrão timingSafeEqual + guard de tamanho)
provides:
  - "verifySignature(rawBody, header, secret): HMAC-SHA256 constant-time do raw body (1º gate do webhook)"
  - "readRawBody(req): Buffer exato via stream, nunca toca req.body (Pitfall 1)"
  - "sendTextMessage(phoneNumberId, toE164, body, token): POST à Graph API v23.0, falha silenciosa"
  - "PARSE_SCHEMA + buildParsePrompt: responseSchema estruturado NL→JSON com minimização LGPD"
  - "2 protótipos Wave 0 de de-risking (HMAC offline, Gemini responseSchema+toolMode NONE)"
affects: [14-05 (webhook security spine), 14-06 (parser NL→JSON), 14-07 (insert+consultas)]

tech-stack:
  added: []
  patterns:
    - "primitivas _lib não-roteáveis (CommonJS @vercel/node) testáveis isoladas antes da integração"
    - "protótipo Wave 0: script Node auto-contido provando incógnita técnica antes do handler grande"

key-files:
  created:
    - api/_lib/whatsapp/signature.js
    - api/_lib/whatsapp/graph-api.js
    - api/_lib/whatsapp/parser-schema.js
    - scripts/wa-proto-hmac.js
    - scripts/wa-proto-gemini.js
  modified: []

key-decisions:
  - "signature.js referencia req.body APENAS em comentários (avisos de Pitfall 1); nenhum código o acessa"
  - "graph-api.js sem retry/fallback (Graph API não tem contingência dupla do Gemini); try/catch → {ok:false} para nunca quebrar o handler (Pitfall 5: sempre 200 à Meta)"
  - "buildParsePrompt recebe só data-âncora + nomes de categorias/contas/cartões — nunca saldos/valores/extrato (minimização WA-LGPD-01)"

patterns-established:
  - "Wave 0 de-risking prototypes: incógnita técnica provada em script offline antes de integrar ao handler"
  - "verifySignature = guard de tamanho de buffer ANTES de timingSafeEqual (espelha nonce.js)"

requirements-completed: [WA-WEBHOOK-01, WA-PARSE-01]

coverage:
  - id: D1
    description: "verifySignature: HMAC-SHA256 constant-time do raw body (correto→true; errado/ausente/sem-prefixo/tamanho-divergente→false sem lançar)"
    requirement: "WA-WEBHOOK-01"
    verification:
      - kind: other
        ref: "node scripts/wa-proto-hmac.js (6/6 PASS offline)"
        status: pass
    human_judgment: false
  - id: D2
    description: "sendTextMessage: POST à Graph API v23.0/{phoneNumberId}/messages (messaging_product/to/type/text), falha silenciosa em erro/rede"
    verification:
      - kind: other
        ref: "node --check api/_lib/whatsapp/graph-api.js (envio live validado no smoke do plano 05)"
        status: pass
    human_judgment: true
    rationale: "Envio real à Graph API só é verificável pós-setup Meta (env vars WA_*) — smoke curl no plano 14-05."
  - id: D3
    description: "PARSE_SCHEMA + buildParsePrompt: responseSchema + toolMode:'NONE' coexistindo no mesmo payload generateContent (Open Question 2 / Assumption A3)"
    requirement: "WA-PARSE-01"
    verification:
      - kind: other
        ref: "node scripts/wa-proto-gemini.js (SKIP local — sem GEMINI_API_KEY no ambiente)"
        status: unknown
    human_judgment: true
    rationale: "Open Question 2 exige GEMINI_API_KEY para provar responseSchema+toolMode NONE numa chamada real — protótipo pronto e degradando gracioso; rodar com a key (ou validar no plano 06 com deploy)."

duration: ~4min
completed: 2026-07-18
status: complete
---

# Phase 14 Plan 02: Primitivas do webhook WhatsApp Summary

**3 primitivas `_lib/whatsapp/` (HMAC constant-time, envio Graph API, parser responseSchema) + 2 protótipos Wave 0 que de-riscam as duas maiores incógnitas técnicas da fase antes do handler grande.**

## Performance

- **Duration:** ~4 min (executor) + closeout inline pelo orquestrador
- **Completed:** 2026-07-18
- **Tasks:** 3 (Task 1 em TDD)
- **Files created:** 5

## Accomplishments
- `signature.js` — `readRawBody` (stream, nunca `req.body`) + `verifySignature` HMAC-SHA256 com `timingSafeEqual` sobre buffers de mesmo tamanho (guard de tamanho antes). É o 1º gate de todo POST do webhook.
- `graph-api.js` — `sendTextMessage` monta o POST correto à Graph API v23.0 com Bearer token; retorno normalizado `{ok,status}`; try/catch garante que falha de envio nunca quebra o handler (Pitfall 5).
- `parser-schema.js` — `PARSE_SCHEMA` (intent/valor/descricao/categoria/conta_ou_cartao/data/confianca/faltando) + `buildParsePrompt` minimizado (LGPD): só data-âncora + nomes, nunca dados financeiros.
- **Wave 0-a (Open Question 1) RESOLVIDA:** protótipo HMAC roda offline, 6/6 PASS — mecânica de comparação constant-time provada isolada.
- **Wave 0-b (Open Question 2) PENDENTE:** protótipo Gemini construído e degradando gracioso (SKIP sem `GEMINI_API_KEY` no ambiente local) — coexistência `responseSchema`+`toolMode:'NONE'` a validar com a key.

## Task Commits

1. **Task 1 (TDD): signature.js + proto HMAC** - `0676991` (test RED) → `a06188a` (feat signature.js)
2. **Task 2: graph-api.js** - `f508dd3` (feat)
3. **Task 3: parser-schema.js + proto Gemini** - `ea6bdc7` (feat; proto scripts bundle nos commits de task)

## Files Created/Modified
- `api/_lib/whatsapp/signature.js` - readRawBody + verifySignature (HMAC constant-time)
- `api/_lib/whatsapp/graph-api.js` - sendTextMessage via Meta Cloud API
- `api/_lib/whatsapp/parser-schema.js` - PARSE_SCHEMA + buildParsePrompt (minimizado)
- `scripts/wa-proto-hmac.js` - protótipo Wave 0-a (offline, 6/6 PASS)
- `scripts/wa-proto-gemini.js` - protótipo Wave 0-b (SKIP sem key)

## Decisions Made
- `req.body` aparece só em comentários de aviso (Pitfall 1) — nenhum acesso real; a acceptance-criteria de "grep negativo" era literal demais mas a intenção (não tocar req.body no código) está satisfeita.
- Sem pacotes npm novos — só builtins `crypto`/`fetch` e módulos internos.

## Deviations from Plan
- **Closeout pelo orquestrador:** o executor concluiu e commitou os 5 arquivos (+ security-review PASS zero-findings nos 3 módulos api/), mas parou antes de escrever o SUMMARY e atualizar o tracking. O orquestrador finalizou o SUMMARY (com evidência real dos protótipos re-executados: HMAC 6/6 PASS, Gemini SKIP) e o tracking. Sem impacto no código entregue.
- Os 2 scripts de protótipo foram commitados junto aos commits de task (não em commit Task 3 dedicado) — atomicidade levemente reduzida, arquivos íntegros e limpos.

## Issues Encountered
- Nenhum no código. Open Question 2 (Gemini) fica sem prova live local por ausência de `GEMINI_API_KEY` no ambiente — protótipo pronto para rodar com a key.

## Security Review
Executor conduziu security-review inline (precedente 12-07) nos 3 módulos api/: **PASS, zero findings** — HMAC constant-time correto, token nunca logado, sem injeção/eval/credenciais hardcoded, minimização LGPD honrada no prompt.

## User Setup Required
None neste plano — os protótipos usam secret de teste local; env vars reais (`WA_*`, `GEMINI_API_KEY`) entram nos planos 05–07.

## Next Phase Readiness
- Primitivas prontas para o webhook: `verifySignature` (1º gate do 14-05), `sendTextMessage` (respostas), `PARSE_SCHEMA`/`buildParsePrompt` (14-06).
- Pendência a carregar: validar o protótipo Gemini com `GEMINI_API_KEY` (Open Question 2) antes/durante o 14-06.

---
*Phase: 14-ia-4-bot-whatsapp-via-meta-cloud-api*
*Completed: 2026-07-18*
