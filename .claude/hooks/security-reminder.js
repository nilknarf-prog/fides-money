// PostToolUse hook — Fides Money
// Injeta lembrete de revisão de segurança quando Edit/Write/MultiEdit toca api/ ou supabase/.
// Recebe o JSON do hook via stdin; emite additionalContext no stdout apenas nos paths sensíveis.
"use strict";

let data = "";
process.stdin.on("data", (c) => (data += c));
process.stdin.on("end", () => {
  try {
    const j = JSON.parse(data || "{}");
    const ti = j.tool_input || {};
    const paths = [ti.file_path, ti.filePath, ti.path].filter(Boolean).map(String);
    const SENSITIVE = /(?:^|[\\/])(api|supabase)[\\/]/;
    const hit = paths.find((p) => SENSITIVE.test(p));
    if (!hit) return;
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext:
            `AVISO DE SEGURANCA: arquivo sensivel alterado (${hit}). ` +
            `Antes de commitar, rode revisao de seguranca — agent security-reviewer ou /ecc:security-scan. ` +
            `Checar: auth Supabase, RLS, RPCs (pay_card_invoice / transfer_funds), env/segredos, superficie do assistente IA (api/assistant.js e READ-only).`,
        },
      })
    );
  } catch (_) {
    // JSON malformado ou stdin vazio: nao bloquear, nao emitir nada.
  }
});
