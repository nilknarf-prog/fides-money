-- Fides Money — admin-backoffice (Phase 16 / ADMIN-01)
-- Fundação SQL do painel admin: tabela de auditoria + 2 RPCs SECURITY DEFINER.
-- Doc-of-record: espelha a migração aplicada no banco live (ROADMAP B10).
--
-- Decisão travada (D-1c): TODA mutação/leitura admin passa por caminho servidor
-- com `service_role` via RPC — JAMAIS pelo client SDK. As RPCs abaixo são
-- executáveis SÓ por `service_role` (REVOKE de public/anon/authenticated +
-- GRANT exclusivo). O único chamador legítimo é `api/admin.js` pós-guard.
--
-- Trava 13-02 (profiles-plan-privileges.sql) fica INTACTA: nenhum REVOKE/GRANT de
-- `public.profiles` é tocado aqui. `admin_set_plan` roda como definer (owner
-- postgres = BYPASSRLS/ignora column-privilege por design), então muta `plan`
-- sem reabrir a coluna para `authenticated`.
--
-- Introspecção live (2026-07-16) confirmou os 8 pressupostos A1–A8:
--   profiles = (id, name, plan, created_at, group_targets)  -- SEM coluna email
--   assistant_usage = (id, user_id, created_at, prompt_tokens, completion_tokens, latency_ms)
--   auth.users tem email + last_sign_in_at; extensão uuid-ossp presente;
--   accounts/cards/goals/transactions têm user_id; nenhum objeto admin pré-existente.
--
-- Idempotência: `if not exists` + `create or replace` + REVOKE/GRANT (idempotentes
-- por natureza) — reaplicar o arquivo inteiro é seguro (convenção defensiva do
-- projeto, cf. schema.sql "self-healing on replay").

-- ─────────────────────────────────────────────
-- 1) TABELA: admin_audit_log
--    RLS on + ZERO policies + REVOKE ALL de anon/authenticated (defesa dupla).
--    Só service_role (via api/admin.js) lê/escreve. Minimização LGPD: guarda
--    metadados da ação, nunca lançamentos financeiros individuais.
-- ─────────────────────────────────────────────
create table if not exists public.admin_audit_log (
  id          uuid primary key default uuid_generate_v4(),
  admin_id    uuid not null,
  admin_email text not null,
  action      text not null,   -- 'set_plan'|'list_accounts'|'get_account'|'view_audit'|'denied_access'
  target_user uuid,
  before      jsonb,
  after       jsonb,
  reason      text,
  ip          text,
  user_agent  text,
  status      text not null default 'ok' check (status in ('ok','denied','error')),
  created_at  timestamptz not null default now()
);

create index if not exists idx_admin_audit_created on public.admin_audit_log (created_at desc);
create index if not exists idx_admin_audit_target  on public.admin_audit_log (target_user, created_at desc);

alter table public.admin_audit_log enable row level security;   -- NENHUMA policy → inacessível a anon/authenticated
revoke all on public.admin_audit_log from anon, authenticated;  -- defesa dupla (V7.3)
-- Grant explícito ao service_role (não depender do default privilege implícito da plataforma).
-- Só SELECT+INSERT: audit trail é append-only por design (sem UPDATE/DELETE mesmo via backend).
grant select, insert on public.admin_audit_log to service_role;

-- ─────────────────────────────────────────────
-- 2) RPC: admin_list_accounts — leitura agregada em 1 round-trip
--    SECURITY DEFINER + set search_path (convenção derived-balance.sql:14 / M6).
--    Join auth.users × profiles + contagens agregadas + ai_msgs_month; retorna
--    page + total_count (M12). Minimização LGPD: só metadados/contagens.
-- ─────────────────────────────────────────────
create or replace function public.admin_list_accounts(
  p_search text default null,
  p_plan   text default null,
  p_limit  int  default 50,
  p_offset int  default 0
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_total  int;
  v_rows   jsonb;
  v_limit  int  := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset int  := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_plan   text := nullif(trim(coalesce(p_plan, '')), '');
begin
  -- total do conjunto filtrado (paginação — M12)
  select count(*) into v_total
  from public.profiles p
  join auth.users u on u.id = p.id
  where (v_search is null or u.email ilike '%'||v_search||'%' or p.name ilike '%'||v_search||'%')
    and (v_plan is null or p.plan = v_plan);

  -- página agregada
  select jsonb_agg(to_jsonb(t) order by t.created_at desc) into v_rows
  from (
    select
      p.id              as user_id,
      u.email           as email,
      p.name            as name,
      p.plan            as plan,
      p.created_at      as created_at,
      u.last_sign_in_at as last_sign_in_at,
      (select count(*) from public.accounts     a where a.user_id = p.id) as accounts_count,
      (select count(*) from public.cards        c where c.user_id = p.id) as cards_count,
      (select count(*) from public.goals        g where g.user_id = p.id) as goals_count,
      (select count(*) from public.transactions x where x.user_id = p.id) as transactions_count,
      (select count(*) from public.assistant_usage au
         where au.user_id = p.id
           and au.created_at >= date_trunc('month', now())) as ai_msgs_month
    from public.profiles p
    join auth.users u on u.id = p.id
    where (v_search is null or u.email ilike '%'||v_search||'%' or p.name ilike '%'||v_search||'%')
      and (v_plan is null or p.plan = v_plan)
    order by p.created_at desc
    limit v_limit offset v_offset
  ) t;

  return jsonb_build_object('accounts', coalesce(v_rows, '[]'::jsonb), 'total_count', v_total);
end;
$$;

-- EXECUTE de plpgsql é PUBLIC por default (M8/Pitfall 1): REVOKE explícito ANTES do GRANT,
-- pela assinatura EXATA. Sem o REVOKE, authenticated herdaria EXECUTE e poderia ler tudo.
revoke execute on function public.admin_list_accounts(text, text, int, int) from public, anon, authenticated;
grant  execute on function public.admin_list_accounts(text, text, int, int) to service_role;

-- ─────────────────────────────────────────────
-- 3) RPC: admin_set_plan — mutação atômica de tier + audit na MESMA transação
--    SECURITY DEFINER + set search_path (M6). Valida o enum no banco (defesa em
--    profundidade sobre o CHECK de schema.sql:14). Retorna {target, before, after}.
--
--    Nota p/ security-reviewer (confused-deputy, INTENCIONAL): a RPC CONFIA em
--    p_admin_id/p_admin_email — NÃO usa auth.uid() (é NULL sob service_role,
--    Pitfall 3). Mitigação: GRANT exclusivo a service_role → único chamador
--    possível é api/admin.js pós-guard, que preenche os params do JWT já
--    verificado. authenticated nem consegue executar a função.
-- ─────────────────────────────────────────────
create or replace function public.admin_set_plan(
  p_admin_id    uuid,
  p_admin_email text,
  p_target_user uuid,
  p_new_plan    text,
  p_reason      text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_before text;
begin
  -- validação de domínio (defesa em profundidade sobre o CHECK de schema.sql:14)
  if p_new_plan not in ('free','pro','family') then
    raise exception 'PLAN_INVALIDO: %', p_new_plan;
  end if;

  -- lock da linha alvo + captura do plano anterior
  select plan into v_before
  from public.profiles
  where id = p_target_user
  for update;

  if v_before is null then
    raise exception 'ALVO_INEXISTENTE';
  end if;

  -- mutação de tier (service_role/definer ignora column-privilege da 13-02 por design)
  update public.profiles set plan = p_new_plan where id = p_target_user;

  -- audit atômico (mesma transação — rollback conjunto em qualquer erro)
  insert into public.admin_audit_log
    (admin_id, admin_email, action, target_user, before, after, reason, status)
  values
    (p_admin_id, p_admin_email, 'set_plan', p_target_user,
     jsonb_build_object('plan', v_before),
     jsonb_build_object('plan', p_new_plan),
     p_reason, 'ok');

  return jsonb_build_object('target', p_target_user, 'before', v_before, 'after', p_new_plan);
end;
$$;

-- Mesmo bloco REVOKE/GRANT completo da RPC de leitura (M8) — pela assinatura EXATA.
revoke execute on function public.admin_set_plan(uuid, text, uuid, text, text) from public, anon, authenticated;
grant  execute on function public.admin_set_plan(uuid, text, uuid, text, text) to service_role;
