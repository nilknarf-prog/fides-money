# Arquitetura — Logging de transações via WhatsApp + Plano de IA in-app

> Documento de design (não implementação). Gerado 2026-07-06 a partir de: código atual (`api/assistant.js`, `assets/fides-claude.jsx`, `supabase/schema.sql`), histórico do projeto (`docs/Fides_Money_Relatorio_Geral_de_Progresso.md`, `.planning/`), e pesquisa de preços jul/2026 (fontes citadas onde relevante).
> Consome: decisão de arquitetura já esboçada em `Relatorio_Geral:1181-1206`, escopo "WhatsApp Básico" de `commercial_strategy.md`, e o gate B8 (WRITE só após fundação validada).

---

## Lições dos logs (o que já deu errado — e o que isso muda no design)

| Evento | Causa | Consequência para este design |
|---|---|---|
| Rollback Groq/Llama → Gemini (`206f6b2`) | Function calling do Llama falho em PT-BR | Não trocar de provedor por preço sem eval de function calling PT-BR. Gemini Flash-Lite é o piso validado. |
| WRITE removido do assistente (FIX-3, `6018f66`) | Bugs de fundação: `mes` vazio, mês hard-coded, delete sem estorno, lançamento em cartão inconsistente | O gate não era a IA — era a fundação. Hoje FIX-1..4, fase 10 (fatura) e import hardening estão verificados → B8 é destravável. WhatsApp reusa o MESMO caminho de escrita, então B8 vem primeiro. |
| WR-01 (review fase 05) | "Análise da IA" sem throttle → duplo-tap queima cota | Todo endpoint IA novo nasce com throttle + idempotência, sem exceção. |
| WR-02 | Single-shot fecha com erro genérico se o modelo pede tool | Parser WhatsApp NÃO usa tools — usa saída estruturada (JSON schema), caminho único. |
| WR-03 | JWT no corpo do POST | Webhook não tem JWT de usuário; identidade vem de assinatura HMAC + mapeamento phone→user_id. Segredos só em header/env. |
| Incidente import (196 txs duplicadas, fase 10) | Escrita em lote sem dedupe/preview | Idempotência por `wamid` + confirmação antes de gravar são obrigatórias, não opcionais. |
| `create table if not exists` não altera tabela existente | (learning registrado) | Toda coluna nova (`phone`, etc.) entra com `ALTER ... ADD COLUMN IF NOT EXISTS` standalone + `apply_migration` via MCP. |

---

# PARTE A — Arquitetura do bot WhatsApp

## 1. Fluxo completo (sequência)

Ajuste único à espinha decidida: **"Vercel Edge Function" vira Vercel Function padrão** (`api/whatsapp.js`, CommonJS, Fluid Compute) — Edge runtime é desaconselhado pela própria Vercel hoje, não roda o SDK do Supabase confortavelmente, e quebraria o padrão `api/*.js` CommonJS do projeto. A espinha (webhook → validação → parsing LLM → insert) permanece intacta.

```
Usuário (WhatsApp)          Meta Cloud API        api/whatsapp.js (Vercel)         Supabase                Gemini
      │                          │                        │                            │                      │
      │ "gastei 45 no mercado"   │                        │                            │                      │
      ├─────────────────────────►│  POST webhook          │                            │                      │
      │                          ├───────────────────────►│                            │                      │
      │                          │                        │ 1. valida X-Hub-Signature-256 (HMAC app secret)   │
      │                          │                        │    ├─ inválida → 401, fim  │                      │
      │                          │                        │ 2. dedupe por wamid        │                      │
      │                          │                        ├───────────────────────────►│ INSERT wa_messages   │
      │                          │                        │    ├─ já existe → 200, fim (retry da Meta)        │
      │                          │                        │ 3. phone → user_id + plan  │                      │
      │                          │                        ├───────────────────────────►│ SELECT profiles      │
      │                          │                        │    ├─ não vinculado → resposta estática, fim      │
      │                          │                        │    ├─ plan='free' → resposta upgrade, fim         │
      │                          │                        │ 4. é resposta de confirmação pendente?            │
      │                          │                        │    ("sim"/"não"/"1"/"2" com wa_pending ativo)     │
      │                          │                        │    ├─ sim → pula para 7    │                      │
      │                          │                        │ 5. parse NL → JSON         │                      │
      │                          │                        ├──────────────────────────────────────────────────►│
      │                          │                        │◄─ {intent, valor, categoria, conta, confianca...} │
      │                          │                        │ 6. monta card de confirmação                      │
      │                          │                        ├───────────────────────────►│ INSERT wa_pending    │
      │                          │◄───────────────────────┤ send message (Graph API)   │                      │
      │◄─────────────────────────┤ "Registrar despesa R$45,00 · Mercado · Nubank hoje? 1-Sim 2-Não"           │
      │ "1"                      │                        │                            │                      │
      ├─────────────────────────►│  POST webhook          │                            │                      │
      │                          ├───────────────────────►│ (passos 1-4, match pendência)                     │
      │                          │                        │ 7. INSERT transactions (mesma convenção do app)   │
      │                          │                        ├───────────────────────────►│ INSERT + recalc      │
      │                          │◄───────────────────────┤ send confirmação final     │                      │
      │◄─────────────────────────┤ "✅ Lançado: R$45,00 Mercado (Nubank). Saldo do mês: ..."                  │
      │                          │                        │ 200 OK → Meta              │                      │
```

Regras transversais:
- Webhook SEMPRE retorna 200 rápido após processar (processamento inline; parse Gemini ≈ 1–2 s, total < 5 s — dentro do timeout). Sem fila, sem worker (ver §8, over-engineering rejeitado).
- Passo de confirmação ("sim"/"não") é **determinístico** — não passa pelo LLM. Só mensagem nova de transação/consulta chama o Gemini.
- Consulta de saldo (escopo Básico) reusa a mesma query do `consultar_saldo` do assistente — sem LLM na resposta se o intent for claro (formatação por template).

## 2. Provedor WhatsApp

| Critério | Meta Cloud API (direto) | Twilio | Z-API | 360dialog | Evolution API (self-host) |
|---|---|---|---|---|---|
| Oficial / risco de ban | ✅ oficial, zero risco | ✅ oficial | ❌ não-oficial (WhatsApp Web) — risco real de ban do número | ✅ oficial | ❌ não-oficial (Baileys) |
| Custo por msg no nosso caso (usuário inicia, bot responde na janela 24 h) | **R$ 0** — service messages grátis desde jul/2025 | US$ 0,005/msg de markup, **inclusive inbound** | incluso na mensalidade | R$ 0 (pass-through Meta) | R$ 0 |
| Custo fixo | **R$ 0** | ~pay-as-you-go + número | R$ 99,99/mês (Ultimate) | €49/mês | VPS ~US$ 5–10/mês + manutenção |
| Setup | Meta Business verificado + número dedicado + app Meta (burocrático, dias) | rápido | minutos (QR code) | intermediário | horas + operação contínua |
| Conformidade (fintech, LGPD) | melhor posição — relação direta com operador | ok, +1 subprocessador | frágil (ToS violado; dados via cliente não-oficial) | ok | frágil |

**Recomendação: Meta Cloud API direta.** Para bot reativo (usuário sempre inicia), o custo por mensagem é **zero** — toda mensagem não-template dentro da janela de 24 h de atendimento é grátis (fonte: developers.facebook.com/documentation/business-messaging/whatsapp/pricing, vigente jul/2026; contas novas faturam em BRL desde 1/jul/2026). Twilio cobraria markup até no inbound (vira o custo dominante exatamente no nosso caso grátis). Z-API/Evolution são inaceitáveis para produto financeiro pago: número pode ser banido sem aviso e a coleta viola ToS — risco de reputação e continuidade que R$ 99/mês não compensa.

Requisitos práticos do caminho Meta: conta Meta Business com verificação de empresa (na prática pede documento do negócio — CNPJ [verificar na verificação real; fonte oficial não explicita]), número dedicado que **não** esteja ativo no app WhatsApp comum, e app na plataforma Meta for Developers. Sem verificação, o limite inicial (250 conversas iniciadas pela empresa/dia) já basta para o MVP porque o bot quase não inicia conversas.
Plano B se a burocracia Meta travar por semanas: **360dialog** (€49/mês, sem markup, oficial) — mesma API, migração trivial.

## 3. Segurança do webhook

1. **Verificação do endpoint (GET):** handshake `hub.mode/hub.verify_token/hub.challenge` com token aleatório em env var (`WA_VERIFY_TOKEN`). Responde o challenge só se o token bater.
2. **Assinatura (POST):** validar `X-Hub-Signature-256` = HMAC-SHA256 do corpo bruto com o App Secret. Comparação em tempo constante. Falhou → 401 e log. **Nenhum processamento antes disso.** (Cobre também replay de corpo adulterado — a assinatura é sobre o payload exato.)
3. **Idempotência / retry da Meta:** a Meta reenvia webhooks sem 200. Dedupe por `wamid` (id único da mensagem): `INSERT ... ON CONFLICT DO NOTHING` em `wa_messages`; se já existia, responder 200 e encerrar. Isso torna o pipeline inteiro **at-most-once por mensagem** — mesmo raciocínio do dedupe do import da fase 10.
4. **Anti-replay temporal:** descartar (com 200, sem resposta) mensagens com `timestamp` > 10 min no passado — retries velhos ou reprocessamentos não geram lançamento tardio inesperado.
5. **Duplicata de transação (usuário manda 2× a mesma frase):** não bloquear — são mensagens legítimas com `wamid` distintos. A defesa é o passo de confirmação (§7): nada grava sem "sim", e o card mostra o que vai ser gravado. Duplicata consciente é decisão do usuário (coerente com fricção intencional).
6. **Pendências com expiração:** `wa_pending` expira em 10 min; "sim" fora do prazo → "esse lançamento expirou, me manda de novo".
7. **Rate limit:** por número vinculado, reusar o padrão `assistant_usage` (limite diário; sugestão: 50 msg/dia no canal WhatsApp, contador separado do chat in-app). Para números **não vinculados**: máx. 3 respostas estáticas/dia/número, depois silêncio — evita abuso do endpoint como spam relay.
8. **Segredos:** App Secret, token de acesso permanente (system user token) e verify token só em env vars (aba Project do Vercel), nunca no repo — mesma regra do `inject-config.js`.

## 4. Identificação do usuário e gating premium

**Schema novo (todas com `ALTER ... IF NOT EXISTS` standalone + migração via MCP, aprendizado registrado):**

```
profiles:  + phone text unique          -- E.164 (+5511999999999)
           + wa_linked_at timestamptz   -- opt-in comprovado
wa_link_codes:  code text pk, user_id uuid, expires_at timestamptz  -- códigos de vinculação (TTL 10 min)
wa_messages:    wamid text pk, user_id uuid null, phone text, body text null, received_at timestamptz  -- idempotência + auditoria
wa_pending:     user_id uuid pk, payload jsonb, expires_at timestamptz  -- confirmação pendente (1 por usuário)
```

**Opt-in (prova de posse do número, sem custo de template):**
1. No app (Perfil), usuário premium clica "Conectar WhatsApp" → app gera código curto (`FIDES-8F3K2`) em `wa_link_codes` e mostra link `wa.me/<numero_bot>?text=FIDES-8F3K2`.
2. Usuário toca o link → mensagem cai no webhook → código válido? → grava `phone` + `wa_linked_at` no profile, invalida o código, responde "Conectado ✅. Pode mandar seus gastos por aqui."
3. Fluxo inverso (mandar código pelo app para o telefone) exigiria template pago e aprovação — rejeitado.

**Gating por tier:** checagem no passo 3 do fluxo, **antes de qualquer chamada de LLM**: `profiles.plan` (coluna já existe: `free|pro|family`, `schema.sql:14`). Premium = `plan <> 'free'` (nomenclatura final: decisão aberta D-4). O botão "Conectar WhatsApp" no app também só aparece para premium — o gating tem dupla camada (UI + webhook).

**Número desconhecido:** resposta estática única — "Este número não está vinculado a uma conta Fides. Vincule em fides-money.vercel.app (Perfil → Conectar WhatsApp)." Cap de 3/dia/número. Não revela se existe conta, não chama LLM, não custa nada.
**Usuário free vinculado antes de expirar/downgrade:** "O assistente WhatsApp é do plano premium. Assine em <link>." Mesmo cap.
**Opt-out:** mensagem "PARAR" → limpa `phone`/`wa_linked_at`, confirma. (Obrigação LGPD de revogação fácil, §9.)

## 5. Parsing NL → transação

**Modelo recomendado: Gemini 2.5 Flash-Lite — o mesmo já em produção.** Justificativa:
- É o piso de preço confiável para PT-BR ($0,10/M input, $0,40/M output, oficial jul/2026). Claude Haiku 4.5 custa 10× no input ($1,00/M) — qualidade superior de instruction following não se paga para extração de 5 campos; a tarefa é simples demais para o preço. DeepSeek V4 Flash ($0,14/$0,28) não traz ganho que justifique adicionar um segundo provedor + dados financeiros trafegando para infraestrutura na China (custo LGPD/reputacional).
- A lição Groq/Llama está nos logs: troca de provedor sem eval PT-BR custou um ciclo inteiro de migração+rollback. Gemini function calling/structured output em PT-BR já está validado neste produto.
- Um provedor só = uma chave, um faturamento, um throttle. O parser do WhatsApp e o assistente in-app compartilham o mesmo contrato (§B).
- Escalação futura: se evals mostrarem taxa de erro de categorização > tolerância, testar Claude Haiku **só no passo de parse** — trocar 1 chamada, não a arquitetura.

**Técnica: saída estruturada (responseSchema/JSON mode), NÃO function calling.** Elimina por construção o bug WR-02 (single-shot que morre em `tool_calls`): resposta é sempre um JSON validável, caminho único.

**Estrutura do prompt (system):**
- Data de hoje + fuso (America/Sao_Paulo).
- Lista de contas do usuário (nome + id) e cartões (nome + id) — vinda do Supabase, curta.
- Lista fechada de categorias: as ~25 default (`fides-data.jsx:92-118`) + `user_categories` do usuário (só `cat_key` + label).
- Regra de honestidade, literal no prompt: *"Extraia APENAS o que está explícito na mensagem. NUNCA invente valor, conta ou categoria. Campo não mencionado = null. Se a categoria não for óbvia, use confianca:'baixa' em vez de chutar."*

**Saída (schema):**
```json
{
  "intent": "registrar_despesa | registrar_receita | consultar_saldo | ajuda | outro",
  "valor": 45.00,              // null se ausente — NUNCA inferido
  "descricao": "mercado",
  "categoria": "mercado",      // null se não mapear com segurança na lista fechada
  "conta_ou_cartao": null,     // id da lista, ou null se não citado
  "data": "2026-07-06",        // default hoje; "ontem"/"sexta" resolvidos pelo modelo com a data-âncora do prompt
  "confianca": "alta | media | baixa",
  "faltando": ["valor"]        // campos obrigatórios ausentes
}
```

**Guarda determinística anti-alucinação de valor:** regex extrai candidatos numéricos da mensagem original (`45`, `45,90`, `R$ 45`). Se `valor` do LLM não bater com nenhum candidato → tratar como `confianca: baixa` + pedir confirmação explícita do valor. O parser nunca é a única autoridade sobre dinheiro.

**Política de honestidade em camadas:**
| Situação | Ação |
|---|---|
| `valor` null | Perguntar: "Qual o valor?" (não grava nada) |
| `conta_ou_cartao` null e usuário tem >1 destino | Usar conta padrão do opt-in se configurada (D-2); senão perguntar com lista numerada |
| `categoria` null ou `confianca` baixa | Propor no card: "categoria: Outros (responda 3 para trocar)" — nunca gravar chute silencioso |
| `intent: outro` | "Por aqui eu registro gastos/receitas e mostro saldo. Ex.: 'gastei 30 no ifood'. O resto é no app: <link>" |
| Qualquer caso | Card de confirmação antes do insert (§7) — a confirmação é o backstop universal |

## 6. Insert respeitando o modelo derivado

O insert é um `INSERT` puro em `transactions` + as mesmas regras do modal Nova Transação. **Nenhuma mutação de saldo, nunca** — o modelo `saldo = opening_balance + SUM(value WHERE status='cleared')` torna o insert naturalmente seguro: gravar a linha certa É a operação completa.

Regras espelhadas do app (mesma convenção, mesmo código onde possível):
- **Sinal:** despesa = `value` negativo, receita = positivo (`-Math.abs`, convenção confirmada em `fides-transacoes.jsx:2004`).
- **Conta corrente (débito/Pix/dinheiro):** `account_id` set, `status='cleared'`, `month = YYYY-MM da data`. Afeta o saldo derivado imediatamente — via a soma, não via mutação.
- **Cartão de crédito:** `card_id` set, `settled=false`, `month = mesFaturaFor(data, cartão)` (convenção de fechamento). NÃO toca saldo de conta — só entra quando `pay_card_invoice` gerar a movimentação `is_transfer` (fluxo existente, `derived-balance.sql:106-131`). `status` da compra de cartão: espelhar exatamente o que o modal grava hoje [verificar no `addTransaction` — provável `pending`].
- **`mesFaturaFor` no servidor:** a função vive em JS no front (`fides-data.jsx`). O webhook porta a MESMA lógica (ou o arquivo é compartilhado — `api/` pode fazer `require` de um módulo comum extraído). Risco de drift entre as duas cópias → mitigar com módulo único + teste de paridade. Não converter para SQL agora (over-engineering; uma função pura de ~10 linhas).
- **Escrita com service role + validação explícita:** o webhook não tem JWT do usuário, então usa `SUPABASE_SERVICE_ROLE_KEY` — o que bypassa RLS. Mitigação obrigatória: **RPC dedicado `wa_log_transaction(p_user_id, ...)` SECURITY DEFINER** que valida que `account_id`/`card_id` pertencem ao `p_user_id` antes de inserir (mesmo padrão de guarda do `pay_card_invoice`). O handler JS nunca monta INSERT cru com service role. Caminho sensível → passa por `security-reviewer` + `database-reviewer` antes do commit (regra do CLAUDE.md).
- **Pós-insert cleared:** disparar `recalc_account_balance(account_id)` se for o padrão do app após insert [verificar como `addTransaction` sincroniza hoje] — de novo: recálculo derivado, jamais incremento.
- **Categoria:** só valores da lista fechada (default + `user_categories` do dono). O bot **não cria categoria** — decisão do MVP Básico já tomada em `commercial_strategy.md:29`.

## 7. UX de confirmação/desambiguação

**MVP: confirmação SEMPRE, antes de todo insert.** Justificativa tripla: (a) é dinheiro real e o histórico do projeto inclui exatamente um incidente de escrita em lote sem confirmação (196 duplicatas); (b) mensagem custa R$ 0, então o round-trip extra não custa nada; (c) fricção intencional é o valor-núcleo declarado do Fides — auto-insert silencioso seria off-brand.

```
Usuário: "gastei 45 no mercado ontem no nubank"
Bot:     Confirmar lançamento?
         💸 R$ 45,00 · Mercado 🛒
         💳 Nubank (crédito) · fatura de julho
         📅 05/07/2026
         1 · Confirmar   2 · Cancelar   3 · Trocar categoria
```

- Resposta "1"/"sim"/"confirmar" (match determinístico, case-insensitive) → insert → resposta final com resumo + 1 dado útil ("✅ Lançado. Mercado no mês: R$ 312 de R$ 400."). Reforço de valor a cada uso.
- "2"/"não" → descarta pendência, "Cancelado."
- "3" → lista numerada das 8 categorias mais prováveis + "outra: digite o nome".
- Mensagem nova de transação com pendência ativa → pendência antiga é descartada com aviso ("descartei o anterior não confirmado").
- Interactive reply buttons da Cloud API (até 3 botões nativos) são o upgrade natural do "1/2/3" — usar desde o início se o esforço for baixo; texto numerado é o fallback.
- Evolução pós-validação (D-1): auto-insert com desfazer ("✅ Lançado — responda *desfazer* em 5 min para reverter") apenas para `confianca: alta` + todos os campos explícitos. Só depois de semanas de telemetria de taxa de correção.

## 8. Modos de falha

| Etapa | Falha | Tratamento | Usuário vê |
|---|---|---|---|
| Webhook | Assinatura inválida | 401, log, sem resposta | nada |
| Webhook | Payload não-mensagem (status, sticker, áudio, imagem) | 200, ignora (áudio/imagem: resposta estática "por enquanto só texto") | aviso educado (1×/dia) |
| Dedupe | `wamid` repetido (retry Meta) | 200 imediato, sem reprocessar | nada (já respondido antes) |
| Identificação | Supabase indisponível | 200 p/ Meta + log; **sem resposta** (retry natural do usuário) | silêncio; app segue fonte da verdade |
| Gating | free/desconhecido | resposta estática com cap 3/dia | mensagem de upgrade/vínculo |
| Parse | Gemini 429/timeout/5xx | 1 retry com backoff curto; falhou → resposta estática de erro. **Nunca insert em falha de parse.** | "Não consegui processar agora. Tenta de novo em 1 min ou lança pelo app: <link>" |
| Parse | JSON inválido/schema mismatch | 1 retry com instrução de reparo; falhou → mesma resposta acima | idem |
| Confirmação | "sim" com pendência expirada/ausente | resposta explicativa | "Esse lançamento expirou — me manda de novo." |
| Insert | RPC rejeita (conta não é do usuário, valor inválido) | log + resposta de erro; pendência descartada | "Não consegui gravar. Confere no app se a conta ainda existe." |
| Insert | Timeout pós-INSERT (gravou mas resposta falhou) | `wa_pending` só é apagada após envio ok; retry de "sim" encontra pendência marcada `done` → responde status sem re-inserir (flag `done_tx_id` na pendência) | confirmação atrasada, nunca duplicata |
| Envio | Graph API falha ao responder | 1 retry; falhou → log. Transação (se houve) está gravada e aparece no app | pior caso: silêncio, dado salvo |
| Global | Erro não tratado | try/catch raiz → 200 p/ Meta (evita tempestade de retries) + log estruturado | silêncio |

Princípio: **falha nunca grava; gravação nunca duplica; em dúvida, silêncio + app como fonte da verdade.**

**Over-engineering considerado e rejeitado:**
- Fila (Vercel Queues/worker assíncrono) — parse inline leva < 5 s; fila só se telemetria mostrar timeout real.
- Redis/estado de conversa rico — `wa_pending` de 1 linha por usuário cobre o único estado necessário (confirmação).
- Multi-turn com memória de conversa no WhatsApp — fora do escopo Básico; cada mensagem é atômica.
- Suporte a áudio (transcrição) — V2; custo e superfície de erro dobram.
- NLU própria/regex-only sem LLM — regex cobre valor, não cobre "paguei a academia da minha filha ontem"; LLM a R$ 0,001/msg não justifica o híbrido complexo. (A regex fica só como guarda do valor, §5.)

## 9. LGPD

- **Bases legais:** execução de contrato (art. 7º V — a feature é parte do plano pago) para o processamento financeiro; **consentimento explícito** (art. 7º I) para o canal WhatsApp, colhido no opt-in in-app (registro: `wa_linked_at` + código provado por posse). Revogação a qualquer momento via "PARAR" ou pelo app — tão fácil quanto conceder.
- **Operadores/subprocessadores a declarar na política de privacidade:** Meta (WhatsApp Cloud API — mensagens transitam e são processadas na infra da Meta), Google (Gemini API — o texto da mensagem é enviado para parsing; na API paga o Google declara não usar dados para treino [verificar termos vigentes do paid tier]), Supabase (dados em repouso), Vercel (trânsito). Atualizar a política ANTES do lançamento da feature.
- **Minimização:** o prompt ao Gemini leva a mensagem + listas de nomes de contas/categorias — **nunca** extrato, saldos ou histórico (o parse não precisa). Consulta de saldo é formatada por template, sem LLM.
- **Retenção:** `wa_messages.body` (texto bruto) é dado de mensageria — reter 90 dias para auditoria/debug e apagar via job (ou `body = null`, mantendo `wamid` para idempotência, que não é dado pessoal sensível). A transação parseada vive em `transactions` como qualquer outra (dado do produto). Proposta 90 dias = D-7.
- **Direitos do titular:** exclusão de conta já cascateia (`on delete cascade`); adicionar `wa_*` ao cascade. Exportação: `wa_messages` do usuário entra no export.
- **Segurança:** telefone em `profiles` protegido por RLS existente; RPC de escrita com guarda de dono (§6); segredos fora do repo; superfície do webhook revisada por `security-reviewer` (caminho `api/` — regra já automatizada no hook do repo).
- **Não fazer:** marketing proativo pelo número do bot sem opt-in específico (além de custar template pago, contamina a base legal do canal).

## 10. Custo por transação e sustentação do preço

Câmbio de referência: US$ 1 ≈ R$ 5,40 [verificar câmbio vigente].

| Componente | Custo unitário | Base |
|---|---|---|
| WhatsApp (Meta direta, service window) | **R$ 0,00** | pricing oficial Meta jul/2026 — mensagens não-template na janela 24 h grátis |
| Parse Gemini Flash-Lite (~900 tokens in, ~130 out) | ≈ US$ 0,00014 ≈ **R$ 0,0008** | $0,10/M in + $0,40/M out (oficial) |
| Confirmação + resposta final | R$ 0 (sem LLM, sem template) | determinístico |
| **Total por transação registrada** | **≈ R$ 0,001** | |

Cenários mensais por usuário premium (WhatsApp + assistente in-app):

| Perfil | WhatsApp tx/mês | Chat in-app msg/mês | LLM R$/mês | R$/ano |
|---|---|---|---|---|
| Típico | 40 | 30 (~R$ 0,002/msg, contexto maior) | ≈ R$ 0,10 | ≈ R$ 1,20 |
| Pesado | 150 | 300 | ≈ R$ 0,75 | ≈ R$ 9,00 |
| Abusivo (teto: caps 50/dia WA + 100/dia chat) | 1.500 | 3.000 | ≈ R$ 7,50 | ≈ R$ 90 — e é exatamente por isso que os caps existem |

Contra R$ 89,90/ano:

| Item | Pix (Mercado Pago 0,99%) | Cartão (MP 4,98% na hora) |
|---|---|---|
| Taxa de pagamento | R$ 0,89 | R$ 4,48 |
| LLM ano (típico) | R$ 1,20 | R$ 1,20 |
| WhatsApp | R$ 0 | R$ 0 |
| Infra (Vercel/Supabase, rateado) | ~R$ 0 no free tier atual; [verificar] quando escalar | idem |
| **Margem bruta** | **≈ R$ 87,80 (98%)** | **≈ R$ 84,20 (94%)** |

Conclusão: o custo variável é dominado pela **taxa de pagamento**, não pela IA nem pelo WhatsApp. R$ 89,90/ano sustenta a feature com folga enorme; os caps diários (50 WA + 100 chat) limitam o pior caso a ~R$ 90/ano — break-even até no abuso. O medo de custo recorrente que motivou o modelo anual (`commercial_strategy.md:17`) está correto na forma, mas o número real é ~50× menor do que o preço cobre: há espaço para o tier free ter degustação de IA (D-5) sem risco.

---

# PARTE B — Plano de IA in-app (assistente Fides)

## B1. Diagnóstico do estado atual

- Duas superfícies, ambas Gemini 2.5 Flash-Lite via `api/assistant.js`: chat "Assistente Fides" (`fides-claude.jsx`) e botão "Análise da IA" (`fides-orcamento.jsx`). Ambas só-leitura.
- O cliente **já tem** os 4 tools WRITE com card de confirmação (`lancar_transacao`, `recategorizar_transacao`, `editar_transacao`, `criar_categoria` — `fides-claude.jsx:2-5,268-342`), hoje código morto porque o servidor só declara os 2 READ. Reativar WRITE = mudar `TOOLS_DECLARATION` + system prompt no servidor, não construir do zero.
- Dívidas conhecidas do review da fase 05: WR-01 (Análise da IA sem throttle), WR-02 (single-shot morre em `tool_calls` com erro genérico), WR-03 (JWT no body).
- O motivo do WRITE ter sido removido (bugs de fundação: delete sem estorno, mês hard-coded, `mes` vazio, cartão inconsistente) está **resolvido e verificado** — FIX-1..4, RPCs atômicos, fase 10 (fatura + import). B8 dizia "fundação 100%"; a fundação chegou lá.

## B2. Recomendação de modelo: manter Gemini 2.5 Flash-Lite

| Opção | In/Out por 1M tokens | Veredito |
|---|---|---|
| **Gemini 2.5 Flash-Lite (atual)** | $0,10 / $0,40 | ✅ manter — piso de preço confiável, function calling PT-BR já validado NESTE produto, integração pronta |
| Gemini 2.5 Flash | $0,30 / $2,50 | upgrade pontual se evals mostrarem raciocínio fraco em análises — não como default |
| Claude Haiku 4.5 | $1,00 / $5,00 | qualidade maior, 10× o custo de input — não se paga para as tarefas atuais; candidato a A/B no parse se a taxa de erro incomodar |
| DeepSeek V4 Flash | $0,14 / $0,28 | preço similar, adiciona 2º provedor + dados financeiros em infra chinesa — custo LGPD/reputação sem ganho |
| GPT-5.4-nano | $0,20 / $1,25 | sem vantagem sobre Flash-Lite; 2º provedor sem motivo |

A história do projeto já pagou o imposto de "trocar por hype/preço" uma vez (Groq/Llama). **Trocar de modelo não é o problema a resolver — os problemas reais são os 3 WRs e o WRITE desligado.** O caminho menos custoso é literalmente o atual: free tier da Gemini API ainda cobre Flash-Lite para desenvolvimento, e o paid tier custa centavos/usuário/ano (§10).

## B3. Plano em 4 fases (ordem GSD sugerida)

**Fase IA-1 · Hardening do que existe (pré-requisito de tudo)**
- WR-01: throttle/cooldown no "Análise da IA" (mesmo padrão 4 s do chat).
- WR-02: single-shot com `tool_config: NONE` (proibir tools na chamada) OU executar o round-trip READ — escolher um; erro genérico morre.
- WR-03: JWT → header `Authorization: Bearer`.
- Extrair módulo compartilhado de chamada Gemini (payload, safety, erros) — `api/assistant.js` e o futuro `api/whatsapp.js` consomem o mesmo.
- Telemetria mínima: gravar em `assistant_usage` também tokens in/out e latência (colunas novas) → custo real por usuário observável, base para os evals das fases seguintes.

**Fase IA-2 · Destravar B8 (WRITE no chat in-app)**
- Reativar as 4 tools WRITE em `TOOLS_DECLARATION` + system prompt de escrita com regra de honestidade (mesma da §5).
- Card de confirmação já existe no cliente — validar wiring, não recriar.
- Insert via o MESMO RPC `wa_log_transaction`/guardas da Parte A §6 (aqui com JWT do usuário e RLS, caso mais simples).
- UAT dedicado: os 6 bugs da v7 que derrubaram o WRITE viram os 6 casos de teste de regressão do destravamento.
- **Racional de ordem: o WhatsApp reusa parser + regras de insert + confirmação. Validar tudo isso no chat in-app primeiro (ambiente controlado, usuário vê a UI) tira metade do risco do bot.**

**Fase IA-3 · Gating premium in-app**
- Store lê `profiles.plan` real (hoje o front usa mock `plan:'Pro'` em dados de teste; o live nem lê a coluna).
- Free: assistente com degustação (ex.: 10 msg/mês, sem WRITE) — funil de conversão. Premium: chat completo + WRITE + Análise da IA ilimitada dentro dos caps. (Limites exatos = D-5.)
- Paywall suave no app + tela de upgrade (aponta para checkout M6).

**Fase IA-4 · Bot WhatsApp (Parte A inteira)**
- `api/whatsapp.js` + migrações (`phone`, `wa_*`) + opt-in no Perfil + Meta Business setup (este último começa JÁ, em paralelo — é o caminho crítico de calendário, dias/semanas de aprovação).

## B4. Precificação — opções

Custo variável real por usuário premium/ano: **R$ 2–10 de LLM + R$ 0 de WhatsApp + taxa de pagamento** (§10). Ou seja: qualquer preço ≥ R$ 30/ano já teria margem; a decisão é de posicionamento, não de custo.

| Opção | Estrutura | Prós | Contras |
|---|---|---|---|
| **P-1 · Único (decidido em commercial_strategy)** | R$ 89,90/ano tudo incluso | 1 preço, marketing limpo, "R$ 7,50/mês" | sem funil free → aquisição fria mais cara |
| **P-2 · Free + Premium (recomendada)** | Free: app manual completo · Premium R$ 89,90/ano: assistente IA + WhatsApp + análises | funil de conversão (app manual já entrega valor → upgrade pela IA); degustação de IA custa centavos; WhatsApp continua sendo o gatilho de compra | 2 mensagens de marketing |
| P-3 · Blueprint C7 (3 tiers) | Gratuito / Essencial R$ 89,90 / Premium R$ 149,90 (família) | captura valor do multi-usuário | `family` nem existe como feature — precificar o que não existe é promessa furada; adiar até M-família |
| P-4 · Mensal paralelo | + R$ 12,90/mês | reduz barreira de entrada | churn mensal + taxa de pagamento 12×; contradiz a decisão do anual |

**Recomendação: P-2.** Mantém os R$ 89,90/ano decididos como único preço PAGO (a comunicação continua limpa), mas o free tier vira o topo do funil — e o custo de servir free com degustação de IA é da ordem de centavos/usuário/ano. P-3 só quando família existir; P-4 só se a conversão do anual decepcionar.
Cobrança: **Mercado Pago, empurrando Pix** (0,99% = R$ 0,89 vs ~R$ 4,48 no cartão; Stripe BR: 3,99%+R$ 0,39 e Pix invite-only). Assinatura anual via Pix = 1 cobrança/ano, sem dor de recorrência mensal.

---

# Decisões — RESOLVIDAS em 2026-07-06 (Deyglison aceitou todas as recomendações)

| # | Decisão | ✅ DECIDIDO |
|---|---|---|
| D-1 | Confirmação no WhatsApp | Sempre confirmar antes de gravar (MVP); auto-insert com desfazer só pós-telemetria |
| D-2 | Conta padrão para gastos via WhatsApp | Conta padrão configurada no opt-in; ambiguidade real ainda pergunta |
| D-3 | Categoria incerta | Gravar "Outros" com aviso explícito + correção fácil ("3 · trocar categoria") |
| D-4 | Nomenclatura de tier | Usar `pro` existente como premium (zero migração) |
| D-5 | Free tier: degustação de IA | Sim — ~10 msg/mês de chat READ no free |
| D-6 | Escopo Básico do bot | Registrar + saldo + mini-extrato (reusa `consultar_extrato`) |
| D-7 | Retenção do texto bruto | 90 dias |
| D-8 | Provedor | Meta Cloud API direta. ⚠️ **Deyglison NÃO tem CNPJ (jul/2026)** — ver adendo D-8 abaixo |
| D-9 | Ordem de execução | IA-1 → IA-2 → IA-3 → IA-4 (WRITE in-app antes do bot) |
| D-10 | Pagamento | Mercado Pago, checkout empurrando Pix |
| D-11 | Número do bot | Número dedicado obrigatório; origem a definir na fase IA-4 |

## Adendo D-8 — caminho sem CNPJ (pesquisa 2026-07-06)

**Veredito: sem CNPJ NÃO bloqueia o lançamento.** O bot é reativo, e a arquitetura inteira já foi desenhada para isso.

**O que funciona sem CNPJ/verificação (WABA não-verificada):**
- Criar Meta Business Portfolio + registrar número na Cloud API: sem documentos para começar.
- **Responder mensagens iniciadas pelo usuário: ILIMITADO e grátis** — os messaging limits valem só para conversas iniciadas pela empresa (templates). O caso de uso inteiro do Fides (usuário manda gasto → bot responde) roda sem verificação. [Confiança alta — Meta Messaging Limits + BSPs oficiais]
- Teto de 250 conversas business-initiated/24h (Tier 0), até 2 números, <50 templates/dia. Irrelevante pro MVP: o bot quase nunca inicia conversa.
- Sem prazo de expiração documentado — opera indefinidamente em Tier 0. [Não confirmado em texto oficial literal]
- Limitação visível: **display name não aparece** — o usuário vê o número de telefone no topo do chat, não "Fides Money". Cosmético, não funcional.

**O que exige CNPJ (Business Verification):**
- Display name "Fides Money" no chat, escalar mensagens proativas (lembretes, cobrança de renovação), Official Business Account. Documentos aceitos no BR: cartão CNPJ, Certificado MEI, contrato social. Sem trilha para CPF puro. [Confiança média-alta]

**Caminho de CNPJ quando precisar:**
- **MEI NÃO serve para SaaS** — desenvolvimento de software (CNAE 6201-5 etc.) é atividade intelectual fora da lista MEI; usar CNAE MEI errado (ex. "reparação de computadores") arrisca desenquadramento retroativo + débitos. Consenso das fontes contábeis 2026.
- Caminho correto: **SLU no Simples Nacional**, CNAE 6203-1/00 (licenciamento de software não-customizável), Anexo V (15,5% inicial) → Anexo III (6% inicial) com Fator R ≥ 28% via pró-labore. Abertura 5–15 dias úteis; contador online ~R$ 259+/mês; taxas de abertura R$ 500–1.200 (contabilidades online costumam abrir grátis com plano).
- Gatilho para abrir: quando o produto tiver receita que justifique ~R$ 3.500+/ano de custo contábil — não antes.

**Cobrança sem CNPJ:**
- **Mercado Pago PF suporta assinatura recorrente** (ferramenta Assinaturas + API Subscriptions/preapproval) — "MEI, autônomo ou empresa". Cobra os R$ 89,90/ano normalmente.
- Tributação: recebimento de PF como autônomo → **carnê-leão mensal**; a partir de jan/2026, até R$ 5.000/mês de rendimento é isento — no estágio friends-and-family, imposto efetivo ~zero, mas a obrigação declaratória existe.
- Limitação prática: sem CNPJ não emite NFS-e — cliente PJ que exija nota é problema (improvável no B2C do Fides).

**Sequência revisada (substitui o "verificação Meta começa JÁ" da fase IA-4):**
1. Agora: nada a fazer de burocracia. IA-1..IA-3 seguem normal.
2. Fase IA-4 dev: test number da Cloud API (grátis, 5 destinatários pré-cadastrados — Deyglison + até 4 beta testers). Atenção: erro #131030 com 9º dígito BR no cadastro dos números de teste; templates de teste não migram.
3. Lançamento: número real em WABA não-verificada — respostas ilimitadas, custo zero, mostra número em vez de nome.
4. Pós-tração: abrir SLU → Business Verification → display name "Fides Money" + mensagens proativas (renovação de assinatura!) + NFS-e.
5. Validar na prática (business.facebook.com → Security Center) a lista exata de documentos BR quando chegar a hora — política não confirmada em página oficial nesta pesquisa.

**Itens [verificar] pendentes:** câmbio USD→BRL para as tabelas de custo; termos vigentes do paid tier Gemini sobre não-treino com dados (Google AI docs); exigência formal de CNPJ na verificação Meta Business; como `addTransaction` do app grava `status` de compra de cartão e se chama `recalc_account_balance` (espelhar exato); custos de infra Vercel/Supabase ao escalar além do free tier.
