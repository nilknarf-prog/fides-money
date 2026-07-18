-- Fides Money — wa-schema (Phase 14 / IA-4 Bot WhatsApp via Meta Cloud API)
-- Fundação SQL do canal WhatsApp: colunas de vínculo de telefone em `profiles`
-- + 4 tabelas protegidas (opt-in por posse, dedupe de mensagem, confirmação
-- D-1 pendente, caps de uso do canal). Doc-of-record: espelha a migração
-- aplicada no banco live (ROADMAP B10).
--
-- Padrão de tabela protegida (idêntico a admin-backoffice.sql:39-61):
-- RLS on + ZERO policies + `revoke all ... from anon, authenticated` +
-- `grant ... to service_role` explícito. O ÚNICO chamador legítimo é
-- `api/whatsapp.js` (webhook, roda como service_role pós-verificação HMAC).
-- Diferença em relação ao audit append-only do admin: o webhook precisa de
-- UPDATE (consumed_at em wa_link_codes) e DELETE (expurgo de wa_pending
-- expirado), então o GRANT aqui inclui select/insert/update/delete.
--
-- Idempotência: `create table if not exists` + `add column if not exists` +
-- `create ... if not exists` + REVOKE/GRANT (idempotentes por natureza) —
-- reaplicar o arquivo inteiro é seguro (convenção "self-healing on replay"
-- de schema.sql, aprendizado 08-08: create-table-if-not-exists NUNCA adiciona
-- coluna a tabela pré-existente — por isso os ALTERs de profiles abaixo são
-- standalone, fora de qualquer bloco CREATE).
--
-- LGPD (WA-LGPD-01, ver 14-CONTEXT.md): todas as FKs para profiles(id) usam
-- `on delete cascade` — ao excluir a conta do usuário, todo o rastro
-- WhatsApp (código de vínculo, mensagens deduplicadas, confirmação pendente,
-- uso do canal) é removido junto. `wa_messages.body` tem retenção de 90 dias
-- (expurgo operacional fora deste arquivo — não há job/cron nesta fase,
-- mesmo modelo de expurgo manual documentado em admin-backoffice.sql).

-- ─────────────────────────────────────────────
-- 1) COLUNAS em profiles: vínculo de número de WhatsApp
--    ALTER standalone idempotente (aprendizado 08-08) — `create table if not
--    exists` acima em schema.sql NÃO adiciona coluna a tabela pré-existente.
-- ─────────────────────────────────────────────
alter table public.profiles add column if not exists phone         text;
alter table public.profiles add column if not exists wa_linked_at  timestamptz;

-- Índice único PARCIAL: permite múltiplos NULL (usuários sem número
-- vinculado), mas garante unicidade entre números efetivamente vinculados
-- (um telefone não pode estar linkado a 2 contas Fides ao mesmo tempo).
create unique index if not exists idx_profiles_phone
  on public.profiles (phone) where phone is not null;

-- ─────────────────────────────────────────────
-- 2) TABELA: wa_link_codes — opt-in por posse (WA-OPTIN-01)
--    Usuário premium gera um código no app (botão "Conectar WhatsApp"),
--    envia esse código pelo WhatsApp; o webhook consome o código e vincula
--    `phone` ao `user_id`. Código expira (`expires_at`) e é de uso único
--    (`consumed_at` marcado no consumo, nunca reconsumido).
-- ─────────────────────────────────────────────
create table if not exists public.wa_link_codes (
  code         text primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  consumed_at  timestamptz
);

create index if not exists idx_wa_link_codes_user on public.wa_link_codes (user_id);

alter table public.wa_link_codes enable row level security;   -- NENHUMA policy → inacessível a anon/authenticated
revoke all on public.wa_link_codes from anon, authenticated;  -- defesa dupla (V7.3)
grant select, insert, update, delete on public.wa_link_codes to service_role;

-- ─────────────────────────────────────────────
-- 3) TABELA: wa_messages — dedupe de wamid (WA-WEBHOOK-01) + cap de número
--    não-vinculado (AC-03: 3/dia por número desconhecido, zero LLM) +
--    retenção LGPD do corpo da mensagem (90 dias, WA-LGPD-01).
--    `wamid` como PRIMARY KEY garante idempotência determinística: reentrega
--    do mesmo webhook pela Meta (retry) nunca duplica processamento.
-- ─────────────────────────────────────────────
create table if not exists public.wa_messages (
  wamid       text primary key,
  from_phone  text,
  created_at  timestamptz not null default now(),
  body        text
);

create index if not exists idx_wa_messages_phone_created
  on public.wa_messages (from_phone, created_at desc);

alter table public.wa_messages enable row level security;
revoke all on public.wa_messages from anon, authenticated;
grant select, insert, update, delete on public.wa_messages to service_role;

-- ─────────────────────────────────────────────
-- 4) TABELA: wa_pending — confirmação D-1 pendente (WA-CONFIRM-01)
--    No máximo 1 confirmação pendente por usuário (`user_id` como PRIMARY
--    KEY) — nova mensagem antes da confirmação anterior expirar SUBSTITUI a
--    pendência (upsert no webhook), nunca acumula fila.
-- ─────────────────────────────────────────────
create table if not exists public.wa_pending (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

alter table public.wa_pending enable row level security;
revoke all on public.wa_pending from anon, authenticated;
grant select, insert, update, delete on public.wa_pending to service_role;

-- ─────────────────────────────────────────────
-- 5) TABELA: wa_usage — caps do canal WhatsApp (CU-02)
--    Tabela IRMÃ de assistant_usage, NÃO uma coluna `channel` nela (decisão
--    de modelagem registrada em 14-01-PLAN.md): admin_list_accounts
--    (admin-backoffice.sql:109-111) e api/assistant.js:279-305 já fazem
--    count() sobre assistant_usage sem filtro de canal — uma coluna nova
--    arriscaria alterar a semântica desses counts existentes (Pitfall 4 do
--    14-RESEARCH.md). Espelha as colunas de telemetria de assistant_usage
--    (prompt_tokens/completion_tokens/latency_ms) para paridade de schema.
-- ─────────────────────────────────────────────
create table if not exists public.wa_usage (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  created_at        timestamptz not null default now(),
  prompt_tokens     int,
  completion_tokens int,
  latency_ms        int
);

create index if not exists idx_wa_usage_user_created
  on public.wa_usage (user_id, created_at desc);

alter table public.wa_usage enable row level security;
revoke all on public.wa_usage from anon, authenticated;
grant select, insert, update, delete on public.wa_usage to service_role;
