# Phase 12: IA-2 Destravar WRITE no assistente in-app (B8) - Research

**Researched:** 2026-07-08
**Domain:** Reativação de function calling WRITE (Gemini) num assistente já em produção — RPC Postgres atômica, HMAC anti-replay stateless, honestidade em prompts de IA
**Confidence:** HIGH (a maior parte do trabalho é ligar código morto já existente + espelhar padrões SQL já em produção; os 2 pontos genuinamente novos — nonce e RPC — têm precedente direto no próprio repositório)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Caminho de insert (lancar_transacao)**
- **D-01:** Nova RPC `wa_log_transaction(p_user_id, ...)` SECURITY DEFINER (mesmo padrão de guarda de `pay_card_invoice`) é o único caminho de insert usado por `lancar_transacao`. Ela deve fazer atomicamente o que hoje `addTransaction` faz em passos separados: INSERT da linha + `recalc_account_balance` (conta) + update de `cards.used` (cartão) — hoje esse último é um SELECT+UPDATE manual não-atômico, a RPC corrige isso.
- **D-02:** A RPC é **isolada para o assistente** — não substitui `addTransaction` usado pelo modal "Nova Transação" nesta fase. Migrar o modal ficaria para uma fase de hardening dedicada, fora do escopo aqui (reduz blast radius / risco de regressão em fluxo já estável em produção).

**Caminho de update (recategorizar_transacao / editar_transacao)**
- **D-03:** Essas duas tools **continuam usando `updateTransaction` existente** (client update com RLS) — não ganham RPC dedicada. Update simples já é seguro (RLS restringe ao dono); não há mutação incremental de saldo em jogo como no insert.

**Categoria nova durante lançamento**
- **D-04:** Se `lancar_transacao` recebe uma categoria que não mapeia na lista fechada, o fluxo vira **1 confirmação só**: o card de confirmação mostra "vou criar categoria X e lançar" — usuário confirma uma vez, servidor cria a categoria (mesma lógica de `criar_categoria`) e lança a transação junto. Não manter o fluxo de 2 passos manuais que existe hoje no client (`resolveWriteToolArgs` retorna erro pedindo para criar categoria primeiro).

**Escopo de editar_transacao**
- **D-05:** `editar_transacao` fica restrito a `valor`/`descricao`/`data`/`status` — **NÃO** ganha campo para trocar `conta_ou_cartao` nesta fase. `updateTransaction` (store) já suporta esse patch — só não é exposto pela tool do assistente.

**Rate-limit bypass (fold do todo `ratelimit-bypass-toolresults`)**
- **D-06:** `api/assistant.js` conta o gate de `USER_DAILY_LIMIT` só na "primeira chamada do turno" (`isFirstCallOfTurn = !toolResults || toolResults.length === 0`) — qualquer request autenticado que mande um `toolResults` forjado pula o gate inteiro. Fix travado: **nonce assinado stateless (JWT/HMAC curto, exp ~30-60s)**. O servidor emite o nonce junto da resposta que contém `tool_calls`; o request seguinte só pula o gate de rate-limit se apresentar um nonce válido e não-expirado. Sem tabela nova, sem estado no banco.

### Claude's Discretion
- Nome/formato exato do nonce (claim set do JWT, algoritmo HMAC vs assinatura Supabase existente) — pesquisa/planner decide, desde que stateless e expiração curta.
- Estrutura interna da RPC `wa_log_transaction` (parâmetros exatos, nomes) — espelhar `pay_card_invoice` como referência de padrão.

### Deferred Ideas (OUT OF SCOPE)
- Número da parcela do mês em compras parceladas (transações) — registrado para virar fase própria no roadmap de Transações.
- Migrar o modal "Nova Transação" (`addTransaction`) para usar `wa_log_transaction` também → fase de hardening dedicada (D-02).
- Trocar conta/cartão de uma transação via chat → fica só no modal do app (D-05).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WRITE-01 | Usuário lança uma transação (despesa/receita) via chat, com confirmação obrigatória, insert atômico via `wa_log_transaction` | §"Código a modificar" (RPC draft), §"Common Pitfalls" P1/P2/P4, §"Code Examples" |
| WRITE-02 | Usuário recategoriza uma transação existente via chat, com confirmação obrigatória, via `updateTransaction` (D-03) | Já implementado em `resolveWriteToolArgs`/`executeWriteTool` (`fides-claude.jsx:316-328,365-368`) — só religar servidor |
| WRITE-03 | Usuário edita valor/descrição/data/status de uma transação via chat, com confirmação obrigatória, escopo restrito por D-05 | Já implementado (`fides-claude.jsx:329-338,369-381`) — confirma escopo já correto (sem `conta_ou_cartao`) |
| WRITE-04 | Usuário cria uma categoria nova via chat (standalone OU bundlada em WRITE-01 via D-04) | §"Common Pitfalls" P5 (toast falso), §"Open Questions" Q1 (criar_categoria deve exigir confirmação?) |
| HONEST-01 | O assistente nunca "chuta" valor/conta/categoria; confiança baixa → pede confirmação explícita em vez de assumir | §"System Prompt de escrita" (Code Examples), guarda determinística já existente em `findAccountByName`/`findCategoryByName` |
| DERIVED-SAFE-01 (a formalizar) | Todo insert/update via chat respeita o modelo de saldo derivado (nunca mutação incremental direta fora de RPC/`recalc_account_balance`) e a convenção `mesFaturaFor` de fechamento de fatura para transações de cartão | §"Código a modificar" (RPC draft), §"Common Pitfalls" P2 (mês hard-coded), P4 (cartão inconsistente) |

**DERIVED-SAFE-01 — formalização proposta:** "Nenhum caminho de escrita do assistente (RPC `wa_log_transaction`, `updateTransaction` para recategorizar/editar) grava saldo (`accounts.balance`, `cards.used`) por mutação incremental direta em JS; toda alteração de saldo passa por `recalc_account_balance` (RPC) ou pela própria `wa_log_transaction` (que replica o padrão atômico de `pay_card_invoice`). Toda transação de cartão lançada via chat usa `month` computado por `mesFaturaFor`/`ensureMes` a partir da **data real da transação**, nunca do mês atualmente selecionado na UI (`selectedMonth`)." — `[ASSUMED]`, precisa confirmação do usuário/planner ao formalizar o requisito no ROADMAP/REQUIREMENTS.
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Diretivas acionáveis de `./CLAUDE.md` aplicáveis a este phase (têm a mesma autoridade de uma decisão travada em CONTEXT.md — o plano não pode contradizê-las):

| Diretiva | Fonte | Aplicação neste phase |
|---|---|---|
| Frontend via HTML + React Babel-standalone no browser — sem bundler/lint/types hoje | CLAUDE.md §Stack | Nenhum passo de build a introduzir; `nonce.js`/`wa_log_transaction` seguem CommonJS puro / SQL puro, sem TypeScript/JSX transpilado fora do padrão existente |
| Backend = Supabase; schema real vive no banco, `supabase/*.sql` pode estar desatualizado — a verdade é o MCP Supabase (ROADMAP B10) | CLAUDE.md §Stack | Confirmado neste research: `schema.sql` está comprovadamente stale (faltam `settled`/`paid_at`/`is_transfer`/`transfer_group`/`opening_balance`). A RPC `wa_log_transaction` final DEVE ser verificada contra o schema live via MCP antes do commit — não basta espelhar `derived-balance.sql` (ver A3) |
| `api/assistant.js` tools **READ-only** — WRITE proibido até fundação validada (ROADMAP B8) | CLAUDE.md §Stack | Este é exatamente o gate que este phase abre — a restrição deixa de valer a partir daqui, mas só para as 4 tools especificadas (D-01..D-05), não um "tudo liberado" |
| Deploy: push direto na `main` → Vercel auto-deploy; commit + push o mais automático possível | CLAUDE.md §Stack | Nenhuma dependência de deploy atômico multi-arquivo como na fase 11 (WR-03) foi identificada aqui — servidor e cliente mudam juntos (tools + nonce), mas não há quebra imediata de compat se subirem separados (nonce ausente só degrada para "cobra cota", nunca erro 4xx/5xx) |
| Ao tocar `api/` ou `supabase/`, rodar revisão de segurança antes de commitar (auth, RLS, RPCs, chaves/env, superfície do assistente IA) | CLAUDE.md §Segurança | Este phase toca os dois — `security-reviewer` + `database-reviewer` obrigatórios (ver Validation Architecture / Security Domain) |
| Nunca commitar segredos; `inject-config.js` é a ponte de config — não hardcode chaves | CLAUDE.md §Segurança | `ASSISTANT_NONCE_SECRET` novo vai em env var Vercel Project, nunca no repo (mesma regra de `GEMINI_API_KEY`) |
| Movimentação vs despesa: compra = despesa; pagamento de fatura = movimentação (`is_transfer`) | CLAUDE.md §Convenções | `wa_log_transaction` só lança despesas/receitas normais (`is_transfer=false`) — nunca deve ser usada para pagamento de fatura (isso continua sendo só `pay_card_invoice`, fora do escopo das tools do assistente) |
| Dashboard live = `DashboardStudio`; UI base = `fides-ui` — evitar `confirm()`/`alert()` residuais (ROADMAP B9) | CLAUDE.md §Convenções | O card de confirmação já usa componentes próprios (`cla-confirm-card`), não `confirm()` nativo — manter esse padrão nas correções de P5/P6, nunca introduzir `alert()`/`confirm()` |
| React via Babel-standalone: cuidado com Rules of Hooks (já causou bug na Phase 07) | CLAUDE.md §Convenções | Qualquer novo `useState`/`useEffect` para guardar o nonce recebido em `fides-claude.jsx` deve ficar no topo do componente, nunca condicional — mesma disciplina já aplicada em `07-03` (fix de Rules of Hooks documentado em STATE.md) |

## Summary

Este phase é, na sua maior parte, **religar código que já existe** — as 4 tools WRITE (`lancar_transacao`, `recategorizar_transacao`, `editar_transacao`, `criar_categoria`) e o card de confirmação já estão implementados em `assets/fides-claude.jsx` desde antes do FIX-3 (commit `6018f66`, jun/2026) que as removeu do lado servidor. Restaurar `TOOLS_DECLARATION` + o trecho do `SYSTEM_PROMPT` em `api/assistant.js` (revertendo exatamente o que `6018f66` fez) é a maior parte do trabalho mecânico — o diff desse commit foi lido neste research e serve de referência quase literal para o "voltar como era".

Só que "voltar como era" não é suficiente: o próprio código morto que sobrou no cliente carrega **dois bugs ativos** que reproduziriam parte dos bugs de v7 se religados sem correção — (1) `executeWriteTool` para `lancar_transacao` grava `mes: selectedMonth` (o mês que a UI está exibindo) em vez de derivar o mês da data real da transação, exatamente a classe de bug que motivou o FIX-1 original; e (2) o executor de `criar_categoria` chama `addCategory` **sem `await`** e mostra o toast de sucesso imediatamente, antes de qualquer confirmação real do Supabase — reproduzindo a "toast falso" do UAT. Achados verificados por leitura direta do código, não por suposição.

Os dois itens genuinamente novos deste phase — a RPC `wa_log_transaction` (D-01) e o nonce anti-replay do rate limit (D-06) — têm precedente direto e forte no próprio repositório: `pay_card_invoice`/`delete_transaction`/`recalc_account_balance` em `supabase/derived-balance.sql` já mostram o padrão exato de RPC `SECURITY DEFINER` com guarda de dono e recálculo derivado a seguir; e a verificação de assinatura HMAC + janela de expiração recomendada para o nonce é o MESMO padrão já desenhado (embora ainda não implementado) para a validação do webhook do WhatsApp na Fase 14 (`whatsapp-e-ia-arquitetura.md §3`).

**Primary recommendation:** Trate este phase como "restaurar + corrigir 2 bugs latentes + adicionar 2 mecanismos novos (RPC atômica, nonce HMAC)" — não como construção nova. Toda a superfície de UI (card de confirmação, `TOOLS_REQUIRING_CONFIRMATION`, loop de `executeTools`) já está correta e não deve ser redesenhada.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Declaração das tools WRITE + system prompt de honestidade | API / Backend (`api/assistant.js`) | — | Único ponto que fala com o Gemini; decide quais tools existem nesta versão do produto |
| Resolução de argumentos (nome→UUID) e card de confirmação | Browser / Client (`fides-claude.jsx`) | — | Precisa dos dados já carregados no store (contas/cartões/categorias) e da interação humana (confirmar/cancelar) — não pode ser round-trip de servidor |
| Insert atômico de transação nova (`lancar_transacao`) | Database / Storage (RPC `wa_log_transaction`) | Browser (chama a RPC via `window.fidesDb.rpc`) | Atomicidade (insert + recalc + `cards.used`) só é garantida dentro de uma função Postgres; o client apenas invoca com os UUIDs já resolvidos |
| Update de transação existente (recategorizar/editar) | Browser / Client (`updateTransaction` existente) | Database (RLS) | D-03: já é seguro via RLS, sem mutação de saldo — não precisa de RPC nova |
| Criação de categoria | Browser / Client (`addCategory` existente) | Database (RLS, `user_categories`) | Escrita simples, sem lógica de saldo — mas precisa corrigir o `await` ausente (P5) |
| Gate de rate-limit + nonce anti-replay | API / Backend (`api/assistant.js`) | — | Stateless por design (D-06) — verificação de assinatura pura, sem tocar banco |
| Honestidade / anti-alucinação (valor, conta, categoria) | API / Backend (system prompt) | Browser (`findAccountByName`/`findCategoryByName` como guarda determinística) | Dupla camada: o prompt instrui o modelo a não chutar, e o código já falha fechado (erro explícito) se o nome não casar — nenhuma das duas camadas é suficiente sozinha |

## Standard Stack

Nenhuma biblioteca nova é necessária neste phase.

| Necessidade | Solução | Por quê |
|---|---|---|
| Assinatura/verificação do nonce (D-06) | Módulo `crypto` nativo do Node (`createHmac`, `timingSafeEqual`) | Já é o padrão usado no design do webhook WhatsApp (`whatsapp-e-ia-arquitetura.md §3`, HMAC-SHA256 do `X-Hub-Signature-256`); evita adicionar `jsonwebtoken` só para um payload curto. `[CITED: nodejs.org/api/crypto.html]` |
| RPC atômica (D-01) | PL/pgSQL `SECURITY DEFINER`, mesmo padrão de `pay_card_invoice`/`delete_transaction`/`recalc_account_balance` (`supabase/derived-balance.sql`) | Já em produção, já revisado por `database-reviewer` em fases anteriores |
| Chamada Gemini | `api/_lib/gemini.js` (extraído na Fase 11, AI-SHARED-01) | Reutilizar `buildPayload`/`callGemini`/`parseResponse` sem alteração de assinatura |

**Instalação:** nenhuma — `package.json` permanece com só `@supabase/supabase-js` + `ws`. `[VERIFIED: leitura direta de package.json]`

## Package Legitimacy Audit

**Não aplicável — este phase não introduz nenhum pacote npm novo.** O nonce usa `crypto` (built-in Node), a RPC é SQL puro executado via `window.fidesDb.rpc` (client Supabase já em uso). Nenhuma linha de `package.json` muda.

## Architecture Patterns

### System Architecture Diagram — fluxo de escrita via chat

```
┌─────────────┐  1. mensagem            ┌──────────────────┐  2. Gemini decide      ┌─────────┐
│   Usuário    │ ───────────────────────▶│ fides-claude.jsx │───────────────────────▶│ Gemini  │
│  (browser)   │                         │  callAssistant() │  tool_calls (AUTO)     │2.5 Flash│
└─────────────┘                         └──────────┬────────┘◀───────────────────────│  Lite   │
       ▲                                            │  3. resposta: {tool_calls,     └─────────┘
       │                                            │     nonce_novo}
       │  8. reply / toast                          ▼
       │                                 ┌────────────────────────┐
       │                                 │ resolveWriteToolArgs()  │  4. resolve nomes→UUID
       │                                 │ (findAccountByName etc) │     via store já carregado
       │                                 └───────────┬─────────────┘
       │                                             │  5. resolved !error?
       │                                             ▼
       │                                 ┌────────────────────────┐
       └─────────────────────────────────│ Card de confirmação     │  6. usuário confirma/cancela
                                          │ (renderConfirmationCard)│     (SEMPRE obrigatório)
                                          └───────────┬─────────────┘
                                                       │ confirm
                                    ┌──────────────────┼───────────────────┐
                                    ▼                  ▼                   ▼
                        lancar_transacao   recategorizar/editar     criar_categoria
                                    │                  │                   │
                                    ▼                  ▼                   ▼
                        window.fidesDb.rpc(     updateTransaction()   addCategory()
                        'wa_log_transaction')    (client + RLS)       (client + RLS)
                                    │                  │                   │
                                    ▼                  ▼                   ▼
                          INSERT + recalc_account_balance   UPDATE transactions   INSERT user_categories
                          + cards.used (1 transação SQL)     + recalc (se conta)
                                    │                  │                   │
                                    └──────────────────┴───────────────────┘
                                             7. await conclui ANTES do toast/toolResult
                                                       │
                                                       ▼
                                          9. POST /api/assistant (toolResults + nonce_novo)
                                             servidor valida nonce → pula rate-limit gate
                                             SE inválido/expirado/ausente → conta como
                                             "primeira chamada do turno" (fail-safe: cobra cota,
                                             nunca bloqueia)
```

### Recommended Project Structure

Nenhum arquivo novo de aplicação — todo o trabalho é edição in-place:

```
api/
├── assistant.js       # TOOLS_DECLARATION restaurado + system prompt de escrita + gate nonce (D-06)
└── _lib/
    ├── gemini.js       # inalterado (AI-SHARED-01, fase 11)
    └── nonce.js         # NOVO — sign()/verify() do nonce HMAC (sugestão de local: mesma convenção _lib/ não-roteável)
assets/
├── fides-claude.jsx    # corrige P2 (mês hard-coded), P5 (toast falso); adiciona fluxo D-04 (categoria bundlada)
└── fides-store.jsx     # nenhuma mudança estrutural — só o novo call site window.fidesDb.rpc('wa_log_transaction', ...)
supabase/
└── schema.sql          # nova função wa_log_transaction (mesma seção de derived-balance.sql/pay_card_invoice)
```

### Pattern 1: RPC atômica com guarda de dono (mirror de `pay_card_invoice`)

**What:** Toda escrita que precisa ser atômica (insert + efeito colateral em saldo) vira uma função PL/pgSQL `SECURITY DEFINER` que (a) resolve `auth.uid()` internamente — nunca aceita `user_id` como parâmetro vindo do cliente, porque isso seria espinhoso/redundante quando já existe JWT de sessão —, (b) valida que os IDs referenciados (`account_id`/`card_id`) pertencem a esse `uid` antes de qualquer mutação, (c) faz tudo dentro da mesma transação implícita da função.

**When to use:** `wa_log_transaction` (D-01). NÃO usar para `recategorizar_transacao`/`editar_transacao` (D-03 já decidiu ficar em `updateTransaction` + RLS — não há mutação de saldo em jogo).

**Nuance importante para o planner:** o design do épico (`whatsapp-e-ia-arquitetura.md §6`) menciona `wa_log_transaction(p_user_id, ...)` pensando no caso do **webhook do WhatsApp (Fase 14)**, que usa `SUPABASE_SERVICE_ROLE_KEY` (sem JWT de usuário) e por isso PRECISA receber `p_user_id` explícito + validar. **Este phase (12) é diferente**: a chamada vem do client autenticado (`window.fidesDb.rpc`, mesma sessão JWT que já popula `auth.uid()`), exatamente como `pay_card_invoice`/`delete_transaction` hoje. Recomendação: seguir o padrão desses dois (usar `auth.uid()` internamente, **sem** parâmetro `p_user_id` vindo do cliente) — mais seguro (não espofável) e consistente com o resto do schema. Se a Fase 14 precisar de uma variante com `p_user_id` explícito para o caso service-role, isso é decisão da Fase 14, não desta. `[ASSUMED — recomendação de design, não uma citação; Claude's Discretion por CONTEXT.md]`

**Example (rascunho — nomes exatos são Claude's Discretion, mas os campos abaixo foram cruzados com o schema live via `derived-balance.sql`/`normalizeTx`/`normalizeCard`):**
```sql
-- Fonte do padrão: supabase/derived-balance.sql:106-138 (pay_card_invoice)
create or replace function public.wa_log_transaction(
  p_description text,
  p_value       numeric,        -- já com sinal (despesa negativa, receita positiva)
  p_category    text,
  p_date        date,
  p_month       text,           -- 'YYYY-MM' já resolvido pelo caller via mesFaturaFor/ensureMes (P2!)
  p_status      text default 'cleared',
  p_account_id  uuid default null,
  p_card_id     uuid default null
)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_tmp uuid; v_tx_id uuid;
begin
  if v_uid is null then raise exception 'AUTH'; end if;
  if p_account_id is null and p_card_id is null then raise exception 'DESTINO'; end if;
  if p_account_id is not null and p_card_id is not null then raise exception 'DESTINO_AMBIGUO'; end if;

  if p_account_id is not null then
    select id into v_tmp from public.accounts where id = p_account_id and user_id = v_uid;
    if v_tmp is null then raise exception 'CONTA'; end if;
  end if;
  if p_card_id is not null then
    select id into v_tmp from public.cards where id = p_card_id and user_id = v_uid;
    if v_tmp is null then raise exception 'CARTAO'; end if;
  end if;

  insert into public.transactions
    (user_id, description, value, category, account, account_id, card_id,
     date, month, status, recurrent, subscription, settled, is_transfer)
  values
    (v_uid, p_description, p_value, p_category,
     coalesce(p_account_id, p_card_id)::text, p_account_id, p_card_id,
     p_date, p_month, p_status, false, false, false, false)
  returning id into v_tx_id;

  if p_account_id is not null then
    perform public.recalc_account_balance(p_account_id);
  end if;
  if p_card_id is not null and p_value < 0 then
    update public.cards set used = used + abs(p_value) where id = p_card_id and user_id = v_uid;
  end if;

  return jsonb_build_object('id', v_tx_id, 'inserted', true);
end; $$;
grant execute on function public.wa_log_transaction(text,numeric,text,date,text,text,uuid,uuid) to authenticated;
```
`[ASSUMED — rascunho de código, não testado; obrigatório passar por database-reviewer + verificação MCP contra o schema live antes do commit — ver "Environment Availability"]`

### Pattern 2: Nonce HMAC stateless anti-replay (D-06)

**What:** O servidor, ao responder com `tool_calls`, assina `{uid, iat, exp}` com uma chave secreta e devolve o token junto da resposta. O próximo POST do cliente (que já vai mandar `toolResults`) inclui esse token de volta. O servidor só trata a chamada como "continuação do turno" (pulando o gate de `USER_DAILY_LIMIT`) se o token: (a) existir, (b) tiver assinatura válida, (c) não estiver expirado, (d) pertencer ao mesmo `uid` da sessão atual.

**When to use:** Todo POST em `api/assistant.js` onde `toolResults` vem preenchido (tanto para os 2 READ tools quanto, agora, para as 4 WRITE).

**Falha segura (importante):** se o nonce estiver ausente/inválido/expirado, o servidor **não deve rejeitar a requisição** — deve tratá-la como "primeira chamada do turno" e aplicar o gate de rate-limit normalmente (cobra 1 da cota). Isso fecha o bypass (forjar `toolResults` sem nonce válido não pula mais o gate) sem quebrar o fluxo legítimo quando o nonce expira por qualquer motivo (ex.: usuário demorou para confirmar um card de escrita).

**TTL — nuance específica deste phase:** D-06 sugere "~30-60s", pensando no round-trip determinístico READ (`consultar_saldo`→ resposta quase instantânea). Mas com WRITE ativo, o card de confirmação espera **interação humana** — o usuário pode levar bem mais que 60s para revisar e clicar "Confirmar". Recomendação: usar uma janela mais generosa (`[ASSUMED] 5 minutos`) para cobrir o tempo de leitura/decisão do card, já que o custo de segurança de uma janela maior é marginal (o nonce ainda exige JWT válido do mesmo usuário — não é um bypass de auth, só de contagem de cota) e o custo de UX de uma janela curta é real (usuário confirma, servidor trata como "chamada nova" e ainda assim funciona, mas cobra 2x da cota diária por um único turno). Documentar essa escolha explicitamente no PLAN — é Claude's Discretion por CONTEXT.md.

**Example:**
```js
// api/_lib/nonce.js — CommonJS, não roteável (mesma convenção de _lib/gemini.js)
const crypto = require('crypto');

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 min — cobre tempo de confirmação humana do card WRITE

function sign(uid, secret) {
  const payload = JSON.stringify({ uid, iat: Date.now(), exp: Date.now() + NONCE_TTL_MS });
  const payloadB64 = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

function verify(token, uid, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [payloadB64, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const sigBuf = Buffer.from(sig || '');
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false;
  let claims;
  try { claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()); } catch { return false; }
  if (claims.uid !== uid) return false;
  if (!claims.exp || Date.now() > claims.exp) return false;
  return true;
}

module.exports = { sign, verify };
```
```js
// api/assistant.js — trecho do gate (substitui a linha 136 atual)
const nonce = require('./_lib/nonce');
const NONCE_SECRET = process.env.ASSISTANT_NONCE_SECRET; // novo env var, Vercel Project

const hasToolResults = Array.isArray(toolResults) && toolResults.length > 0;
const clientNonce = req.body?.nonce || null;
const nonceValid = hasToolResults && clientNonce && NONCE_SECRET
  ? nonce.verify(clientNonce, userId, NONCE_SECRET)
  : false;
// D-06: só pula o gate se toolResults vier E o nonce da resposta anterior for válido.
// toolResults forjado sem nonce válido cai no mesmo caminho de "primeira chamada" — cobra cota normalmente.
const isFirstCallOfTurn = !hasToolResults || !nonceValid;
```
```js
// ao responder com tool_calls, emitir o nonce da próxima chamada
if (toolCalls.length > 0) {
  const nextNonce = NONCE_SECRET ? nonce.sign(userId, NONCE_SECRET) : null;
  res.status(200).json({ tool_calls: toolCalls, nonce: nextNonce });
  return;
}
```
`[CITED: nodejs.org/api/crypto.html — createHmac/timingSafeEqual]` `[ASSUMED: TTL de 5min, claim set, nome do env var — decisão de design deste research, não uma citação externa]`

Client (`fides-claude.jsx`) precisa: (a) guardar o `nonce` recebido junto de `data.tool_calls`, (b) mandar de volta no próximo `callAssistant(history, toolResults, jwt, nonce)` como `body.nonce`. Pequena mudança de assinatura em `callAssistant` e no `while (iteration < MAX_TOOL_ITERATIONS)` loop de `send()`.

### Anti-Patterns to Avoid
- **Confiar em `selectedMonth` para o campo `mes`/`month` de uma transação nova:** é exatamente o padrão do bug FIX-1 original (`selectedMonth` era um literal hard-coded `'2026-05'`) reencarnado de outra forma — hoje `selectedMonth` é dinâmico, mas ainda é "o mês que a UI está mostrando", não "o mês da transação". Ver Pitfall P2.
- **Chamar função assíncrona de escrita (`addCategory`, `addTransaction`) sem `await` e já reportar sucesso ao usuário:** ver Pitfall P5 (toast falso).
- **RPC aceitando `p_user_id` de um caller autenticado via JWT:** redundante e pior (spoofável em teoria se a validação de dono for esquecida em algum branch) — usar `auth.uid()` sempre que a chamada já tem sessão. Reservar `p_user_id` explícito só para o caso service-role da Fase 14.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Verificação de assinatura HMAC | Comparação de string (`===`) entre assinaturas | `crypto.timingSafeEqual` sobre buffers de mesmo tamanho | `===` vaza timing information, é um vetor conhecido de ataque contra comparação de segredos `[CITED: nodejs.org/api/crypto.html]` |
| Recalcular saldo derivado em JS | Somar/subtrair `balance`/`used` manualmente no cliente | `recalc_account_balance` (RPC já existente) dentro da nova `wa_log_transaction` | É exatamente o motivo do FIX-2/derived-balance existir — mutação incremental client-side é a classe de bug que já causou corrupção de saldo neste projeto (ver `fix-delete-transaction.sql` PARTE 2, reconciliação manual necessária) |
| Mês de fatura de cartão | Reimplementar a lógica de fechamento em SQL dentro da RPC | `window.mesFaturaFor` (já existe, `fides-data.jsx:52-64`) computado no cliente e passado como `p_month` já resolvido | Evita duplicar a mesma lógica em 2 linguagens (JS + PL/pgSQL) com risco de drift — mesmo racional já documentado no design do épico para o webhook (`whatsapp-e-ia-arquitetura.md §6`: "não converter para SQL agora — over-engineering") |

**Key insight:** Este projeto já pagou o preço de reimplementar lógica de saldo/mês em mais de um lugar (bug "cartão inconsistente", corrigido pelo commit `7335fed`). A regra prática para este phase: qualquer cálculo derivado (mês de fatura, saldo) tem UMA fonte — ou é SQL puro (`recalc_account_balance`) ou é a função JS já existente (`mesFaturaFor`) — nunca as duas reescritas em paralelo.

## Common Pitfalls

> Os 6 bugs do UAT (mês vazio, mês hard-coded, delete sem estorno, cartão inconsistente, toast falso de `criar_categoria`, ⌘K) foram investigados um a um contra o código atual. 4 já estão corrigidos na fundação (fases anteriores) — viram testes de regressão puros. 2 têm causa raiz ATIVA no código morto que este phase vai religar — precisam de correção, não só teste.

### P1 — "mês vazio" (`mes`/`month` gravado como string vazia)
**What goes wrong:** Uma transação é gravada sem `month` (ou com `''`), ficando invisível em qualquer view filtrada por mês (`monthTransactions` filtra por `t.mes === selectedMonth`).
**Why it happens (histórico):** No v7 original, o caminho de escrita do assistente não passava pelo mesmo `ensureMes`/`txToRow` do resto do app.
**Status atual:** Corrigido na fundação — `ensureMes` (`fides-store.jsx:187-190`) sempre preenche `mes` com fallback (`ano atual + mês de tx.d`) se vier vazio, e `addTransaction`/`txToRow` sempre passam pelo `ensureMes`. **Se a nova RPC `wa_log_transaction` for chamada com `p_month` vazio, esse fallback NÃO existe no caminho novo** (a RPC não tem o mesmo `ensureMes` — é responsabilidade do caller/client calcular `p_month` corretamente antes de chamar a RPC, ou a própria RPC deveria ter um fallback simples `coalesce(p_month, to_char(p_date,'YYYY-MM'))`).
**Regression guard:** Após lançar via chat (conta corrente e cartão), verificar via MCP que a linha em `transactions` tem `month` não-nulo e igual ao mês esperado (mês da data da compra p/ conta corrente; mês de fechamento da fatura p/ cartão).

### P2 — "mês hard-coded" (ATIVO no código morto — precisa de fix, não só teste)
**What goes wrong:** `executeWriteTool` (`fides-claude.jsx:346-355`) monta `tx.mes = selectedMonth` para `lancar_transacao` — ou seja, toda transação nova ganha o mês que a UI está exibindo no momento, não o mês real da data da transação. Se o usuário está vendo julho mas pede "lança R$50 de ontem" quando ontem era 30 de junho, ou se `args.data` vier de um mês diferente do que está selecionado, a transação cai no mês errado.
**Why it happens:** Código escrito quando `selectedMonth` ainda não existia como referência de "mês real do lançamento" — provavelmente copiado do padrão de outros lugares do app onde "mês selecionado" faz sentido (ex. modal Nova Transação, que assume que o usuário está lançando algo do mês corrente que está vendo).
**How to avoid:** Para conta corrente, `p_month` deve vir de `resolved.dateStr` (a data resolvida da transação), não de `selectedMonth`. Para cartão, `p_month` deve vir de `window.mesFaturaFor(resolved.dateStr, card, ano)`, igual ao que `txToRow` já faz para o modal Nova Transação (`fides-store.jsx:215-227`).
**Warning signs:** Lançar uma transação retroativa (data de mês anterior ao mês selecionado na UI) e ver ela aparecer no mês errado.
**Regression guard obrigatório:** UAT deve incluir explicitamente "lançar transação com `data` de um mês diferente do mês atualmente selecionado no app" — este é o caso que a v7 original quebrava e que o código morto atual REPETE se religado sem correção.

### P3 — "delete sem estorno"
**What goes wrong:** Deletar uma transação de cartão não-quitada sem devolver o valor a `cards.used`, ou deletar uma perna de transferência sem reverter o saldo da outra ponta.
**Status atual:** Corrigido — `delete_transaction` (`supabase/derived-balance.sql:42-69`) já é `SECURITY DEFINER`, atômico, e trata: transferência (2 pernas), pagamento de fatura (perna única), compra de cartão não-quitada (reverte `cards.used`), compra de cartão quitada (não mexe, pagamento já debitou), transação regular (recalcula via `recalc_account_balance`).
**Relevância para este phase:** Nenhuma mudança necessária — este phase não adiciona nem modifica `delete_transaction`. É puro teste de regressão (confirmar que deletar uma transação criada pelo assistente se comporta igual a uma criada pelo modal).
**Regression guard:** Lançar via chat, depois deletar via UI normal (não via chat — não há tool de delete no assistente), confirmar reversão de saldo/`used`.

### P4 — "cartão inconsistente" (lançamento em cartão com mês de fatura errado)
**What goes wrong:** Transação de cartão gravada com `month` = mês da data de compra em vez do mês em que a FATURA fecha (convenção `mesFaturaFor`), fazendo a compra aparecer na fatura errada.
**Status atual:** Corrigido no caminho normal — commit `7335fed` ("BUG-FATURA") fez `txToRow` chamar `mesFaturaFor` para transações de cartão. **Risco reintroduzido pela nova RPC** se `wa_log_transaction` não replicar esse cálculo (ver P2 — é a mesma causa raiz, mês computado errado, manifestando em 2 sintomas do UAT).
**How to avoid:** Mesma correção de P2 — resolver `p_month` via `mesFaturaFor` no client ANTES de chamar a RPC quando o destino é `card_id`.
**Regression guard:** Lançar via chat numa data próxima ao fechamento do cartão (ex. dia do fechamento ou 1 dia antes/depois) e confirmar que cai na fatura certa — é o mesmo teste de borda que `FAT-01` (Fase 10) já cobre para o modal.

### P5 — "toast falso de criar_categoria" (ATIVO no código morto — precisa de fix)
**What goes wrong:** `toolExecutors.criar_categoria` (`fides-claude.jsx:269-283`) chama `addCategory(catKey, {...})` **sem `await`** (a função é `async`), e já dispara `setToast({ text: '✓ Categoria criada' })` e retorna `{ success: true }` na sequência imediatamente seguinte — antes de saber se o insert em `user_categories` no Supabase teve sucesso. Se o insert falhar (ex. rede, RLS, chave duplicada), `addCategory` reverte o estado local (`fides-store.jsx:774-778`) e mostra um toast de ERRO próprio — mas o toast de SUCESSO do assistente já apareceu antes, e a resposta que volta pro Gemini já disse `success: true`, então o modelo já anunciou sucesso pro usuário no texto da próxima resposta. Dois toasts conflitantes + uma mensagem de texto que mente sobre o resultado.
**Why it happens:** `addCategory` é otimista por design (atualiza estado local antes de confirmar no banco) — correto para UX de modal comum, errado quando o "sucesso" também vira uma alegação factual que o LLM repete para o usuário.
**How to avoid:** No caminho do assistente (diferente do modal comum de categorias), `await addCategory(...)` antes de montar o toast/retorno; se o insert falhar, retornar `{ error: 'EXECUTION_ERROR' }` como as outras tools já fazem, e não mostrar toast de sucesso algum.
**Warning signs:** Pedir para criar uma categoria com nome que gera `cat_key` já existente (colisão), ou simular falha de rede — o toast de sucesso aparece mesmo assim se não corrigido.
**Nuance de escopo (ver Open Questions Q1):** CONTEXT.md `<specifics>` afirma "nenhuma tool WRITE executa direto" — isso pode significar que `criar_categoria` standalone também deveria passar a exigir confirmação (hoje é a única WRITE que não exige), o que resolveria P5 de raiz (execução só acontece depois do `onDecide('confirm')`, já dentro de um `await` natural do fluxo `executeTools`).

### P6 — "⌘K" (atalho de teclado global conflita com fluxo de confirmação)
**What goes wrong:** O listener global de `Cmd/Ctrl+K` (`fides-studio.jsx:50-59`) abre o `CommandPalette` de QUALQUER lugar do app, sem checar se há uma confirmação de escrita pendente no assistente (`pendingConfirmation`) ou mesmo se o input de texto do chat está focado. `keydown` com modificador borbulha do input até o `document` normalmente, então isso dispara mesmo com o assistente aberto.
**Why it happens:** O atalho foi implementado na Fase 09 (TX-07) antes de WRITE existir de fato no assistente — não havia um estado "aguardando confirmação de escrita" para se preocupar em não sobrepor.
**How to avoid:** Adicionar um guard no handler: não abrir o palette se `pendingConfirmation` do assistente estiver ativo (ou, mais genericamente, se algum modal bloqueante já estiver aberto — `categoryModalOpen`/`modalOpen` já são checados em outros lugares do mesmo componente).
**Warning signs:** Abrir o card de confirmação de uma escrita, apertar ⌘K, ver o palette abrir por cima sem fechar o card — usuário pode ficar sem saber se a ação ainda está pendente.
**Regression guard:** Com um card de confirmação de `lancar_transacao` aberto, pressionar ⌘K → o palette NÃO deve abrir (ou deve fechar o card primeiro, de forma explícita) — comportamento exato a decidir no plano, mas "abrir os dois ao mesmo tempo sem hierarquia" é o bug.

## Code Examples

### TOOLS_DECLARATION — restaurar as 4 tools WRITE (espelho quase literal do que `6018f66` removeu)

O diff do commit que desligou o WRITE (`git show 6018f66`) foi lido integralmente neste research — a declaração original das 4 tools (`lancar_transacao`, `criar_categoria`, `recategorizar_transacao`, `editar_transacao`) está preservada no histórico git e serve de base quase pronta para restaurar, com 2 ajustes:
1. `editar_transacao.patch` já era `{valor, descricao, data, status}` no original — **já bate com D-05** (nunca teve `conta_ou_cartao`), nenhuma mudança de schema necessária aqui.
2. `criar_categoria` precisa de uma nota na `description` se a decisão de Q1 (Open Questions) for exigir confirmação — mudar de "Executa direto sem confirmação" para o texto equivalente ao das outras 3.

```js
// api/assistant.js — TOOLS_DECLARATION, adicionar de volta ao array (fonte: git show 6018f66, revertido)
{
  name: 'lancar_transacao',
  description: 'Registra uma nova transação. Requer confirmação visual do usuário antes de executar.',
  parameters: {
    type: 'object',
    properties: {
      tipo: { type: 'string', enum: ['despesa', 'receita'] },
      valor: { type: 'number', description: 'Valor absoluto, sempre positivo.' },
      descricao: { type: 'string' },
      categoria: { type: 'string', description: 'Nome da categoria (não o ID).' },
      conta_ou_cartao: { type: 'string', description: 'Nome da conta ou cartão — resolvido para UUID no frontend.' },
      data: { type: 'string', description: 'dd/mm. Se omitido, usa hoje.' },
      status: { type: 'string', enum: ['pago', 'pendente'] },
    },
    required: ['tipo', 'valor', 'descricao', 'categoria', 'conta_ou_cartao'],
  },
},
// ... criar_categoria, recategorizar_transacao, editar_transacao — mesmo schema do commit 6018f66 (reversão)
```

### System Prompt de escrita — regra de honestidade (HONEST-01)

Trecho a **adicionar** de volta ao `SYSTEM_PROMPT` (removendo a linha "MODO ATUAL: apenas consulta... está temporariamente em manutenção"), com a regra de honestidade explícita reforçando o que o código já faz de forma determinística:

```
═══ FERRAMENTAS DE ESCRITA (WRITE) ═══
Você agora PODE lançar transações, recategorizar, editar e criar categorias — SEMPRE com
confirmação visual do usuário antes de qualquer gravação. Você não executa a ação: você a
propõe, e o sistema mostra um card de confirmação. Regras de honestidade obrigatórias:

• NUNCA invente valor, conta/cartão ou categoria que o usuário não disse explicitamente.
  Se um campo obrigatório estiver ausente ou ambíguo, PERGUNTE antes de chamar a ferramenta —
  não adivinhe um valor plausível.
• Se o nome de conta/cartão/categoria citado pelo usuário não bater com nada da lista do
  [CONTEXTO], NÃO invente um novo nome silenciosamente — deixe o sistema retornar o erro de
  resolução e explique ao usuário o que está disponível.
• lancar_transacao: se a categoria não existir na lista fechada, ainda assim chame a ferramenta
  normalmente com o nome que o usuário disse — o sistema vai propor criar essa categoria E
  lançar a transação numa única confirmação. Você não precisa (e não deve) chamar
  criar_categoria separadamente antes.
• Combine no máximo 2 chamadas de ferramenta por resposta, como no modo leitura.
```
`[ASSUMED — redação de prompt, ponto de partida a refinar durante execução; a regra de negócio (D-04, honestidade) vem de CONTEXT.md, a redação exata é discricionária]`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Assistente só-leitura (2 tools) | Assistente com 6 tools (2 READ + 4 WRITE) | Este phase | Reabre o gate B8; WhatsApp (Fase 14) reusa o mesmo caminho de escrita |
| `deleteTransaction` via `.delete()` cru (sem estorno) | RPC `delete_transaction` atômica | FIX-2 (`93b02d9`, jun/2026) | Não muda neste phase — só vira regression test (P3) |
| `selectedMonth` hard-coded `'2026-05'` | `selectedMonth` dinâmico (`new Date()`) | FIX-1 (`93b02d9`) | Não muda neste phase, mas P2 mostra que o MESMO padrão de bug existe em outro lugar (código morto do assistente) |
| `txToRow` sem `mesFaturaFor` para cartão | `txToRow` usa `mesFaturaFor` | `7335fed` (BUG-FATURA) | A nova RPC precisa do mesmo tratamento — ver P2/P4 |
| `assistant_usage` só conta linhas (sem telemetria) | Grava `prompt_tokens`/`completion_tokens`/`latency_ms` | Fase 11 (AI-TELEM-01) | Base para observar custo real de WRITE (chamadas maiores que READ) |

**Deprecated/outdated:** O comentário `// WRITE leve: criar_categoria (executa direto, mostra toast)` em `fides-claude.jsx:5` reflete uma decisão de design pré-`CONTEXT.md` deste phase — CONTEXT.md agora afirma "nenhuma tool WRITE executa direto", potencialmente invalidando esse comentário (ver Open Questions Q1).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `wa_log_transaction` deve usar `auth.uid()` internamente, sem parâmetro `p_user_id` vindo do cliente (diferente do nome sugerido em `whatsapp-e-ia-arquitetura.md §6`, pensado para o caso service-role da Fase 14) | Architecture Patterns / Pattern 1 | Baixo — se o planner preferir manter `p_user_id` por consistência de nome com a Fase 14, a validação de dono (`where id=... and user_id=v_uid`) ainda protege; é uma escolha de higiene de API, não um buraco de segurança se implementada com o guard correto |
| A2 | TTL do nonce recomendado em 5 minutos (em vez dos "~30-60s" sugeridos em D-06), para acomodar o tempo de confirmação humana do card WRITE | Architecture Patterns / Pattern 2 | Médio — se o planner manter 30-60s, o pior caso é só UX degradada (usuário confirma devagar, chamada seguinte conta como "nova" e cobra 1 a mais da cota diária) — não é um risco de segurança, mas vale confirmar com o usuário |
| A3 | Draft SQL de `wa_log_transaction` (colunas, defaults de `settled`/`status`) não foi verificado contra o schema Supabase LIVE via MCP nesta sessão — baseado em `derived-balance.sql` + `normalizeTx`/`normalizeCard` (JS) | Code Examples / Pattern 1 | Alto se ignorado — `schema.sql` está comprovadamente desatualizado (falta `settled`, `paid_at`, `is_transfer`, `transfer_group`, `opening_balance` — só existem em `derived-balance.sql`/produção); a RPC final PRECISA ser conferida contra o schema live (MCP `list_tables`) antes do commit, não só contra os arquivos `.sql` do repo |
| A4 | Redação exata do trecho de honestidade no `SYSTEM_PROMPT` | Code Examples | Baixo — é prompt engineering, ajustável sem risco de segurança; a regra de negócio subjacente (D-04, HONEST-01) é que é fixa |
| A5 | `criar_categoria` standalone deveria passar a exigir confirmação (interpretação de CONTEXT.md `<specifics>`: "nenhuma tool WRITE executa direto") | Common Pitfalls P5, Open Questions Q1 | Médio — se a leitura estiver errada e a intenção for manter `criar_categoria` sem confirmação (só a versão bundlada em D-04 precisa de card), a correção de P5 ainda é necessária (await ausente), só que sem adicionar ao `TOOLS_REQUIRING_CONFIRMATION` |

## Open Questions

1. **`criar_categoria` standalone exige confirmação agora?**
   - What we know: O código original (pré-FIX-3) e o comentário atual em `fides-claude.jsx` tratam `criar_categoria` como "WRITE leve, executa direto". CONTEXT.md `<specifics>` diz "Confirmação é SEMPRE obrigatória antes de qualquer insert/update via chat — nenhuma tool WRITE executa direto".
   - What's unclear: Se essa frase de CONTEXT.md é uma reafirmação geral do princípio do produto (confirmação nas 3 tools que já exigiam) ou uma mudança de escopo que agora inclui `criar_categoria` standalone.
   - Recommendation: Tratar como mudança de escopo (mover `criar_categoria` para `TOOLS_REQUIRING_CONFIRMATION`) — resolve P5 de raiz, é consistente com a leitura mais literal do texto de CONTEXT.md, e o custo de adicionar 1 clique extra numa operação já rara (criar categoria) é baixo. Confirmar com o usuário/planner antes de assumir.

2. **Onde mora a chave `ASSISTANT_NONCE_SECRET`?**
   - What we know: Precisa ser uma env var nova (Vercel Project, nunca commitada), distinta do `GEMINI_API_KEY`/Supabase keys já existentes.
   - What's unclear: Se vale reusar algum segredo já existente no projeto (nenhum candidato óbvio foi encontrado — não há `SUPABASE_JWT_SECRET` nem `SUPABASE_SERVICE_ROLE_KEY` em uso hoje) ou gerar um novo.
   - Recommendation: Gerar um novo secret aleatório (32+ bytes, `openssl rand -base64 32` ou equivalente) dedicado a este uso — evita acoplar o nonce a segredos com outro propósito (rotação independente).

3. **A RPC `wa_log_transaction` precisa aceitar `p_status` do usuário, ou sempre assume `pago`/`cleared`?**
   - What we know: `resolveWriteToolArgs` já tem `status: args.status || 'pago'` — o Gemini pode propor `pendente`.
   - What's unclear: Para transação de CARTÃO, o modal "Nova Transação" força `status: pendente` sempre (`FIX-CREDITO`, commit `2343086`, visto no `git log`) — compra em cartão nunca é "paga" na hora, só quando a fatura é quitada. A RPC do assistente precisa replicar essa regra (ignorar `status` vindo do usuário quando o destino é cartão, sempre gravar como pendente/não-settled) ou herda o bug que `2343086` corrigiu no modal.
   - Recommendation: Planner deve ler o commit `2343086` (`NovaTransacaoModal força status pendente + desabilita toggle quando conta selecionada é cartão`) e replicar a mesma regra dentro de `wa_log_transaction` ou no client antes de chamar a RPC.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Supabase MCP (`list_tables`, `apply_migration`) | Verificar schema live de `transactions`/`cards`/`accounts` antes de finalizar `wa_log_transaction` (A3) | ✓ (usado em fases anteriores, ver instruções do MCP no ambiente) | — | — |
| `crypto` (Node built-in) | Nonce HMAC (D-06) | ✓ (built-in em qualquer runtime Node do Vercel) | Node ≥ 14 | — |
| Gemini API (`GEMINI_API_KEY`) | Todas as tools | ✓ (env Vercel Project, já em uso) | v1beta | — |
| `security-reviewer` / `database-reviewer` (ECC, caminho sensível) | RPC nova + gate de rate-limit (CLAUDE.md) | ✓ (ferramenta pontual dentro do GSD, já usada nas fases 08/11) | — | — |

Nenhuma dependência bloqueante ausente. Nenhum pacote npm novo a instalar.

## Validation Architecture

> Projeto não tem test runner (sem bundler, sem Jest/Vitest — React via Babel-standalone; `api/` são functions Vercel sem harness). Verificação = inspeção estática (grep/leitura) + human-verify via `/gsd-verify-work`, mesmo padrão da Fase 11.

### Test Framework
| Property | Value |
|---|---|
| Framework | Nenhum (sem test runner no projeto — débito rastreado B11) |
| Config file | none |
| Quick run command | N/A — inspeção estática + human-verify |
| Full suite command | N/A |

### Phase Requirements → Verification Map
| Req | Critério estático (inspeção) | Critério observável (human-verify / UAT) |
|---|---|---|
| WRITE-01 | `TOOLS_DECLARATION` inclui `lancar_transacao`; `executeWriteTool` chama `window.fidesDb.rpc('wa_log_transaction', ...)` (não mais `addTransaction`); `p_month` é derivado da data real, não de `selectedMonth` (grep negativo: `mes: selectedMonth` não deve mais existir em `executeWriteTool`) | Lançar despesa e receita via chat, conferir card de confirmação, conferir transação aparece no mês/fatura certos (inclui caso retroativo — P2) |
| WRITE-02 | `recategorizar_transacao` presente em `TOOLS_DECLARATION`; chama `updateTransaction` (D-03) | Recategorizar via chat, conferir categoria mudou na lista de transações |
| WRITE-03 | `editar_transacao.parameters.patch` NÃO tem `conta_ou_cartao` (D-05) | Editar valor/descrição/data/status via chat; tentar pedir troca de conta via chat → assistente explica que precisa ser no app |
| WRITE-04 | `criar_categoria` await corrigido (P5); se Q1 resolvida como "sim exige confirmação", tool está em `TOOLS_REQUIRING_CONFIRMATION` | Criar categoria via chat (standalone e via D-04 bundlado com lançamento), toast só aparece após confirmação real do banco |
| HONEST-01 | System prompt contém a seção de honestidade; `findAccountByName`/`findCategoryByName` seguem retornando erro explícito (não fallback silencioso) quando não casam | Pedir para lançar em conta/categoria inexistente → assistente pergunta, não inventa |
| DERIVED-SAFE-01 | `wa_log_transaction` chama `recalc_account_balance`/atualiza `cards.used` dentro da mesma função SQL; nenhuma mutação incremental de saldo em JS no caminho do assistente | Lançar várias transações seguidas via chat, conferir saldo/limite disponível bate com a soma esperada |
| D-06 (nonce) | `api/_lib/nonce.js` existe com `sign`/`verify`; gate usa `nonceValid` além de `hasToolResults` | Forjar `toolResults` sem nonce (DevTools) → deve contar cota normalmente, não pular o gate; fluxo normal (nonce válido) não deve pedir confirmação 2x nem cobrar cota duplicada dentro do mesmo turno |
| P6 (⌘K) | Handler de `Cmd/Ctrl+K` checa `pendingConfirmation` (ou equivalente) antes de abrir o palette | Abrir card de confirmação de escrita, apertar ⌘K, confirmar que o palette não sobrepõe sem hierarquia clara |

### Sampling / Gate
- **Por commit:** inspeção estática do diff (grep dos critérios acima, especialmente o grep negativo de `mes: selectedMonth`).
- **Gate de fase:** `/gsd-verify-work` conversacional cobrindo os 6 casos de regressão do UAT + os requisitos novos (padrão do projeto: apresentar todos os testes em bloco — MEMORY `uat-batch-all-tests`).
- **Caminho sensível `api/`+`supabase/`:** `security-reviewer` + `database-reviewer` obrigatórios antes de cada commit que toque `api/assistant.js`, `api/_lib/nonce.js` ou a nova função `wa_log_transaction` (CLAUDE.md).

### Wave 0 Gaps
Nenhuma infra de teste a criar (projeto sem runner por design). Nenhum gap de fixture — os dados de teste (contas/cartões/categorias) já existem no ambiente de desenvolvimento usado nas fases anteriores.

## Security Domain

Caminhos `api/` e `supabase/` são sensíveis (CLAUDE.md) — `security-reviewer` + `database-reviewer` obrigatórios antes de commit desta fase inteira (RPC nova + tools WRITE reabertas + rate-limit fix).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | sim | Inalterado — `supabase.auth.getUser(jwt)` via header `Authorization: Bearer` (WR-03, fase 11) |
| V3 Session Management | sim | Nonce do D-06 é vinculado ao `uid` da sessão atual — não é um token de sessão novo, é um anti-replay de UMA chamada específica |
| V4 Access Control | sim | `wa_log_transaction` valida `account_id`/`card_id` pertencem a `auth.uid()` antes de inserir (mesmo padrão `pay_card_invoice`) — RLS já cobre updates via `updateTransaction`/`addCategory` |
| V5 Input Validation | sim | `mode` continua whitelisted (fase 11); novo campo `nonce` no body deve ser validado como string opcional, nunca usado sem passar por `verify()` |
| V6 Cryptography | sim | HMAC-SHA256 via `crypto` nativo, nunca hand-rolled além do padrão `createHmac`+`timingSafeEqual`; secret novo (`ASSISTANT_NONCE_SECRET`) só em env var Vercel Project |
| V7 Logging | sim | Nunca logar o conteúdo de transações (valor/descrição) em `console.error` de forma que vaze para logs persistentes além do necessário para debug — mesma disciplina de LGPD já aplicada à telemetria (fase 11) |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Bypass de rate-limit via `toolResults` forjado (D-06, achado pré-existente do security-review da fase 11) | Elevation of Privilege / Repudiation | Nonce HMAC com `uid` vinculado + fail-safe (nonce inválido = cobra cota normalmente) |
| Escrita em conta/cartão de outro usuário via RPC | Tampering | Guarda de dono dentro da RPC (`where id=... and user_id=auth.uid()`), igual `pay_card_invoice`; NUNCA aceitar `p_user_id` de um caller com sessão JWT própria (ver A1) |
| Categoria/transação criada com dados inventados pelo modelo (alucinação) | Tampering / Repudiation | Dupla camada: system prompt de honestidade (soft) + `findAccountByName`/`findCategoryByName` falhando fechado com erro explícito (hard) — a segunda é a que realmente protege, a primeira só reduz a chance de precisar dela |
| Toast/resposta afirmando sucesso antes da escrita real terminar (P5) | Repudiation | `await` obrigatório em toda função de escrita antes de reportar sucesso ao usuário ou ao modelo (`toolResults`) |
| Injeção via texto livre do usuário (`descricao`, nome de categoria) refletido depois na UI | Tampering (stored XSS-like) | Já mitigado desde a fase 05 — output renderizado como text nodes React, sem `dangerouslySetInnerHTML`; `descricao`/categoria vindos do assistente passam pelos mesmos componentes de lista de transações que já tratam entrada de texto livre do modal manual |

## Sources

### Primary (HIGH confidence)
- Leitura direta do código-fonte deste repositório: `api/assistant.js`, `api/_lib/gemini.js`, `assets/fides-claude.jsx`, `assets/fides-store.jsx`, `assets/fides-data.jsx`, `supabase/schema.sql`, `supabase/derived-balance.sql`, `supabase/fix-delete-transaction.sql`, `supabase/fix-delete-transfer.sql`, `package.json`, `vercel.json` — todas as claims sobre comportamento atual do sistema vêm de leitura direta, não de suposição.
- Histórico git deste repositório: `git show 6018f66` (remoção do WRITE, FIX-3), `git show 93b02d9` (FIX-1/FIX-2), `git show 7335fed` (BUG-FATURA) — usados para confirmar causa raiz e status atual dos 6 bugs do UAT.
- `.planning/research/whatsapp-e-ia-arquitetura.md` (§5, §6, §7, §B3) — design do épico, decisões D-1..D-11.
- `.planning/phases/11-ia-1-hardening-do-assistente-gemini/11-CONTEXT.md` e `11-RESEARCH.md` — padrão de convenções do projeto (Validation Architecture, estilo de research).
- `.planning/todos/pending/ratelimit-bypass-toolresults.md` — detalhe do bypass D-06.

### Secondary (MEDIUM confidence)
- [Crypto | Node.js Documentation](https://nodejs.org/api/crypto.html) — `createHmac`, `timingSafeEqual`, verificados via WebSearch e cross-checados contra o padrão de doc oficial do Node.
- [Function calling with the Gemini API | Google AI for Developers](https://ai.google.dev/gemini-api/docs/function-calling) — orientação oficial do Google: validar com o usuário antes de executar function calls com consequências significativas (base para a regra de confirmação sempre-obrigatória).

### Tertiary (LOW confidence)
- Artigos de blog sobre HMAC/nonce em Node.js (oneuptime.com, dev.to, medium.com) — usados só para confirmar que o padrão geral (assinar payload + TTL, sem estado de banco para replay perfeito) é comum na indústria; não citados como fonte de decisão de design específica deste projeto.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nenhuma lib nova, tudo já em uso no projeto
- Architecture (RPC + nonce): HIGH para o padrão geral (precedente direto no repo + docs oficiais), MEDIUM para os detalhes exatos de schema da RPC (não verificados contra live DB via MCP nesta sessão — ver A3)
- Pitfalls (6 bugs do UAT): HIGH — 4 confirmados corrigidos por leitura de commit histórico + SQL atual; 2 (P2, P5) confirmados ATIVOS por leitura direta do código morto atual, com localização exata (arquivo:linha)

**Research date:** 2026-07-08
**Valid until:** ~30 dias (stack estável — Gemini 2.5 Flash-Lite e o schema Supabase não mudam a esta cadência; revalidar se a Fase 13/14 alterar `assistant_usage` ou o schema de `transactions` antes deste phase ser executado)
