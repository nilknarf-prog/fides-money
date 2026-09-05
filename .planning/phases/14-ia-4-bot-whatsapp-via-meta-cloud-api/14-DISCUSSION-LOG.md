# Phase 14: IA-4 Bot WhatsApp via Meta Cloud API - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-17
**Phase:** 14-ia-4-bot-whatsapp-via-meta-cloud-api
**Areas discussed:** Modelo de acesso do bot, Estratégia pós-out/2026, Escopo e split de fases, Todos pendentes

**Contexto da sessão:** o dono pediu reanálise ESTRATÉGICA antes de planejar, com pesquisa de preços 2026 na web (prioridade máxima). Três pesquisadores paralelos (gsd-advisor-researcher) investigaram: (1) tarifas Meta WhatsApp Cloud API 2026; (2) modelo "pagamento único" do PlannerFin + concorrentes BR; (3) custo de LLM por lançamento. Achados-chave que moldaram as decisões: **Meta cobra mensagens de serviço a partir de 01/10/2026** (~R$ 0,04/msg enviada; R$ 0 até 30/09/2026); **PlannerFin atual é plano ANUAL R$ 87** (vitalício é mito — a versão antiga era planilha R$ 47–57); **LLM é irrelevante no custo** (~R$ 0,0007/parse; Flash-Lite segue o mais barato do Google); mercado BR inteiro é assinatura, piso anual ~R$ 82–87 — o R$ 89,90/ano do Fides já está no piso.

---

## Seleção de áreas

| Option | Description | Selected |
|--------|-------------|----------|
| Modelo de acesso do bot | Premium-only vs free cap vs promo única | ✓ |
| Estratégia pós-out/2026 | D-1 vs auto-insert, caps, reavaliação de preço | ✓ |
| Escopo e split de fases | Confirmar bot leve, split 14a/14b, robusto deferido | ✓ |
| Rollout e beta | Test number, WABA, critérios de saída do beta | (não selecionada — defaults do adendo D-8 valem) |

---

## Todos pendentes

| Option | Description | Selected |
|--------|-------------|----------|
| Só rate-limit (Recomendado) | Incorporar bypass de rate-limit; modais stale ficam p/ hardening in-app | ✓ |
| Incorporar os dois | Fase absorve também o debug dos modais stale | |
| Não incorporar nenhum | Phase 14 só com o bot | |

**User's choice:** Só rate-limit (após pedir explicação detalhada dos dois todos — primeira resposta foi "Other" pedindo esclarecimento; explicado o bypass via `toolResults` forjado e o bug de fila de modais, com a decisão prévia do próprio dono de 2026-07-16 de não colocar modais-stale na 14).

---

## Modelo de acesso do bot

| Option | Description | Selected |
|--------|-------------|----------|
| Premium-only (Recomendado) | Bot = benefício do R$ 89,90/ano; custo pós-out cabe no preço | ✓ |
| Degustação free com cap | Free loga N/mês antes do paywall (~R$ 0,80–1,20/mês por free ativo pós-out) | |
| Grátis até out/2026, depois premium | Aquisição na janela grátis; risco de quebra de promessa | |

**User's choice:** Premium-only.

| Option | Description | Selected |
|--------|-------------|----------|
| Anual tudo-incluso (Recomendado) | R$ 89,90/ano inclui bot + IA; sem vitalício; venda pré-M6 via Pix manual + admin set_plan | ✓ |
| Promo founders pagamento único | Lote limitado vitalício ~R$ 88 no lançamento | |
| Decidir preço/promo no M6 | Trava só o modelo anual agora | |

**User's choice:** Anual tudo-incluso.

| Option | Description | Selected |
|--------|-------------|----------|
| Estática de upgrade (Recomendado) | Resposta única com link, cap 3/dia, zero LLM; free não vincula | ✓ |
| Boas-vindas one-time (5 lançamentos) | Free vincula e ganha 5 lançamentos vitalícios de teste | |
| Degustação mensal (10/mês) | Espelha D-5 no canal WhatsApp | |

**User's choice:** Estática de upgrade.

---

## Estratégia pós-out/2026

| Option | Description | Selected |
|--------|-------------|----------|
| Manter D-1; auto-insert depois (Recomendado) | MVP confirma sempre; auto-insert+desfazer só pós-telemetria E pressão de custo | ✓ |
| Acelerar auto-insert no MVP | Metade do custo, contradiz fricção intencional | |
| Critério do planner | Preparar alavanca atrás de flag desligada | |

**User's choice:** Manter D-1; auto-insert depois.

| Option | Description | Selected |
|--------|-------------|----------|
| Diário + mensal (Recomendado) | ~30/dia E 300/mês → teto ~R$ 12/mês por abusador | ✓ |
| Manter 50/dia do design | Só cap diário; teto ~R$ 60/mês pós-out | |
| Números a critério do planner | Meta: teto ≤ ~R$ 15/mês | |

**User's choice:** Diário + mensal.

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, antes do lançamento público (Recomendado) | Re-checar tabela BRL oficial (sai até 01/09/2026); beta não espera | ✓ |
| Não formalizar | Estimativa R$ 0,04 basta | |

**User's choice:** Sim, antes do lançamento público.

---

## Escopo e split de fases

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 14 única = bot leve (Recomendado) | Sem split; robusto-no-WhatsApp só como ideia deferida | |
| Criar placeholder do robusto no roadmap | Phase 14 como está + fase futura no ROADMAP via /gsd-phase | ✓ |
| Repensar o escopo D-6 | Rediscutir o que o bot leve cobre | |

**User's choice:** Criar placeholder do robusto no roadmap (Phase 14 segue única e leve; adiciona-se fase futura "Assistente robusto no WhatsApp (premium)" ao ROADMAP sem planejá-la).

---

## Claude's Discretion

- Números finais dos caps (teto ≤ ~R$ 15/mês/usuário), janela do contador, copy das mensagens do bot, estrutura fina do prompt do parser, divisão/ordem dos planos, escolha do mecanismo do fix do rate-limit (contar tudo vs nonce).

## Deferred Ideas

- Assistente robusto no WhatsApp (premium) — vira placeholder no ROADMAP, planejamento só pós-tração.
- Auto-insert com desfazer — pós-telemetria.
- Promo founders pagamento único — descartada como modelo; no máximo lote limitado no M6.
- Botões interativos nativos, áudio/imagem no bot — pós-MVP/V2.
- Modais WRITE stale in-app — fase futura de hardening/UX do assistente WRITE (todo mantido em pending).
- Verificação Meta Business + display name + mensagens proativas — pós-tração (exige CNPJ/SLU).

---

## Sessão de Alinhamento e Usabilidade (2026-09-05)

**Data:** 2026-09-05  
**Contexto:** Retomada da Fase 14 após reconciliação forense. O usuário solicitou `/gsd-discuss-phase 14` para alinhar premissas de execução das Waves 3 e 4.

### 1. Ambiente de Testes & Validação da Meta
- **Opções consideradas:**
  - (A) Finalizar o código com testes automatizados / mocks locais primeiro, e conectar credenciais da Meta no Vercel depois (Recomendado).
  - (B) Configurar chaves da Meta em paralelo e testar no WhatsApp real desde o primeiro commit.
- **Decisão (AL-01):** Opção A selecionada. Foco em estabilidade, cobertura e simulação local de requisições de webhook antes de depender da infraestrutura externa da Meta.

### 2. Tratamento de Omissão de Conta/Cartão
- **Opções consideradas:**
  - (A) Propor a conta principal/padrão do usuário no card de confirmação, permitindo troca caso necessário (Recomendado).
  - (B) Não montar o card e fazer uma pergunta adicional ("Qual conta ou cartão você usou?").
- **Decisão (AL-02):** Opção A selecionada. Reduz atrito no registro manual e preserva a velocidade de registro pelo WhatsApp, mantendo o fallback de troca no card.

### 3. Tolerância no Reconhecimento de Confirmação
- **Opções consideradas:**
  - (A) Tolerante: aceitar números ('1', '2', '3') e comandos em linguagem natural ('sim', 'ok', 'cancela', 'trocar') (Recomendado).
  - (B) Estrito: aceitar unicamente dígitos ('1', '2', '3').
- **Decisão (AL-03):** Opção A selecionada. Aceita variantes comuns em PT-BR para uma experiência fluida no chat.

