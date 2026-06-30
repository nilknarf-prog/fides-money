# Phase 04: UX Mobile + Motion — Specification

**Created:** 2026-06-30
**Ambiguity score:** 0.18 (gate: ≤ 0.20)
**Requirements:** 4 locked

## Goal

O usuário acessa a `PerfilView` no mobile (≤768px) tocando uma engrenagem clicável no masthead, e percebe transições de entrada **e saída** suaves em modais e micro-feedback de toque/hover nos cards — animações via CSS, com JS mínimo apenas para orquestrar o tempo de saída dos modais.

## Background

Estado atual no código (scout):

- **MOBILE-01:** `SidebarSlim` ([fides-studio.jsx:264](assets/fides-studio.jsx#L264)) tem botão de engrenagem ([fides-studio.jsx:290](assets/fides-studio.jsx#L290), `title="Configurações"`) e avatar ([fides-studio.jsx:294](assets/fides-studio.jsx#L294)) no `.fds-sb-slim-foot` — **nenhum tem `onClick`**. Em `@media (max-width: 768px)`, [fides-responsive.css:269-270](assets/fides-responsive.css#L269-L270) aplica `.fds-sb-slim-foot { display: none !important }`. A slim sidebar vira bottom tabbar com os 7 itens de `NAV` ([fides-shell.jsx:43](assets/fides-shell.jsx#L43)) — sem 'perfil'. `PerfilView` só renderiza quando `active === 'perfil'` ([fides-studio.jsx:58](assets/fides-studio.jsx#L58)). **Resultado: perfil inacessível no mobile.**
- **MOTION-01:** Modais já têm animação de **entrada** — `.fds-modal-backdrop` usa `fds-fadeIn` 0.2s e `.fds-modal` usa `fds-slideUp` 0.25s ([fides.css:1006](assets/fides.css#L1006), [fides.css:1018](assets/fides.css#L1018)). Mas os componentes de modal usam `if (!open) return null` (ex.: [fides-contas.jsx:148](assets/fides-contas.jsx#L148)) → unmount instantâneo → **sem animação de saída** (corte abrupto). CSS puro não anima elemento que o React remove do DOM.
- **MOTION-02:** Alguns cards já têm hover transform (`.stu-acct:hover` translateY+sombra, [fides-studio.css:534](assets/fides-studio.css#L534)). Cards de categoria e feedback de toque mobile (`:active`, sem `:hover` em touch) ainda faltam.

## Requirements

1. **MOBILE-01 — Engrenagem mobile abre Perfil**: Ícone de engrenagem clicável no masthead expõe a `PerfilView` no mobile.
   - Current: Engrenagem e avatar vivem só em `.fds-sb-slim-foot`, sem `onClick`, escondidos por `display:none` em ≤768px. Nenhum caminho seta `active='perfil'` no mobile.
   - Target: Engrenagem visível e tocável no masthead mobile (≤768px) com `onClick` que seta `active='perfil'`. A engrenagem do rodapé desktop ([fides-studio.jsx:290](assets/fides-studio.jsx#L290)) também recebe `onClick='perfil'`. Re-tocar a engrenagem quando já em 'perfil' faz **toggle** de volta à view anterior.
   - Acceptance: Em viewport 400×512px iOS Safari, a engrenagem é visível, sem zoom nem scroll horizontal; tocá-la renderiza `PerfilView`; tocá-la de novo retorna à view anterior. No desktop, clicar a engrenagem do rodapé também abre o perfil.

2. **MOTION-01 — Transição de entrada e saída de modais**: Modais entram e saem com animação visível.
   - Current: Backdrop/modal animam só na entrada (`fds-fadeIn`/`fds-slideUp`); `if(!open) return null` desmonta na hora → saída é corte abrupto.
   - Target: Estado `closing` adia o unmount em ~180ms para a animação de saída (fade-out + slide-down) tocar antes de retornar null. Aplica-se a todos os modais que usam `.fds-modal-backdrop` (NovaTransacao, Categoria, contas). Reabrir dentro da janela de closing **cancela o timer** e remonta/anima entrada limpa.
   - Acceptance: Fechar um modal mostra fade-out + slide-down visível (não some instantâneo); a animação de saída completa antes do DOM remover o nó; abrir → fechar → abrir rápido não deixa estado preso nem modal duplicado.

3. **MOTION-02 — Micro-feedback em cards (hover + tap)**: Cards de categoria e conta dão feedback CSS puro.
   - Current: `.stu-acct:hover` já eleva; cards de categoria sem micro-interação; sem feedback de toque mobile.
   - Target: `:hover` (desktop, isolado em `@media (hover:hover)`) eleva o card (translateY −1px + sombra); `:active` aplica `scale ~0.98` no toque mobile. Cobre cards de categoria e de conta. CSS puro, sem JS.
   - Acceptance: No desktop, hover em card de categoria/conta mostra elevação+sombra; no mobile (touch), tocar mostra scale-down em `:active` e não deixa hover "grudado" após soltar.

4. **MOTION-PERF — Performance e reduced-motion**: As animações são GPU-friendly e respeitam preferência de movimento reduzido.
   - Current: Animações existentes não declaram `will-change`/GPU hint nem tratam `prefers-reduced-motion`.
   - Target: Toda transição de `transform`/`opacity` > ~150ms usa `will-change` ou hint de GPU (`translateZ(0)`); nenhuma passa de 300ms. Sob `@media (prefers-reduced-motion: reduce)`, animações de modal/card são desligadas/reduzidas e o delay de closing dos modais é pulado (unmount imediato).
   - Acceptance: Inspeção mostra nenhuma transição de transform/opacity > 300ms sem GPU hint; com `prefers-reduced-motion: reduce` ativo, modais abrem/fecham sem movimento e sem delay, e cards não animam.

## Boundaries

**In scope:**
- Engrenagem clicável no masthead mobile (`StudioMasthead`) → `active='perfil'`, com toggle de volta
- Wire do `onClick='perfil'` na engrenagem do rodapé desktop (`.fds-sb-slim-foot`)
- Estado `closing` + delay de unmount (~180ms) nos modais que usam `.fds-modal-backdrop` (NovaTransacao, Categoria, contas)
- Keyframes/transição de saída de modal (fade-out + slide-down)
- Micro-feedback CSS em cards de categoria e conta (`:hover` desktop + `:active` mobile)
- GPU hints (`will-change`/`translateZ`) e gate `prefers-reduced-motion` para as novas animações

**Out of scope:**
- Wire do avatar do rodapé (`.fds-sb-slim-avatar`) — fora desta fase; só a engrenagem expõe o perfil
- Redesign visual da `PerfilView` ou do masthead — apenas o ponto de entrada, não a tela
- Adicionar 'perfil' como item do bottom tabbar — decidido contra (engrenagem no topo)
- Animações em telas/componentes que não usam `.fds-modal-backdrop` (ex.: toasts/dialogs do `fides-ui`, que já têm `fui-*` próprios)
- Micro-interação em cards fora de categoria/conta (ex.: cards de transação `.stu-tx`)
- Integração IA / qualquer mudança em `api/*` — é Phase 05

## Constraints

- Plataforma alvo do teste de aceite: iOS Safari, viewport 400×512px (iPhone SE)
- Nenhuma transição de transform/opacity acima de 300ms sem `will-change`/GPU hint
- Animação CSS puro para cards; JS permitido **apenas** para orquestrar o tempo de saída dos modais (estado `closing` + timer de unmount). O JS de closing **não** pode tocar dados financeiros (store/transações)
- Não introduzir scroll horizontal nem exigir zoom em 400px (a engrenagem deve caber no masthead)
- `@media (hover:hover)` para isolar `:hover` e evitar hover "grudado" em touch

## Acceptance Criteria

- [ ] Em 400×512px iOS Safari, engrenagem do masthead é visível e tocável sem zoom/scroll horizontal
- [ ] Tocar a engrenagem (mobile) renderiza `PerfilView`; tocar de novo faz toggle de volta à view anterior
- [ ] Clicar a engrenagem do rodapé desktop abre `PerfilView`
- [ ] Fechar qualquer modal (NovaTransacao/Categoria/contas) mostra animação de saída visível (fade-out + slide-down), não corte abrupto
- [ ] Abrir → fechar → reabrir rápido cancela o closing e remonta limpo (sem modal duplicado/estado preso)
- [ ] Card de categoria e de conta: `:hover` eleva (desktop), `:active` faz scale-down (mobile), sem hover grudado após toque
- [ ] Nenhuma transição de transform/opacity > 300ms sem GPU hint
- [ ] Com `prefers-reduced-motion: reduce`: modais abrem/fecham sem movimento nem delay; cards não animam

## Edge Coverage

**Coverage:** 5/5 applicable edges resolved · 0 unresolved

| Category | Requirement | Status | Resolution / Reason |
|----------|-------------|--------|---------------------|
| Re-tap / estado idempotente | R1 (MOBILE-01) | ✅ covered | Re-tocar engrenagem em 'perfil' faz toggle de volta à view anterior (AC 2) |
| Viewport boundary (dois pontos de entrada) | R1 (MOBILE-01) | ✅ covered | Engrenagem do masthead aparece ≤768px; engrenagem do rodapé só >768px (in scope) |
| Sticky :hover em touch (iOS) | R3 (MOTION-02) | ✅ covered | `:hover` isolado em `@media (hover:hover)` — sem lift grudado após tap (AC 6) |
| Race de re-open durante closing | R2 (MOTION-01) | ✅ covered | Novo open cancela timer de closing e remonta/anima limpo (AC 5) |
| reduced-motion vs delay de closing | R4 (MOTION-PERF) | ✅ covered | Sob `prefers-reduced-motion`, pula delay e desmonta imediato (AC 8) |

## Prohibitions (must-NOT)

**Coverage:** 1/1 applicable prohibitions resolved · 0 unresolved

| Prohibition (must-NOT statement) | Requirement | Status | Verification / Reason |
|----------------------------------|-------------|--------|------------------------|
| O JS de orquestração de fechamento de modal (estado `closing`/timer) NÃO PODE chamar mutações de store nem APIs de dados financeiros (`addTransaction`, `pay_card_invoice`, etc.) — deve só gerenciar o tempo de render | R2 (MOTION-01) | resolved | verification: judgment — revisar que o novo JS de closing só lida com timing de unmount, sem import/chamada de escrita do store |

*Probe (recall→precision): candidatos de jank, layout-shift e focus-trap caíram como routine-engineering (cobertos por R4/AC ou code review). Nenhum item de canon security/compliance aplicável (fase CSS/UI, sem PII/auth). Um único must-NOT de escopo mantido.*

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                        |
|--------------------|-------|------|--------|----------------------------------------------|
| Goal Clarity       | 0.88  | 0.75 | ✓      | Tensão CSS-only vs exit resolvida (JS mínimo)|
| Boundary Clarity   | 0.80  | 0.70 | ✓      | In/out scope explícito; avatar fora          |
| Constraint Clarity | 0.78  | 0.65 | ✓      | 400×512 iOS, ≤300ms, reduced-motion          |
| Acceptance Criteria| 0.78  | 0.70 | ✓      | 8 critérios pass/fail                         |
| **Ambiguity**      | 0.18  | ≤0.20| ✓      |                                              |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

| Round | Perspective     | Question summary                          | Decision locked                                              |
|-------|-----------------|-------------------------------------------|--------------------------------------------------------------|
| 1     | Researcher      | Como expor Perfil no mobile?              | Engrenagem no masthead mobile → `active='perfil'`            |
| 1     | Researcher      | Exit de modal vs "sem JS adicional"?      | Permitir JS mínimo (estado `closing` + delay) p/ exit real  |
| 1     | Simplifier      | Escopo de modais/cards?                   | Todos modais `.fds-modal-backdrop` + cards categoria/conta  |
| 2     | Boundary Keeper | Engrenagem do desktop também?             | Wire ambas (rodapé desktop + masthead mobile)               |
| 2     | Failure Analyst | Feedback exato de card + touch?           | `:hover` lift (desktop) + `:active` scale (mobile)          |
| 2     | Failure Analyst | Respeitar prefers-reduced-motion?         | Sim — gate em `@media (prefers-reduced-motion: reduce)`     |
| edge  | Failure Analyst | Re-tap engrenagem em 'perfil'?            | Toggle de volta à view anterior                             |
| edge  | Failure Analyst | Re-open de modal durante closing?         | Cancela timer de closing, remonta limpo                     |

---

*Phase: 04-ux-mobile-motion*
*Spec created: 2026-06-30*
*Next step: /gsd-discuss-phase 04 — decisões de implementação (onde colocar a engrenagem no masthead, estrutura do estado closing, keyframes de saída, etc.)*
