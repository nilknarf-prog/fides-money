---
phase: 09-transacoes-power-tools-analytics
plan: 02
subsystem: ui
tags: [react, babel-standalone, command-palette, keyboard-shortcuts, fides-studio]

# Dependency graph
requires:
  - phase: 09-01
    provides: spendByCategoryRange/rangeTransactions com semantica de mes via txMonth()
provides:
  - Componente CommandPalette (busca em memoria + navegacao) montado em FidesStudioShell
  - Atalho global Cmd/Ctrl+K funcional em qualquer pagina do studio
  - Input de busca do masthead deixa de ser decorativo (onOpenSearch)
  - Auto-close do palette em qualquer mudanca de `active` (navegacao externa inclusive)
affects: [09-transacoes-power-tools-analytics, futuras fases que estendam navegacao do studio]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Command palette client-only sem dependencia externa (nao cmdk) — ~120 linhas, busca em memoria sobre dados ja carregados via useFides()"
    - "Listener global keydown em document dentro de useEffect com cleanup (mesmo padrao de fides-ui.jsx ConfirmDialog)"
    - "Auto-close via useEffect com deps [active] — fecha overlay em qualquer navegacao, nao so a originada dentro dele"

key-files:
  created: []
  modified:
    - assets/fides-studio.jsx
    - assets/fides-studio.css

key-decisions:
  - "CommandPalette reaproveita o shell visual dos modais existentes (.fds-modal-backdrop/.fds-modal) em vez de criar um overlay do zero, adicionando so as classes .stu-cmdk* especificas do palette"
  - "Resultados de transacao usam t._id (nao t.id — campo real de normalizeTx) como parte da key, com fallback t.d+t.desc"
  - "Busca cobre transacoes + contas/cartoes (por nome) + categorias (por label), navegando para transacoes/contas/orcamento respectivamente — resolve a Open Question 3 do 09-RESEARCH"

patterns-established:
  - "Overlay client-only reaproveitando .fds-modal-backdrop/.fds-modal: any novo painel simples pode seguir o mesmo shell sem CSS novo alem de classes de conteudo"

requirements-completed: [TX-07]

# Metrics
duration: ~15min
completed: 2026-07-04
status: complete
---

# Phase 09 Plan 02: Command Palette (⌘K) Summary

**Componente CommandPalette client-only (busca em memoria sobre transactions/accounts/cards/categories, sem query nova) ligado a um atalho global Cmd/Ctrl+K e ao input antes decorativo do masthead, navegando via `setActive` e fechando automaticamente em qualquer troca de página.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2/2 completed
- **Files modified:** 2 (`assets/fides-studio.jsx`, `assets/fides-studio.css`)

## Accomplishments
- `CommandPalette({ open, onClose, onNav })` novo em `fides-studio.jsx`: busca em memória (mesmo predicado desc/val/categoria de `fides-transacoes.jsx:213-222`) sobre `transactions`, mais itens navegáveis para `accounts`/`cards` (por nome) e `categories` (por label) — zero query nova.
- Atalho global `Cmd/Ctrl+K` registrado em `FidesStudioShell` via `useEffect` com listener em `document` e cleanup; abre o palette de qualquer página do studio.
- Auto-close do palette em **qualquer** mudança de `active` (`useEffect([active])`) — cobre navegação pela sidebar/masthead, não só a escolha de um resultado dentro do próprio palette (finding #4 do 09-REVIEWS).
- Input `.stu-mast-search` do masthead (antes `readOnly` e morto) passa a abrir o palette via `onClick={onOpenSearch}`; `<kbd>⌘K</kbd>` visual mantido.
- Navegação por teclado dentro do palette (ArrowUp/ArrowDown/Enter) além de clique e Escape/backdrop para fechar.
- Sem `dangerouslySetInnerHTML` em nenhum ponto — resultados renderizados como JSX puro (`{r.label}`/`{r.hint}`), React auto-escapa (mitigação T-09-XSS do threat_model).

## Task Commits

Each task was committed atomically:

1. **Task 1: componente CommandPalette (listener global + busca em memória + navegação)** - `cf8adeb` (feat)
2. **Task 2: montar palette em FidesStudioShell + atalho Cmd/Ctrl+K + ligar input do masthead** - `2d815d3` (feat)

**Plan metadata:** commit pendente (docs: complete plan) — ver commit seguinte a este SUMMARY

_Note: nenhuma tarefa TDD neste plano — projeto sem infraestrutura de testes automatizados hoje (débito ROADMAP B11)._

## Files Created/Modified
- `assets/fides-studio.jsx` - Novo `CommandPalette`; `FidesStudioShell` ganha `paletteOpen`, listener global Cmd/Ctrl+K, auto-close em `[active]`, e monta `<CommandPalette/>`; `StudioMasthead` ganha prop `onOpenSearch` e liga o input de busca
- `assets/fides-studio.css` - Classes `.stu-cmdk*` (backdrop, input row, lista, item, empty state) reaproveitando `.fds-modal-backdrop`/`.fds-modal`

## Decisions Made
- CommandPalette reaproveita o shell visual dos modais existentes (`.fds-modal-backdrop`/`.fds-modal`, já animados e com `prefers-reduced-motion` tratado em `fides.css`), evitando introduzir animação nova acima de 300ms (convenção de perf da Phase 03) — só sobrescreve `align-items`/`padding-top` via `.stu-cmdk-backdrop` para posicionar o palette no topo em vez de centralizado.
- Resultados de transação usam `t._id` (campo real produzido por `normalizeTx`, não `t.id`) para a key, com fallback `t.d + t.desc` — evita `key` undefined/duplicada.
- Escopo da busca (contas/cartões/categorias navegáveis, além de transações) segue o placeholder já desenhado do masthead — resolve a Open Question 3 do 09-RESEARCH; atualização do marcador RESOLVED no próprio 09-RESEARCH.md permanece deferida (ajuste de processo não-bloqueante, conforme nota do plano).

## Deviations from Plan

None - plan executado exatamente como escrito. Todas as acceptance criteria de ambas as tasks foram atendidas sem necessidade de fix ou ajuste estrutural.

## Issues Encountered

None. Projeto não tem build/lint step (Babel-standalone no browser); verificação de sintaxe foi feita por leitura cuidadosa do bloco inserido (balanceamento de chaves/parênteses e ordem de hooks) já que não há `babel`/bundler instalado localmente para checagem automática.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- `CommandPalette` fica disponível para qualquer plano futuro que precise estender a busca (ex.: metas, se decidido depois).
- Verificação funcional completa (abrir com Cmd/Ctrl+K em cada página, digitar termo, navegar, confirmar escape de HTML colado numa descrição) depende de rodar o app no browser — recomendado como parte do UAT humano da fase 09, junto com os demais planos.
- Nenhum blocker para os próximos planos da fase 09.

---
*Phase: 09-transacoes-power-tools-analytics*
*Completed: 2026-07-04*

## Self-Check: PASSED
- FOUND: .planning/phases/09-transacoes-power-tools-analytics/09-02-SUMMARY.md
- FOUND: cf8adeb (Task 1 commit)
- FOUND: 2d815d3 (Task 2 commit)
