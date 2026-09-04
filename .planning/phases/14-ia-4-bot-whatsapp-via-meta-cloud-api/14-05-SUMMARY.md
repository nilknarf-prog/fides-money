---
phase: 14-ia-4-bot-whatsapp-via-meta-cloud-api
plan: 05
subsystem: webhook-security
tags: [whatsapp, meta-api, webhook, hmac, dedupe, rate-limit, security]

requires:
  - phase: 14-01
    provides: "Tabelas wa_messages, wa_usage e profiles.phone"
  - phase: 14-02
    provides: "Primitivas readRawBody, verifySignature e sendTextMessage"

provides:
  - "api/whatsapp.js: webhook com handshake GET, verificação HMAC SHA-256 no raw body, deduplicação por wamid, fail-closed gate premium, respostas estáticas zero-LLM e caps de canal"
  - "vercel.json: maxDuration: 10 configurado para a rota api/whatsapp.js"

affects: [14-06 (parser NL->JSON e confirmação), 14-07 (insert RPC e comandos de status)]

tech-stack:
  added: []
  patterns:
    - "Verificação de assinatura raw-body: req lido pelo stream antes de qualquer acesso ao body pré-parseado"
    - "Deduplicação de mensagens: upsert em wa_messages com ignoreDuplicates evita retries da Meta causarem reprocessamento"
    - "Sempre-200 para a Meta: erros de negócio ou payload não-mensagem retornam 200 para evitar tempestade de retries"
    - "Proteção contra vazamento de conta: números não vinculados e usuários free recebem o mesmo texto estático sem LLM"
    - "Caps isolados por canal: contagem em wa_usage (30/dia, 200/mês), dissociada de assistant_usage do chat web"

key-files:
  created:
    - api/whatsapp.js
  modified:
    - vercel.json

key-decisions:
  - "Handshake GET responde challenge em texto puro (não JSON), conforme exigência da Meta"
  - "Leitura de contagem de limite é fail-open (erro no banco não derruba o webhook), mas teto atingido é fail-closed (bloqueia LLM imediatamente)"
  - "Ponto de extensão explícito para os planos 14-06 e 14-07 estruturado após a passagem de segurança e limites"

requirements-completed: [WA-WEBHOOK-01, WA-GATE-01]

verification:
  - kind: automated
    ref: "node --check api/whatsapp.js passes"
    status: pass
  - kind: structural
    ref: "Verificações de readRawBody, verifySignature, hub.challenge, wa_messages, profiles, wa_usage e vercel.json maxDuration: 10 passam 100%"
    status: pass
---

# Phase 14 Plan 05 Summary: Webhook Segurança, Dedupe e Caps

## What was built
1. **Webhook `api/whatsapp.js` (commits `a81baa7` e `c2531ef`):**
   - **Handshake GET:** Valida `hub.mode === 'subscribe'` e `hub.verify_token === WA_VERIFY_TOKEN`, respondendo `hub.challenge` em texto puro com status 200.
   - **HMAC Signature Check:** Lê o raw body via stream `readRawBody` e valida `X-Hub-Signature-256` com `verifySignature` em tempo constante contra `WA_APP_SECRET`. Assinatura inválida retorna 401.
   - **Deduplicação por `wamid`:** Insere na tabela `wa_messages` com `ignoreDuplicates: true`. Mensagens repetidas são respondidas com 200 imediatamente.
   - **Resolução de Identidade & Gate Premium:** Busca `profiles.phone == from` fail-closed. Se não vinculado ou `plan === 'free'`, responde mensagem estática de upgrade via `sendTextMessage` (com cap de 3 mensagens/dia por número para evitar custos) e encerra sem LLM.
   - **Caps de Canal:** Aplica limites de 30 msgs/dia e 200 msgs/mês sobre `wa_usage` para contas Pro/Family. Estouro responde mensagem estática de limite.
   - **Ponto de Extensão:** Estruturado e documentado para acoplar o parser Gemini estruturado (14-06) e o insert via RPC (14-07).

2. **Configuração Serverless (`vercel.json`, commit `a81baa7`):**
   - Registrado `functions["api/whatsapp.js"].maxDuration = 10`.

## Requirements Status
- **WA-WEBHOOK-01:** Handshake, HMAC e dedupe por `wamid` entregues e ativos.
- **WA-GATE-01:** Gate pré-LLM com respostas estáticas e caps de proteção implementados.
