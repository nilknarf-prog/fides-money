-- =============================================================
-- FIX-2: RPC delete_transaction + reconciliacao de saldos
-- Executar no Supabase Dashboard > SQL Editor
-- Projeto: fides-money | Regiao: Sao Paulo
-- =============================================================

-- PARTE 1: Criar (ou substituir) o RPC delete_transaction
-- Security invoker: respeita RLS, so afeta dados do usuario logado

create or replace function public.delete_transaction(p_tx_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tx record;
  v_partner record;
begin
  if v_uid is null then raise exception 'AUTH'; end if;

  select * into v_tx
  from public.transactions
  where id = p_tx_id and user_id = v_uid;

  if not found then raise exception 'TX_NOT_FOUND'; end if;

  -- Caso 1: Transferencia com duas pernas (transfer_group preenchido)
  if v_tx.is_transfer and v_tx.transfer_group is not null then
    select * into v_partner
    from public.transactions
    where transfer_group = v_tx.transfer_group
      and id <> v_tx.id
      and user_id = v_uid;

    if v_tx.account_id is not null then
      update public.accounts
      set balance = balance - v_tx.value
      where id = v_tx.account_id and user_id = v_uid;
    end if;

    if v_partner.id is not null and v_partner.account_id is not null then
      update public.accounts
      set balance = balance - v_partner.value
      where id = v_partner.account_id and user_id = v_uid;
      delete from public.transactions where id = v_partner.id and user_id = v_uid;
    end if;

    delete from public.transactions where id = v_tx.id and user_id = v_uid;
    return jsonb_build_object('deleted', 2, 'type', 'transfer');
  end if;

  -- Caso 2: is_transfer sem transfer_group (pagamento de fatura — perna unica)
  if v_tx.is_transfer then
    if v_tx.account_id is not null then
      update public.accounts
      set balance = balance - v_tx.value
      where id = v_tx.account_id and user_id = v_uid;
    end if;
    delete from public.transactions where id = v_tx.id and user_id = v_uid;
    return jsonb_build_object('deleted', 1, 'type', 'fatura_payment');
  end if;

  -- Caso 3: Compra de cartao nao quitada (settled = false) — reverte card.used
  if v_tx.card_id is not null and not v_tx.settled then
    update public.cards
    set used = greatest(0, used - abs(v_tx.value))
    where id = v_tx.card_id and user_id = v_uid;
    delete from public.transactions where id = v_tx.id and user_id = v_uid;
    return jsonb_build_object('deleted', 1, 'type', 'card_pending');
  end if;

  -- Caso 4: Compra de cartao ja quitada (settled = true)
  -- O pagamento de fatura ja debitou a conta. Apenas deletar o registro.
  if v_tx.card_id is not null and v_tx.settled then
    delete from public.transactions where id = v_tx.id and user_id = v_uid;
    return jsonb_build_object('deleted', 1, 'type', 'card_settled');
  end if;

  -- Caso 5: Transacao regular (conta corrente/digital) — reverte balance
  if v_tx.account_id is not null then
    update public.accounts
    set balance = balance - v_tx.value
    where id = v_tx.account_id and user_id = v_uid;
  end if;

  delete from public.transactions where id = v_tx.id and user_id = v_uid;
  return jsonb_build_object('deleted', 1, 'type', 'regular');
end;
$$;

grant execute on function public.delete_transaction(uuid) to authenticated;


-- PARTE 2: Reconciliacao de saldos (corrige dados corrompidos por deletes anteriores)
-- Recalcula balance de cada conta como a soma de TODAS as transacoes com account_id

update public.accounts a
set balance = coalesce((
  select sum(t.value)
  from public.transactions t
  where t.account_id = a.id
    and t.user_id = a.user_id
), 0);

-- Recalcula used de cada cartao como soma das compras nao quitadas

update public.cards c
set used = coalesce((
  select sum(abs(t.value))
  from public.transactions t
  where t.card_id = c.id
    and t.user_id = c.user_id
    and t.settled = false
    and t.is_transfer = false
), 0);
