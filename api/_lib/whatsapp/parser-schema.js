// api/_lib/whatsapp/parser-schema.js — CommonJS, não roteável (mesma convenção de _lib/gemini.js)
// PARSE_SCHEMA + buildParsePrompt: saída estruturada do parser NL->JSON do bot WhatsApp
// (WA-PARSE-01, Pattern 5 do 14-RESEARCH.md). NÃO usa function calling — a chamada real
// (plano 06) monta gemini.buildPayload({ toolMode: 'NONE', generationConfig: { responseSchema:
// PARSE_SCHEMA, responseMimeType: 'application/json', ... } }).
//
// Minimização LGPD (WA-LGPD-01): buildParsePrompt recebe SÓ a data-âncora e listas de
// NOMES (categorias/contas/cartões) — nunca saldos, valores ou extrato entram no prompt
// enviado ao Gemini (T-14-06, mitigação de Information Disclosure do threat_model).

/**
 * Schema de saída estruturada (responseSchema) do parser NL->JSON do bot WhatsApp.
 * Campos e enums exatos do Pattern 5 do 14-RESEARCH.md.
 */
const PARSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    intent: {
      type: 'STRING',
      enum: ['registrar_despesa', 'registrar_receita', 'consultar_saldo', 'consultar_extrato', 'ajuda', 'outro'],
    },
    valor: { type: 'NUMBER', nullable: true },
    descricao: { type: 'STRING', nullable: true },
    categoria: { type: 'STRING', nullable: true },
    conta_ou_cartao: { type: 'STRING', nullable: true },
    data: { type: 'STRING', nullable: true },
    confianca: { type: 'STRING', enum: ['alta', 'media', 'baixa'] },
    faltando: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['intent', 'confianca'],
  propertyOrdering: ['intent', 'valor', 'descricao', 'categoria', 'conta_ou_cartao', 'data', 'confianca', 'faltando'],
};

/**
 * Monta o system prompt do parser NL->JSON, em PT-BR.
 *
 * Minimização (WA-LGPD-01): aceita SOMENTE a data-âncora e listas de NOMES — nunca
 * saldos/valores/extrato (esses dados nunca devem sair do processo em direção ao Gemini).
 *
 * @param {object} params
 * @param {string} params.hoje - data-âncora no formato YYYY-MM-DD
 * @param {string[]} params.categorias - nomes/chaves de categorias existentes
 * @param {string[]} params.contas - nomes de contas existentes
 * @param {string[]} params.cartoes - nomes de cartões existentes
 * @returns {string}
 */
function buildParsePrompt({ hoje, categorias, contas, cartoes }) {
  const listaCategorias = (categorias || []).join(', ') || '(nenhuma cadastrada)';
  const listaContas = (contas || []).join(', ') || '(nenhuma cadastrada)';
  const listaCartoes = (cartoes || []).join(', ') || '(nenhum cadastrado)';

  return `Você é o parser de mensagens do bot WhatsApp do Fides Money, um app brasileiro de finanças pessoais.

Sua ÚNICA tarefa é interpretar a mensagem do usuário e devolver um JSON estruturado (conforme o schema fornecido), NUNCA texto livre.

Hoje é ${hoje} (use esta data como âncora para resolver datas relativas como "ontem", "hoje", "sexta passada" — calcule a data absoluta correspondente e devolva no campo "data" no formato YYYY-MM-DD).

Categorias existentes: ${listaCategorias}
Contas existentes: ${listaContas}
Cartões existentes: ${listaCartoes}

Regras:
- "intent" identifica a ação pretendida: registrar_despesa (compra/gasto), registrar_receita (recebimento/entrada), consultar_saldo, consultar_extrato, ajuda (o usuário pede instruções/não sabe usar o bot), ou outro (mensagem não reconhecida).
- Para registrar_despesa/registrar_receita: extraia "valor" (número, sempre positivo), "descricao" (o que foi comprado/recebido), "categoria" (se identificável entre as existentes; senão null), "conta_ou_cartao" (o nome mencionado, se houver; senão null) e "data" (resolvida a partir de "hoje", formato YYYY-MM-DD; se não mencionada, use a data de hoje).
- "confianca" é "alta" quando valor e destino (conta/cartão) estão claros na mensagem; "media" quando falta 1 campo secundário (categoria, por exemplo); "baixa" quando falta valor OU destino, ou a mensagem é ambígua.
- "faltando" lista os nomes dos campos essenciais que não puderam ser extraídos com segurança (ex.: ["valor"], ["conta_ou_cartao"]) — vazio quando confianca é "alta".
- NUNCA invente valores, categorias ou contas que não estejam explícitos na mensagem ou na lista fornecida.
- Responda SOMENTE com o JSON conforme o schema — nenhum texto antes ou depois.`;
}

module.exports = { PARSE_SCHEMA, buildParsePrompt };
