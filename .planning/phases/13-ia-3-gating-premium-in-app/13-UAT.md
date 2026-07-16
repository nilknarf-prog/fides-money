---
status: testing
phase: 13-ia-3-gating-premium-in-app
source: [13-VERIFICATION.md]
started: "2026-07-16T21:50:00Z"
updated: "2026-07-16T21:50:00Z"
---

## Current Test

number: 1
name: UAT direto do fix CR-01 — free pedindo "lança 50 no mercado" nunca abre o card
expected: |
  Logado como conta free, pedir no chat "lança 50 no mercado". O assistente NUNCA abre o
  card de confirmação de WRITE — recusa em texto apontando para o Premium (2 camadas: se o
  Gemini tentar a tool_call, o servidor responde 403 PREMIUM_REQUIRED antes do relay; se por
  algum motivo relayasse, o cliente bloqueia antes do card). Como pro, o mesmo pedido abre o
  card normalmente (regressão limpa da Phase 12).
awaiting: user response

## Tests

### 1. UAT direto do fix CR-01 — free pedindo "lança 50 no mercado" nunca abre o card
expected: Free → o card de confirmação de WRITE NUNCA abre; recusa em texto apontando Premium (servidor 403 antes do relay + guard cliente redundante). Pro → o card abre normalmente (Phase 12 intacta).
result: [pending]

### 2. 403 forçado na Análise da IA como free
expected: Logado como free, forçar `fetch('/api/assistant', {..., mode:'analysis'})` no console → resposta `403 PREMIUM_REQUIRED` sem chamada ao Gemini. Como pro, funciona normalmente.
result: [pending]

### 3. Free bate no cap de 10 msg/mês (11ª mensagem)
expected: Como free, enviar 10 mensagens de chat READ no mês; a 11ª retorna `429 FREE_MONTHLY_LIMIT`.
result: [pending]

### 4. Free vs. pro no Perfil + parse sem erro
expected: Free vê badge "Free" + CTA que abre `UpgradeModal`; pro vê badge "Premium", sem CTA. App carrega sem erro de parse do Babel-standalone.
result: [pending]

### 5. Trava live de `profiles.plan` (regressão futura)
expected: `authenticated` não consegue elevar o próprio `plan` via client SDK (`window.fidesDb.from('profiles').update({plan:'pro'})` falha/no-op); owner/service_role via SQL Editor segue alternando o tier. Já confirmado uma vez no apply da Plan 13-02 — reconfirmar se houver mudança no banco.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
