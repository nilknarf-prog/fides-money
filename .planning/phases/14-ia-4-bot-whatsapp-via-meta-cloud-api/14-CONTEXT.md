# Phase 14: IA-4 Bot WhatsApp via Meta Cloud API - Context

**Gathered:** 2026-07-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Usuário **premium** registra transações e consulta saldo/mini-extrato pelo WhatsApp — o **bot LEVE** (escopo D-6: registrar + saldo + mini-extrato; o bot NÃO cria categoria, NÃO dá conselhos/análises — o assistente robusto já existe **in-app**, Phases 11–13). `api/whatsapp.js` (Vercel Function CommonJS): webhook Meta Cloud API com verificação HMAC (`X-Hub-Signature-256`), idempotência por `wamid`, opt-in por código de posse (link `wa.me`), **gating premium antes de qualquer LLM**, parser NL→JSON (Gemini Flash-Lite, saída estruturada — NÃO function calling — com guarda determinística de valor), **confirmação sempre antes do insert (D-1)**, insert via RPC service_role-only (ver achado técnico abaixo). Migrações: `phone` + `wa_linked_at` em `profiles`, tabelas `wa_link_codes`/`wa_messages`/`wa_pending` (ALTER standalone + MCP).

Escopo adicional incorporado nesta discussão: **fechar o bypass do rate-limit diário do assistente in-app** (`api/assistant.js`, todo high da security-review da Phase 11).

Requirements: WA-WEBHOOK-01, WA-OPTIN-01, WA-GATE-01, WA-PARSE-01, WA-CONFIRM-01, WA-INSERT-01, WA-LGPD-01 (a formalizar no plan) + novo **WA-RATELIMIT-01** (bypass toolResults fechado).

</domain>

<decisions>
## Implementation Decisions

### Modelo de acesso e promessa comercial (travado 2026-07-17, pós-pesquisa de preços)
- **AC-01 Premium-only:** o bot é benefício do plano pago (R$ 89,90/ano). WA-GATE-01 mantido como no design (§4): checagem de `profiles.plan` ANTES de qualquer LLM; free NÃO vincula número (botão "Conectar WhatsApp" só aparece para premium — dupla camada UI + webhook).
- **AC-02 Sem vitalício:** promessa comercial = **anual tudo-incluso** (bot + IA in-app dentro do R$ 89,90/ano). Pagamento único/"pra sempre" **descartado como modelo**: a pesquisa (2026-07-17) provou que o PlannerFin atual é ANUAL (R$ 87 à vista, verificado no bundle JS do site) — o "vitalício R$ 88" é mito; e a cobrança da Meta pós-out/2026 quebra a conta vitalícia estruturalmente. Venda antes do checkout M6: **Pix manual + `admin_set_plan` no painel admin (Phase 16)**.
- **AC-03 Free no bot:** resposta estática de upgrade com link, cap 3/dia/número, **zero LLM** (design §4 mantido). Número desconhecido: idem, sem revelar existência de conta.

### Custos reais e estratégia pós-out/2026 (pesquisa web 2026-07-17 — SUPERSEDE §10 do design)
- **FATO NOVO (fonte oficial Meta + ERA CX + Canaltech):** cobrança por mensagem de template vigente desde 01/07/2025 (service grátis); a Meta anunciou em 01/07/2026 que **mensagens de SERVIÇO passam a ser cobradas em 01/10/2026** — ~US$ 0,0068 ≈ **R$ 0,04 por mensagem ENVIADA** (inbound segue grátis; sem desconto de volume; tabela BRL oficial sai até 01/09/2026). Até 30/09/2026: **R$ 0**. Custo por lançamento com D-1 (2 msgs enviadas): ~R$ 0,001 hoje → **~R$ 0,08 pós-out**; usuário típico 40 tx/mês ≈ R$ 3,20/mês (~R$ 38/ano) — cabe no preço anual.
- **CU-01 D-1 mantido:** confirmar SEMPRE no MVP. Auto-insert com desfazer (1 msg/lançamento, metade do custo) é **alavanca futura**: só pós-telemetria de taxa de correção E se a cobrança apertar. NÃO implementar agora (nem atrás de flag).
- **CU-02 Caps diário + mensal:** referência 30 msgs/dia E 300 msgs/mês por usuário premium no canal WhatsApp (teto de custo ~R$ 12/mês por abusador pós-out; uso típico ~80 msgs/mês nem encosta). Contador no padrão `assistant_usage`, separado do chat in-app. Planner pode calibrar os números mantendo **teto ≤ ~R$ 15/mês/usuário**.
- **CU-03 Gate set/2026:** antes do **lançamento público** (pós-beta), re-verificar a tabela BRL oficial da Meta (publicada até 01/09/2026) e recalcular custo/usuário. O **beta no test number NÃO espera** por isso.
- **CU-04 LLM:** manter **Gemini 2.5 Flash-Lite TIER PAGO** ($0,10/$0,40 por M — confirmado 17/07/2026 como o mais barato do Google; família 3.x custa 2,5–3,75× mais; alternativas exigiriam eval PT-BR que não se paga). **Free tier PROIBIDO em produção** (Google usa dados para treino — inaceitável para dados financeiros/LGPD); permitido só em dev com dados sintéticos. **Caching NÃO se aplica** (prompt ~600–900 tokens < piso de 2.048). Custo por parse ~R$ 0,0007 — irrelevante. Otimização de prompt (categorias como chaves nuas, contas numeradas, `maxOutputTokens` ~200) = higiene (~40% de economia), não necessidade.

### Escopo e fases
- **ES-01 Sem split 14a/14b:** Phase 14 = bot leve como está (D-6). O "bot robusto" já existe — é o assistente in-app (Phases 11–13). Decisão do dono: **adicionar placeholder de fase futura "Assistente robusto no WhatsApp (premium)" no ROADMAP**, sem planejá-la agora.
- **ES-02 Botões interativos adiados:** MVP usa texto numerado ("1 · Confirmar 2 · Cancelar 3 · Trocar categoria"); interactive reply buttons ficam para polish futuro.

### Achados técnicos que o planner DEVE respeitar
- **TE-01 RPC — NÃO reusar `wa_log_transaction` às cegas:** o RPC atual (Phase 12, `supabase/wa-log-transaction.sql`) guarda por `auth.uid()`, que é **NULL no webhook** (service_role, sem JWT de usuário). Criar **variante service_role-only com `p_user_id` explícito + owner-guard** (valida que account/card pertencem ao `p_user_id`), com REVOKE de `authenticated`/`anon` — mesmo padrão dos RPCs `admin_*` da Phase 16 (16-01). Caminho sensível → security-reviewer + database-reviewer obrigatórios.
- **TE-02 Provedor — Meta Cloud API direta** (única com zero custo recorrente: Twilio cobra markup US$ 0,005/msg até no inbound; 360dialog €49/mês). Adendo D-8 **revalidado em 2026-07-17**: sem CNPJ não bloqueia — test number grátis (dono + até 4 beta testers, verificados por OTP) para dev/UAT; WABA não-verificada responde mensagens iniciadas pelo usuário **ilimitado** (o cap de 250/dia é só para conversas iniciadas pela empresa); display name não aparece (cosmético).
- **TE-03 Rate-limit do webhook nasce junto** (lição WR-01): throttle próprio do canal + caps CU-02 desde o primeiro deploy.

### Folded Todos
- **`ratelimit-bypass-toolresults`** (high, security-review Phase 11, pré-existente): em `api/assistant.js`, o gate de `USER_DAILY_LIMIT` só roda quando `toolResults` está vazio — qualquer requisição autenticada com `toolResults` forjado pula o contador (LLM ilimitado; pós-Phase 13, fura também o cap de 10 msg/mês do free). **Fix nesta fase:** contar TODA requisição (padrão do 16-04 no admin) OU validar o nonce assinado já existente (`api/_lib/nonce.js`, D-06). Encaixa: o tema da fase é controle de custo/abuso do canal de IA.

### Claude's Discretion
- Números finais dos caps (dentro do teto CU-02), janela do contador (dia/mês calendário vs rolling), copy exata das mensagens do bot, estrutura fina do prompt do parser, divisão e ordem dos planos, escolha entre as duas opções de fix do rate-limit (contar tudo vs nonce).

### Decisões de Alinhamento e Usabilidade (2026-09-05)
- **AL-01 Ambiente de Teste e Mocks:** Desenvolver e validar 100% da lógica dos planos 14-06 (parser/opt-in) e 14-07 (insert RPC/saldo) com testes automatizados, scripts de validação e mocks locais primeiro. O setup de credenciais reais da Meta Cloud API (test number, verify token, app secret) na Vercel será feito na etapa de smoke final / UAT.
- **AL-02 Omissão de Conta/Cartão:** Se o usuário registrar uma despesa sem citar conta/cartão (ex.: "almoço 35 reais"), o bot assume a conta principal/padrão do usuário no card proposto, mantendo a opção de troca no passo 3 ("3 · Trocar categoria/conta"). Evita atrito e perguntas redundantes para despesas do dia a dia.
- **AL-03 Confirmação Tolerante:** O parser de resposta para o card de confirmação aceita tanto os dígitos numéricos ('1', '2', '3') quanto sinônimos comuns em linguagem natural (ex.: '1', 'sim', 'confirma', 'ok' -> confirmação; '2', 'não', 'cancela', 'esquece' -> cancelamento; '3', 'trocar', 'mudar' -> troca de categoria/conta).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design base do bot (fonte da verdade da arquitetura)
- `.planning/research/whatsapp-e-ia-arquitetura.md` — Parte A inteira (§1–§10) + adendo D-8 + decisões D-1..D-11. **Atenção: §10 (custos) está SUPERSEDED pela pesquisa 2026-07-17 registrada na seção de decisões deste CONTEXT** (cobrança de service messages a partir de 01/10/2026).
- `.planning/ROADMAP.md` — Phase 14 goal + requirements WA-*.
- `.planning/REQUIREMENTS.md` — seção "Phases 11–14".

### Decisões herdadas (não re-decidir)
- `.planning/phases/13-ia-3-gating-premium-in-app/13-CONTEXT.md` — gate server-side fail-closed (D-01/D-02), premium = `plan <> 'free'`, corte limpo do free.

### Todo incorporado
- `.planning/todos/pending/ratelimit-bypass-toolresults.md` — problema + opções de fix (folded nesta fase).

### Código/SQL a reusar ou espelhar
- `supabase/wa-log-transaction.sql` — RPC atual (base da variante service_role, TE-01).
- `api/_lib/gemini.js` — módulo compartilhado (retry+backoff+fallback `gemini-2.0-flash`; `buildPayload` aceita `generationConfig` → `responseSchema` para saída estruturada).
- `api/_lib/nonce.js` — nonce assinado (candidato ao fix do rate-limit e já usado no fluxo WRITE).
- `api/admin.js` + `api/_lib/admin/` — padrão guard fail-closed + rate-limit por requisição + RPCs service_role-only (Phase 16, revisado por security/database-reviewer).
- `supabase/admin-backoffice.sql` — exemplo do padrão REVOKE/GRANT service_role-only (16-01).
- `CLAUDE.md` — regra de segurança `api/`/`supabase/` (review antes de commit), convenções.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `api/_lib/gemini.js` (178 linhas): chamada Gemini pronta com retry/fallback — o parser do webhook só monta prompt + `responseSchema` e chama.
- `api/_lib/nonce.js`: HMAC de curta duração — reusável no fix do rate-limit bypass.
- `wa_log_transaction` (SQL): owner-guard + recalc + card used — modelo direto para a variante `p_user_id`.
- Padrões da Phase 16 (`requireAdmin` fail-closed, rate-limit 30 req/60s pós-guard, audit): espelhar no webhook.
- `mesFaturaFor` em `fides-data.jsx`: portar/compartilhar com o servidor (módulo comum ou cópia com teste de paridade — risco de drift apontado no design §6).
- Queries de saldo/extrato do assistente (`consultar_saldo`/`consultar_extrato` em `api/assistant.js`): reusar para respostas por template (sem LLM).

### Established Patterns
- Saldo derivado — NUNCA mutar saldo; insert correto É a operação completa (+ `recalc_account_balance`).
- Migrações: `ALTER ... IF NOT EXISTS` standalone + `apply_migration` via MCP (learning 08-08); **MCP Supabase indisponível para subagente executor** (memória do projeto) — planos MCP-dependentes rodam inline no orquestrador e `--read-only` bloqueia `apply_migration` (checkpoint humano ou ajuste de flag).
- Fail-closed em tudo (gate, parse, insert); falha nunca grava; gravação nunca duplica.

### Integration Points
- Perfil in-app: botão "Conectar WhatsApp" (premium-only) gera código `wa_link_codes` + link `wa.me`.
- `profiles`: + `phone` (E.164, unique) + `wa_linked_at` (não existem hoje — confirmado por grep).
- `assistant_usage`: contadores do canal WhatsApp (separados do chat).
- Vercel env vars (aba Project): `WA_VERIFY_TOKEN`, App Secret, system user token — nunca no repo.

</code_context>

<specifics>
## Specific Ideas

- **Caminho sensível (pedido explícito do dono):** webhook público + service_role → **security-reviewer + database-reviewer OBRIGATÓRIOS** nos planos desta fase.
- Card de confirmação: "Confirmar lançamento? 💸 R$ 45,00 · Mercado · Nubank · 05/07 — 1 · Confirmar 2 · Cancelar 3 · Trocar categoria"; ack final consolidado em **1 mensagem** com 1 insight ("✅ Lançado. Mercado no mês: R$ 312 de R$ 400") — pós-out/2026 cada mensagem enviada custa.
- Beta: começar JÁ no test number (custo R$ 0, janela de custo zero vai até 30/09/2026 — validar em produção real dentro dela).

</specifics>

<deferred>
## Deferred Ideas

- **Assistente robusto NO WhatsApp (premium)** — conselhos/análises/criar categoria via WhatsApp. Placeholder adicionado ao ROADMAP (decisão do dono 2026-07-17); planejar só pós-tração. Multi-turn no WhatsApp segue rejeitado como over-engineering para o bot leve.
- **Auto-insert com desfazer** — alavanca de custo/UX pós-telemetria (CU-01).
- **Promo founders pagamento único** — descartada como modelo permanente; se ressuscitar, só como lote limitado e consciente no M6.
- **Botões interativos nativos** — pós-MVP (ES-02).
- **Áudio/imagem no bot** — V2 (design §8; custo e superfície de erro dobram).
- **Verificação Meta Business + display name "Fides Money" + mensagens proativas** — pós-tração, exige CNPJ (SLU, adendo D-8).

### Reviewed Todos (not folded)
- `2026-07-16-assistente-modais-write-stale-acumulados.md` (high) — bug de fila de confirmações WRITE no chat **in-app** (`fides-claude.jsx`); precisa de sessão `/gsd-debug` própria, superfície distinta do webhook. Mantida a decisão do dono (2026-07-16): fase futura de hardening/UX do assistente WRITE in-app.

</deferred>

---

*Phase: 14-ia-4-bot-whatsapp-via-meta-cloud-api*
*Context gathered: 2026-07-17*
