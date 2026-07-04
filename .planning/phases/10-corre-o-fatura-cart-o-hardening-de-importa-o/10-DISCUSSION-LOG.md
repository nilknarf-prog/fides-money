# Phase 10: Correção fatura cartão + hardening de importação - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-04
**Phase:** 10-corre-o-fatura-cart-o-hardening-de-importa-o
**Areas discussed:** Escopo / divisão, Convenção mês-fatura (FAT-01), UX preview import (IMP-01), Dedupe + card_id (IMP-02)

---

## Escopo / divisão

| Option | Description | Selected |
|--------|-------------|----------|
| Fase única, ondas ordenadas | Um conjunto de planos; planner organiza ondas por prioridade (1 FAT-01, 2 import, 3 UX) | ✓ |
| Dividir em 10a/10b/10c | Sub-fases formais via /gsd-phase --insert | |
| Fase única, sem ordem imposta | Ondas só por dependência técnica | |

**User's choice:** Fase única, ondas ordenadas (Recomendado)
**Notes:** Entrega P1 (FAT-01) primeiro sem overhead de sub-fases.

---

## Convenção mês-fatura (FAT-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Mês em que FECHA | Alinha faturasDoCartao* com mesFaturaFor; remove branch if(diaF>diaV) mesF=mes-1 | ✓ |
| Mês em que VENCE | Alinhar mesFaturaFor ao faturasDoCartao (maior risco de regressão) | |

**User's choice:** Mês em que FECHA (Recomendado) — é o fix do 09-FOLLOWUPS.
**Notes:** dtFechamento=Date(ano,mes,diaF); dtVencimento = diaV>=diaF ? mesmo mês : mês+1.

## Card fatura (FAT-01)

| Option | Description | Selected |
|--------|-------------|----------|
| fecha DD/MM · vence DD/MM · status | Mostra as duas datas + status explícito | ✓ |
| Só vencimento + status | Mantém formato atual, só corrige a data | |

**User's choice:** fecha DD/MM · vence DD/MM · status (Recomendado)

---

## UX preview import (IMP-01)

### Tratamento de duplicatas no preview

| Option | Description | Selected |
|--------|-------------|----------|
| Mostrar desmarcadas + aviso | Duplicatas aparecem desmarcadas com marca 'já importada' | ✓ |
| Ocultar duplicatas | Só linhas novas aparecem | |
| Mostrar marcadas (dedupe só avisa) | Tudo marcado; dedupe só conta | |

**User's choice:** Mostrar desmarcadas + aviso (Recomendado)

### Seleção default das linhas novas

| Option | Description | Selected |
|--------|-------------|----------|
| Todas marcadas | Novas já marcadas; usuário desmarca o que não quer | ✓ |
| Nada marcado | Usuário marca manualmente | |

**User's choice:** Todas marcadas (Recomendado) — cancelar não grava nada.

---

## Dedupe + card_id (IMP-02)

### Rigidez da chave de dedupe

| Option | Description | Selected |
|--------|-------------|----------|
| Normalizado | trim+lowercase+colapso espaços; value em centavos; date por dia | ✓ |
| Match exato | Strings/valores exatos como vieram | |

**User's choice:** Normalizado (Recomendado)

### Janela de data

| Option | Description | Selected |
|--------|-------------|----------|
| Mesmo dia exato | date igual ao dia | ✓ |
| ±1 dia | Tolera diferença de 1 dia | |

**User's choice:** Mesmo dia exato (Recomendado)

### Resolução de card_id

| Option | Description | Selected |
|--------|-------------|----------|
| Match por nome → card_id | Resolve conta por nome; se cartão, grava card_id | |
| Seletor de conta no preview | Dropdown por linha/global para escolher conta/cartão destino | ✓ |

**User's choice:** Seletor de conta no preview — mais controle; grava card_id quando destino é cartão.

---

## Claude's Discretion

- UX-03 (botão "Cartão" no masthead) e UX-04 (modo Período: mapeamento cor↔categoria + valor por categoria no hover/tap) — não discutidos em detalhe; implementação a critério do planner/executor seguindo padrões visuais existentes.
- Colunas exatas do modal de preview — critério do Claude.

## Deferred Ideas

Nenhuma — discussão ficou dentro do escopo. Mapeamento de colunas customizado, novos formatos de import e redesign de fatura permanecem fora de escopo (abrir fase própria se surgirem).
