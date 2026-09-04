---
phase: 14-ia-4-bot-whatsapp-via-meta-cloud-api
plan: 04
subsystem: api-auth-ui
tags: [whatsapp, optin, wa-link, jwt, security, perfil, gating]

requires:
  - phase: 14-01
    provides: "wa_link_codes (tabela protegida) + profiles.phone / profiles.wa_linked_at"
  - phase: 13-03
    provides: "Padrão de gate server-side fail-closed por profiles.plan (api/assistant.js:234-262)"

provides:
  - "api/wa-link.js: endpoint autenticado POST que valida JWT, confere profiles.plan (fail-closed), gera código de posse em wa_link_codes e devolve wa_link formatado"
  - "PerfilView em assets/fides-studio.jsx: botão 'Conectar WhatsApp' premium-only (camada 1 de gating) + modal/display de código de posse e link direto wa.me"

affects: [14-05, 14-06 (webhook consome o código para vincular)]

tech-stack:
  added: []
  patterns:
    - "Gating em duas camadas (AC-01): UI oculta ação para free; endpoint server-side valida e retorna 403 se free forçar a chamada"
    - "Service_role pós-gate: client service_role é instanciado somente após autenticação e verificação de plano aprovadas"

key-files:
  created:
    - api/wa-link.js
  modified:
    - assets/fides-studio.jsx

key-decisions:
  - "Código de posse gerado via crypto.randomBytes em formato alfanumérico limpo com TTL de 30 minutos em wa_link_codes"
  - "wa.me link gerado com template pré-preenchido 'Conectar Fides <CODIGO>' consumível no plano 14-06"
  - "PerfilView exibe o código copiável como fallback visual caso o link wa.me não abra o app diretamente"

requirements-completed: [WA-OPTIN-01, WA-GATE-01]

verification:
  - kind: automated
    ref: "node --check api/wa-link.js && syntax pass"
    status: pass
  - kind: structural
    ref: "Checks para JWT_MISSING, PREMIUM_REQUIRED, wa_link_codes, wa.me e Conectar WhatsApp passam 100%"
    status: pass
---

# Phase 14 Plan 04 Summary: Opt-in UI e Endpoint wa-link

## What was built
1. **Endpoint `api/wa-link.js` (commit `2e55d7e`):**
   - Rota `POST /api/wa-link` com proteção `Cache-Control: no-store`.
   - Extrai token Bearer de `Authorization`. Retorna `401 JWT_MISSING` ou `401 JWT_INVALID`.
   - Lê `profiles.plan` de forma fail-closed (default `free`). Retorna `403 PREMIUM_REQUIRED` se não for Pro/Family.
   - Instancia client `service_role` somente após passar no gate para inserir em `wa_link_codes` com validade de 30 minutos.
   - Retorna `{ code, wa_link, expires_at }`.

2. **Interface em `PerfilView` (`assets/fides-studio.jsx`, commit `77347e4`):**
   - Adicionado botão "Conectar WhatsApp" renderizado exclusivamente para usuários `isPremium`.
   - Integração com a sessão Supabase para enviar o token Bearer.
   - Apresentação do código gerado e link clicável `wa.me` para abrir o WhatsApp com a mensagem pré-preenchida.

## Requirements Status
- **WA-OPTIN-01:** Ponta in-app e geração de código entregues e verificadas.
- **WA-GATE-01:** Dupla camada de gating ativa (UI + validação server-side fail-closed).
