# Fides Money — Checklist de Testes Manuais

## Recorrência e parcelamento

- [ ] Criar transação débito recorrente com número digitado livremente (ex: 7 meses) → verificar se aparece nos 7 meses seguintes
- [ ] Criar transação débito recorrente fixo → verificar se aparece em todos os meses futuros
- [ ] Criar transação crédito parcelada em 4x → verificar se aparece nos 4 meses corretos

## Contas e cartões

- [ ] Clicar em "Adicionar conta" → modal abre com campos nome, tipo, banco, saldo inicial
- [ ] Preencher e confirmar → nova conta aparece na lista
- [ ] Clicar em "Adicionar cartão" → modal abre com campos nome, bandeira, limite, vencimento, fechamento
- [ ] Preencher e confirmar → melhor data calculada automaticamente, cartão aparece na lista

## Orçamento

- [ ] Expandir categoria em qualquer mês → apenas transações daquele mês aparecem (não meses anteriores)

## Assistente Fides

- [ ] Botão do assistente no masthead exibe ícone FidesMark (símbolo da marca)
- [ ] FAB flutuante exibe ícone FidesMark
- [ ] Hover no FAB exibe apenas "Conversar com o Fides"
- [ ] Sem FIDES_CLAUDE_KEY definida → painel exibe mensagem de instrução para configurar a chave
- [ ] Com FIDES_CLAUDE_KEY definida (via console: `window.FIDES_CLAUDE_KEY = "sk-ant-..."`) → assistente responde normalmente
- [ ] Descrever uma transação em texto (ex: "gastei R$50 no mercado hoje no débito") → assistente detecta e exibe botão "Confirmar lançamento"
- [ ] Clicar em "Confirmar lançamento" → transação aparece na lista de transações

## Como abrir o app para testar

### Opção 1 — Live Server (VS Code) — recomendado para este projeto

O Fides Money usa `fetch()` no assistente e carrega módulos via CDN. Para evitar erros de CORS ao chamar a API Anthropic, use um servidor local:

1. Instale a extensão **Live Server** no VS Code (ritwickdey.LiveServer)
2. Abra a pasta `Fides Money` no VS Code
3. Clique com o botão direito em `Fides-app.html` → **Open with Live Server**
4. O browser abrirá em `http://127.0.0.1:5500/Fides-app.html`

> Esta é a forma recomendada: o Live Server serve os arquivos localmente, evitando restrições de CORS que bloqueiam chamadas `fetch()` a APIs externas quando a página é aberta via `file://`.

### Opção 2 — Abertura direta pelo sistema de arquivos

1. Navegue até a pasta `Fides Money` no Windows Explorer
2. Dê duplo clique em `Fides-app.html`
3. O browser abrirá via protocolo `file://`

> ⚠️ **Limitação:** A chamada do assistente à API Anthropic pode ser bloqueada por restrições de CORS no protocolo `file://`. Tudo mais no app funciona normalmente — apenas o assistente requer servidor local.

### Como configurar a chave do assistente

No console do browser (F12 → Console), antes de usar o assistente:

```js
window.FIDES_CLAUDE_KEY = "sk-ant-SUA_CHAVE_AQUI"
```
