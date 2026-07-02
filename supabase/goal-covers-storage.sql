-- ═════════════════════════════════════════════════════════════════════════
-- STORAGE: bucket goal-covers (Phase 08 — vision-board)
-- ═════════════════════════════════════════════════════════════════════════
-- Espelho do bucket + policies aplicados ao banco LIVE (não há Supabase CLI —
-- aplicar via MCP apply_migration OU Dashboard → SQL Editor / Storage).
--
-- Object path SEMPRE = "<user_id>/<uuid>.<ext>" (o app gera o nome via
-- uploadGoalCover em assets/fides-store.jsx — o nome NUNCA vem do arquivo do
-- usuário → sem path traversal). A 1ª pasta do path é o auth.uid() do dono,
-- e é isso que as policies owner-scoped abaixo checam.
--
-- Convenção de nome mirror de supabase/schema.sql:141-154 ("<recurso>: próprio usuário").
-- Fontes: https://supabase.com/docs/guides/storage/security/access-control
--         https://supabase.com/docs/guides/storage/schema/helper-functions
--
-- Re-run safe: `drop policy if exists` antes de cada create (Postgres não tem
-- CREATE POLICY IF NOT EXISTS) e `on conflict do nothing` no bucket. Usa
-- `(select auth.uid())` (evita re-avaliação por-linha — lint auth_rls_initplan).
-- ─────────────────────────────────────────────────────────────────────────

-- RLS já vem habilitado em storage.objects por padrão; reafirmar é idempotente.
alter table storage.objects enable row level security;

-- 1) Bucket: leitura pública (endpoint /object/public/... — bypassa RLS), limite
--    5MB, apenas imagens raster (SVG excluído de propósito: evita XSS via <img>).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('goal-covers', 'goal-covers', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- 2) Leitura via SDK (list/download/createSignedUrl): só o dono. A renderização
--    das capas usa getPublicUrl → endpoint público (bucket public=true), que NÃO
--    passa por esta policy; o app não chama list()/download() (confirmado na
--    security review). Escopar ao dono impede enumeração anônima do bucket.
drop policy if exists "goal-covers: leitura pública" on storage.objects;
drop policy if exists "goal-covers: leitura própria" on storage.objects;
create policy "goal-covers: leitura própria"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'goal-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 3) Escrita own-only — o path precisa começar por "<auth.uid()>/".
drop policy if exists "goal-covers: escrita própria" on storage.objects;
create policy "goal-covers: escrita própria"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'goal-covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- 4) Atualização own-only (caso upsert/overwrite seja usado).
drop policy if exists "goal-covers: atualização própria" on storage.objects;
create policy "goal-covers: atualização própria"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'goal-covers' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'goal-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 5) Exclusão own-only (deleteGoalCover ao trocar/excluir capa).
drop policy if exists "goal-covers: exclusão própria" on storage.objects;
create policy "goal-covers: exclusão própria"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'goal-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
