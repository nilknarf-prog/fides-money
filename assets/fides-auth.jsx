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
    <div className="fds-auth-screen">
      <div className="fds-auth-container">

        {/* ─── Logo ─── */}
        <div className="fds-auth-brand">
          <div className="fds-auth-mark">
            <svg width="48" height="48" viewBox="0 0 36 36">
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
          <h1 className="fds-auth-wordmark">Fides</h1>
          <p className="fds-auth-tagline">Suas finanças, com clareza.</p>
        </div>

        {/* ─── Tabs ─── */}
        <div className="fds-auth-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={authMode === 'login'}
            className={`fds-auth-tab ${authMode === 'login' ? 'on' : ''}`}
            onClick={() => switchMode('login')}
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          >
            Entrar
          </button>
          <button
            role="tab"
            aria-selected={authMode === 'cadastro'}
            className={`fds-auth-tab ${authMode === 'cadastro' ? 'on' : ''}`}
            onClick={() => switchMode('cadastro')}
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          >
            Criar conta
          </button>
        </div>

        {/* ─── Form ─── */}
        <form className="fds-auth-form" onSubmit={handleSubmit} noValidate>

          {/* Nome — só no cadastro */}
          {authMode === 'cadastro' && (
            <div className="fds-auth-field">
              <label className="fds-auth-label" htmlFor="auth-name">Nome completo</label>
              <input
                id="auth-name"
                ref={nameRef}
                type="text"
                name="name"
                autoComplete="name"
                placeholder="Seu nome"
                required
                className="fds-auth-input"
                style={{ fontSize: 16 }}
              />
            </div>
          )}

          <div className="fds-auth-field">
            <label className="fds-auth-label" htmlFor="auth-email">E-mail</label>
            <input
              id="auth-email"
              ref={emailRef}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder="seu@email.com"
              required
              className="fds-auth-input"
              style={{ fontSize: 16 }}
            />
          </div>

          <div className="fds-auth-field">
            <label className="fds-auth-label" htmlFor="auth-password">Senha</label>
            <input
              id="auth-password"
              ref={passwordRef}
              type="password"
              name="password"
              autoComplete={authMode === 'cadastro' ? 'new-password' : 'current-password'}
              placeholder={authMode === 'cadastro' ? 'Mínimo 6 caracteres' : '••••••••'}
              required
              minLength={6}
              className="fds-auth-input"
              style={{ fontSize: 16 }}
            />
          </div>

          {/* Feedback */}
          {error   && <div className="fds-auth-msg fds-auth-msg--error"   role="alert">{error}</div>}
          {success && <div className="fds-auth-msg fds-auth-msg--success" role="status">{success}</div>}

          <button
            type="submit"
            disabled={loading}
            className="fds-auth-btn-primary"
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          >
            {loading
              ? 'Aguarde...'
              : authMode === 'cadastro' ? 'Criar conta' : 'Entrar'}
          </button>

          {/* Esqueci a senha — só no login */}
          {authMode === 'login' && (
            <button
              type="button"
              className="fds-auth-link"
              onClick={handleForgotPassword}
              disabled={loading}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              Esqueci minha senha
            </button>
          )}
        </form>

      </div>
    </div>
  );
}

Object.assign(window, { FidesAuth });
