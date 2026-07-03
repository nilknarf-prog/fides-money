---
status: partial
phase: 08-metas-vision-board-redesign
source: [08-01-SUMMARY.md, 08-02-SUMMARY.md, 08-03-SUMMARY.md, 08-04-SUMMARY.md, 08-05-SUMMARY.md, 08-06-SUMMARY.md]
started: 2026-07-03T01:30:34Z
updated: 2026-07-03T02:04:13Z
prereqs:
  live_db: applied 2026-07-03 via MCP (image_url column + goal-covers bucket + 4 RLS policies) — all tests unblocked
---

## Current Test

[retest 7/2/8 após redeploy — blocker de regressão white-screen root-caused + corrigido 2026-07-03]

<!-- Retest 08-08: marcar concluída → PÁGINA EM BRANCO (regressão). Root cause: fides-metas.jsx:1517 usava
     Icon.Trophy (Icon global = fides-data.jsx, sem chave Trophy) em vez de MetIcon.Trophy (local). React
     "Element type is invalid" → white-screen sempre que metasConcluidas.length>0; persiste no refresh pois a
     meta completed vem do DB. Mascarava conclusão manual E auto-conclusão a 100% (ambas wired e corretas).
     FIX: Icon.Trophy → MetIcon.Trophy (1 linha). Retestar 7/2/8 + auto-conclusão após deploy. -->


## Tests

### 1. Busca de metas
expected: Barra de controles acima do Capítulo I com campo de busca; digitar nome/descrição filtra o grid em tempo real (case-insensitive); sem match mostra estado vazio dedicado.
result: pass
note: Busca confirmada funcionando pelo usuário (item 3). Sessão trouxe 5 achados cross-surface → ver Gaps.

### 2. Filtro segmentado Todas/Ativas/Concluídas
expected: Segmentado (3 botões) na barra de controles. "Ativas" mostra só metas não concluídas; "Concluídas" só as completed; "Todas" todas. Filtro combina com a busca.
result: issue
reported: "Aportei uma meta até 100%; em Concluídas ela não apareceu; em Ativas apareceu (não escondeu a concluída); e não foi para o Cap III Já Atingidas"
severity: major

### 3. vcard — card de meta redesenhado
expected: Cada meta vira um vcard com capa no topo (~186px), scrim/gradiente escurecendo a parte de baixo, overlay com pill Ativa/Concluída + chip emoji + nome + descrição, e corpo com valor/barra/2 stats. Meta sem capa cai em fallback gradiente no tint.
result: pass
note: Layout/scrim/pill/barra OK. Achados separados já logados: Infinity(#1), fotos reais(#5).

### 4. met-hero distinto do hero da home
expected: O hero da tela de Metas tem identidade própria (backdrop de colagem das capas), visualmente diferente do hero do Dashboard/home. Hero da home permanece intacto.
result: pass

### 5. Aportar → saldo atualiza
expected: Botão "Aportar" no card abre modal com preview/projeção; confirmar um valor soma ao saldo guardado da meta e a barra/valor atualizam sem reload. Sem confirm()/alert() nativo.
result: pass

### 6. Atualizar saldo inline
expected: Ação "Atualizar saldo" abre input inline no próprio card; salvar ajusta o valor guardado sem reload e sem popup nativo.
result: pass

### 7. Marcar como concluída
expected: No menu de 3 pontos do card, "Marcar como concluída" muda a pill para Concluída e move a meta para o Capítulo III "Já atingidas".
result: issue
reported: "Meta concluída não vai para o Cap III nem aparece no filtro de Concluídas — inclusive pelo menu manual, não só por aporte a 100%"
severity: blocker

### 8. Capítulo III "Já atingidas"
expected: Capítulo III lista as metas concluídas reais (emoji, valor guardado, "Concluída em <data>"). Sem nenhuma concluída, mostra mensagem vazia — não texto hardcoded.
result: blocked
blocked_by: prior-phase
reason: "Depende do bug de conclusão (testes 2/7): sem meta que consiga ficar completed, Cap III não pode ser verificado. Re-testar após fix."

### 9. Criar meta (campo Valor atual) + capa Galeria
expected: Modal Criar meta tem campo "Valor atual (R$)" e aba Galeria (16 presets); criar persiste, card mostra capa preset + valor.
result: pass

### 10. Capa via Enviar foto (upload)
expected: Aba "Enviar foto" sobe jpeg/png/webp ≤5MB p/ bucket goal-covers, preview, vira capa ao salvar; inválido/grande → Toast.
result: pass

### 11. Editar: trocar capa/Status + cleanup de Storage
expected: AjustarPlanoModal com seletor de capa + toggle Status; trocar capa enviada por outra apaga o objeto antigo do bucket. (Status→Concluída cai no bug testes 2/7.)
result: pass
note: Troca de capa + cleanup OK. Reflexo de Status=Concluída continua quebrado (gap conclusão).

### 12. Excluir meta com capa enviada — cleanup de Storage
expected: Excluir meta com capa por upload remove também o objeto do bucket goal-covers; meta sai da tela.
result: pass

### 13. Ações no hover (desktop) / visíveis no touch
expected: Desktop revela Aportar/Ajustar/Atualizar-saldo no hover; touch sempre visível; dots-menu sempre visível.
result: pass
note: RLS dois-usuários não testado com 2 contas; enforced pelas 4 policies owner-scoped (foldername[1]=auth.uid()) verificadas live via MCP.

## Summary

total: 13
passed: 10
issues: 2
pending: 0
skipped: 0
blocked: 1
cross_surface_findings: 5

## Gaps

<!-- Achados cross-surface levantados durante o Teste 1 (usuário testou várias telas de uma vez) -->

- truth: "Meta sem prazo/aporte não deve exibir 'Infinity meses'"
  status: failed
  reason: "User reported: Retirar o 'R$ 10.000,00 · Infinity meses' quando a meta não tiver prazo; colocar 'sem prazo' ou ficar vazio"
  severity: minor
  type: bug
  test: 1
  root_cause: "Múltiplos pontos exibem `{mesesAteFim} meses` sem guardar Infinity: fides-metas.jsx:1161 (resumo 'maior meta') E pelo menos +1 nas ações reveladas no hover do card. Linha 1225 ('Chega em') já guarda p/ '—'; outros não."
  artifacts:
    - path: "assets/fides-metas.jsx"
      issue: "~1161 e ponto(s) do hover do card mostram 'Infinity meses' — grep project-wide por mesesAteFim/`meses` sem guard"
  missing:
    - "Guardar Infinity → 'sem prazo' em TODAS as exibições de mesesAteFim (usuário confirmou ocorrência no hover além do 1161)"

- truth: "Seleção de emoji deve abrir um seletor no desktop"
  status: failed
  reason: "User reported: Pelo Desktop não deu pra selecionar Emoji, ao clicar não abriu um quadro com emojis"
  severity: major
  type: ux-gap
  test: 9
  root_cause: "assets/fides-metas.jsx:370/487 — campo emoji é <input maxLength=2>, sem picker; desktop não tem teclado de emoji nativo"
  artifacts:
    - path: "assets/fides-metas.jsx"
      issue: "CriarMetaModal/AjustarPlanoModal usam text input para emoji, não um picker"
  missing:
    - "Emoji picker (grid curado hand-rolled, sem npm dado Babel-standalone) nos modais Criar/Ajustar"

- truth: "Deve haver apenas um botão 'Nova meta' visível (o primário escuro)"
  status: failed
  reason: "User reported: Tem dois botões de Nova Meta um em cima do outro; deixar só o de cima (fundo escuro) e retirar o de baixo (vazado)"
  severity: minor
  type: bug
  test: 1
  root_cause: "Botão duplicado — .met-controls-nova (fides-metas.jsx:1198, primário) coexiste com um CTA vazado 'Nova meta' na área do met-hero"
  artifacts:
    - path: "assets/fides-metas.jsx"
      issue: "dois CTAs 'Nova meta' renderizados juntos no estado com metas"
  missing:
    - "Remover o botão 'Nova meta' vazado (manter só o primário)"

- truth: "Capas devem ser fotos reais de bancos de imagens abertos, não gradientes SVG base"
  status: failed
  reason: "User reported: Não gostei dessas imagens base, esperava imagens reais, fotos reais de bancos de dados de imagens abertas"
  severity: major
  type: enhancement
  test: 3
  needs_research: true
  root_cause: "Plan 02 entregou 16 SVG hand-authored (gradiente/textura) por restrição de tooling; usuário quer fotos reais CC0"
  artifacts:
    - path: "assets/covers/*.svg"
      issue: "16 presets são gradientes SVG, não fotografias"
  missing:
    - "Estratégia de sourcing (Unsplash/Pexels CC0) + entrega sob no-build/CSP (bundle vs hotlink) — decisão de research"

- truth: "'Nova meta' deve oferecer metas-exemplo pré-criadas como ponto de partida"
  status: failed
  reason: "User reported: Gostaria que ao apertar Nova Meta tivesse metas já pré-criadas de exemplo (ex.: Reserva de Emergência, Viagem, Trocar de Carro), ~3"
  severity: minor
  type: enhancement
  test: 9
  needs_research: true
  root_cause: "CriarMetaModal abre em branco; sem templates/onboarding"
  artifacts:
    - path: "assets/fides-metas.jsx"
      issue: "CriarMetaModal sem galeria de templates"
  missing:
    - "3+ templates (nome/emoji/capa/alvo sugerido) que preenchem o form — pesquisar padrões de goal-templates"

- truth: "Concluir uma meta (manual OU por aporte a 100%) deve refletir: pill Concluída, sair de Ativas, entrar em Concluídas e no Cap III Já Atingidas"
  status: failed
  reason: "User reported: meta concluída NÃO vai para Cap III nem aparece no filtro Concluídas — nem pelo menu 'Marcar como concluída' (manual) NEM por aporte a 100%. (testes 2 e 7)"
  severity: blocker
  type: bug
  test: 7
  root_cause: "INDETERMINADO — precisa diagnóstico runtime (console/network via chrome-devtools). Fatos: (a) Aportar persiste `current` e reflete (teste 5 pass) → updateGoal .update(patch) + refreshData select('*') + normalizeGoal funcionam para colunas normais; goals RLS UPDATE não bloqueia. (b) Menu chama updateGoal(id,{completed:true, completed_at:ISO}) (fides-metas.jsx:1243); colunas completed/completed_at existem live. Mesmo assim completed não reflete. → defeito específico da conclusão (write de completed/completed_at silenciosamente não persiste, OU derivação de pill/filtro/Cap III não lê completed após refresh). Além disso, aporte a 100% não tem auto-conclusão nenhuma."
  artifacts:
    - path: "assets/fides-metas.jsx"
      issue: "1243 menu updateGoal({completed:true,...}); 1013-1020 filtro/Cap III via !!m.completed; nenhum auto-complete quando atual>=alvo"
    - path: "assets/fides-store.jsx"
      issue: "634-646 updateGoal .update(patch) raw; 104-105 normalizeGoal completed/completedAt; 237 goals select('*')"
  missing:
    - "DIAGNOSTICAR por que updateGoal({completed}) não reflete (chrome-devtools: console + network do PATCH /goals) antes de corrigir"
    - "Corrigir a conclusão manual (menu) end-to-end: pill Concluída + filtro + Cap III"
    - "Auto-marcar completed=true + completed_at ao aportar/atualizar saldo até atual>=alvo"
    - "Definir regra: reabrir meta (completed→ativa) se saldo cair abaixo do alvo?"
