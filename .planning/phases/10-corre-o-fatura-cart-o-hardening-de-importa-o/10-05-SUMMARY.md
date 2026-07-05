---
phase: 10-corre-o-fatura-cart-o-hardening-de-importa-o
plan: 05
subsystem: store/auth
tags: [auth, supabase, onAuthStateChange, idempotencia, import-modal]
requires:
  - assets/fides-store.jsx (useEffect de auth)
  - assets/fides-supabase.js (autoRefreshToken:true)
provides:
  - guarda por user-id no listener onAuthStateChange (ignora re-emissões SIGNED_IN do mesmo usuário)
affects:
  - Transacoes / ImportPreviewModal (estado local preservado no focus/token-refresh)
tech-stack:
  added: []
  patterns:
    - "closure loadedUid dentro do useEffect ([] deps) para idempotência do refetch de auth"
key-files:
  created: []
  modified:
    - assets/fides-store.jsx
decisions:
  - "Guarda implementada como variável de closure `loadedUid` dentro do useEffect (deps []) em vez de React.useRef — sem novo hook, persiste por toda a vida do listener (opção sugerida pelo plano)."
  - "Early-return `if (user.id === loadedUid) return;` colocado como primeira instrução do ramo SIGNED_IN/INITIAL_SESSION; `loadedUid` é atribuído ao final do fluxo completo (login/troca) e zerado no logout."
metrics:
  duration: ~5min
  completed: 2026-07-05
status: complete
---

# Phase 10 Plan 05: Guarda por user-id no onAuthStateChange Summary

Fecha G6 (MAJOR) do 10-UAT: alternar aba/minimizar o Chrome não reseta mais o modal de import nem recarrega a lista, ao ignorar re-emissões de `SIGNED_IN` do mesmo usuário no `onAuthStateChange`.

## What Was Built

Uma guarda por user-id no `React.useEffect` de auth em `assets/fides-store.jsx`:

- **Closure `loadedUid`** declarada logo após `let mounted = true;` — rastreia o último usuário efetivamente carregado. Como o effect tem deps `[]`, a variável persiste por toda a vida do listener.
- **Set inicial** no `getAuthUser().then`: `loadedUid = user.id;` após `setUserId(user.id)`.
- **Guarda no handler** `onAuthStateChange`, ramo `INITIAL_SESSION || SIGNED_IN`: `if (user.id === loadedUid) return;` como primeira instrução — re-emissões do mesmo usuário (focus/token-refresh, causadas por `autoRefreshToken:true` em fides-supabase.js:38) não disparam `setTransactions([])`/`setAccounts([])`/`setCards([])`/`setGoals([])`, `refreshData` nem o fetch de profile. `loadedUid = user.id;` é atribuído ao final do fluxo completo.
- **Logout** (`else`): `loadedUid = null;` além do `resetToMock()` existente, para que um novo login volte a carregar.

`mounted` guard e o cleanup `subscription?.unsubscribe?.()` permanecem intactos. Nenhuma mudança em tokens/escopo/RLS — puramente idempotência do refetch.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Guarda por user-id no onAuthStateChange | 0c13b86 | assets/fides-store.jsx |

## Verification

- Automated (plano): `guard true resetStillPresent true braces true` — guarda presente, reset ainda dentro do handler para o caso de troca de usuário, chaves balanceadas.
- Sem build/lint (Babel-standalone no browser): checagem estática de chaves via node passou.

Verificação humana pendente (runtime, requer app deployado + sessão logada):
- Abrir modal de import com linhas selecionadas → trocar de aba >1s → voltar: modal continua aberto com as mesmas seleções; lista não pisca "carregando".
- Logout + login: dados recarregam normalmente (guarda não bloqueia troca real de sessão).
- Console sem ciclos repetidos de "[Fides] Store: modo live — userId:" ao alternar abas.

## Deviations from Plan

None - plan executed exactly as written.

## Threat Surface

Sem nova superfície. Registro do plano coberto:
- T-10-05-01 (Spoofing/troca de usuário): guarda compara `user.id`; quando o id MUDA, o fluxo completo (reset + refetch + profile) roda — só re-emissões do MESMO id são ignoradas.
- T-10-05-02 (Elevation/logout): ramo de logout mantém `resetToMock()` e zera `loadedUid`.
- Zero pacotes novos.

## Self-Check: PASSED
- FOUND: assets/fides-store.jsx
- FOUND commit: 0c13b86
