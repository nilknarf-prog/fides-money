// assets/fides-supabase.js
// Cliente Supabase singleton — expõe window.fidesDb e window.fidesAuth

window._fidesAuthResolvers = [];
window._fidesAuthRejectors = [];
window.waitForAuth = function () {
  if (window.fidesAuth) return Promise.resolve(window.fidesAuth);
  return new Promise(function (resolve, reject) {
    window._fidesAuthResolvers = window._fidesAuthResolvers || [];
    window._fidesAuthRejectors = window._fidesAuthRejectors || [];
    window._fidesAuthResolvers.push(resolve);
    window._fidesAuthRejectors.push(reject);
  });
};

(function () {
  'use strict';

  function initSupabase() {
    const config = window.FIDES_CONFIG;

    if (!config || !config.supabaseUrl || config.supabaseUrl === '') {
      console.warn('[Fides] Supabase não inicializado: FIDES_CONFIG ausente.');
      window.fidesDb   = null;
      window.fidesAuth = null;
      const err = new Error('Serviço indisponível. Tente novamente mais tarde.');
      if (window._fidesAuthRejectors) {
        window._fidesAuthRejectors.forEach(function (fn) { fn(err); });
        window._fidesAuthRejectors = [];
        window._fidesAuthResolvers = [];
      }
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
    if (window._fidesAuthResolvers) {
      window._fidesAuthResolvers.forEach(function (fn) { fn(client.auth); });
      window._fidesAuthResolvers = [];
      window._fidesAuthRejectors = [];
    }
    console.info('[Fides] Supabase inicializado com sucesso.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabase);
  } else {
    initSupabase();
  }
})();
