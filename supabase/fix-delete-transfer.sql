-- Fix: delete_transaction reverte ambas as pernas de transferencia
-- Executar manualmente no Supabase SQL Editor apos o deploy.
create or replace function public.delete_transaction(p_tx_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_tx   record;
  v_pair record;
begin
  if v_uid is null then raise exception 'AUTH'; end if;

  select * into v_tx from public.transactions
   where id = p_tx_id and user_id = v_uid;
  if not found then raise exception 'TX_NOT_FOUND'; end if;

  if v_tx.transfer_group is not null then
    select * into v_pair from public.transactions
     where transfer_group = v_tx.transfer_group
       and id <> v_tx.id and user_id = v_uid;

    if v_tx.account_id is not null then
      update public.accounts set balance = balance - v_tx.value
       where id = v_tx.account_id and user_id = v_uid;
    end if;

    if v_pair is not null and v_pair.account_id is not null then
      update public.accounts set balance = balance - v_pair.value
       where id = v_pair.account_id and user_id = v_uid;
    end if;

    delete from public.transactions
     where transfer_group = v_tx.transfer_group and user_id = v_uid;

    return jsonb_build_object('deleted', 2, 'group', v_tx.transfer_group);
  end if;

  if v_tx.account_id is not null
     and not coalesce(v_tx.is_transfer, false) then
    update public.accounts set balance = balance - v_tx.value
     where id = v_tx.account_id and user_id = v_uid;
  end if;

  if v_tx.card_id is not null
     and not coalesce(v_tx.settled, false) then
    update public.cards
       set used = greatest(0, used - abs(v_tx.value))
     where id = v_tx.card_id and user_id = v_uid;
  end if;

  delete from public.transactions where id = p_tx_id and user_id = v_uid;

  return jsonb_build_object('deleted', 1);
end;
$$;

grant execute on function public.delete_transaction(uuid) to authenticated;
