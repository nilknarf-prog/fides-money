# Painel Admin — Nota LGPD (base legal, minimização, retenção)

**Fase:** 16-painel-admin-backoffice (ADMIN-04)
**Escopo:** superfície `/painel` + `api/admin.js` + `admin_audit_log` (fundação em `supabase/admin-backoffice.sql`)
**Status:** proposta a **ratificar com o dono** no checkpoint humano da Phase 16 (item ainda em aberto — ver seção Retenção)

## 1. Base legal

O painel admin permite que uma conta administrativa dedicada (allowlist `ADMIN_USER_IDS`, nunca a conta pessoal do dono) veja **dados agregados de terceiros** (contas de usuários do Fides Money): e-mail, nome, plano (`free`/`pro`/`family`), contagens de contas/cartões/metas/transações e uso mensal do assistente de IA.

- **Base legal (LGPD art. 7º):** execução de contrato e legítimo interesse do controlador (art. 7º, V e IX) — o tratamento é necessário para operar o produto (suporte, gestão de tier/assinatura, prevenção a abuso), não para finalidade alheia ao serviço contratado pelo usuário.
- **Finalidade explícita e limitada:** administração operacional do produto (listar contas, trocar tier, auditar ações administrativas). Nenhum dado é usado para finalidade secundária (marketing, perfilamento, venda a terceiros).
- **Titular não perde controle:** o painel não expõe lançamentos financeiros individuais nem qualquer dado que o próprio usuário não veria ao usar o app — é uma visão agregada operacional, não um dossiê.

## 2. Minimização (OWASP ASVS V7.1)

O desenho do painel já aplica minimização por construção, não como camada adicional:

- `admin_list_accounts` (RPC `SECURITY DEFINER`) retorna **apenas metadados e contagens agregadas** — `email`, `name`, `plan`, `created_at`, `last_sign_in_at`, `accounts_count`, `cards_count`, `goals_count`, `transactions_count`, `ai_msgs_month`. **Nunca** lançamentos individuais, saldos detalhados, descrições de transação ou conteúdo de mensagens da IA.
- `admin_audit_log` grava metadados da ação administrativa (`admin_id`, `admin_email`, `action`, `target_user`, `before`/`after` **de `plan`**, `reason` texto livre do admin, `ip`, `user_agent`) — nunca segredo, token, senha, ou dado financeiro do usuário-alvo. Isso é reforçado estruturalmente: a única mutação registrada (`admin_set_plan`) só grava o campo `plan` em `before`/`after`, nunca outros dados do perfil.
- O campo `reason` é texto livre digitado pelo próprio admin (não dado do usuário-alvo) — o painel front-end deve escapar/renderizar como texto puro (nunca `innerHTML` cru), conforme já registrado como carry-forward de segurança do 16-02 para o 16-03.
- Nenhum dado sensível (CPF, senha, token, chave de API) transita pela superfície admin em nenhum momento — confirmado por leitura de `admin-backoffice.sql` (schema da tabela e RPCs) e `api/_lib/admin/*.js` (handlers).

## 3. Retenção do audit log (`admin_audit_log`)

**LGPD não fixa um prazo numérico** para retenção de logs de acesso a dado pessoal (art. 15 define os eventos que encerram o tratamento; art. 16 trata da eliminação após o fim do tratamento, com exceções). A prática de mercado citada para logs de acesso é um mínimo de ~6 meses, sem teto máximo legal fixo, desde que documentado e com finalidade clara.

**Proposta (a ratificar com o dono):**

- **Retenção: 2 anos** a partir de `created_at` — dentro da faixa aceitável (acima do mínimo prático de mercado de ~6 meses, sem violar nenhum prazo máximo legal, pois não há um fixado).
- **Expurgo: manual** — sem job/cron automático nesta fase (MVP). O dono roda uma exclusão pontual via SQL Editor (`delete from admin_audit_log where created_at < now() - interval '2 years'`) quando decidir aplicar o expurgo. Nenhuma automação foi implementada nesta fase (fora de escopo do MVP; um job agendado fica registrado como item de fase 2 se o volume justificar).
- **Justificativa:** o audit log é append-only por design (`grant select, insert` apenas, sem `update`/`delete` para `service_role` — ver `supabase/admin-backoffice.sql`), então mesmo o expurgo manual exige acesso direto ao banco (SQL Editor/owner), não pelo painel — reduz risco de um admin comprometido apagar o próprio rastro.

**Esta retenção (2 anos, expurgo manual) é uma decisão de produto, não uma pendência técnica — precisa ser confirmada explicitamente pelo dono no checkpoint humano da Phase 16 (Task 3 do plano 16-04). Até a ratificação, tratar como proposta.**

## 4. Padrão seguido — OWASP ASVS 4.0 V7 (Error Handling and Logging)

- **V7.1** — nenhum segredo/credencial/PII desnecessária é logada. `admin_audit_log` guarda só metadados operacionais e o delta de `plan` (não dado financeiro do usuário-alvo).
- **V7.2** — toda ação administrativa que passa o guard grava exatamente **uma** linha em `admin_audit_log`, **sucesso E falha**: leituras (`whoami`/`list_accounts`/`view_audit`), tentativas inválidas (`set_plan` com input inválido, método errado, action desconhecida → `status='error'`) e o `set_plan` bem-sucedido (via RPC, com before/after). Isso também alimenta o rate-limit geral, que conta linhas na janela — por isso toda requisição pós-guard precisa deixar rastro. Falhas de autenticação/allowlist são logadas como `denied_access` (com throttle anti-flood). **Exceção deliberada:** o bloqueio `429 RATE_LIMITED` do rate-limit geral **não** grava linha — logá-lo amplificaria o próprio flood que ele contém (sob ataque sustentado, cada 429 geraria uma linha). As ~30 linhas/janela que precedem o 429 já registram a rajada, e o throttle de `denied_access` cobre flood por não-admins.
- **V7.3** — o log é protegido contra acesso/modificação não autorizada: `admin_audit_log` tem RLS habilitado com **zero policies** + `REVOKE ALL` de `anon`/`authenticated`, e só `service_role` (via `api/admin.js`, sempre pós-guard) tem `SELECT`/`INSERT` — nunca `UPDATE`/`DELETE`, nem para `service_role`.

## 5. Direitos do titular (LGPD art. 18)

Pedidos de acesso/correção/exclusão de dados por titulares (usuários do Fides Money) continuam sendo atendidos pelo caminho já documentado no ROADMAP (SQL Editor/backlog `auth.admin`) — este MVP do painel **não introduz** um fluxo de atendimento a titulares, apenas a ferramenta operacional de gestão de conta/tier para o admin. Fluxos de exclusão de conta continuam fora de escopo do MVP (nada destrutivo entra nesta fase — banir/excluir/reset senha ficam gateados em B12/staging).

---
*Referências: LGPD (Lei 13.709/2018) arts. 7º, 15, 16, 18; ANPD — Perguntas Frequentes 5.5; OWASP ASVS 4.0 V7 (https://github.com/OWASP/ASVS/blob/master/4.0/en/0x15-V7-Error-Logging.md).*
*Fonte de pesquisa: `.planning/phases/16-painel-admin-backoffice/16-RESEARCH.md` §"LGPD e retenção — pesquisa externa".*
