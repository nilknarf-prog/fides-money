-- Fides Money — wa_log_transaction
-- RPC atômica para lançamento de transação via assistente IA (chat in-app).
-- Espelha o padrão SECURITY DEFINER + owner-guard de pay_card_invoice.
--
-- Caminho EXCLUSIVO do assistente (D-02): NÃO substitui addTransaction do modal.
-- Status normalizado pelo cliente ANTES de chamar (cartão = sempre 'pending').
-- Mês (p_month) calculado pelo cliente (mesFaturaFor p/ cartão, YYYY-MM p/ conta);
-- fallback interno garante month nunca vazio (defesa-em-profundidade P1).

create or replace function public.wa_log_transaction(
  p_description text,
  p_value       numeric,
  p_category    text,
  p_date        date,
  p_month       text,
  p_status      text,
  p_account_id  uuid default null,
  p_card_id     uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid    uuid := auth.uid();
  v_tmp    uuid;
  v_tx_id  uuid;
  v_month  text;
  v_status text;
begin
  -- Auth guard
  if v_uid is null then
    raise exception 'AUTH';
  end if;

  -- Exactly one destination required
  if p_account_id is null and p_card_id is null then
    raise exception 'DESTINO: conta ou cartão obrigatório';
  end if;
  if p_account_id is not null and p_card_id is not null then
    raise exception 'DESTINO: apenas um (conta ou cartão)';
  end if;

  -- Owner guard: account
  if p_account_id is not null then
    select id into v_tmp from public.accounts
     where id = p_account_id and user_id = v_uid;
    if v_tmp is null then
      raise exception 'CONTA';
    end if;
  end if;

  -- Owner guard: card
  if p_card_id is not null then
    select id into v_tmp from public.cards
     where id = p_card_id and user_id = v_uid;
    if v_tmp is null then
      raise exception 'CARTAO';
    end if;
  end if;

  -- Month fallback: never store empty (P1 defense-in-depth)
  v_month := coalesce(nullif(trim(p_month), ''), to_char(p_date, 'YYYY-MM'));

  -- Status fallback
  v_status := coalesce(nullif(trim(p_status), ''), 'pending');

  -- Atomic INSERT
  insert into public.transactions
    (user_id, description, value, category, account, account_id, card_id,
     date, month, status, recurrent, subscription, settled, is_transfer)
  values
    (v_uid, p_description, p_value, p_category,
     coalesce(p_account_id, p_card_id)::text,
     p_account_id, p_card_id,
     p_date, v_month, v_status,
     false, false, false, false)
  returning id into v_tx_id;

  -- Derived balance side-effects (DERIVED-SAFE-01)
  if p_account_id is not null then
    perform public.recalc_account_balance(p_account_id);
  end if;

  -- Card used increment (only for expenses, p_value < 0)
  if p_card_id is not null and p_value < 0 then
    update public.cards
       set used = used + abs(p_value)
     where id = p_card_id and user_id = v_uid;
  end if;

  return jsonb_build_object('id', v_tx_id, 'inserted', true);
end;
$$;

grant execute on function public.wa_log_transaction(text, numeric, text, date, text, text, uuid, uuid) to authenticated;
