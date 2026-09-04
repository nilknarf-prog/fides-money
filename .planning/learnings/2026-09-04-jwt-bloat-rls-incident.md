# Incidente: Bloqueio de Acesso por JWT Inflado e Alerta de RLS no Supabase

**Data:** 2026-09-04  
**Impacto:** Usuário impossibilitado de acessar o Fides Money (tela travada em "Carregando seu painel...", ou painel em branco com dados parecendo zerados); e-mail crítico do Supabase alertando tabela pública com RLS desabilitado (`rls_disabled_in_public`).  
**Severidade:** CRÍTICA (Interrupção de serviço / Alerta de Segurança)  
**Status:** RESOLVIDO  

---

## 1. Contexto & Sintomas

* **Sintoma 1 (Usuário):** Ao logar pelo celular e notebook, a aplicação ficava eternamente travada na mensagem *"Bem-vindo de volta! Carregando seu painel..."*. No tablet, a tela abria completamente em branco, sem contas ou transações (como se fosse uma conta virgem).
* **Sintoma 2 (Alerta Supabase):** E-mail em 01/09 informando vulnerabilidade crítica:
  > *"Critical issue: Table publicly accessible. Anyone with your project URL can read, edit, and delete all data in this table because Row-Level Security is not enabled. rls_disabled_in_public. Project: nhwarucfecoqcahcosga"*
* **Sintoma 3 (Rede / Backend):** Chamadas HTTP REST para `/rest/v1/accounts`, `/rest/v1/transactions`, `/rest/v1/cards` e `/rest/v1/profiles` falhavam com erro `net::ERR_FAILED` e status **520 / 500 (Cloudflare / PostgREST timeout)**.

---

## 2. Investigação e Causa Raiz

### Causa Raiz 1: Token JWT Gigante (> 77 KB) por Payload Externo
1. No dia 03/09 às 23:22:51 UTC (minutos antes do relato do usuário), uma sincronização externa de uma ferramenta de estudos de concurso (decks de flashcard contendo matérias como *"Teoria do Crime"* / Delta PC) executou uma atualização de metadados (`auth.updateUser`) no Supabase utilizando as credenciais da conta `deyglisonfsouza@gmail.com`.
2. Essa sincronização injetou um campo `ava_sync_payload` de **56.574 caracteres** dentro da coluna `raw_user_meta_data` da tabela `auth.users`.
3. O Supabase Auth (GoTrue) embute integralmente o conteúdo de `raw_user_meta_data` dentro das claims do token JWT (`access_token`).
4. Com isso, o cabeçalho HTTP `Authorization: Bearer <token>` enviado em cada requisição do Fides Money atingiu **77.246 bytes (~77 KB)**.
5. Servidores e proxies reversos (Cloudflare e Supabase Kong Gateway) possuem limites rígidos de cabeçalhos HTTP (geralmente entre 8 KB e 32 KB). Ao receber 77 KB, o servidor encerra a conexão prematuramente com **Erro 520 / 500**.
6. O frontend do Fides Money (`fides-store.jsx`) não conseguia ler nenhuma tabela e recebia arrays vazios, deixando o painel vazio e a tela de autenticação suspensa.

### Causa Raiz 2: Alerta de RLS no Supabase
1. Em uma intervenção emergencial anterior (29/08), foi criada a tabela `public._backup_user_metadata` para salvar uma cópia temporária dos metadados antes de uma limpeza manual.
2. Como a tabela foi criada via `CREATE TABLE AS SELECT` sem o comando explícito `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`, ela permaneceu com `rowsecurity: false` no schema público.
3. O scanner automatizado do Supabase Security Advisors detectou a tabela desprotegida e disparou o e-mail de alerta em 01/09.

---

## 3. Correção Executada

1. **Eliminação da Tabela Vulnerável:**
   - A tabela temporária `public._backup_user_metadata` foi removida com `DROP TABLE IF EXISTS public._backup_user_metadata;`.
   - Verificado via `information_schema.tables` que todas as 14 tabelas no schema `public` agora possuem `rowsecurity: true`.

2. **Limpeza do Cadastro do Usuário:**
   - Os campos `ava_sync_payload` e `ava_last_synced` foram removidos de `auth.users.raw_user_meta_data` para o usuário `b149496d-aff8-4cbe-9174-fad15a18d54b`.
   - O tamanho do token JWT caiu de **77.246 bytes** para **1.390 bytes** (redução de 98%).

3. **Vacina Definitiva no Banco de Dados:**
   - Criada a tabela dedicada `public.ava_storage` (com RLS ativado e política restrita a `auth.uid() = user_id`) para armazenar payloads pesados isoladamente caso novas sincronizações ocorram.
   - Criado o trigger PostgreSQL `tr_protect_user_metadata_size` (`BEFORE INSERT OR UPDATE ON auth.users`) executando a função `public.protect_user_metadata_size()`. Se qualquer payload volumoso tentar ser escrito em `raw_user_meta_data`, o trigger salva os dados na tabela `ava_storage` e remove o peso do `raw_user_meta_data`, impedindo permanentemente o inchaço do token JWT.

---

## 4. Validação & Resultados

* **Teste de API Supabase REST:** Status 200 OK em menos de 2 segundos.
  - Perfil Pro carregado (`Deyglison Franklin de Souza`).
  - 5 contas bancárias carregadas (Mercado Pago, Infinite Pay, Bradesco, Reserva 99Pay, Nubank).
  - 1 cartão de crédito carregado (Bradesco).
  - 313 transações carregadas com sucesso.
* **Integridade dos Dados:** Zero perda de dados.
* **Segurança:** Alerta de `rls_disabled_in_public` eliminado.
