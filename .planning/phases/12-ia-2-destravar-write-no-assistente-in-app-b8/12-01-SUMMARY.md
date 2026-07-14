# Plan 12-01 Summary

> Reconstruído retroativamente em 2026-07-14 durante reparo de saúde do `.planning/` (o SUMMARY não foi escrito na execução original). Fonte: `12-01-PLAN.md`, código em `supabase/wa-log-transaction.sql`, commit `9a9ead5`.

**Requirements:** WRITE-01, DERIVED-SAFE-01 · **Commit:** `9a9ead5` · **Onda:** 1

- **RPC atômica `wa_log_transaction` (D-01)**: criada em PL/pgSQL como o ÚNICO caminho de insert do `lancar_transacao` do assistente. Assinatura `(p_description text, p_value numeric, p_category text, p_date date, p_month text, p_status text, p_account_id uuid, p_card_id uuid) returns jsonb`. Espelha o padrão de `pay_card_invoice`. Não substitui o `addTransaction` do modal "Nova Transação" (D-02 — blast radius controlado).
- **SECURITY DEFINER + hardening**: header `language plpgsql security definer set search_path to 'public'`. `v_uid := auth.uid()` INTERNO — nunca aceita `p_user_id` do cliente (A1; `p_user_id` fica reservado ao caso service-role da Fase 14/WhatsApp).
- **Owner-guard duplo (T-12-rpc-01)**: antes de qualquer mutação, valida o destino com `where id = p_x and user_id = v_uid` tanto no branch de conta (`accounts`) quanto no de cartão (`cards`); `raise exception` se não pertencer ao usuário. Exige exatamente UM destino (erro se ambos nulos ou ambos preenchidos).
- **DERIVED-SAFE-01 (saldo nunca incremental em JS)**: se `p_account_id` presente → `perform public.recalc_account_balance(p_account_id)` dentro da função; se `p_card_id` presente e `p_value < 0` → `update public.cards set used = used + abs(p_value)`. Tudo na mesma transação SQL (atômico).
- **Defesa-em-profundidade do mês (P1)**: grava `v_month := coalesce(nullif(trim(p_month), ''), to_char(p_date, 'YYYY-MM'))` — nunca grava `month` vazio, mesmo que o cliente mande `p_month=''`.
- **Grant restrito**: `grant execute on function public.wa_log_transaction(text, numeric, text, date, text, text, uuid, uuid) to authenticated`.
- **Aplicação LIVE**: função aplicada no Supabase LIVE via MCP (não só no `.sql`); `supabase/wa-log-transaction.sql` é o doc-of-record e a função foi espelhada em `supabase/schema.sql`. Fonte da verdade = banco LIVE.
- **Gate sensível (`supabase/`)**: `database-reviewer` executado sobre a RPC antes do commit — foco em SECURITY DEFINER + search_path, cobertura do owner-guard nos dois branches, ausência de mutação incremental de saldo e grant restrito a `authenticated`. Sem findings `high` em aberto.
