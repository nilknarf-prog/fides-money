# Phase 07: CRUD Metas - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 07-crud-metas
**Areas discussed:** Prazo/schema, Campos do form, Descrição, Modal criar

---

## Prazo / Schema

### Como resolver ausência de coluna de data-alvo?
| Option | Description | Selected |
|--------|-------------|----------|
| Migration target_date | Coluna via MCP + espelho schema.sql; normalizeGoal mapeia | ✓ |
| Sem migration, só UI | Estado local, some no reload (viola META-01) | |
| Dropar prazo da fase | CRUD só nome/valor-alvo (contraria REQUIREMENTS) | |

**User's choice:** Migration target_date

### Tipo/granularidade?
| Option | Description | Selected |
|--------|-------------|----------|
| date (dia cheio) | DATE YYYY-MM-DD, input type=date nativo | ✓ |
| Mês/ano (texto) | 'YYYY-MM' como text, exige parsing | |
| Você decide | Planner escolhe | |

**User's choice:** date (dia cheio)

### Obrigatório?
| Option | Description | Selected |
|--------|-------------|----------|
| Opcional (nullable) | Meta sem prazo permitida (reserva contínua) | ✓ |
| Obrigatório (not null) | Toda meta exige data | |

**User's choice:** Opcional (nullable)

### Validar data passada?
| Option | Description | Selected |
|--------|-------------|----------|
| Bloquear passado | min={hoje} no input | ✓ |
| Permitir qualquer | Sem validação | |
| Você decide | Consistência com outros forms | |

**User's choice:** Bloquear passado

---

## Campos do form

### Campo 'valor atual' (current)?
| Option | Description | Selected |
|--------|-------------|----------|
| Remover atual | current=0 na criação; escopo limpo | ✓ |
| Manter atual editável | Seed manual do progresso (mistura com área deferida) | |

**User's choice:** Remover atual

### Campo 'contribuição mensal' (monthly_contrib)?
| Option | Description | Selected |
|--------|-------------|----------|
| Remover contribuição | monthly_contrib=0 default | ✓ |
| Manter contribuição | Aporte mensal planejado (M5+) | |

**User's choice:** Remover contribuição

### Manter emoji e cor (tint)?
| Option | Description | Selected |
|--------|-------------|----------|
| Manter ambos | emoji + tint no form | ✓ (parcial) |
| Só emoji | tint default | |
| Nenhum (mínimo) | só nome/alvo/prazo | |

**User's choice:** Free-text — pediu **imagem de capa** por meta (foto de avião/ilha p/ Viagem).
**Notes:** Redirecionado como scope creep. Capa de imagem exige Supabase Storage + upload + coluna → deferida p/ M5. Confirmado: v1.1 usa emoji + cor; capa deferida.

### Capa de imagem: encaminhamento
| Option | Description | Selected |
|--------|-------------|----------|
| Deferir capa, usar emoji+cor | Capa → ideia deferida (M5); v1.1 emoji+cor | ✓ |
| Deferir capa, só emoji | Só emoji na v1.1 | |
| Insistir na capa agora | Expande escopo, atrasa CRUD | |

**User's choice:** Deferir capa, usar emoji+cor

---

## Descrição

### Gap de coluna descrição?
| Option | Description | Selected |
|--------|-------------|----------|
| Adicionar coluna description | text nullable, mesma migration do target_date | ✓ |
| Dropar campo do form | Remover descrição do modal | |
| Manter só-UI (não persiste) | Some no reload (confunde) | |

**User's choice:** Adicionar coluna description

---

## Modal criar

### Como implementar o modal de criação?
| Option | Description | Selected |
|--------|-------------|----------|
| Reusar AjustarPlanoModal | Mesmo modal criar+editar | |
| Modal dedicado de criação | CriarMetaModal separado | ✓ |
| Você decide | Seguir padrão conta/cartão | |

**User's choice:** Modal dedicado de criação

---

## Claude's Discretion

- Estratégia de refresh da lista após mutação (refetch live vs otimista mock) — seguir padrão existente.
- Empty state ao carregar sem metas — já existe, não regredir.

## Deferred Ideas

- **Imagem de capa por meta** — Supabase Storage + upload + coluna; candidata a fase própria em M5.
- **Aportes / valor atual / contribuição / ajuste de plano** — colunas ficam nos defaults nesta fase; M5+ (META-05/06/07).
