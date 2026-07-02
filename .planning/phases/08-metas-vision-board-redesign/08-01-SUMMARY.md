---
phase: 08-metas-vision-board-redesign
plan: 01
subsystem: supabase
status: partial — Task 1 done; Task 2 (live apply) PENDING human checkpoint
tags: [supabase, storage, rls, migration, security, goals]
dependency-graph:
  requires: []
  provides:
    - "goals.image_url (text nullable) — espelho SQL + LIVE (após checkpoint)"
    - "bucket goal-covers + 4 policies owner-scoped — espelho SQL + LIVE (após checkpoint)"
  affects:
    - "Plan 03 (uploadGoalCover/deleteGoalCover apontam para o bucket)"
    - "Plan 06 (persiste em goals.image_url; upload no bucket)"
tech-stack:
  added: ["Supabase Storage (primeiro uso no projeto)"]
  patterns:
    - "owner-scoped Storage RLS via (storage.foldername(name))[1] = (select auth.uid())::text"
    - "bucket public=true p/ render via getPublicUrl; SELECT via SDK escopado ao dono"
key-files:
  created:
    - supabase/goal-covers-storage.sql
  modified:
    - supabase/schema.sql
commits:
  - "040dc31: feat(08-01): coluna goals.image_url + bucket goal-covers com RLS owner-scoped"
decisions:
  - "SELECT escopado ao dono (authenticated) em vez do 'to public' verbatim da RESEARCH — desvio pós security-review: o app só renderiza capas via getPublicUrl (endpoint público, bucket public=true bypassa RLS) e nunca chama list()/download(), então escopar o SELECT ao dono não perde função e elimina enumeração anônima do bucket."
  - "drop policy if exists antes de cada create policy (Postgres não tem CREATE POLICY IF NOT EXISTS) — re-run safe, pois a aplicação é manual ao banco live."
  - "(select auth.uid()) em vez de auth.uid() — evita re-avaliação por-linha (lint Supabase auth_rls_initplan)."
  - "alter table storage.objects enable row level security no topo — idempotente, remove uma suposição sobre o estado live."
  - "image_url text nullable sem default — add column if not exists é metadata-only em Postgres 11+, sem rewrite/backfill; metas antigas ficam null → fallback gradiente tint no app."
---

# 08-01 — Fundação de dados do vision-board

## Task 1 (auto) — CONCLUÍDA
Escritos e commitados (040dc31) os dois espelhos SQL:
- `supabase/schema.sql`: `alter table public.goals add column if not exists image_url text;` (diff restrito a essa coluna — verificado `git diff --stat` = 1 file, 5 insertions, 0 deletions).
- `supabase/goal-covers-storage.sql` (novo): bucket `goal-covers` (public, 5MB, jpeg/png/webp) + 4 policies owner-scoped em `storage.objects` (leitura própria / escrita / atualização / exclusão).

Ambos revisados por `security-reviewer` + `database-reviewer` antes do commit (exigência do próprio plano). Sem findings CRITICAL/HIGH. Os 3 MEDIUM (enumeração via SELECT público, ausência de re-run guard, `auth.uid()` não-wrapped) foram corrigidos in-place antes do commit — ver decisions. Nomes de coluna `file_size_limit`/`allowed_mime_types` confirmados corretos pelo database-reviewer.

## Task 2 (checkpoint:human-verify, gate=blocking-human) — PENDENTE
Aplicação ao banco LIVE nao foi feita nesta sessao: Supabase MCP sem auth (nao-interativo) e a aplicacao exige o painel/credencial do dono do projeto (`autonomous:false` por design do plano).

**O que falta o humano fazer (em ordem):**
1. Confirmar ao vivo que `public.goals` tem RLS ENABLED + policy `goals: próprio usuário` com `auth.uid() = user_id` (Dashboard → Authentication → Policies, ou MCP). Se divergir do espelho, PARAR e reportar antes de aplicar as policies do bucket.
2. Aplicar `alter table public.goals add column if not exists image_url text;` (MCP apply_migration ou SQL Editor).
3. Aplicar `supabase/goal-covers-storage.sql` (bucket + 4 policies). Se apply_migration reclamar dos nomes de coluna do bucket, criar o bucket via Dashboard → Storage → New bucket (public, 5MB, MIME jpeg/png/webp) e só as policies via SQL Editor.
4. Confirmar bucket `goal-covers` (public) + 4 policies em Storage → Policies.

**Resume-signal:** digite "aplicado" quando a coluna existir live E o bucket + 4 policies estiverem criados E o RLS de goals confirmado; ou descreva a divergencia.

## Impacto enquanto Task 2 nao roda
`addGoal` (Plan 03) envia `image_url` em TODO insert de meta, entao criacao de metas falha contra o banco live ate a coluna existir (surfaca via Toast, nao e bug). Portanto a UAT de capas (UAT-1/2/5) e o smoke test RLS de dois usuarios ficam bloqueados ate o apply.
