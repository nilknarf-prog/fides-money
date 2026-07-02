# Phase 8: Metas vision-board redesign - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning
**Source:** PRD Express Path (docs/superpowers/specs/2026-07-02-metas-vision-board-design.md)

<domain>
## Phase Boundary

Elevar a área de **Metas** do Fides ao nível de um "vision board" (cards com capa/foto, busca, filtro por status, update inline), **mantendo a identidade editorial Fides** (hero editorial Manrope, capítulos I/II/III, sistema de tint por meta, tips "Como acelerar", modal Aportar com projeção). Funções do PlannerFin são absorvidas e melhoradas dentro da linguagem Studio — não é reprodução.

Entra sobre a base da Phase 07 (CRUD Metas wiring). Toca frontend (`assets/fides-metas.jsx` + `.css`), write layer (`assets/fides-store.jsx`) e backend Supabase (migração `goals.image_url`, bucket `goal-covers` com RLS, presets bespoke). Backend em `supabase/` ⇒ **revisão de segurança obrigatória antes de commit** (CLAUDE.md).

**Mockup aprovado:** artifact `bdcb8866-d1fa-4f66-be84-17dc8f2b2e30`.
</domain>

<decisions>
## Implementation Decisions

### D1 — Estratégia de imagem
- **Galeria curada + upload próprio**, ambos nesta fase (não faseado).

### D2 — Direção de layout
- **Editorial-first**: identidade Fides domina; funções do PlannerFin absorvidas, não copiadas.

### D3 — Hero
- Hero **exclusivo da área de Metas** (`met-hero`). Classe própria. **NÃO** reutilizar/mesclar/herdar o hero inicial da home (`stu-hero`). Backdrop = colagem sutil (mask) das capas para diferenciar do hero da home.

### D4 — Fonte dos presets  *(resolvido pós-pesquisa 2026-07-02: SVG, não .webp)*
- **Capas bespoke geradas** (texturas/gradientes na paleta tint), bundladas em `assets/covers/`, servidas estáticas pela Vercel (sem CSP/rede externa). ~16 capas temáticas. Referenciadas por key `preset:<id>`.
- **Formato = `.svg`** (revisão de D4): o ambiente não tem encoder `.webp` (sem `cwebp`/`imagemagick`). SVG gradiente/textura é zero-tooling, nítido em qualquer DPI, minúsculo, editável e on-brand. Mesmo contrato `preset:<id>`; muda só a extensão (`assets/covers/<id>.svg`).

### D5 — Modelo de status
- **Ativa / Concluída** reusando a coluna `completed` (boolean) já existente. **Sem coluna nova de status** nesta fase. Filtro e pill derivam de `completed`.

### D6 — Update inline
- Manter **os dois** fluxos: **Aportar** (soma + projeção — extra Fides) e **Atualizar saldo** (seta `current` direto — parity PlannerFin).

### Frontend (`assets/fides-metas.jsx` + `assets/fides-metas.css`)
- `met-hero`: eyebrow "vision board · N metas em curso", headline "Você guardou R$X para os seus sonhos" (Manrope display, itálico no destaque), lede narrativa, strip (Guardado / Aporte mensal / Próxima a chegar).
- **Barra de controles** (nova): busca por nome/descrição (filtro client-side) + filtro segmentado de status (Todas / Ativas / Concluídas) + botão "Nova meta". Estado local no `MetasStudio`.
- **Cards vision-board** (`vcard`) substituem `met-card`: capa 186px (imagem preset OU upload + scrim gradiente; fallback = gradiente tint quando sem capa), overlay (pill status, chip emoji, nome display, descrição), corpo (valor atual grande `de R$alvo`, barra de progresso no tint + glow, `%` + "faltam R$X", 2 stats), hover/tap revela ícones editar/excluir + quick "Atualizar saldo" inline + ações Aportar / Ajustar plano.
- **Modais**: `CriarMetaModal` e `AjustarPlanoModal` ganham **seletor de capa** com abas *Galeria* (grid presets) | *Enviar foto* (upload). Novos campos: **Valor atual** (mapeia `current` na criação) e **Status** (Ativa/Concluída). Mantêm emoji, nome, descrição, valor alvo, prazo, tint.
- **Preservado**: Capítulo II "Como acelerar" (SimularPanel/RevisarPanel/AplicarPanel), Capítulo III "Já atingidas", `AportarModal` com preview, `MetConfirmDeleteModal`.

### Data / write layer (`assets/fides-store.jsx`)
- `normalizeGoal` passa a mapear `image_url` (→ `cover`) do row.
- `addGoal` / `updateGoal` aceitam `cover`/`image_url` e `current` inicial.
- Status Ativa/Concluída via `completed` boolean existente (D5).

### Backend Supabase (sensível — security review obrigatória)
- **Migração schema**: `alter table public.goals add column image_url text;` (nullable). Guarda `preset:<id>` OU URL pública do Storage. Espelhar em `supabase/schema.sql`.
- **Storage bucket `goal-covers`**: leitura **pública confirmada** (capas não sensíveis; objetos com nome UUID não-listáveis, listing gated por RLS — client usa `getPublicUrl`); escrita/update/delete só do dono (`auth.uid()` = pasta `user_id/`), policies RLS por path prefix; validação content-type imagem, tamanho ≤ 5MB, extensões jpg/png/webp, nome saneado (sem path traversal).
- Nome de objeto = `user_id/<uuid>.<ext>` (evita colisão + traversal).
- Upload usa client Supabase autenticado (anon key + sessão), **nunca** `service_role`. Sem chaves hardcoded.

### Identidade (restrições)
- Hero **só** em Metas (D3); não tocar no hero da home.
- Tint dirige barra + scrim + acento do card mesmo com foto → sistema de cor sobrevive.
- Manrope + sage-paper (#F4F5F1) + verde floresta (#2D5A3D). `tokens.css` = primeiro CSS carregado (CLAUDE.md).
- React via Babel-standalone: **Rules of Hooks** — hooks declarados antes de qualquer early return (já causou bug na Phase 07).

### Resoluções pós-pesquisa (2026-07-02) & gaps herdados da Phase 07
- **D4 → SVG** (acima): presets em `.svg`, não `.webp`.
- **Bucket `goal-covers` → leitura pública** confirmada (nomes UUID; write/delete owner-only).
- **Verificação RLS ao vivo (checkpoint humano):** `supabase/schema.sql` pode estar defasado (ROADMAP B10) e o MCP Supabase precisou de auth na pesquisa. A 1ª onda deve incluir um `checkpoint:human-verify` para confirmar RLS de `goals` ao vivo (MCP autenticado ou Supabase Dashboard) antes/junto de aplicar a migração + as policies do bucket.
- **GAP Phase 07 #1 — `normalizeGoal` não mapeia `completed`/`completed_at`** (string ausente em `fides-store.jsx`/`fides-metas.jsx`): D5 (filtro Ativas/Concluídas + Capítulo III "Já atingidas") é no-op silencioso sem isso. **Corrigir nesta fase** (mapear + ligar o "Marcar como concluída" a `updateGoal`).
- **GAP Phase 07 #2 — `AportarModal` é dead code**: componente completo (`fides-metas.jsx:89-181`) nunca montado; botão "Aportar" abre `EmBreveModal` (`:957`). D6 exige montá-lo e ligar a `updateGoal({ current })`. **Corrigir nesta fase.**
- **`.stu-hero` é classe compartilhada** (Dashboard/Contas/Metas — `fides-studio.jsx:216`, `fides-contas.jsx:720`, `fides-metas.jsx:825`): D3 → renomear só o wrapper externo em `fides-metas.jsx` p/ `met-hero` + novo bloco CSS em `fides-metas.css`; **não** tocar `.stu-hero` em `fides-studio.css`.

### Claude's Discretion
- Estrutura interna dos componentes React (`vcard`, barra de controles, seletor de capa) desde que respeite classes/identidade acima.
- Nomes de helpers, organização de CSS, aparência exata das ~16 capas bespoke.
- Detalhe de implementação do filtro client-side e do estado local no `MetasStudio`.
- Estratégia de teste/validação (definida pela pesquisa + planner).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design source of truth
- `docs/superpowers/specs/2026-07-02-metas-vision-board-design.md` — spec completa (decisões D1–D6, escopo, modelo de dados, segurança, UAT). Este CONTEXT deriva dela.

### Código atual a modificar/respeitar
- `assets/fides-metas.jsx` — UI atual de Metas (`MetasStudio`, `met-card`, modais, capítulos I/II/III).
- `assets/fides-metas.css` — estilos atuais de Metas.
- `assets/fides-store.jsx` — write layer; `normalizeGoal` (~:90), `addGoal`/`updateGoal`.
- `supabase/schema.sql` — tabela `goals` (~:75). NOTA: MCP Supabase é a verdade; schema.sql pode estar defasado (ROADMAP B10) — espelhar a migração aqui.
- `tokens.css` — primeiro CSS carregado; paleta tint/identidade.

### Base anterior
- `.planning/phases/07-crud-metas/` — CRUD Metas wiring (PLANs, CONTEXT, PATTERNS, VERIFICATION, UAT). Fase sobre a qual este redesign entra; fonte do bug de Rules of Hooks a evitar.
</canonical_refs>

<specifics>
## Specific Ideas

### Modelo de dados (goals — depois da migração)
```
goals(
  id, user_id, name, description, emoji,
  target, current, monthly_contrib, tint,
  target_date, completed, completed_at, created_at,
  image_url  text   -- NOVO: 'preset:viagem' | 'https://…storage…/user_id/uuid.webp' | null
)
```

### Presets
- ~16 capas bespoke **`.svg`** (gradiente/textura) na paleta tint, em `assets/covers/`, servidas estáticas (sem rede externa / CSP). Key `preset:<id>`. (Formato SVG resolvido pós-pesquisa — ver D4.)

### Success Criteria (UAT — do spec §8)
1. Criar meta escolhendo capa da galeria → card renderiza com a capa; persiste no reload.
2. Criar meta enviando foto própria → upload vai pro Storage, card mostra a foto; persiste; outro usuário não acessa/escreve o arquivo.
3. Buscar por nome filtra cards; filtro Ativas/Concluídas segmenta corretamente.
4. "Atualizar saldo" inline seta `current` e reflete barra/percentual sem reload; Aportar soma com projeção.
5. Editar meta troca capa/tint/valores; persiste. Excluir remove + apaga capa do Storage (se upload).
6. Hero de Metas visualmente distinto do hero inicial; sem regressão de layout em 400×512 iOS Safari.
7. Sem scroll horizontal no mobile; Rules of Hooks intactas (sem warning no console).
</specifics>

<scope_fence>
## Scope Fence (NÃO fazer nesta fase)

- Coluna de status enum com Pausada/Arquivada (D5 usa `completed`).
- Crop / edição de imagem avançada (só upload + fit cover).
- Reordenar metas por drag.
- Fluxo de conquista completo ao concluir meta (segue deferido / `EmBreveModal` por ora).
- Tocar no hero da home (`stu-hero`) — D3 proíbe.
- Adicionar coluna de status nova no `goals`.
</scope_fence>

<deferred>
## Deferred Ideas

- Status enum (Pausada/Arquivada), crop de imagem, drag-reorder, fluxo de troféu/conquista — todos YAGNI nesta fase (spec §7).
</deferred>

---

*Phase: 08-metas-vision-board-redesign*
*Context gathered: 2026-07-02 via PRD Express Path (design spec)*
