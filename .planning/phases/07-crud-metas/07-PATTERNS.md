# Phase 07: CRUD Metas - Pattern Map

**Mapped:** 2026-07-01
**Files analyzed:** 3 (2 modified, 1 new-content-in-existing-file: modals added inline to `fides-metas.jsx`)
**Analogs found:** 5 / 5 (all files have exact or role-match analogs; this is a reuse-heavy phase — CONTEXT.md named analogs directly)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `assets/fides-store.jsx` — `addGoal`/`updateGoal`/`deleteGoal` (new callbacks) | service (store mutation) | CRUD | `addAccount`/`updateAccount`/`deleteAccount` (`assets/fides-store.jsx:508-566`) | exact |
| `assets/fides-store.jsx` — `normalizeGoal` (modify) | transform | CRUD (read mapping) | current `normalizeGoal` itself (`assets/fides-store.jsx:90`) + sibling `normalizeAccount` (`:62`) | exact |
| `assets/fides-metas.jsx` — `CriarMetaModal` (new component) | component (modal) | request-response (form submit → callback) | `AjustarPlanoModal` (`assets/fides-metas.jsx:184-267`) | exact (same field set minus atual/contribuicao, plus prazo/descrição; creation vs edit is a minor `onConfirm` shape diff) |
| `assets/fides-metas.jsx` — `AjustarPlanoModal` (modify: remove atual/contribuição, add prazo/descrição) | component (modal) | request-response | itself, pre-edit (`assets/fides-metas.jsx:184-267`) | exact |
| `assets/fides-metas.jsx` — `MetasStudio` wiring (modify: replace `setEmBreve(true)` calls for criar/editar/excluir) | component (page/container) | event-driven (UI dispatch → store mutation) | itself, pre-edit (`assets/fides-metas.jsx:635+`), plus existing `MetConfirmDeleteModal` wiring pattern used elsewhere in codebase for delete confirm flows | exact |

`MetConfirmDeleteModal` (`assets/fides-metas.jsx:270-298`) requires **no code changes** — only new wiring (`onConfirm={() => deleteGoal(m.id)}`) at the `MetasStudio` call site. Listed here for completeness since CONTEXT.md calls it out.

## Pattern Assignments

### `addGoal` / `updateGoal` / `deleteGoal` (new, in `assets/fides-store.jsx`)

**Analog:** `addAccount` / `updateAccount` / `deleteAccount` — `assets/fides-store.jsx:508-566`

Full verbatim trio to copy structurally (table name, payload keys, and error-log tag are the only things that change):

```javascript
// ─── Accounts ─────────────────────────────────────────────────

const addAccount = React.useCallback(async (acct) => {
  if (mode === 'live' && userId) {
    try {
      const { error } = await window.fidesDb.from('accounts').insert({
        user_id: userId,
        name:    acct.name || '',
        type:    acct.type || 'checking',
        tag:     acct.tag  || '',
        balance:         Number(acct.balance) || 0,
        opening_balance: Number(acct.balance) || 0,
        color:   acct.color || '#00C37B',
        bank:    acct.bank || acct.name || '',
      });
      if (error) throw error;
      await refreshData(userId);
    } catch (err) {
      console.error('[Fides] addAccount:', err.message);
    }
    return;
  }
  setAccounts(prev => [
    { ...acct, id: acct.id ?? ('acct_' + Date.now()), _new: true },
    ...prev,
  ]);
}, [mode, userId, refreshData]);

const updateAccount = React.useCallback(async (id, patch) => {
  if (mode === 'live' && userId) {
    try {
      const { balance: __targetBal, ...__rest } = patch;
      if (Object.keys(__rest).length) {
        const { error } = await window.fidesDb.from('accounts').update(__rest).eq('id', id);
        if (error) throw error;
      }
      if (__targetBal !== undefined && __targetBal !== null) {
        await window.fidesDb.rpc('set_account_balance', { p_account_id: id, p_target: Number(__targetBal) });
      }
      await refreshData(userId);
    } catch (err) {
      console.error('[Fides] updateAccount:', err.message);
    }
    return;
  }
  setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
}, [mode, userId, refreshData]);

const deleteAccount = React.useCallback(async (id) => {
  if (mode === 'live' && userId) {
    try {
      const { error } = await window.fidesDb.from('accounts').delete().eq('id', id);
      if (error) throw error;
      await refreshData(userId);
    } catch (err) {
      console.error('[Fides] deleteAccount:', err.message);
    }
    return;
  }
  setAccounts(prev => prev.filter(a => a.id !== id));
}, [mode, userId, refreshData]);
```

**Replication notes for `addGoal`/`updateGoal`/`deleteGoal`:**
- Table: `'goals'` instead of `'accounts'`.
- `addGoal` insert payload per D-12 (UI→DB mapping): `user_id`, `name: g.nome || ''`, `target: Number(g.alvo) || 0`, `target_date: g.prazo || null`, `description: g.descricao || ''`, `emoji: g.emoji || '🎯'`, `tint: g.tint || '#00C37B'`. Do **NOT** set `current` or `monthly_contrib` — leave to schema defaults (D-07/D-08). No `set_account_balance`-style RPC needed for `updateGoal` — goals has no derived-balance RPC; use the plain `update(patch).eq('id', id)` path only (skip the `__targetBal` special-case branch entirely, since there's no goal-equivalent of `set_account_balance`).
- `updateGoal` patch keys should already be DB-shaped (`name`, `target`, `target_date`, `description`, `emoji`, `tint`) — caller (`CriarMetaModal`/`AjustarPlanoModal` onConfirm handlers in `fides-metas.jsx`) is responsible for the UI→DB key translation before calling `updateGoal`, mirroring how `AjustarPlanoModal`'s current `onConfirm` payload uses UI-shaped keys (`nome`, `alvo`, etc.) — **decide in planning** whether translation happens in the modal or in the store function; simplest is to keep `updateGoal(id, patch)` DB-shaped like `updateAccount`, and have the modal's `onConfirm` wrapper (defined where `MetasStudio` renders the modal) do the UI→DB mapping, consistent with how accounts screens map before calling `updateAccount`.
- Mock branch: optimistic `setGoals(prev => ...)`, same shape as `setAccounts` optimistic branches (prepend for add, map for update, filter for delete).
- Error log tags: `'[Fides] addGoal:'`, `'[Fides] updateGoal:'`, `'[Fides] deleteGoal:'`.
- Place new trio near existing `// ─── Accounts ───` block or add a new `// ─── Goals ───` section; keep proximity to `normalizeGoal`/`refreshData` goals query for readability.

---

### `normalizeGoal` (modify, `assets/fides-store.jsx:90-103`)

**Current implementation (verbatim, to be extended per D-05/D-10):**

```javascript
function normalizeGoal(row) {
  const d = new Date(row.created_at || Date.now());
  return {
    id: row.id,
    nome: row.name,
    descricao: '',
    emoji: row.emoji || '🎯',
    tint: row.tint || '#00C37B',
    alvo: Number(row.target),
    atual: Number(row.current),
    contribuicao: Number(row.monthly_contrib),
    criadaEm: String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(),
  };
}
```

**Required changes:**
- `descricao: ''` → `descricao: row.description || ''` (D-10).
- Add `prazo: row.target_date || null` (D-05) — UI field name for the deadline; nullable, `DATE` string `YYYY-MM-DD` passes through as-is (no Date parsing per D-02, since native `<input type="date">` consumes/produces `YYYY-MM-DD` directly).
- `atual`/`contribuicao` stay as-is (schema columns remain, just not user-editable in the form — D-07/D-08 only affect the *write* path/form, not the read/normalize path).

**Sibling for reference on similar column defaulting (`normalizeAccount`, `assets/fides-store.jsx:62-72`):**
```javascript
function normalizeAccount(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type || 'corrente',
    tag: row.tag || '',
    balance: Number(row.balance),
    color: row.color || '#00C37B',
    bank: row.bank || row.name || '',
  };
}
```
Shows the `row.field || default` idiom used consistently across normalizers — apply same idiom for `description`/`target_date`.

**Context value & fallback exposure** (`assets/fides-store.jsx:1253` and `:1298-1307`):
```javascript
// context value (inside FidesProvider return, ~L1250-1284)
goals,
...
accounts, addAccount, updateAccount, deleteAccount,
```
Add `addGoal, updateGoal, deleteGoal` next to `goals,` on the context value object (mirrors how `addAccount` etc. sit next to `accounts,`).

```javascript
// useFides() fallback (~L1294-1314)
goals: [],
...
accounts: ACCOUNTS, addAccount: () => {}, updateAccount: () => {}, deleteAccount: () => {},
```
Add `addGoal: () => {}, updateGoal: () => {}, deleteGoal: () => {},` next to `goals: [],` in the no-provider fallback object, matching the accounts fallback line format exactly.

---

### `CriarMetaModal` (new, `assets/fides-metas.jsx`)

**Analog:** `AjustarPlanoModal` (`assets/fides-metas.jsx:184-267`) — no separate "create" modal exists for accounts/cards in this codebase, so `AjustarPlanoModal`'s edit-form structure is the closest and only strong analog (same modal chrome, same `useModalClose` hook, same form-via-`FormData` pattern).

**Structure to copy (imports/hook usage, lines 184-189):**
```javascript
function AjustarPlanoModal({ open, meta, onConfirm, onClose }) {
  const { rendered, closing, requestClose } = window.FidesUI.useModalClose(open, onClose);
  if (!rendered) return null;
  if (!meta) return null;
  const TINTS = ['#2D5A3D','#2C5282','#B45309','#7C3AED','#0F766E','#9B2C2C','#0891B2','#BE185D'];
```
For `CriarMetaModal`, there is no existing `meta` object to guard on — signature becomes `function CriarMetaModal({ open, onConfirm, onClose })` with no `if (!meta) return null;` guard (nothing to null-check on create).

**Form submit / FormData pattern (lines 200-216), to be replicated with adjusted fields:**
```javascript
<form
  className="fds-modal-body"
  onSubmit={e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    onConfirm({
      nome:         fd.get('nome')        || meta.nome,
      descricao:    fd.get('descricao')   ?? meta.descricao,
      emoji:        fd.get('emoji')       || meta.emoji,
      alvo:         parseFloat(fd.get('alvo'))         || meta.alvo,
      atual:        parseFloat(fd.get('atual'))        ?? meta.atual,
      contribuicao: parseFloat(fd.get('contribuicao')) || meta.contribuicao,
      tint:         fd.get('tint')        || meta.tint,
    });
    requestClose();
  }}
  style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
>
```
For `CriarMetaModal`, no `meta` fallback values exist — use hardcoded sensible defaults instead (e.g. `fd.get('nome') || ''`, `fd.get('emoji') || '🎯'`, `parseFloat(fd.get('alvo')) || 0`), and the payload must be per D-06: `nome, alvo, prazo (target_date), emoji, tint, descricao` — **no `atual`/`contribuicao` fields at all** (D-07/D-08 — not even defaulted-and-hidden, simply omit them from the form and payload; store layer defaults `current`/`monthly_contrib` to `0` at the DB layer).

**Field markup to copy (lines 218-258), adapted:**
```javascript
<div style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 12 }}>
  <label className="fds-field">
    <span>Emoji</span>
    <input className="fds-input" name="emoji" defaultValue={meta.emoji} maxLength={2} style={{ textAlign: 'center', fontSize: 20 }}/>
  </label>
  <label className="fds-field">
    <span>Nome da meta</span>
    <input className="fds-input" name="nome" defaultValue={meta.nome} required/>
  </label>
</div>
<label className="fds-field">
  <span>Descrição</span>
  <input className="fds-input" name="descricao" defaultValue={meta.descricao} placeholder="Ex: Férias de julho 2027"/>
</label>
<div className="fds-modal-row two">
  <label className="fds-field">
    <span>Valor alvo (R$)</span>
    <input className="fds-input" name="alvo" type="number" step="0.01" min="0" defaultValue={meta.alvo} required/>
  </label>
  {/* REPLACE "Já guardado" (atual) field with prazo field per D-01..D-04: */}
  <label className="fds-field">
    <span>Prazo</span>
    <input className="fds-input" name="prazo" type="date" min={new Date().toISOString().slice(0,10)} defaultValue={meta.prazo || ''}/>
  </label>
</div>
{/* REMOVE the "Aporte mensal (R$)" block entirely (was lines 242-245) */}
<div className="fds-field">
  <span>Cor</span>
  <div className="met-tint-picker">
    {TINTS.map(t => (
      <label key={t} className="met-tint-opt">
        <input type="radio" name="tint" value={t} defaultChecked={meta.tint === t} style={{ display: 'none' }}/>
        <span className="met-tint-swatch" style={{ background: t }}>
          {meta.tint === t && <Icon.Check size={12}/>}
        </span>
      </label>
    ))}
  </div>
</div>
```
`min={new Date().toISOString().slice(0,10)}` on the date input implements D-04 (`min={hoje}`, block past dates) using the native browser constraint — no custom JS validation needed, consistent with D-02 ("input `type=date` nativo... sem parsing custom").

**Foot/buttons (lines 259-262) — copy verbatim, change label:**
```javascript
<div className="fds-modal-foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 0 0' }}>
  <button type="button" className="fds-btn-ghost" onClick={requestClose}>Cancelar</button>
  <button type="submit" className="fds-btn-primary"><Icon.Check size={13}/> Salvar alterações</button>
</div>
```
For create modal, button label becomes e.g. `<Icon.Check size={13}/> Criar meta`.

---

### `AjustarPlanoModal` (modify in place, `assets/fides-metas.jsx:184-267`)

**Changes required (D-14):**
1. **Remove** the "Já guardado (R$)" field (`name="atual"`, lines 237-240) and its value from the `onConfirm` payload (line 210 `atual: ...`).
2. **Remove** the "Aporte mensal (R$)" field (`name="contribuicao"`, lines 242-245) and its value from the `onConfirm` payload (line 211 `contribuicao: ...`).
3. **Add** a `prazo` (`type="date"`, `min={hoje}` per D-04) field, `defaultValue={meta.prazo || ''}`, likely replacing the two-column row previously shared with `atual` (see `CriarMetaModal` prazo field markup above for exact JSX to reuse).
4. **`descricao` field already exists** (lines 228-231) — no change needed there; already wired to `onConfirm` payload (line 207).
5. Update `onConfirm` payload (lines 205-213) to emit: `nome, descricao, emoji, alvo, prazo, tint` — no `atual`/`contribuicao` keys.

---

### `MetConfirmDeleteModal` (no code change, `assets/fides-metas.jsx:270-298`)

Structure already generic/correct — verbatim, for reference only (planner does not need to modify this component, only its wiring at the `MetasStudio` call site):

```javascript
function MetConfirmDeleteModal({ open, nome, onConfirm, onCancel }) {
  const { rendered, closing, requestClose } = window.FidesUI.useModalClose(open, onCancel);
  if (!rendered) return null;
  const handleConfirm = () => { onConfirm(); requestClose(); };
  return (
    <div className={"fds-modal-backdrop" + (closing ? " is-closing" : "")} onClick={requestClose}>
      <div className={"fds-modal" + (closing ? " is-closing" : "")} style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="fds-modal-head">
          <div className="fds-modal-title" style={{ color: 'var(--bad)' }}>
            <MetIcon.Trash size={16} style={{ marginRight: 8, verticalAlign: 'middle' }}/>
            Excluir meta
          </div>
          <button className="fds-icon-btn" onClick={requestClose}><Icon.X size={16}/></button>
        </div>
        <div className="fds-modal-body">
          <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, margin: 0 }}>
            Tem certeza que deseja excluir a meta <strong>"{nome}"</strong>? Esta ação não pode ser desfeita.
          </p>
        </div>
        <div className="fds-modal-foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="fds-btn-ghost" onClick={requestClose}>Cancelar</button>
          <button className="fds-btn-primary" style={{ background: 'var(--bad)' }} onClick={handleConfirm}>
            <MetIcon.Trash size={13}/> Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
```
Wiring at call site should follow: `onConfirm={() => deleteGoal(targetMetaId)}`, `onCancel={() => setDeleteTarget(null)}` — analogous to how other confirm-delete flows in the codebase pair a `useState` "pending id/object" with the modal's `open`/`onConfirm`/`onCancel` props.

---

### `MetasStudio` wiring (modify, `assets/fides-metas.jsx:635-940`)

**Current state (to be rewired) — key excerpts:**

Import of goals/`useFides` destructure (line 636):
```javascript
const { transactions, monthTransactions, selectedMonth, monthLabel, isEmpty, goals, accounts } = useFides();
```
→ must add `addGoal, updateGoal, deleteGoal` to this destructure.

Local state block (lines 656-660):
```javascript
const [emBreve,       setEmBreve]       = React.useState(false);
const [simularDivida, setSimularDivida] = React.useState(null);
const [revisarOpen,   setRevisarOpen]   = React.useState(false);
const [aplicarOpen,   setAplicarOpen]   = React.useState(false);
```
→ add state for the new modals, e.g. `const [criarOpen, setCriarOpen] = React.useState(false);`, `const [editTarget, setEditTarget] = React.useState(null);` (holds the goal object being edited, null = closed — mirrors `simularDivida` pattern which uses a value-or-null for open/closed + payload), `const [deleteTarget, setDeleteTarget] = React.useState(null);` (holds goal id/nome being deleted).

Modal render block (line 698):
```javascript
{/* ─── Em breve overlay ─── */}
<EmBreveModal open={emBreve} onClose={() => setEmBreve(false)}/>
```
→ replace/add with:
```javascript
<CriarMetaModal open={criarOpen} onConfirm={(payload) => addGoal(payload)} onClose={() => setCriarOpen(false)}/>
<AjustarPlanoModal open={!!editTarget} meta={editTarget} onConfirm={(patch) => updateGoal(editTarget.id, patch)} onClose={() => setEditTarget(null)}/>
<MetConfirmDeleteModal open={!!deleteTarget} nome={deleteTarget?.nome} onConfirm={() => deleteGoal(deleteTarget.id)} onCancel={() => setDeleteTarget(null)}/>
```
(`EmBreveModal` component itself and its usages for **other** still-deferred features — Aportar, ajuste de plano as calculadora — remain untouched per CONTEXT.md scope boundary; only the criar/editar/excluir wiring changes.)

**Empty-state "Nova meta" button (lines 706-720):**
```javascript
{goals.length === 0 ? (
  <div className="fds-empty-state">
    ...
    <button
      className="fds-empty-state-btn"
      onClick={() => setEmBreve(true)}
      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
    >
      + Nova meta
    </button>
  </div>
) : (
```
→ `onClick={() => setEmBreve(true)}` becomes `onClick={() => setCriarOpen(true)}`.

**Chapter action "Nova meta" link (line 784):**
```javascript
<ChapterMark roman="I" title="Em curso"
             caption={`${goals.length} metas com aporte regular`}
             action={<button className="stu-link" onClick={() => setEmBreve(true)}><Icon.Plus size={12}/> Nova meta</button>}/>
```
→ `onClick={() => setEmBreve(true)}` becomes `onClick={() => setCriarOpen(true)}`.

**Per-card dots menu (lines 799-803):**
```javascript
<MetDotsMenu items={[
  { id: 'editar',   label: 'Editar meta',           icon: 'Edit',   onClick: () => setEmBreve(true) },
  { id: 'concluir', label: 'Marcar como concluída', icon: 'Trophy', onClick: () => setEmBreve(true) },
  { id: 'excluir',  label: 'Excluir meta',          icon: 'Trash',  danger: true, onClick: () => setEmBreve(true) },
]}/>
```
→ per D-13/D-14/D-15, rewire `editar` and `excluir` only (`concluir` stays `setEmBreve(true)` — marking-as-concluded is out of scope, part of aportes/progresso deferred to M5+):
```javascript
<MetDotsMenu items={[
  { id: 'editar',   label: 'Editar meta',           icon: 'Edit',   onClick: () => setEditTarget(m) },
  { id: 'concluir', label: 'Marcar como concluída', icon: 'Trophy', onClick: () => setEmBreve(true) },
  { id: 'excluir',  label: 'Excluir meta',          icon: 'Trash',  danger: true, onClick: () => setDeleteTarget(m) },
]}/>
```
(`m` is the `computed.map((m) => ...)` loop variable at line 786, in scope at this call site — confirm exact variable name when editing.)

**Other `setEmBreve(true)` occurrences (lines 856, 862, 938)** are for unrelated CTAs (per D-11/scope boundary, likely "simular"/"revisar"/"aplicar" flows or secondary goal actions still deferred) — **do not touch** unless CONTEXT.md/PLAN explicitly calls them out; verify each at implementation time by reading surrounding context, since only "Nova meta"/"Editar meta"/"Excluir meta" are in scope per D-13/14/15.

**Empty-state at page top (`isEmpty` check, lines 639-652)** already calls `onAdd?.()` (a prop passed into `MetasStudio`, not local `setEmBreve`) — check how `onAdd` is wired by the parent/router; if it currently opens `EmBreveModal` upstream, it may also need rewiring to open `CriarMetaModal`, but that requires reading the parent caller of `<MetasStudio onAdd={...} .../>` (outside this file) — **flag for planner to verify** during implementation, not fully resolved by this pattern map.

## Shared Patterns

### `useModalClose` (modal open/close animation)
**Source:** `window.FidesUI.useModalClose` — used identically in every modal in `fides-metas.jsx` (lines 91, 185, 271, 302, 409, 486, 536, 606)
**Apply to:** `CriarMetaModal` (new) must use the same one-line hook call:
```javascript
const { rendered, closing, requestClose } = window.FidesUI.useModalClose(open, onClose);
if (!rendered) return null;
```

### Store CRUD trio (live insert/update/delete + refetch; mock optimistic)
**Source:** `assets/fides-store.jsx:508-566` (`addAccount`/`updateAccount`/`deleteAccount`)
**Apply to:** `addGoal`/`updateGoal`/`deleteGoal` — same `mode === 'live' && userId` branch structure, same `await refreshData(userId)` refetch-after-write (no live optimism), same mock-branch optimistic `setGoals` local mutation, same `try/catch` with `console.error('[Fides] <fnName>:', err.message)`.

### Form-via-FormData modal submit pattern
**Source:** `AjustarPlanoModal`, `assets/fides-metas.jsx:200-216`
**Apply to:** `CriarMetaModal` and modified `AjustarPlanoModal` — `new FormData(e.target)` + `fd.get(name)` + `parseFloat`/coalesce defaults, single `onConfirm(payload)` call + `requestClose()`.

### Tint picker (radio-button color swatches)
**Source:** `AjustarPlanoModal`, `assets/fides-metas.jsx:246-258`, using local `TINTS` array (line 188)
**Apply to:** `CriarMetaModal` — copy the `TINTS` constant and the `met-tint-picker`/`met-tint-opt`/`met-tint-swatch` markup verbatim (per D-09, tint stays in the form).

## No Analog Found

None — every file/component in scope has a strong (exact or role-match) existing analog per CONTEXT.md's explicit pointers. This is expected for a reuse-heavy phase.

## Metadata

**Analog search scope:** `assets/fides-store.jsx`, `assets/fides-metas.jsx` (both explicitly named in CONTEXT.md; no broader codebase search was needed since CONTEXT.md pre-identified exact analog line ranges)
**Files scanned:** 2 (both fully read at the relevant offsets; `fides-store.jsx` read at lines 60-190 and 500-570 plus grep hits at 1250-1314; `fides-metas.jsx` read at lines 60-330 and 600-820)
**Pattern extraction date:** 2026-07-01
</content>
</invoke>
