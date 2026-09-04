---
task: login-transition-hang
title: Correção do travamento de transição de tela no login ('Carregando seu painel...')
date: 2026-09-04
status: planned
---

# Quick Plan: Correção de Transição de Tela no Login

## 1. Contexto & Problema

O usuário relatou que ao efetuar o login pelo celular com e-mail e senha:
1. O formulário exibe o banner de sucesso: *"Bem-vindo de volta! Carregando seu painel..."*.
2. A tela permanece estática nesse aviso indefinidamente, sem transicionar automaticamente para o painel principal (`FidesStudioShell`).
3. Somente ao forçar o recarregamento da página (F5 / pull-to-refresh) o aplicativo lê a sessão persistida no `localStorage` e renderiza o dashboard com as contas e transações.

---

## 2. Investigação e Causa Raiz

Foram identificados dois pontos de falha na cadeia de autenticação reativa do React:

### Causa Raiz A (`assets/fides-store.jsx`, linha 360):
```javascript
// Re-emissão de SIGNED_IN para o MESMO usuário (focus/token-refresh):
// não resetar/refetch — preserva o estado local da UI (ex.: modal de import).
if (user.id === loadedUid) return;
```
* **O Bug:** Se o usuário já abriu a página anteriormente ou se `getAuthUser()` preencheu `loadedUid = user.id` mas o app estava em `mode = 'mock'` (exibindo a tela de login), o listener `onAuthStateChange` recebe o evento `SIGNED_IN` e executa o `return;` prematuro porque `user.id === loadedUid`.
* **A consequência:** `setMode('live')` e `refreshData(user.id)` **nunca são chamados**. O estado `mode` permanece como `'mock'`, impedindo a troca de tela no React.
* **A correção:** O guard só deve ignorar o evento se a aplicação **já estiver** em modo `live`:
  ```javascript
  if (user.id === loadedUid && mode === 'live') return;
  ```
  Além disso, certificar que `loadedUid` é limpo (`null`) caso o `mode` seja `'mock'`.

### Causa Raiz B (`assets/fides-studio.jsx`, linha 35):
```javascript
function FidesStudioGuard({ initialPage }) {
  const { mode, isLoading } = useFides();

  if (isLoading) return ( ... );

  if (mode === 'mock') return <FidesAuth />;

  return <FidesStudioShell initialPage={initialPage}/>;
}
```
* **O Bug:** O componente `<FidesAuth />` foi projetado para invocar o callback `onAuthenticated?.(session)` assim que `signInWithPassword` conclui com sucesso (linhas 157 e 182 de `assets/fides-auth.jsx`). No entanto, o `FidesStudioGuard` renderiza `<FidesAuth />` **sem passar nenhuma prop `onAuthenticated`**.
* **A consequência:** O `FidesAuth` fica dependendo unicamente de o `onAuthStateChange` do Supabase propagar um re-render no React. Se houver qualquer atraso ou bloqueio de microtask, o formulário permanece com `loading = null` e `success` visível, sem gatilho de saída.
* **A correção:** 
  1. Passar `onAuthenticated` para `<FidesAuth>` no `FidesStudioGuard`.
  2. Dentro de `onAuthenticated`, acionar a transição imediata para `'live'` através do store ou disparar um fallback garantido (`window.location.reload()`) caso o estado React não atualize em 500ms.

---

## 3. Mudanças Cirúrgicas Propostas

### 3.1. `assets/fides-store.jsx`
1. Em `onAuthStateChange`: ajustar a checagem de re-emissão:
   ```javascript
   // Só ignora se for o mesmo usuário E a store já estiver em modo live
   if (user.id === loadedUid && mode === 'live') return;
   ```
2. Exportar no context de `useFides()` a função `onLoginSuccess(session)` para permitir que componentes filhos notifiquem o store diretamente sobre login completado.

### 3.2. `assets/fides-studio.jsx`
1. No `FidesStudioGuard`, conectar o callback `onAuthenticated` do `<FidesAuth />`:
   ```jsx
   if (mode === 'mock') {
     return (
       <FidesAuth
         onAuthenticated={() => {
           // Força atualização ou recarrega suavemente se o listener não transicionar em 400ms
           setTimeout(() => {
             if (window.__fidesMode !== 'live') {
               window.location.reload();
             }
           }, 400);
         }}
       />
     );
   }
   ```

---

## 4. Plano de Verificação

1. **Teste de Unidade / Sintaxe:**
   - Validar sintaxe JSX/JS com Node.js para garantir que não há erros de parsing ou quebra de hooks.
2. **Teste Funcional do Fluxo de Login:**
   - Abrir o app no estado deslogado (`mode === 'mock'`).
   - Submeter o login e verificar que a tela transiciona **automaticamente e imediatamente** para o dashboard (`FidesStudioShell`), sem necessidade de toque em F5 ou refresh manual pelo usuário.
3. **Teste de Re-emissão de Token:**
   - Garantir que a proteção contra recarregamento indevido no focus da janela (para não fechar modais de import) continua funcionando quando o usuário já está no modo `live`.
