# Phase 1: Veracidade do Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-28
**Phase:** 01-veracidade-do-dashboard
**Areas discussed:** Tooltip do donut + arquivo protegido

---

## Seleção de áreas

| Option | Description | Selected |
|--------|-------------|----------|
| Tooltip do donut + arquivo protegido | Donut em fides-charts.jsx (protegido); native <title> vs tooltip React custom | ✓ |
| Onde calcular saldo projetado | Selector no store vs inline; quais txs contam como pendente | |
| Hero: projetado + fluxo negativo | Como exibir saldo positivo sem esconder fluxo negativo (P1) | |
| Estado 'sem limite' do orçamento | Grupo soma 0 → "sem limite definido" | |

**User's choice:** Apenas "Tooltip do donut + arquivo protegido".

---

## Tooltip do donut — arquivo protegido

| Option | Description | Selected |
|--------|-------------|----------|
| Editar Donut, com aprovação | Estado+handlers dentro do Donut em fides-charts.jsx; coeso e reutilizável nos 2 consumidores | ✓ |
| Toque mínimo + callback | Donut só emite onSlice; tooltip no consumidor | |
| Expor arcs, zero handler | Toda interação no consumidor | |

**User's choice:** Editar Donut, com aprovação.
**Notes:** Aprovação explícita p/ tocar arquivo protegido, registrada no CONTEXT como exceção aprovada.

---

## Tooltip do donut — exibição

| Option | Description | Selected |
|--------|-------------|----------|
| Reusar o centro do donut | Centro "Total/R$x" troca para categoria+valor+%; zero overflow em 400px | ✓ |
| Tooltip flutuante na fatia | Div HTML no centroide do arco; risco de overflow na borda | |
| Faixa fixa abaixo do donut | Legenda fixa sob o gráfico | |

**User's choice:** Free-text — "quando eu coloque o mouse sobre o gráfico de pizza, ao colocar em cima das cores ele vá mostrando os gastos naquela categoria, e que no mobile seja preciso apertar em cima da cor." Seguido de: "não quero correr o risco de o texto cortar a borda de 400px, se a única forma de mitigar isso for a opção do centro do donut, então tudo bem."
**Notes:** Interação = hover desktop / tap mobile na cor. Exibição = centro do donut, escolhida por zero risco de corte na borda em 400px. Tooltip flutuante rejeitado por risco de overflow.

---

## Claude's Discretion

- Issue #1 (budgetGroups → categoryLimits + estado "sem limite") — delegado a research/planning sob travas do SPEC.
- Issue #3 (saldo projetado: onde calcular, derivação de pendentes) — delegado, regra do SPEC respeitada.
- Hero + fluxo negativo (P1) — delegado.

## Deferred Ideas

Nenhuma — discussão ficou dentro do escopo da fase.
