# Bug Investigation & Resolution Methodology

**Data:** 2026-06-28
**Autor:** Antigravity (Gemini) / Claude
**Contexto:** Investigação de uma "White Screen of Death" no React após um refactor grande (M4 - Ciclo de Fatura).

## Problema Original
Após aplicar as mudanças da Fase M4 (refatoração do modal de fatura e estrutura de `faturasDoCartao`), a página "Contas & Cartões" passou a retornar apenas uma tela branca (crash do React) no ambiente Vercel.

Uma correção inicial focou em "Invalid Date" e componentes de ícone `<Icon.ChevronLeft />` indefinidos. No entanto, o problema central (o que causava o crash em todos os cartões na hora de renderizar) passou despercebido.

## A Metodologia do Claude Opus 4.8
Para encontrar a falha que agentes anteriores perderam, o Claude executou a seguinte sequência de debugging:

### 1. Levantamento de Estado e Git Log
Antes de tudo, o Claude verificou o status da árvore de trabalho e o log dos últimos commits:
- `git log --oneline -8`
- `git status --short`
Isso serve para entender exatamente quais commits englobaram a feature causadora do bug e o que foi "corrigido" nas tentativas falhas.

### 2. Leitura Rápida das Mudanças (Diffing)
Em vez de ler os arquivos inteiros cegamente, ele usou um diff filtrado focando em **"acessos de propriedades arriscados"**:
```bash
git diff <commit_anterior> HEAD -- assets/fides-contas.jsx | grep -nE "^\+" | grep -iE "\.replace|\.toLocale|\.split|\.getDate|\.find|Icon\.|\.txs|\.total|\.dt"
```
*Por que isso é poderoso?* Em React puro (sem TypeScript), 90% das telas brancas vêm de `Cannot read properties of undefined (reading 'X')`. Filtrar por `.` (acesso a propriedades) nas linhas recém-adicionadas revela as "minas terrestres".

### 3. Identificação e Validação do Bug
O Claude rapidamente encontrou a referência a `faturaTxs` no JSX.
- Fez um `grep` pelo nome da variável no arquivo e constatou que ela era **referenciada mas nunca declarada** no novo escopo do código refatorado.
- *Erro:* Em JavaScript/React, usar uma variável não declarada num componente acarreta num `ReferenceError` imediato no render loop.

### 4. Correção Cirúrgica e Proteção
- O Claude não reescreveu o componente; ele apenas adicionou a linha declarando a variável a partir de `faturaDestaque?.txs || []`.
- Validou mentalmente se o `activeFatura` do modal sofria o mesmo problema. Mas confirmou que o modal era protegido por `faturas.length > 0`, logo o crash era restrito ao card.

## Aprendizados para Agentes (Gemini / Claude)

1. **Sempre rastreie variáveis órfãs:** Quando refatorar um componente React grande, certifique-se de que variáveis que antes eram extraídas ou declaradas (como `faturaTxs`) ainda estão sendo definidas.
2. **"Tela Branca" = Acesso Inválido ou ReferenceError:** Se o usuário relatar tela branca no React, faça um diff entre a versão funcional (commit prévio) e a versão atual, procurando especificamente por propriedades chamadas ou variáveis.
3. **Não pare na primeira correção:** Se você encontrou um bug (ex: parsing de data), continue checando o resto do arquivo. Erros de "ReferenceError" são estáticos e podem ser encontrados fazendo grep pelas variáveis recém usadas.
4. **Use comandos de shell de forma inteligente:** Para agilizar, greps de Regex no `git diff` são incrivelmente mais rápidos do que ler milhares de linhas com a tool de `view_file` aleatoriamente.
