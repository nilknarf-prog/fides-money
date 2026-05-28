// fides-auth.jsx — Tela de autenticação (login + cadastro)
// Só carregado em index.html — nunca em Fides-app.html

function FidesAuth({ onAuth }) {
  const [authMode, setAuthMode] = React.useState('login'); // 'login' | 'cadastro'
  const [loading,  setLoading]  = React.useState(false);
  const [error,    setError]    = React.useState('');
  const [success,  setSuccess]  = React.useState('');

  // Form refs
  const nameRef     = React.useRef(null);
  const emailRef    = React.useRef(null);
  const passwordRef = React.useRef(null);

  // Reset messages when switching mode
  function switchMode(m) {
    setAuthMode(m);
    setError('');
    setSuccess('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const email    = emailRef.current?.value?.trim()    || '';
    const password = passwordRef.current?.value         || '';
    const name     = nameRef.current?.value?.trim()     || '';

    try {
      const auth = await window.waitForAuth();
      if (authMode === 'cadastro') {
        const { error: err } = await auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (err) throw err;
        setSuccess('Verifique seu e-mail para confirmar o cadastro.');
      } else {
        const { error: err } = await auth.signInWithPassword({ email, password });
        if (err) throw err;
        // onAuthStateChange no store detecta e troca mode para 'live'
        onAuth?.();
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials'))
        setError('E-mail ou senha incorretos.');
      else if (msg.includes('Email already registered') || msg.includes('already registered') || msg.includes('User already registered'))
        setError('Este e-mail já está cadastrado.');
      else if (msg.includes('Password should be at least'))
        setError('A senha deve ter pelo menos 6 caracteres.');
      else if (msg.includes('Email not confirmed'))
        setError('E-mail não confirmado. Verifique sua caixa de entrada.');
      else
        setError(msg || 'Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const email = emailRef.current?.value?.trim() || '';
    if (!email) { setError('Digite seu e-mail para recuperar a senha.'); return; }
    setError(''); setLoading(true);
    try {
      const auth = await window.waitForAuth();
      const { error: err } = await auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
      });
      if (err) throw err;
      setSuccess('Enviamos um link de redefinição para ' + email + '.');
    } catch (err) {
      setError(err.message || 'Erro ao enviar e-mail de recuperação.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page-layout">

      {/* ─── Coluna de marca ─── */}
      <div className="auth-brand-col">
        <div className="auth-brand-inner">
          <div className="auth-logo-mark">
            <svg width="56" height="56" viewBox="0 0 36 36" aria-hidden="true">
              <defs>
                <linearGradient id="auth-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%"  stopColor="#3B7350"/>
                  <stop offset="100%" stopColor="#1F4029"/>
                </linearGradient>
              </defs>
              <path d="M 0 14 C 0 4, 4 0, 14 0 L 22 0 C 32 0, 36 4, 36 14 L 36 22 C 36 32, 32 36, 22 36 L 14 36 C 4 36, 0 32, 0 22 Z"
                    fill="url(#auth-grad)"/>
              <rect x="11" y="9"  width="4"  height="18" rx="2" fill="#FFFFFF"/>
              <rect x="11" y="9"  width="15" height="4"  rx="2" fill="#FFFFFF"/>
              <rect x="11" y="16" width="11" height="4"  rx="2" fill="#FFFFFF"/>
              <path d="M 13 26.5 L 17 22.5" stroke="#86E0A0" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.9"/>
            </svg>
          </div>
          <h1 className="auth-wordmark">Fides</h1>
          <p className="auth-tagline">Gestão financeira pessoal</p>
        </div>
      </div>

      {/* ─── Coluna do formulário ─── */}
      <div className="auth-form-col">
        <div className="auth-card">

          {/* ─── Tabs ─── */}
          <div className="auth-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={authMode === 'login'}
              className={`auth-tab${authMode === 'login' ? ' is-active' : ''}`}
              onClick={() => switchMode('login')}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              Entrar
            </button>
            <button
              role="tab"
              aria-selected={authMode === 'cadastro'}
              className={`auth-tab${authMode === 'cadastro' ? ' is-active' : ''}`}
              onClick={() => switchMode('cadastro')}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              Criar conta
            </button>
          </div>

          {/* ─── Botões sociais ─── */}
          <div className="auth-social-btns">
            <button
              type="button"
              className="auth-social-btn"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continuar com Google
            </button>

            <button
              type="button"
              className="auth-social-btn"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
              </svg>
              Continuar com Apple
            </button>
          </div>

          {/* ─── Separador ─── */}
          <div className="auth-divider">
            <span>ou</span>
          </div>

          {/* ─── Formulário ─── */}
          <form className="auth-form" onSubmit={handleSubmit} noValidate>

            {/* Nome — só no cadastro */}
            {authMode === 'cadastro' && (
              <div className="auth-field">
                <label className="auth-label" htmlFor="auth-name">Nome completo</label>
                <input
                  id="auth-name"
                  ref={nameRef}
                  type="text"
                  name="name"
                  autoComplete="name"
                  placeholder="Seu nome"
                  required
                  className="auth-input"
                  style={{ fontSize: 16 }}
                />
              </div>
            )}

            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-email">E-mail</label>
              <input
                id="auth-email"
                ref={emailRef}
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                placeholder="seu@email.com"
                required
                className="auth-input"
                style={{ fontSize: 16 }}
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-password">Senha</label>
              <input
                id="auth-password"
                ref={passwordRef}
                type="password"
                name="password"
                autoComplete={authMode === 'cadastro' ? 'new-password' : 'current-password'}
                placeholder={authMode === 'cadastro' ? 'Mínimo 6 caracteres' : '••••••••'}
                required
                minLength={6}
                className="auth-input"
                style={{ fontSize: 16 }}
              />
              {authMode === 'login' && (
                <a
                  href="#"
                  className="auth-forgot-link"
                  onClick={(e) => { e.preventDefault(); handleForgotPassword(); }}
                >
                  Esqueceu a senha?
                </a>
              )}
            </div>

            {/* Feedback */}
            {error   && <div className="auth-msg auth-msg--error"   role="alert">{error}</div>}
            {success && <div className="auth-msg auth-msg--success" role="status">{success}</div>}

            <button
              type="submit"
              disabled={loading}
              className={`auth-btn-primary${loading ? ' is-loading' : ''}`}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              {loading
                ? <span className="auth-spinner" aria-hidden="true"></span>
                : authMode === 'cadastro' ? 'Criar conta' : 'Entrar'}
            </button>

          </form>

        </div>
      </div>

    </div>
  );
}

Object.assign(window, { FidesAuth });
