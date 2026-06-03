-- =============================================================
-- LOTE 3: Tabela category_limits + RLS
-- Executar no Supabase Dashboard > SQL Editor
-- =============================================================

create table if not exists public.category_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cat_key text not null,
  month text,
  monthly_limit numeric(12,2) not null check (monthly_limit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, cat_key, month)
);

create index if not exists idx_category_limits_user
  on public.category_limits (user_id, cat_key, month);

alter table public.category_limits enable row level security;

drop policy if exists "category_limits_select_own" on public.category_limits;
create policy "category_limits_select_own" on public.category_limits
  for select using (auth.uid() = user_id);

drop policy if exists "category_limits_insert_own" on public.category_limits;
create policy "category_limits_insert_own" on public.category_limits
  for insert with check (auth.uid() = user_id);

drop policy if exists "category_limits_update_own" on public.category_limits;
create policy "category_limits_update_own" on public.category_limits
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "category_limits_delete_own" on public.category_limits;
create policy "category_limits_delete_own" on public.category_limits
  for delete using (auth.uid() = user_id);

-- Trigger para atualizar updated_at em UPDATE
create or replace function public.touch_category_limits_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_category_limits_updated_at on public.category_limits;
create trigger trg_category_limits_updated_at
  before update on public.category_limits
  for each row execute function public.touch_category_limits_updated_at();
