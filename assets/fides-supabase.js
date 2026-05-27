// assets/fides-supabase.js
// Cliente Supabase singleton — expõe window.fidesDb e window.fidesAuth

(function () {
  'use strict';

  function initSupabase() {
    const config = window.FIDES_CONFIG;

    if (!config || !config.supabaseUrl || config.supabaseUrl === '') {
      console.warn('[Fides] Supabase não inicializado: FIDES_CONFIG ausente.');
      window.fidesDb   = null;
      window.fidesAuth = null;
      return;
    }

    const { createClient } = window.supabase;
    const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        autoRefreshToken:    true,
        persistSession:      true,
        detectSessionInUrl:  true,
      },
    });

    window.fidesDb   = client;
    window.fidesAuth = client.auth;
    console.info('[Fides] Supabase inicializado com sucesso.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabase);
  } else {
    initSupabase();
  }
})();
