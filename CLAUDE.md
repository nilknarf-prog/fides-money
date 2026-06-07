# fides-money — Claude Code Instructions

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
