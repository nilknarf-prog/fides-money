# Phase 04: UX Mobile + Motion - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Perfil acessível no mobile (engrenagem clicável no masthead) + micro-interações CSS em modais (entrada e saída) e cards (hover/tap). Animações via CSS; JS mínimo apenas para orquestrar o tempo de saída dos modais. Sem mudanças de dados/API.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**4 requirements are locked.** See `04-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `04-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Engrenagem clicável no masthead mobile (`StudioMasthead`) → `active='perfil'`, com toggle de volta
- Wire do `onClick='perfil'` na engrenagem do rodapé desktop (`.fds-sb-slim-foot`)
- Estado `closing` + delay de unmount (~180ms) nos modais que usam `.fds-modal-backdrop` (NovaTransacao, Categoria, contas)
- Keyframes/transição de saída de modal (fade-out + slide-down)
- Micro-feedback CSS em cards de categoria e conta (`:hover` desktop + `:active` mobile)
- GPU hints (`will-change`/`translateZ`) e gate `prefers-reduced-motion` para as novas animações

**Out of scope (from SPEC.md):**
- Wire do avatar do rodapé (`.fds-sb-slim-avatar`) — só a engrenagem expõe o perfil
- Redesign visual da `PerfilView` ou do masthead — apenas o ponto de entrada
- Adicionar 'perfil' como item do bottom tabbar
- Animações em componentes que não usam `.fds-modal-backdrop` (ex.: toasts/dialogs `fui-*` do fides-ui)
- Micro-interação em cards fora de categoria/conta (ex.: `.stu-tx`)
- Integração IA / mudanças em `api/*` — é Phase 05

</spec_lock>

<decisions>
## Implementation Decisions

### Estado `closing` dos modais (área discutida)
- **D-01:** Padrão = **hook compartilhado** `useModalClose(open, onClose)` em `fides-ui.jsx`, retornando `{ rendered, closing, requestClose }`. `fides-ui.jsx` já é a casa dos primitivos de dialog (ConfirmDialog em `fides-ui.jsx:130`) e dos keyframes `fui-*`. Evita triplicar lógica de timing. NÃO escolher inline-por-modal nem `<ModalShell>` wrapper.
- **D-02:** Cada um dos 3 modais (`NovaTransacaoModal` em `fides-transacoes.jsx:1118`/return null `:1164`; `CategoriaModal` em `fides-store.jsx:1419`/return null `:1427`; modal de contas em `fides-contas.jsx:148`) troca `if (!open) return null` por `if (!rendered) return null` e aplica a classe `is-closing` no `.fds-modal`/`.fds-modal-backdrop` enquanto `closing` é true. Fechar chama `requestClose` (seta `closing`, agenda unmount em ~180ms via `setTimeout`).
- **D-03:** Race de re-open (SPEC edge): novo `open` durante a janela de closing **cancela** o `setTimeout` e remonta/anima entrada limpa. O hook deve guardar o id do timer e limpá-lo em `open===true` e no cleanup do `useEffect`.
- **D-04:** Durante a saída (`is-closing`), **travar interação**: `pointer-events: none` no `.fds-modal.is-closing` para evitar clique acidental em botões durante o fade-out (~180ms).
- **D-05:** `prefers-reduced-motion: reduce` (SPEC R4): o hook **pula o delay** e desmonta imediatamente (sem janela de closing), e os keyframes não animam. Implementar via checagem de `window.matchMedia('(prefers-reduced-motion: reduce)')` no hook + `@media` no CSS.

### Claude's Discretion (áreas não selecionadas — defaults recomendados ao planner)
- **Posição da engrenagem mobile:** não discutida. Recomendado: encaixar a engrenagem no `StudioMasthead` em 400px sem empurrar o seletor de mês nem criar scroll horizontal. Planner/researcher decide o slot exato (provável canto direito do masthead, isolado por `@media (max-width:768px)` para não duplicar com o gear do rodapé desktop). Constraint do SPEC: visível e tocável em 400×512px iOS Safari.
- **Keyframes de saída:** não discutida. Recomendado: estender o par existente `fds-fadeIn`/`fds-slideUp` (`fides.css:1008`/`:1020`) com variantes `-out` (fade-out + slide-down) no mesmo arquivo `fides.css`, mantendo coerência com a entrada já existente, em vez de migrar para o padrão `fui-*`. Planner confirma.
- **Toggle "view anterior":** não discutida. Recomendado: rastrear `lastView` (última view ≠ 'perfil') no componente que possui o estado `active` (`StudioApp`/`fides-studio.jsx`); re-tap da engrenagem em 'perfil' faz `setActive(lastView)`.
- **Classes exatas de card:** não discutida. `.stu-acct` (conta) já tem `:hover` (`fides-studio.css:534`). Cards de categoria: planner deve confirmar a classe alvo (candidata `.stu-cats`/cards dentro de "Para onde foi") antes de aplicar `:hover`+`:active`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos travados
- `.planning/phases/04-ux-mobile-motion/04-SPEC.md` — Locked requirements, boundaries, acceptance criteria, Edge Coverage e Prohibitions. MUST read before planning.

### Roadmap / requisitos
- `.planning/ROADMAP.md` §"Phase 04: UX Mobile + Motion" — goal e Success Criteria
- `.planning/REQUIREMENTS.md` §MOBILE/MOTION — MOBILE-01, MOTION-01, MOTION-02

### Constraints de arquitetura
- `.planning/PROJECT.md` §3 (Stack) e §4 (Constraints) — React 18 Babel-standalone (sem bundler), CSS por componente, regra de ouro 400×512px iOS Safari; arquivos protegidos (`tokens.css`, `fides-data.jsx`, `fides-charts.jsx` — nenhum tocado nesta fase)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useModalClose` (a CRIAR em `fides-ui.jsx`): hook compartilhado de ciclo de saída para os 3 modais.
- Keyframes existentes `fds-fadeIn`/`fds-slideUp` (`fides.css:1008`/`:1020`): base de entrada; estender com variantes `-out`.
- `.fds-modal-backdrop`/`.fds-modal` (`fides.css:998`/`:1009`): shell comum aos 3 modais — alvo da classe `is-closing`.
- `.stu-acct:hover` (`fides-studio.css:534`): padrão de lift já estabelecido para card de conta — replicar nos cards de categoria.

### Established Patterns
- Pattern repo-wide `if (!open) return null` em 7+ modais (transacoes, store, contas, metas, tweaks, fides-ui). Nesta fase só os 3 do escopo migram para `if (!rendered) return null`; os demais ficam para adoção futura (respeita o boundary do SPEC).
- `fides-ui.jsx` = casa dos primitivos de dialog (`ConfirmDialog`) e keyframes `fui-*` — local natural do hook compartilhado.
- Mobile = bottom tabbar (slim sidebar reposicionada em `@media (max-width:768px)`, `fides-responsive.css:245+`), com `.fds-sb-slim-foot { display:none }` (`:269-270`).

### Integration Points
- `StudioMasthead` (`fides-studio.jsx:303`): recebe a nova engrenagem mobile.
- `SidebarSlim` foot gear (`fides-studio.jsx:290`): recebe `onClick='perfil'` (desktop).
- Estado `active` em `StudioApp` (`fides-studio.jsx:~42`): fonte do `setActive('perfil')` e do `lastView` p/ toggle.
- 3 modais: `NovaTransacaoModal` (`fides-transacoes.jsx:1118`), `CategoriaModal` (`fides-store.jsx:1419`), modal de contas (`fides-contas.jsx:148`).

</code_context>

<specifics>
## Specific Ideas

- Tempo de saída alvo: ~180ms (alinhado com a entrada `fds-slideUp` 0.25s / `fds-fadeIn` 0.2s).
- Card feedback: `:hover` lift (translateY −1px + sombra) isolado em `@media (hover:hover)`; `:active` scale ~0.98 no toque mobile.
- Execução do código é feita externamente pelo Deyglison (Gemini/Sonnet); este `.planning/` só planeja. Decisões aqui guiam o planner, não geram commits de app.

</specifics>

<deferred>
## Deferred Ideas

- Wire do avatar do rodapé (`.fds-sb-slim-avatar`) para abrir perfil — fora do escopo (SPEC); só a engrenagem expõe nesta fase.
- Adotar `useModalClose` nos demais modais (metas, TxAdvFilters, tweaks, fui dialog) — fase futura de consistência.
- Micro-interação em cards de transação (`.stu-tx`) e outros — não nesta fase.

</deferred>

---

*Phase: 04-ux-mobile-motion*
*Context gathered: 2026-06-30*
