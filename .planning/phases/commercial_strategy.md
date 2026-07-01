# Estratégia Comercial e de Lançamento (MVP) — Fides Money

> Este documento traça um plano de ação para antecipar as vendas do Fides Money, estruturando a precificação, o modelo de negócios do assistente WhatsApp e o planejamento da Landing Page.

## 1. Acelerando o Lançamento (Time-to-Market)

É perfeitamente normal sentir que o desenvolvimento está lento quando o núcleo do app já está funcional. Pelo nosso `ROADMAP.md`, já concluímos os Marcos **M1**, **M2** e **M4** (fundação, transações, dashboard e faturas). O app principal **já entrega valor**.

Para colocar o app à venda o mais rápido possível, devemos focar no que chamamos de **MVP Comercial**:
1. **Experiência 100% Finalizada (Escopo Completo)**: O aplicativo não pode ter telas ou botões que não funcionam. Para garantir total credibilidade no momento da venda, seguiremos o roadmap construindo todas as funcionalidades pendentes essenciais (como Metas, Importação e Dívidas) *antes* do lançamento oficial. O MVP será robusto e sem atalhos visuais.
2. **Focar no Diferencial de Venda**: O assistente de WhatsApp. Ele é o gatilho principal de compra e será incluído no pacote.

---

## 2. Estratégia de Precificação e WhatsApp

A sua ideia inicial era de R$ 80,00 como pagamento único. No entanto, para cobrir os **custos recorrentes** do WhatsApp (Meta Cloud API) e da IA (Gemini) sem gerar atritos de vendas com "taxas extras", decidimos pelo modelo anual.

### Modelo de Negócios Definido: Assinatura Anual (SaaS Padrão)

- **Valor:** R$ 89,90 / ano.
- **O que inclui:** Acesso completo ao aplicativo web (planejamento, faturas, metas) + Assistente WhatsApp.
- **Por que funciona:** 
  1. A comunicação de marketing fica extremamente limpa (apenas 1 preço).
  2. Garante renovação e fluxo de caixa contínuo para manter os custos de IA e API pagos.
  3. O valor psicológico é excelente ("menos de R$ 7,50 por mês", o que soa como uma compra por impulso ou muito acessível).

#### Sobre as capacidades do WhatsApp (Básico vs Avançado):
Para o **MVP**, recomendo lançarmos o WhatsApp **Básico** primeiro (apenas leitura de saldo e registro de despesas/receitas em categorias existentes). Isso é mais rápido de codificar. O agente capaz de *criar* categorias exige uma lógica complexa de confirmação e pode atrasar ainda mais as vendas.

---

## 3. Planejamento da Landing Page

A Landing Page precisa ser de alta conversão. Nós temos a skill `imagegen-frontend-web` que podemos usar para desenhar uma página premium.

**Estrutura recomendada da Landing Page:**
1. **Hero Section:** Promessa forte ("Retome a consciência do seu dinheiro. Sem planilhas chatas, sem automações que te deixam cego.") + Mockup do App no iPhone.
2. **O Problema:** Por que o Open Finance te deixa no automático e você continua sem saber para onde o dinheiro foi.
3. **A Solução (O Método Fides):** Fricção intencional, regra 50-30-20.
4. **A Mágica (Feature Killer):** Um GIF ou vídeo mostrando o bot do WhatsApp registrando um gasto em 3 segundos.
5. **Pricing (Tabela de Preços):** Apresentando o modelo escolhido.
6. **FAQ:** Quebra de objeções (segurança, como funciona o cartão de crédito, etc).

---

## 4. Próximos Passos (Ajuste no Roadmap GSD)

Como optamos pelo **Escopo Completo**, o nosso cronograma voltará a seguir a ordem estrutural para entregar todas as funcionalidades antes do marketing:

1. **Finalizar M3 (Polimento Atual):** Terminar os ajustes de UX Mobile e Motion para o app ter a sensação premium que exigimos.
2. **Entrar no M5 (Expansão do Produto):** Construir as telas e lógicas de Metas, Dívidas, e Importação de CSV para deixar o app robusto.
3. **Desenvolver o Bot do WhatsApp:** Implementar o Webhook e a IA que vai rodar no WhatsApp.
4. **M6 (Fase Comercial):** Desenhar a Landing Page de alta conversão, plugar o sistema de pagamentos anuais (Stripe/MercadoPago) e iniciar as vendas.
