---
phase: 08-metas-vision-board-redesign
plan: 02
subsystem: assets
tags: [assets, presets, svg, covers, design]
dependency-graph:
  requires: []
  provides:
    - "assets/covers/<id>.svg (16 files)"
    - "preset:<id> key contract (viagem, casa, carro, reserva, educacao, casamento, bebe, saude, aposentadoria, negocio, tecnologia, presente, natureza, festa, investimento, emergencia)"
  affects:
    - "Plan 05 (fides-metas.jsx COVER_PRESETS / resolveCoverUrl)"
    - "Plan 06 (galeria de capas, aba Galeria do seletor)"
tech-stack:
  added: []
  patterns:
    - "hand-authored SVG gradient/texture covers, viewBox 400x186, preserveAspectRatio xMidYMid slice"
    - "bottom-half darkening overlay gradient (opacity ramp to ~0.45-0.5 black) for scrim legibility under vcard text overlay"
key-files:
  created:
    - assets/covers/viagem.svg
    - assets/covers/casa.svg
    - assets/covers/carro.svg
    - assets/covers/reserva.svg
    - assets/covers/educacao.svg
    - assets/covers/casamento.svg
    - assets/covers/bebe.svg
    - assets/covers/saude.svg
    - assets/covers/aposentadoria.svg
    - assets/covers/negocio.svg
    - assets/covers/tecnologia.svg
    - assets/covers/presente.svg
    - assets/covers/natureza.svg
    - assets/covers/festa.svg
    - assets/covers/investimento.svg
    - assets/covers/emergencia.svg
  modified: []
decisions:
  - "Format is .svg (not .webp) per D4's post-research resolution — no image encoder (cwebp/imagemagick/sharp) exists in this environment; hand-authored SVG is zero-tooling and matches the 'texturas/gradientes na paleta tint' requirement exactly."
  - "Each cover is a themed gradient + minimal geometric motif (e.g. dashed flight path for viagem, roof silhouette for casa, road stripes for carro, coin rings for reserva, graduation cap for educacao, wedding rings for casamento, stars for bebe, cross for saude, sun for aposentadoria, growth bars for negocio, circuit dots for tecnologia, ribbon/box for presente, mountain layers for natureza, confetti for festa, ascending line chart for investimento, shield for emergencia) — all drawn from the project's TINTS palette (#2D5A3D, #2C5282, #B45309, #7C3AED, #0F766E, #9B2C2C, #0891B2, #BE185D) plus verde floresta / sage-paper base."
  - "Every file includes a bottom-weighted dark overlay gradient so white vcard text stays legible over any cover, per the plan's contrast requirement."
metrics:
  duration: "~15min"
  completed: 2026-07-02
status: complete
---

# Phase 08 Plan 02: Capas SVG bespoke para presets de metas Summary

16 gradientes/texturas SVG on-brand em `assets/covers/<id>.svg`, um por tema de meta, prontos para o contrato `preset:<id>` que o Plan 05 vai mapear.

## What was built

Criados 16 arquivos SVG auto-contidos em `assets/covers/`, um para cada id da lista do plano: `viagem, casa, carro, reserva, educacao, casamento, bebe, saude, aposentadoria, negocio, tecnologia, presente, natureza, festa, investimento, emergencia`.

Cada arquivo:
- `viewBox="0 0 400 186"` com `preserveAspectRatio="xMidYMid slice"` (proporção da área de capa do vcard, cover-fit).
- Gradiente base (`linearGradient`, alguns com `radialGradient` adicional para glow) na paleta tint da marca — combina verde floresta (#2D5A3D) / sage-paper (#F4F5F1) com os 8 tints do array `TINTS` em `fides-metas.jsx` (#2D5A3D, #2C5282, #B45309, #7C3AED, #0F766E, #9B2C2C, #0891B2, #BE185D), variando o hue por tema mas mantendo saturação/luminosidade coerentes.
- Uma forma geométrica sutil evocando o tema (sol + linha de voo pontilhada para viagem, silhueta de telhado para casa, faixas de estrada para carro, anéis de moeda para reserva, capelo de formatura para educação, alianças para casamento, estrelas para bebê, cruz para saúde, sol para aposentadoria, barras de crescimento para negócio, pontos de circuito para tecnologia, caixa com laço para presente, camadas de montanha para natureza, confete para festa, linha ascendente para investimento, escudo para emergência).
- `linearGradient` adicional aplicado como overlay escurecedor na metade inferior (opacity até ~0.44-0.5 em preto) — garante legibilidade de texto branco sob o scrim do vcard.
- Sem `<script>`, sem `on*` handlers, sem `<image href="http...">`, sem `@import` — puramente `<svg>` + `defs`/gradients/shapes.
- Tamanho entre 819 e 1290 bytes (bem abaixo do alvo de 4KB).

## Verification results

- `ls assets/covers/*.svg | wc -l` → 16 ✓
- Cada arquivo contém `<svg` (raiz válida) ✓
- `grep -rl "<script" assets/covers/` → vazio ✓ (nenhum script)
- Cada arquivo usa `linearGradient` e/ou `radialGradient` ✓
- Verificação manual de referências externas reais (`<image href="http...">`, `@import`, `url(http...)`, `xlink:href="http..."`) → nenhuma encontrada ✓

### Nota sobre o grep literal `http://\|https://\|@import`

O critério de aceitação do plano especifica `grep -rIl "http://\|https://\|@import" assets/covers/` deve retornar vazio. Rodar esse grep literal retorna todos os 16 arquivos — mas a única ocorrência de `http://` em cada um é o atributo obrigatório `xmlns="http://www.w3.org/2000/svg"`, o namespace XML padrão que todo elemento raiz `<svg>` válido precisa declarar (não é uma referência de rede: nenhum parser/renderer faz fetch dessa URI, é apenas um identificador de namespace). Confirmei via grep direcionado (`image\|@import\|url(http\|xlink:href="http`) que nenhum arquivo contém referências de rede reais (sem `<image href="http...">`, sem `@import`, sem `url(http...)`, sem `xlink:href="http..."`). O intento de segurança do critério — nenhuma referência de rede externa dereferenciável — está satisfeito; o texto literal do grep é um falso positivo inevitável para qualquer SVG válido.

## Deviations from Plan

### Auto-fixed Issues

None — plan executado exatamente como escrito, com a exceção documentada acima sobre o grep literal (não é um desvio de implementação, é uma nota de esclarecimento sobre o critério de verificação em si).

## Known Stubs

None.

## Threat Flags

None — este plano é puramente asset estático, sem novo endpoint/auth/schema. O `<threat_model>` do plano (T-08-07: XSS via SVG) foi mitigado por construção: todos os 16 arquivos são hand-authored, sem `<script>`/`on*`/refs de rede, servidos same-origin como background-image/img src.

## Self-Check: PASSED

Todos os 16 arquivos verificados em disco:
- FOUND: assets/covers/viagem.svg
- FOUND: assets/covers/casa.svg
- FOUND: assets/covers/carro.svg
- FOUND: assets/covers/reserva.svg
- FOUND: assets/covers/educacao.svg
- FOUND: assets/covers/casamento.svg
- FOUND: assets/covers/bebe.svg
- FOUND: assets/covers/saude.svg
- FOUND: assets/covers/aposentadoria.svg
- FOUND: assets/covers/negocio.svg
- FOUND: assets/covers/tecnologia.svg
- FOUND: assets/covers/presente.svg
- FOUND: assets/covers/natureza.svg
- FOUND: assets/covers/festa.svg
- FOUND: assets/covers/investimento.svg
- FOUND: assets/covers/emergencia.svg

Commit verificado no log:
- FOUND: 107d30a
