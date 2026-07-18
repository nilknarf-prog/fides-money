# Phase 14: IA-4 Bot WhatsApp via Meta Cloud API - Research

**Researched:** 2026-07-17
**Domain:** Webhook Meta WhatsApp Cloud API (Vercel Function CommonJS) + parsing estruturado Gemini + insert service-role em Supabase
**Confidence:** MEDIUM (mecânica de implementação verificada via WebSearch contra documentação oficial Meta/Google/Vercel; sem acesso a Context7/MCP nesta sessão — nenhum item chega a HIGH por falta de fonte primária consultada diretamente)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Modelo de acesso e promessa comercial (travado 2026-07-17, pós-pesquisa de preços)**
- **AC-01 Premium-only:** o bot é benefício do plano pago (R$ 89,90/ano). WA-GATE-01 mantido como no design (§4): checagem de `profiles.plan` ANTES de qualquer LLM; free NÃO vincula número (botão "Conectar WhatsApp" só aparece para premium — dupla camada UI + webhook).
- **AC-02 Sem vitalício:** promessa comercial = anual tudo-incluso (bot + IA in-app dentro do R$ 89,90/ano).
- **AC-03 Free no bot:** resposta estática de upgrade com link, cap 3/dia/número, zero LLM. Número desconhecido: idem, sem revelar existência de conta.

**Custos reais e estratégia pós-out/2026**
- Cobrança de mensagens de SERVIÇO pela Meta começa em 01/10/2026 (~R$ 0,04/msg enviada; inbound grátis). Até 30/09/2026: R$ 0.
- **CU-01 D-1 mantido:** confirmar SEMPRE no MVP. Auto-insert com desfazer é alavanca futura — NÃO implementar agora.
- **CU-02 Caps diário + mensal:** referência 30 msgs/dia E 300 msgs/mês por usuário premium no canal WhatsApp (teto ≤ ~R$ 15/mês/usuário). Contador no padrão `assistant_usage`, separado do chat in-app.
- **CU-03 Gate set/2026:** re-verificar tabela BRL oficial antes do lançamento público (o beta no test number NÃO espera).
- **CU-04 LLM:** Gemini 2.5 Flash-Lite TIER PAGO. Free tier PROIBIDO em produção. Caching NÃO se aplica (prompt abaixo do piso de 2.048 tokens).

**Escopo e fases**
- **ES-01:** Sem split 14a/14b — bot leve como está (D-6: registrar + saldo + mini-extrato). Placeholder de fase futura "Assistente robusto no WhatsApp" adicionado ao ROADMAP, sem planejar agora.
- **ES-02:** Botões interativos adiados — MVP usa texto numerado ("1 · Confirmar 2 · Cancelar 3 · Trocar categoria").

**Achados técnicos que o planner DEVE respeitar**
- **TE-01:** NÃO reusar `wa_log_transaction` às cegas — guarda por `auth.uid()` (NULL no webhook). Criar variante service_role-only com `p_user_id` explícito + owner-guard + REVOKE de `authenticated`/`anon`, mesmo padrão dos RPCs `admin_*` da Phase 16. Caminho sensível → security-reviewer + database-reviewer obrigatórios.
- **TE-02:** Provedor = Meta Cloud API direta. Sem CNPJ não bloqueia — test number grátis (dono + até 4 beta testers via OTP) para dev/UAT; WABA não-verificada responde mensagens iniciadas pelo usuário ilimitado (cap de 250/dia é só para conversas iniciadas pela empresa); display name não aparece (cosmético).
- **TE-03:** Rate-limit do webhook nasce junto (lição WR-01): throttle próprio do canal + caps CU-02 desde o primeiro deploy.

**Folded Todos**
- `ratelimit-bypass-toolresults` (high, security-review Phase 11): gate de `USER_DAILY_LIMIT` em `api/assistant.js` pulava quando `toolResults` vinha forjado. Fix esperado: contar TODA requisição OU validar nonce assinado (`api/_lib/nonce.js`). **Ver achado desta pesquisa abaixo — o código atual já parece conter o fix do nonce.**

### Claude's Discretion
Números finais dos caps (dentro do teto CU-02), janela do contador (dia/mês calendário vs rolling), copy exata das mensagens do bot, estrutura fina do prompt do parser, divisão e ordem dos planos, escolha entre as duas opções de fix do rate-limit (contar tudo vs nonce) — **ver achado abaixo: a escolha já foi feita e aplicada em 12-02, falta só auditar/documentar**.

### Deferred Ideas (OUT OF SCOPE)
- Assistente robusto NO WhatsApp (conselhos/análises/criar categoria) — placeholder no ROADMAP, planejar só pós-tração.
- Auto-insert com desfazer — pós-telemetria de taxa de correção.
- Promo founders pagamento único — descartada como modelo permanente.
- Botões interativos nativos — pós-MVP.
- Áudio/imagem no bot — V2.
- Verificação Meta Business + display name + mensagens proativas — pós-tração, exige CNPJ.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WA-WEBHOOK-01 | Assinatura HMAC (`X-Hub-Signature-256`) + idempotência por `wamid` | §"Payload do webhook", §"Validação HMAC" — formato exato do payload, handshake GET, extração de raw body em função CommonJS plana |
| WA-OPTIN-01 | Opt-in por código de posse (`wa.me` link) | §"Envio de mensagens" + schema `wa_link_codes` (design doc §4) — nenhuma pesquisa nova necessária além do que já está em `whatsapp-e-ia-arquitetura.md` |
| WA-GATE-01 | Gating premium antes de qualquer LLM | §"Padrão a espelhar: gate fail-closed" (mirror de `api/assistant.js` GATE-02/03 e `guard.js` requireAdmin) |
| WA-PARSE-01 | Parser NL→JSON via saída estruturada (não function calling) + guarda determinística de valor | §"Gemini structured output" — sintaxe exata de `responseSchema`/`responseMimeType`, compatibilidade com `api/_lib/gemini.js` |
| WA-CONFIRM-01 | Confirmação sempre antes do insert (D-1) | Já coberto em detalhe no design doc §7 — esta pesquisa só reforça o padrão determinístico (sem LLM na leitura de "1"/"2"/"3") |
| WA-INSERT-01 | Insert via RPC service_role-only | §"RPC service_role-only" — padrão exato extraído de `supabase/admin-backoffice.sql` (16-01), aplicável 1:1 à variante `wa_log_transaction_service` |
| WA-LGPD-01 (a formalizar) | Consentimento, minimização, retenção 90d, opt-out | §"LGPD" — modelo de doc a espelhar é `docs/admin-lgpd.md` (Phase 16, já ratificado pelo dono) |
| WA-RATELIMIT-01 | Fechar bypass do rate-limit diário (`toolResults` forjado) | **§"Achado crítico: bypass já fechado em 12-02"** — mudança de escopo relevante para o planner |
</phase_requirements>

## Summary

Esta pesquisa cobre a MECÂNICA DE IMPLEMENTAÇÃO do bot WhatsApp — o design arquitetural (fluxo, schema, UX, LGPD, custos) já está fechado em `.planning/research/whatsapp-e-ia-arquitetura.md` e no `14-CONTEXT.md`, e não foi re-derivado aqui. O que faltava — formato exato dos payloads Meta, validação HMAC numa função Vercel CommonJS pura (sem Next.js), endpoint de envio, setup prático do test number, sintaxe do `responseSchema` do Gemini, e os padrões internos a espelhar (RPC service-role, guard fail-closed) — foi levantado e está documentado abaixo com exemplos de código.

**Achado mais importante da sessão, fora do escopo original da pesquisa:** o "achado técnico" WA-RATELIMIT-01 (bypass do rate-limit via `toolResults` forjado, o todo `ratelimit-bypass-toolresults.md`) **já foi corrigido no commit `9abd83e` (Phase 12-02, "fix rate-limit bypass with nonce")**. O código atual de `api/assistant.js` já usa `nonce.verify()` para decidir `isFirstCallOfTurn` — a forma antiga (`!Array.isArray(toolResults) || toolResults.length === 0`) não existe mais no HEAD. O CONTEXT.md e o STATE.md desta fase ainda descrevem isso como pendência aberta; **é preciso o planner auditar o código atual antes de escrever uma task de "fix"** — o trabalho real que resta é (a) confirmar que o fix fecha o vetor por completo, (b) identificar o gap residual (replay do MESMO nonce dentro da janela de TTL de 120s — o nonce não é de uso único, é só assinatura+expiry stateless) e decidir se vale endurecer, e (c) fechar formalmente o todo (mover de `pending/` para `done/` ou registrar como não-issue). Ver seção dedicada abaixo.

Para o webhook em si, o ponto de maior risco técnico é a validação HMAC: o projeto usa funções Vercel **CommonJS puras** (`module.exports = async (req, res) => {}`, sem Next.js) — e a forma documentada oficialmente pela Vercel para desabilitar o parse automático do body (`export const config = { api: { bodyParser: false } }`) é uma feature **específica do Next.js**, que não existe em funções `@vercel/node` simples. É preciso ler o corpo bruto (raw bytes) diretamente do stream `req` (IncomingMessage) ANTES de qualquer acesso a `req.body` (que é um getter lazy — só dispara o parse quando acessado). Esse ponto tem confiança BAIXA (relatos de comunidade divergem sobre estabilidade) e deveria ser o primeiro item a prototipar/validar no plano (Wave 0), porque é a fundação de segurança de todo o webhook.

**Primary recommendation:** planejar em 3 frentes que podem ser paralelizadas em ondas: (1) fundação SQL — `wa_log_transaction_service` + tabelas `wa_link_codes`/`wa_messages`/`wa_pending` + colunas `profiles.phone`/`wa_linked_at`, espelhando 1:1 o padrão REVOKE/GRANT de `admin-backoffice.sql`; (2) `api/whatsapp.js` — GET handshake + POST com raw-body HMAC + dedupe wamid + gate premium + parser Gemini + confirmação determinística + envio via Graph API, todos com try/catch raiz retornando 200 (nunca deixar a Meta reter em retry); (3) UI in-app (Perfil → "Conectar WhatsApp") + docs LGPD formal. Fundação SQL primeiro (bloqueia tudo), depois webhook, com security-reviewer + database-reviewer obrigatórios antes do commit (caminho sensível declarado no CONTEXT.md e no CLAUDE.md).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Verificação HMAC do webhook + dedupe wamid | API/Backend (`api/whatsapp.js`) | — | Segredo (App Secret) só existe server-side; validação precisa do corpo bruto antes de qualquer parse |
| Handshake GET de verificação do endpoint | API/Backend | — | Handshake é servidor-a-servidor (Meta → Vercel), sem envolvimento de browser |
| Identificação usuário (phone → user_id) + gating premium | API/Backend | Database/Storage (RLS não se aplica — service_role) | `profiles.plan` é a fonte da verdade; leitura sempre no servidor, nunca confiar em estado do cliente (mesmo padrão GATE-02 de `api/assistant.js`) |
| Parser NL→JSON (Gemini) | API/Backend | — (chamada externa a serviço de IA) | Prompt/segredo da API key só no servidor; reusa `api/_lib/gemini.js` |
| Guarda determinística de valor (regex sobre a mensagem original) | API/Backend | — | Roda no mesmo processo do webhook, sem I/O externo — não precisa de tier próprio |
| Confirmação "1/2/3" (leitura de resposta pendente) | API/Backend | Database/Storage (`wa_pending`) | Determinístico, sem LLM — mas depende de estado persistido (1 linha por usuário) |
| Insert de transação | Database/Storage (RPC `wa_log_transaction_service`) | API/Backend (chamador) | Mesmo modelo de `wa_log_transaction`/`admin_set_plan`: mutação sempre atrás de RPC `SECURITY DEFINER`, nunca INSERT cru do client |
| Envio de resposta (Graph API) | API/Backend | — | Token de acesso (system user) só existe server-side |
| Opt-in "Conectar WhatsApp" (geração de código + link `wa.me`) | Browser/Client (botão no Perfil) | API/Backend (grava `wa_link_codes`) | UI decide QUANDO mostrar o botão (premium-only, camada 1); o servidor decide se HONRA o código (camada 2, webhook) |
| Rate-limit/caps do canal WhatsApp | API/Backend | Database/Storage (`assistant_usage` ou tabela irmã) | Mesmo padrão de `USER_DAILY_LIMIT`/`FREE_TIER_MONTHLY_LIMIT` em `api/assistant.js` — contagem sempre no servidor |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.45.0 (instalado: 2.106.2, já no `package-lock.json`) | Client service_role no webhook (mesmo client já usado em `api/admin.js`) | Já é dependência do projeto — nenhuma versão nova a instalar |
| `crypto` (Node builtin) | Node runtime da Vercel (Node 20.x atual) | HMAC-SHA256 do `X-Hub-Signature-256` + `timingSafeEqual` | Já usado em `api/_lib/nonce.js` — zero dependência nova |
| `fetch` (Node builtin global) | Node runtime da Vercel | Chamadas HTTP à Graph API (envio de mensagem) e ao endpoint `generateContent` do Gemini | Já usado em `api/_lib/gemini.js` — nenhum client HTTP externo (axios/node-fetch) necessário |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `api/_lib/gemini.js` (interno) | já existe | `buildPayload`/`callGemini`/`parseResponse` compartilhados | Parser do webhook monta só o `responseSchema` + `contents`; reusa retry/fallback prontos |
| `api/_lib/nonce.js` (interno) | já existe | HMAC de curta duração, stateless | Candidato a reforço adicional do rate-limit do canal WhatsApp (mesmo padrão do fix 12-02) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Ler raw body via stream manual (`req.on('data'/'end')`) | Handler estilo Web API (`export async function POST(request)` + `request.text()`) | Web API é o padrão mais moderno documentado pela própria Vercel para HMAC, mas exige export ESM — quebra a convenção CommonJS (`module.exports`) usada em TODO `api/*.js` do projeto. Ver Pitfall dedicado abaixo. |
| Biblioteca `micro`/`buffer()` para raw body | Leitura manual do stream | `micro` é a lib historicamente usada para isso em funções Vercel sem Next.js, mas adiciona uma dependência nova só para uma função utilitária de ~5 linhas — usar leitura manual do stream evita o import extra (Don't Hand-Roll não se aplica aqui: é trivial o suficiente para não justificar dependência) |

**Installation:** nenhum pacote novo — todas as dependências necessárias já estão no `package.json`.

**Version verification:** `@supabase/supabase-js` confirmado via `package-lock.json` (resolved: 2.106.2, satisfaz `^2.45.0`) [VERIFIED: package-lock.json local]. Node runtime da Vercel não fixado explicitamente no `vercel.json` deste projeto — usa o default da plataforma (Node 20.x em jul/2026) [ASSUMED — não há `"engines"` no `package.json` nem runtime explícito no `vercel.json`; confirmar no dashboard do projeto antes de assumir `fetch`/`crypto` global disponíveis, embora `api/_lib/gemini.js` e `api/_lib/nonce.js` já provem que funcionam em produção hoje].

## Package Legitimacy Audit

**Não aplicável nesta fase — nenhum pacote npm novo é instalado.** Toda a mecânica (HMAC, fetch, cliente Supabase) usa dependências já presentes no projeto (`@supabase/supabase-js`) ou builtins do Node (`crypto`, `fetch` global). Se o planner decidir usar `micro` (alternativa considerada acima) para o raw body, ela DEVE passar pelo gate de legitimidade antes do commit — mas a recomendação desta pesquisa é evitar essa dependência.

## Architecture Patterns

### System Architecture Diagram

```
Meta WhatsApp                    api/whatsapp.js (Vercel, CommonJS)                  Supabase (service_role)        Gemini
     │                                    │                                                  │                        │
     │  GET ?hub.mode=subscribe&...       │                                                  │                        │
     ├───────────────────────────────────►│ compara hub.verify_token == WA_VERIFY_TOKEN       │                        │
     │◄───────────────────────────────────┤ 200 text/plain hub.challenge (ou 403)             │                        │
     │                                    │                                                  │                        │
     │  POST webhook (mensagem)           │                                                  │                        │
     ├───────────────────────────────────►│ 1. lê RAW BODY do stream (req.on data/end)        │                        │
     │                                    │ 2. HMAC-SHA256(rawBody, APP_SECRET)               │                        │
     │                                    │    compara com header X-Hub-Signature-256          │                        │
     │                                    │    (crypto.timingSafeEqual) — falhou → 401, fim   │                        │
     │                                    │ 3. JSON.parse(rawBody) → entry[0].changes[0].value│                        │
     │                                    │ 4. dedupe: INSERT wa_messages(wamid) ON CONFLICT  │                        │
     │                                    ├──────────────────────────────────────────────────►│                        │
     │                                    │    já existia → 200 imediato, fim (retry da Meta) │                        │
     │                                    │ 5. SELECT profiles WHERE phone = from             │                        │
     │                                    ├──────────────────────────────────────────────────►│                        │
     │                                    │    não vinculado/free → resposta estática, fim    │                        │
     │                                    │ 6. resposta "1/2/3" com wa_pending ativo?         │                        │
     │                                    │    sim → pula parser, vai directo pro insert (10) │                        │
     │                                    │ 7. cap diário/mensal do canal (assistant_usage)   │                        │
     │                                    ├──────────────────────────────────────────────────►│                        │
     │                                    │    estourou → resposta de limite, fim             │                        │
     │                                    │ 8. guarda regex de valor sobre a msg original     │                        │
     │                                    │ 9. parse NL→JSON (responseSchema, sem tools)      │                        │
     │                                    ├─────────────────────────────────────────────────────────────────────────►│
     │                                    │◄─────────────────────────────────────────────────────────────────────────┤
     │                                    │ 10. INSERT wa_pending (payload) + monta card      │                        │
     │                                    ├──────────────────────────────────────────────────►│                        │
     │                                    │ 11. POST Graph API /PHONE_NUMBER_ID/messages       │                        │
     │◄───────────────────────────────────┤     (Authorization: Bearer <system-user-token>)   │                        │
     │  "Confirmar? 1-Sim 2-Não 3-Trocar" │                                                  │                        │
     │                                    │ 200 OK → Meta (SEMPRE, mesmo em erro tratado)     │                        │
     │                                    │                                                  │                        │
     │  "1"                               │                                                  │                        │
     ├───────────────────────────────────►│ (passos 1-4 de novo, match wa_pending)            │                        │
     │                                    │ 12. RPC wa_log_transaction_service(p_user_id,...) │                        │
     │                                    ├──────────────────────────────────────────────────►│ owner-guard + INSERT   │
     │                                    │                                                  │ + recalc_account_balance│
     │                                    │ 13. DELETE wa_pending (ou marca done_tx_id)       │                        │
     │◄───────────────────────────────────┤ "✅ Lançado. Mercado no mês: R$ 312 de R$ 400"    │                        │
```

### Recommended Project Structure
```
api/
├── whatsapp.js                    # webhook único (GET verify + POST receive), CommonJS
├── _lib/
│   ├── gemini.js                  # já existe — reusado sem alteração de contrato
│   ├── nonce.js                   # já existe — candidato a reforço de rate-limit
│   ├── whatsapp/
│   │   ├── signature.js           # HMAC verify (raw body in, boolean out) — testável isolado
│   │   ├── graph-api.js           # sendTextMessage(phoneNumberId, to, body, token)
│   │   └── parser-schema.js       # responseSchema do parser NL→JSON (const exportada)
supabase/
├── wa-log-transaction-service.sql # nova RPC service_role-only (TE-01), espelha admin-backoffice.sql
├── wa-schema.sql                  # profiles.phone/wa_linked_at + wa_link_codes/wa_messages/wa_pending
docs/
├── whatsapp-lgpd.md                # espelha docs/admin-lgpd.md — WA-LGPD-01 formalizado
```

### Pattern 1: Raw body + HMAC em função Vercel CommonJS pura (sem Next.js)
**What:** ler o corpo bruto do request ANTES de tocar em `req.body`, comparar assinatura com `crypto.timingSafeEqual`.
**When to use:** todo POST recebido em `api/whatsapp.js` — é o PRIMEIRO passo, antes de qualquer lógica de negócio.
**Confidence:** LOW/MEDIUM — não há precedente disso no código atual do projeto (nenhum outro `api/*.js` valida assinatura de webhook); a comunidade reporta divergências sobre estabilidade fora do Next.js. **Recomendação: prototipar isso isoladamente em Wave 0 do plano, com `curl` local (`vercel dev`) antes de integrar o resto do handler.**
```javascript
// Source: síntese de developers.facebook.com/documentation/business-messaging/whatsapp/webhooks
// + vercel.com/kb/guide/how-do-i-get-the-raw-body-of-a-serverless-function (via WebSearch, MEDIUM confidence)
const crypto = require('crypto');

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifySignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const provided = signatureHeader.slice('sha256='.length);
  const expBuf = Buffer.from(expected, 'utf8');
  const provBuf = Buffer.from(provided, 'utf8');
  if (expBuf.length !== provBuf.length) return false;
  return crypto.timingSafeEqual(expBuf, provBuf);
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    // handshake de verificação — ver Pattern 2
  }
  if (req.method === 'POST') {
    const rawBody = await readRawBody(req); // NUNCA usar req.body aqui antes desta linha
    const sig = req.headers['x-hub-signature-256'];
    if (!verifySignature(rawBody, sig, process.env.WA_APP_SECRET)) {
      res.status(401).end();
      return;
    }
    const payload = JSON.parse(rawBody.toString('utf8'));
    // ... segue o fluxo
  }
};
```
**Risco documentado (LOW confidence, comunidade):** alguns relatos indicam "socket hangup" ao ler o stream manualmente em funções `@vercel/node` puras fora do padrão Next.js. Mitigação: se o teste de Wave 0 falhar, o fallback documentado pela própria Vercel é expor o handler no formato Web API (`export async function POST(request) { const rawBody = await request.text(); }`) — mas isso exige sintaxe `export`, incompatível com o padrão CommonJS `module.exports` do resto do projeto. Decisão a tomar no plano: aceitar essa única exceção de sintaxe em `api/whatsapp.js` SE o teste de Wave 0 mostrar que o stream manual é instável.

### Pattern 2: Handshake GET de verificação
**What:** responder ao GET de configuração do webhook com o `hub.challenge` em texto puro.
**Confidence:** MEDIUM [CITED: developers.facebook.com/documentation/business-messaging/whatsapp/webhooks].
```javascript
if (req.method === 'GET') {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    res.status(200).send(challenge); // TEXTO PURO — nunca res.json(), a Meta espera o challenge cru no corpo
    return;
  }
  res.status(403).end();
  return;
}
```
Nota: `req.query` já é populado pelo helper da Vercel mesmo em funções CommonJS puras (mesmo mecanismo usado hoje em `api/admin.js:79` `req.query`) — isso NÃO tem o mesmo problema do `req.body`, porque query string não precisa de "raw bytes" para nada.

### Pattern 3: Envio de mensagem (Graph API)
**Confidence:** MEDIUM [CITED: developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/].
```javascript
async function sendTextMessage(phoneNumberId, toE164, body, token) {
  const res = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toE164, // sem "+", com código do país — mesma convenção de profiles.phone (E.164)
      type: 'text',
      text: { preview_url: false, body },
    }),
  });
  // 200 só confirma que a Meta ACEITOU — não garante entrega (entrega vem via webhook de status,
  // que este design intencionalmente ignora — ver design doc §1 "Payload não-mensagem: 200, ignora")
  return res.ok;
}
```

### Pattern 4: RPC service_role-only (TE-01) — espelha `admin-backoffice.sql`
**What:** variante de `wa_log_transaction` que aceita `p_user_id` explícito (não `auth.uid()`, que é NULL sob service_role) + owner-guard + REVOKE/GRANT restrito.
**Confidence:** HIGH — não é pesquisa externa, é leitura direta do padrão já aprovado e em produção (`supabase/admin-backoffice.sql`, revisado por security+database-reviewer na Phase 16).
```sql
-- Source: supabase/admin-backoffice.sql (padrão 16-01, já em produção) + supabase/wa-log-transaction.sql (base)
create or replace function public.wa_log_transaction_service(
  p_user_id     uuid,           -- NOVO: explícito, porque auth.uid() é NULL no service_role
  p_description text,
  p_value       numeric,
  p_category    text,
  p_date        date,
  p_month       text,
  p_status      text,
  p_account_id  uuid default null,
  p_card_id     uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tmp   uuid;
  v_tx_id uuid;
begin
  if p_user_id is null then
    raise exception 'AUTH: p_user_id obrigatório';
  end if;

  if p_account_id is null and p_card_id is null then
    raise exception 'DESTINO: conta ou cartão obrigatório';
  end if;
  if p_account_id is not null and p_card_id is not null then
    raise exception 'DESTINO: apenas um (conta ou cartão)';
  end if;

  -- Owner guard idêntico ao wa_log_transaction, mas contra p_user_id (não auth.uid())
  if p_account_id is not null then
    select id into v_tmp from public.accounts where id = p_account_id and user_id = p_user_id;
    if v_tmp is null then raise exception 'CONTA'; end if;
  end if;
  if p_card_id is not null then
    select id into v_tmp from public.cards where id = p_card_id and user_id = p_user_id;
    if v_tmp is null then raise exception 'CARTAO'; end if;
  end if;

  insert into public.transactions
    (user_id, description, value, category, account, account_id, card_id,
     date, month, status, recurrent, subscription, settled, is_transfer)
  values
    (p_user_id, p_description, p_value, p_category,
     coalesce(p_account_id, p_card_id)::text, p_account_id, p_card_id,
     p_date, coalesce(nullif(trim(p_month), ''), to_char(p_date, 'YYYY-MM')),
     coalesce(nullif(trim(p_status), ''), 'pending'),
     false, false, false, false)
  returning id into v_tx_id;

  if p_account_id is not null then
    perform public.recalc_account_balance(p_account_id);
  end if;
  if p_card_id is not null and p_value < 0 then
    update public.cards set used = used + abs(p_value) where id = p_card_id and user_id = p_user_id;
  end if;

  return jsonb_build_object('id', v_tx_id, 'inserted', true);
end;
$$;

-- CRÍTICO (M8, já documentado em admin-backoffice.sql): EXECUTE de plpgsql é PUBLIC por default.
-- authenticated NÃO PODE receber EXECUTE nesta função — só o webhook (service_role) chama.
revoke execute on function public.wa_log_transaction_service(uuid, text, numeric, text, date, text, text, uuid, uuid) from public, anon, authenticated;
grant  execute on function public.wa_log_transaction_service(uuid, text, numeric, text, date, text, text, uuid, uuid) to service_role;
```
**Nota de confused-deputy (mesma nota que `admin_set_plan` já documenta):** a função confia em `p_user_id` sem revalidar — a mitigação é a mesma: GRANT exclusivo a `service_role`, cujo único chamador possível é `api/whatsapp.js` pós-verificação HMAC + resolução `phone→user_id`. `authenticated` nem consegue executar a função.

### Pattern 5: Saída estruturada Gemini (`responseSchema`)
**Confidence:** MEDIUM [CITED: ai.google.dev/gemini-api/docs/structured-output — via WebSearch].
```javascript
// Source: api/_lib/gemini.js já aceita generationConfig arbitrário via buildPayload —
// o parser do webhook só precisa montar isto e chamar gemini.callGemini(payload, apiKey).
const PARSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    intent:    { type: 'STRING', enum: ['registrar_despesa', 'registrar_receita', 'consultar_saldo', 'ajuda', 'outro'] },
    valor:     { type: 'NUMBER', nullable: true },
    descricao: { type: 'STRING', nullable: true },
    categoria: { type: 'STRING', nullable: true },
    conta_ou_cartao: { type: 'STRING', nullable: true },
    data:      { type: 'STRING', nullable: true },
    confianca: { type: 'STRING', enum: ['alta', 'media', 'baixa'] },
    faltando:  { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['intent', 'confianca'],
  propertyOrdering: ['intent', 'valor', 'descricao', 'categoria', 'conta_ou_cartao', 'data', 'confianca', 'faltando'],
};

const payload = gemini.buildPayload({
  systemPrompt: WHATSAPP_PARSE_PROMPT,
  contents: [{ role: 'user', parts: [{ text: userMessage }] }],
  toolMode: 'NONE',            // NÃO function calling — elimina por construção o bug WR-02
  generationConfig: {
    temperature: 0.2,          // parser determinístico — mais baixo que o chat (0.6)
    maxOutputTokens: 200,      // higiene de custo (CU-04) — resposta é um JSON de ~8 campos
    responseMimeType: 'application/json',
    responseSchema: PARSE_SCHEMA,
  },
});
```
**Ponto a validar no plano (não confirmado nesta pesquisa):** `buildPayload` em `api/_lib/gemini.js` hoje só usa `toolConfig`/`tools` condicionalmente — não foi testado neste projeto se `responseSchema`+`toolMode:'NONE'` coexistem sem conflito no mesmo payload. `toolConfig.functionCallingConfig.mode:'NONE'` e `responseSchema` são campos independentes do payload (não deveriam colidir), mas a combinação exata nunca rodou em produção neste código — recomenda-se um teste isolado (curl direto ao endpoint `generateContent`) antes de integrar ao handler do webhook.

### Anti-Patterns to Avoid
- **Confiar em `req.body` para HMAC:** `req.body` é populado por um parser da plataforma que já pode ter alterado/normalizado bytes (encoding, ordem de chaves em re-serialização) — a assinatura da Meta é sobre os BYTES EXATOS recebidos. Qualquer verificação que passe por `JSON.stringify(req.body)` está estruturalmente quebrada mesmo que "funcione" nos testes manuais (a Meta usa escaping de unicode específico).
- **Processar de forma assíncrona pós-200:** funções serverless da Vercel não garantem execução após a resposta ser enviada (sem `waitUntil`/fila configurada) — o design exige processar TUDO (parse Gemini incluso) ANTES do `res.status(200)`, não depois.
- **Duplicar o RPC ao invés de criar variante:** `wa_log_transaction` (Phase 12) usa `auth.uid()` — chamá-lo do webhook resultaria em `AUTH` exception sempre (NULL). Não "consertar" o RPC existente (quebraria o caminho do chat in-app, que depende de JWT real) — criar `wa_log_transaction_service` como função nova (TE-01, já confirmado no CONTEXT.md).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Assinatura de webhook | Comparação de string ingênua (`===`) | `crypto.timingSafeEqual` sobre buffers de mesmo tamanho | Comparação `===` vaza timing (ataque de timing side-channel) — já é o padrão usado em `api/_lib/nonce.js`, só replicar |
| Idempotência de webhook | Cache em memória (Map/Set no processo) | `INSERT wa_messages(wamid) ON CONFLICT DO NOTHING` no Postgres | Funções serverless não compartilham memória entre invocações/instâncias — só o banco garante dedupe real entre instâncias concorrentes |
| Parsing de data relativa ("ontem", "sexta") | Regex/parser de linguagem natural de datas em JS | Deixar o próprio Gemini resolver com a data-âncora no prompt (já é a decisão do design doc §5) | O modelo já recebe "hoje é X" no system prompt — resolver isso fora do LLM duplicaria lógica e ainda erraria fusos/plurais em PT-BR |
| Rate-limit distribuído | Contador em memória / Redis novo | Reusar o padrão `count` sobre `assistant_usage` (ou tabela irmã) já usado em `api/assistant.js`/`api/_lib/admin/guard.js` | O projeto já resolveu esse problema 2x (assistant + admin) com o mesmo padrão fail-open de count — introduzir Redis só para o canal WhatsApp duplicaria infra sem necessidade |

**Key insight:** este projeto já tem 2 implementações de referência prontas para os problemas difíceis desta fase — `api/_lib/admin/guard.js` (guard fail-closed + rate-limit + audit) e `supabase/admin-backoffice.sql` (RPC service_role-only com REVOKE/GRANT). A fase 14 não inventa nada novo em termos de padrão de segurança — ela aplica os MESMOS padrões a uma superfície nova (webhook público em vez de painel autenticado).

## Achado crítico: bypass do rate-limit (WA-RATELIMIT-01) — reavaliar escopo

**Confidence: HIGH** — verificado por leitura direta do código atual + `git log -p`, não é WebSearch.

O todo `.planning/todos/pending/ratelimit-bypass-toolresults.md` descreve: *"`const isFirstCallOfTurn = !Array.isArray(toolResults) || toolResults.length === 0` — qualquer `toolResults` forjado pula o gate."* Essa linha **não existe mais** no `api/assistant.js` atual. O código em produção hoje (desde o commit `9abd83e`, "feat(12-02): reactivate WRITE tools, add honesty rules, and fix rate-limit bypass with nonce (B8)") é:

```javascript
// api/assistant.js:267-271 (HEAD atual)
const hasToolResults = Array.isArray(toolResults) && toolResults.length > 0;
const nonceValid = hasToolResults && clientNonce && NONCE_SECRET
  ? nonce.verify(clientNonce, userId, NONCE_SECRET)
  : false;
const isFirstCallOfTurn = !hasToolResults || !nonceValid;
```

Ou seja: `toolResults` forjado SEM um nonce válido (o atacante não tem o `ASSISTANT_NONCE_SECRET`) já cai em `isFirstCallOfTurn = true` e É contado. O vetor de bypass estrutural descrito no todo (pular o contador sempre que `toolResults` não for vazio) **está fechado**.

**O que ainda não está garantido (gap residual, não confirmado nem refutado nesta pesquisa):** `api/_lib/nonce.js` é HMAC stateless — sem armazenamento de nonces já usados (não há "jti" consumido). Um nonce válido, capturado de UMA resposta legítima do servidor, pode em teoria ser reenviado (replay) MÚLTIPLAS vezes dentro da janela de TTL de 120s, e cada replay dentro da janela também cairia em `isFirstCallOfTurn = false` (não contaria). Isso é uma janela de abuso muito menor que a original (limitada a 120s por nonce capturado, e exige já ter feito pelo menos 1 chamada contada para obter um nonce válido) — mas é tecnicamente distinto de "toda chamada conta".

**Recomendação para o planner:** não escrever uma task de "implementar fix do bypass" do zero. Escrever, em vez disso: (1) uma task de AUDITORIA — confirmar por teste manual/curl que o bypass estrutural está fechado no ambiente atual; (2) uma decisão explícita (Claude's Discretion já cobre isso) sobre se o gap residual do replay-dentro-do-TTL merece endurecimento agora (ex.: nonce de uso único via tabela leve, mesmo padrão de `wa_messages`) ou se é aceitável dado o escopo pequeno; (3) fechar o todo `ratelimit-bypass-toolresults.md` (mover para `done/` com nota do commit que resolveu, ou reabri-lo com o escopo revisado do gap residual). Isso é trabalho de ~meio plano, não um plano inteiro — ajusta a estimativa de esforço da fase.

## Common Pitfalls

### Pitfall 1: `export const config = { api: { bodyParser: false } }` não funciona fora do Next.js
**What goes wrong:** copiar um tutorial de webhook (Stripe/GitHub) que usa esse padrão, aplicar em `api/whatsapp.js`, e o body parser da Vercel continua populando `req.body` normalmente (silenciosamente ignorando o `config`) — a verificação HMAC passa a comparar contra bytes que não são os originais, e falha de forma intermitente/sempre dependendo do payload.
**Why it happens:** esse `config` export é documentado nos guias oficiais, mas é uma convenção específica do runtime Next.js (`pages/api`); este projeto NÃO usa Next.js — é `@vercel/node` puro.
**How to avoid:** ler o raw body via stream (`req.on('data'/'end')`) e nunca tocar em `req.body` antes disso no mesmo handler (Pattern 1 acima). Testar isoladamente com `vercel dev` + `curl` no Wave 0 do plano.
**Warning signs:** assinatura falha só em produção mas "funciona" num teste local que usa `JSON.stringify` para reconstruir o corpo — sinal de que o teste está mascarando o bug.

### Pitfall 2: `hub.challenge` respondido como JSON em vez de texto puro
**What goes wrong:** `res.json({ challenge })` ou `res.status(200).json(challenge)` no handshake GET — a Meta espera o valor cru no corpo, não envelopado em JSON. A verificação do webhook falha no dashboard da Meta mesmo com token correto.
**Why it happens:** reflexo de usar `res.json()` (padrão em toda a API REST do projeto) sem perceber que este é o único endpoint que precisa de resposta texto-puro.
**How to avoid:** `res.status(200).send(challenge)` (string), nunca `res.json()`, nesse caminho específico.

### Pitfall 3: `mesFaturaFor` porta mal para o servidor (formato de data e ano hardcoded)
**What goes wrong:** `mesFaturaFor(dStr, card, year = 2026)` em `assets/fides-data.jsx:52` espera `dStr` no formato BR `"dd/mm"` (split por `/`) e recebe `year` como parâmetro separado com **default hardcoded `2026`**. O parser do webhook (design doc §5) produz `data` em formato ISO `"YYYY-MM-DD"`. Portar a função ingenuamente (só fazer `require`) sem adaptar o formato de entrada, ou esquecer de passar o ano real extraído da data, gera fatura no ano errado silenciosamente a partir de janeiro/2027.
**Why it happens:** a função nunca precisou ser chamada fora do contexto do front, onde o ano corrente é sempre implícito/já resolvido por outro código.
**How to avoid:** ao extrair/compartilhar o módulo (design doc §6, "risco de drift"), escrever um adapter explícito que converta `YYYY-MM-DD` → `{dd/mm, year}` antes de chamar, e escrever teste de paridade comparando saída do front vs saída do servidor para casos conhecidos (inclusive o caso `closing_day > due_day` do FAT-01/Bradesco, já coberto na Phase 10).
**Warning signs:** qualquer transação lançada via WhatsApp em dezembro/janeiro indo para a fatura do ano errado.

### Pitfall 4: `assistant_usage` não distingue canal (chat in-app vs WhatsApp)
**What goes wrong:** CU-02 exige caps SEPARADOS para o canal WhatsApp (30/dia, 300/mês) dos caps do chat in-app (100/dia, 10/mês free). A tabela `assistant_usage` hoje (`supabase/schema.sql:144-148`, confirmado real via Phase 11) só tem `id, user_id, created_at` (+ colunas de telemetria) — nenhuma coluna de canal/origem. Um `count()` ingênuo sobre `assistant_usage` filtrado só por `user_id` misturaria os dois canais, violando CU-02 (um usuário que já gastou seu cap do chat ficaria travado no WhatsApp e vice-versa, quando a decisão é caps INDEPENDENTES).
**Why it happens:** a tabela foi desenhada só para o chat in-app; a fase 14 é o primeiro consumidor de um segundo canal.
**How to avoid:** migração `ALTER TABLE assistant_usage ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'chat'` (standalone, padrão do projeto) + todo INSERT do webhook grava `channel='whatsapp'` + todo `count()` filtra por `channel`. Alternativa mais isolada: tabela própria `wa_usage` — mais simples de raciocinar sobre RLS/REVOKE, mas duplica o padrão de contagem. Decisão fica a critério do planner (Claude's Discretion cobre "números finais dos caps", mas não decidiu explicitamente a modelagem da tabela — vale registrar como decisão do plano).
**Warning signs:** usuário premium reclama de "limite atingido" no WhatsApp logo após ter usado bastante o chat in-app no mesmo dia (ou vice-versa).

### Pitfall 5: at-least-once delivery + processamento síncrono pré-200
**What goes wrong:** assumir que "responder 200 rápido" permite processar em background depois — funções serverless da Vercel não garantem execução de código após a resposta ser enviada (sem infra de fila/`waitUntil` configurada nesta fase, que o design doc rejeita explicitamente como over-engineering, §8). Se o handler responder 200 e SÓ DEPOIS tentar gravar `wa_pending`/chamar Gemini, a instância pode ser reciclada antes de terminar — perdendo a transação sem erro visível.
**Why it happens:** confundir "responder rápido" com "responder e processar depois" — são coisas diferentes.
**How to avoid:** TODA a lógica (parse Gemini, INSERT wa_pending/transactions, envio da resposta) roda ANTES de `res.status(200)`. O orçamento de tempo é o timeout Meta (~5s) mais o `maxDuration` da função (hoje 30s no `assistant.js`; `whatsapp.js` precisa da própria entrada em `vercel.json`, valor sugerido ≤10s dado que o passo mais lento é 1 chamada Gemini ~1-2s + 2-3 round-trips Supabase).
**Warning signs:** transações "sumindo" sem log de erro, especialmente sob carga/cold start.

## Code Examples

Ver seção "Architecture Patterns" acima — os 5 patterns já incluem os exemplos de código mais importantes (raw body + HMAC, handshake GET, envio Graph API, RPC service-role, `responseSchema` do Gemini). Não há necessidade de exemplos adicionais fora desses núcleos.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| WhatsApp Business API on-premise / BSPs com markup (Twilio) | Meta Cloud API direta, mensagens de serviço grátis até 30/09/2026 | Cloud API é o padrão desde 2022; a mudança relevante para este projeto é a cobrança de mensagens de SERVIÇO anunciada por Meta para 01/10/2026 | Muda o cálculo de custo do design doc §10 (SUPERSEDED, já registrado no CONTEXT.md) — não muda a arquitetura |
| `pages/api` bodyParser config (Next.js) | Funções `@vercel/node` sem Next.js precisam de leitura manual de stream ou handler Web API | Sempre foi assim para projetos não-Next.js na Vercel — não é uma mudança recente, é uma diferença estrutural entre runtimes que este projeto (sem Next.js) precisa respeitar desde já | Define a abordagem obrigatória do Pattern 1 |
| Function calling para extração estruturada | `responseSchema`/`responseMimeType: application/json` (JSON mode nativo) | Suporte a `responseSchema` já está estável no Gemini API há tempo suficiente para ser o caminho recomendado pela documentação oficial em vez de function calling forçado só para extrair campos | Alinhado com a decisão já travada no design doc §5 ("saída estruturada, NÃO function calling") — a pesquisa só confirma a sintaxe |

**Deprecated/outdated:** nenhum item desta pesquisa aponta para uma abordagem obsoleta sendo usada no design atual — o design doc §1-§10 já está alinhado com as práticas correntes confirmadas aqui.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Leitura manual do stream (`req.on('data'/'end')`) funciona de forma estável em funções `@vercel/node` puras (sem Next.js) para o volume de tráfego deste projeto | Pattern 1 / Pitfall 1 | Se instável (relatos de "socket hangup" existem), a validação HMAC falharia de forma intermitente — bloquearia mensagens legítimas ou (pior) levaria a desabilitar a checagem "temporariamente". Mitigação: testar em Wave 0 antes de integrar. |
| A2 | Node runtime da Vercel para este projeto é 20.x (não fixado em `vercel.json`/`package.json`) e portanto tem `fetch`/`crypto.timingSafeEqual` globais | Standard Stack | Baixo risco real — `api/_lib/gemini.js` e `api/_lib/nonce.js` já usam `fetch` e `crypto` em produção hoje, então isso já está implicitamente provado, mesmo sem confirmação explícita da versão exata |
| A3 | `responseSchema` + `toolConfig.functionCallingConfig.mode:'NONE'` no mesmo payload `generateContent` não geram conflito/erro 400 | Pattern 5 | Se conflitarem, o parser quebra sempre (erro 400 sistemático) — descoberto rápido em teste manual, baixo custo de correção, mas deve ser validado ANTES de integrar ao handler completo |
| A4 | Janela de retry da Meta é "aproximadamente 5s para a resposta HTTP" e retry subsequente com backoff por um período indeterminado (fontes divergem entre 24-36h e 7 dias) | Common Pitfalls / State of the Art | Risco baixo para este design — o dedupe por `wamid` já trata qualquer retry como no-op, independente da janela exata; só afeta expectativa de "quanto tempo uma falha prolongada do webhook fica sendo reintentada" |
| A5 | O gap residual de replay-de-nonce-dentro-do-TTL (§"Achado crítico") é aceitável sem hardening adicional nesta fase | Achado crítico | Se um atacante conseguir capturar um nonce válido (ex.: via XSS ou log vazado) tem uma janela de 120s para inflar a cota sem contar — impacto de custo limitado, não é um vetor crítico de segurança de dados |

**Se esta tabela estivesse vazia:** não é o caso — vários pontos de mecânica (raw body, compatibilidade de schema Gemini) não foram confirmados com fonte primária nesta sessão (sem acesso a Context7/MCP) e precisam de validação prática no início da execução da fase.

## Open Questions

1. **Raw body em `@vercel/node` puro é realmente estável para este caso de uso?**
   - What we know: é a abordagem oficialmente documentada pela Vercel para funções não-Next.js (ler o stream de `req`); existe também um caminho alternativo via handler Web API.
   - What's unclear: relatos de comunidade (não oficiais) mencionam instabilidade ("socket hangup") em cenários não especificados — não ficou claro se isso afeta volumes baixos como os deste projeto (bot pessoal + poucos beta testers).
   - Recommendation: Wave 0 do plano deve incluir um teste isolado (`vercel dev` + `curl -X POST` com um corpo JSON simulando o payload da Meta, checando que os bytes recebidos batem com os bytes enviados) antes de integrar a lógica de negócio.

2. **`responseSchema` do Gemini funciona sem alteração no `buildPayload` atual de `api/_lib/gemini.js`?**
   - What we know: `buildPayload` já aceita `generationConfig` arbitrário (é repassado sem transformação) — não há razão estrutural para não funcionar.
   - What's unclear: nunca foi exercitado em produção neste projeto; a combinação com `toolMode: 'NONE'` especificamente não tem precedente de teste.
   - Recommendation: teste isolado com `curl` direto ao endpoint `generateContent` (fora do handler) antes de integrar — mesmo espírito do item 1.

3. **Modelagem do cap separado do canal WhatsApp (CU-02): coluna `channel` em `assistant_usage` ou tabela `wa_usage` própria?**
   - What we know: qualquer uma das duas resolve o requisito funcional (Pitfall 4).
   - What's unclear: qual tem menor risco de regressão nas queries existentes de `api/assistant.js`/`api/_lib/admin/accounts.js` (que já fazem `count()` sobre `assistant_usage` sem filtro de canal — adicionar uma coluna NOT NULL DEFAULT muda o comportamento de queries antigas só se elas também precisarem excluir o canal WhatsApp, o que hoje NÃO fazem, então provavelmente é seguro, mas não foi auditado linha a linha nesta pesquisa).
   - Recommendation: planner decide na modelagem SQL da fundação; se optar por coluna nova em `assistant_usage`, auditar os `count()` existentes em `api/assistant.js` (linhas 279-283, 301-305) e `admin_list_accounts` (`ai_msgs_month`, `admin-backoffice.sql:109-111`) para confirmar que continuam corretos incluindo a nova coluna (provavelmente sim, pois já filtram por `user_id`+janela de tempo, não por canal — mas checar).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Conta Meta Business + app WhatsApp Cloud API (test number) | WA-WEBHOOK-01, WA-OPTIN-01, setup dev/UAT | ✗ (não verificável nesta sessão — depende de ação do dono no `business.facebook.com`) | — | Nenhum — é pré-requisito de calendário para começar o dev/UAT (TE-02/adendo D-8 já mapeiam o caminho sem CNPJ); deve ser o PRIMEIRO passo humano do plano, em paralelo com a fundação SQL |
| `WA_VERIFY_TOKEN`, `WA_APP_SECRET`, system-user access token | WA-WEBHOOK-01 | ✗ (env vars ainda não existem no Vercel Project) | — | Nenhum — bloqueante para deploy funcional; checkpoint humano necessário (mesma classe do `ASSISTANT_NONCE_SECRET` pendente de verificação em produção, já registrado em STATE.md) |
| Node runtime Vercel com `fetch`/`crypto.timingSafeEqual` globais | Todos os patterns | ✓ (implícito — `api/_lib/gemini.js`/`nonce.js` já usam em produção) | não fixada explicitamente (assumido 20.x) | — |
| `GEMINI_API_KEY` (tier pago) | WA-PARSE-01 | ✓ (já configurado — usado por `api/assistant.js` em produção) | — | — |
| Acesso MCP Supabase para o subagente executor | Fundação SQL (migrações + RPC) | ✗ (memória do projeto: `mcp-supabase-subagente-inline.md` — gsd-executor não acessa `mcp__supabase__*`; servidor roda `--read-only`, bloqueia `apply_migration`) | — | Planos MCP-dependentes rodam INLINE no orquestrador (não no subagente executor); `--read-only` exige checkpoint humano ou ajuste de flag antes de `apply_migration` — mesma situação documentada no bloqueio da Phase 16-01 |

**Missing dependencies with no fallback:**
- Conta/app Meta Business + test number configurado — bloqueia qualquer teste ponta-a-ponta do webhook. Recomenda-se iniciar esse setup em paralelo com o planejamento (não é trabalho de código, é ação humana no dashboard da Meta).
- Env vars `WA_VERIFY_TOKEN`/`WA_APP_SECRET`/token do system user no Vercel Project — bloqueia deploy funcional (mesmo que o código esteja pronto).

**Missing dependencies with fallback:**
- MCP Supabase indisponível ao subagente executor — fallback já estabelecido (execução inline no orquestrador + checkpoint humano para `apply_migration`), mesmo padrão usado nas Phases 13/16.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Nenhum framework de teste automatizado no repositório (sem `pytest.ini`/`jest.config.*`/`vitest.config.*`, sem diretório `test/`/`tests/`/`__tests__/`, `package.json` sem script `test`) — confirmado por busca no repositório |
| Config file | Nenhum — projeto usa verificação manual via `curl` + UAT conversacional (`/gsd-verify-work`), consistente com o restante do projeto (sem build step, CLAUDE.md) e com o precedente já registrado em `.planning/phases/16-painel-admin-backoffice/16-RESEARCH.md` |
| Quick run command | `curl` direto contra o endpoint deployado (comandos por requisito abaixo) |
| Full suite command | `/gsd-verify-work 14` (UAT conversacional) + checklist de security-reviewer/database-reviewer (caminho sensível, CLAUDE.md) |

**Gap identificado:** mesmo gap estrutural já documentado nas Phases 11-16 — não é introduzido por esta fase. A verificação de webhook público tem uma particularidade adicional: parte dela (handshake GET, assinatura HMAC) só pode ser testada de ponta-a-ponta com o app Meta real configurado (test number) — não é possível simular o `X-Hub-Signature-256` real sem o App Secret verdadeiro, mas É possível (e recomendado) simular localmente com um secret de teste próprio para validar a MECÂNICA de comparação antes de ligar ao Meta real.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Comando manual (curl) | Arquivo existe? |
|--------|----------|-----------|-------------------------|------------------|
| WA-WEBHOOK-01 | Handshake GET aceita token correto | smoke | `curl "https://<deploy>/api/whatsapp?hub.mode=subscribe&hub.verify_token=<WA_VERIFY_TOKEN>&hub.challenge=teste123"` → espera corpo `teste123`, texto puro, 200 | ❌ — endpoint não existe ainda |
| WA-WEBHOOK-01 | Handshake GET rejeita token errado | smoke | mesmo comando com `hub.verify_token=errado` → espera 403 | ❌ |
| WA-WEBHOOK-01 | POST com assinatura inválida → 401, sem processar | smoke | `curl -X POST -H "X-Hub-Signature-256: sha256=lixo" -d '{"teste":1}' https://<deploy>/api/whatsapp` → 401, sem linha nova em `wa_messages` (checar via MCP) | ❌ |
| WA-WEBHOOK-01 | POST com assinatura válida (calculada com o App Secret real) → 200, processa | smoke (requer script auxiliar de assinatura, não só curl puro) | script Node curto: `crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')`, montar header, enviar via `fetch`/curl | ❌ |
| WA-WEBHOOK-01 | Retry (`wamid` repetido) não duplica processamento | manual (SQL) | enviar o mesmo payload 2x → checar `select count(*) from wa_messages where wamid=...` = 1, e `transactions` não duplicou | ❌ |
| WA-GATE-01 | Número desconhecido → resposta estática, sem LLM, cap 3/dia | smoke | enviar mensagem de número não vinculado → checar resposta estática + confirmar (log/telemetria) que `callGemini` NÃO foi invocado | ❌ |
| WA-GATE-01 | Usuário free vinculado → resposta de upgrade, sem LLM | smoke | mesma lógica, com `profiles.plan='free'` de teste | ❌ |
| WA-PARSE-01 | Mensagem sem valor explícito → pergunta o valor, não grava | manual (UAT) | mandar "gastei no mercado" (sem valor) → bot pergunta o valor, nenhuma linha nova em `transactions` | ❌ |
| WA-PARSE-01 | Guarda determinística: valor do LLM não bate com regex da mensagem → força `confianca:baixa` | manual (UAT) | mensagem ambígua construída deliberadamente para induzir erro de extração — confirmar que o card de confirmação reflete baixa confiança | ❌ |
| WA-CONFIRM-01 | Nenhum insert acontece sem "1"/"sim" | manual (UAT) | mandar transação válida, NÃO confirmar, esperar expirar (10 min) → `transactions` sem linha nova, `wa_pending` expirada | ❌ |
| WA-INSERT-01 | RPC `wa_log_transaction_service` só executável por `service_role` | manual (SQL) | `select public.wa_log_transaction_service(...)` logado como `authenticated` no SQL Editor → deve falhar (`permission denied for function`) | ❌ |
| WA-INSERT-01 | Owner-guard rejeita conta/cartão de outro usuário | manual (SQL) | chamar a RPC com `p_user_id` de um usuário e `p_account_id` de outro → deve `raise exception 'CONTA'` | ❌ |
| WA-RATELIMIT-01 | Cap diário/mensal do canal WhatsApp é respeitado e SEPARADO do chat in-app | manual (SQL + UAT) | inflar `assistant_usage`/`wa_usage` de teste até o teto → confirmar 429/resposta de limite; confirmar que o chat in-app do MESMO usuário não foi afetado (ou foi, dependendo da modelagem escolhida — Open Question 3) | ❌ |

### Sampling Rate
- **Per task commit:** `curl` smoke test do endpoint recém-tocado (handshake, assinatura, ou RPC via SQL Editor conforme a task).
- **Per wave merge:** rodar toda a tabela acima que já tiver pré-requisitos deployados.
- **Phase gate:** `/gsd-verify-work 14` completo + PASS de security-reviewer/database-reviewer antes de considerar a fase fechada (caminho sensível, obrigatório pelo CLAUDE.md e pelo CONTEXT.md).

### Wave 0 Gaps
- [ ] Setup Meta Business + app + test number (ação humana, fora de código) — bloqueia todo teste de ponta-a-ponta.
- [ ] Protótipo isolado de raw-body + HMAC (Pattern 1) — validar ANTES de integrar ao handler completo (Open Question 1).
- [ ] Protótipo isolado de `responseSchema`+`toolMode:'NONE'` no `generateContent` (Pattern 5) — validar ANTES de integrar (Open Question 2).
- [ ] `WA_VERIFY_TOKEN`/`WA_APP_SECRET`/token permanente no Vercel Project (env vars, aba Project) — checkpoint humano, mesma classe do `ASSISTANT_NONCE_SECRET` já pendente.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | Não no sentido tradicional (webhook não usa JWT de usuário) — a "autenticação" do request é a assinatura HMAC da Meta | `X-Hub-Signature-256` + `crypto.timingSafeEqual` (Pattern 1) |
| V3 Session Management | Não aplicável — sem sessão de usuário; identidade resolvida por `phone → profiles.id` a cada mensagem | — |
| V4 Access Control | Sim | Gating premium (`profiles.plan`) fail-closed ANTES do LLM (mesmo padrão GATE-02/03 de `api/assistant.js`); RPC service_role-only com REVOKE explícito (V4.2 — least privilege) |
| V5 Input Validation | Sim | Guarda determinística de valor (regex sobre a mensagem original, não confiar cegamente no LLM); validação de `hub.mode`/`hub.verify_token` no handshake; parsing de `intent`/campos via `responseSchema` restringe o shape da resposta do LLM |
| V6 Cryptography | Sim | HMAC-SHA256 nunca hand-rolled — usa `crypto` builtin do Node (mesmo padrão já em produção em `api/_lib/nonce.js`) |
| V9 Communications | Sim (implícito) | Segredos (App Secret, token permanente, verify token) só em env vars da aba Project do Vercel — nunca no repo, nunca no client (mesma regra do `inject-config.js`) |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Webhook forjado sem assinatura válida | Spoofing | HMAC-SHA256 sobre raw body + comparação constant-time; 401 antes de qualquer processamento (Pattern 1) |
| Replay de payload de webhook antigo capturado | Replay/Tampering | Dedupe por `wamid` (idempotência, at-most-once do lado do processamento) + descarte de mensagens com `timestamp` muito antigo (design doc §3.4) |
| Confused deputy via `p_user_id` na RPC service_role | Elevation of Privilege | REVOKE explícito de `authenticated`/`anon`, GRANT só a `service_role`; único chamador possível é `api/whatsapp.js` pós-resolução de identidade por `phone` verificado no opt-in |
| Enumeração de números vinculados via resposta diferenciada | Information Disclosure | Resposta estática idêntica para "número desconhecido" (nunca revela se existe conta) — já decidido no design doc §4 |
| Flood do endpoint público do webhook (não-vinculados martelando) | Denial of Service | Cap 3/dia/número não-vinculado (design doc §3.7) — mesma classe de mitigação do throttle `denied_access` em `api/_lib/admin/guard.js` |
| Replay de nonce dentro da janela TTL para inflar cota | Repudiation/DoS de custo (baixo impacto) | Ver "Achado crítico" acima — gap residual conhecido, decisão de hardening fica com o planner |

## Sources

### Primary (HIGH confidence)
- Leitura direta do código do repositório: `api/assistant.js`, `api/_lib/gemini.js`, `api/_lib/nonce.js`, `api/admin.js`, `api/_lib/admin/guard.js`, `supabase/admin-backoffice.sql`, `supabase/wa-log-transaction.sql`, `supabase/schema.sql`, `assets/fides-data.jsx`, `assets/fides-store.jsx`, `vercel.json`, `package.json`/`package-lock.json`, `docs/admin-lgpd.md`.
- `git log -p -- api/assistant.js` (commit `9abd83e`) — confirma que o fix do rate-limit bypass já foi aplicado na Phase 12.
- `.planning/research/whatsapp-e-ia-arquitetura.md` (design doc canônico, Parte A §1-§10 + adendo D-8) e `14-CONTEXT.md` — fonte da arquitetura e das decisões travadas.

### Secondary (MEDIUM confidence)
- developers.facebook.com/documentation/business-messaging/whatsapp/webhooks (via WebSearch) — estrutura do payload, handshake GET, assinatura.
- developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/ (via WebSearch) — endpoint de envio.
- ai.google.dev/gemini-api/docs/structured-output (via WebSearch) — sintaxe `responseSchema`.
- vercel.com/kb/guide/how-do-i-get-the-raw-body-of-a-serverless-function + vercel.com/docs/functions/configuring-functions/duration (via WebSearch) — raw body e limites de duração.
- Relatos de comunidade sobre erro #131030 e formatação de número BR (via WebSearch, múltiplas fontes convergentes).

### Tertiary (LOW confidence)
- Relatos de comunidade (GitHub Discussions/Medium) sobre instabilidade de leitura manual de stream fora do Next.js ("socket hangup") — não confirmado em fonte oficial, tratado como risco a testar, não como fato.
- Janela exata de retry da Meta (7 dias vs 24-36h) — fontes divergem, tratado como aproximação, não como parâmetro de design.

## Metadata

**Confidence breakdown:**
- Mecânica do webhook (payload/handshake/assinatura): MEDIUM — WebSearch contra documentação oficial, sem verificação via Context7/MCP nesta sessão (indisponível).
- Padrão RPC service_role-only / gate fail-closed: HIGH — leitura direta de código já revisado e em produção neste repositório.
- Achado do rate-limit bypass já fechado: HIGH — `git log -p` + leitura do HEAD atual.
- Raw body em função Vercel CommonJS pura: LOW/MEDIUM — maior incerteza da pesquisa, recomendado prototipar em Wave 0.
- Gemini `responseSchema`: MEDIUM — sintaxe documentada oficialmente, mas combinação específica com `toolMode:'NONE'` não testada neste projeto.

**Research date:** 2026-07-17
**Valid until:** 30 dias para a mecânica de API (Meta/Gemini/Vercel mudam com pouca frequência estrutural) — mas a janela de custo/cobrança da Meta (01/10/2026) já está registrada como re-verificação obrigatória (CU-03) independente desta pesquisa.
