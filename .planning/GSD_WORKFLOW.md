# Workflow GSD (Get Shit Done) - Guia de Execução

Este documento formaliza o workflow baseado nas skills GSD (Get Shit Done) para garantir a consistência de execução, independentemente do agente de IA (Claude ou Gemini) que você estiver utilizando. 

A premissa fundamental deste workflow é: **Nenhuma execução acontece sem planejamento prévio e documentação estrita**. O Gemini a partir de agora adotará este comportamento, seguindo os passos de forma sequencial e sugerindo ativamente os próximos comandos GSD.

---

## 1. Inicialização e Gestão de Milestones

Antes de qualquer código ser escrito, o projeto e o ciclo de trabalho precisam estar bem definidos.

*   **/gsd-new-project**: Usado no início absoluto do projeto para criar o `PROJECT.md` e reunir o contexto profundo.
*   **/gsd-new-milestone**: Usado quando um ciclo de trabalho (milestone) anterior foi concluído e precisamos iniciar a próxima versão/fase do projeto, atualizando o `PROJECT.md`.
*   **/gsd-phase**: Para adicionar, remover ou editar fases no `ROADMAP.md`.

## 2. Especificação e Descoberta (Opcional, mas Recomendado)

Para fases complexas, antes de planejar *como* fazer, precisamos definir claramente *o que* fazer.

*   **/gsd-explore** / **/gsd-spike** / **/gsd-sketch**: Para exploração socrática, testes técnicos rápidos (spikes) ou prototipação de UI descartável.
*   **/gsd-spec-phase**: Esclarece ambiguidade e cria um contrato sobre o que a fase vai entregar (`SPEC.md`).
*   **/gsd-ui-phase**: Para fases de frontend, cria o contrato de design de interface (`UI-SPEC.md`).

## 3. Planejamento da Fase (Etapa Crítica)

Esta é a etapa que diferencia este workflow. **Nunca pulamos direto para a execução.**

*   **/gsd-discuss-phase**: Inicia uma discussão interativa para coletar o contexto da fase através de perguntas antes de criar o plano.
*   **/gsd-plan-phase**: (O MAIS IMPORTANTE) Cria um plano detalhado de implementação (`PLAN.md`) dentro de `.planning/phases/`. Ele quebra a execução em etapas verificáveis.

> [!IMPORTANT]
> É aqui que o Claude e o Gemini devem parar e pedir que você valide o `*-PLAN.md` (e o `*-UI-SPEC.md`, se aplicável).

## 4. Execução da Fase

Com o `PLAN.md` aprovado, a IA inicia as mudanças no código de forma estruturada.

*   **/gsd-execute-phase <numero>**: Executa os passos definidos no `PLAN.md` em ondas paralelas ou sequenciais. (Ex: `/gsd-execute-phase 1`).
*   **/gsd-manager**: Permite gerenciar o andamento de múltiplas fases simultaneamente através do terminal.
*   **/gsd-progress**: O comando situacional unificado. Se não souber onde parou, use este comando para que a IA analise o status e sugira o próximo passo.
*   **/gsd-workstreams**: Para gerenciar tarefas menores sendo executadas em paralelo.

## 5. Revisão e Verificação (Quality Gates)

Após a execução, o trabalho deve ser validado contra o plano original.

*   **/gsd-code-review**: Analisa as mudanças feitas em busca de bugs, falhas de segurança e problemas de qualidade.
*   **/gsd-verify-work**: (UAT - User Acceptance Testing). Validação conversacional dos recursos construídos.
*   **/gsd-ui-review**: Para frontend, realiza uma auditoria visual em 6 pilares para garantir que o design premium foi implementado.

## 6. Conclusão e Entrega

Finalizando a fase atual e preparando o terreno para a próxima.

*   **/gsd-ship**: Cria o PR (se aplicável), roda revisões finais e prepara o código para merge.
*   **/gsd-extract-learnings**: Extrai padrões, decisões e surpresas para atualizar a base de conhecimento do projeto.
*   **/gsd-cleanup** / **/gsd-complete-milestone**: Arquiva fases concluídas e prepara para o próximo ciclo.

---

## Como o Gemini atuará a partir de agora (Sincronia com o Claude)

Para garantir que você possa alternar as ferramentas sem atrito:

1.  **Sem atalhos na execução:** O Gemini nunca mais pulará a fase de planejamento. Se você pedir para executar algo, ele primeiro lerá ou invocará o `/gsd-plan-phase`.
2.  **Transições explícitas:** O Gemini sempre lerá os arquivos persistidos pelo Claude (como `*-PLAN.md` e `*-UI-SPEC.md`) no diretório `.planning/phases` antes de iniciar a execução via `/gsd-execute-phase`.
3.  **Sugestão de Próximos Passos:** Ao final de cada etapa (ex: após planejar, ou após executar), o Gemini sugerirá ativamente o próximo comando GSD aplicável (ex: *"Fase X concluída. Recomendo usar o `/gsd-code-review` ou `/gsd-verify-work` agora"*).
4.  **Respeito à Memória Persistente:** O Gemini utilizará as skills para ler logs do `.planning` entendendo o contexto deixado pelo Claude, permitindo uma transição perfeita.
