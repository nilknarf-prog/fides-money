---
tipo: demanda-contexto
status: nao-planejado
titulo: "Painel de administração / backoffice do Fides Money"
criado: 2026-07-16
origem: "Sessão /gsd-execute-phase 13 — usuário relatou impossibilidade de testar tiers free/pro sem um painel de controle"
destino: "Insumo para uma sessão dedicada de planejamento (outro chat). NÃO planejar nem implementar a partir deste doc sozinho."
areas: [auth, supabase, serverless, backoffice, seguranca, observabilidade, billing]
relacionados:
  - ".planning/phases/13-ia-3-gating-premium-in-app/ (gating premium via profiles.plan — GATE-01/02/03)"
  - "supabase/profiles-plan-privileges.sql (13-02 — REVOKE/GRANT column-level em profiles.plan)"
  - ".planning/todos/pending/2026-07-16-assistente-modais-write-stale-acumulados.md (bug WRITE não relacionado, mas do mesmo domínio IA in-app)"
  - "ROADMAP B10 (schema real no banco), B11 (migrar p/ Vite/Next), B12 (staging/prod)"
---

# Demanda: Painel de administração / backoffice do Fides Money

> **STATUS: DEMANDA CAPTURADA — NÃO PLANEJADA.**
> Este documento registra o *contexto e a intenção* da demanda para que, numa sessão dedicada,
> seja traçado um plano detalhado e completo. Ele **não é** um plano, uma spec fechada, nem uma
> decisão de arquitetura. As capacidades listadas são **candidatas / material bruto** para
> discussão — não um escopo travado.

## 1. Por que surgiu (gatilho imediato)

Durante a verificação da Phase 13 (gating premium via `profiles.plan`), o usuário constatou que
**não consegue testar bem as funções free/pro** porque não há nenhuma interface para controlar o
tier das contas. Hoje o único jeito de alternar `profiles.plan` é rodar SQL manual no **Supabase
SQL Editor** (owner/`service_role` ignora a trava de coluna do 13-02) — ver a nota de teste em
memória `testar-tier-free-pro`. Isso é frágil, não escala e não serve para suporte/operação real.

A demanda, porém, é **maior que "trocar o tier"**: o usuário quer um **painel de controle de
background ("admin/backoffice")** com login específico de administrador, onde possa ver as contas
cadastradas, mudar status, e "**tudo mais que um app desse porte precisa ter em termos de painel
de controle**". Este doc captura esse escopo amplo.

## 2. O núcleo pedido explicitamente

- **Acesso restrito a administrador** — login/rota separada, não acessível a usuário comum.
- **Listar as contas cadastradas** (usuários) com informação essencial.
- **Mudar o status/tier de cada conta** (free ↔ pro ↔ family) — o driver imediato de testabilidade
  e de suporte.

## 3. Escopo amplo — o que um backoffice deste app tende a precisar

> Enumerado como **candidatas** para o plano futuro decidir o que entra/sai e em que ordem
> (MVP vs. incrementos). Não é compromisso de escopo.

### A. Gestão de contas / usuários
- Listar `profiles`: email, `plan`, data de criação, última atividade, `name`.
- Buscar/filtrar por email, tier, atividade.
- Ver detalhe de uma conta: nº de contas/cartões, metas, volume de transações (agregado,
  respeitando privacidade — evitar expor lançamentos individuais sem base legal).
- **Alternar tier** (free/pro/family) — com trilha de auditoria.
- Suspender / reativar / banir conta.
- Resetar senha, reenviar convite (via Supabase Auth Admin API).
- Excluir conta (direito ao esquecimento — LGPD).

### B. Billing / assinaturas (converge com o M6 — checkout Mercado Pago/Pix, R$ 89,90/ano)
- Ver status de assinatura/pagamento por conta.
- Conceder/estender premium manualmente (cortesia, trial, suporte, reembolso).
- Histórico de pagamentos; cancelamentos e reembolsos.
- (Hoje o `UpgradeModal` da Phase 13-04 aponta para um checkout que ainda não existe — o painel
  e o billing do M6 são temas irmãos.)

### C. Observabilidade / métricas de produto
- Contadores: total de usuários, free, premium, ativos (DAU/MAU).
- Funil de conversão free → premium.
- Uso do assistente IA: `assistant_usage` (msgs/mês por conta, quem bate o cap de 10/mês).
- Telemetria Gemini (custo, taxa de erro) — conecta com AI-TELEM-01 (Phase 11).
- Volume agregado de transações/metas (produto, anonimizado).

### D. Suporte / moderação
- Ver erros/incidentes recentes por usuário.
- (Opcional, sensível) "login-as"/impersonar para suporte — **exige** audit log robusto e
  provavelmente confirmação forte; alto risco.
- Canal de feedback/tickets, se houver.

### E. Operação / configuração sem deploy
- Feature flags (ligar/desligar recursos por tier ou globalmente).
- Ajustar caps (ex.: limite free de 10 msg/mês) sem novo deploy.
- Broadcast/avisos (novo recurso, manutenção).
- Rotação/gestão de segredos operacionais (ex.: `ASSISTANT_NONCE_SECRET`).

### F. Segurança & auditoria (transversal — condição de existência, não "feature")
- **Autorização server-side com `service_role`** em funções serverless dedicadas
  (`api/admin/*`). A chave `SUPABASE_SERVICE_ROLE_KEY` **NUNCA** pode chegar ao client.
- **Audit log de toda ação admin**: quem, quando, o quê, valor antes/depois.
- Autenticação de admin forte e separada (role dedicada + idealmente MFA).
- Rate limiting / proteção da superfície admin; RLS com bypass admin controlado.

## 4. Restrições e riscos que o plano futuro TEM que respeitar

> Estes não são opcionais — herdam de decisões já tomadas no projeto.

1. **Não reabrir o buraco que a Phase 13-02 fechou.** A 13-02 aplicou `REVOKE/GRANT` column-level
   em `profiles.plan` justamente para impedir que `authenticated` altere o próprio tier via client
   SDK. Um painel admin que mude tier **pelo client** reabriria essa brecha. Toda mutação admin
   (mudar plan, banir, conceder premium) **deve** passar por um caminho servidor com `service_role`,
   nunca pelo SDK no browser. Este é o ponto de segurança mais crítico da demanda.
2. **Caminho sensível = revisão de segurança obrigatória.** Por CLAUDE.md, mexer em `api/` ou
   `supabase/` exige revisão de segurança antes de commitar (auth, RLS, chaves/env). Um backoffice
   é a maior superfície de ataque do produto — auth, autorização, audit e proteção de dados de
   terceiros (LGPD) são de primeira classe.
3. **Sem build step hoje.** O front atual é HTML + React via Babel-standalone no browser, sem
   bundler/lint/types (débito ROADMAP B11). Um painel admin pode ser o gatilho natural para
   finalmente migrar para Vite/Next, **ou** ser um app/deploy isolado. Decisão de arquitetura a
   tomar no plano.
4. **Verdade do schema vive no banco** (ROADMAP B10 — `supabase/*.sql` pode estar desatualizado;
   fonte é o MCP Supabase). Levantar o schema real de `profiles`/`assistant_usage`/auth antes de
   desenhar.
5. **Deploy hoje é push direto na `main` → Vercel, sem staging** (ROADMAP B12). Um painel com poder
   destrutivo (banir, excluir, mudar billing) reforça a necessidade de staging/prod separados.

## 5. Perguntas em aberto (a resolver no /gsd-discuss-phase ou /gsd-spec-phase futuro)

- **Onde vive o admin?** Rota `/admin` no mesmo app · app/deploy separado · low-code (Retool /
  Appsmith / Supabase Studio custom) vs. build próprio. Trade-off: velocidade vs. controle/custo.
- **Como um admin é identificado?** Coluna/role `admin` em `profiles` · allowlist de emails ·
  custom claim no Supabase Auth. MFA sim/não.
- **Backend:** novas serverless functions `api/admin/*` com `service_role`, com autorização e
  audit em cada endpoint. Como proteger e testar essa superfície.
- **Escopo do MVP:** o mínimo viável é provavelmente "listar contas + trocar tier + audit log" —
  o que resolve o gatilho imediato (testabilidade/suporte). Billing, feature flags, métricas viram
  incrementos.
- **LGPD:** base legal para admin ver dados financeiros de terceiros; minimização; retenção do
  audit log.

## 5.1. Uso downstream explícito — fechar UATs de 12 e 13 pelo painel

Decisão do usuário (2026-07-16): os UATs humanos pendentes das **Phase 12** (4 UATs WRITE in-app)
e **Phase 13** (5 UATs gating free/pro) **não** serão rodados via Supabase SQL Editor. Ficam
adiados para serem executados **através deste painel**, alternando o tier (free↔pro) direto na UI
do Fides. Ou seja: a capacidade "listar contas + trocar tier" do MVP do painel é o que destrava o
fechamento formal das Phases 12 e 13 (cujo código já está live e verificado estruturalmente —
Phase 13 em 16/16 must-haves). Construir a 16 valida a 13 na prática (exercita a mesma trava).

## 6. Nota tática para AGORA (enquanto o painel não existe)

Para testar free/pro sem o painel: alternar `profiles.plan` via **Supabase SQL Editor**
(`update profiles set plan = 'pro' where id = '<uuid>'`; owner/`service_role` ignora a trava de
coluna do 13-02). Ver memória `testar-tier-free-pro`. F5 no app recarrega o tier (`useFides()` lê
`profiles.plan` fail-closed — Phase 13-01/13-03).

## 7. O que este documento NÃO é

- Não é um plano GSD nem uma SPEC — não deriva tasks/waves.
- Não trava arquitetura (rota vs. app separado vs. low-code está em aberto).
- Não estende o escopo da Phase 13 nem de 14/15.

**Próximo passo (sessão dedicada, outro chat):** usar este contexto como entrada para
`/gsd-discuss-phase` → `/gsd-spec-phase`/`/gsd-plan-phase` de uma nova fase "Backoffice/Admin",
ou registrá-la no ROADMAP via `/gsd-phase add`.
