---
sketch: 001
name: painel-admin
question: "Que estrutura de layout e identidade o painel admin (/painel, Phase 16 MVP) deve ter?"
winner: A
tags: [layout, admin, backoffice, phase-16]
---

# Sketch 001: Painel Admin (/painel)

## Design Question
Que estrutura de layout e identidade visual o painel admin do MVP da Phase 16 deve ter? As três telas do 16-03 (login, tabela de contas com "Alterar plano", auditoria) estão presentes e funcionais nas três variantes — o que muda é o esqueleto e o tom.

## How to View
Abrir `.planning/sketches/001-painel-admin/index.html` no browser (duplo clique — sem servidor).

## Variants
- **A: Sidebar de admin** — sidebar verde-floresta fixa à esquerda (Contas/Auditoria + "fase 2"/"backlog" visíveis), padrão clássico de backoffice; escala bem quando entrarem Métricas/Config.
- **B: Masthead editorial** — mesma identidade do app (masthead grande, abas horizontais, sage paper); painel parece uma "seção admin" do próprio Fides; mais leve, menos cara de ferramenta.
- **C: Console escuro** — tema dark denso com toques mono ("ops console"); separa visualmente o contexto ADMIN do app de usuário — impossível confundir a aba do painel com a do app.

## Decisão (16-03, revisável)

**Escolhida: A (Sidebar de admin).** Motivo: escala melhor quando entrarem Métricas/Config
(fase 2/backlog) e comunica claramente "modo admin" sem ser tão pesada quanto o console
dark (C). Implementada em `assets/fides-admin.css`/`.jsx` com o namespace `fda-`. Decisão
revisável — o checkpoint humano da Task 3 confirma o tom visual antes de travar de vez.

## What to Look For
- **Navegação:** sidebar (A) comporta crescimento (fase 2: métricas, config); abas (B/C) são mais simples para 2 telas de MVP.
- **Contexto mental:** B parece "o app"; C grita "você está no modo admin" — importa porque trocar plano em produção merece cautela visual.
- **Tabela de contas:** busca + filtro de plano funcionam; coluna IA/mês mostra o cap free (10/10 ⚠).
- **Fluxo "Alterar plano":** clique no botão → modal com select + motivo obrigatório (confirmar fica desabilitado sem motivo) → toast + linha nova na Auditoria. Esse fluxo é o coração do MVP — sentir se o atrito está certo.
- **Login:** botão "telas: login" na toolbar (canto inferior direito) mostra a tela de login de cada variante.
