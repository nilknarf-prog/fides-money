#!/usr/bin/env node
// scripts/wa-proto-hmac.js — Protótipo Wave 0-a (Open Question 1 do 14-RESEARCH.md)
//
// Prova, OFFLINE e sem env vars, a mecânica de raw-body + HMAC-SHA256 usada por
// api/_lib/whatsapp/signature.js — a fundação de segurança do webhook (T-14-05).
// Roda com: node scripts/wa-proto-hmac.js
//
// Não depende do App Secret real da Meta (isso só existe pós-setup, plano 14-05) —
// usa um secret de teste local só para provar a MECÂNICA de comparação
// (assinatura correta passa, os 3 casos negativos falham, sem lançar exceção).

const crypto = require('crypto');
const { verifySignature } = require('../api/_lib/whatsapp/signature');

const APP_SECRET = 'test-secret-nao-usar-em-producao';

function sign(rawBody, secret) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

let failures = 0;

function check(label, actual, expected) {
  if (actual === expected) {
    console.log(`PASS: ${label}`);
  } else {
    console.log(`FAIL: ${label} (esperado ${expected}, obteve ${actual})`);
    failures++;
  }
}

// Payload simulando o formato de mensagem da Meta (só precisa ser bytes estáveis).
const rawBody = Buffer.from(JSON.stringify({
  object: 'whatsapp_business_account',
  entry: [{
    id: '000000000000000',
    changes: [{
      value: {
        messaging_product: 'whatsapp',
        messages: [{ from: '5511999999999', id: 'wamid.TEST123', type: 'text', text: { body: 'gastei 45 no mercado' } }],
      },
      field: 'messages',
    }],
  }],
}), 'utf8');

// Caso 1: assinatura correta → true.
const correctHeader = sign(rawBody, APP_SECRET);
check('assinatura correta -> true', verifySignature(rawBody, correctHeader, APP_SECRET), true);

// Caso 2: assinatura errada (secret diferente) → false.
const wrongHeader = sign(rawBody, 'outro-secret-errado');
check('assinatura errada -> false', verifySignature(rawBody, wrongHeader, APP_SECRET), false);

// Caso 3: header ausente/sem prefixo sha256= → false.
check('header ausente (undefined) -> false', verifySignature(rawBody, undefined, APP_SECRET), false);
check('header sem prefixo sha256= -> false', verifySignature(rawBody, 'deadbeef', APP_SECRET), false);

// Caso 4: comprimento do hex divergente do esperado → false, sem lançar.
let threw = false;
let shortResult;
try {
  shortResult = verifySignature(rawBody, 'sha256=abc123', APP_SECRET);
} catch (err) {
  threw = true;
}
check('hex de comprimento divergente não lança', threw, false);
check('hex de comprimento divergente -> false', shortResult, false);

if (failures > 0) {
  console.log(`\n${failures} caso(s) FALHARAM.`);
  process.exit(1);
} else {
  console.log('\nTodos os casos PASS — mecânica de HMAC/timingSafeEqual provada offline (Open Question 1).');
}
