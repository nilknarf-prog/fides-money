# fides-money — Claude Code Instructions

## Escrita humana (regra global — sempre ativa)

**Toda vez que o Claude escrever qualquer texto** — resumo, explicação, análise, resposta, documento, e-mail, post, apresentação, comentário de código ou qualquer outra saída em linguagem natural — leia `.claude/skills/humanizer-zh/SKILL.md` e aplique seus princípios **antes de entregar o resultado**.

Isso inclui:
- Pedidos de "resumo", "explica", "descreve", "escreve", "redige"
- Qualquer resposta longa em prosa (mais de 2 parágrafos)
- Textos para apresentação, pitch, post, e-mail, relatório
- Reescritas e revisões de texto

### Regras obrigatórias para todo texto (adaptadas ao português)

1. **Sem travessões (—).** Substitua por vírgula, ponto ou reescreva a frase. Nunca use `—`.
2. **Sem palavras-AI.** Proibido: "além disso", "é importante destacar", "cabe ressaltar", "é fundamental", "nesse contexto", "no entanto", "dessa forma", "portanto" como muleta de transição, "robusto", "abrangente", "estratégico" sem conteúdo real.
3. **Sem estrutura negativa dupla.** Evite "não apenas… mas também…", "não se trata de… e sim de…".
4. **Sem trios automáticos.** Não liste 3 itens só para parecer completo. Use 2 ou 4.
5. **Varie o ritmo.** Alterne frases curtas com longas. Nunca três seguidas do mesmo comprimento.
6. **Sem conclusões vagas.** Não termine com "o futuro é promissor", "um passo na direção certa", "grandes desafios pela frente".
7. **Confie no leitor.** Não explique a metáfora. Não repita a ideia com outras palavras logo em seguida.
8. **Tom certo para o contexto.** Formal quando necessário, direto sempre. Se o usuário pedir um tom específico, mantenha-o — mas humano.

### Gatilhos que ativam essa regra

- "escreve um resumo", "faz um texto sobre", "explica isso", "redige um e-mail"
- "descreve", "elabora", "me dá uma visão geral"
- Qualquer pedido de saída em prosa

## Apresentações HTML / PPT / PPTX

Sempre que o usuário pedir uma apresentação, slides, deck, pitch, ou qualquer saída em HTML apresentável ou PPT/PPTX, ative **ambas** as skills abaixo em conjunto:

1. **`/frontend-slides`** — responsável pela estrutura da apresentação: viewport 16:9, animações, navegação entre slides, conversão de PPTX e templates visuais.
2. **`/frontend-design`** — responsável pela identidade visual: tipografia distinta, paleta coesa, motion design, composição espacial e estética fora do padrão genérico.

### Fluxo obrigatório para apresentações

- Leia `.claude/skills/frontend-slides/SKILL.md` e `.claude/skills/frontend-design/SKILL.md` antes de gerar qualquer slide.
- Use as diretrizes de design do `frontend-design` para definir a estética (tipografia, cores, motion).
- Use as regras técnicas do `frontend-slides` para a estrutura (stage 1920×1080, `viewport-base.css`, zero dependências).
- Pergunte ao usuário se o deck é **speaker-led** (pouco texto, visual forte) ou **reading deck** (mais conteúdo por slide).
- Entregue um único arquivo `.html` autocontido, sem dependências externas.

### Gatilhos que ativam esse fluxo

- "crie uma apresentação", "faça slides", "quero um deck", "pitch em HTML"
- "converta esse pptx", "transforme em apresentação web"
- Qualquer menção a `.pptx`, `.ppt`, slides ou apresentação visual
