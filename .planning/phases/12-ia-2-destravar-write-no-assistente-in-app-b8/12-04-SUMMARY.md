# Plan 12-04 Summary

- **SD-1 (criar_categoria no fluxo de confirmação):** A tool `criar_categoria` foi movida para o fluxo de confirmação visual (`TOOLS_REQUIRING_CONFIRMATION`), removendo o executor direto. Isso também mata o P5 (toast falso aparecendo antes do tempo).
- **Nonce Threading (Cliente):** A função `callAssistant` agora suporta o envio e o recebimento efêmero de nonce (D-06). A variável `lastNonce` garante que um `toolResult` gerado seja atrelado ao mesmo nonce de seu turno, prevenindo cobranças duplicadas de cota.
- **Flag de Pendência:** Um novo `React.useEffect` no topo do componente atualiza `window.__fidesWriteConfirmPending` globalmente sempre que há uma tela de confirmação WRITE pendente, para permitir a checagem no event-time do `keydown` do `fides-studio.jsx` (Plan 12-05).
