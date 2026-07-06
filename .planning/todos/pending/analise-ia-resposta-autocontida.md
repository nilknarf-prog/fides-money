---
id: analise-ia-resposta-autocontida
created: 2026-07-06
priority: medium
source: 11-UAT (usuário)
area: api/assistant.js (SYSTEM_PROMPT / modo analysis)
severity: ux
epic: IA/WhatsApp (phases 12-14, prompt/eval)
---

# "Análise da IA" propõe ações/perguntas de follow-up que só o chat resolve

## Problema (achado na UAT da fase 11)
A "Análise da IA" (single-shot, `mode:'analysis'`) reusa o mesmo `SYSTEM_PROMPT` conversacional do chat (`api/assistant.js:178` — `fullSystem = SYSTEM_PROMPT + context`). O modelo então termina a análise com convites do tipo:
- "Podemos analisar o extrato para entender melhor... se desejar?"
- "Podemos analisar os gastos detalhados...?"

Mas a superfície de análise NÃO é um chat — o usuário não tem como responder/mandar o extrato ali. A resposta fica pendurada numa pergunta sem via de resposta.

## O que o usuário quer
A análise deve: (a) dar uma resposta **completa e autocontida**, OU (b) direcionar explicitamente o usuário ao **chat "Assistente Fides"** para o aprofundamento — nunca convidar interação inexistente na tela de análise.

## Fix sugerido
Addendum de system prompt só quando `isAnalysisMode` (não tocar o prompt do chat): instruir resposta fechada, sem perguntas de follow-up, e (opcional) encerrar apontando o chat para quem quiser detalhar. Caminho api/ sensível → security-reviewer.

## Escopo
Conteúdo de prompt — FORA do escopo da fase 11 (WR-01/02/03 + AI-TELEM-01 + AI-SHARED-01 entregues). Casa com o trabalho de prompt/eval do épico IA (fases 12-14, "base dos evals"). Pode virar quick gap-closure se o usuário quiser shippar já.
