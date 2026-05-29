// fides-auth.jsx — Tela de auth do Fides Money
// SPA puro: carregue via <script type="text/babel" src="fides-auth.jsx"></script>
// Depende de:
//   • window.fidesAuth (wrapper Supabase já configurado no projeto)
//   • Variáveis CSS globais consumidas em fides-auth.css
//
// Exporta:
//   • window.FidesAuth — o componente React (renderize em qualquer container)
//
// Modos:
//   • 'login'   — e-mail + senha (com link "Esqueci a senha")
//   • 'signup'  — nome + e-mail + senha
//   • 'forgot'  — só e-mail → resetPasswordForEmail
//
// Uso:
//   ReactDOM.createRoot(document.getElementById('auth-root'))
//           .render(<FidesAuth onAuthenticated={(session) => {...}}/>);

(function () {
  const { useState, useEffect, useCallback } = React;

  // ─── Brand mark ─────────────────────────────────────────────
  function FidesMark({ size = 56 }) {
    return (
      <svg width={size} height={size} viewBox="0 0 36 36" style={{ display: 'block', flex: 'none' }} aria-hidden="true">
        <defs>
          <linearGradient id="fa-mark-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor="#3B7350"/>
            <stop offset="100%" stopColor="#1F4029"/>
          </linearGradient>
        </defs>
        <path d="M 0 14 C 0 4, 4 0, 14 0 L 22 0 C 32 0, 36 4, 36 14 L 36 22 C 36 32, 32 36, 22 36 L 14 36 C 4 36, 0 32, 0 22 Z"
              fill="url(#fa-mark-bg)"/>
        <rect x="11" y="9"  width="4"  height="18" rx="2" fill="#FFFFFF"/>
        <rect x="11" y="9"  width="15" height="4"  rx="2" fill="#FFFFFF"/>
        <rect x="11" y="16" width="11" height="4"  rx="2" fill="#FFFFFF"/>
        <path d="M 13 26.5 L 17 22.5" stroke="#86E0A0" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.95"/>
      </svg>
    );
  }

  // ─── Icons ──────────────────────────────────────────────────
  const Ic = {
    mail: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 7l9 6 9-6"/></svg>,
    lock: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>,
    user: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>,
    eye: ({ off, ...p }) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>{off && <path d="M4 4l16 16"/>}</svg>,
    check: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6"/></svg>,
    alert: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4.5"/><circle cx="12" cy="16.2" r="0.4" fill="currentColor"/></svg>,
    arrow: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>,
    spinner: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" style={{ animation: 'fa-spin 0.8s linear infinite', display: 'block' }}><circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.28)" strokeWidth="2.4"/><path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg>,
  };

  const GoogleG = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
  const AppleLogo = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.04c-.03-3.16 2.58-4.68 2.7-4.75-1.47-2.15-3.76-2.44-4.58-2.48-1.95-.2-3.8 1.15-4.79 1.15-.99 0-2.51-1.12-4.13-1.09-2.12.03-4.08 1.23-5.17 3.13-2.2 3.82-.56 9.46 1.59 12.56 1.05 1.52 2.3 3.22 3.94 3.16 1.58-.06 2.18-1.02 4.09-1.02 1.91 0 2.45 1.02 4.13.99 1.71-.03 2.79-1.55 3.83-3.07 1.21-1.76 1.7-3.47 1.73-3.56-.04-.02-3.31-1.27-3.34-5.02zM13.95 3.5c.87-1.06 1.46-2.54 1.3-4-1.26.05-2.78.84-3.69 1.9-.81.93-1.52 2.42-1.33 3.86 1.4.11 2.84-.71 3.72-1.76z"/>
    </svg>
  );

  // ─── Field ──────────────────────────────────────────────────
  function Field({ label, icon, type = 'text', name, value, onChange, placeholder, autoComplete, disabled, error, trailing, autoFocus }) {
    const [focused, setFocused] = useState(false);
    return (
      <label className="fa-field">
        <span className="fa-field-label">{label}</span>
        <span className={
          'fa-input-wrap'
          + (focused ? ' is-focused' : '')
          + (error   ? ' is-error'   : '')
          + (disabled? ' is-disabled': '')
        }>
          {icon && <span className="fa-input-icon">{icon}</span>}
          <input
            className="fa-input"
            type={type}
            name={name}
            value={value || ''}
            onChange={onChange}
            placeholder={placeholder}
            autoComplete={autoComplete}
            disabled={disabled}
            autoFocus={autoFocus}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          {trailing}
        </span>
      </label>
    );
  }

  // ─── Message banner ─────────────────────────────────────────
  function AuthMsg({ kind, title, body }) {
    const Icon = kind === 'error' ? Ic.alert : Ic.check;
    return (
      <div className={`fa-msg fa-msg-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
        <span className="fa-msg-icon"><Icon width="14" height="14"/></span>
        <div className="fa-msg-body">
          <strong>{title}</strong>
          {body && <span>{body}</span>}
        </div>
      </div>
    );
  }

  // ─── Friendly error messages ────────────────────────────────
  // Tradução leve de mensagens conhecidas do Supabase.
  function friendlyError(err) {
    const raw = (err?.message || String(err) || '').toLowerCase();
    if (raw.includes('invalid login credentials') || raw.includes('invalid email or password'))
      return 'E-mail ou senha incorretos. Confira os dados e tente novamente.';
    if (raw.includes('email not confirmed'))
      return 'Você ainda não confirmou seu e-mail. Verifique sua caixa de entrada.';
    if (raw.includes('user already registered') || raw.includes('already been registered'))
      return 'Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.';
    if (raw.includes('password should be at least'))
      return 'A senha precisa ter pelo menos 8 caracteres.';
    if (raw.includes('rate limit') || raw.includes('too many'))
      return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    if (raw.includes('network') || raw.includes('failed to fetch'))
      return 'Falha de conexão. Verifique sua internet e tente novamente.';
    return err?.message || 'Algo deu errado. Tente novamente.';
  }

  // ─── Main component ─────────────────────────────────────────
  function FidesAuth({ initialMode = 'login', onAuthenticated, redirectTo } = {}) {
    const REDIRECT = redirectTo || (typeof window !== 'undefined' ? window.location.origin : '');

    const [mode, setMode]       = useState(initialMode); // 'login' | 'signup' | 'forgot'
    const [name, setName]       = useState('');
    const [email, setEmail]     = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw]   = useState(false);
    const [loading, setLoading] = useState(null);        // null | 'email' | 'google' | 'apple'
    const [error, setError]     = useState('');
    const [success, setSuccess] = useState(null);        // null | { title, body, persistButton? }

    // Limpa mensagens ao trocar de modo
    useEffect(() => { setError(''); setSuccess(null); }, [mode]);

    const switchMode = useCallback((next) => {
      if (loading) return;
      setMode(next);
    }, [loading]);

    // ─── Submit handlers ──────────────────────────────────────
    const handleSignIn = useCallback(async () => {
      if (!email || !password) { setError('Preencha e-mail e senha.'); return; }
      setError(''); setSuccess(null); setLoading('email');
      try {
        const { data, error } = await window.fidesAuth.signInWithPassword({ email, password });
        if (error) throw error;
        setSuccess({ title: 'Bem-vindo de volta!', body: 'Carregando seu painel…' });
        onAuthenticated?.(data?.session ?? data);
      } catch (err) {
        setError(friendlyError(err));
      } finally {
        setLoading(null);
      }
    }, [email, password, onAuthenticated]);

    const handleSignUp = useCallback(async () => {
      if (!name || !email || !password) { setError('Preencha todos os campos.'); return; }
      if (password.length < 8)          { setError('A senha precisa ter pelo menos 8 caracteres.'); return; }
      setError(''); setSuccess(null); setLoading('email');
      try {
        const { data, error } = await window.fidesAuth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: REDIRECT,
          },
        });
        if (error) throw error;
        // Supabase: se confirmação por e-mail estiver habilitada, session é null
        if (data?.session) {
          setSuccess({ title: 'Conta criada!', body: 'Carregando seu painel…' });
          onAuthenticated?.(data.session);
        } else {
          setSuccess({
            title: 'Conta criada.',
            body: `Enviamos um link para ${email} — confirme em até 24h para entrar.`,
            persistButton: true,
          });
        }
      } catch (err) {
        setError(friendlyError(err));
      } finally {
        setLoading(null);
      }
    }, [name, email, password, REDIRECT, onAuthenticated]);

    const handleForgot = useCallback(async () => {
      if (!email) { setError('Informe seu e-mail.'); return; }
      setError(''); setSuccess(null); setLoading('email');
      try {
        const { error } = await window.fidesAuth.resetPasswordForEmail(email, { redirectTo: REDIRECT });
        if (error) throw error;
        setSuccess({
          title: 'Enviamos um link para seu e-mail.',
          body: 'Verifique a caixa de entrada (e a pasta de spam) para redefinir sua senha.',
          persistButton: true,
        });
      } catch (err) {
        setError(friendlyError(err));
      } finally {
        setLoading(null);
      }
    }, [email, REDIRECT]);

    const handleOAuth = useCallback(async (provider) => {
      setError(''); setSuccess(null); setLoading(provider);
      try {
        const { error } = await window.fidesAuth.signInWithOAuth({
          provider,
          options: { redirectTo: REDIRECT },
        });
        if (error) throw error;
        // OAuth redireciona o navegador; mantemos loading até a navegação.
      } catch (err) {
        setError(friendlyError(err));
        setLoading(null);
      }
    }, [REDIRECT]);

    const onSubmit = useCallback((e) => {
      e?.preventDefault?.();
      if (loading) return;
      if (mode === 'login')  return handleSignIn();
      if (mode === 'signup') return handleSignUp();
      if (mode === 'forgot') return handleForgot();
    }, [mode, loading, handleSignIn, handleSignUp, handleForgot]);

    // ─── Derived UI flags ─────────────────────────────────────
    const isLogin   = mode === 'login';
    const isSignup  = mode === 'signup';
    const isForgot  = mode === 'forgot';
    const isLoading = !!loading;
    const submitLocked = isLoading || (success && success.persistButton);

    const submitLabel =
      loading === 'email'
        ? (isLogin ? 'Entrando…' : isSignup ? 'Criando conta…' : 'Enviando link…')
        : success?.persistButton
          ? (isSignup ? 'Verifique seu e-mail' : 'Link enviado')
          : isLogin  ? 'Entrar'
          : isSignup ? 'Criar conta'
          :            'Enviar link';

    return (
      <div className="fa-screen">
        <div className="fa-bg-decor"/>

        <div className="fa-content">
          {/* Header */}
          <div className="fa-head">
            <div className="fa-mark-wrap"><FidesMark size={56}/></div>
            <h1 className="fa-wordmark">Fides</h1>
            <div className="fa-eyebrow">
              <span className="fa-eyebrow-line"/>
              <span>Gestão financeira pessoal</span>
              <span className="fa-eyebrow-line"/>
            </div>
          </div>

          <form className="fa-card" onSubmit={onSubmit} noValidate>
            {/* Tabs (login/signup) ou cabeçalho voltar (forgot) */}
            {!isForgot ? (
              <div className="fa-tabs" role="tablist">
                <button type="button" role="tab"
                        className={`fa-tab${isLogin ? ' on' : ''}`}
                        aria-selected={isLogin}
                        onClick={() => switchMode('login')}>
                  Entrar
                </button>
                <button type="button" role="tab"
                        className={`fa-tab${isSignup ? ' on' : ''}`}
                        aria-selected={isSignup}
                        onClick={() => switchMode('signup')}>
                  Criar conta
                </button>
                <div className="fa-tab-thumb" data-pos={isLogin ? '0' : '1'}/>
              </div>
            ) : (
              <div className="fa-mode-head">
                <button type="button" className="fa-mode-back"
                        aria-label="Voltar para entrar"
                        onClick={() => switchMode('login')}>
                  <Ic.arrow width="18" height="18"/>
                </button>
                <div className="fa-mode-title">
                  <strong>Esqueceu sua senha?</strong>
                  <em>Enviaremos um link para redefini-la.</em>
                </div>
              </div>
            )}

            {/* Fields */}
            <div className="fa-fields">
              {isSignup && (
                <Field
                  label="Nome completo"
                  icon={<Ic.user width="16" height="16"/>}
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como devemos te chamar"
                  autoComplete="name"
                  disabled={isLoading || !!success}
                />
              )}
              <Field
                label="E-mail"
                icon={<Ic.mail width="16" height="16"/>}
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                autoComplete="email"
                disabled={isLoading || (!!success && success.persistButton)}
                error={!!error}
                autoFocus={isForgot}
              />
              {!isForgot && (
                <Field
                  label={
                    <span className="fa-label-row">
                      Senha
                      {isLogin && (
                        <button type="button" className="fa-forgot"
                                onClick={() => switchMode('forgot')}>
                          Esqueci a senha
                        </button>
                      )}
                    </span>
                  }
                  icon={<Ic.lock width="16" height="16"/>}
                  type={showPw ? 'text' : 'password'}
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignup ? 'Mínimo 8 caracteres' : '••••••••'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  disabled={isLoading || (!!success && success.persistButton)}
                  error={!!error}
                  trailing={
                    <button type="button" className="fa-input-eye"
                            onClick={() => setShowPw((s) => !s)}
                            aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'}>
                      <Ic.eye off={showPw} width="16" height="16"/>
                    </button>
                  }
                />
              )}
            </div>

            {/* Messages */}
            {error   && <AuthMsg kind="error"   title="Não foi possível continuar." body={error}/>}
            {success && <AuthMsg kind="success" title={success.title} body={success.body}/>}

            {/* Primary submit */}
            <button
              type="submit"
              className={
                'fa-btn-primary'
                + (loading === 'email' ? ' is-loading' : '')
                + (success?.persistButton ? ' is-success' : '')
              }
              disabled={submitLocked}>
              {loading === 'email' && <Ic.spinner width="18" height="18"/>}
              <span>{submitLabel}</span>
            </button>

            {/* OAuth (apenas em login/signup) */}
            {!isForgot && (
              <>
                <div className="fa-or"><span/><em>ou continuar com</em><span/></div>
                <div className="fa-socials">
                  <button type="button" className="fa-social-btn"
                          onClick={() => handleOAuth('google')}
                          disabled={isLoading || !!success}>
                    {loading === 'google' ? <Ic.spinner width="16" height="16"/> : <GoogleG/>}
                    <span>Google</span>
                  </button>
                  <button type="button" className="fa-social-btn"
                          onClick={() => handleOAuth('apple')}
                          disabled={isLoading || !!success}>
                    {loading === 'apple' ? <Ic.spinner width="16" height="16"/> : <AppleLogo/>}
                    <span>Apple</span>
                  </button>
                </div>
              </>
            )}

            {/* Foot link */}
            <div className="fa-foot">
              {isLogin && (
                <>Novo por aqui? <button type="button" className="fa-link-inline"
                                         onClick={() => switchMode('signup')}>Criar grátis</button></>
              )}
              {isSignup && (
                <>Já tem conta? <button type="button" className="fa-link-inline"
                                        onClick={() => switchMode('login')}>Entrar</button></>
              )}
              {isForgot && (
                <button type="button" className="fa-link-inline"
                        onClick={() => switchMode('login')}>Voltar para entrar</button>
              )}
            </div>
          </form>

          <div className="fa-legal">
            Ao continuar você concorda com os <a href="#">Termos</a> e <a href="#">Privacidade</a>.
          </div>
        </div>
      </div>
    );
  }

  // Expor globalmente
  window.FidesAuth = FidesAuth;
})();
