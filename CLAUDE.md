# CLAUDE.md — Fides Money

Instruções para o Claude Code neste repositório. Estas regras têm precedência sobre comportamento padrão.

## Stack

- Frontend: HTML + React via **Babel-standalone** no browser (sem build step). Sem bundler/lint/types hoje (débito rastreado: ROADMAP B11 → migrar p/ Vite/Next).
- Backend: **Supabase** (Postgres + Auth + RLS + RPCs). Schema real vive no banco; `supabase/*.sql` pode estar desatualizado (a verdade é o MCP Supabase — ROADMAP B10).
- Serverless: `api/assistant.js` (Gemini 2.5 Flash-Lite, tools **READ-only** — WRITE proibido até fundação validada, ROADMAP B8), `api/inject-config.js` (injeta env vars).
- Deploy: **push direto na `main` → Vercel auto-deploy**. Sem Staging/Production hoje (ROADMAP B12). Commit + push o mais automático possível.

## Orquestração — REGRA PRINCIPAL

**Um orquestrador só: o GSD é a espinha do projeto.** O estado vive em `.planning/` (PROJECT, ROADMAP, STATE, phases, milestones, learnings).

- **Use GSD** para o fluxo: `/gsd-plan-phase`, `/gsd-execute-phase`, `/gsd-verify-work`, roadmap, milestones.
- **Use ECC apenas como ferramenta pontual DENTRO das fases do GSD** — nunca como orquestrador paralelo.
  - Reviews: agents `typescript-reviewer` (cobre o JS), `database-reviewer` (Supabase/Postgres), `security-reviewer`.
  - Utilidades: `/ecc:security-scan`, `/ecc:hookify`, `/ecc:skill-create`, `/ecc:cost-report`.
- **NÃO use os orquestradores do ECC** (duplicam o GSD e brigam pelo estado): `orch-*`, `prp-*`, `multi-*`, `epic-*`, `gan-*`, `loop-*`.

Se tiver que escolher UM orquestrador: **GSD** (o projeto inteiro já está modelado nele).

## Segurança — caminhos sensíveis

Ao tocar em `api/` ou `supabase/`, rode revisão de segurança antes de commitar (auth, RLS, RPCs `pay_card_invoice`/`transfer_funds`, chaves/env, superfície do assistente IA). Um hook em `.claude/settings.json` injeta lembrete automático nesses paths.

- Env vars ficam na aba **Project** do Vercel (não Preview/Production separadas). `tokens.css` deve ser o primeiro CSS carregado.
- Nunca commitar segredos. `inject-config.js` é a ponte de config — não hardcode chaves.

## Convenções

- Movimentação vs despesa: compra = despesa; pagamento de fatura = movimentação (`is_transfer`). Transferência via `transfer_funds` + `transfer_group`.
- Dashboard live = `DashboardStudio`. UI base = `fides-ui` (`ConfirmDialog`/`Toast`/`useConfirm`) — evitar `confirm()`/`alert()` residuais (ROADMAP B9).
- React via Babel-standalone: cuidado com **Rules of Hooks** (já causou bug na Phase 07).
