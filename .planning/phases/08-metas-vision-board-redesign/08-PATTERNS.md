# Phase 8: Metas vision-board redesign - Pattern Map

**Mapped:** 2026-07-02
**Files analyzed:** 6 (2 modify-heavy JS/CSS, 1 store, 1 bundled asset dir, 1 migration/schema)
**Analogs found:** 6 / 6 (all in-repo; RESEARCH.md's Code Examples used directly where no better in-repo analog exists)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `assets/fides-metas.jsx` (MetasStudio, vcard, control bar, cover picker, modal mounting) | component | CRUD + request-response | itself (existing `MetasStudio`/`met-card`/modals in same file) + `assets/fides-transacoes.jsx` (search+seg patterns) | exact (self) / role-match (search+seg) |
| `assets/fides-metas.css` (`.met-hero`, `.vcard`, control bar) | config/style | — | `.stu-hero` block in `assets/fides-studio.css:306-391` (copy base box, do not edit) + existing `.met-card` block in `fides-metas.css` | role-match |
| `assets/fides-store.jsx` (`normalizeGoal`, `addGoal`/`updateGoal`, `uploadGoalCover`/`deleteGoalCover`) | service (write layer) | CRUD + file-I/O | itself: `normalizeGoal`/`addGoal`/`updateGoal`/`deleteGoal` (`fides-store.jsx:90-104`, `571-622`) | exact |
| `assets/covers/<id>.svg` (~16 files) | static asset | file-I/O (bundled) | none in-repo (new asset class); RESEARCH.md Pitfall 5 + Code Examples `COVER_PRESETS`/`resolveCoverUrl` | no analog — follow RESEARCH.md contract |
| `supabase/migrations/*.sql` / `supabase/schema.sql` (add `goals.image_url`, `goal-covers` bucket + RLS) | migration | CRUD (schema) | `goals: próprio usuário` RLS policy + `goals` table def (`supabase/schema.sql:75-89`, `128-149`) | role-match (table RLS → storage RLS, same naming convention) |

## Pattern Assignments

### `assets/fides-metas.jsx` — `MetasStudio` (component, CRUD/request-response)

**Analog:** itself (existing hooks block, hero, `met-card`, modal-mount pattern), plus `assets/fides-transacoes.jsx` for search/segmented-filter chrome.

**Hooks-first pattern (Rules of Hooks — MUST preserve)** (`fides-metas.jsx:710-722`):
```javascript
function MetasStudio({ onAdd, onNav }) {
  const { transactions, monthTransactions, selectedMonth, monthLabel, isEmpty, goals, accounts, addGoal, updateGoal, deleteGoal } = useFides();
  const today = new Date();

  // ─── Local state (declared unconditionally, before any early return — Rules of Hooks) ───
  const [emBreve,       setEmBreve]       = React.useState(false);
  const [simularDivida, setSimularDivida] = React.useState(null);
  const [revisarOpen,   setRevisarOpen]   = React.useState(false);
  const [aplicarOpen,   setAplicarOpen]   = React.useState(false);
  const [criarOpen,     setCriarOpen]     = React.useState(false);
  const [editTarget,    setEditTarget]    = React.useState(null);
  const [deleteTarget,  setDeleteTarget]  = React.useState(null);

  if (isEmpty) return ( ... );   // early return AFTER all hooks
```
**New state to add HERE** (before the `isEmpty` early return, same block): `search`, `statusFilter`, `aportarTarget` (for mounting `AportarModal`), `saldoTarget` (quick "Atualizar saldo" inline), cover-picker tab state lives inside the modals themselves (also before their own `if (!rendered) return null;` guard — see below).

**Modal-mount pattern for target-based modals (edit/delete/aportar)** (`fides-metas.jsx:781-799`):
```javascript
<AjustarPlanoModal
  open={!!editTarget}
  meta={editTarget}
  onConfirm={(patch) => updateGoal(editTarget.id, {
    name: patch.nome,
    target: Number(patch.alvo) || 0,
    target_date: patch.prazo || null,
    description: patch.descricao || '',
    emoji: patch.emoji,
    tint: patch.tint,
  })}
  onClose={() => setEditTarget(null)}
/>
<MetConfirmDeleteModal
  open={!!deleteTarget}
  nome={deleteTarget?.nome}
  onConfirm={() => deleteGoal(deleteTarget.id)}
  onCancel={() => setDeleteTarget(null)}
/>
```
**Apply the identical shape to mount `AportarModal`** (already defined, `fides-metas.jsx:89-181`, currently orphaned):
```javascript
<AportarModal
  open={!!aportarTarget}
  meta={aportarTarget}
  onConfirm={(valor) => updateGoal(aportarTarget.id, { current: aportarTarget.atual + valor })}
  onClose={() => setAportarTarget(null)}
/>
```
Replace the two dead-end `onClick={() => setEmBreve(true)}` call sites (card's "Aportar" button at `:957` and any `AportarModal`-trigger) with `onClick={() => setAportarTarget(m)}`. Also rewire "Marcar como concluída" (`:902`, currently `onClick: () => setEmBreve(true)`) to:
```javascript
onClick: () => updateGoal(m.id, { completed: true, completed_at: new Date().toISOString() })
```

**Modal internal hooks-before-early-return pattern** (every existing modal in this file, e.g. `AportarModal` `fides-metas.jsx:89-93`):
```javascript
function AportarModal({ open, meta, onConfirm, onClose }) {
  const [valor, setValor] = React.useState('');
  const { rendered, closing, requestClose } = window.FidesUI.useModalClose(open, onClose);
  if (!rendered) return null;
  if (!meta) return null;
  ...
```
Any new cover-picker tab state inside `CriarMetaModal`/`AjustarPlanoModal` must follow this exact ordering: all `useState` calls, then `useModalClose`, then early-return guards.

**Segmented status filter (copy verbatim pattern)** — analog `assets/fides-transacoes.jsx:1286-1297` (`.fds-seg`/`.fds-seg-3`, `on` class):
```javascript
<div className="fds-seg fds-seg-3">
  {[['todas','Todas'], ['ativas','Ativas'], ['concluidas','Concluídas']].map(([k, l]) => (
    <button key={k} className={statusFilter === k ? 'on' : ''} onClick={() => setStatusFilter(k)}>
      {l}
    </button>
  ))}
</div>
```

**Search input (copy verbatim pattern)** — analog `assets/fides-transacoes.jsx:645-658` (`.fds-tx-v2-search`, `Icon.Search`, clear button):
```javascript
<div className="fds-tx-v2-search">
  <Icon.Search size={14} style={{ opacity: 0.5 }}/>
  <input className="fds-tx-v2-search-input"
         placeholder="Buscar por nome ou descrição…"
         value={search}
         onChange={e => setSearch(e.target.value)}/>
  {search && (
    <button type="button" className="fds-tx-v2-search-clear" aria-label="Limpar busca"
            onClick={() => setSearch('')}>
      <Icon.X size={13}/>
    </button>
  )}
</div>
```
Reuse the same CSS class names (`.fds-tx-v2-search*`, `.fds-seg*`) — they already exist in the shared stylesheet(s), so no new CSS is needed for the control bar chrome itself, only layout/spacing for the new wrapping bar in `fides-metas.css`.

**Form-payload pattern for modals (`CriarMetaModal`/`AjustarPlanoModal`)** — analog `fides-metas.jsx:199-213` (`FormData` + `onConfirm(payload)` shape). Extend the existing payload object with `cover` (resolved `preset:<id>` or uploaded Storage URL) and `atual`/`current` (create-only) and `completed` (edit-only), keeping the same `FormData`-driven submit handler shape:
```javascript
onConfirm({
  nome: fd.get('nome') || '',
  descricao: fd.get('descricao') || '',
  emoji: fd.get('emoji') || '🎯',
  alvo: parseFloat(fd.get('alvo')) || 0,
  prazo: fd.get('prazo') || null,
  tint: fd.get('tint') || '#00C37B',
  cover: coverValue,          // NEW — state from cover-picker tabs, not a plain form field
  atual: parseFloat(fd.get('atual')) || 0,   // NEW — create only
});
```

**Hero rename (D3)** — current wrapper at `fides-metas.jsx:825`:
```javascript
<section className="stu-hero" data-od-id="met-hero">
  <div className="stu-hero-eyebrow">...</div>
  <h2 className="stu-hero-headline">...</h2>
  <p className="stu-hero-lede">...</p>
  <div className="stu-hero-strip" data-od-id="met-hero-strip">...</div>
</section>
```
Change ONLY the outer `<section>` className `"stu-hero"` → `"met-hero"`. Keep all inner sub-element classNames (`stu-hero-eyebrow`, `stu-hero-headline`, `stu-hero-amt`, `stu-hero-lede`, `stu-hero-strip`, `stu-metric*`) exactly as-is — they are the shared Studio editorial typography vocabulary, not the D3 scoping concern. Do not rename those.

---

### `assets/fides-metas.css` — new `.met-hero` block + `.vcard` (style, no data flow)

**Analog:** `.stu-hero` base box, `assets/fides-studio.css:306-322` [VERIFIED: codebase] — copy this box model as the starting point for `.met-hero`, then add the distinct backdrop/collage treatment (D3) on top. **Do not edit `fides-studio.css`.**
```css
/* fides-studio.css:306-322 — copy this shape into fides-metas.css as .met-hero */
.stu-hero {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 28px 32px 22px;
  display: flex; flex-direction: column; gap: 14px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 1px 0 rgba(15,26,20,.04), 0 12px 32px -16px rgba(45,90,61,.18);
}
.stu-hero::before {
  content: ''; position: absolute; right: -80px; top: -80px;
  width: 280px; height: 280px; border-radius: 50%;
  background: radial-gradient(circle, var(--accent-bright) 0%, transparent 70%);
  opacity: 0.14;
  pointer-events: none;
}
```
New block goes in `fides-metas.css` as `.met-hero { ...same box... }` + `.met-hero::before { ... }` replaced/extended with the "colagem sutil (mask) das capas" backdrop per D3 (mask-image of a few cover thumbnails instead of the radial accent glow). Inner elements keep using `.stu-hero-eyebrow`/`.stu-hero-headline`/`.stu-hero-lede`/`.stu-hero-strip`/`.stu-metric*` — those selectors already exist and apply regardless of the outer wrapper's class.

**`.vcard` base:** start from the existing `.met-card` block already in `fides-metas.css` (same file — Read it directly when implementing; not excerpted here since it's the direct predecessor being replaced in-place, i.e. same file's own prior art). Add: 186px cover area (`background-image`/`<img>` + gradient scrim), overlay for status pill/chip/name/description, hover/tap-revealed action icons.

---

### `assets/fides-store.jsx` — `normalizeGoal`, `addGoal`/`updateGoal`, `uploadGoalCover`/`deleteGoalCover` (service, CRUD + file-I/O)

**Analog:** itself — existing `normalizeGoal` and the `mode === 'live'` try/catch write pattern used by every mutation in this file.

**Current `normalizeGoal`** (`fides-store.jsx:90-104`) [VERIFIED: codebase]:
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
**Required additions** (Phase-07 gap, must close for D5/D6):
```javascript
    cover: row.image_url || null,
    completed: !!row.completed,
    completedAt: row.completed_at || null,
```

**Current `addGoal`/`updateGoal`** (`fides-store.jsx:571-608`) [VERIFIED: codebase] — this is the exact try/catch + `mode==='live'` branch shape all new write logic must mirror:
```javascript
const addGoal = React.useCallback(async (g) => {
  if (mode === 'live' && userId) {
    try {
      const { error } = await window.fidesDb.from('goals').insert({
        user_id: userId,
        name:        g.nome || '',
        target:      Number(g.alvo) || 0,
        target_date: g.prazo || null,
        description: g.descricao || '',
        emoji:       g.emoji || '🎯',
        tint:        g.tint || '#00C37B',
      });
      if (error) throw error;
      await refreshData(userId);
    } catch (err) {
      console.error('[Fides] addGoal:', err.message);
    }
    return;
  }
  setGoals(prev => [{ ...g, id: g.id ?? ('goal_' + Date.now()), _new: true }, ...prev]);
}, [mode, userId, refreshData]);

const updateGoal = React.useCallback(async (id, patch) => {
  if (mode === 'live' && userId) {
    try {
      const { error } = await window.fidesDb.from('goals').update(patch).eq('id', id);
      if (error) throw error;
      await refreshData(userId);
    } catch (err) {
      console.error('[Fides] updateGoal:', err.message);
    }
    return;
  }
  setGoals(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x));
}, [mode, userId, refreshData]);
```
**Extend `addGoal`'s insert payload** with `image_url: g.cover || null` and `current: Number(g.atual) || 0`. `updateGoal` already accepts an arbitrary `patch` object — no signature change needed; callers just pass `{ image_url: ... }` or `{ current: ... }` or `{ completed, completed_at }` as needed (mirrors the `AjustarPlanoModal`/`AportarModal` `onConfirm` call sites shown above).

**New `uploadGoalCover`/`deleteGoalCover` helpers** — no in-repo analog exists (first Storage usage in this project); follow RESEARCH.md Pattern 2 exactly, using the SAME `window.fidesDb` client instance and the SAME `console.error('[Fides] <fn>:', err.message)` tagging convention as `addGoal`/`updateGoal` above:
```javascript
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

function extFromMime(mime) {
  return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mime] || null;
}

async function uploadGoalCover(userId, file) {
  if (!ALLOWED_MIME.includes(file.type)) throw new Error('Formato não suportado (use JPG, PNG ou WEBP).');
  if (file.size > MAX_BYTES) throw new Error('Arquivo maior que 5MB.');
  const ext = extFromMime(file.type);
  if (!ext) throw new Error('Formato não suportado.');
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
Expose both from the same `useFides()`/provider surface that already exposes `addGoal`/`updateGoal`/`deleteGoal` (`fides-store.jsx:1309`).

---

### `assets/covers/<id>.svg` (static asset, file-I/O/bundled)

**No in-repo analog** (first bundled image-asset directory in `assets/`). Follow the `preset:<id>` key contract from RESEARCH.md Code Examples verbatim:
```javascript
const COVER_PRESETS = {
  viagem: 'assets/covers/viagem.svg',
  casa:   'assets/covers/casa.svg',
  // ... ~16 total
};
function resolveCoverUrl(cover) {
  if (!cover) return null;
  if (cover.startsWith('preset:')) return COVER_PRESETS[cover.slice('preset:'.length)] || null;
  return cover; // already a full Storage public URL
}
```
Format is `.svg` per CONTEXT.md D4 resolution (no `.webp` tooling in this environment) — see RESEARCH.md Pitfall 5. Author as hand-written gradient/texture SVGs in the tint palette; no build/encode step required.

---

### `supabase/migrations/*.sql` + `supabase/schema.sql` (migration, CRUD/schema)

**Analog:** existing `goals` table definition and its RLS policy, `supabase/schema.sql:75-89` and `:128-149` [VERIFIED: codebase].

**Column addition** — add directly after `completed_at` in the `goals` table def (mirror the existing nullable-column style, e.g. `description`/`target_date` which are also nullable with no default):
```sql
-- supabase/schema.sql:75-89 (existing table — add this column)
alter table public.goals add column image_url text;
```

**RLS naming convention to mirror** (`supabase/schema.sql:144-145`) [VERIFIED: codebase]:
```sql
create policy "goals: próprio usuário"        on public.goals
  for all using (auth.uid() = user_id);
```
This is the exact naming/scoping idiom (`"<resource>: próprio usuário"`, `auth.uid() = <owner column>`) that the new Storage bucket policies must follow, adapted to the `storage.foldername(name)[1] = auth.uid()::text` path-based equivalent (per RESEARCH.md Pattern 1 — bucket creation + 4 policies: leitura pública / escrita própria / atualização própria / exclusão própria). Use RESEARCH.md's Pattern 1 SQL block verbatim as the template; it already follows this project's naming convention.

**IMPORTANT — before applying:** RESEARCH.md flags `schema.sql` may be stale (ROADMAP B10) and recommends a `checkpoint:human-verify` to confirm live RLS on `goals` via Supabase MCP/Dashboard before building the Storage bucket's owner-scoping on top of this assumption (Open Question 3, Assumption A4). Planner should sequence this as an early task.

## Shared Patterns

### Client write layer — `mode === 'live'` try/catch branch
**Source:** `assets/fides-store.jsx:571-622` (every `addGoal`/`updateGoal`/`deleteGoal`)
**Apply to:** All new/modified write functions in `fides-store.jsx`, including `uploadGoalCover`/`deleteGoalCover`.
```javascript
if (mode === 'live' && userId) {
  try {
    const { error } = await window.fidesDb.from('goals')...;
    if (error) throw error;
    await refreshData(userId);
  } catch (err) {
    console.error('[Fides] <fnName>:', err.message);
  }
  return;
}
// mock-mode fallback: local setState
```

### Rules of Hooks — hooks before early return
**Source:** `assets/fides-metas.jsx:710-722` (MetasStudio) and every modal (`:89-93`, `:184-186`, `:264-266`, `:345-347`).
**Apply to:** `MetasStudio` (new search/filter/target state), `CriarMetaModal`/`AjustarPlanoModal` (new cover-picker tab state), any newly mounted modal.
```javascript
function Component(...) {
  const [a, setA] = React.useState(...);   // ALL useState here
  const { rendered, closing, requestClose } = window.FidesUI.useModalClose(open, onClose);
  if (!rendered) return null;               // early returns AFTER all hooks
  if (!someProp) return null;
  ...
}
```

### Segmented filter / search chrome (reuse, don't reinvent)
**Source:** `assets/fides-transacoes.jsx:645-658` (search), `:1286-1297` (`.fds-seg`/`.fds-seg-3`)
**Apply to:** New Metas control bar (search + Todas/Ativas/Concluídas filter).

### No `confirm()`/`alert()`
**Source:** CLAUDE.md + existing `MetConfirmDeleteModal` (`fides-metas.jsx:345-373`), `window.FidesUI.useModalClose`
**Apply to:** Any new confirm/replace-cover flow (e.g. replacing an existing upload) — build a small modal or reuse `useConfirm`/`Toast` from `fides-ui`, never native `confirm()`/`alert()`.

### RLS naming convention (`"<resource>: próprio usuário"`)
**Source:** `supabase/schema.sql:136-149`
**Apply to:** New `storage.objects` policies for `goal-covers` bucket (adapt to 4 policies: leitura pública / escrita, atualização, exclusão próprias, per RESEARCH.md Pattern 1).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `assets/covers/<id>.svg` (~16 files) | static asset | file-I/O | First bundled binary/vector asset directory in this project — no prior art; follow RESEARCH.md's `preset:<id>` contract and D4 SVG resolution directly. |
| `uploadGoalCover`/`deleteGoalCover` in `fides-store.jsx` | service (storage) | file-I/O | First Supabase Storage usage in the codebase (all prior writes are Postgres `.from(table)` calls, not `.storage.from(bucket)`) — use RESEARCH.md Pattern 2 verbatim, following the existing `console.error('[Fides] <fn>:', ...)` tagging convention as the one directly-analogous piece. |
| `goal-covers` bucket + `storage.objects` RLS policies | migration | CRUD (schema) | First Storage bucket in this project (only table-level RLS exists today) — use RESEARCH.md Pattern 1 verbatim, naming convention borrowed from `goals: próprio usuário`. |

## Metadata

**Analog search scope:** `assets/fides-metas.jsx`, `assets/fides-metas.css`, `assets/fides-store.jsx`, `assets/fides-studio.css`, `assets/fides-transacoes.jsx`, `supabase/schema.sql`.
**Files scanned:** 6 (all directly read, no file >2000 lines encountered — no offset/limit chunking needed beyond targeted grep+read for large files like `fides-store.jsx`/`schema.sql`).
**Pattern extraction date:** 2026-07-02
