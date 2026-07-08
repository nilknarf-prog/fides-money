# Phase 12: IA-2 Destravar WRITE no assistente in-app (B8) - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

O gate B8 abre — o chat "Assistente Fides" volta a poder ESCREVER (lançar transação, recategorizar, editar, criar categoria) com confirmação sempre-obrigatória. O cliente já tem as 4 tools WRITE implementadas com card de confirmação (`fides-claude.jsx`) — hoje código morto porque o servidor (`api/assistant.js`) só declara as 2 tools READ (`consultar_saldo`, `consultar_extrato`). Este phase religa `TOOLS_DECLARATION` no servidor + system prompt de escrita com regra de honestidade, e introduz o caminho de insert atômico (`wa_log_transaction`) para a criação de novas transações via chat.

NÃO migra o modal "Nova Transação" (`addTransaction`) para a nova RPC — fica isolado no assistente por decisão explícita (ver Decisions). NÃO adiciona troca de conta/cartão via chat.

</domain>

<decisions>
## Implementation Decisions

### Caminho de insert (lancar_transacao)
- **D-01:** Nova RPC `wa_log_transaction(p_user_id, ...)` SECURITY DEFINER (mesmo padrão de guarda de `pay_card_invoice`) é o único caminho de insert usado por `lancar_transacao`. Ela deve fazer atomicamente o que hoje `addTransaction` faz em passos separados: INSERT da linha + `recalc_account_balance` (conta) + update de `cards.used` (cartão) — hoje esse último é um SELECT+UPDATE manual não-atômico, a RPC corrige isso.
- **D-02:** A RPC é **isolada para o assistente** — não substitui `addTransaction` usado pelo modal "Nova Transação" nesta fase. Migrar o modal ficaria para uma fase de hardening dedicada, fora do escopo aqui (reduz blast radius / risco de regressão em fluxo já estável em produção).

### Caminho de update (recategorizar_transacao / editar_transacao)
- **D-03:** Essas duas tools **continuam usando `updateTransaction` existente** (client update com RLS) — não ganham RPC dedicada. Update simples já é seguro (RLS restringe ao dono); não há mutação incremental de saldo em jogo como no insert.

### Categoria nova durante lançamento
- **D-04:** Se `lancar_transacao` recebe uma categoria que não mapeia na lista fechada, o fluxo vira **1 confirmação só**: o card de confirmação mostra "vou criar categoria X e lançar" — usuário confirma uma vez, servidor cria a categoria (mesma lógica de `criar_categoria`) e lança a transação junto. Não manter o fluxo de 2 passos manuais que existe hoje no client (`resolveWriteToolArgs` retorna erro pedindo para criar categoria primeiro).

### Escopo de editar_transacao
- **D-05:** `editar_transacao` fica restrito a `valor`/`descricao`/`data`/`status` — **NÃO** ganha campo para trocar `conta_ou_cartao` nesta fase. Mover uma transação entre conta/cartão afeta saldo de 2 entidades; fica reservado ao modal do app, onde o usuário vê os 2 saldos lado a lado antes de confirmar. `updateTransaction` (store) já suporta esse patch — só não é exposto pela tool do assistente.

### Rate-limit bypass (fold do todo `ratelimit-bypass-toolresults`)
- **D-06:** `api/assistant.js` conta o gate de `USER_DAILY_LIMIT` só na "primeira chamada do turno" (`isFirstCallOfTurn = !toolResults || toolResults.length === 0`) — qualquer request autenticado que mande um `toolResults` forjado pula o gate inteiro. Fix travado: **nonce assinado stateless (JWT/HMAC curto, exp ~30-60s)**. O servidor emite o nonce junto da resposta que contém `tool_calls`; o request seguinte só pula o gate de rate-limit se apresentar um nonce válido e não-expirado. Sem tabela nova, sem estado no banco — validação é só verificação de assinatura + expiry.
- Esse fix é ainda mais importante agora que o phase abre WRITE: turnos de escrita custam mais que READ, e o bypass sem correção deixaria a cota de 100/dia sem efeito prático em WRITE também.

### Claude's Discretion
- Nome/formato exato do nonce (claim set do JWT, algoritmo HMAC vs assinatura Supabase existente) — pesquisa/planner decide, desde que stateless e expiração curta.
- Estrutura interna da RPC `wa_log_transaction` (parâmetros exatos, nomes) — espelhar `pay_card_invoice` como referência de padrão.

### Folded Todos
- **`ratelimit-bypass-toolresults.md`** (`.planning/todos/pending/ratelimit-bypass-toolresults.md`, severity high, fonte: security-reviewer da fase 11) — bypass do rate-limit via `toolResults` forjado. Fold decidido acima (D-06): fase 12 já reabre `api/assistant.js` para WRITE, bom momento para fechar a brecha junto.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design do épico (fonte da verdade das decisões)
- `.planning/research/whatsapp-e-ia-arquitetura.md` §5 (regra de honestidade, structured parsing — referência para o system prompt de escrita), §6 (insert respeitando modelo derivado — base do `wa_log_transaction`), §7 (UX de confirmação/desambiguação), §B3 "Fase IA-2 · Destravar B8" (escopo oficial deste phase).
- `.planning/ROADMAP.md` — seção "Phase 12: IA-2 Destravar WRITE no assistente in-app (B8)" (Goal, Requirements, UAT = 6 bugs da v7).

### Contexto da fase anterior (padrões a reusar)
- `.planning/phases/11-ia-1-hardening-do-assistente-gemini/11-CONTEXT.md` — módulo Gemini compartilhado (`AI-SHARED-01`), padrão de cooldown, telemetria já gravando tokens/latência.

### Código a modificar
- `api/assistant.js` — `TOOLS_DECLARATION` (:53-91, hoje só READ), `SYSTEM_PROMPT` (:14 tem uma linha dizendo que WRITE está "em manutenção" — precisa trocar quando reativar), gate de rate-limit `isFirstCallOfTurn` (:136, alvo do fix D-06).
- `assets/fides-claude.jsx` — as 4 tools WRITE já implementadas: `TOOLS_REQUIRING_CONFIRMATION` (:17), `resolveWriteToolArgs` (:287-340), `executeWriteTool` (:343-387), `renderConfirmationCard` (:574+). Hoje código morto — validar wiring, ajustar para D-04/D-05.
- `assets/fides-store.jsx` — `addTransaction` (:397-428, caminho atual não-atômico a NÃO tocar por D-02), `updateTransaction` (:452-489, caminho reusado por D-03, já suporta patch de `acct` mas D-05 decide não expor isso na tool).
- `supabase/schema.sql` — localizar onde declarar a nova RPC `wa_log_transaction`; espelhar padrão de `pay_card_invoice` (referenciado em `fides-store.jsx:503-510`).

### Segurança
- CLAUDE.md — `api/` e `supabase/` são caminhos sensíveis: `security-reviewer` + `database-reviewer` obrigatórios antes de commit (RPC nova + rate-limit fix + RLS).
- `.planning/todos/pending/ratelimit-bypass-toolresults.md` — detalhe completo do bypass fold (D-06).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fides-claude.jsx`: as 4 tools WRITE (`lancar_transacao`, `recategorizar_transacao`, `editar_transacao`, `criar_categoria`) + card de confirmação já implementados — trabalho é religar o servidor, não construir do zero.
- `pay_card_invoice` (RPC existente): referência de padrão SECURITY DEFINER + guarda de dono para a nova `wa_log_transaction`.
- `updateTransaction` (store): já cobre patch de status/desc/val/cat/date/acct — reusado tal como está para D-03/D-05.

### Established Patterns
- Saldo sempre derivado (`recalc_account_balance`), nunca mutação incremental — `wa_log_transaction` precisa seguir essa convenção para o INSERT + qualquer ajuste de `cards.used`.
- `mesFaturaFor` (convenção de fechamento) determina o mês de transação de cartão — a nova RPC/tool precisa respeitar isso para `lancar_transacao` em cartão.

### Integration Points
- Servidor (`api/assistant.js`) → Gemini `TOOLS_DECLARATION` → client `fides-claude.jsx` executeTools → confirmação → `executeWriteTool` → (D-01) chama `wa_log_transaction` via `window.fidesDb.rpc(...)` para `lancar_transacao`, ou `updateTransaction`/`addCategory` existentes para as demais 3 tools.

</code_context>

<specifics>
## Specific Ideas

- UAT desta fase = os 6 bugs da v7 que derrubaram o WRITE original, agora como casos de regressão (mês vazio, mês hard-coded, delete sem estorno, cartão inconsistente, toast falso de `criar_categoria`, ⌘K) — travado no ROADMAP, não uma decisão desta discussão.
- Confirmação é SEMPRE obrigatória antes de qualquer insert/update via chat — nenhuma tool WRITE executa direto (regra de honestidade + fricção intencional do produto).

</specifics>

<deferred>
## Deferred Ideas

- **Número da parcela do mês em compras parceladas (transações)** — adendo do usuário durante esta discussão. NÃO faz parte do escopo da fase 12 (que é sobre destravar WRITE no assistente IA, não sobre exibição de transações). Registrado para virar fase própria no roadmap de Transações.
- Migrar o modal "Nova Transação" (`addTransaction`) para usar `wa_log_transaction` também → fase de hardening dedicada, fora do escopo aqui (D-02).
- Trocar conta/cartão de uma transação via chat → fica só no modal do app (D-05).

### Reviewed Todos (not folded)
- `analise-ia-resposta-autocontida.md` — já resolvido pelo commit `e40f7e7` ("fix(11): analise single-shot com resposta autocontida"); arquivo removido de `.planning/todos/pending/` durante esta discussão (não era escopo da fase 12 de qualquer forma — é sobre o modo análise/leitura, não WRITE).

</deferred>

---

*Phase: 12-ia-2-destravar-write-no-assistente-in-app-b8*
*Context gathered: 2026-07-07*
