# Fides Money — Modelo de Briefing + Último Briefing (v18)

> Este arquivo tem duas partes:
> **Parte A** — Modelo canônico (template a ser preenchido a cada lote)
> **Parte B** — Último briefing vigente (estado pós v18 · 28/06/2026)

---

# PARTE A — MODELO CANÔNICO DE BRIEFING

> Preencher este template a cada novo chat ou novo lote de execução.
> Seções marcadas com `[PREENCHER]` são variáveis por sessão. O restante é fixo ou quase fixo.

---

## BRIEFING DE EXECUÇÃO — LOTE [PREENCHER: número/nome]

**Data:** [PREENCHER]
**Sessão anterior:** v[PREENCHER]
**Primeira tarefa:** [PREENCHER — descrição em 1 frase]

---

### 1. CONTEXTO DO PROJETO (bloco de memória — repetir sempre)

**Fides Money** — app de finanças pessoais PT-BR.

| Dado | Valor |
|---|---|
| Stack | React 18 Babel standalone (sem bundler), CSS puro com tokens, Supabase, Vercel |
| Viewport canônico | **400×512px iOS Safari** (mobile-first) |
| Repo | `github.com/nilknarf-prog/fides-money` |
| Supabase project | `nhwarucfecoqcahcosga` |
| Produção | `fides-money.vercel.app` |
| Working tree autenticado | `/home/user/fides-money` (NUNCA push de `/tmp`) |
| Último commit em `main` | [PREENCHER: hash + descrição curta] |
| MCP disponível | Supabase (`execute_sql`, `apply_migration`) — **usar antes de auditar código** |

**Regra de ouro:** toda feature deve funcionar em 400×512px iOS antes do push.

---

### 2. ARQUIVOS PROTEGIDOS (nunca tocar sem aprovação)

```
fides-data.jsx   fides-charts.jsx   tokens.css
design-canvas.jsx   tweaks-panel.jsx   Fides-app.html
```

---

### 3. DECISÕES TRAVADAS (não reabrir)

- Stack imutável (React 18 Babel, CSS puro, Supabase, Vercel)
- Dashboard live = `DashboardStudio` em `fides-studio.jsx` (não `fides-dashboard.jsx`)
- `tokens.css` = primeiro CSS no `index.html`; `api/*.js` = CommonJS, nunca ESM
- Saldo derivado: `balance = opening_balance + SUM(value WHERE status='cleared')` via RPC `recalc_account_balance`
- Pendente nunca afeta o saldo
- `is_transfer=true` exclui das agregações de gasto (mas afeta saldo)
- `tx.acct` = id de conta OU cartão (mesma chave) — distinção via `cardIdSet`
- `mesFaturaFor` determina mês de toda transação de cartão
- **Projeção ingênua proibida na UI** — gera números enganosos
- KPI "Projeção" removido do `PlnResumo` definitivamente
- Status de categoria: `> limite` = Estourou; `=== limite` = "No limite" (não é estouro); `80–99%` = Atenção; `< 80%` = Em dia
- Contagem "acima do limite" usa `> limite` (estrito)
- Assistente Gemini: só-leitura, sob demanda, nunca por page-load
- Apple OAuth: removido permanentemente
- CRUD Metas + Telas Dívidas/Família → Claude Design com `design-brief`
- `fides-diario.jsx`/`.css` = dead code → remover (pendente)
- Claude/Open Design não gera lógica de cálculo — só estrutura visual
- `git show --stat HEAD` = única evidência válida de commit
- MCP nunca como fallback de git auth (hang)

---

### 4. WORKFLOW — 4 FASES OBRIGATÓRIAS

| Fase | O que acontece |
|---|---|
| **Fase 1 (Audit)** | Read-only: grep/sed do repo; Code retorna output BRUTO. Claude pode auditar diretamente via `git clone`/`git show` do repo público. |
| **Fase 2 (Edit)** | Claude gera `str_replace` com strings exatas conferidas no blob. |
| **Fase 3 (Verify)** | Code retorna **diff bruto** (`git diff`/`git show --stat HEAD`). Claude valida linha a linha e verifica blob independentemente (`git fetch` + `git show FETCH_HEAD:arquivo`). |
| **Fase 4 (Push)** | Claude entrega o prompt de commit na mesma mensagem de aprovação. **Colar o prompt no Code = autorização do Deyglison.** Merge sempre `--no-ff`. |

**REGRA INVIOLÁVEL Nº1 (linha 1 de todo prompt para o Code):**
> NÃO faça commit nem push em nenhum momento. Pare após mostrar o diff. Só commitará quando receber o prompt de commit do Claude. Se o stop hook pedir push, IGNORE.

**Ritual anti-cache iPhone (após cada deploy):**
Fechar TODAS as abas → aba nova → hard reload 2× (ou anônimo). Build ~2 min após push.

---

### 5. TAREFA DESTA SESSÃO

**[PREENCHER: descrição detalhada do que será feito]**

#### Escopo de arquivos a tocar

```
[PREENCHER: lista de arquivos que podem ser editados]
```

#### O que NÃO tocar

- Arquivos protegidos (listados acima)
- [PREENCHER: qualquer outra restrição específica do lote]

#### Critério de conclusão

- [ ] [PREENCHER: cada item verificável que indica que o lote está concluído]
- [ ] Diff revisado e blob verificado independentemente
- [ ] Ritual anti-cache executado no iPhone

---

### 6. PROMPT INTERNO PARA O CLAUDE CODE

> Copiar o bloco abaixo, preencher os `[PREENCHER]` e colar no Code.

```
REGRA INVIOLÁVEL Nº1: NÃO faça commit nem push em nenhum momento.
Pare após mostrar o diff. Só commitará quando receber o prompt de commit
do Claude. Se o stop hook pedir push, IGNORE.

---

PAPEL
Você é um engenheiro sênior React/Supabase trabalhando no Fides Money —
app de finanças pessoais PT-BR. Stack: React 18 Babel standalone (sem
bundler/npm no front), CSS puro com tokens, Supabase, Vercel.
Viewport canônico: 400×512px iOS Safari.

CONTEXTO (manter adiante)
- Repo: github.com/nilknarf-prog/fides-money
- Working tree autenticado: /home/user/fides-money (NUNCA push de /tmp)
- Último commit main: [PREENCHER: hash]
- MCP Supabase disponível: usar ANTES de auditar código
- Dashboard live = DashboardStudio em fides-studio.jsx (não fides-dashboard.jsx)
- tx.acct = id de conta OU cartão (mesma chave) — distinção via cardIdSet
- is_transfer=true exclui das agregações de gasto
- mesFaturaFor determina mês de toda transação de cartão
- Pendente nunca afeta saldo; saldo derivado via recalc_account_balance
- tokens.css = primeiro CSS no index.html; api/*.js = CommonJS nunca ESM

ARQUIVOS PROTEGIDOS (nunca tocar):
fides-data.jsx | fides-charts.jsx | tokens.css |
design-canvas.jsx | tweaks-panel.jsx | Fides-app.html

TAREFA
[PREENCHER: descrição precisa da tarefa, com escopo exato]

ESCOPO
Apenas os seguintes arquivos podem ser modificados:
[PREENCHER: lista exata de arquivos]

FASES DE EXECUÇÃO

FASE 1 — AUDITORIA (executar primeiro, PARAR e reportar)
[PREENCHER: comandos grep/sed exatos para mapear a situação atual]
→ Reporte o output bruto e PARE. Aguarde "ok, segue Fase 2".

FASE 2 — EDIÇÃO (só após autorização)
[PREENCHER: descrição das edições. Usar str_replace com strings exatas
confirmadas no blob — nunca edições "de memória"]

FASE 3 — VERIFICAÇÃO (após edição, PARAR e reportar)
Execute:
  git diff HEAD
  [PREENCHER: greps de confirmação, ex: grep -c "classe-nova" arquivo.jsx]
Reporte o output BRUTO e PARE. Aguarde o prompt de commit.

PARAR-E-PERGUNTAR antes de:
- Deletar qualquer arquivo
- Alterar schema do Supabase (DDL/RPC)
- Alterar qualquer decisão de arquitetura travada

SINAL DE PROGRESSO
Após cada fase concluída, emita: ✅ [o que foi concluído] e aguarde.

ANCORAGEM ANTI-FABRICAÇÃO
Afirme apenas o que verificou no repositório.
git show --stat HEAD é a única evidência válida de commit.
Não invente confirmações nem descreva em prosa algo que não verificou.
```

---

### 7. PRÓXIMOS PASSOS (após este lote)

| # | Item | Prioridade |
|---|---|---|
| [PREENCHER] | [PREENCHER] | [PREENCHER] |

---

### 8. DECISÕES PENDENTES (do Deyglison)

- [PREENCHER: perguntas que precisam de resposta antes do próximo lote]

---

*[PREENCHER: data] — Fim do briefing v[PREENCHER].*

---
---
---

# PARTE B — ÚLTIMO BRIEFING VIGENTE (v18 · 28/06/2026)

> Estado real do projeto após a sessão v18.
> Use este briefing para abrir um novo chat.

---

## BRIEFING DE EXECUÇÃO — PÓS LOTE E (Tendência por R$ Real)

**Data:** 28 de junho de 2026
**Sessão anterior:** v18 (Lotes A–E — Insights do mês completos)
**Primeira tarefa sugerida:** Remover `fides-diario.*` (dead code)

---

### 1. CONTEXTO DO PROJETO

**Fides Money** — app de finanças pessoais PT-BR. Em produção. Fase friends-and-family.

| Dado | Valor |
|---|---|
| Stack | React 18 Babel standalone (sem bundler), CSS puro com tokens, Supabase, Vercel |
| Viewport canônico | **400×512px iOS Safari** (mobile-first) |
| Repo | `github.com/nilknarf-prog/fides-money` |
| Supabase project | `nhwarucfecoqcahcosga` |
| Produção | `fides-money.vercel.app` |
| Working tree autenticado | `/home/user/fides-money` (NUNCA push de `/tmp`) |
| **Último commit em `main`** | **`dfd640e`** (Lote E — tendência por R$ real) |
| MCP disponível | Supabase (`execute_sql`, `apply_migration`) — usar antes de auditar código |

**Regra de ouro:** toda feature deve funcionar em 400×512px iOS antes do push.

---

### 2. ARQUIVOS PROTEGIDOS (nunca tocar sem aprovação)

```
fides-data.jsx   fides-charts.jsx   tokens.css
design-canvas.jsx   tweaks-panel.jsx   Fides-app.html
```

---

### 3. O QUE FOI ENTREGUE NA SESSÃO ANTERIOR (v18)

A sessão v17→v18 resolveu a engine de Insights do mês em 5 lotes cirúrgicos:

| Lote | Commit | O que foi feito |
|---|---|---|
| A | `063ed65` | `plnStatus` com estado "No limite"; contagem estrita `>`; remoção de projeção ingênua (`warnCats`) |
| B | `78be620` | `computeInsights` + `PlnMesInsights` + CSS (68 linhas); botão "Análise da IA" (stub) |
| C | `b246749` | Corrige percentual fantasma 124% (`spentLimited`); ação sugerida = maior R$ |
| D | `e07ccd4` | Ação sugerida por prioridade de grupo (`CUT_PRIORITY`): estilo→dívida→essencial |
| E | `dfd640e` | Tendência exige base ≥ R$100 E alta ≥ R$100; ordena por R$; exibe "R$ X (~Y%)" |

**Todos os lotes verificados por blob real.** Arquivos tocados: apenas `fides-orcamento.jsx` e `fides-orcamento.css`.

**Contexto de auditoria:** Open Design gerou `computeInsights` de 140 linhas com campos chutados (`g.id`, `store.categoryLimits[].byMonth`, `window.Icon.*`) — **descartado integralmente**. Refeito com auditoria de campos reais.

---

### 4. ESTADO ATUAL DO APP

#### Funcionando em produção ✅

- Auth (email/senha + Google OAuth)
- Transações: cards alta densidade, sort/filtros, bulk actions, ⋯ menu
- Planejamento: limites por categoria (3 escopos), `PlnResumo` (3 KPIs: Realizado, Planejado, Sobra), `PlnMesInsights` (insights determinísticos), botão "Análise da IA" (stub)
- Contas & Cartões: CRUD, modal Pagar fatura selecionável, transferência
- Metas: somente leitura (CRUD não implementado)
- Assistente Fides: Gemini Flash-Lite, só-leitura, sob demanda
- Saldo derivado via RPC (`opening_balance + SUM(cleared)`)
- Delete de transação e transferência: RPC atômico com estorno de saldo
- `ConfirmDialog` + `Toast` globais via `window.FidesUI`
- Lote 6: copiar limites + sugerir pela média + preview com confirmação seletiva
- Tela de Perfil: nome editável, avatar, rota `'perfil'`
- Ciclo de fatura correto via `mesFaturaFor` (corrigido em v11)

#### Schema Supabase (verificado via MCP)

| Tabela | Status |
|---|---|
| `profiles` | ✅ com `group_targets jsonb` (default 50/30/20) |
| `accounts` | ✅ com `opening_balance` (saldo derivado v16) |
| `cards` | ✅ com `closing_day` |
| `transactions` | ✅ 100% consistentes (date/month) |
| `goals` | ✅ existe, CRUD não exposto |
| `user_categories` | ✅ |
| `assistant_usage` | ✅ logs do assistente |
| `category_limits` | ✅ criada via MCP em v9 |

**RPCs ativas:** `recalc_account_balance`, `set_account_balance` (com guarda de dono), `delete_transaction`, `transfer_funds`, `pay_card_invoice`

---

### 5. DECISÕES TRAVADAS (não reabrir)

- Stack imutável (React 18 Babel, CSS puro, Supabase, Vercel)
- Dashboard live = `DashboardStudio` em `fides-studio.jsx`
- `tokens.css` = primeiro CSS no `index.html`; `api/*.js` = CommonJS nunca ESM
- Saldo derivado: `balance = opening_balance + SUM(value WHERE status='cleared')` via `recalc_account_balance`
- Pendente nunca afeta o saldo; `set_account_balance` tem guarda de dono
- `is_transfer=true` exclui das agregações de gasto (mas afeta saldo)
- `tx.acct` = id de conta OU cartão (distinção via `cardIdSet`)
- `mesFaturaFor` determina mês de toda transação de cartão
- **Projeção ingênua proibida na UI** — KPI "Projeção" removido definitivamente
- Status de categoria (`plnStatus`): `>1` Estourou (vermelho) · `===1` "No limite" (#4A574F/#E8EAE4, NÃO é estouro) · `0.8-<1` Atenção (âmbar) · `<0.8` Em dia (verde)
- Contagem "acima do limite" usa `> limite` (estrito — 100% não entra)
- `spentLimited` = só categorias COM limite (percentual da meta do grupo)
- `g.spent` (total) permanece para distribuição 50/30/20
- "No ritmo de estourar" só com ≥2 meses de histórico
- Ação sugerida prioriza: estilo (0) → dívida (1) → essencial (2), depois maior R$
- Tendência: base ≥ R$100 E alta ≥ R$100; ordena por R$; exibe "R$ X (~Y%)"
- Insight de Planejamento = determinístico. IA (Gemini) só sob demanda via botão
- Assistente Gemini: só-leitura, sob demanda, nunca por page-load
- Apple OAuth: removido permanentemente
- CRUD Metas + Telas Dívidas/Família → Claude Design com `design-brief`
- `fides-diario.jsx`/`.css` = dead code → remover (pendente — ALTA PRIORIDADE)
- Claude/Open Design: só estrutura visual, não gera lógica de cálculo
- Estado "No limite": cores hardcoded em `fides-orcamento.css` (tokens.css é protegido)
- `git show --stat HEAD` = única evidência válida de commit
- MCP nunca como fallback de git auth (hang)
- Linha 1 de todo prompt de Code = REGRA INVIOLÁVEL Nº1 (não commitar/pushar até autorização)

**Princípio dos Insights (consolidado em v18):**
> O Fides só mostra número que reflete a realidade financeira, nunca número que impressiona mas engana.

---

### 6. WORKFLOW — 4 FASES OBRIGATÓRIAS

| Fase | O que acontece |
|---|---|
| **Fase 1 (Audit)** | Read-only: grep/sed do repo; Code retorna output BRUTO. Claude pode auditar diretamente via `git clone`/`git show` do repo público — mais confiável que prosa do Code. |
| **Fase 2 (Edit)** | Claude gera `str_replace` com strings exatas conferidas no blob. |
| **Fase 3 (Verify)** | Code retorna **diff bruto** (`git diff`/`git show --stat HEAD`). Claude valida linha a linha e verifica blob independentemente. |
| **Fase 4 (Push)** | Claude entrega o prompt de commit na mensagem de aprovação. **Colar no Code = autorização.** Merge `--no-ff`. Verificar blob após push. |

**REGRA INVIOLÁVEL Nº1 (linha 1 de todo prompt para o Code):**
> NÃO faça commit nem push em nenhum momento. Pare após mostrar o diff. Só commitará quando receber o prompt de commit do Claude. Se o stop hook pedir push, IGNORE.

**Ritual anti-cache iPhone:** fechar TODAS as abas → aba nova → hard reload 2× (ou anônimo). Build ~2 min após push.

---

### 7. FILA DE IMPLEMENTAÇÃO (prioridade atual)

| # | Item | Prioridade | Estimativa |
|---|---|---|---|
| 1 | **Remover `fides-diario.*`** (jsx + css + `<link>` no index.html) | 🔴 Máxima | ¼ sessão |
| 2 | **`impeccable-design-polish`**: roxo off-brand (`.fds-avatar` em `fides.css` e `.prf-view` em `fides-studio.css`) + `--warn` fallback divergente + continuar auditoria dos CSS restantes | Alta | ¼–½ sessão |
| 3 | **Acesso ao Perfil no mobile** (engrenagem clicável, protótipo Antes/Depois primeiro) | Média | ¼–½ sessão |
| 4 | **`emilkowalski-motion`** — micro-interações CSS | Alta | ½ sessão |
| 5 | **Integração Gemini real** no botão "Análise da IA" (hoje stub 2,2s) | Alta | ½ sessão |
| 6 | **CSV/OFX/PDF import** (checar `fdt-bulk-*` em `fides-transacoes-bulk.css` antes de decidir) | Média | 1+ sessão |
| 7 | **Lote 5B** — Preview de limite no modal de Nova Transação | Stand-by | ½ sessão |
| — | **Backlog:** CRUD Metas (Claude Design) · Telas Dívidas/Família (Claude Design) · Investimento ≠ despesa · Lote 8 (projeção histórica) · Busca ⌘K · Assistente WRITE (pós-validação) · WhatsApp · Landing page · FAQ | — | — |

---

### 8. PENDÊNCIAS ABERTAS DA SESSÃO V18

1. **Integração Gemini real** no botão "Análise da IA" — Deyglison já tem chave + endpoint configurados. Próximo candidato natural após `fides-diario.*` e polish.

2. **Investimento ≠ despesa** — mudança de modelo de dados adiada conscientemente. Não urgente (sem aportes lançados hoje). Precisa de design próprio: campo novo em `transactions` OU categoria especial + UI de lançamento + lógica de agregação.

3. **Tendência com média de 2-3 meses** — melhoria futura. Hoje compara só contra mês anterior. Depende de acumular histórico.

---

### 9. PRIMEIRA TAREFA — REMOVER `fides-diario.*`

#### Contexto

`fides-diario.jsx` e `fides-diario.css` são uma versão **inteira e descartada** do Studio com identidade visual incompatível (paleta cream/gold, tipografia serifada). Nunca conectada à navegação. Descoberta na auditoria `impeccable-design-polish` (v15).

Em v15, um fix incorreto **adicionou** o `<link>` desse CSS no `index.html` (commit `f8491da`) — esse link precisa ser removido também.

#### Escopo do lote

Arquivos a tocar:
- `index.html` — remover a linha `<link>` de `fides-diario.css`
- `assets/fides-diario.jsx` — excluir arquivo
- `assets/fides-diario.css` — excluir arquivo

#### Fase 1 obrigatória antes de deletar

```bash
# Confirmar que os exports de fides-diario.jsx não são referenciados em nenhum outro arquivo
grep -rn "FidesDiario\|SectionMark\|DiaCatChip\|fides-diario" assets/ index.html --include="*.jsx" --include="*.html" --include="*.css"
# Esperado: só aparece nos 3 arquivos a remover
```

#### Critério de conclusão

- [ ] `grep -rn "FidesDiario" assets/` retorna 0 resultados fora do próprio arquivo
- [ ] `grep "fides-diario" index.html` retorna 0 resultados
- [ ] `ls assets/fides-diario.*` retorna "No such file"
- [ ] Diff mostra APENAS remoção dos 3 artefatos
- [ ] Blob verificado independentemente após push

---

### 10. PROMPT PRONTO PARA O CLAUDE CODE — REMOVER `fides-diario.*`

> Copiar e colar diretamente no Code.

```
REGRA INVIOLÁVEL Nº1: NÃO faça commit nem push em nenhum momento.
Pare após mostrar o diff. Só commitará quando receber o prompt de commit
do Claude. Se o stop hook pedir push, IGNORE.

---

PAPEL
Você é um engenheiro sênior React trabalhando no Fides Money —
app de finanças pessoais PT-BR. Stack: React 18 Babel standalone (sem
bundler), CSS puro com tokens, Supabase, Vercel.
Viewport canônico: 400×512px iOS Safari.

CONTEXTO
- Repo: github.com/nilknarf-prog/fides-money
- Working tree autenticado: /home/user/fides-money
- Último commit main: dfd640e
- Arquivos protegidos (NUNCA tocar):
  fides-data.jsx | fides-charts.jsx | tokens.css |
  design-canvas.jsx | tweaks-panel.jsx | Fides-app.html

TAREFA
Remover o dead code fides-diario.* do repositório.
fides-diario.jsx e fides-diario.css são uma versão descartada do Studio
com identidade visual incompatível (cream/gold), nunca conectada à
navegação. O commit f8491da adicionou incorretamente o <link> do CSS no
index.html — também deve ser removido.

ESCOPO (só esses arquivos podem ser tocados):
- index.html
- assets/fides-diario.jsx (excluir)
- assets/fides-diario.css (excluir)

FASE 1 — AUDITORIA (executar primeiro, PARAR e reportar)
Execute e reporte o output bruto:

grep -rn "FidesDiario\|SectionMark\|DiaCatChip\|fides-diario" assets/ index.html

Esperado: resultados SOMENTE nos 3 arquivos a remover.
Se aparecer referência em QUALQUER outro arquivo (fides-studio.jsx,
fides-shell.jsx, etc.), PARE e reporte — não prossiga sem autorização.

✅ Fase 1 concluída. Aguarde "ok, segue Fase 2".

FASE 2 — REMOÇÃO (só após autorização)
1. Remover a linha <link> de fides-diario.css do index.html
2. Excluir assets/fides-diario.jsx
3. Excluir assets/fides-diario.css
NÃO fazer commit.

FASE 3 — VERIFICAÇÃO (após remoção, PARAR e reportar)
Execute e reporte o output bruto:

git diff HEAD
grep -c "fides-diario" index.html
ls assets/fides-diario.* 2>&1

Esperado: diff mostra só remoções; grep retorna 0; ls retorna "No such file".
Reporte o output BRUTO e PARE. Aguarde o prompt de commit.

PARAR-E-PERGUNTAR antes de:
- Deletar qualquer arquivo além dos 3 listados
- Tocar em qualquer arquivo de navegação ou roteamento
- Fazer qualquer alteração além da remoção dos 3 artefatos

SINAL DE PROGRESSO
Após cada fase, emita: ✅ [o que foi concluído] e aguarde.

ANCORAGEM ANTI-FABRICAÇÃO
Afirme apenas o que verificou no repositório.
git show --stat HEAD é a única evidência válida de commit.
Não invente confirmações.
```

---

### 11. CONVENÇÕES DE DADOS (referência rápida)

```js
// Status
STATUS_TO_UI = { cleared: 'pago', pending: 'pendente', scheduled: 'agendado' }

// Campo tx.acct
// Guarda id de conta OU cartão — distinção via:
cardIdSet.has(tx.acct)  // true = cartão; false = conta

// Sinal de valor
tx.val > 0  // receita
tx.val < 0  // despesa

// Formatos de data
tx.d    = 'dd/mm'       // display
tx.date = 'YYYY-MM-DD'  // ISO, para <input type="date">
tx.mes  = 'YYYY-MM'     // índice de mês

// is_transfer
// true  → movimentação interna (excluída de receita/despesa, mas afeta saldo)
// false → transação normal

// Status de categoria (plnStatus)
// ratio = gasto / limite
ratio > 1    → { cls: 'bad',   label: 'Estourou' }
ratio === 1  → { cls: 'nolim', label: 'No limite' }   // NÃO é estouro
ratio >= 0.8 → { cls: 'warn',  label: 'Atenção' }
ratio < 0.8  → { cls: 'ok',    label: 'Em dia' }

// CUT_PRIORITY (ação sugerida)
estilo: 0  →  divida: 1  →  essencial: 2
// Nunca sugerir cortar essencial antes de supérfluo

// spentLimited (% da meta do grupo)
// Só categorias COM limite definido entram no numerador
// g.spent (total incluindo sem limite) = usado para distribuição 50/30/20
```

---

### 12. APIS DO STORE RELEVANTES (referência rápida)

```js
// Leitura
const {
  selectedMonth, setSelectedMonth, monthLabel,
  monthTransactions, prevMonthTransactions,
  accounts, cards, categories, goals,
  categoryLimits, categoryUsage,
  budgetGroups,      // [{ id, label, target, limit, spent, cats[] }]
  groupTargets,      // { essencial, estilo, divida } (0..1)
  spendByCategory,
  faturasPorCartao, faturaAbertaPorCartao,
  userName, firstName, userEmail,
  mode, isLoading, isEmpty, refreshData
} = useFides();

// Escrita
addTransaction(tx)
addTransactions(txs[])
updateTransaction(id, patch)      // patch: { desc, val, cat, acct, status, date }
deleteTransaction(id)             // RPC atômico
addAccount(acc) / updateAccount / deleteAccount
addCard(card) / updateCard / deleteCard
addCategory / updateCategory / deleteCategory / moveCategory
payCartaoFatura(...)              // RPC pay_card_invoice
transferFunds(...)                // RPC transfer_funds
setCategoryLimit(catId, val, scope, months?)
removeCategoryLimit(catId, scope, month?)
copyLimitsFromMonth(src, tgt)
computeSuggestions()              // pura/síncrona
applySuggestions(list)
setGroupTargets(patch)
resetGroupTargets()
updateProfile(name)
```

---

### 13. ARQUITETURA DE COMPUTEINSIGHTS (referência para lotes futuros)

```js
// Assinatura
computeInsights(groups, totals, prevTxs)

// groups: budgetGroups do store
// totals: { realized, planned, sobra } do PlnResumo
// prevTxs: prevMonthTransactions do store

// Campos de groups[i] usados:
// g.name, g.spent, g.limit, g.target (target_pct), g.cats[]
// g.cats[j].name, g.cats[j].spent, g.cats[j].limit

// Output: objeto insights com:
// { hasHistory, overCats, warnCats, topAction, trends, recurring, totals }

// Regras de negócio:
// - spentLimited = SUM(cats com limite) para % da meta
// - g.spent = total (incluindo sem limite) para distribuição 50/30/20
// - Ação sugerida: overByCutPriority (CUT_PRIORITY primeiro, depois maior R$)
// - Tendência: base e alta >= R$100; exibe "R$ X (~Y%)"
// - hasHistory: só se prevTxs tiver dados de categorias relevantes
```

---

*Fim do Último Briefing — v18 · 28/06/2026.*
