-- Fides Money — Derived Balance (saldo = opening_balance + SUM(value WHERE status='cleared'))
-- Espelha exatamente a migração aplicada em produção (project nhwarucfecoqcahcosga).

alter table public.accounts
  add column if not exists opening_balance numeric(12,2) not null default 0;

-- seed consistente: derivado == saldo atual (idempotente; re-rodar é no-op)
update public.accounts a
   set opening_balance = a.balance - coalesce(
     (select sum(t.value) from public.transactions t
       where t.account_id = a.id and t.status = 'cleared'), 0);

create or replace function public.recalc_account_balance(p_account_id uuid)
returns numeric language plpgsql security definer set search_path to 'public' as $$
declare v_bal numeric;
begin
  update public.accounts a
     set balance = a.opening_balance + coalesce(
       (select sum(t.value) from public.transactions t
         where t.account_id = a.id and t.status = 'cleared'), 0)
   where a.id = p_account_id
  returning a.balance into v_bal;
  return v_bal;
end; $$;
grant execute on function public.recalc_account_balance(uuid) to authenticated;

create or replace function public.set_account_balance(p_account_id uuid, p_target numeric)
returns numeric language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_sum numeric;
begin
  if v_uid is null then raise exception 'AUTH'; end if;
  select coalesce(sum(t.value),0) into v_sum from public.transactions t
   where t.account_id = p_account_id and t.status = 'cleared';
  update public.accounts
     set opening_balance = p_target - v_sum, balance = p_target
   where id = p_account_id and user_id = v_uid;
  if not found then raise exception 'CONTA'; end if;
  return p_target;
end; $$;
grant execute on function public.set_account_balance(uuid, numeric) to authenticated;

create or replace function public.delete_transaction(p_tx_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_tx record; v_pair record; v_grp uuid;
begin
  if v_uid is null then raise exception 'AUTH'; end if;
  select * into v_tx from public.transactions where id = p_tx_id and user_id = v_uid;
  if not found then raise exception 'TX_NOT_FOUND'; end if;

  if v_tx.transfer_group is not null then
    v_grp := v_tx.transfer_group;
    select * into v_pair from public.transactions
      where transfer_group = v_grp and id <> v_tx.id and user_id = v_uid;
    delete from public.transactions where transfer_group = v_grp and user_id = v_uid;
    if v_tx.account_id   is not null then perform public.recalc_account_balance(v_tx.account_id); end if;
    if v_pair.account_id is not null then perform public.recalc_account_balance(v_pair.account_id); end if;
    return jsonb_build_object('deleted', 2, 'group', v_grp);
  end if;

  if v_tx.card_id is not null and not coalesce(v_tx.settled,false) then
    update public.cards set used = greatest(0, used - abs(v_tx.value))
     where id = v_tx.card_id and user_id = v_uid;
  end if;

  delete from public.transactions where id = p_tx_id and user_id = v_uid;
  if v_tx.account_id is not null then perform public.recalc_account_balance(v_tx.account_id); end if;
  return jsonb_build_object('deleted', 1);
end; $$;
grant execute on function public.delete_transaction(uuid) to authenticated;

create or replace function public.transfer_funds(p_from uuid, p_to uuid, p_value numeric, p_date date default null, p_desc text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_grp uuid := gen_random_uuid();
        v_date date := coalesce(p_date, (now() at time zone 'utc')::date);
        v_from_name text; v_to_name text; v_tmp uuid;
begin
  if v_uid is null then raise exception 'AUTH'; end if;
  if p_value is null or p_value <= 0 then raise exception 'VALOR'; end if;
  if p_from = p_to then raise exception 'CONTAS'; end if;
  select id, name into v_tmp, v_from_name from public.accounts where id=p_from and user_id=v_uid;
  if v_tmp is null then raise exception 'ORIGEM'; end if;
  select id, name into v_tmp, v_to_name   from public.accounts where id=p_to   and user_id=v_uid;
  if v_tmp is null then raise exception 'DESTINO'; end if;

  insert into public.transactions
    (user_id, description, value, category, account, account_id, card_id,
     date, month, status, recurrent, subscription, settled, is_transfer, transfer_group)
  values
    (v_uid, coalesce(nullif(p_desc,''),'Transferência para '||v_to_name),
     -p_value,'transferencia',p_from::text,p_from,null,
     v_date,to_char(v_date,'YYYY-MM'),'cleared',false,false,true,true,v_grp);
  insert into public.transactions
    (user_id, description, value, category, account, account_id, card_id,
     date, month, status, recurrent, subscription, settled, is_transfer, transfer_group)
  values
    (v_uid, coalesce(nullif(p_desc,''),'Transferência de '||v_from_name),
     p_value,'transferencia',p_to::text,p_to,null,
     v_date,to_char(v_date,'YYYY-MM'),'cleared',false,false,true,true,v_grp);

  perform public.recalc_account_balance(p_from);
  perform public.recalc_account_balance(p_to);
  return jsonb_build_object('group', v_grp, 'value', p_value, 'date', v_date);
end; $$;
grant execute on function public.transfer_funds(uuid,uuid,numeric,date,text) to authenticated;

create or replace function public.pay_card_invoice(p_card_id uuid, p_account_id uuid, p_tx_ids uuid[])
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_total numeric(12,2); v_count int;
        v_today date := (now() at time zone 'utc')::date; v_tmp uuid;
begin
  if v_uid is null then raise exception 'AUTH'; end if;
  select id into v_tmp from public.accounts where id=p_account_id and user_id=v_uid;
  if v_tmp is null then raise exception 'CONTA'; end if;
  select id into v_tmp from public.cards where id=p_card_id and user_id=v_uid;
  if v_tmp is null then raise exception 'CARTAO'; end if;

  select coalesce(sum(abs(value)),0), count(*) into v_total, v_count
  from public.transactions
  where id = any(p_tx_ids) and user_id=v_uid and card_id=p_card_id and settled=false;
  if v_count=0 or v_total<=0 then raise exception 'FATURA: nada em aberto'; end if;

  insert into public.transactions
    (user_id, description, value, category, account, account_id, card_id,
     date, month, status, recurrent, subscription, settled, is_transfer)
  values
    (v_uid,'Pagamento de fatura',-v_total,'divida',
     p_account_id::text,p_account_id,null,
     v_today,to_char(v_today,'YYYY-MM'),'cleared',false,false,true,true);

  update public.transactions set settled=true, paid_at=now(), status='cleared'
   where id = any(p_tx_ids) and user_id=v_uid and card_id=p_card_id and settled=false;
  update public.cards set used = greatest(0, used - v_total)
   where id=p_card_id and user_id=v_uid;

  perform public.recalc_account_balance(p_account_id);
  return jsonb_build_object('paid', v_total, 'count', v_count);
end; $$;
grant execute on function public.pay_card_invoice(uuid,uuid,uuid[]) to authenticated;
