# Phase 01: Veracidade do Dashboard — Pattern Map

**Mapped:** 2026-06-28
**Files analyzed:** 3 (all modifications, no new files)
**Analogs found:** 3 / 3 (self-analogs — each file's own existing pattern is the model)

---

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `assets/fides-store.jsx` | store / selector | CRUD / transform | `categoryUsage` within same file (lines 1023-1056) | exact |
| `assets/fides-charts.jsx` | component | event-driven | `Donut` itself + pointer patterns from React DOM | role-match |
| `assets/fides-studio.jsx` | component / consumer | request-response | `DashboardStudio` inline derivations (lines 644-663) | exact |

---

## Pattern Assignments

### R1 — `assets/fides-store.jsx` · budgetGroups fix

**Target lines:** 1058-1079 (the `budgetGroups` useMemo)

**Analog (copy limit-reading logic from):** `categoryUsage`, same file, lines 1023-1056

#### Pattern to COPY — limit resolution (lines 1028-1033)

```javascript
// Source: fides-store.jsx:1028-1033
const lim = categoryLimits[cat_key];
const limit = lim
  ? (lim.byMonth && lim.byMonth[selectedMonth] != null
      ? lim.byMonth[selectedMonth]
      : (lim.default != null ? lim.default : null))
  : null;
```

Apply the same pattern inside the `.map(([id, c]) => { ... })` in `budgetGroups`, replacing:

```javascript
// BEFORE (fides-store.jsx:1066) — the bug
const limit = plannedOverrides[id] ?? 0;

// AFTER — copy categoryUsage pattern, using `id` as cat_key
const lim = categoryLimits[id];
const limit = lim
  ? (lim.byMonth && lim.byMonth[selectedMonth] != null
      ? lim.byMonth[selectedMonth]
      : (lim.default != null ? lim.default : null))
  : null;
```

#### Pattern to COPY — visibility filter (line 1073)

```javascript
// BEFORE (fides-store.jsx:1073)
.filter(c => c._custom || plannedOverrides[c.cat] != null || c.spent > 0)

// AFTER — `limit` is the resolved value from the new reading pattern
.filter(c => c._custom || limit != null || c.spent > 0)
// Note: `limit` here refers to the per-category resolved limit computed in the map above.
// Pass it through the map return: return { cat: id, limit, spent, _custom: c.custom === true }
// Then filter on: c._custom || c.limit != null || c.spent > 0
```

#### Pattern to COPY — group limit aggregation (line 1075)

```javascript
// BEFORE (fides-store.jsx:1075)
const limit = cats.reduce((s, c) => s + c.limit, 0);

// AFTER — null-safe sum; null contributes 0 to the sum, but the group limit
// becomes null when ALL cats have null limit (to distinguish "no limit" from "0")
const groupLimit = cats.every(c => c.limit == null)
  ? null
  : cats.reduce((s, c) => s + (c.limit || 0), 0);
```

#### Edge-case rendering pattern (pct when limit is null)

```javascript
// Source: categoryUsage pct pattern (fides-store.jsx:1035)
const pct = limit ? Math.round((spent / limit) * 100) : null;

// Apply same to group level:
const pct = groupLimit != null ? Math.round((spent / groupLimit) * 100) : null;
// In JSX: {pct === null ? 'Sem limite' : `${pct}%`}
// ProgressBar: value={pct != null ? pct / 100 : 0}
```

#### useMemo dependency array update

```javascript
// BEFORE (fides-store.jsx:1079)
}, [monthTransactions, categories, plannedOverrides, groupTargets]);

// AFTER — swap plannedOverrides for categoryLimits + add selectedMonth
}, [monthTransactions, categories, categoryLimits, selectedMonth, groupTargets]);
```

---

### R2 — `assets/fides-charts.jsx` · Donut tooltip

**Target lines:** 116-151 (the `Donut` function)

**Analog:** the Donut function itself; handlers follow the same React useState pattern used elsewhere in fides-studio.jsx (e.g., `flowMode` useState at line 688).

#### Current Donut signature (line 116) — to be extended

```javascript
// Source: fides-charts.jsx:116
function Donut({ data, size = 200, thickness = 22, gap = 0.012, accent = '#B45309', glow = false }) {
```

#### Pattern to ADD — activeIdx state + handlers

```javascript
// AFTER — add prop + state inside Donut
function Donut({ data, size = 200, thickness = 22, gap = 0.012, accent = '#B45309', glow = false, onActiveSlice }) {
  const [activeIdx, setActiveIdx] = React.useState(null);
  // ... existing total and arcs computation unchanged (lines 117-135) ...

  const handleEnter = (i) => { setActiveIdx(i); onActiveSlice?.(arcs[i]); };
  const handleLeave = ()  => { setActiveIdx(null); onActiveSlice?.(null); };
  const handleTap   = (i, e) => { e.stopPropagation(); setActiveIdx(i === activeIdx ? null : i); onActiveSlice?.(i === activeIdx ? null : arcs[i]); };
```

#### Current path render (line 147) — to be augmented

```javascript
// BEFORE (fides-charts.jsx:147)
{arcs.map((a, i) => <path key={i} d={a.d} fill={a.tint}/>)}

// AFTER — add event handlers and cursor
{arcs.map((a, i) => (
  <path
    key={i}
    d={a.d}
    fill={a.tint}
    style={{ cursor: 'pointer', opacity: activeIdx != null && activeIdx !== i ? 0.55 : 1, transition: 'opacity 0.15s' }}
    onMouseEnter={() => handleEnter(i)}
    onMouseLeave={handleLeave}
    onPointerDown={(e) => handleTap(i, e)}
  />
))}
```

#### total is already computed at line 117

```javascript
// Source: fides-charts.jsx:117 — reuse this for pct in consumer
const total = data.reduce((s, d) => s + d.val, 0);
// arcs[i].val / total = slice percentage — consumer uses this
```

---

### R3 — `assets/fides-studio.jsx` · saldoProjetado + hero

**Target lines:** 625 (useFides destructure), 644-663 (derivations), 724-731 (headline), 828-831 (donut center)

#### Pattern to EXTEND — useFides destructure (line 625)

```javascript
// BEFORE (fides-studio.jsx:625)
const { transactions, accounts, cards, goals, monthTransactions, prevMonthTransactions,
        virtualRecurringRevenue, categories, spendByCategory, budgetGroups,
        openCategoryModal, selectedMonth, monthLabel, prevMonth, isEmpty } = useFides();

// AFTER — add activeSlice state below the destructure (new useState)
// No change to useFides() call needed; accounts is already destructured
```

#### Pattern to COPY — flow filter (lines 645-652) — base for saldoProjetado

```javascript
// Source: fides-studio.jsx:645-652
const flow     = monthTransactions.filter(t => !t.isTransfer);
// ...
const despesas  = flow.filter(t => t.val < 0 && t.status === 'pago').reduce((s,t) => s + Math.abs(t.val), 0);
const pendentes = flow.filter(t => t.val < 0 && t.status === 'pendente').reduce((s,t) => s + Math.abs(t.val), 0);
const saldoFinal = receitaTotal - despesas - pendentes;   // ← this line changes
```

#### Pattern to ADD — saldoProjetado (replaces saldoFinal, after line 652)

```javascript
// ADD after existing flow derivations (after line 652)
// accounts and cards are SEPARATE arrays in useFides() — no type filter needed
const saldoContas = accounts.reduce((s, a) => s + (a.balance || 0), 0);

// Pendentes: only unsettled, non-transfer transactions
const flowPending = flow.filter(t => !t.settled);
const receitasPendentes = flowPending.filter(t => t.val > 0).reduce((s, t) => s + t.val, 0);
const despesasPendentes = flowPending.filter(t => t.val < 0).reduce((s, t) => s + Math.abs(t.val), 0);

const saldoProjetado = saldoContas + receitasPendentes - despesasPendentes;

// fluxoMensal stays as-is for P1 (must remain visible)
const fluxoMensal = receitaTotal - despesas - pendentes;  // renamed from saldoFinal
```

#### Pattern to COPY — splitBRL call (line 663) — update to use saldoProjetado

```javascript
// BEFORE (fides-studio.jsx:663)
const { int, dec } = splitBRL(Math.abs(saldoFinal));

// AFTER
const { int, dec } = splitBRL(Math.abs(saldoProjetado));
```

#### Pattern to COPY — headline (lines 724-731) — update variable + copy style exactly

```javascript
// BEFORE (fides-studio.jsx:724-731)
headline={<>
  {saldoFinal >= 0 ? 'Você terminará' : 'Você fechará'} {lbl.long.split(' de ')[0]} com{' '}
  <span className="stu-hero-amt" style={{ color: saldoFinal < 0 ? 'var(--bad)' : 'var(--accent)' }}>
    <span className="cur">{saldoFinal < 0 ? '−R$' : 'R$'}</span>
    <span className="int">{int}</span>
    <span className="dec">,{dec}</span>
  </span>{' '}
  {saldoFinal >= 0 ? 'livre' : 'no vermelho'}.
</>}

// AFTER — swap saldoFinal → saldoProjetado; add "terminará livre" vs "fechará no vermelho"
headline={<>
  {saldoProjetado >= 0 ? 'Você terminará' : 'Você fechará'} {lbl.long.split(' de ')[0]} com{' '}
  <span className="stu-hero-amt" style={{ color: saldoProjetado < 0 ? 'var(--bad)' : 'var(--accent)' }}>
    <span className="cur">{saldoProjetado < 0 ? '−R$' : 'R$'}</span>
    <span className="int">{int}</span>
    <span className="dec">,{dec}</span>
  </span>{' '}
  {saldoProjetado >= 0 ? 'livre' : 'no vermelho'}.
</>}
```

#### Pattern to COPY — donut center (lines 826-831) — wire activeSlice

```javascript
// BEFORE (fides-studio.jsx:826-831)
<div className="fds-donut-wrap">
  <Donut data={spendByCategory} size={184} thickness={24} glow/>
  <div className="fds-donut-center">
    <div className="fds-donut-label">Total</div>
    <div className="fds-donut-value">{fmtBRL(totalSpend, { compact: true })}</div>
  </div>
</div>

// AFTER — add activeSlice state at component top, wire prop and conditional center
// State (add near line 688 alongside flowMode):
const [activeSlice, setActiveSlice] = React.useState(null);

// JSX:
<div className="fds-donut-wrap" ref={donutWrapRef}>
  <Donut data={spendByCategory} size={184} thickness={24} glow onActiveSlice={setActiveSlice}/>
  <div className="fds-donut-center">
    {activeSlice ? (
      <>
        <div className="fds-donut-label">{activeSlice.label}</div>
        <div className="fds-donut-value">{fmtBRL(activeSlice.val, { compact: true })}</div>
        <div className="fds-donut-label">{Math.round((activeSlice.val / totalSpend) * 100)}%</div>
      </>
    ) : (
      <>
        <div className="fds-donut-label">Total</div>
        <div className="fds-donut-value">{fmtBRL(totalSpend, { compact: true })}</div>
      </>
    )}
  </div>
</div>
```

#### Dismiss pattern — useEffect on document (add alongside activeSlice state)

```javascript
// Pattern: dismiss via document listener (most reliable on iOS Safari)
// Follows same useEffect cleanup pattern used in other places in the codebase
const donutWrapRef = React.useRef(null);
React.useEffect(() => {
  if (!activeSlice) return;
  const handler = (e) => {
    if (donutWrapRef.current && !donutWrapRef.current.contains(e.target)) {
      setActiveSlice(null);
    }
  };
  document.addEventListener('pointerdown', handler);
  return () => document.removeEventListener('pointerdown', handler);
}, [activeSlice]);
```

---

## Shared Patterns

### useState declaration style
**Source:** `fides-studio.jsx:688`
```javascript
const [flowMode, setFlowMode] = React.useState('fluxo');
```
All new state variables follow `React.useState` (not destructured import). Same pattern for `activeSlice` and `activeIdx`.

### useMemo dependency array
**Source:** `fides-store.jsx:1056`
```javascript
}, [categoryLimits, spendByCategory, selectedMonth, categories]);
```
Always list every variable referenced inside the memo. `budgetGroups` must add `categoryLimits` and `selectedMonth`, remove `plannedOverrides`.

### Null-safe reduce
**Source:** `fides-studio.jsx:647-651`
```javascript
.reduce((s, t) => s + t.val, 0)
.reduce((s, t) => s + Math.abs(t.val), 0)
```
Always seed reduce with `0`. For balances: `(a.balance || 0)` guard.

### fmtBRL for all currency display
**Source:** `fides-studio.jsx:830`
```javascript
{fmtBRL(totalSpend, { compact: true })}
```
Never format BRL manually. Use `fmtBRL()` global. Use `{ compact: true }` when space is tight (donut center).

### Optional chaining for callbacks
**Source:** pattern established by existing codebase (e.g., `onNav?.()` at line 635)
```javascript
onActiveSlice?.(arcs[i]);   // safe even when consumer doesn't pass the prop
```

---

## No Analog Found

None — all three modifications have clear analogs within the same files.

---

## Critical Constraints (from PROJECT.md + CONTEXT.md)

| Constraint | Impact |
|------------|--------|
| No external libs | Tooltip = React state + JSX only. No npm install. |
| 400×512px iOS Safari rule | Center-of-donut display (D-03). No floating tooltip. |
| `accounts` and `cards` are separate arrays | No type filter needed to exclude cards from saldoContas. |
| `settled` transactions already in `balance` | Only `!t.settled` pending transactions go into saldoProjetado. |
| `fides-dashboard.jsx:249` also uses Donut | `onActiveSlice` must be optional prop (`?.`). Don't render center inside Donut SVG. |
| Prohibition P1 | Do not remove Receitas/Despesas/Em aberto metrics from hero. Keep `fluxoMensal`. |

---

## Metadata

**Analog search scope:** `assets/fides-store.jsx`, `assets/fides-charts.jsx`, `assets/fides-studio.jsx`
**Files scanned:** 3
**Pattern extraction date:** 2026-06-28
