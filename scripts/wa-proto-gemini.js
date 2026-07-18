#!/usr/bin/env node
// scripts/wa-proto-gemini.js — Protótipo Wave 0-b (Open Question 2 / Assumption A3 do 14-RESEARCH.md)
//
// Prova que responseSchema + toolMode 'NONE' coexistem no mesmo payload generateContent
// (via api/_lib/gemini.js) sem erro 400 — a incógnita central da Open Question 2.
//
// Roda com: GEMINI_API_KEY=xxx node scripts/wa-proto-gemini.js
// Sem a env var, imprime SKIP e sai com código 0 (não quebra o build).

const gemini = require('../api/_lib/gemini');
const { PARSE_SCHEMA, buildParsePrompt } = require('../api/_lib/whatsapp/parser-schema');

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('SKIP: GEMINI_API_KEY não definida no ambiente.');
    console.log('Para rodar este protótipo: GEMINI_API_KEY=<sua-key> node scripts/wa-proto-gemini.js');
    process.exit(0);
  }

  const systemPrompt = buildParsePrompt({
    hoje: '2026-07-17',
    categorias: ['Mercado', 'Transporte', 'Lazer'],
    contas: ['Nubank'],
    cartoes: ['Nubank Cartão'],
  });

  const payload = gemini.buildPayload({
    systemPrompt,
    contents: [{ role: 'user', parts: [{ text: 'gastei 45 no mercado hoje no nubank' }] }],
    toolMode: 'NONE',
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 200,
      responseMimeType: 'application/json',
      responseSchema: PARSE_SCHEMA,
    },
  });

  const result = await gemini.callGemini(payload, apiKey);

  if (!result.ok) {
    console.log(`FAIL: chamada ao Gemini não-ok (status ${result.status}, errorCode ${result.errorCode})`);
    process.exit(1);
  }

  const { textReply } = gemini.parseResponse(result.data);

  let parsed;
  try {
    parsed = JSON.parse(textReply);
  } catch (err) {
    console.log('FAIL: textReply não é JSON válido:', textReply);
    process.exit(1);
  }

  if (!parsed || typeof parsed.intent !== 'string') {
    console.log('FAIL: JSON parseado não contém "intent":', parsed);
    process.exit(1);
  }

  console.log('PASS: responseSchema + toolMode NONE coexistem sem erro 400 (Open Question 2 / A3 resolvida).');
  console.log('Resposta parseada:', JSON.stringify(parsed, null, 2));
}

main().catch((err) => {
  console.error('FAIL: exceção não tratada', err);
  process.exit(1);
});
