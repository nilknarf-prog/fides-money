// api/inject-config.js
// Vercel Serverless Function — CommonJS (module.exports obrigatório no Vercel Node.js runtime)

module.exports = (req, res) => {
  const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL      || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(
    `window.FIDES_CONFIG = {\n  supabaseUrl:     "${supabaseUrl}",\n  supabaseAnonKey: "${supabaseAnonKey}"\n};`
  );
};
