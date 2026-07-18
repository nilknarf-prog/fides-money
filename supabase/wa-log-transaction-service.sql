-- Fides Money — wa_log_transaction_service (Phase 14 / IA-4 Bot WhatsApp, TE-01)
-- Variante SERVICE_ROLE-ONLY de wa-log-transaction.sql: aceita p_user_id
-- explícito porque auth.uid() é NULL sob service_role (o webhook não tem
-- JWT de usuário — resolve phone→user_id internamente pós-HMAC).
--
-- NÃO reusa wa_log_transaction (Phase 12) às cegas: aquele RPC guarda por
-- auth.uid() e é grantado a `authenticated` (caminho do chat in-app, com
-- JWT). Este é o caminho do webhook: p_user_id confiável + GRANT exclusivo
-- a service_role, espelhando o padrão já em produção admin_set_plan
-- (supabase/admin-backoffice.sql:140-188, revisado security+database Phase 16).
--
-- Nota p/ security-reviewer (confused-deputy, INTENCIONAL — mesma nota que
-- admin_set_plan já documenta): a função CONFIA em p_user_id sem revalidar
-- JWT (não há JWT no webhook). Mitigação: GRANT exclusivo a service_role →
-- o único chamador possível é api/whatsapp.js pós-verificação HMAC
-- (X-Hub-Signature-256) + resolução phone→user_id via wa_link_codes/
-- profiles.phone. `authenticated` nem consegue executar a função (REVOKE
-- explícito abaixo, verificado no checkpoint humano: permission denied).

create or replace function public.wa_log_transaction_service(
  p_user_id     uuid,           -- explícito: auth.uid() é NULL sob service_role
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
  v_tmp   uuid;
  v_tx_id uuid;
begin
  -- Auth guard: p_user_id é obrigatório (substitui o auth.uid() is null de wa_log_transaction)
  if p_user_id is null then
    raise exception 'AUTH: p_user_id obrigatório';
  end if;

  -- Exactly one destination required
  if p_account_id is null and p_card_id is null then
    raise exception 'DESTINO: conta ou cartão obrigatório';
  end if;
  if p_account_id is not null and p_card_id is not null then
    raise exception 'DESTINO: apenas um (conta ou cartão)';
  end if;

  -- Owner guard: account — validado contra p_user_id, NÃO auth.uid()
  if p_account_id is not null then
    select id into v_tmp from public.accounts
     where id = p_account_id and user_id = p_user_id;
    if v_tmp is null then
      raise exception 'CONTA';
    end if;
  end if;

  -- Owner guard: card — validado contra p_user_id, NÃO auth.uid()
  if p_card_id is not null then
    select id into v_tmp from public.cards
     where id = p_card_id and user_id = p_user_id;
    if v_tmp is null then
      raise exception 'CARTAO';
    end if;
  end if;

  -- Atomic INSERT (mesmas colunas/valores de wa_log_transaction, month/status
  -- com o mesmo fallback de defesa-em-profundidade P1)
  insert into public.transactions
    (user_id, description, value, category, account, account_id, card_id,
     date, month, status, recurrent, subscription, settled, is_transfer)
  values
    (p_user_id, p_description, p_value, p_category,
     coalesce(p_account_id, p_card_id)::text,
     p_account_id, p_card_id,
     p_date,
     coalesce(nullif(trim(p_month), ''), to_char(p_date, 'YYYY-MM')),
     coalesce(nullif(trim(p_status), ''), 'pending'),
     false, false, false, false)
  returning id into v_tx_id;

  -- Derived balance side-effects (DERIVED-SAFE-01) — idêntico a wa_log_transaction
  if p_account_id is not null then
    perform public.recalc_account_balance(p_account_id);
  end if;

  -- Card used increment (only for expenses, p_value < 0)
  if p_card_id is not null and p_value < 0 then
    update public.cards
       set used = used + abs(p_value)
     where id = p_card_id and user_id = p_user_id;
  end if;

  return jsonb_build_object('id', v_tx_id, 'inserted', true);
end;
$$;

-- CRÍTICO (M8, já documentado em admin-backoffice.sql): EXECUTE de plpgsql é
-- PUBLIC por default. REVOKE explícito ANTES do GRANT, pela assinatura EXATA
-- de 9 tipos. Sem o REVOKE, authenticated herdaria EXECUTE e poderia inserir
-- transações em nome de qualquer p_user_id forjado (elevação de privilégio).
-- Diferença central em relação a wa_log_transaction (que faz grant a
-- authenticated): esta variante NUNCA concede EXECUTE a authenticated.
revoke execute on function public.wa_log_transaction_service(uuid, text, numeric, text, date, text, text, uuid, uuid) from public, anon, authenticated;
grant  execute on function public.wa_log_transaction_service(uuid, text, numeric, text, date, text, text, uuid, uuid) to service_role;
