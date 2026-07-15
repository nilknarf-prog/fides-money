# Phase 13: IA-3 Gating premium in-app - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

O app passa a gatear capacidades pelo **tier real** de `profiles.plan` (`free|pro|family`), substituindo o mock `USER.plan:'Pro'` (`fides-data.jsx:31`). Premium = `plan <> 'free'` (usa `pro`, zero migração). Free = degustação de IA (chat READ limitado, sem WRITE) como funil de conversão. Premium = chat completo + WRITE-via-IA + Análise da IA ilimitada dentro dos caps. Inclui paywall suave (PAYWALL-01) + tela de upgrade que aponta para o checkout do M6.

Requirements: GATE-01 (store lê plan real), GATE-02 (free degustação limitada), GATE-03 (premium libera WRITE/IA), PAYWALL-01.

</domain>

<decisions>
## Implementation Decisions

### Enforcement & Segurança do Gate (discutido nesta fase)
- **D-01:** O gate premium do WRITE/IA mora **server-side em `api/assistant.js`** — o endpoint lê `profiles.plan` e só expõe/emite as tools WRITE quando premium — **mais** uma camada de UI no front que esconde/desabilita as ações premium. Dupla camada, não burlável via chamada direta à API. Gate no banco (RLS/RPC) foi **descartado**: o app manual compartilha o mesmo caminho de INSERT, gatear ali arriscaria quebrar o fluxo manual do free.
- **D-02:** **Fail-closed.** Quando `profiles.plan` vier `null`, com erro de leitura ou valor desconhecido, trata como **free** — nunca libera premium por acidente. Custo aceito: usuário legítimo pode cair na degustação num bug raro de leitura; o oposto (vazar premium) é pior para um gate de segurança.
- **D-03:** **Corte limpo agora** para a regressão. Ao ligar o gate real, usuários `free` perdem o WRITE-via-IA que a Phase 12 abriu para todos; o **app manual continua 100%**. Intencional — é o funil de conversão — e barato pré-lançamento (sem base paga real). Sem grandfather, sem período de transição.
- **D-04:** Teste de dev/premium sem o checkout do M6: **`UPDATE profiles SET plan='pro'`** (e `'free'` para testar degustação) na conta de dev direto no Supabase. Zero código, **sem** env flag, **sem** allowlist de email, **sem** backdoor no app — nada que possa vazar para prod em caminho sensível.

### Carregado das decisões já fechadas (research 2026-07-06 — NÃO re-decidir)
- **premium = `plan <> 'free'`**, usando a coluna `pro` que já existe (research D-4, zero migração).
- **Free = degustação de chat READ, ~10 msg/mês, sem WRITE** (research D-5) — funil de conversão.
- **Precificação P-2:** free (app manual completo) + premium R$ 89,90/ano (IA + WhatsApp + análises). Preço pago único mantido.

### Claude's Discretion
As demais gray areas ficam a critério de research/planner (dentro das decisões acima):
- **Mecânica exata do cap free** — número exato (~10 msg/mês baseline D-5), janela (mês calendário vs rolling 30d), onde o contador vive (coluna/tabela no Supabase vs local), o que conta como 1 msg, reset. Preferência: contador server-side (coerente com o gate server-side D-01).
- **Comportamento do paywall (PAYWALL-01)** — soft vs bloqueio duro ao bater o cap/tentar WRITE; onde aparece (modal, banner inline no chat, tela dedicada); tom da copy. Usar `fides-ui` (`ConfirmDialog`/`Toast`) — evitar `confirm()`/`alert()`.
- **Alvo da tela de upgrade** — para onde aponta já que o checkout do M6 não existe (placeholder "em breve" / notify-me / link externo). Não travar a entrega da fase nessa dependência.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Gating & precificação (fonte da verdade das decisões)
- `.planning/research/whatsapp-e-ia-arquitetura.md` §4 (gating por tier, dupla camada), §B3 (Fase IA-3), §B4 (precificação P-2), §10 (custo/sustentação), e bloco "Decisões RESOLVIDAS 2026-07-06" (D-4 nomenclatura de tier, D-5 degustação free) — decisões locked que esta fase implementa.
- `.planning/ROADMAP.md` — Phase 13 goal + requirements (GATE-01/02/03, PAYWALL-01), Depends on Phase 12.
- `.planning/REQUIREMENTS.md` — mapeamento Phase 13.

### Schema & segurança
- `supabase/schema.sql` (coluna `profiles.plan` `free|pro|family`, ~linha 14) — **atenção:** o schema real vive no banco (MCP Supabase é a verdade; `supabase/*.sql` pode estar desatualizado — ROADMAP B10). Confirmar a coluna via MCP antes de implementar.
- `CLAUDE.md` — regra de segurança em `api/` (rodar revisão antes de commitar), gate B8 do WRITE, convenções `fides-ui`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fides-store.jsx:330,364,1032+` — fetch de `profiles` hoje faz `select('name, group_targets')` e **não lê `plan`**. GATE-01 = adicionar `plan` ao select e expor no estado do store como fonte da verdade do tier.
- `fides-data.jsx:31` — mock `USER = { … plan: 'Pro' }`. Fonte falsa atual do tier — a remover/substituir pela leitura real do store.
- `api/assistant.js` — tools WRITE (`lancar`/`recategorizar`/`editar`/`criar_categoria`), reabertas na Phase 12 (gate B8). Ponto do gate server-side (D-01): ler `plan` e condicionar a exposição/emissão das tools WRITE.
- `fides-ui.jsx` — `ConfirmDialog`/`Toast`/`useConfirm` para paywall/avisos (evitar `confirm()`/`alert()` residuais — ROADMAP B9).

### Established Patterns
- WRITE tools executam **no cliente com confirmação obrigatória** (Phase 12); logo o gate server-side = o assistant **não emite** a tool WRITE para free (o modelo nem recebe a capacidade), não depende só da UI.
- `profiles.plan` já existe (`free|pro|family`) — gating por tier sem migração (research D-4).

### Integration Points
- Store lê `plan` → propaga para o shell/UI do assistente (esconde WRITE/IA premium no front) e para a tela de upgrade.
- `api/assistant.js` lê `plan` server-side para decidir tools WRITE e (futuro/discretion) aplicar o cap de degustação do free.

</code_context>

<specifics>
## Specific Ideas

- Semântica canônica: **premium = `plan <> 'free'`** (usar `pro`). Free é o valor `'free'`.
- Gate deve ser **defense-in-depth**: server (assistant) decide capacidade, front decide visibilidade. Nunca só front.

</specifics>

<deferred>
## Deferred Ideas

- Nomear um tier de marketing "premium" distinto de `pro` interno — decidido manter `pro` (research D-4); revisitar só se surgir tier família real (P-3, M-família).
- Detalhes finos de cap/paywall/upgrade estão em Claude's Discretion acima; se crescerem, viram sub-decisões no plan-phase, não nova fase.

### Reviewed Todos (not folded)
- `ratelimit-bypass-toolresults.md` (área `api/assistant.js`, score 0.2) — trata de bypass de rate limit via toolresults; é hardening do assistant, **não** gating de tier. Considerado e não incorporado; endereçar em hardening do assistente, não aqui.

</deferred>

---

*Phase: 13-ia-3-gating-premium-in-app*
*Context gathered: 2026-07-14*
