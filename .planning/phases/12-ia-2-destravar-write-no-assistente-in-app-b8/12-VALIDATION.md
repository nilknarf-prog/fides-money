---
phase: 12
slug: ia-2-destravar-write-no-assistente-in-app-b8
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-07
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> **Reality check:** este projeto NÃO tem test runner (React via Babel-standalone no
> browser, sem bundler/jest/vitest — ver CLAUDE.md). Validação automatizada aqui = asserções
> SQL contra o Supabase **live via MCP** (a verdade do schema) + um script node pontual pro
> nonce (`crypto` nativo). O resto (fluxos de chat WRITE, os 6 bugs da v7) é UAT manual.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — sem test runner no projeto (browser Babel-standalone) |
| **Config file** | none |
| **Quick run command** | asserção SQL pontual via Supabase MCP `execute_sql` (correção da RPC) |
| **Full suite command** | UAT manual via `/gsd-verify-work` (6 casos de regressão da v7) |
| **Estimated runtime** | N/A (manual + SQL ad-hoc) |

---

## Sampling Rate

- **After every task commit:** asserção SQL da RPC afetada (quando a task toca `wa_log_transaction` / saldo / `cards.used`); nonce → rodar o script node de sign/verify/expiry.
- **After every plan wave:** revisar invariantes de saldo derivado no Supabase live (nenhuma conta/cartão fora de `recalc_account_balance`).
- **Before `/gsd-verify-work`:** os 6 casos de regressão da v7 checados manualmente no chat.
- **Max feedback latency:** N/A (validação manual/SQL, não watch-mode).

---

## Per-Task Verification Map

> Populado pelo planner/executor por task. Colunas Threat Ref / Secure Behavior ligam ao
> `<threat_model>` de cada PLAN.md (ASVS L1).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | WRITE-01 (lancar) | T-12-nonce / T-12-rpc | INSERT atômico owner-guard; saldo = recalc | SQL (MCP) | `select wa_log_transaction(...)` + assert balance | ❌ W0 | ⬜ pending |
| TBD | — | — | HONEST-01 | — | baixa confiança → confirmação, nunca chuta | manual | UAT chat | ❌ W0 | ⬜ pending |
| TBD | — | — | DERIVED-SAFE-01 | T-12-rpc | nenhuma mutação incremental de saldo | SQL (MCP) | assert conta/cartão = recalc pós-insert | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Script node pontual `crypto` p/ validar o nonce HMAC (sign → verify → expiry 120s) — sem framework, executável standalone via `node`.
- [ ] Confirmar via Supabase MCP (`list_tables` / `execute_sql`) as colunas reais de `transactions` / `cards` / `accounts` antes de escrever a RPC — `supabase/schema.sql` está comprovadamente stale.

*Não há framework a instalar — este projeto valida por SQL-via-MCP + UAT manual.*

---

## Manual-Only Verifications

Os 6 bugs da v7 que derrubaram o WRITE original, agora casos de regressão (travado no ROADMAP):

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mês da transação de cartão nunca vazio | WRITE-01 | fluxo de chat + UI | lançar em cartão via chat; conferir `mes` preenchido (derivado da data, não do mês exibido) |
| Mês derivado da data real, não hard-coded/`selectedMonth` | WRITE-01 | reencarna FIX-1 (bug P2 ativo no código morto) | lançar em mês ≠ mês exibido; `mes` deve seguir `mesFaturaFor(data)` |
| Delete de transação estorna saldo | DERIVED-SAFE-01 | fluxo app + saldo | deletar transação; conta/cartão volta ao saldo correto |
| Cartão consistente após lançamento | DERIVED-SAFE-01 | saldo de 2 entidades | lançar em cartão; `cards.used` bate com soma real, sem drift |
| criar_categoria: toast só após gravar (sem toast falso) | WRITE-04 | bug P5 ativo (`addCategory` sem `await`) | criar categoria via chat; toast de sucesso só depois do commit no banco |
| ⌘K bloqueado com confirmação WRITE pendente | HONEST-01 | guard de UI novo | abrir card de confirmação; tentar ⌘K → Command Palette não abre até resolver |

---

## Validation Sign-Off

- [ ] Toda task tem asserção SQL (MCP) OU verificação manual documentada (não há `<automated>` runner)
- [ ] Sampling: nenhuma task de RPC/saldo sem asserção SQL correspondente
- [ ] Wave 0 cobre nonce-script + confirmação de schema live via MCP
- [ ] Sem watch-mode (N/A — sem runner)
- [ ] Os 6 casos de regressão da v7 mapeados em Manual-Only
- [ ] `nyquist_compliant: true` set quando o mapa por-task estiver populado

**Approval:** pending
