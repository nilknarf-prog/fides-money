# Metas "Vision Board" — Design Spec

**Data:** 2026-07-02
**Origem:** brainstorming (superpowers) a partir de referência PlannerFin + área Metas atual do Fides.
**Mockup aprovado:** https://claude.ai/code/artifact/bdcb8866-d1fa-4f66-be84-17dc8f2b2e30
**Alvo de implementação:** nova fase GSD (Phase 08). Backend toca `supabase/` → revisão de segurança obrigatória antes de commit (CLAUDE.md).

---

## 1. Objetivo

Elevar a área de Metas do Fides ao nível do "vision board" do PlannerFin (cards com capa/foto, busca, filtro, status, update inline), **mantendo a identidade editorial Fides** (hero editorial em Manrope, capítulos I/II/III, sistema de tint por meta, tips "Como acelerar", modal Aportar com projeção). Não é plágio: funções do PlannerFin absorvidas e melhoradas dentro da linguagem Studio.

## 2. Decisões (todas aprovadas pelo usuário)

| # | Decisão | Escolha |
|---|---------|---------|
| D1 | Estratégia de imagem | **Galeria curada + upload próprio**, ambos nesta fase |
| D2 | Direção de layout | **Editorial-first** (Fides domina; funções PlannerFin absorvidas) |
| D3 | Hero | **Exclusivo da área de Metas** (`met-hero`), NÃO reutilizar/mesclar com o hero inicial/home |
| D4 | Fonte dos presets | **Capas bespoke** geradas (texturas/gradientes na paleta tint) |
| D5 | Modelo de status | **Ativa / Concluída** reusando `completed` (sem coluna nova de status nesta fase) |
| D6 | Update inline | Manter **os dois**: Aportar (soma + projeção, extra Fides) e Atualizar (seta saldo, parity PlannerFin) |

## 3. Escopo

### 3.1 Frontend (`assets/fides-metas.jsx` + `assets/fides-metas.css`)

- **`met-hero`** — hero editorial exclusivo de Metas. Eyebrow "vision board · N metas em curso", headline "Você guardou R$X para os seus sonhos" (Manrope display, itálico no destaque), lede narrativa, strip (Guardado / Aporte mensal / Próxima a chegar). Backdrop: colagem sutil (mask) das capas, para diferenciar do `stu-hero` da home. **Restrição D3:** classe própria, sem herdar o hero inicial.
- **Barra de controles** (nova) — busca por nome/descrição (filtro client-side) + filtro segmentado de status (Todas / Ativas / Concluídas) + botão "Nova meta". Estado local no `MetasStudio`.
- **Cards vision-board** (`vcard`) — substitui o `met-card` atual:
  - Capa (186px): imagem de fundo (preset OU upload) + scrim gradiente pra legibilidade; fallback = gradiente tint quando sem capa (graceful).
  - Overlay: pill de status, chip emoji, nome (display), descrição.
  - Corpo: valor atual (grande) `de R$alvo`, barra de progresso no tint + glow, `%` + "faltam R$X", 2 stats (Aporte mensal / Chega em; ou Guardado / Concluída em quando done).
  - Hover/tap revela: ícones editar/excluir (canto), quick "Atualizar saldo" inline (D6), e ações Aportar / Ajustar plano.
- **Modais** — `CriarMetaModal` e `AjustarPlanoModal` ganham **seletor de capa** com abas *Galeria* (grid de presets) | *Enviar foto* (upload). Novos campos no form: **Valor atual** (mapeia `current` na criação) e **Status** (Ativa/Concluída). Mantêm emoji, nome, descrição, valor alvo, prazo, tint.
- **Preservado**: Capítulo II "Como acelerar" (SimularPanel/RevisarPanel/AplicarPanel) e Capítulo III "Já atingidas"; `AportarModal` com preview; `MetConfirmDeleteModal`; `EmBreveModal` só nas ações deferidas (Concluir troféu etc. — reavaliar).

### 3.2 Dados / write layer (`assets/fides-store.jsx`)

- `normalizeGoal` passa a mapear `image_url` (→ `cover`) do row.
- `addGoal`/`updateGoal` aceitam `cover`/`image_url` e `current` inicial.
- Status Ativa/Concluída via `completed` boolean já existente (D5). Filtro e pill derivam de `completed`.

### 3.3 Backend Supabase (sensível — security review)

- **Migração schema**: `alter table public.goals add column image_url text;` (nullable). Guarda preset key (`preset:<id>`) OU URL pública do Storage. Espelhar em `supabase/schema.sql`.
- **Storage bucket** `goal-covers`:
  - Leitura: pública (capas não são sensíveis) — confirmar.
  - Escrita/Update/Delete: só o dono (`auth.uid()` = pasta `user_id/`). Policies RLS por path prefix.
  - Validação: content-type imagem, tamanho ≤ 5MB, extensões jpg/png/webp. Nome de arquivo saneado (sem path traversal).
- **Presets bespoke** (D4): bundlados em `assets/covers/*.webp` (servidos estáticos pela Vercel; sem CSP/rede externa). ~16 capas temáticas na paleta tint. Referenciados por key `preset:<id>`.

## 4. Modelo de dados (goals — depois)

```
goals(
  id, user_id, name, description, emoji,
  target, current, monthly_contrib, tint,
  target_date, completed, completed_at, created_at,
  image_url  text   -- NOVO: 'preset:viagem' | 'https://…storage…/user_id/uuid.webp' | null
)
```

## 5. Restrições de identidade

- Hero **só** em Metas (D3). Não tocar no hero da home.
- Tint dirige barra + scrim + acento do card, mesmo com foto → sistema de cor sobrevive.
- Manrope + sage-paper (#F4F5F1) + verde floresta (#2D5A3D). `tokens.css` primeiro CSS carregado (CLAUDE.md).
- React via Babel-standalone: cuidado com Rules of Hooks (hooks declarados antes de qualquer early return — já causou bug na Phase 07).

## 6. Segurança (gate antes de commit em `supabase/`)

- RLS do bucket: dono só escreve/apaga na própria pasta; ninguém sobrescreve capa alheia.
- Upload: validar MIME + tamanho no client E confiar na policy no server; nome de objeto = `user_id/<uuid>.<ext>` (evita colisão e traversal).
- Sem chaves hardcoded; upload usa client Supabase já autenticado (anon key + sessão), não service_role.
- Rodar `security-reviewer` / `/gsd-secure-phase` sobre a migração + policies + fluxo de upload.

## 7. Fora de escopo (YAGNI nesta fase)

- Coluna de status enum com Pausada/Arquivada (D5 usa `completed`).
- Crop/edição de imagem avançada (só upload + fit cover).
- Reordenar metas por drag.
- Concluir meta com fluxo de conquista completo (segue deferido / EmBreve por ora).

## 8. Critérios de sucesso (UAT)

1. Criar meta escolhendo capa da galeria → card renderiza com a capa; persiste no reload.
2. Criar meta enviando foto própria → upload some pro Storage, card mostra a foto; persiste; outro usuário não acessa/escreve o arquivo.
3. Buscar por nome filtra cards; filtro Ativas/Concluídas segmenta corretamente.
4. "Atualizar saldo" inline seta `current` e reflete barra/percentual sem reload; Aportar soma com projeção.
5. Editar meta troca capa/tint/valores; persiste. Excluir remove + apaga capa do Storage (se upload).
6. Hero de Metas visualmente distinto do hero inicial; sem regressão de layout em 400×512 iOS Safari.
7. Sem scroll horizontal no mobile; Rules of Hooks intactas (sem warning no console).

## 9. Referências

- Mockup aprovado: artifact `bdcb8866-d1fa-4f66-be84-17dc8f2b2e30`.
- Código atual: `assets/fides-metas.jsx`, `assets/fides-metas.css`, `assets/fides-store.jsx` (`normalizeGoal` :90), `supabase/schema.sql` (goals :75).
- Fase 07 (CRUD wiring) — base sobre a qual este redesign entra.
