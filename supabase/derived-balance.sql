-- =============================================
-- Fides Money — Derived Balance (saldo derivado)
-- Aplica após schema.sql
-- =============================================

-- Coluna opening_balance na tabela accounts
-- (saldo inicial / saldo de ajuste; não é alterada por transações)
alter table public.accounts
  add column if not exists opening_balance numeric(12,2) not null default 0;

-- ─────────────────────────────────────────────────────────────────
-- FUNÇÃO: recalc_account_balance
-- Recalcula accounts.balance como fonte única de verdade:
--   balance = opening_balance + SUM(value) das transações 'cleared'
-- Chamada após insert/update/delete de qualquer transação.
-- ─────────────────────────────────────────────────────────────────
create or replace function public.recalc_account_balance(p_account_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_opening  numeric(12,2);
  v_sum      numeric(12,2);
begin
  select coalesce(opening_balance, 0)
    into v_opening
    from public.accounts
   where id = p_account_id;

  select coalesce(sum(value), 0)
    into v_sum
    from public.transactions
   where account_id = p_account_id
     and status     = 'cleared';

  update public.accounts
     set balance = v_opening + v_sum
   where id = p_account_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- FUNÇÃO: set_account_balance
-- Define o saldo atual de uma conta ajustando opening_balance.
-- Garante que: opening_balance = p_target - SUM(cleared)
-- Usado quando o usuário edita manualmente o "Saldo atual".
-- ─────────────────────────────────────────────────────────────────
create or replace function public.set_account_balance(p_account_id uuid, p_target numeric)
returns void
language plpgsql
security definer
as $$
declare
  v_sum numeric(12,2);
begin
  select coalesce(sum(value), 0)
    into v_sum
    from public.transactions
   where account_id = p_account_id
     and status     = 'cleared';

  update public.accounts
     set opening_balance = p_target - v_sum,
         balance         = p_target
   where id = p_account_id;
end;
$$;

-- Permissões: autenticados podem chamar via rpc
grant execute on function public.recalc_account_balance(uuid)         to authenticated;
grant execute on function public.set_account_balance(uuid, numeric)   to authenticated;
