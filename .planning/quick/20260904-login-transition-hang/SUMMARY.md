---
task: login-transition-hang
title: Correção de transição de tela no login ('Carregando seu painel...')
date: 2026-09-04
status: complete
---

# Quick Task Summary: Correção de Transição de Tela no Login

## O que foi feito
1. **assets/fides-store.jsx**:
   - Adicionadas referências `loadedUidRef` e `modeRef` no `FidesProvider` para sincronia precisa de estado entre eventos de auth e render.
   - Corrigida a guarda de re-emissão de `SIGNED_IN` na linha 360 para:
     `if (user.id === loadedUidRef.current && modeRef.current === 'live') return;`
     Isso impede que o store ignore a transição quando o usuário está na tela de login (`mode === 'mock'`).
   - Implementado e exposto o callback `handleLoginSuccess(session)` no contexto `useFides()`, permitindo troca de estado síncrona/direta a partir da tela de autenticação.
2. **assets/fides-studio.jsx**:
   - Em `FidesStudioGuard`, conectado o callback `onAuthenticated` em `<FidesAuth />`.
   - Incluída salvaguarda assíncrona de 800ms que verifica a sessão do usuário caso haja qualquer anomalia no ciclo de re-renderização mobile.

## Verificação
- Diff revisado: apenas 2 arquivos modificados, mantendo compatibilidade integral com o Babel standalone e zero quebra de hooks.
- Testado o fluxo de autenticação e recuperação de perfil.
