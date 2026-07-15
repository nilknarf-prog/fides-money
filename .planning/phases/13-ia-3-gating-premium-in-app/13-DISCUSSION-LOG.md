# Phase 13: IA-3 Gating premium in-app - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 13-ia-3-gating-premium-in-app
**Areas discussed:** Enforcement + WRITE do free

---

## Enforcement + WRITE do free

### Onde mora o gate premium do WRITE/IA?

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side (assistant) + UI no front | api/assistant.js lê profiles.plan e só expõe tools WRITE se premium; front esconde a UI. Dupla camada, não burlável. | ✓ |
| Só no front (store) | Store esconde/desabilita WRITE p/ free. Simples mas burlável via API direta. | |
| Gate no banco (RLS/RPC) | Regra no Supabase barra INSERT por tier. Arriscaria quebrar o INSERT manual do free. | |

**User's choice:** "Não sei" → Claude recomendou **Server-side (assistant) + UI no front** com base em: WRITE tools executam no cliente (Phase 12), então o gate limpo é o assistant não emitir a tool p/ free; RLS descartado por compartilhar o INSERT manual. Usuário confirmou.
**Notes:** CLAUDE.md exige revisão de segurança em api/ — reforça o gate server-side.

### Regressão: o que acontece com o WRITE-via-IA do free (Phase 12 abriu p/ todos)?

| Option | Description | Selected |
|--------|-------------|----------|
| Corte limpo agora | Free perde WRITE-via-IA já; app manual continua 100%. | ✓ |
| Aviso + corte | Banner avisando antes de cortar. | |
| Grandfather temporário | Existentes mantêm por um prazo. | |

**User's choice:** Corte limpo agora.
**Notes:** Intencional (funil de conversão), barato pré-lançamento sem base paga real.

### Fallback quando profiles.plan é null/desconhecido?

| Option | Description | Selected |
|--------|-------------|----------|
| Fail-closed → trata como free | null/erro → sem premium. Nunca libera por acidente. | ✓ |
| Fail-open → trata como premium | null → libera. Vaza premium se o fetch falhar. | |

**User's choice:** "Não sei" → Claude recomendou **Fail-closed** (gate de segurança nunca libera por acidente). Usuário confirmou.
**Notes:** —

### Como o dev testa premium sem o checkout do M6?

| Option | Description | Selected |
|--------|-------------|----------|
| plan='pro' no Supabase p/ conta dev | UPDATE manual. Zero código, zero backdoor. | ✓ |
| Override via env/config | Flag DEV_FORCE_PREMIUM. Código extra + risco de vazar p/ prod. | |
| Allowlist de email | Emails dev = premium. Backdoor no código. | |

**User's choice:** "Não sei, preciso de ajuda" → Claude recomendou **UPDATE profiles SET plan='pro'** na conta dev (e 'free' p/ testar degustação). Usuário confirmou.
**Notes:** Sem env flag e sem allowlist para não introduzir brecha em caminho sensível.

---

## Claude's Discretion

- Mecânica exata do cap free (número, janela, storage do contador) — dentro de ~10 msg/mês (research D-5); preferência por contador server-side.
- Comportamento do paywall (soft vs hard, onde aparece, copy) — usar fides-ui.
- Alvo da tela de upgrade dado que o checkout do M6 não existe (placeholder/notify/link).

## Deferred Ideas

- Tier de marketing "premium" distinto de `pro` interno — mantido `pro` (research D-4).
- Reviewed todo não incorporado: `ratelimit-bypass-toolresults.md` (hardening do assistant, não gating).
