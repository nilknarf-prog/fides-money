---
phase: 05
slug: ia-real
status: draft
shadcn_initialized: false
preset: none
created: 2026-06-30
---

# Phase 05 — UI Design Contract

> Visual and interaction contract for the "Análise da IA" button in `PlnMesInsights` (`assets/fides-orcamento.jsx`). Scope is narrow: swap the 2.2s stub for the real `api/assistant.js` call and add exactly three new UI surfaces — loading indicator, analysis-response area, error state. No redesign of the budget screen. All values below are derived from existing tokens/patterns already in the codebase (`fides.css`, `fides-orcamento.css`, `fides-claude.jsx`) — nothing new is introduced.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — static Babel-standalone React, no bundler, no shadcn |
| Preset | not applicable |
| Component library | none — hand-rolled `React.createElement` components in `assets/*.jsx` |
| Icon library | none — emoji glyphs used as icons throughout `fides-orcamento.jsx` (💡 🤖 ✓). Continue this convention; do not introduce an icon library or `Icon.*` component for this phase. |
| Font | inherited from `fides.css` root (`--font`, `--font-mono`) — no new font |

---

## Scope Lock — 3 Surfaces Only

1. **Loading indicator** — reuse existing `.pln-mi-spin` spinner already wired to the button (`aiLoading` state). No new loading component.
2. **Analysis-response area** — new `.pln-mi-ai-result` panel, inline, appended inside `.pln-mi-footer` below the button (not a modal, not a separate card, not a route change).
3. **Error state** — new `.pln-mi-ai-error` inline message, same footer region, replacing the result panel when the call fails. Modeled directly on `fides-claude.jsx`'s existing `.cla-msg-error` pattern (icon + friendly copy, same error-code-to-copy mapping approach via `friendlyError()`).

Everything else in `PlnMesInsights` (cards, hint text, button itself, `pln-mi-head`) is out of scope — do not touch.

---

## Placement Decision (resolved — not asked to user)

**Where the analysis renders:** inline panel below the "Análise da IA" button, inside the same `.pln-mi-footer` container that already holds the button. Rationale (derived, not invented): `PlnMesInsights` already owns this card real estate in `pln-rail`; a modal or separate card would require new chrome (close button, backdrop, positioning) the phase explicitly says to avoid; the existing `fides-claude.jsx` chat widget already proves the codebase's "inline text response with paragraph splitting" pattern works well for this content shape. This is a reasonable default per the phase's "keep minimal, don't redesign" instruction — flag to user if a different placement (e.g. reuse the chat drawer) is actually preferred.

**Interaction model:** single-shot call, not a chat thread. One click → one loading → one result (or error). No follow-up input field, no conversation history, no tool-calling round-trip UI (see Technical Notes below — tool_calls are handled transparently, never surfaced to the user as a UI state).

---

## Spacing Scale

Declared values (must be multiples of 4) — inherited from `fides-orcamento.css`, no new scale introduced:

| Token | Value | Usage in this phase |
|-------|-------|----------------------|
| xs | 4px | gap between result icon and text baseline |
| sm | 8px | gap inside `.pln-mi-footer` (existing), gap inside new result/error rows |
| md | 16px | `.pln-mi-ai-result` / `.pln-mi-ai-error` internal padding |
| lg | 24px | not used in this phase's surfaces |

Exceptions: none. Reuse `.pln-mi-footer`'s existing `gap: 10px` (pre-existing 8pt-adjacent value, do not change it).

---

## Typography

Reused from `.pln-mi-*` rules already in `fides-orcamento.css` — no new sizes/weights introduced.

| Role | Size | Weight | Line Height | Source |
|------|------|--------|-------------|--------|
| Result body text | 12.5px | 400 (regular) | 1.5 | matches `.pln-mi-text` |
| Error message text | 12.5px | 400 (regular) | 1.5 | matches `.pln-mi-text` / `.cla-msg-error` |
| Result/error label (optional heading, e.g. "Análise") | 12.5px | 700 (bold) | 1.5 | matches `.pln-mi-title-sm` |

Only 1 size (12.5px) and 2 weights (400 / 700) used — consistent with the card's existing type scale. Do not introduce a larger "headline" size for the AI result; it is supplementary content, not a page section.

---

## Color

Reused from `fides.css` root tokens — no new colors introduced.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--card)` | Result/error panel background |
| Secondary (30%) | `var(--card-soft)` | Panel background variant (matches `.pln-mi-ai-btn:hover` background, gives the result panel a "settled" look distinct from raw card) |
| Accent (10%) | `var(--accent)` | Spinner top-border color only (already wired in `.pln-mi-spin`) — do not use accent for result panel border or text |
| Destructive/Error | `var(--bad)` text / `var(--bad-soft)` background | Error panel only — matches `.pln-mi-card--bad` and `.cla-msg-error` conventions |

Accent reserved for: the spinner's rotating border segment only (`.pln-mi-spin { border-top-color: var(--accent) }`, already present, unchanged). Never apply accent to the result text, result panel border, or error panel.

Result panel border/left-accent: use `var(--border-strong)` for the result panel border (neutral, matches `.pln-mi-ai-btn` border) — NOT accent, NOT ok/bad — the analysis result itself is neutral informational content, not a status card.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA (idle) | "Análise da IA" (unchanged — already correct, do not rename) |
| Primary CTA (loading) | "Analisando…" (unchanged — already implemented at line 1039 of `fides-orcamento.jsx`) |
| Result panel heading (optional, small label above text) | "Análise da IA" or omit — if included, reuse the button's own label so there is no new noun introduced |
| Result panel body | Raw text from `data.reply` (Gemini response), rendered as one or more `<p>` paragraphs split on `\n`, mirroring `fides-claude.jsx`'s `m.content.split('\n').map(...)` pattern. No truncation, no "read more" — `maxOutputTokens: 1024` on the backend already bounds length. |
| Error state (generic) | "Não consegui gerar a análise agora. Tente novamente em instantes." |
| Error state (network) | "Sem conexão. Verifique a internet e tente de novo." |
| Error state (rate limit / 429, `USER_DAILY_LIMIT`) | "Você atingiu o limite diário de análises. Tente novamente amanhã." |
| Error state (rate limit / 429, generic) | "Muitas pessoas usando a IA agora. Tente novamente em instantes." |
| Error state (auth/JWT missing or invalid) | "Sessão expirada. Atualize a página e tente novamente." |
| Error state (5xx / `GEMINI_ERROR`, `INTERNAL_ERROR`) | "O assistente está temporariamente indisponível. Tente novamente em instantes." |
| Error state (empty reply / `EMPTY_REPLY`) | "A IA não conseguiu gerar uma análise dessa vez. Tente novamente." |
| Destructive confirmation | not applicable — this phase has no destructive action (read-only analysis call, nothing to confirm/undo) |

**Error copy mapping reuses `fides-claude.jsx`'s existing `friendlyError(errCode)` map (lines ~437–450) directly** — do not invent a parallel error-copy table. If `PlnMesInsights` needs its own instance of this function (since it's a different component), copy the map verbatim rather than redesigning tone/wording.

---

## Loading State Contract

- Trigger: immediately on click, synchronously, before any network request resolves (`setAiLoading(true)` already does this — no change needed to the trigger timing).
- Visual: existing `.pln-mi-spin` (14px circular spinner, `border-top-color: var(--accent)`, 0.7s linear rotation) replaces the 🤖 emoji inside the button. Unchanged.
- **New requirement not yet in the codebase:** gate `.pln-mi-spin`'s animation under `@media (prefers-reduced-motion: reduce)` — the rest of the codebase already does this (`fides.css:1039`) but `.pln-mi-spin`'s `@keyframes` in `fides-orcamento.css` currently has no such gate. Add:
  ```css
  @media (prefers-reduced-motion: reduce) {
    .pln-mi-spin { animation: none; border-top-color: var(--border-strong); }
  }
  ```
  (Static ring instead of spin — still communicates "in progress" via the button's disabled state and "Analisando…" label, per WCAG 2.3.3.)
- Timeout ceiling: none added by this phase (out of scope per phase goal — "typically 2–8s"), but the fetch must not hang indefinitely if the network never responds — rely on browser's default fetch behavior; if a hard timeout is desired it is a technical/backend concern, not a UI-SPEC concern, flag to planner if unaddressed.
- Button stays `disabled` for the entire loading window (already implemented) — prevents double-fire.

---

## Analysis-Response Area Contract

New element: `.pln-mi-ai-result`, rendered inside `.pln-mi-footer`, appearing below the button only after a successful response (`data.reply` present) and staying visible until the next click (which clears it and shows loading again) or the component unmounts (month change / navigation).

**State transitions:**

| From | Trigger | To |
|------|---------|-----|
| idle (no panel) | click button | loading (spinner in button, no panel yet) |
| loading | `data.reply` received | idle → result panel appears with `data.reply` text |
| loading | error (network/4xx/5xx/empty) | idle → error panel appears, no result panel |
| result panel visible | click button again | previous result cleared, loading state shown again (do not stack multiple results) |
| error panel visible | click button again | previous error cleared, loading state shown again |

**Structure (React.createElement, matching file convention):**

```
.pln-mi-ai-result
  .pln-mi-ai-result-text (one <p> per '\n'-split line of data.reply)
```

**CSS (add to `fides-orcamento.css`, adjacent to existing `.pln-mi-*` rules):**

```css
.pln-mi-ai-result {
  margin-top: 4px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--card-soft);
  border: 1px solid var(--border-strong);
}
.pln-mi-ai-result p {
  margin: 0 0 8px 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--ink-3);
}
.pln-mi-ai-result p:last-child { margin-bottom: 0; }
```

No entrance animation required for this phase (MOTION-01/02 already cover modal/card motion elsewhere; adding a new fade here is scope creep). If a subtle fade-in is trivial to include, gate it the same way as all other motion in this codebase (`prefers-reduced-motion`), but it is not a success criterion — do not block on it.

---

## Error State Contract

New element: `.pln-mi-ai-error`, same footer slot as the result panel (mutually exclusive — never show both at once).

**CSS:**

```css
.pln-mi-ai-error {
  margin-top: 4px;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--bad-soft);
  color: var(--bad);
  border: 1px solid var(--bad);
  font-size: 12.5px;
  line-height: 1.5;
  display: flex;
  align-items: center;
  gap: 8px;
}
```

**Structure:** icon glyph (reuse `✕` or `⚠️` emoji — consistent with file's emoji-icon convention, do NOT import `Icon.X` from `fides-claude.jsx` since that component is a separate module with its own icon dependency) + error copy text from the mapping table above.

**Never-hang guarantee:** the `try/catch` around the fetch call MUST always terminate in either the result panel or the error panel — every code path (`!res.ok`, JSON parse failure, thrown `fetch` rejection/network error, empty `data.reply`) sets `aiLoading` back to `false` and sets an error message. Mirror `fides-claude.jsx`'s `send()` function structure (lines 468–552): every early `return` inside the try block calls `setThinking(false)` (here: `setAiLoading(false)`) before returning — do not let any branch fall through without resetting loading state.

**Tool-call round-trip is invisible to the user:** `api/assistant.js` can respond with `{ tool_calls: [...] }` requiring the client to execute `consultar_saldo`/`consultar_extrato` and re-call the endpoint with `toolResults` (see `fides-claude.jsx` lines 522–528 for the existing loop). If this phase's implementation reuses that loop, the loading state (spinner + "Analisando…") must persist across all iterations — do not flash idle/loading between rounds. This is a single continuous loading state from the user's point of view regardless of how many round-trips happen underneath.

---

## Registry Safety

Not applicable — no component registry, no shadcn, no third-party UI packages. Pure hand-written CSS + `React.createElement`, consistent with the rest of `assets/fides-orcamento.jsx`.

| Registry | Blocks Used | Safety Gate |
|----------|-------------|--------------|
| shadcn official | none | not required |
| third-party | none | not required |

---

## Technical Notes (for planner/executor — not new UI, context only)

- `api/assistant.js` requires `messages` (array), `jwt` (string), optional `context`/`toolResults`. The button click must supply at minimum: `messages: [{ role: 'user', content: '<analysis prompt>' }]`, a `jwt` obtained the same way `fides-claude.jsx` does (`window.fidesAuth.getSession()`), and ideally a `context` string built the same way as `buildContext()` in `fides-claude.jsx` (reuse or adapt — `PlnMesInsights` already has `groups`/`totals`/`prevTxs` in scope, enough to build an equivalent budget-focused context string).
- The prompt sent as the "user message" for this one-shot analysis is a product/copy decision for the planner (e.g. "Analise meu orçamento deste mês e aponte os principais pontos de atenção.") — not a visual concern, but flagged here since it directly determines what appears in the new result panel.
- `api/assistant.js` is out of scope for UI changes (must stay CommonJS per AI-01/AI-02 constraints) — this UI-SPEC does not request any backend modification beyond what already exists.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
