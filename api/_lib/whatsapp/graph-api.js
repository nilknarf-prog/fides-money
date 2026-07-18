// api/_lib/whatsapp/graph-api.js — CommonJS, não roteável (mesma convenção de _lib/gemini.js)
// Envio de mensagem de texto via Meta WhatsApp Cloud API (Pattern 3 do 14-RESEARCH.md).
//
// Sem retry/fallback (a Graph API não tem o modelo de contingência dupla do Gemini) —
// falha de envio NUNCA pode quebrar o handler do webhook (Pitfall 5: sempre responder
// 200 à Meta). Retorno normalizado { ok, status } como convenção do _lib.

const GRAPH_API_VERSION = 'v23.0';

/**
 * Envia uma mensagem de texto via Graph API do WhatsApp Cloud API.
 * @param {string} phoneNumberId - ID do número de telefone (Meta, não E.164)
 * @param {string} toE164 - destinatário em E.164 sem "+" (convenção de profiles.phone)
 * @param {string} body - texto da mensagem
 * @param {string} token - access token do system user (Bearer)
 * @returns {Promise<{ok: boolean, status: number}>}
 */
async function sendTextMessage(phoneNumberId, toE164, body, token) {
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toE164,
        type: 'text',
        text: { preview_url: false, body },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error('[whatsapp] graph send error', res.status, errBody);
      return { ok: false, status: res.status };
    }

    return { ok: true, status: res.status };
  } catch (err) {
    // Falha de rede/exceção nunca pode quebrar o handler — o webhook sempre responde
    // 200 à Meta independente do resultado do envio (Pitfall 5 do 14-RESEARCH.md).
    console.error('[whatsapp] graph send exception', err);
    return { ok: false, status: 0 };
  }
}

module.exports = { sendTextMessage };
