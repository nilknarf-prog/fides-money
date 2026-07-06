-- =============================================
-- Fides Money — Schema v1
-- Executar no Supabase SQL Editor em ordem
-- =============================================

create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- TABELA: profiles
-- ─────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  name        text not null default '',
  plan        text not null default 'free' check (plan in ('free', 'pro', 'family')),
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- TABELA: accounts
-- ─────────────────────────────────────────────
create table if not exists public.accounts (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.profiles(id) on delete cascade not null,
  name        text not null,
  type        text not null default 'checking',
  tag         text not null default '',
  balance     numeric(12,2) not null default 0,
  color       text not null default '#00C37B',
  bank        text not null default '',
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- TABELA: cards
-- ─────────────────────────────────────────────
create table if not exists public.cards (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id) on delete cascade not null,
  name            text not null,
  tag             text not null default '',
  card_limit      numeric(12,2) not null default 0,
  used            numeric(12,2) not null default 0,
  due_day         int not null default 10,
  closing_day     int not null default 3,
  expected_invoice jsonb not null default '{}'::jsonb,
  color           text not null default '#1A1A2E',
  bank            text not null default '',
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- TABELA: transactions
-- ─────────────────────────────────────────────
create table if not exists public.transactions (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references public.profiles(id) on delete cascade not null,
  description  text not null,
  value        numeric(12,2) not null,
  category     text not null default 'outros',
  account      text not null default '',
  date         date not null,
  month        text not null,
  status       text not null default 'cleared'
               check (status in ('cleared','pending','scheduled')),
  recurrent    boolean not null default false,
  subscription boolean not null default false,
  account_id   uuid references public.accounts(id) on delete set null,
  card_id      uuid references public.cards(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- TABELA: goals
-- ─────────────────────────────────────────────
create table if not exists public.goals (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id) on delete cascade not null,
  name            text not null,
  description     text,
  emoji           text not null default '🎯',
  target          numeric(12,2) not null,
  current         numeric(12,2) not null default 0,
  monthly_contrib numeric(12,2) not null default 0,
  tint            text not null default '#00C37B',
  target_date     date,
  completed       boolean not null default false,
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);

-- Vision-board (Phase 08): capa da meta — guarda 'preset:<id>' OU URL pública
-- do Storage (bucket goal-covers) OU null. Nullable, sem default: metas antigas
-- ficam null → fallback gradiente tint no app (sem backfill).
alter table public.goals add column if not exists image_url text;

-- Defensive idempotent ALTERs: `create table if not exists` above does NOT add columns
-- to an already-existing table. completed/completed_at were declared only in the create
-- block, so they never reached the pre-existing live goals table — the Phase-08 completion
-- bug. These standalone ALTERs make the schema self-healing on any future replay.
alter table public.goals add column if not exists completed    boolean not null default false;
alter table public.goals add column if not exists completed_at  timestamptz;

-- ─────────────────────────────────────────────
-- TABELA: user_categories
-- Categorias customizadas por usuário (defaults ficam hardcoded no app).
-- ─────────────────────────────────────────────
create table if not exists public.user_categories (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.profiles(id) on delete cascade not null,
  cat_key     text not null,
  label       text not null,
  emoji       text not null default '🏷️',
  tint        text not null default '#94A3B8',
  grp         text not null default 'estilo',
  custom      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (user_id, cat_key)
);

-- ─────────────────────────────────────────────
-- TABELA: category_limits
-- ─────────────────────────────────────────────
create table if not exists public.category_limits (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id) on delete cascade not null,
  cat_key         text not null,
  month           text,
  monthly_limit   numeric(12,2) not null check (monthly_limit > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, cat_key, month)
);

create index if not exists idx_category_limits_user
  on public.category_limits (user_id, cat_key, month);

-- ─────────────────────────────────────────────
-- TABELA: assistant_usage
-- Contagem de chamadas do assistente por usuário (rate limit 100/dia) + telemetria
-- de custo/performance por chamada (AI-TELEM-01). Achado da pesquisa (Phase 11 P03):
-- esta tabela NÃO tinha espelho .sql no repositório — criada direto no banco via MCP
-- (débito B10). Este bloco documenta a estrutura real que o servidor já usa.
-- ─────────────────────────────────────────────
create table if not exists public.assistant_usage (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.profiles(id) on delete cascade not null,
  created_at  timestamptz not null default now()
);

-- Defensive idempotent ALTERs: `create table if not exists` acima NÃO adiciona colunas a
-- uma tabela já existente (learning 08-08: completed/completed_at ficaram só no bloco
-- CREATE e nunca chegaram na tabela goals live). Por isso as colunas de telemetria abaixo
-- precisam de ALTER standalone para chegar em assistant_usage no banco real.
-- AI-TELEM-01: prompt_tokens/completion_tokens/latency_ms — todas int, nullable, sem
-- default. Chamadas antigas e chamadas que falharam no Gemini ficam null, sem backfill.
alter table public.assistant_usage add column if not exists prompt_tokens     int;
alter table public.assistant_usage add column if not exists completion_tokens int;
alter table public.assistant_usage add column if not exists latency_ms       int;

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
alter table public.profiles        enable row level security;
alter table public.accounts        enable row level security;
alter table public.cards           enable row level security;
alter table public.transactions    enable row level security;
alter table public.goals           enable row level security;
alter table public.user_categories enable row level security;
alter table public.category_limits enable row level security;

create policy "profiles: próprio usuário"     on public.profiles
  for all using (auth.uid() = id);
create policy "accounts: próprio usuário"     on public.accounts
  for all using (auth.uid() = user_id);
create policy "cards: próprio usuário"        on public.cards
  for all using (auth.uid() = user_id);
create policy "transactions: próprio usuário" on public.transactions
  for all using (auth.uid() = user_id);
create policy "goals: próprio usuário"        on public.goals
  for all using (auth.uid() = user_id);
create policy "user_categories: próprio usuário" on public.user_categories
  for all using (auth.uid() = user_id);
create policy "category_limits: próprio usuário" on public.category_limits
  for all using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- TRIGGER: criar profile ao cadastrar usuário
-- ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
