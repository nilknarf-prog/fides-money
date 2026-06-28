# Fides Money — Relatório Geral de Progresso

> Documento master consolidado a partir dos relatórios estratégicos v2–v18.
> Gerado em 28/06/2026. Último commit em `origin/main`: `dfd640e`.

---

## ÍNDICE

1. [Identidade do Projeto](#1-identidade-do-projeto)
2. [Stack Técnica (Imutável)](#2-stack-técnica-imutável)
3. [Arquitetura de Arquivos](#3-arquitetura-de-arquivos)
4. [Infraestrutura Supabase](#4-infraestrutura-supabase)
5. [Design Tokens](#5-design-tokens)
6. [Regras iOS Obrigatórias](#6-regras-ios-obrigatórias)
7. [Padrão de Dropdown (iOS-safe)](#7-padrão-de-dropdown-ios-safe)
8. [Estado Global — useFides()](#8-estado-global--usefides)
9. [Modelo de Dados de Transações](#9-modelo-de-dados-de-transações)
10. [Modelo de Movimentação de Dinheiro (is_transfer)](#10-modelo-de-movimentação-de-dinheiro-is_transfer)
11. [Arquitetura de Saldo Derivado](#11-arquitetura-de-saldo-derivado)
12. [Componentes UI Globais (fides-ui)](#12-componentes-ui-globais-fides-ui)
13. [Fluxo de Trabalho com o Claude Code](#13-fluxo-de-trabalho-com-o-claude-code)
14. [Cronologia Completa por Versão](#14-cronologia-completa-por-versão)
15. [Decisões Arquiteturais Travadas](#15-decisões-arquiteturais-travadas)
16. [Estado Atual do App (pós v18)](#16-estado-atual-do-app-pós-v18)
17. [Fila de Implementação (prioridade)](#17-fila-de-implementação-prioridade)
18. [Lições Operacionais Consolidadas](#18-lições-operacionais-consolidadas)
19. [Skills de Design Mapeadas](#19-skills-de-design-mapeadas)
20. [Roadmap de Longo Prazo](#20-roadmap-de-longo-prazo)

---

## 1. Identidade do Projeto

| Campo | Valor |
|---|---|
| **Nome** | Fides Money |
| **Categoria** | App de finanças pessoais · PT-BR |
| **URL de produção** | https://fides-money.vercel.app |
| **URL demo (sem login)** | https://fides-money.vercel.app/teste |
| **Repositório** | https://github.com/nilknarf-prog/fides-money |
| **Supabase project_id** | `nhwarucfecoqcahcosga` |
| **Supabase URL** | https://nhwarucfecoqcahcosga.supabase.co |
| **Usuário real** | Deyglison Franklin de Souza · deyglisonfsouza@gmail.com |
| **Deploy** | Push em `main` → Vercel automático (~2 min) |
| **Viewport canônico** | **400×512px iOS Safari** (mobile-first; escala para desktop) |
| **Working tree autenticado** | `/home/user/fides-money` — NUNCA push de clones em `/tmp` |
| **Último commit** | `dfd640e` (Lote E — tendência por R$ real) |
| **Status** | App em produção · em fase friends-and-family · Insights do mês entregues |

---

## 2. Stack Técnica (Imutável)

Esta stack é definitiva. Não alterar sem decisão explícita do Deyglison.

| Camada | Tecnologia |
|---|---|
| **Runtime** | React 18 via Babel standalone (SPA single-file, sem bundler/npm no front) |
| **CSS** | Puro, organizado por componente (`fides-X.css`), design tokens em `tokens.css` |
| **Fontes** | Manrope (display) + JetBrains Mono (números) |
| **Entry autenticado** | `index.html` — rota `/` — carrega Supabase + todos os `.jsx` e `.css` |
| **Entry demo** | `Fides-app.html` — rota `/teste` — dados mockados, sem login, **congelado para sempre** |
| **Responsividade** | `assets/fides-responsive.css` — mobile-first, carregada por último |
| **Backend** | Supabase (PostgreSQL + Auth + RLS) |
| **IA in-app** | Google Gemini 2.5 Flash-Lite via `api/assistant.js` (modo só-leitura, sob demanda) |
| **Serverless** | Vercel Serverless Functions (`api/*.js` — CommonJS `module.exports`, nunca ESM) |
| **Deploy** | Vercel — push em `main` = deploy automático |

**Regra de ouro:** toda feature nova deve funcionar perfeitamente em **400×512px iOS Safari** antes de qualquer push. Se não funciona no iOS, não está pronto.

---

## 3. Arquitetura de Arquivos

### Estrutura atual do repo

```
index.html                    ← entry autenticado (rota /)
Fides-app.html                ← entry demo (/teste) — NÃO TOCAR JAMAIS
vercel.json                   ← rotas: /fides-config.js → serverless, /teste → Fides-app.html, /* → index.html
api/
  inject-config.js            ← serverless CommonJS → window.FIDES_CONFIG (env vars)
  assistant.js                ← serverless CommonJS → Gemini Flash-Lite + tools READ-ONLY
supabase/
  schema.sql                  ← schema base (parcialmente desatualizado — MCP é a verdade)
  derived-balance.sql         ← RPCs de saldo derivado (v16)
  fix-delete-transaction.sql  ← RPC atômico de delete (v7/v8)
  category-limits.sql         ← tabela category_limits (v8/v9)
  fix-delete-transfer.sql     ← atualiza delete RPC p/ transferências (v9)
assets/
  tokens.css                  ← PROTEGIDO — design tokens · DEVE SER O PRIMEIRO CSS DO index.html
  fides.css                   ← estilos base globais
  fides-responsive.css        ← camada mobile-first (carregada por último)
  fides-studio.css            ← layout shell + masthead + sidebar + PerfilView
  fides-auth.jsx              ← tela de auth (design final; Apple OAuth removido)
  fides-auth.css              ← estilos da tela de auth
  fides-data.jsx              ← PROTEGIDO — mocks + Icon + helpers + CATEGORY_TINTS + mesFaturaFor + isCardId
  fides-store.jsx             ← React Context (useFides) — FONTE DA VERDADE em live
  fides-supabase.js           ← window.fidesDb + window.fidesAuth + waitForAuth()
  fides-studio.jsx            ← orquestrador + roteamento + DashboardStudio + PerfilView + ToastViewport
  fides-dashboard.jsx         ← componente Dashboard — FALLBACK do /teste, NÃO renderiza em live
  fides-transacoes.jsx        ← página Transações + NovaTransacaoModal + EditTxModal + bulk actions
  fides-transacoes.css        ← classes fds-tx-v2-* e fds-tx-adv-*
  fides-transacoes-bulk.css   ← ⚠️ CSS possivelmente dead (148 linhas, classes fdt-bulk-*) — avaliar antes de remover
  fides-orcamento.jsx         ← página Planejamento (limites, PlnResumo, PlnMesInsights, computeInsights)
  fides-orcamento.css         ← estilos do Planejamento
  fides-contas.jsx            ← página Contas & Cartões + PagarFaturaModal
  fides-contas.css            ← estilos da página Contas
  fides-metas.jsx             ← página Metas (somente leitura — CRUD não implementado)
  fides-metas.css             ← estilos da página Metas
  fides-claude.jsx            ← Assistente Fides (Gemini só-leitura)
  fides-claude.css            ← estilos do assistente
  fides-ui.jsx                ← ConfirmDialog + Toast + useToast + useConfirm (global via window.FidesUI)
  fides-ui.css                ← estilos dos componentes UI
  fides-charts.jsx            ← PROTEGIDO — componentes de gráfico
  fides-shell.jsx             ← componente de shell (sidebar, etc.)
  fides-diario.jsx            ← 🔴 A REMOVER — versão descartada do Studio, nunca conectada à nav
  fides-diario.css            ← 🔴 A REMOVER — identidade cream/gold incompatível, 439 linhas
  design-canvas.jsx           ← PROTEGIDO
  tweaks-panel.jsx            ← PROTEGIDO
  banks/                      ← SVGs dos bancos (simple-icons + fallback iniciais)
```

### Arquivos protegidos — NUNCA editar sem aprovação prévia

| Arquivo | Motivo |
|---|---|
| `fides-data.jsx` | Constantes globais, Icon, helpers, CATEGORY_TINTS, mesFaturaFor, isCardId. Excepcionalmente editado em v11 (BUG-FATURA) com permissão explícita. |
| `fides-charts.jsx` | Componentes de gráfico — não tocar |
| `tokens.css` | Fonte de verdade de design tokens — estado "No limite" foi para `fides-orcamento.css` justamente por isso |
| `design-canvas.jsx` | Canvas interno de design |
| `tweaks-panel.jsx` | Painel de ajustes interno |
| `Fides-app.html` | Entry point demo congelado — é a rota /teste |

### Detalhe crítico de roteamento

> Dashboard renderizado em **modo live** = `DashboardStudio` dentro de `fides-studio.jsx`.
> O componente `Dashboard` em `fides-dashboard.jsx` **NÃO é usado em live** — é fallback do `/teste`.
> Esse mal-entendido custou um lote inteiro no passado (v5).

### Ordem de carregamento de CSS no index.html

```
1. assets/tokens.css          ← OBRIGATORIAMENTE PRIMEIRO
2. assets/fides.css
3. assets/fides-studio.css
4. assets/fides-store.css
5. assets/fides-orcamento.css
6. assets/fides-contas.css
7. assets/fides-metas.css
8. assets/fides-claude.css
9. assets/fides-ui.css
10. assets/fides-transacoes.css
11. assets/fides-responsive.css  ← OBRIGATORIAMENTE POR ÚLTIMO
12. assets/fides-auth.css
```

> **ATENÇÃO:** `tokens.css` DEVE ser o primeiro CSS. Se não estiver, todas as `--custom properties` ficam `undefined` e o visual some. Descoberto na v4 (BUG raiz do redesign da auth).

---

## 4. Infraestrutura Supabase

### Tabelas (todas com RLS por `auth.uid() = user_id`)

| Tabela | RLS | Observação |
|---|---|---|
| `profiles` | ✅ | Coluna `group_targets jsonb` (default 50/30/20) adicionada em v10 |
| `accounts` | ✅ | Coluna `opening_balance` adicionada em v16 (saldo derivado) |
| `cards` | ✅ | Campo `closing_day` usado por `mesFaturaFor` |
| `transactions` | ✅ | Campos: `value`, `category`, `month`, `status`, `is_transfer`, `settled`, `paid_at`, `account_id`, `card_id`, `recurrent`, `subscription` |
| `goals` | ✅ | CRUD não exposto na UI (apenas leitura) |
| `user_categories` | ✅ | Custom do usuário: `cat_key`, `label`, `emoji`, `tint`, `grp`, `custom` |
| `assistant_usage` | ✅ | Logs do assistente Gemini |
| `category_limits` | ✅ | Criada via MCP em v9: `(user_id, cat_key, month UNIQUE)` — `month=NULL` = padrão recorrente |

### RPCs disponíveis

| RPC | Descrição |
|---|---|
| `recalc_account_balance(p_account_id)` | Recomputa saldo derivado: `opening_balance + SUM(value WHERE status='cleared')` |
| `set_account_balance(p_account_id, p_target)` | Ajusta `opening_balance` para edição manual de saldo. **Tem guarda de dono obrigatória.** |
| `delete_transaction(p_tx_id)` | RPC atômico: estorna saldo + remove par de transferência se `transfer_group IS NOT NULL` |
| `transfer_funds(...)` | Cria dois lançamentos `is_transfer=true` ligados por `transfer_group` |
| `pay_card_invoice(...)` | Pagamento atômico de fatura: marca compras como `settled=true`, cria lançamento `is_transfer=true` |

### Trigger

- `on_auth_user_created → handle_new_user()`: cria `profiles` automaticamente no cadastro. Usa `coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email,'@',1))`.

### Variáveis de ambiente no Vercel (aba Project)

- `NEXT_PUBLIC_SUPABASE_URL` ✅
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅
- `GEMINI_API_KEY` ✅

### Auth configurado

- Email/senha ✅
- Google OAuth ✅ (configurado em v11 via Google Cloud Console + Supabase Auth Providers)
- Apple OAuth: **removido permanentemente** em v11
- Confirmação de e-mail: habilitada
- E-mail de confirmação com branding Fides ✅
- Site URL: https://fides-money.vercel.app ✅
- Redirect URL: https://fides-money.vercel.app ✅

### Objetos globais em index.html

- `window.fidesDb` → cliente Supabase (tabelas)
- `window.fidesAuth` → cliente de autenticação
- `window.waitForAuth()` → Promise que resolve quando fidesAuth estiver pronto
- `window.FIDES_CONFIG` → `{ supabaseUrl, supabaseAnonKey }` injetado pela serverless function

> **Detalhe crítico:** `api/inject-config.js` usa **`module.exports`** (CommonJS). NUNCA converter para `export default` (ESM) — o Vercel Node.js runtime não suporta ESM nesse contexto.

---

## 5. Design Tokens

### Tokens globais (`tokens.css`)

```css
/* Verdes (marca Fides) */
--accent:        cor verde principal
--accent-bright: verde mais vibrante (destaques)
--accent-soft:   verde muito suave (backgrounds)

/* Textos */
--ink:           texto principal (quase preto)
--ink-2:         texto secundário
--ink-3:         texto terciário
--muted:         texto desabilitado

/* Superfícies */
--card:          background de cards
--card-soft:     background alternativo de cards
--border:        cor de bordas

/* Status */
--ok:            verde de status positivo
--ok-soft:       background de status positivo
--warn:          laranja de aviso (#B45309)
--warn-soft:     background de aviso
--bad:           vermelho de erro/perigo
--bad-soft:      background de erro/perigo

/* Extras */
--radius-lg      border-radius grande
--shadow-card    sombra padrão de card

/* Tipografia */
--font-display:  Manrope
--font-mono:     JetBrains Mono
```

### Tokens de grupos do Planejamento (em `fides-orcamento.css`, não globais)

```css
--g-essencial    tint do grupo Essenciais
--g-estilo       tint do grupo Estilo de vida
--g-divida       tint do grupo Dívidas
```

### Estado "No limite" (hardcoded em `fides-orcamento.css`, não em tokens)

```css
/* Cores do status "No limite" — hardcoded porque tokens.css é protegido */
color: #4A574F;
background: #E8EAE4;
```

### Paleta de tints (global via `window.CATEGORY_TINTS`)

21 tints reutilizáveis para categorias, contas e cartões. Definida em `fides-data.jsx`.

---

## 6. Regras iOS Obrigatórias

Aplicar em TODO elemento interativo, sem exceção:

1. Sempre usar `<button>` nativo — NUNCA `<div>` ou `<span>` com onClick
2. `touch-action: manipulation` em todo botão, item de lista e chip
3. `-webkit-tap-highlight-color: transparent` em todo elemento clicável
4. `min-height: 44px` em todo elemento tocável (Apple HIG)
5. `onPointerUp` em vez de `onClick` para itens dentro de dropdowns
6. `useRef + .contains()` para fechar dropdowns — NUNCA `onMouseLeave`
7. `position: fixed` com `top/bottom` em `vh` para painéis flutuantes
8. `backdrop-filter` em ancestrais quebra `position:fixed` → remover via `@media (max-width: 768px)`
9. Dropdowns: fechar com `mousedown + touchstart` no document, verificando `e.target` fora do ref
10. Nunca usar `onTouchStart` no backdrop para fechar — usar `onTouchEnd` ou `onPointerUp`
11. Inputs com `font-size: 16px` mínimo — abaixo disso o iOS dá zoom automático

---

## 7. Padrão de Dropdown (iOS-safe)

Todo dropdown novo deve seguir este padrão exato, já estabelecido e testado:

```jsx
function MeuDropdown({ items }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)} style={{ touchAction: 'manipulation' }}>
        ...
      </button>
      {open && (
        <div role="menu">
          {items.map(item => (
            <button
              key={item.id}
              role="menuitem"
              onPointerUp={() => { item.onClick?.(); setOpen(false); }}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 8. Estado Global — useFides()

O `FidesProvider` em `fides-store.jsx` expõe via `useFides()`:

### Leitura (dados)

| Dado | Tipo | Descrição |
|---|---|---|
| `transactions` | Array | Todas as transações |
| `monthTransactions` | Array | Filtradas pelo mês selecionado |
| `prevMonthTransactions` | Array | Transações do mês anterior |
| `accounts` | Array | Contas correntes/digitais |
| `cards` | Array | Cartões de crédito |
| `categories` | Object | Mapa de categorias (padrão + custom) |
| `categoryLimits` | Object | Limites por categoria/mês |
| `categoryUsage` | Object | Uso calculado por categoria |
| `goals` | Array | Metas (leitura) |
| `selectedMonth` | String | Formato `'YYYY-MM'` — dinâmico (FIX-1) |
| `monthLabel(ym)` | Function | Formata `'YYYY-MM'` para texto |
| `spendByCategory` | Array | Gastos por categoria no mês |
| `budgetGroups` | Array | Grupos 50·30·20 com spent/limit/target |
| `groupTargets` | Object | `{essencial, estilo, divida}` (valores 0..1) |
| `faturasPorCartao` | Object | Faturas abertas por cartão+mês |
| `faturaAbertaPorCartao` | Object | Total em aberto por cartão |
| `mode` | String | `'loading'` / `'mock'` / `'live'` |
| `userId` | String | UUID do usuário |
| `userName` | String | Nome completo (de `profiles.name`) |
| `firstName` | String | Primeiro nome derivado via useMemo de userName |
| `userEmail` | String | E-mail (de `auth.getUser()`) |
| `isLoading` | Boolean | Estado de carregamento |
| `isEmpty` | Boolean | Banco vazio (novo usuário) |
| `refreshData` | Function | Recarrega todos os dados do Supabase |

### Escrita (mutações — todas persistem no Supabase)

| Mutação | Descrição |
|---|---|
| `addTransaction(tx)` | Adicionar transação |
| `addTransactions(txs[])` | Adicionar múltiplas transações |
| `updateTransaction(id, patch)` | Editar por `_id` — suporta `desc`, `val`, `cat`, `acct`, `status`, `date`, `month` |
| `deleteTransaction(id)` | Via RPC atômico `delete_transaction` (estorna saldo + par de transferência) |
| `addAccount(acc)` / `updateAccount` / `deleteAccount` | CRUD de contas |
| `addCard(card)` / `updateCard` / `deleteCard` | CRUD de cartões |
| `addCategory` / `updateCategory` / `deleteCategory` / `moveCategory` | CRUD de categorias custom |
| `payCartaoFatura(...)` | RPC `pay_card_invoice` (atômico) |
| `transferFunds(...)` | RPC `transfer_funds` (atômico, com `transfer_group`) |
| `setCategoryLimit(catId, value, scope, months?)` | Define limite: scope `'month'` / `'default'` / array meses |
| `removeCategoryLimit(catId, scope, month?)` | Remove limite |
| `setGroupTargets(patch)` | Atualiza metas % dos grupos (persiste em `profiles.group_targets`) |
| `resetGroupTargets()` | Volta para 50/30/20 |
| `copyLimitsFromMonth(src, tgt)` | Copia overrides de limites entre meses |
| `computeSuggestions()` | Pura/síncrona — retorna sugestões sem gravar |
| `applySuggestions(list)` | Aplica lista de sugestões no banco |
| `updateProfile(name)` | Valida, sanitiza e persiste `profiles.name` + atualiza `setUserName` no store |

---

## 9. Modelo de Dados de Transações

### Convenções de campo (UI ↔ banco)

| Campo (UI) | Tipo | Formato/Conteúdo |
|---|---|---|
| `_id` | string | UUID |
| `val` | number | positivo = receita, negativo = despesa |
| `d` | string | `dd/mm` (sem ano) — display rápido |
| `date` | string | `YYYY-MM-DD` ISO — usado em `<input type="date">` |
| `desc` | string | descrição |
| `cat` | string | id da categoria (`tx.cat` UI ↔ `category` DB) |
| `acct` | string | id de **conta OU cartão** (mesma chave — distinção via `cardIdSet.has(acct)`) |
| `mes` | string | `YYYY-MM` — índice de mês |
| `status` | string | UI: `'pago'`/`'pendente'` ↔ DB: `'cleared'`/`'pending'` |
| `recur` | string\|null | `'mensal'` = recorrente mensal |
| `subscription` | bool | é assinatura |
| `isTransfer` | bool | é movimentação interna (excluída de somas) |
| `settled` | bool | compra de cartão quitada via fatura |
| `paidAt` | string\|null | timestamp ISO quando marcado pago |

### Mapeamento de status

```js
STATUS_TO_UI = { cleared: 'pago', pending: 'pendente', scheduled: 'agendado' }
```

### Convenção crítica de `acct`

> `tx.acct` guarda o id da **conta OU do cartão** (mesma chave para ambos). A distinção é feita via `cardIdSet.has(acct)`. Qualquer código novo que mexa em transações DEVE respeitar essa convenção. Não usar `tx.card_id` diretamente — usar `tx.acct`.

---

## 10. Modelo de Movimentação de Dinheiro (is_transfer)

Este modelo foi consolidado na v6 e é fundamental para não duplicar receitas/despesas.

### Três conceitos distintos

| Conceito | Campo | Significado |
|---|---|---|
| Estado da transação | `status` (`cleared`/`pending`) | Governa o selo da lista, contagens "pendente" e soma de despesas pagas |
| Quitação de fatura | `settled` (boolean) | Compra de cartão foi quitada via pagamento da fatura |
| Movimentação interna | `is_transfer` (boolean) | Lançamento é movimentação (fatura, transferência) — **excluído de TODAS as somas de receita/despesa** |

### Regra que evita duplicidade

- **Compra de cartão = a despesa.** Status `pendente` enquanto não paga; `pago`/`cleared` após quitar a fatura.
- **Pagamento de fatura = movimentação.** `is_transfer=true`. Aparece na lista mas **não conta em despesas**.
- **Transferência entre contas = movimentação.** Dois lançamentos `is_transfer=true` ligados por `transfer_group`.

### Tabela de presença nos agregados

| Tipo | Lista | Receita | Despesa | spendByCategory | budgetGroups |
|---|:---:|:---:|:---:|:---:|:---:|
| Despesa direta | ✅ | — | ✅ (se pago) | ✅ | ✅ |
| Compra cartão pendente | ✅ | — | — | — | — |
| Compra cartão paga | ✅ | — | ✅ | ✅ | ✅ |
| **Pagamento fatura** (`is_transfer`) | ✅ | — | **—** | **—** | **—** |
| **Transferência débito** (`is_transfer`) | ✅ | — | **—** | **—** | **—** |
| **Transferência crédito** (`is_transfer`) | ✅ | **—** | — | — | — |
| Receita (val>0) | ✅ | ✅ (se pago) | — | — | — |

> **ATENÇÃO:** `is_transfer` exclui das agregações de **gasto**, mas transferências afetam o **saldo** (movem dinheiro real).

---

## 11. Arquitetura de Saldo Derivado

Introduzida na v16. Eliminou deriva cumulativa do modelo incremental anterior.

### Princípio

```
saldo_conta = opening_balance + SUM(value WHERE status = 'cleared')
```

Recomputado via RPC `recalc_account_balance` após **toda** mutação de transação ou pagamento.

### Regras derivadas

- **Pendente nunca afeta o saldo** — só lançamentos `cleared` entram no SUM.
- **Edição de saldo manual** → `set_account_balance(account, target)` ajusta `opening_balance` para que o derivado bata com o alvo. **Tem guarda de dono obrigatória** (`auth.uid()` verificado na RPC).
- **Delete atômico** → RPC `delete_transaction` chama `recalc_account_balance` nas contas afetadas.
- **Transferência e pagamento de fatura** → RPCs `transfer_funds` e `pay_card_invoice` chamam `recalc` nas contas envolvidas.

### Convenção de `mesFaturaFor`

Função em `fides-data.jsx` que, dado o dia de fechamento do cartão e a data da compra, determina o **mês da fatura** (não o mês calendário). Corrigida em v11 (BUG-FATURA). `txToRow` em `fides-store.jsx` chama `mesFaturaFor` para toda transação de cartão. Convenção brasileira: "Fatura de Junho" = mês do fechamento, não do vencimento.

---

## 12. Componentes UI Globais (fides-ui)

Criados no Lote 1 (v8). Expostos via `window.FidesUI`.

| Componente/Hook | Tipo | Uso |
|---|---|---|
| `<ToastViewport />` | Componente | Renderizado em `fides-studio.jsx` no shell raiz |
| `<ConfirmDialog />` | Componente | Modal de confirmação controlado por props |
| `useToast()` | Hook | Retorna `{success, error, warn, info, dismiss}` |
| `useConfirm()` | Hook | Retorna `{confirm, ConfirmHost}` — promise-based |
| `FidesUI.toast.*` | API direta | Uso em handlers fora de componente React |

### Padrão de uso do `useConfirm`

```jsx
var refConfirm = window.FidesUI.useConfirm();
var confirmAction = refConfirm.confirm;
var ConfirmHost = refConfirm.ConfirmHost;

async function handleDelete() {
  var ok = await confirmAction({
    title: 'Excluir item?',
    message: 'Esta ação não pode ser desfeita.',
    destructive: true,
    confirmLabel: 'Excluir'
  });
  if (ok) { /* prosseguir */ }
}
// No JSX: <ConfirmHost />
```

---

## 13. Fluxo de Trabalho com o Claude Code

### Fluxo de decisão (macro)

```
Planejar (Claude chat) → prompt para Claude Code → Code edita e dá push em main
→ Vercel deploy (~2 min) → ritual anti-cache → testar no iPhone 400×512px
→ reportar resultado → próxima iteração
```

### 4 Fases obrigatórias em todo lote

| Fase | Descrição |
|---|---|
| **Fase 1 (Audit)** | Read-only: Claude (ou Code) lê o repo por grep/sed; retorna output BRUTO. Claude muitas vezes audita diretamente via `git clone`/`git show` do repo público — mais confiável. |
| **Fase 2 (Edit)** | Claude revisa e gera edições cirúrgicas como `str_replace` com strings exatas conferidas no blob. |
| **Fase 3 (Verify)** | Code retorna **diff bruto** (`git diff`/`git show --stat HEAD`, NUNCA prosa). Claude valida linha a linha, busca o blob independentemente. |
| **Fase 4 (Push)** | Só após o Deyglison colar o prompt de commit no Code (gesto consciente = autorização). Merge sempre `--no-ff`. |

### Padrão de autorização de Fase 4 (definido em v18)

Quando o diff estiver correto e Claude aprovar, Claude entrega o **prompt de commit na mesma mensagem**: *"Aprovado. Se concordar, cole o prompt abaixo no Code."* Colar o prompt no Code **é** o "ok" do Deyglison. Não é uma inferência automática do Claude nem do Code.

### REGRA INVIOLÁVEL Nº1 (primeira linha de todo prompt para o Code)

```
REGRA INVIOLÁVEL Nº1: NÃO faça commit nem push em nenhum momento.
Pare após mostrar o diff. Só commitará quando receber o prompt de commit
do Claude. Se o stop hook pedir push, IGNORE.
```

### Regras invioláveis de workflow

- `git show --stat HEAD` é a **única** evidência válida de commit. Prosa pode ser fabricada.
- **"Diff revisado, ver acima" não é aceitável** — exigir o texto bruto antes de autorizar.
- **Verificação independente do blob é obrigatória** após cada push: `git fetch origin main` + `git show FETCH_HEAD:arquivo | grep`.
- MCP **nunca** como fallback de git auth — causa hang. Parar imediatamente.
- O **stop hook do Code força push prematuro** — ocorreu múltiplas vezes (v17: 3 violações, v18: resolvido com REGRA INVIOLÁVEL Nº1 no topo). Quando acontecer sem autorização: não desfazer commit; tratar a branch como ponto de partida normal da Fase 4 (checkout main → merge `--no-ff` → push).
- Mudanças de DB: via **MCP `apply_migration`** (banco vivo) + arquivo `supabase/*.sql` no repo (Code). Aplicar SQL no mesmo chat em que foi criado (lição da v9).
- **NUNCA assumir schema do banco** — sempre verificar via MCP antes de codificar.
- Normalizar smart quotes → ASCII (`'`→`'`, `"`→`"`) em qualquer bloco de código. Smart quotes quebram `node --check`.
- `node --check` em arquivos `.js` antes de autorizar push (skip para `.jsx` — Babel cuida).
- Confirmar arquivos protegidos intocados no diff.
- Merge de feature branch em `main` com `--no-ff`; push em ambas (main + branch como backup).

### Ritual anti-cache no iPhone (após cada deploy)

**Fechar TODAS as abas do app → aba nova → hard reload 2×** (ou modo anônimo). Build leva ~2 min após push. Muitos "bugs" reportados durante o projeto eram cache servindo a versão anterior.

### Histórico de branches de backup criadas

```
backup/pre-feature1-contas-dots
backup/pre-feature2-metas-botoes
backup/pre-sprint-supabase
backup/pre-sessao-b
backup/pre-sessao-c
backup/pre-auth-fix
```

---

## 14. Cronologia Completa por Versão

### v2 (maio 2026) — Pós Sprint Supabase

**O que foi entregue:**
- Infraestrutura Supabase completa: schema (`profiles`, `accounts`, `cards`, `transactions`, `goals`), SDK (`window.fidesDb`, `window.fidesAuth`, `waitForAuth()`), serverless `inject-config.js`
- Auth: tela de login/cadastro (Sessão C), guard de rotas, logout
- Store migrado para Supabase com modo `live`/`mock`/`loading`
- Modal "Pagar fatura" em Contas & Cartões

**Bug ativo registrado:**
- Cadastro travava em "Aguarde…" — suspeita: `api/inject-config.js` não servido; `window.FIDES_CONFIG` vazio

**Commits notáveis:** `94682fc` (fix waitForAuth race condition), `05fde97` (merge infra), sequência anterior de features (gráficos, logos de bancos, responsividade, empty states)

---

### v3 (maio 2026) — Pós Correção de Auth

**O que foi entregue:**
- Bug de cadastro resolvido: env vars descobertas incorretamente na aba "Shared" do Vercel (deveriam estar na aba "Project")
- Login e cadastro funcionando; e-mail de confirmação enviado e recebido
- Botão de logout funcional no masthead

**Aprendizado registrado:**
- Variáveis do Vercel devem estar na aba **Project**, não só na aba Shared

---

### v4 (maio 2026) — Redesign Completo da Tela de Auth

**O que foi entregue:**
- Tela de auth completamente redesenhada via Claude Design
- Classes CSS escopadas em `.fa-screen`
- Forgot password funcional (reset via Supabase)
- Botões Google e Apple comentados (OAuth ainda não configurado)

**Bug descoberto e resolvido:**
- `tokens.css` não estava como primeiro CSS no `index.html` → custom properties undefined → visual some

**Lição:** `tokens.css` DEVE ser o primeiro CSS carregado. Regra documentada e mantida até hoje.

---

### v5 (maio 2026) — Sprint de Religação Live (mock → Supabase)

**O que foi entregue:**
- Descoberta: app logado com conta real mostrava dados mock do Deyglison (Bradesco, Nubank, metas de R$127k)
- Não havia vazamento de dados entre usuários (RLS intacto) — era mock renderizado no frontend
- Religação de todas as páginas para ler o store real: Dashboard, Transações, Planejamento, Contas, Metas
- Categorias customizadas com persistência no Supabase (`user_categories`)
- Empty states para usuário novo
- E-mail de confirmação com branding Fides
- Persistência de categorias custom híbrida (22 defaults + custom do usuário)

**Decisão:** OAuth Google adiado (Google Cloud Console exige pré-pagamento); OAuth Apple descartado

**Lição crítica:** O Dashboard live é `DashboardStudio` em `fides-studio.jsx`, NÃO `fides-dashboard.jsx` (fallback do /teste). Esse mal-entendido custou um lote.

---

### v6 (maio 2026) — Modelo de Movimentação + Fatura Selecionável

**O que foi entregue:**
- Modelo `is_transfer` consolidado: compra de cartão = despesa; pagamento de fatura = movimentação (sem duplicar em agregados)
- Modal "Pagar fatura" selecionável: lista compras do cartão com checkbox
- RPC atômico `pay_card_invoice` (PL/pgSQL, respeita RLS)
- Receita no modal de transação sem campo de forma de pagamento
- Transferência entre contas via RPC `transfer_funds` com `transfer_group`
- Campo `is_transfer` no banco + backfill SQL

**Problema documentado:** dois ambientes do Claude Code (nuvem vs. local desatualizado) — quase derrubou a build

**Lições:**
- RPC atômico > orquestração no cliente (atomicidade, rollback automático)
- Trindade `status`/`settled`/`is_transfer` — misturar foi a causa de 3 lotes circulando o mesmo bug
- Verificação por grep, não por prosa; backfill quando o modelo muda

---

### v7 (junho 2026) — Assistente Fides + Descoberta de Bugs de Fundação

**O que foi entregue:**
- Assistente Fides com Gemini 2.5 Flash-Lite via `api/assistant.js`
- Tools READ (consultar_saldo, consultar_extrato) e WRITE (criar_transacao, criar_categoria) implementadas
- Saga de troca de provedor: Gemini → Groq/Llama → rollback para Gemini (Llama não suportava function calling adequadamente)

**Bugs descobertos em testes reais:**
- BUG 1: campo `mes` gravado vazio em edge cases
- BUG 2: app abria sempre no mês fixo `2026-05` (hard-coded no store)
- BUG 3: apagar transação não estornava saldo/used (GRAVE)
- BUG 4: assistente lançava em cartão de forma inconsistente (não usava convenção `tx.acct`)
- BUG 5: `criar_categoria` mostrava toast de sucesso mesmo falhando
- BUG 6: busca ⌘K não funcionava

**Decisão estratégica:** colocar assistente em **modo só-leitura** por ora; corrigir bugs de fundação primeiro.

**Lição de produto:** escopo pequeno e confiável > escopo grande e quebrado.

---

### v8 (junho 2026) — FIX de Fundação + Lotes 1, 2, 3

**FIX executados:**
- **FIX-1:** `selectedMonth` inicializa dinamicamente com o mês corrente (era hard-coded `'2026-05'`)
- **FIX-2:** `deleteTransaction` virou RPC atômico `delete_transaction` que estorna `balance`/`used` corretamente, com migração de reconciliação dos saldos corrompidos
- **FIX-3:** Assistente em modo só-leitura (tools WRITE removidas; READ mantidas)
- **FIX-4:** Mensagem de boas-vindas do assistente corrigida

**Lotes de produto:**
- **Lote 1:** `fides-ui.jsx` + `fides-ui.css` — `ConfirmDialog`, `Toast`, `useToast()`, `useConfirm()` (promise-based). 6 popups nativos (`window.confirm`/`alert`) substituídos.
- **Lote 2:** Bulk action bar redesenhada como bottom sheet sticky (padrão iOS); seletor de categoria bulk (padrão tap-vs-scroll com threshold 8px)
- **Lote 3:** Tabela `category_limits` no banco (com RLS + trigger); store expõe `categoryLimits`, `categoryUsage`, `setCategoryLimit`, `removeCategoryLimit`

**Análise de concorrentes:** PlannerFin estudado como referência para Planejamento. Fraquezas identificadas: mobile inviável, sem projeção preditiva, sem sugestão de orçamento.

---

### v9 (junho 2026) — Lote 4A (Planejamento) + Lote 5A (Transações)

**Lotes de produto:**
- **Lote 4A:** UI completa do Planejamento: cards de categoria com barra de progresso semântica, edição inline de limite, modal de 3 escopos (este mês / padrão / meses específicos), grupos colapsáveis (Essencial/Estilo/Dívidas), empty state, sheet de copiar limites (placeholder)
- **Lote 5A:** Redesign de Transações: cards de alta densidade (2 linhas mostrando Conta + Categoria + Cartão + Data + Status), pills de sort, headers de grupo sticky, chips de filtro rápido, bottom sheet de filtros avançados, bulk actions reais

**Fixes críticos:**
- Transfer delete bug: novo RPC que detecta `transfer_group IS NOT NULL` e remove ambas as pernas atomicamente
- "Salvar e Novo" — botão estava sempre fechando o modal; fix: bypass do `onSave`, `resetForm()` completo
- Planejamento toast duplo — store não re-lançava erros; corrigido

**Bug crítico descoberto:**
- Tabela `category_limits` existia no SQL do repo MAS nunca havia sido executada no Supabase → toda definição de limite falhava silenciosamente. Criada via MCP `apply_migration`.

**Lição fundamental:** "Schema-repo drift" — SQL salvo em `supabase/*.sql` NÃO significa que foi executado no banco. **Sempre verificar via MCP** antes de assumir.

---

### v10 (junho 2026) — Fix BUG-DATA + Lote 4B (Planejamento completo)

**Lote 6A (Fix BUG-DATA):**
- Edição de data de transação não persistia e mover entre meses não funcionava
- Root causes: `updateTransaction` ignorava `date`, `month` e `acct`; `normalizeTx` não populava `tx.date`
- Fix: `normalizeTx` retorna `date: dateStr`; `updateTransaction` trata `patch.date` derivando `month` sem `Date` constructor (evita timezone shift); `updateTransaction` trata `patch.acct` via `cardIdSet`

**Lote 4B:**
- `PlnInsights` refatorado: denominador usa receita do mês (fallback: total de gastos com badge "do total")
- `RuleInfoCard`: card didático 50/30/20 colapsável, estado persistido em `localStorage`, cópia mobile-aware (sem "acima/abaixo")
- `GroupTargetsSheet`: metas % editáveis dos grupos, persistência via `profiles.group_targets jsonb`, botão "Resetar 50/30/20"
- Migração SQL: `ALTER TABLE profiles ADD COLUMN group_targets jsonb DEFAULT '{"essencial":0.50,...}'`

**Fixes pós-deploy (no mesmo chat):**
- Card 50/30/20 sumia com clique no X → colapsável (toggle), nunca sai do DOM
- "Editar metas" não abria → backdrop usava classe CSS errada (`pln-sheet-back` vs `pln-sheet-backdrop`)

**Decisões novas:**
- Preferências pequenas do usuário → coluna `jsonb` em `profiles` (não nova tabela)
- Denominador de % de grupo = receita com fallback total + badge
- Cópia de UI nunca usa "acima/abaixo/lados" — posição depende do scroll e viewport

---

### v11 (05 de junho de 2026) — 8 Lotes em Sequência

**BUG-FATURA — Ciclo da fatura do cartão:**
- Root cause 1: `mesFaturaFor` em `fides-data.jsx` tinha 2 erros (`dd > fechamento` deveria ser `>=`; retornava `monthDue` em vez de `monthClose`)
- Root cause 2: `txToRow` nunca chamava `mesFaturaFor` — gravava `tx.mes` direto
- Fix cirúrgico em `fides-data.jsx` (exceção concedida) + `fides-store.jsx`
- MCP UPDATE: 16 transações de cartão saneadas retroativamente

**FIX-CREDITO:** modal de nova transação — toggle "Marcar como pago" desabilitado para cartão de crédito; aviso contextual

**FIX-EDIT-PAY:** `EditTxModal` ganhou seletor de forma de pagamento (antes inexistente)

**FIX-EDIT-MES:** edição recalcula month via `mesFaturaFor` (corrigiu transações editadas após BUG-FATURA)

**Lote 4D — Receita esperada via recorrência:**
- Transações recorrentes do tipo receita em meses anteriores geram cópias virtuais `{_isVirtual: true}` no mês corrente
- Chip de aviso se nenhuma receita registrada: "Registre suas receitas recorrentes marcando 'Repetir mensalmente'"

**Lote 4C — Insights agregados + projeção no card fechado:**
- `PlnInsights` cobre 7 cenários (antes 3): dívida alta → estilo alto → essencial alto → N estouradas → 1 estourada → N no warn → ok
- Indicador de projeção no card fechado (depois identificado como problemático)

**LOTE-NAME — Cadastro robusto + saudação por primeiro nome:**
- `firstName` derivado no store via `useMemo` de `userName.split(/\s+/)[0]`
- Botão Apple removido definitivamente
- Google OAuth habilitado no Supabase Dashboard

**Lote 4E — Form de cartão com linguagem do usuário:**
- "Melhor data de compra" (não "Fechamento")
- Preview em tempo real do ciclo da fatura

**Bug descoberto ao final:** projeção de gastos gerando números absurdos no início do mês (multiplicador 6× no dia 5). Assistente inventou explicação falsa. FIX-PROJECAO = prioridade máxima da próxima sessão.

---

### v12 (07 de junho de 2026) — FIX-PROJECAO + Perfil + Planejamento Limpo

**FIX-PROJECAO — 4 frentes:**
- Calibração temporal: `dayElapsed < 7` → sem projeção; `7-14` → exige `projPct > 1.30`; `≥15` → `projPct > 1.05`
- Copy humanizado: "📈 No ritmo de R$ X/dia, deve fechar em R$ Y (limite R$ Z)"
- KPI null-safe: eliminou R$ 28.272 fantasma (somas de projeções × 6 sem calibração)
- System prompt do assistente: seção `PROJEÇÃO` com fórmula real + instrução "NUNCA invente cálculos"

**LOTE-PERFIL+EDIT-CREDITO:**
- `PerfilView` criada do zero em `fides-studio.jsx`: campo de nome editável, validação, avatar com inicial, rota `'perfil'`
- `updateProfile(name)` em `fides-store.jsx`
- FIX-CREDITO replicado no `EditTxModal` (paridade com `NovaTransacaoModal`)

**LOTE-PLANEJ-LIMPO:**
- `PlnInsights` substituído por `PlnResumo` (4 KPIs: Realizado, Planejado, Sobra, Projeção)
- 3 blocos de ruído removidos do `PlnCategoryCard` (3 menções da mesma projeção por sedimentação de sessões)
- Bug silencioso corrigido: `status === 'bad'` vs `status === 'over'` (tornava `overCount` sempre 0)

**Problema descoberto:** KPI "Projeção" no `PlnResumo` ainda gerava R$ 20.922,69 no dia 7. Assistente errou a própria explicação. Decisão: **remover o KPI Projeção por completo** (LOTE-PROJ-OUT).

**Lições:**
- Quando o LLM tropeça explicando, o conceito é o problema, não o LLM
- Calibrar não é suficiente se o conceito é falho
- Ruído acumula por sedimentação entre sessões — ao adicionar feature nova, auditar o que já havia

---

### v13 (entre v12 e v14) — LOTE-PROJ-OUT + Fix Ano Hardcoded

**LOTE-PROJ-OUT:**
- KPI "Projeção" removido do `PlnResumo`
- Grid de KPIs: 3 colunas (Realizado · Planejado · Sobra)
- `_bctx_projNote` removido de `fides-claude.jsx`
- Seção Projeção removida de `api/assistant.js`
- `profiles.group_targets` e `selectedMonth` com fallbacks dinâmicos

**Fix ano hardcoded:**
- `2026` hard-coded em `ensureMes` (`fides-store.jsx`) e `txMonth` (`fides-data.jsx`) — quebraria em 01/jan/2027
- Fix aplicado via wrapper no store (sem tocar `fides-data.jsx` protegido)
- Displays de período dinâmicos em `fides-dashboard.jsx`, `fides-diario.jsx`, `fides-studio.jsx`, `fides-shell.jsx`, `fides-contas.jsx`

---

### v14 (12 de junho de 2026) — Sessão de Planejamento Estratégico

**Sessão exclusivamente de planejamento — nenhum commit gerado.**

**Skills avaliadas para o Fides:**

| Skill | Veredicto | Quando |
|---|---|---|
| `impeccable-design-polish` | ✅ Agora | Auditoria visual final antes de compartilhar |
| `emilkowalski-motion` | ✅ Agora | Micro-interações CSS em modais, transições, cards |
| `design-brief` | ⏸️ Futuro próximo | Ao projetar Metas/Dívidas/Família via Claude Design |
| `high-end-visual-design` | ⏸️ Futuro | Avaliar importação de Google Fonts |
| `redesign-existing-projects` | ⏸️ Pós-feedback | Após retorno dos amigos/família |
| `imagegen-frontend-web` | ⏸️ Roadmap | Landing page comercial |
| `faq-page` | ⏸️ Roadmap | Central de ajuda quando houver usuários |
| `imagegen-frontend-mobile` | ⏸️ Baixa | Testar se agrega além do Artifact mock |

**Workflow confirmado:** `impeccable-design-polish` → `emilkowalski-motion` (nessa ordem: primeiro identificar problemas, depois animar)

---

### v15 (13-14 de junho de 2026) — Lote 6 + Auditoria Visual Iniciada

**Lote 6 — Copiar limites de outro mês + sugerir pela média:**
- Esquema verificado via MCP antes de codar
- `CopySheet` existia como placeholder visual — os 3 botões não faziam nada
- `copyLimitsFromMonth(sourceMonth, targetMonth)` implementado
- Regra de sugestão híbrida (decisão C): se ≥2 meses têm override → média dos overrides; senão → média dos gastos reais; senão → omite

**Lote 6B — Preview de sugestões com confirmação seletiva:**
- `computeSuggestions()` pura/síncrona — retorna sugestões sem escrever no banco
- `applySuggestions(list)` — upsert da lista aprovada
- `SuggestPreviewSheet` com checkboxes, origem da sugestão, valor formatado

**Fix:** limite "padrão" ao editar abre `confirm()` se mês atual tem override pontual

**Limpeza técnica:** `category_limits` documentado em `supabase/schema.sql` (145 → 165 linhas)

**Auditoria `impeccable-design-polish` revelou:**
- 🔴 `fides-diario.jsx`/`fides-diario.css` — versão INTEIRA descartada do Studio (nunca conectada à nav, identidade cream/gold incompatível). Fix anterior que lincou o CSS no `index.html` deve ser **revertido**; os arquivos devem ser **removidos**.
- 🟡 Roxo off-brand `#6366F1`/`#8B5CF6`/`#6c63ff` hardcoded no avatar e tela de Perfil
- 🔴 Tela de Perfil inacessível no mobile (400×512px) — sem caminho de navegação
- 🟡 `--warn` fallback divergente: `fides-orcamento.css:846` usa `#c67d3c` vs token real `#B45309`

**Lições:**
- "CSS órfão" tem dois sabores: candidato a reaproveitamento (`fides-transacoes-bulk.css`) vs. feature inteira descartada (`fides-diario.css`)
- MCP descarta hipóteses de bug mais rápido que auditoria de código (fix do "limite padrão" confirmado em 1 query MCP)
- "Resumo de diff não é diff" — exigir o texto bruto antes de aprovar Fase 4

---

### v16 (junho 2026) — Refactor de Saldo Derivado

**Sintoma inicial:** despesa pendente debitava da conta (Bradesco zerada virou -600); Infinite Pay oscilando sem poder corrigir.

**3 bugs simultâneos diagnosticados (via MCP + auditoria do repo público):**
1. `addTransaction` fazia `balance += value` sem olhar `status` → pendente entrava no saldo
2. `updateTransaction` nunca reconciliava o saldo ao editar valor/conta/status → deriva silenciosa
3. RPC `delete_transaction` estornava sem olhar status (espelho do bug 1)

**Migração para saldo derivado (Option B):**
- Coluna `opening_balance` (seed: `opening = balance - SUM(cleared)`, zero mudança visível)
- RPCs `recalc_account_balance` e `set_account_balance` (com guarda de dono obrigatória)
- `delete_transaction`, `transfer_funds`, `pay_card_invoice` reescritas para usar `recalc`
- Espelho em `supabase/derived-balance.sql`

**Reset de dados via MCP:** 3 transações fantasma apagadas; saldos corretos — Bradesco → 0,00, Infinite Pay → 74,39, Reserva → 6150,12.

**Commit:** `7ce139b` (merge `--no-ff` verificado por blob)

**Novas decisões travadas:**
- Status 100% cravado ≠ "Estourou" → "No limite" (estado neutro novo)
- "No ritmo de estourar" só com ≥2 meses de histórico
- Insight de Planejamento = determinístico (sem IA por page-load)
- `catStatus(gasto, limite)` centralizado — proibido duplicar threshold

---

### v17 (junho 2026) — Lote A + Lote B (Planejamento com Insights)

**Lote A — Status "No limite" + contagem estrita + remoção de projeção ingênua:**
- `plnStatus`: `>= 1` → `> 1` (Estourou); inserido `=== 1` → `{cls: 'nolim', label: 'No limite'}`
- `overCats`: filtro `>=` → `>` (estrito — 100% cravado não entra na contagem de estouro)
- `warnCats` e alerta "no ritmo de estourar" removidos (11 linhas de projeção ingênua)
- CSS: `.pln-status.nolim`, `.pln-cat-pct.nolim`, `.pln-bar-fill.nolim`
- **Commit:** `063ed65`

**Lote B — Engine determinística + componente `PlnMesInsights`:**
- Contexto: Open Design gerou `computeInsights` de 140 linhas com campos chutados (`g.id`, `c.cat_key`, `window.Icon.*`) — **descartado integralmente**. Refeito com auditoria de campos reais.
- `computeInsights(groups, totals, prevTxs)` — pura, determinística, sem projeção ingênua
- `PlnMesInsights` — 0-4 cards (bad/warn/ok), `hasHistory` controla hint de tendência, botão "Análise da IA" (stub visual)
- 68 linhas CSS novas
- **Commit:** `78be620`

**3ª violação do gate de Fase 4:** Code deu push direto para `origin/main` sem branch e sem autorização. Conteúdo verificado por blob e aceito. Solução definitiva: REGRA INVIOLÁVEL Nº1 como **linha 1 de todo prompt do Code**.

---

### v18 (junho 2026) — Lotes C, D, E (Refinamentos dos Insights)

**Contexto:** diagnóstico de "124% fantasma" no grupo `divida` — categorias sem limite entravam no numerador do percentual.

**Lote C — Corrige percentual fantasma + "Ação sugerida":**
- `spentLimited` = apenas categorias COM limite definido (percentual da meta)
- `g.spent` permanece para distribuição 50/30/20
- "Ação sugerida" → maior vazamento (em R$, não em %)
- **Commit:** `b246749`

**Lote D — Prioridade de grupo na ação sugerida:**
- `CUT_PRIORITY`: `estilo (0) → divida (1) → essencial (2)` — nunca sugerir cortar essencial antes de supérfluo
- Separa `overByAmount` (maior R$ absoluto) × `overByCutPriority` (grupo + R$ dentro do grupo)
- **Commit:** `e07ccd4`

**Lote E — Tendência por R$ real:**
- Base mês anterior ≥ R$ 100 E alta ≥ R$ 100 (elimina ruído percentual sobre base pequena)
- Ordena por R$ absoluto; exibe "subiu R$ X (~Y%)"
- **Commit:** `dfd640e`

**Princípio dos Insights (consolidado):** *O Fides só mostra número que reflete a realidade financeira, nunca número que impressiona mas engana.* Três corolários: (a) sem projeção ingênua; (b) ação sugerida ataca o que importa, não o trivial; (c) tendência exige base/alta materiais em R$, não % sobre base pequena.

**Preview de design:** `planejamento-preview-claude.html` — mock fiel com toggle Antes/Depois, usado para aprovar o visual antes dos lotes.

---

## 15. Decisões Arquiteturais Travadas

Não reabrir sem motivo explícito.

### Stack e infraestrutura

- Stack imutável: React 18 Babel standalone, CSS puro com tokens, Supabase, Vercel
- `tokens.css` = primeiro CSS no `index.html`, sempre
- `api/*.js` = CommonJS (`module.exports`), nunca ESM
- Env vars Supabase na aba **Project** do Vercel
- Working tree autenticado: `/home/user/fides-money`
- Dashboard live = `DashboardStudio` em `fides-studio.jsx` (não `fides-dashboard.jsx`)

### Auth

- Email/senha + Google OAuth ✅
- Apple OAuth: **removido permanentemente** (v11)
- OAuth Google adiado por custo GCP → depois habilitado via Google Cloud Console (v11)

### Banco de dados

- Saldo derivado: `balance = opening_balance + SUM(value WHERE status='cleared')` via `recalc_account_balance`
- Pendente nunca afeta o saldo
- `set_account_balance` exige guarda de dono (`auth.uid()`) — sem isso é IDOR
- `mesFaturaFor` determina o mês de toda transação de cartão (convenção brasileira)
- Mudanças de schema via MCP + espelho em `supabase/*.sql`
- NUNCA assumir schema do banco — sempre verificar via MCP

### Modelo de dados

- `tx.acct` guarda id de conta OU cartão (mesma chave) — distinção via `cardIdSet`
- `is_transfer=true` exclui movimentações de agregações de gasto (mas afeta saldo)
- Bulk selection: `Set<tx._id>` (não índices — estável a re-sort/re-filter)
- Preferências pequenas do usuário → coluna `jsonb` em `profiles` (não nova tabela)
- Receita = transação recorrente (não configuração de salário no perfil)
- `firstName` derivado no store via `useMemo` de `userName.split(/\s+/)[0]`
- `grp` (coluna), não `group` (palavra reservada SQL)

### UI e produto

- Viewport canônico obrigatório: 400×512px iOS Safari
- Vocabulário: "Planejamento" (não "Orçamento")
- **Projeção ingênua proibida na UI financeira** — gera números enganosos. Qualquer previsão exige base histórica real.
- KPI "Projeção" removido definitivamente do `PlnResumo` (v13)
- `PlnResumo` substitui `PlnInsights` definitivamente (v12)
- Status de categoria centralizado em `plnStatus(gasto, limite)`:
  - `gasto > limite` → "Estourou" (vermelho)
  - `gasto === limite` → "No limite" (cinza `#4A574F`/`#E8EAE4` — NÃO é estouro)
  - `80% ≤ gasto < 100%` → "Atenção" (âmbar)
  - `< 80%` → "Em dia" (verde)
- Contagem "acima do limite" usa `> limite` (estrito — 100% cravado não entra)
- "No ritmo de estourar" só com ≥2 meses de histórico
- Ação sugerida prioriza grupo cortável: `CUT_PRIORITY = estilo (0) → divida (1) → essencial (2)`
- Percentual "% da meta" do grupo conta só categorias COM limite (`spentLimited`)
- Tendência: base e alta ≥ R$ 100; ordena por R$ absoluto
- 100% de uso de limite = "No limite" (neutro), não "Estourou"
- Aviso de cartão → rodapé sutil em "Contas & Cartões" (não em Planejamento)
- Cópia de UI nunca usa "acima/abaixo" — posição depende do scroll/viewport no mobile
- Card 50/30/20: colapsável (toggle), nunca sai do DOM
- Estado "No limite" NÃO entra em `tokens.css` (protegido) — cores hardcoded localmente em `fides-orcamento.css`
- Forma de pagamento no modal de transação:
  - Nova transação: toggle desabilitado ao selecionar cartão + aviso contextual
  - Edição: idem (pré-v12 só estava no modal de nova, pós-v12 em ambos)

### IA

- Provedor: Gemini 2.5 Flash-Lite via `api/assistant.js`
- Llama/Groq descartados (não suportam function calling adequadamente)
- Assistente em modo **só-leitura** — WRITE volta só depois de fundação 100% sólida
- Chamada à IA: sob demanda via botão, **nunca por page-load**
- Insight de Planejamento = determinístico (sem IA)
- Quando o LLM tropeça explicando um conceito, o conceito é o problema, não o LLM

### Workflow

- 4 fases obrigatórias: Audit → Edit → Verify → Push
- `git show --stat HEAD` = única evidência válida de commit
- Verificação independente do blob pós-push é obrigatória
- Artifacts HTML com toggle Antes/Depois antes de qualquer push em decisões visuais
- Claude Design/Open Design: apenas estrutura visual, **não gera lógica de cálculo** (já falhou em v17/v18)
- CRUD Metas e Telas Dívidas/Família → Claude Design com `design-brief`
- `fides-diario.jsx`/`fides-diario.css` = code morto → **remover** (pendente)
- Merge em `main` sempre com `--no-ff`
- Stop hook do Code: não desfazer commit, tratar como ponto de partida normal da Fase 4
- MCP nunca como fallback de git auth

---

## 16. Estado Atual do App (pós v18)

### Funcionalidades ativas em produção ✅

| Área | Status |
|---|---|
| Auth (email/senha + Google OAuth) | ✅ |
| Rota `/teste` (demo pública sem login) | ✅ |
| Store modo live/mock/loading | ✅ |
| Tela de Perfil (nome editável, avatar) | ✅ |
| **Transações:** cards alta densidade, sort, filtros avançados, bulk actions, ⋯ menu | ✅ |
| **Planejamento:** limites, grupos, PlnResumo (3 KPIs), PlnMesInsights, insights determinísticos | ✅ |
| **Contas & Cartões:** CRUD, modal Pagar fatura, transferência, footnote de cartão | ✅ |
| **Metas:** leitura (CRUD não implementado) | ✅ parcial |
| **Assistente Fides** (Gemini, só-leitura, sob demanda) | ✅ |
| Saldo derivado via RPC `recalc_account_balance` | ✅ |
| `mesFaturaFor` correta para ciclo de fatura | ✅ |
| Delete de transação estorna saldo (RPC atômico) | ✅ |
| Delete de transferência remove ambas as pernas | ✅ |
| `ConfirmDialog` + `Toast` (substitui popups nativos) | ✅ |
| Lote 6: copiar limites + sugerir pela média + preview com confirmação | ✅ |
| Status "No limite" (distinto de "Estourou") | ✅ |
| Insights do Mês (computeInsights, PlnMesInsights) | ✅ |
| Tendência por R$ real (base + alta ≥ R$ 100) | ✅ |
| Ação sugerida por prioridade de grupo (CUT_PRIORITY) | ✅ |

### Pendências conhecidas

| Item | Prioridade |
|---|---|
| Remover `fides-diario.jsx` + `.css` + `<link>` no `index.html` | 🔴 Alta |
| Roxo off-brand em `.fds-avatar` (`fides.css`) e `.prf-view` (`fides-studio.css`) | 🟡 Média |
| Tela de Perfil inacessível no mobile (sem caminho de navegação em 400×512px) | 🟡 Média |
| `--warn` fallback divergente em `fides-orcamento.css:846` | 🟡 Baixa |
| `fides-transacoes-bulk.css` (avaliar antes de remover — pode servir ao CSV import) | 🟡 Standby |
| Integração Gemini real no botão "Análise da IA" (hoje stub de 2,2s) | 🟡 Próximo candidato |
| FIX-CREDITO no EditTxModal residual (toggle disable ao editar) | 🟡 Média |

---

## 17. Fila de Implementação (prioridade)

### Imediato (próximas sessões)

| # | Item | Prioridade | Estimativa |
|---|---|---|---|
| 1 | **Remover `fides-diario.*`** (jsx + css + link index.html) | 🔴 Máxima | ¼ sessão |
| 2 | **`impeccable-design-polish`** — roxo off-brand + tokens inexistentes `.prf-view` + `--warn` divergente + continuar auditoria dos CSS restantes | Alta | ¼–½ sessão |
| 3 | **Acesso ao Perfil no mobile** (engrenagem clicável + protótipo Antes/Depois) | Média | ¼–½ sessão |
| 4 | **`emilkowalski-motion`** — micro-interações CSS | Alta | ½ sessão |
| 5 | **Integração Gemini real** no botão "Análise da IA" | Alta | ½ sessão |
| 6 | **CSV/OFX/PDF import** (checar `fdt-bulk-*` antes de decidir) | Média | 1+ sessão |
| 7 | **Lote 5B** — Preview de limite no modal de Nova Transação | Stand-by | ½ sessão |
| 8 | **`fides-transacoes-bulk.css`** — avaliar reaproveitamento no CSV import | Média | incluído no item 6 |

### Backlog

| # | Item | Estimativa |
|---|---|---|
| 9 | **CRUD Metas** — via Claude Design + `design-brief` (tabela `goals` existe, falta API + UI) | 1 sessão |
| 10 | **Telas Dívidas / Família** — via Claude Design + `design-brief` | 1+ sessão |
| 11 | **Investimento ≠ despesa** — mudança de modelo de dados (adiado, sem urgência) | design próprio |
| 12 | **Lote 8** — Projeção via média histórica (após 3+ meses de dados) | 1+ sessão |
| 13 | **Busca ⌘K funcional** | ½ sessão |
| 14 | **Gemini Fides Assistant tools WRITE** — volta após fundação 100% validada | 1+ sessão |
| 15 | **Tabela multi-mês desktop** | 1 sessão |
| 16 | **Gerenciar grupos custom** | 1 sessão |
| 17 | **Tendência com média de 2-3 meses** (hoje só contra mês anterior) | depende de histórico |
| 18 | **`confirm()`/`alert()` residuais** — substituir por `<ConfirmDialog>` e `<Toast>` | ½ sessão |
| 19 | **Regenerar `supabase/schema.sql`** do banco real via MCP | ¼ sessão |

### Roadmap comercial (longo prazo)

| # | Item | Skill | Quando |
|---|---|---|---|
| 20 | **Landing page de apresentação** | `imagegen-frontend-web` | Ao decidir comercializar |
| 21 | **FAQ / Central de ajuda** | `faq-page` | Quando houver usuários externos |
| 22 | **Redesign visual completo** | `redesign-existing-projects` | Pós-feedback de amigos/família |
| 23 | **WhatsApp** (Z-API ou Evolution API) | — | Futuro, depende de WRITE estável |
| 24 | **Google OAuth billing** | — | Quando fizer sentido economicamente |
| 25 | **Google Fonts** | `high-end-visual-design` | Avaliar performance iOS antes |

---

## 18. Lições Operacionais Consolidadas

### Sobre o banco de dados

1. **MCP primeiro.** Para qualquer sintoma de "dado errado/não bate", consultar o banco via MCP antes de auditar código. Uma query MCP descartou em segundos hipóteses que custaram horas de auditoria de código (v15, v16).
2. **Schema-repo drift.** SQL em `supabase/*.sql` NÃO significa que foi executado no banco. Sempre verificar via `list_tables`/`execute_sql` antes de codificar. Custou dois deploys quebrados no v9.
3. **Aplicar SQL no mesmo chat que o cria.** Não deixar para depois — a tabela `category_limits` ficou sem existir no banco por dois deploys.
4. **RPC atômico > orquestração no cliente.** 4 operações em sequência no cliente sem atomicidade → quando a 4ª falha, as 3 primeiras já aconteceram. PL/pgSQL garante rollback automático.
5. **Backfill quando o modelo muda.** Ao introduzir `is_transfer` ou `mesFaturaFor`, registros anteriores precisam ser alinhados.

### Sobre o Claude Code

6. **`git show --stat HEAD` é a única evidência válida.** Prosa pode ser fabricada; o Code descreveu fielmente arquivos que não estavam no commit em múltiplas ocasiões.
7. **"Resumo de diff não é diff."** Sempre exigir o texto bruto (`git diff` / `git show`) antes de aprovar Fase 4.
8. **Verificação independente do blob** — `git fetch origin main` + `git show FETCH_HEAD:arquivo | grep`. Já pegou diffs stale do Code em v18.
9. **Stop hook do Code força push prematuro** (3 violações em v17; resolvido em v18 com REGRA INVIOLÁVEL Nº1 na linha 1 de todo prompt).
10. **Branch de feature em vez de main** — sempre incluir no prompt: verificar `git branch`, `git log --oneline -3`, push em `main` com `--no-ff`.
11. **Arquivo na raiz em vez de `assets/`** — verificar com `git diff --name-only`.
12. **Confirmar conteúdo, não só existência** — `grep -c "classe-específica"`, não só `ls`.
13. **Smart quotes quebram `node --check`** — normalizar `'`→`'`, `"`→`"` em todo bloco de código.
14. **"ok, segue Fase 4" é do Deyglison, não do Claude.** O Code já interpretou feedback do Claude para Deyglison como autorização (v17). O gesto de colar o prompt de commit no Code = autorização.

### Sobre o produto e a UI

15. **Projeção ingênua é proibida.** "gasto × (dias_total / dias_decorridos)" = multiplicador irracional no início do mês. Gera números absurdos e o LLM não consegue explicar corretamente. Sinal de que o conceito é o problema, não a implementação.
16. **"Planejado" é a melhor projeção.** O teto definido pelo usuário é baseado em julgamento histórico — mais inteligente que extrapolação linear de 7 dias.
17. **Ruído acumula por sedimentação.** Lotes sucessivos adicionam info sem auditar o que já havia → 3 menções da mesma projeção em um único card. Ao adicionar feature, sempre auditar o que existe primeiro.
18. **Calibrar não é suficiente se o conceito é falho.** FIX-PROJECAO calibrou por `dayElapsed`, mas a projeção permaneceu problemática. O passo correto era reconhecer que extrapolação de 7 dias não gera sinal útil.
19. **Artifact mock com toggle Antes/Depois antes de qualquer push em decisões visuais.** Alinha expectativas em 1 turno em vez de 2-3 ciclos de iteração (prática validada em v12, v17, v18).
20. **Claude Design não gera lógica de cálculo.** Em v17/v18, o Open Design gerou `computeInsights` com 140 linhas de campos chutados — descartado integralmente. Claude Design só estrutura visual; lógica real é do Claude + Code.
21. **"Ao calcular percentual de aderência, conta só categorias COM limite."** Categoria sem limite no numerador = percentual fantasma (ex: 124% em v18).
22. **Cópia de UI nunca usa "acima/abaixo/lados"** — a posição depende do scroll e do viewport no mobile. O texto "clique no botão acima" pode se referir a algo abaixo do fold.
23. **Ritual anti-cache é obrigatório.** Muitos "bugs" reportados eram cache do Safari servindo a versão anterior.
24. **Inteligência analítica raramente bate honestidade de dados em UX financeira.** Realizado, Planejado, Sobra são mais confiáveis que derivações que parecem espertas mas exigem contexto para interpretar.
25. **`status === 'bad'` vs `status === 'over'` — duas lógicas paralelas.** `plnStatus()` retorna `cls: 'bad'` mas `adjustedUsage` definia `status: 'over'`. Bug silencioso descoberto na v12.
26. **"CSS órfão" tem dois sabores muito diferentes.** `fides-transacoes-bulk.css` (sem JSX correspondente) = candidato a reaproveitamento. `fides-diario.css` (com JSX funcional mas nunca montado) = feature inteira descartada.
27. **Fix de "arquivo ausente do index.html" nem sempre é a correção certa.** Primeiro verificar se o componente correspondente está montado na navegação.
28. **`raw_user_meta_data` pode ficar defasado.** Trigger só dispara em INSERT, não em UPDATE. Para edição de nome no perfil: atualizar `profiles.name` + `setUserName` no store (dois targets).

---

## 19. Skills de Design Mapeadas

| Skill | Status | Momento de uso |
|---|---|---|
| `impeccable-design-polish` | ✅ Aprovada — uso imediato | Auditoria visual pré-lançamento (iniciada em v15, a concluir) |
| `emilkowalski-motion` | ✅ Aprovada — uso imediato | Micro-interações CSS após polish (ordem importa: polish → motion) |
| `design-brief` | ⏸️ Futuro próximo | Ao projetar Metas/Dívidas/Família via Claude Design |
| `high-end-visual-design` | ⏸️ Futuro | Avaliar importação de Google Fonts (ponderar performance iOS) |
| `redesign-existing-projects` | ⏸️ Pós-feedback | Após retorno de amigos/família |
| `imagegen-frontend-web` | ⏸️ Roadmap | Landing page comercial (seção por seção) |
| `faq-page` | ⏸️ Roadmap | Central de ajuda quando houver usuários |
| `imagegen-frontend-mobile` | ⏸️ Baixa prioridade | Testar uma vez antes de Metas/Dívidas/Família |

---

## 20. Roadmap de Longo Prazo

### WhatsApp (feature futura)

Arquitetura planejada:
```
Usuário → WhatsApp → Gateway (Z-API / Evolution API / Meta Cloud API)
                              ↓
                   Webhook serverless (Vercel api/whatsapp.js CommonJS)
                   ├── Identificar usuário por phone em profiles
                   ├── Chamar Gemini com contexto financeiro do usuário
                   └── Executar tools WRITE via Supabase
                              ↓
                   Resposta de texto de volta para WhatsApp
```

**Pré-requisitos:** tools WRITE funcionando e validadas no app + coluna `phone` em `profiles` + escolha do gateway.

**Opções de gateway:**

| Gateway | Custo | Pros | Cons |
|---|---|---|---|
| **Z-API** | ~R$100/mês | Popular no Brasil, fácil | Semi-oficial |
| **Evolution API** | Self-hosted grátis | Custo zero | Requer VPS |
| **Twilio WhatsApp** | ~USD 0,005/msg | Confiável, oficial | Caro em escala |
| **WhatsApp Cloud API (Meta)** | 1.000 conv/mês grátis | Oficial | Aprovação demorada |

Recomendação inicial: **Meta Cloud API** (oficial; quando o momento chegar).

### Modelos de monetização (não definidos ainda)

- Plano gratuito / Premium com funcionalidades avançadas
- WhatsApp como feature premium
- Landing page de apresentação → captar interesse

---

*Fim do Relatório Geral de Progresso — v2 a v18 · Atualizado em 28/06/2026.*
