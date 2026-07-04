---
status: testing
phase: 09-transacoes-power-tools-analytics
source: [09-VERIFICATION.md]
started: 2026-07-04T01:29:00Z
updated: 2026-07-04T01:29:00Z
---

## Current Test

number: 1
name: ⌘K command palette abre, busca e navega de qualquer página
expected: |
  Pressionar Cmd+K (Mac) / Ctrl+K (Windows) em qualquer página do studio, ou clicar no campo de busca do masthead, abre o CommandPalette; digitar um termo mostra resultados de transações/contas/cartões/categorias; escolher um resultado navega e fecha o palette; navegar por fora dele (sidebar) também fecha; Escape fecha.
awaiting: user response

## Tests

### 1. TX-07 — ⌘K command palette
expected: Cmd/Ctrl+K (ou clique no campo de busca do masthead) abre o CommandPalette em qualquer página; digitar mostra resultados de transações/contas/cartões/categorias; escolher navega e fecha; navegar por fora (sidebar) também fecha; Escape fecha.
result: [pending]

### 2. TX-01 — filtro de Cartões dedicado
expected: Em Transações → "Filtros avançados", marcar só cartões e usar "Selecionar todos os cartões"; a lista mostra só transações cujo `acctInfo.kind === 'cartao'`; o atalho marca/desmarca todos os cartões em toggle.
result: [pending]

### 3. TX-02 — paginação 20/50/100
expected: Trocar o seletor de itens por página entre 20/50/100 e navegar Anterior/Próxima num mês com >20 lançamentos; a contagem de linhas renderizadas muda conforme o seletor; "Página N de M" atualiza; botões desabilitam nos limites; trocar filtro/sort/mês reseta para página 1.
result: [pending]

### 4. TX-03 / TX-04 — modo Período (range) + analytics cross-month
expected: Ativar modo "Período" com presets 3m/6m/12m/Ano e "Custom"; a lista mostra transações de vários meses juntas; o painel de gasto por categoria (Donut/CategoryChart) reflete o intervalo e exclui `is_transfer`; trocar presets atualiza os dois imediatamente; voltar a "Mês único" restaura o comportamento anterior; ativar Período na primeira carga da página NÃO gera erro `undefined.split` no console.
result: [pending]

### 5. TX-05 — export CSV seguro (CSV-injection) + range-aware
expected: Exportar CSV com uma transação/categoria/conta cuja descrição/nome comece com `=`, `+`, `-`, ou `@`; abrir no Excel/LibreOffice; as três colunas (descrição, categoria, conta) aparecem prefixadas com aspa simples e são lidas como texto puro, não executadas como fórmula; em modo range o CSV contém linhas de múltiplos meses e o nome do arquivo inclui o intervalo.
result: [pending]

### 6. TX-06 — persistência localStorage (page-local, resiliente)
expected: Aplicar sort/filtro/pageSize/range em Transações, dar F5 → tudo persiste; o mês global (Dashboard) NÃO muda ao abrir/recarregar Transações; corromper `fides:tx.state` no DevTools e recarregar → app cai no default sem quebrar nem erro no console.
result: [pending]

### 7. TX-08 — preview de limite no Nova Transação
expected: Em Planejamento, definir um limite para uma categoria; abrir Nova Transação, escolher essa categoria e digitar valores próximos/acima do limite; o preview "após esta transação: R$X restante de R$Y" aparece só para categorias com limite, atualiza a cada dígito, muda de cor (ok/warn/over) e mostra o aviso "limite do mês atual — parcelas futuras não avaliadas".
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
