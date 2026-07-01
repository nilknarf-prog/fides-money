# Phase 07: CRUD Metas - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

A view de Metas deixa de ser read-only: o usuário **cria, edita, exclui e lista** metas (nome, valor-alvo, prazo) com persistência real na tabela `goals`, e a lista reflete o estado atual do banco sem reload de página (META-01/02/03/04).

**Fora do escopo (deferido M5+):** aportes/contribuição, acompanhamento de progresso (valor atual vs alvo), ajuste de plano, e **imagem de capa por meta**. Os modais `Aportar`/`AjustarPlano`(como calculadora de plano) permanecem placeholder para essas funções futuras.

</domain>

<decisions>
## Implementation Decisions

### Prazo / Schema (`goals`)
- **D-01:** `goals` **não tem** coluna de data-alvo hoje. Adicionar coluna **`target_date`** via MCP `apply_migration` + espelho em `supabase/schema.sql` (regra PROJECT.md §4: nunca assumir schema — verificar via MCP antes).
- **D-02:** Tipo **`DATE`** (dia cheio, `YYYY-MM-DD`), input `type=date` nativo (iOS Safari). Sem parsing custom de texto.
- **D-03:** Coluna **nullable** — meta sem prazo é permitida (ex: reserva de emergência contínua). UI mostra "sem prazo" quando null.
- **D-04:** Validação: form **bloqueia data < hoje** (`min={hoje}` no input). Prazo deve ser futuro.
- **D-05:** `normalizeGoal` ([assets/fides-store.jsx:90](../../../assets/fides-store.jsx#L90)) passa a mapear `target_date` → campo de prazo da UI (hoje só deriva `criadaEm` de `created_at`).

### Campos do formulário CRUD
- **D-06:** Campos do form v1.1 = **nome, valor-alvo (`target`), prazo (`target_date`), emoji, cor (`tint`)**.
- **D-07:** **Remover** o campo "valor atual" (`current`) do form. Ao criar, `current = 0` (default do schema). Editar `current` manualmente = território de aportes/progresso (deferido) e violaria o Princípio dos Insights ("nunca número que engana").
- **D-08:** **Remover** o campo "contribuição mensal" (`monthly_contrib`) do form. Fica `0` (default). É base de aportes/ajuste-de-plano → M5+.
- **D-09:** **Manter emoji + cor (`tint`)** no form — ambos já têm coluna no schema e persistem; dão identidade visual aos cards (custo baixo, valor de UX).

### Descrição
- **D-10:** `goals` **não tem** coluna descrição (`normalizeGoal` força `descricao: ''`). Adicionar coluna **`description text` nullable** na **mesma migration** do `target_date`. Form persiste; `normalizeGoal` mapeia.

### Store — camada de escrita (falta hoje)
- **D-11:** Adicionar **`addGoal` / `updateGoal` / `deleteGoal`** ao FidesProvider, **espelhando o padrão `addAccount`/`updateAccount`/`deleteAccount`** ([assets/fides-store.jsx:508-566](../../../assets/fides-store.jsx#L508)): modo live → insert/update/delete em `goals` + `await refreshData(userId)`; modo mock → mutação otimista do estado local. Expor no context value ([assets/fides-store.jsx:~1253](../../../assets/fides-store.jsx#L1253)) e no fallback do `useFides`.
- **D-12:** Mapeamento UI→DB na escrita: `nome→name`, `alvo→target`, prazo→`target_date`, `emoji→emoji`, `tint→tint`, descrição→`description`. (Inverso do `normalizeGoal`.)

### Modais
- **D-13:** **Modal dedicado de criação** (`CriarMetaModal` novo) — separado do de edição. "Nova meta" hoje abre o placeholder `EmBreveModal` ([assets/fides-metas.jsx:82](../../../assets/fides-metas.jsx#L82), [:800](../../../assets/fides-metas.jsx#L800)); passa a abrir o `CriarMetaModal`.
- **D-14:** Editar reusa/ajusta o `AjustarPlanoModal` existente ([assets/fides-metas.jsx:184](../../../assets/fides-metas.jsx#L184)) — precisa **remover** campos `atual`/`contribuição` e **adicionar** `prazo`/`descrição`. Wiring do item "Editar meta" ([assets/fides-metas.jsx:800](../../../assets/fides-metas.jsx#L800)) deixa de abrir `EmBreveModal`.
- **D-15:** Delete reusa o `MetConfirmDeleteModal` existente ([assets/fides-metas.jsx:270](../../../assets/fides-metas.jsx#L270)), conectado a `deleteGoal`.
- **D-16:** Todos os modais devem usar `useModalClose` (padrão travado desde fase 04/06) — já é o caso nos modais existentes de Metas.

### Claude's Discretion
- Estratégia de atualização da lista: seguir o padrão existente (`refreshData` refetch após mutação em modo live; otimista em mock). Planner confirma.
- Empty state ao carregar sem metas: já existe (`goals.length === 0` → empty state em [assets/fides-metas.jsx:706](../../../assets/fides-metas.jsx#L706)) — não regredir.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos & escopo
- `.planning/REQUIREMENTS.md` — META-01/02/03/04 (o que persiste + listagem live); seção "Out of Scope" (fonte do valor atual, aportes, imagem).
- `.planning/ROADMAP.md` §"Phase 07: CRUD Metas" — goal, success criteria, notas de escopo.

### Schema & invariantes
- `supabase/schema.sql` §"TABELA: goals" (linha ~73) — schema atual de `goals` (**verificar via MCP `apply_migration` antes de migrar — regra PROJECT.md**).
- `.planning/PROJECT.md` §3 (stack: Vercel Functions CommonJS; front sem bundler) e §4 (arquivos protegidos: `fides-data.jsx`; regra de schema via MCP + espelho; regra de ouro 400×512px iOS Safari).

### Código a tocar
- `assets/fides-store.jsx` — `normalizeGoal` (L90), `refreshData` goals query (L200), padrão `addAccount/updateAccount/deleteAccount` (L508), context value (L~1253) e fallback `useFides` (L~1301).
- `assets/fides-metas.jsx` — modais `AjustarPlanoModal` (L184), `MetConfirmDeleteModal` (L270), `EmBreveModal` (L604), `MetasStudio` wiring (L634+).
- `assets/fides-metas.css` — estilos dos modais/cards de metas.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Leitura live já pronta:** `goals` é carregado de `goals` via `refreshData`→`normalizeGoal` e entregue pelo `useFides()`. A view já renderiza metas reais — só falta escrita.
- **Padrão CRUD do store:** `addAccount`/`updateAccount`/`deleteAccount` ([assets/fides-store.jsx:508](../../../assets/fides-store.jsx#L508)) é o molde exato para `addGoal`/`updateGoal`/`deleteGoal` (live insert/update/delete + `refreshData`; mock otimista).
- **Modais existentes:** `AjustarPlanoModal` (form de edição completo), `MetConfirmDeleteModal` (confirmação de exclusão) — reaproveitáveis com ajuste de campos.
- **`useModalClose`** (`window.FidesUI.useModalClose`) — hook padrão de saída animada, já usado em todos os modais de Metas.

### Established Patterns
- Escrita em modo live sempre: `insert/update/delete` no Supabase → `await refreshData(userId)` (refetch), sem otimismo em live. Mock = otimista local.
- Mudança de schema: MCP `apply_migration` + espelho em `supabase/*.sql`. Nunca assumir schema.
- Feature só "pronta" se funciona em **400×512px iOS Safari**.

### Integration Points
- `FidesProvider` context value (L~1253) e fallback do `useFides` (L~1301) — expor os 3 novos mutations.
- `MetasStudio` (L634+) — trocar os `setEmBreve(true)` de "Nova meta"/"Editar meta" pelos modais reais + conectar delete.
- Migration única adicionando `target_date DATE` + `description text` (ambos nullable) em `goals`.

</code_context>

<specifics>
## Specific Ideas

- Usuário quer que metas de viagem, no futuro, tenham **imagem de capa** (ex: foto de avião/ilha) — desejo explícito, mas fora do escopo v1.1 (ver Deferred).
- Prazo em datas longas é comum (ex: "12/2030") — daí `target_date` nullable e sem obrigatoriedade.

</specifics>

<deferred>
## Deferred Ideas

- **Imagem de capa por meta** — usuário quer poder anexar foto (avião/ilha para "Viagem" etc.). Requer coluna nova + **Supabase Storage** (bucket, RLS, upload), componente de upload em 400×512px iOS, resize/otimização. Candidata a **fase própria em M5**, junto de aportes/progresso. Na v1.1 a identidade visual fica com emoji + cor.
- **Aportes / valor atual (`current`) / contribuição mensal (`monthly_contrib`) / ajuste de plano** — colunas já existem no schema mas ficam nos defaults (0) nesta fase. Editar `current` manualmente foi rejeitado (violaria Princípio dos Insights). → M5+ (META-05/06/07).

None — discussion stayed within phase scope (idea de capa capturada e redirecionada acima).

</deferred>

---

*Phase: 07-crud-metas*
*Context gathered: 2026-07-01*
