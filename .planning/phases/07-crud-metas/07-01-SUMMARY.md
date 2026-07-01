---
phase: 07-crud-metas
plan: 01
status: complete
completed: 2026-07-01
requirements: [META-01, META-02, META-03, META-04]
files_modified:
  - supabase/schema.sql
---

# 07-01 SUMMARY — Colunas target_date + description em goals

## O que foi feito

Adicionadas duas colunas nullable à tabela live `public.goals` (project `nhwarucfecoqcahcosga`):

- `target_date date` (nullable, sem default) — prazo da meta (D-01/D-02/D-03)
- `description text` (nullable, sem default) — descrição da meta (D-10)

Espelho atualizado em `supabase/schema.sql` no bloco `create table if not exists public.goals`.

## Prova (schema live via SQL)

**ANTES** — colunas de `public.goals`: id, user_id, name, emoji, target, current, monthly_contrib, tint, completed, completed_at, created_at. SEM target_date/description.

**DDL aplicado:**
```sql
alter table public.goals add column if not exists target_date date;
alter table public.goals add column if not exists description text;
```

**DEPOIS** — `information_schema.columns` confirmou:

| column_name | data_type | is_nullable |
| ----------- | --------- | ----------- |
| target_date | date      | YES         |
| description | text      | YES         |

Demais colunas intactas. RLS (`for all using (auth.uid() = user_id)`) inalterado — cobre as colunas novas automaticamente.

## Desvio

Plano previa `apply_migration` via Supabase MCP. O Supabase MCP **não estava conectado** nesta sessão (runtime Antigravity/Claude Code sem o conector ativo; ToolSearch não encontrou as ferramentas). Migration executada **manualmente pelo usuário** no SQL Editor do Supabase, com o mesmo DDL idempotente do plano, e verificada via `information_schema.columns`. Regra PROJECT.md §4 preservada: schema verificado no banco live (não inferido do espelho) + espelho `supabase/schema.sql` atualizado após aplicar.

## Self-Check: PASSED

- [x] target_date (date, nullable) na tabela live — confirmado via SELECT
- [x] description (text, nullable) na tabela live — confirmado via SELECT
- [x] supabase/schema.sql espelha ambas as colunas no bloco goals
- [x] Nenhuma coluna pré-existente alterada; metas existentes intactas (colunas nullable, sem backfill)
