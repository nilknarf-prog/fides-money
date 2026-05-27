// api/inject-config.js
// Vercel Serverless Function
// Serve as variáveis de ambiente de forma segura para o browser

export default function handler(req, res) {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL      || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  res.send(`
window.FIDES_CONFIG = {
  supabaseUrl:     "${url}",
  supabaseAnonKey: "${anonKey}"
};
  `.trim());
}
