# Phase 8: Metas vision-board redesign - Research

**Researched:** 2026-07-02
**Domain:** Supabase Storage (bucket + RLS) + React-via-Babel-standalone UI redesign + schema migration
**Confidence:** MEDIUM (frontend/store patterns = HIGH, verified against live code; Storage/RLS SQL = MEDIUM, cited from official docs but Supabase MCP unavailable this session for live schema verification)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D1 — Estratégia de imagem:** Galeria curada + upload próprio, ambos nesta fase (não faseado).
- **D2 — Direção de layout:** Editorial-first: identidade Fides domina; funções do PlannerFin absorvidas, não copiadas.
- **D3 — Hero:** Hero exclusivo da área de Metas (`met-hero`). Classe própria. NÃO reutilizar/mesclar/herdar o hero inicial da home (`stu-hero`). Backdrop = colagem sutil (mask) das capas para diferenciar do hero da home.
- **D4 — Fonte dos presets:** Capas bespoke geradas (texturas/gradientes na paleta tint), bundladas em `assets/covers/*.webp`, servidas estáticas pela Vercel (sem CSP/rede externa). ~16 capas temáticas. Referenciadas por key `preset:<id>`.
- **D5 — Modelo de status:** Ativa / Concluída reusando a coluna `completed` (boolean) já existente. Sem coluna nova de status nesta fase. Filtro e pill derivam de `completed`.
- **D6 — Update inline:** Manter os dois fluxos: Aportar (soma + projeção — extra Fides) e Atualizar saldo (seta `current` direto — parity PlannerFin).

**Frontend:** `met-hero` (eyebrow "vision board · N metas em curso", headline "Você guardou R$X para os seus sonhos", lede narrativa, strip). Barra de controles nova (busca client-side + filtro segmentado Todas/Ativas/Concluídas + "Nova meta"). Cards `vcard` (capa 186px, overlay, corpo, hover/tap ações). Modais `CriarMetaModal`/`AjustarPlanoModal` ganham seletor de capa (abas Galeria/Enviar foto) + campos Valor atual + Status. Preservar Capítulo II/III, `AportarModal`, `MetConfirmDeleteModal`.

**Data/write layer:** `normalizeGoal` mapeia `image_url` → `cover`. `addGoal`/`updateGoal` aceitam `cover`/`image_url` e `current` inicial. Status via `completed` existente.

**Backend Supabase (security review obrigatória):** Migração `alter table public.goals add column image_url text;` (nullable, espelhar em `schema.sql`). Bucket `goal-covers`: leitura pública, escrita/update/delete só do dono via `auth.uid()` = pasta `user_id/`, validação content-type/tamanho/extensão, nome `user_id/<uuid>.<ext>`. Upload via client autenticado (anon key + sessão), nunca `service_role`.

**Identidade:** Hero só em Metas; tint dirige barra/scrim/acento mesmo com foto; Manrope + sage-paper + verde floresta; `tokens.css` primeiro CSS; Rules of Hooks (hooks antes de early return).

### Claude's Discretion

- Estrutura interna dos componentes React (`vcard`, barra de controles, seletor de capa) desde que respeite classes/identidade acima.
- Nomes de helpers, organização de CSS, aparência exata das ~16 capas bespoke.
- Detalhe de implementação do filtro client-side e do estado local no `MetasStudio`.
- Estratégia de teste/validação (definida pela pesquisa + planner) — ver `## Validation Architecture` abaixo.

### Deferred Ideas (OUT OF SCOPE)

- Coluna de status enum (Pausada/Arquivada) — D5 usa `completed`.
- Crop/edição de imagem avançada — só upload + fit cover.
- Reordenar metas por drag.
- Fluxo de conquista completo ao concluir meta — segue `EmBreveModal`.
- Tocar no hero da home (`stu-hero`) — D3 proíbe.
</user_constraints>

## Summary

Phase 07 already shipped the CRUD wiring (`addGoal`/`updateGoal`/`deleteGoal`, `CriarMetaModal`, `AjustarPlanoModal`, `MetConfirmDeleteModal`) and the schema already has `target_date`, `description`, `completed`, `completed_at`, and RLS is enabled on `goals` (`auth.uid() = user_id`, verified from `supabase/schema.sql` — Supabase MCP was unavailable this session, see Gaps below). This phase is **additive on top of a working base**, not a rebuild: it adds one nullable column (`image_url`), one new Storage bucket (`goal-covers`) with owner-scoped RLS, a set of bundled preset cover images, and a frontend pass that (a) gives Metas its own hero identity distinct from the shared `stu-hero`, (b) redesigns `.met-card` into `.vcard` with a cover image, (c) adds a client-side search + status segmented filter bar, and (d) **finishes wiring things Phase 07 left as placeholders**: `AportarModal` is defined but never mounted (its trigger still opens the `EmBreve` overlay), `completed`/`completed_at` are not read by `normalizeGoal` at all, and "Marcar como concluída" is wired to the placeholder too. This phase's UAT criteria (aporte reflects instantly, status filter works, "Já atingidas" populates) cannot pass without fixing these wiring gaps — they are in scope even though CONTEXT.md doesn't call them out explicitly, because D5/D6 require the underlying data to flow.

The two technically novel pieces are (1) Supabase Storage bucket creation + RLS policies for a "public-read, owner-write" pattern, for which this project already has a strong in-repo precedent (`goals: próprio usuário` policy style in `schema.sql:144`) to mirror, and (2) generating ~16 bespoke `.webp` cover images with **no image-encoding tool available in this environment** (`cwebp`, `imagemagick`/`magick`, and the Supabase CLI are all absent from PATH) — this is a real environment gap the planner must address explicitly (see Environment Availability and Pitfall 5).

**Primary recommendation:** Treat this as four independently sequenceable slices — (1) schema + RLS verification, (2) Storage bucket + policies + preset assets, (3) store/write-layer plumbing (`normalizeGoal`, `addGoal`/`updateGoal`, upload/delete helpers), (4) UI redesign (hero, controls bar, vcard, cover picker, Aportar/Atualizar/completed wiring) — with the Storage bucket work gated behind a `security-reviewer` pass per CLAUDE.md before merge, and a `checkpoint:human-verify` before the migration/bucket SQL actually runs against production (Supabase MCP was not available to apply/verify it in this research session).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cover image storage (files) | Database/Storage (Supabase Storage) | — | Binary blobs don't belong in Postgres rows; Storage is the dedicated object-storage tier with its own RLS model |
| Cover reference (`preset:<id>` or Storage URL) | Database/Storage (`goals.image_url` column) | API/Backend (RLS) | A single nullable text column is enough to hold either a preset key or a public URL — no join table needed |
| Upload validation (MIME/size/extension) | Browser/Client (pre-check) | Database/Storage (bucket-level `allowed_mime_types`/`file_size_limit` as enforcement backstop) | Client check is UX (fast feedback); bucket-level constraint is the actual security boundary since client checks are trivially bypassable |
| Owner-only write/delete of cover objects | Database/Storage (RLS policy on `storage.objects`) | — | Must be enforced at the Postgres/Storage policy layer, not in application code — client only holds the anon key |
| Public read of cover images | Database/Storage (bucket `public: true` or public-read policy) | CDN/Static (Vercel edge cache for `assets/covers/*` presets specifically) | Preset covers are static app assets (CDN tier); user-uploaded covers are Storage-tier objects served via Supabase's own CDN |
| Search/filter of goals list | Browser/Client (`MetasStudio` local state) | — | Small dataset (per-user goal count is low, tens not thousands) — client-side filter over already-loaded `goals` array, no new query needed |
| Status derivation (Ativa/Concluída) | Browser/Client (derived from `goals[].completed`) | Database/Storage (`goals.completed` boolean, already exists) | D5: no new column; UI just needs to start reading a column it already ignores |
| Inline balance update (Aportar / Atualizar saldo) | API/Backend write path (`updateGoal` → Supabase `update`) | Browser/Client (optimistic mock-mode branch) | Same `mode==='live'` vs mock split already used by every other mutation in `fides-store.jsx` |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | `2.x` (CDN `@2` tag, currently loaded via `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js` in `index.html:14`) [VERIFIED: codebase] | Auth + Postgres client + **Storage client** (`window.fidesDb.storage`) | Already the project's only DB/Storage client; Storage has been part of the v2 UMD bundle since release — no new script tag needed |

No new runtime/browser packages are required for this phase — the existing `window.fidesDb` instance already exposes `.storage.from(bucket)`.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@squoosh/cli` (npx, dev-only, not shipped to browser) | latest (published 2023-01-03, GoogleChromeLabs official repo) [VERIFIED: npm registry via `gsd-tools package-legitimacy`, verdict OK] | One-time PNG/JPG → WEBP conversion for the 16 preset covers | Only if presets are generated as raster images first (see Pitfall 5) |
| `sharp` (npm, dev-only) | latest, 64.8M weekly downloads, `lovell/sharp` official repo [VERIFIED: npm registry via `gsd-tools package-legitimacy`, verdict SUS — flagged `too-new` because the *latest version's* publish date is recent; the package itself is a 10+ year, extremely high-download library. Treat the SUS verdict as a false positive but still gate behind `checkpoint:human-verify` per protocol.] | Alternative to `@squoosh/cli` for scripted SVG→WEBP/PNG→WEBP batch conversion | Only if the covers are authored as SVG and need rasterizing, or if `@squoosh/cli` proves awkward in CI |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raster `.webp` presets (as D4 specifies) | Hand-authored `.svg` gradient/texture presets, referenced by the same `preset:<id>` key contract | Zero tooling dependency (no cwebp/imagemagick/sharp needed at all — this environment has none installed), trivially small files, crisp at any DPI. **Deviates from D4's literal `.webp` extension** — this is a locked decision, so treat this as a fallback requiring explicit sign-off, not a silent substitution. See Pitfall 5. |
| Public-read bucket (`public: true`) | Private bucket + signed URLs (`createSignedUrl`, time-limited) | CONTEXT.md's own text says "leitura pública (capas não sensíveis) — **confirmar**" — i.e., the user has not fully committed to public-read. Signed URLs add complexity (URL regeneration, expiry) for content that's genuinely low-sensitivity (vacation/goal photos, not financial data) — public-read is the simpler, standard choice for this use case, matching how most apps handle user-avatar-style images. |

**Installation:** No `npm install` needed for the shipped app. If the `.webp`-via-`sharp` path is chosen for one-time cover generation: `npm install --save-dev sharp` (dev-only, never shipped to the browser bundle since there is no bundler — this is a build-time/local script dependency only).

**Version verification:** `@supabase/supabase-js` is loaded via CDN tag `@2` (floating within v2 major) — this is pre-existing project behavior, out of scope to pin here, but worth flagging: Storage API surface (`.storage.from().upload/getPublicUrl/remove`) has been stable across all v2 minor releases, so floating `@2` carries no Storage-specific version risk. [ASSUMED — not independently re-verified this session; consistent with `@supabase/supabase-js@^2.45.0` pinned in `package.json` as the last-known-good baseline.]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@squoosh/cli` | npm | published 2023-01-03 | 2,447/wk | github.com/GoogleChromeLabs/squoosh | OK | Approved (dev-only, optional) |
| `sharp` | npm | latest version published 2026-07-01 (library itself is long-established) | 64,826,015/wk | github.com/lovell/sharp | SUS (`too-new` — false positive, see note) | Flagged — if used, planner must add `checkpoint:human-verify` before adding as devDependency, even though the download count strongly indicates legitimacy |

**Packages removed due to SLOP verdict:** none.
**Packages flagged as suspicious [SUS]:** `sharp` — false-positive due to recent version bump on a 10+ year, 64M-weekly-download package; `@squoosh/cli` is the safer-to-gate alternative if avoiding the checkpoint is preferred.

No packages are added to the shipped browser bundle in this phase — `@supabase/supabase-js` is already loaded and unchanged.

## Architecture Patterns

### System Architecture Diagram

```
Browser (React via Babel-standalone, no build step)
│
├─ MetasStudio (assets/fides-metas.jsx)
│    │
│    ├─ [search text] ──┐
│    ├─ [status filter]─┼─► client-side filter over `goals` (already in memory) ─► vcard grid
│    │                  │
│    ├─ CriarMetaModal ─┤
│    ├─ AjustarPlanoModal ┤── cover picker (Galeria tab: presets from assets/covers/*;
│    │                  │     Enviar foto tab: <input type=file> → uploadGoalCover())
│    ├─ AportarModal ───┤── onConfirm(valor) → updateGoal(id, { current: atual+valor })
│    └─ vcard "Atualizar saldo" quick action → updateGoal(id, { current: novoValor })
│
▼
useFides() (assets/fides-store.jsx)
│
├─ normalizeGoal(row)         — DB row → UI shape (+ cover, completed)
├─ addGoal(g) / updateGoal(id, patch) / deleteGoal(id)  — existing CRUD trio (mode==='live' branch)
├─ uploadGoalCover(userId, file)   — NEW: storage.from('goal-covers').upload(...) → getPublicUrl()
└─ deleteGoalCover(path)           — NEW: storage.from('goal-covers').remove([path])
│
▼
Supabase (Postgres + Storage), same project as everything else
│
├─ public.goals  (+ image_url text, nullable)         — RLS: auth.uid() = user_id (existing)
└─ storage.goal-covers bucket                          — RLS: public read; owner-only write/update/delete
     objects path: <user_id>/<uuid>.<ext>
```

### Recommended Project Structure

```
assets/
├── covers/                 # NEW — bespoke preset covers, static, bundled
│   ├── viagem.webp          # (or .svg — see Pitfall 5)
│   ├── casa.webp
│   └── ... (~16 total)
├── fides-metas.jsx          # MODIFY — hero rename, vcard, controls bar, cover picker, wiring fixes
├── fides-metas.css          # MODIFY — .met-hero, .vcard, .met-controls, .met-cover-picker
└── fides-store.jsx          # MODIFY — normalizeGoal, addGoal/updateGoal payload, + upload/delete helpers

supabase/
└── schema.sql                # MODIFY — mirror `image_url` column + goal-covers bucket/policies (MCP is source of truth; mirror after applying)
```

### Pattern 1: Owner-scoped Storage RLS (mirrors existing `goals: próprio usuário` DB policy style)

**What:** Bucket `goal-covers` — public read, write/update/delete restricted to the folder matching `auth.uid()`.
**When to use:** Any per-user file upload where the object path is namespaced by user id.
**Example:**
```sql
-- Source: https://supabase.com/docs/guides/storage/security/access-control
--         https://supabase.com/docs/guides/storage/schema/helper-functions
-- Naming convention mirrors supabase/schema.sql:136-149 ("<table>: próprio usuário")

-- 1) Create the bucket (SQL form — mirrors how table policies are already applied via migration)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('goal-covers', 'goal-covers', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- 2) Public read (covers are non-sensitive per CONTEXT.md — confirm during security review)
create policy "goal-covers: leitura pública"
  on storage.objects for select
  to public
  using (bucket_id = 'goal-covers');

-- 3) Owner-only insert — object path must start with "<auth.uid()>/"
create policy "goal-covers: escrita própria"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'goal-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4) Owner-only update (needed if upsert/overwrite is ever used)
create policy "goal-covers: atualização própria"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'goal-covers' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'goal-covers' and (storage.foldername(name))[1] = auth.uid()::text);

-- 5) Owner-only delete
create policy "goal-covers: exclusão própria"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'goal-covers' and (storage.foldername(name))[1] = auth.uid()::text);
```
[CITED: supabase.com/docs/guides/storage/security/access-control, supabase.com/docs/guides/storage/schema/helper-functions] — the `storage.foldername(name)[1] = auth.uid()::text` pattern is the documented canonical approach; `file_size_limit`/`allowed_mime_types` as bucket-insert columns are consistent, well-established Supabase schema (`storage.buckets` table), but the exact SQL insert form for those two columns specifically was not directly confirmed against a fetched docs page this session — [ASSUMED, verify column names against the live `storage.buckets` schema via MCP or Supabase dashboard before applying].

### Pattern 2: Client-side upload (mirrors existing `mode === 'live'` write pattern in `fides-store.jsx`)

**What:** Upload a validated image file to the user's folder, return the public URL, delete old cover on replace.
**When to use:** `CriarMetaModal`/`AjustarPlanoModal` cover picker "Enviar foto" tab.
**Example:**
```javascript
// Source: https://supabase.com/docs/guides/storage/quickstart (upload/getPublicUrl shape)
//         pattern mirrors addGoal/updateGoal in assets/fides-store.jsx:571-608 (mode==='live' branch, try/catch, console.error tag)

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB — matches CONTEXT.md D-spec + bucket-level file_size_limit

function extFromMime(mime) {
  return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mime] || null;
}

async function uploadGoalCover(userId, file) {
  if (!ALLOWED_MIME.includes(file.type)) throw new Error('Formato não suportado (use JPG, PNG ou WEBP).');
  if (file.size > MAX_BYTES) throw new Error('Arquivo maior que 5MB.');
  const ext = extFromMime(file.type);
  if (!ext) throw new Error('Formato não suportado.');
  // crypto.randomUUID() — anti-collision, anti-traversal (no user-controlled path segment beyond user_id)
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await window.fidesDb.storage.from('goal-covers').upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  const { data } = window.fidesDb.storage.from('goal-covers').getPublicUrl(path);
  return { url: data.publicUrl, path };
}

async function deleteGoalCover(path) {
  if (!path) return;
  const { error } = await window.fidesDb.storage.from('goal-covers').remove([path]);
  if (error) console.error('[Fides] deleteGoalCover:', error.message);
}
```
[CITED: supabase.com/docs/guides/storage/quickstart for `.upload()` shape] + [ASSUMED for exact `upload()` options object (`contentType`/`upsert`) and `getPublicUrl()` return shape `{ data: { publicUrl } }` — this is stable, well-known v2 API from training knowledge, not independently re-fetched this session; low risk since it has been unchanged across the entire v2 lifecycle]. `crypto.randomUUID()` is a browser-native API (secure-context / HTTPS only — Vercel serves HTTPS, no concern) — no `uuid` npm package needed.

### Pattern 3: `normalizeGoal` extension (mirrors `row.field || default` idiom already used)

**What:** Read `image_url` and `completed`/`completed_at` — the latter two are **currently not mapped at all**, a Phase-07 gap this phase must close for D5 to function.
**Current code** (`assets/fides-store.jsx:90-104`) [VERIFIED: codebase]:
```javascript
function normalizeGoal(row) {
  const d = new Date(row.created_at || Date.now());
  return {
    id: row.id,
    nome: row.name,
    descricao: row.description || '',
    prazo: row.target_date || null,
    emoji: row.emoji || '🎯',
    tint: row.tint || '#00C37B',
    alvo: Number(row.target),
    atual: Number(row.current),
    contribuicao: Number(row.monthly_contrib),
    criadaEm: String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(),
  };
}
```
**Required additions:**
- `cover: row.image_url || null` (D4/D1 — feeds the vcard cover image or preset lookup).
- `completed: !!row.completed` (D5 — **currently missing entirely**; without this, no status filter or "Já atingidas" chapter can work).
- `completedAt: row.completed_at || null` (useful for the "Concluída em" stat variant mentioned in the design spec §3.1).

### Anti-Patterns to Avoid

- **Modifying `.stu-hero` to special-case Metas:** `.stu-hero` and its sub-classes (`.stu-hero-eyebrow`, `.stu-hero-headline`, `.stu-hero-lede`, `.stu-hero-strip`, `.stu-metric*`) are shared, standalone (non-nested) CSS selectors in `assets/fides-studio.css:306-391`, used verbatim by **three** pages: the Dashboard hero (`assets/fides-studio.jsx:216` `StudioStub`, and the real dashboard hero via `EditorialHero` component at `:173-203`), Contas (`assets/fides-contas.jsx:720`), and today's Metas (`assets/fides-metas.jsx:825`). D3 requires Metas' hero to be visually distinct — the correct move is to **rename the outer `<section>` className from `"stu-hero"` to `"met-hero"`** (a new class, own CSS block in `fides-metas.css`) while **keeping the inner elements' shared class names** (`stu-hero-eyebrow`, `stu-hero-headline`, etc.) since those are the established Studio editorial typography vocabulary reused everywhere, not the D3 concern. Do not touch `.stu-hero` itself in `fides-studio.css` — that would regress the Dashboard and Contas heroes.
- **Using `window.confirm()`/`alert()`** for any new confirm/replace-cover flow — CLAUDE.md forbids this; reuse `fides-ui` `Toast`/`useConfirm`/existing `MetConfirmDeleteModal` pattern instead.
- **Setting `current` directly from arbitrary user input without going through `updateGoal`'s existing DB-shaped patch contract** — `updateGoal(id, patch)` already does a plain `.update(patch).eq('id', id)` (no derived-balance RPC exists for goals, unlike accounts' `set_account_balance`) — "Atualizar saldo" inline should call `updateGoal(id, { current: novoValor })` directly, no new RPC needed.
- **Trusting client-side MIME/size checks as the security boundary** — always pair with bucket-level `allowed_mime_types`/`file_size_limit` and the RLS `WITH CHECK` on `storage.objects`; client validation is UX only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Public URL construction for an uploaded object | Manually concatenating `https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>` | `window.fidesDb.storage.from('goal-covers').getPublicUrl(path).data.publicUrl` | The SDK method is stable across project URL/region changes and CDN routing; hand-built strings break silently if Supabase changes its URL scheme |
| Anti-collision file naming | Sanitizing/slugifying the original filename | `crypto.randomUUID()` + extension derived from validated MIME type | Original filenames are attacker-controlled input (path traversal, collisions, unicode issues); a UUID sidesteps all of that entirely, matching CONTEXT.md's own naming rule |
| Search/filter UI chrome | New custom search input + custom segmented control | `.fds-tx-v2-search` pattern (`assets/fides-transacoes.jsx:645-654`, `Icon.Search` already exists in `assets/fides-data.jsx:290`) for the search box; `.fds-seg`/`.fds-seg-3` pattern (`assets/fides-transacoes.jsx:1287-1296`) for the Todas/Ativas/Concluídas segmented filter | Both patterns already exist, are already styled to the Fides identity, and are used elsewhere in the same codebase — reuse eliminates a second inconsistent search/filter implementation |

**Key insight:** Almost nothing in this phase needs new UI primitives — the two genuinely new things are the Storage RLS policies (security-critical, must follow the documented canonical pattern exactly, not be improvised) and the preset cover *generation* (blocked on missing local tooling — see Pitfall 5). Everything else is assembling existing, already-styled Fides components.

## Common Pitfalls

### Pitfall 1: `.stu-hero` shared-class collision (D3 violation risk)
**What goes wrong:** Editing `.stu-hero` CSS "just for Metas" silently changes the Dashboard and Contas heroes too.
**Why it happens:** `.stu-hero` is a bare, non-nested selector reused by 3 pages (`fides-studio.jsx:216`, `fides-contas.jsx:720`, `fides-metas.jsx:825`) — there is no scoping today.
**How to avoid:** Rename only the outer wrapping class in `fides-metas.jsx` (`stu-hero` → `met-hero`), add a **new** CSS block for `.met-hero` in `fides-metas.css` (copy the base box rules from `.stu-hero` in `fides-studio.css:306-322`, then add the distinct backdrop treatment), leave `fides-studio.css`'s `.stu-hero` block completely untouched.
**Warning signs:** Dashboard or Contas hero visually changes after a Metas-only commit; grep `stu-hero` across `assets/*.jsx` before touching `fides-studio.css`.

### Pitfall 2: `completed`/`completed_at` never read (D5 silently no-ops)
**What goes wrong:** Status filter (Ativas/Concluídas) and Capítulo III "Já atingidas" have no data to work with — `normalizeGoal` doesn't map `row.completed` today (verified: no occurrence of `completed` anywhere in `fides-store.jsx` or `fides-metas.jsx`), so every goal reads as "active" regardless of DB state, and the "Já atingidas" section is hardcoded to always show the empty-state string.
**Why it happens:** Phase 07 added `target_date`/`description` to `normalizeGoal` but the pre-existing `completed`/`completed_at` columns were out of scope for that phase and got skipped.
**How to avoid:** Add `completed`/`completedAt` mapping to `normalizeGoal` (Pattern 3 above) as an explicit task, plus wire the dots-menu "Marcar como concluída" (currently `onClick: () => setEmBreve(true)` at `fides-metas.jsx:902`) to `updateGoal(m.id, { completed: true, completed_at: new Date().toISOString() })`.
**Warning signs:** UAT criterion 3 ("filtro Ativas/Concluídas segmenta corretamente") fails even with correct filter UI code, because the underlying `completed` field is always `false`/`undefined` on the client.

### Pitfall 3: `AportarModal` is dead code today
**What goes wrong:** The "Aportar" button on every `.met-card` currently opens the `EmBreveModal` placeholder (`fides-metas.jsx:957`), not the fully-built `AportarModal` component (`fides-metas.jsx:89-181`, complete with preview/projection UI) — it is defined but never mounted or wired to `updateGoal`.
**Why it happens:** Phase 07 explicitly deferred aportes/progress (`current` editing) to this phase per its own CONTEXT.md; the component was pre-built but left disconnected.
**How to avoid:** Mount `<AportarModal>` in `MetasStudio` with `open`/`meta`/`onClose` state (mirrors the `editTarget`/`deleteTarget` pattern already used for edit/delete), and wire `onConfirm={(valor) => updateGoal(target.id, { current: target.atual + valor })}`.
**Warning signs:** UAT criterion 4 ("Aportar soma com projeção") fails silently — clicking Aportar still shows "Em breve".

### Pitfall 4: Rules of Hooks (already bit Phase 07 once)
**What goes wrong:** New `useState`/`useEffect` calls for the search text, status filter, or cover-picker tab state get added *after* an early return (e.g. after the `isEmpty` guard at `fides-metas.jsx:723` or the `!rendered`/`!meta` guards inside modals).
**Why it happens:** It's tempting to add filter state near the code that uses it (inside the `goals.length === 0 ? ... : <>...</>` branch), but all hooks in this codebase are already collected at the top of `MetasStudio` (lines 714-721) specifically to avoid this — a pattern the Phase 07 pattern map explicitly documents as a prior bug fix.
**How to avoid:** Add all new `useState` (search text, status filter, cover-picker tab, upload-in-progress) to the existing unconditional block at the top of `MetasStudio`, and inside any modal component, before its `if (!rendered) return null;` guard.
**Warning signs:** React console warning "Rendered more hooks than during the previous render" — CONTEXT.md's own UAT criterion 7 explicitly checks for "sem warning no console".

### Pitfall 5: No local tooling to produce `.webp` preset images (D4 literal-format risk)
**What goes wrong:** D4 locks the preset format to `assets/covers/*.webp`, but this environment has **no `cwebp`, no `imagemagick`/`magick`, and no Supabase/other image CLI on PATH** [VERIFIED this session via `command -v cwebp`, `command -v magick` — both exit 1/not found]. There is no way to hand-produce 16 bespoke `.webp` texture/gradient files without either (a) generating them elsewhere and converting, or (b) installing a conversion tool.
**Why it happens:** D4 was decided during `/gsd-discuss-phase` without a tooling feasibility check against this specific machine.
**How to avoid — two viable paths, planner/user must pick one explicitly (do not silently choose):**
  1. **Honor D4 literally:** generate 16 raster textures/gradients (via an image-generation skill/tool, or hand-composited CSS-gradient screenshots), then convert to `.webp` with `npx @squoosh/cli --webp auto <in>.png -d assets/covers/` (verified legitimate, no install needed) or a `sharp`-based one-off Node script (`npm install --save-dev sharp`, then remove afterward if desired).
  2. **Zero-tooling fallback:** author the 16 covers as hand-written `.svg` gradient/texture files directly (text-editable, no binary encoding step, trivially matches "texturas/gradientes na paleta tint," tiny file size, crisp at any DPI) — same `assets/covers/`, same `preset:<id>` key contract, only the file extension changes. **This deviates from D4's literal `.webp` and must be flagged back to the user/planner for explicit confirmation, not applied silently**, since D4 is a locked decision.
**Warning signs:** Planner writes a task assuming `.webp` files "just exist" or can be trivially created inline — flag this at plan time, don't defer discovery to execution.

## Runtime State Inventory

> This phase is additive (new column + new bucket), not a rename/refactor/migration of existing identifiers — no existing stored data, live service config, OS-registered state, or secrets reference a string that's changing. Skipping the full inventory table; the one relevant check:

- **Stored data:** No existing `goals` rows reference anything that changes name/shape in this phase — `image_url` is a new, nullable column; existing rows simply get `null` (falls back to gradient-tint rendering per D1's "fallback = gradiente tint quando sem capa"). No backfill needed. **None found requiring migration** — verified by reading the full `goals` schema (`supabase/schema.sql:75-89`).
- **Live service config:** No n8n/Datadog/Tailscale-style out-of-git config touches `goals` or Storage in this project (none of those services are used here, per `CLAUDE.md`'s stack section — Vercel + Supabase only).

## Common Pitfalls (Environment)

See `## Environment Availability` below for the tooling gaps (image conversion, Supabase MCP).

## Code Examples

### Preset key → cover resolution (new helper, `assets/fides-metas.jsx` or `fides-store.jsx`)
```javascript
// Not sourced from docs — derived from D4's `preset:<id>` key contract in CONTEXT.md
const COVER_PRESETS = {
  viagem:   'assets/covers/viagem.webp',   // adjust extension per Pitfall 5 resolution
  casa:     'assets/covers/casa.webp',
  // ... ~16 total, ids chosen at implementation time (Claude's Discretion)
};

function resolveCoverUrl(cover) {
  if (!cover) return null;
  if (cover.startsWith('preset:')) {
    const id = cover.slice('preset:'.length);
    return COVER_PRESETS[id] || null;
  }
  return cover; // already a full Storage public URL
}
```

### Segmented status filter (reusing existing `.fds-seg` pattern)
```javascript
// Pattern source: assets/fides-transacoes.jsx:1286-1296 (fds-seg / fds-seg-3 / "on" class)
const [statusFilter, setStatusFilter] = React.useState('todas'); // declared with other useState, top of MetasStudio

<div className="fds-seg fds-seg-3">
  {[['todas','Todas'], ['ativas','Ativas'], ['concluidas','Concluídas']].map(([k, l]) => (
    <button key={k} className={statusFilter === k ? 'on' : ''} onClick={() => setStatusFilter(k)}>
      {l}
    </button>
  ))}
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| supabase-js v1 `publicURL` (capital URL) property | v2 `publicUrl` (lowercase) on `getPublicUrl()` return | v1→v2 migration (project already on v2) | Not a risk here — project only ever used v2, but worth knowing if any copy-pasted v1-era snippet surfaces during implementation |

**Deprecated/outdated:** None relevant — this is a fresh feature build on an already-current stack (`@supabase/supabase-js@2`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `storage.buckets` table accepts `file_size_limit` (bigint bytes) and `allowed_mime_types` (text[]) as direct SQL `insert` columns, not just via the JS `createBucket()` options object | Architecture Patterns → Pattern 1 SQL | If the columns don't exist/behave differently in the current Supabase version, bucket-level enforcement would need to happen via the JS admin call or dashboard UI instead of the migration SQL shown — verify against live `storage.buckets` schema (MCP) before relying on this SQL as-is |
| A2 | Public-read is the correct choice for `goal-covers` (vs. private + signed URLs) | Alternatives Considered; Storage Pattern 1 | CONTEXT.md itself flags this as "confirmar" — if the user decides covers should be private, the whole RLS policy set (Pattern 1, policy #2) and the `getPublicUrl()` usage in Pattern 2 must switch to `createSignedUrl()` with an expiry, which changes both the SQL and the client code shape |
| A3 | `upload()` options object accepts `{ contentType, upsert }` and `getPublicUrl()` returns `{ data: { publicUrl } }` exactly as shown | Architecture Patterns → Pattern 2 | Low risk (stable, unchanged since v2 launch, matches extensive training-data familiarity) but not independently re-fetched from a docs page this session — a quick smoke test during implementation resolves this cheaply |
| A4 | RLS is actually enabled and correctly scoped on `goals` in the **live** Supabase project, matching `supabase/schema.sql:128-145` | Summary; Security Domain | `schema.sql` may be stale per CLAUDE.md's own warning (ROADMAP B10) — if live RLS differs, the new Storage bucket's owner-scoping model is built on an unverified foundation. Supabase MCP was unavailable (auth required) this session — **must be checked via MCP or Supabase dashboard before/alongside this phase's migration**, ideally as a `checkpoint:human-verify` early task |

## Open Questions (RESOLVED 2026-07-02)

> **All three resolved before planning** and threaded into the plans:
> - **Q1 (`.webp` vs `.svg`)** → **RESOLVED: SVG** (CONTEXT D4 revision + Plan 08-02). No local encoder exists; SVG is zero-tooling and on-brand.
> - **Q2 (bucket public vs private)** → **RESOLVED: public read + UUID object names**, owner-only write/delete (CONTEXT + Plan 08-01; `security-reviewer` sign-off required before commit).
> - **Q3 (live RLS on `goals` verified?)** → **RESOLVED via process:** Plan 08-01 Task 2 is a `[BLOCKING] checkpoint:human-verify` (autonomous:false) confirming live RLS before applying bucket policies.

1. **Preset cover file format: `.webp` (as locked in D4) or `.svg` (zero-tooling fallback)?**
   - What we know: no image-encoding tool exists in this dev environment; two viable paths exist (see Pitfall 5).
   - What's unclear: whether the user is willing to revisit D4's literal `.webp` extension, or wants the planner to source `.webp` generation another way (e.g. run the conversion step outside this sandboxed environment).
   - Recommendation: planner surfaces this explicitly as a first-wave task/checkpoint rather than guessing; default to path 1 (honor `.webp` via `npx @squoosh/cli`) if a raster source image is producible, falls back to SVG only with explicit confirmation.

2. **Is `goal-covers` bucket read-access actually meant to be fully public, or public-but-unguessable (relying on UUID obscurity), or private+signed?**
   - What we know: CONTEXT.md says "leitura pública (capas não sensíveis) — confirmar."
   - What's unclear: the user has not yet explicitly confirmed; UUID-named objects in a public bucket are guessable only by brute force (not indexed/listed since bucket listing itself is also RLS-gated), which is the industry-standard tradeoff for this kind of content, but it's still a security-relevant decision that CLAUDE.md's mandatory security review for `supabase/` changes should formally sign off on.
   - Recommendation: keep Pattern 1 as designed (public read) but route it through the `security-reviewer` gate before merge, per CLAUDE.md.

3. **Is RLS on `goals` (and other tables) verified live, or only assumed from a possibly-stale `schema.sql`?**
   - What we know: `schema.sql:128-145` shows RLS enabled with `auth.uid() = user_id` on all tables including `goals`.
   - What's unclear: whether this matches the live database — Supabase MCP required auth and was unavailable this session.
   - Recommendation: first task of the phase should be a live verification (via MCP once authenticated, or Supabase Dashboard → Authentication → Policies) before building the Storage bucket's owner-scoping on top of this assumption.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | dev tooling (e.g. one-off cover-conversion script) | ✓ | v24.17.0 [VERIFIED: `node --version`] | — |
| `cwebp` | converting raster covers to `.webp` | ✗ | — | `npx @squoosh/cli --webp` or `sharp` (both npx/npm, no local binary needed) |
| `imagemagick`/`magick` | general image conversion | ✗ | — | same as above |
| Supabase CLI | local migration tooling | ✗ | — | Not required — this project applies schema changes via Supabase MCP `apply_migration` (Phase 07 precedent) or the Supabase SQL Editor directly, not the CLI |
| Supabase MCP (`plugin:supabase:supabase`) | live schema/RLS verification, applying the `image_url` migration + bucket SQL | ✗ (needs authentication, not available in this research session) [VERIFIED: `claude mcp list` shows "Needs authentication"] | — | Fall back to `supabase/schema.sql` as best-available source + a `checkpoint:human-verify` task requiring the user or an authenticated session to confirm live schema/RLS state and apply the migration |
| `@supabase/supabase-js` (browser, CDN) | all Storage/DB client calls | ✓ | `@2` floating tag [VERIFIED: `index.html:14`] | — |

**Missing dependencies with no fallback:** none — every gap above has a documented fallback.
**Missing dependencies with fallback:** `cwebp`/`imagemagick` (use `npx @squoosh/cli` or `sharp`), Supabase CLI (not needed, MCP/dashboard covers it), Supabase MCP (fallback to schema.sql + human-verify checkpoint).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **None** — no build step, no bundler, no test runner configured anywhere in the repo (`package.json` has zero `devDependencies`/scripts; confirmed via Phase 07's own `07-UAT.md`, which used manual conversational UAT exclusively) [VERIFIED: codebase] |
| Config file | none — see Wave 0 |
| Quick run command | Manual: open the app locally (`index.html` via any static server, or the deployed Vercel preview) and exercise the flow in DevTools at a 400×512 iOS Safari viewport, checking the console for React warnings |
| Full suite command | Manual conversational UAT via `/gsd-verify-work`, mirroring `07-UAT.md`'s structure (numbered tests, expected/result, persisted as this phase's `08-UAT.md`) |

### Phase Requirements → Test Map

> No formal REQ-IDs exist for this phase (CONTEXT.md derives from a PRD Express Path spec, not the REQUIREMENTS.md v1.1 flow). Using CONTEXT.md's own UAT criteria (§8 of the design spec) as the traceable IDs.

| ID | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|--------------------|--------------|
| UAT-1 | Criar meta com capa da galeria → card renderiza a capa; persiste no reload | manual-only (no test runner) | — (browser + F5 reload) | ❌ Wave 0 — none needed, no framework |
| UAT-2 | Criar meta com upload próprio → Storage recebe o arquivo, card mostra a foto, persiste; outro usuário não acessa/escreve | manual-only + RLS check | — (browser upload flow; RLS verified via Supabase dashboard/MCP with a second test user) | ❌ |
| UAT-3 | Busca por nome filtra; filtro Ativas/Concluídas segmenta corretamente | manual-only | — | ❌ |
| UAT-4 | "Atualizar saldo" inline reflete sem reload; Aportar soma com projeção | manual-only | — | ❌ |
| UAT-5 | Editar troca capa/tint/valores e persiste; excluir remove + apaga capa do Storage | manual-only + Storage object check (Supabase dashboard) | — | ❌ |
| UAT-6 | Hero de Metas visualmente distinto do hero da home; sem regressão em 400×512 iOS Safari | manual-only (visual) | — | ❌ |
| UAT-7 | Sem scroll horizontal no mobile; sem warning de Rules of Hooks no console | manual-only (DevTools console) | — | ❌ |

### Sampling Rate

- **Per task commit:** open the affected view in a browser, exercise the changed flow, check DevTools console for errors/warnings (no automated command exists to substitute for this).
- **Per wave merge:** full manual pass through all 7 UAT criteria above, at the 400×512 iOS Safari viewport per CLAUDE.md's "regra de ouro."
- **Phase gate:** `/gsd-verify-work` conversational UAT (produces `08-UAT.md`, mirroring `07-UAT.md`'s format) before considering the phase done. For the Storage/RLS pieces specifically, verification must include an actual cross-user access attempt (second test account) to confirm the owner-only policies work, not just a single-user happy path.

### Wave 0 Gaps

- No test framework exists and none is being introduced — this is consistent with the rest of the project (Babel-standalone, no bundler, ROADMAP B11 tracks the eventual Vite/Next migration where a real test runner would land). Introducing one is out of scope for this phase.
- The one process gap worth calling out: this phase's UAT should explicitly include a **two-user RLS smoke test** for the Storage bucket (user A uploads a cover, user B's browser session attempts to read/overwrite/delete user A's object directly via the Supabase client) — this is not covered by any existing UAT pattern in the project and should be added as an explicit manual test step, not skipped as "probably fine because the policy looks right."

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V4 Access Control | yes | RLS on `storage.objects` scoped by `(storage.foldername(name))[1] = auth.uid()::text`, mirroring the existing `auth.uid() = user_id` pattern already used on every table in `schema.sql` |
| V5 Input Validation | yes | Client-side MIME/size/extension pre-check (UX) + bucket-level `allowed_mime_types`/`file_size_limit` (actual enforcement boundary) — never trust the client check alone |
| V8 Data Protection (file upload specific: no path traversal, no filename injection) | yes | Object path is always `<uuid_from_auth>/<crypto.randomUUID()>.<ext-derived-from-validated-mime>` — the original filename is **never** used in the storage path, eliminating traversal/injection risk entirely |
| V6 Cryptography | no | No new crypto surface — `crypto.randomUUID()` is used only for anti-collision naming, not for any security-token purpose |
| V2 Authentication / V3 Session Management | no (unchanged) | Upload uses the existing authenticated `window.fidesDb` client (anon key + persisted session) — no new auth surface introduced |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Uploading a file to another user's folder (`other_uid/evil.webp`) | Tampering / Elevation of Privilege | RLS `WITH CHECK ((storage.foldername(name))[1] = auth.uid()::text)` on INSERT rejects it at the database layer regardless of what the client sends |
| Overwriting/deleting another user's cover object | Tampering / Denial of Service | Same folder-prefix RLS check on UPDATE/DELETE policies (Pattern 1, policies #4/#5) |
| Uploading an oversized file to exhaust storage quota | Denial of Service | Bucket-level `file_size_limit` (5MB) rejected server-side even if client validation is bypassed via devtools/direct API call |
| Uploading a non-image (e.g. executable renamed `.jpg`) disguised via extension | Tampering / potential downstream XSS if ever rendered unsanitized | Bucket-level `allowed_mime_types` checks actual `Content-Type` at upload time, not just the filename extension; combined with the app never `dangerouslySetInnerHTML`-ing any Storage content — covers are only ever used as `background-image`/`<img src>` |
| Guessing another user's cover URL via bucket enumeration | Information Disclosure | Bucket listing itself is RLS-gated (only the `select` policy grants read of *object metadata rows*, and even with public read, `storage.objects` listing without a matching policy returns nothing for `list` operations against another user's implicit "folder" — the only way to reach an object is to already know its full UUID path) — low residual risk, consistent with industry-standard public-bucket patterns for non-sensitive content; flagged as Open Question 2 for explicit sign-off |

## Sources

### Primary (HIGH confidence)
- Direct codebase reads: `assets/fides-store.jsx`, `assets/fides-metas.jsx`, `assets/fides-metas.css`, `assets/fides-studio.jsx`, `assets/fides-studio.css`, `assets/fides-transacoes.jsx`, `assets/fides-data.jsx`, `assets/fides-supabase.js`, `supabase/schema.sql`, `index.html`, `package.json`, `vercel.json`, `.gitignore` — all `[VERIFIED: codebase]`.
- `gsd-tools query package-legitimacy check` — `@squoosh/cli` (OK), `sharp` (SUS/false-positive) — `[VERIFIED: npm registry via gsd-tools seam]`.
- Environment probes: `command -v cwebp`, `command -v magick`, `node --version`, `claude mcp list` — `[VERIFIED: this session]`.

### Secondary (MEDIUM confidence)
- [CITED: supabase.com/docs/guides/storage/security/access-control] — owner-folder RLS policy pattern.
- [CITED: supabase.com/docs/guides/storage/schema/helper-functions] — `storage.foldername()` helper.
- [CITED: supabase.com/docs/guides/storage/quickstart] — `.upload()` call shape.
- [CITED: supabase.com/docs/guides/storage/buckets/fundamentals] — bucket-level size/mime restriction concept (confirmed the concept exists; exact SQL column names not independently re-fetched, see A1).

### Tertiary (LOW confidence — per this project's `classify-confidence` seam, all `websearch`/`webfetch`-sourced findings are rated LOW baseline regardless of source authority, since no `context7`/`exa`/`brave` provider is configured for this project)
- `getPublicUrl()` return shape (`data.publicUrl`), `upload()` options object (`contentType`, `upsert`), `remove()` signature — consistent, stable v2 API from training knowledge, cross-referenced against WebSearch summaries this session but not independently re-fetched from a live reference page — `[ASSUMED, flagged in Assumptions Log A3]`.

## Metadata

**Confidence breakdown:**
- Standard stack (supabase-js, no new packages): HIGH — directly verified against live `index.html`/`package.json`.
- Frontend architecture (hero collision, dead-code `AportarModal`, missing `completed` mapping, reusable search/segment patterns): HIGH — all directly read from live code with exact line numbers.
- Storage/RLS SQL patterns: MEDIUM — cited from official Supabase docs pages, cross-checked against this project's own existing RLS naming convention, but not independently applied/tested against the live Supabase project this session (MCP unavailable).
- Preset cover generation tooling: HIGH confidence on the *problem* (verified no local tool exists), MEDIUM on the *recommended solution* (both paths are standard, but neither was executed this session).

**Research date:** 2026-07-02
**Valid until:** ~30 days for the Storage/RLS SQL guidance (stable API surface); re-verify live RLS/schema state immediately before this phase executes regardless of date, since Supabase MCP was unavailable this session and `schema.sql` is explicitly documented (CLAUDE.md, ROADMAP B10) as potentially stale.
