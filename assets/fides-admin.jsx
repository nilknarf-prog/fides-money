// assets/fides-admin.jsx — Painel Admin (/painel, Phase 16 — ADMIN-03)
// SPA React via Babel-standalone, contexto de página ISOLADO (painel.html não
// compartilha window com index.html/Fides-app.html). Single-page com abas por
// hash (#contas/#auditoria) — SEM sub-paths (M10).
//
// Todo dado admin vem exclusivamente de fetch('/api/admin?action=...') com
// Authorization: Bearer <JWT> — NENHUM acesso a dado admin pelo client SDK
// Supabase direto (o client `window.fidesAdminClient` só serve para
// signInWithPassword/getSession/signOut/onAuthStateChange, nunca para
// .from('profiles') ou RPCs de negócio).
//
// SEGURANÇA (carry-forward do 16-02): `reason`/`admin_email`/`email`/`name`
// chegam do backend como texto livre, sem sanitização. Todo campo do backend é
// renderizado via interpolação JSX {valor} — que o React já escapa — NUNCA via
// dangerouslySetInnerHTML.
//
// Depende de:
//   • window.fidesAdminClient (instanciado em painel.html, storageKey
//     'fides-admin-auth' — isola a sessão admin da sessão do app)
//   • window.FidesUI (fides-ui.jsx): ToastViewport, useToast, useConfirm

(function () {
  'use strict';

  const { useState, useEffect } = React;

  const FREE_CAP = 10;
  const LIMIT = 50;

  // ───────────────────────────────────────────────────────────
  // Helpers
  // ───────────────────────────────────────────────────────────

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch (e) {
      return iso;
    }
  }

  // Mapa de códigos de erro do backend (16-02) → mensagem PT-BR amigável.
  // Nunca expõe detalhes internos — só o que o admin precisa saber.
  const ERROR_MESSAGES = {
    JWT_MISSING: 'Sessão expirada — faça login novamente.',
    JWT_INVALID: 'Sessão expirada — faça login novamente.',
    FORBIDDEN: 'Acesso restrito.',
    SUPABASE_CONFIG_MISSING: 'Erro de configuração do servidor. Tente novamente mais tarde.',
    ACCOUNTS_QUERY_FAILED: 'Não foi possível carregar as contas. Tente novamente.',
    AUDIT_QUERY_FAILED: 'Não foi possível carregar a auditoria. Tente novamente.',
    SET_PLAN_FAILED: 'Não foi possível alterar o plano. Tente novamente.',
    TARGET_USER_INVALIDO: 'Conta alvo inválida.',
    PLANO_INVALIDO: 'Plano inválido.',
    REASON_OBRIGATORIO: 'Motivo é obrigatório.',
    ALVO_INEXISTENTE: 'Conta não encontrada (pode ter sido removida).',
    UNKNOWN_ACTION: 'Ação desconhecida.',
    METHOD_NOT_ALLOWED: 'Método não permitido.',
    INTERNAL_ERROR: 'Erro interno. Tente novamente.',
    REQUEST_FAILED: 'Falha na requisição. Tente novamente.',
  };

  function errMsg(err) {
    if (err && err.code && ERROR_MESSAGES[err.code]) return ERROR_MESSAGES[err.code];
    if (err && err.message) return err.message;
    return 'Erro desconhecido.';
  }

  // Único ponto de acesso ao backend admin — sempre com Bearer JWT da sessão
  // isolada do painel. GET usa querystring; POST manda JSON no body.
  async function fetchAdmin(action, opts) {
    const options = opts || {};
    const method = options.method || 'GET';
    const params = options.params;
    const body = options.body;

    const { data: sessionData } = await window.fidesAdminClient.auth.getSession();
    const jwt = sessionData && sessionData.session && sessionData.session.access_token;
    if (!jwt) {
      const err = new Error('JWT_MISSING');
      err.code = 'JWT_MISSING';
      err.status = 401;
      throw err;
    }

    let url = '/api/admin?action=' + encodeURIComponent(action);
    if (params) {
      Object.keys(params).forEach((k) => {
        const v = params[k];
        if (v !== undefined && v !== null && v !== '') {
          url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(v);
        }
      });
    }

    const headers = { Authorization: 'Bearer ' + jwt };
    if (method === 'POST') headers['Content-Type'] = 'application/json';

    const res = await fetch(url, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
    });

    let json = null;
    try { json = await res.json(); } catch (e) { /* sem corpo/JSON inválido */ }

    if (!res.ok) {
      const err = new Error((json && json.error) || 'REQUEST_FAILED');
      err.code = (json && json.error) || 'REQUEST_FAILED';
      err.status = res.status;
      throw err;
    }
    return json;
  }

  function readTab() {
    const h = (window.location.hash || '').replace('#', '');
    return h === 'auditoria' ? 'auditoria' : 'contas';
  }

  // ───────────────────────────────────────────────────────────
  // Telas de estado (loading / erro fatal)
  // ───────────────────────────────────────────────────────────

  function Loading({ label }) {
    return <div className="fda-loading">{label}</div>;
  }

  function FatalError({ message }) {
    return <div className="fda-fatal"><div>⚠ {message}</div></div>;
  }

  // ───────────────────────────────────────────────────────────
  // Login
  // ───────────────────────────────────────────────────────────

  function LoginScreen({ notice }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(notice || null);

    async function handleSubmit(e) {
      e.preventDefault();
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        const { error: authError } = await window.fidesAdminClient.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) {
          setError('E-mail ou senha inválidos.');
        }
        // Sucesso: onAuthStateChange (App) atualiza a sessão e prossegue.
      } catch (err) {
        setError('Não foi possível entrar. Tente novamente.');
      } finally {
        setBusy(false);
      }
    }

    return (
      <div className="fda-login-wrap">
        <div className="fda-login-card">
          <div className="fda-eyebrow">Backoffice</div>
          <div className="fda-brand">
            Fides Money<span className="tick">.</span>{' '}
            <span style={{ fontWeight: 600, color: 'var(--ink-3)' }}>/painel</span>
          </div>
          <p className="fda-hint">
            Acesso restrito a administradores. Conta dedicada — sua conta pessoal do app não entra aqui.
          </p>
          <form onSubmit={handleSubmit}>
            <label htmlFor="fda-email">E-mail do admin</label>
            <input
              id="fda-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              required
            />
            <label htmlFor="fda-password">Senha</label>
            <input
              id="fda-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              required
            />
            {error && <div className="fda-login-error">{error}</div>}
            <button type="submit" className="fda-btn fda-btn-primary" disabled={busy || !email || !password}>
              {busy ? 'Entrando…' : 'Entrar no painel'}
            </button>
          </form>
          <p className="fda-login-note">
            Sessão isolada do app (storage próprio).<br />
            Tentativas negadas são auditadas.
          </p>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────
  // Acesso negado (403 do backend — usuário logado, não-allowlisted)
  // ───────────────────────────────────────────────────────────

  function AcessoNegado({ email, onSignOut }) {
    return (
      <div className="fda-denied-wrap">
        <div className="fda-denied-card">
          <div className="fda-denied-icon">!</div>
          <h1>Acesso restrito</h1>
          <p>
            {email ? <b>{email}</b> : 'Sua conta'} não tem permissão de administrador no Fides Money.
            Essa tentativa foi registrada na auditoria.
          </p>
          <button className="fda-btn" onClick={onSignOut}>Sair</button>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────
  // Badges / células reutilizáveis
  // ───────────────────────────────────────────────────────────

  function PlanBadge({ plan }) {
    return <span className={'fda-badge ' + (plan || 'free')}>{plan}</span>;
  }

  function AiCell({ plan, count }) {
    const n = count || 0;
    const over = plan === 'free' && n >= FREE_CAP;
    return (
      <span className="fda-num" style={over ? { color: 'var(--warn)', fontWeight: 600 } : undefined}>
        {n}{plan === 'free' ? '/' + FREE_CAP : ''}{over ? ' ⚠' : ''}
      </span>
    );
  }

  function auditKind(e) {
    if (e.status === 'denied') return 'denied';
    if (e.status === 'error') return 'error';
    if (e.action === 'set_plan') return 'ok';
    return 'read';
  }

  function auditDiff(e) {
    if (e.action === 'set_plan' && e.before && e.after) {
      return (e.before.plan || '?') + ' → ' + (e.after.plan || '?');
    }
    return '—';
  }

  // ───────────────────────────────────────────────────────────
  // Modal Alterar Plano — select + motivo obrigatório → ConfirmDialog (fides-ui)
  // NENHUMA escrita de plan pelo client SDK: só POST /api/admin?action=set_plan.
  // ───────────────────────────────────────────────────────────

  function AlterarPlanoModal({ account, confirm, toast, onClose, onSuccess }) {
    const [newPlan, setNewPlan] = useState(account.plan === 'free' ? 'pro' : 'free');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const reasonValid = reason.trim().length >= 4;

    async function handleContinue() {
      if (!reasonValid || submitting) return;
      const trimmedReason = reason.trim();
      const ok = await confirm({
        title: 'Confirmar alteração de plano',
        message: (
          <div>
            <p style={{ margin: '0 0 8px' }}>
              <b>{account.email}</b>: {account.plan} → <b>{newPlan}</b>
            </p>
            <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: 13 }}>Motivo: {trimmedReason}</p>
          </div>
        ),
        confirmLabel: 'Confirmar',
        cancelLabel: 'Voltar',
      });
      if (!ok) return;
      setSubmitting(true);
      try {
        await fetchAdmin('set_plan', {
          method: 'POST',
          body: { target_user: account.user_id, new_plan: newPlan, reason: trimmedReason },
        });
        toast.success('Plano de ' + account.email + ': ' + account.plan + ' → ' + newPlan + ' (auditado)');
        onSuccess(newPlan);
      } catch (err) {
        toast.error(errMsg(err));
      } finally {
        setSubmitting(false);
      }
    }

    return (
      <div className="fda-modal-backdrop" onPointerUp={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="fda-modal" onPointerUp={(e) => e.stopPropagation()}>
          <h3>Alterar plano</h3>
          <p className="fda-modal-target"><b>{account.email}</b> — plano atual: <b>{account.plan}</b></p>

          <label htmlFor="fda-modal-plan">Novo plano</label>
          <select
            id="fda-modal-plan"
            value={newPlan}
            onChange={(e) => setNewPlan(e.target.value)}
            disabled={submitting}
          >
            <option value="free">free</option>
            <option value="pro">pro</option>
            <option value="family">family</option>
          </select>

          <label htmlFor="fda-modal-reason">
            Motivo <span className="fda-req">*</span>{' '}
            <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>(vai para a auditoria)</span>
          </label>
          <textarea
            id="fda-modal-reason"
            placeholder="Ex.: teste de degustação free — UAT Phase 13"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={submitting}
          />
          {reason.length > 0 && !reasonValid && (
            <div className="fda-warn-box">
              O motivo precisa de pelo menos 4 caracteres — toda mutação fica registrada na auditoria.
            </div>
          )}

          <div className="fda-actions">
            <button className="fda-btn" onClick={onClose} disabled={submitting}>Cancelar</button>
            <button
              className="fda-btn fda-btn-primary"
              style={{ width: 'auto', marginTop: 0 }}
              disabled={!reasonValid || submitting}
              onClick={handleContinue}
            >
              {submitting ? 'Aplicando…' : 'Continuar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────
  // Contas — busca + filtro + tabela + paginação + Alterar plano
  // ───────────────────────────────────────────────────────────

  function ContasView({ toast }) {
    const confirmState = FidesUI.useConfirm();
    const confirm = confirmState.confirm;
    const ConfirmHost = confirmState.ConfirmHost;

    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [planFilter, setPlanFilter] = useState('');
    const [page, setPage] = useState(0);
    const [reloadKey, setReloadKey] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [data, setData] = useState({ accounts: [], total_count: 0 });
    const [modalAccount, setModalAccount] = useState(null);

    // Debounce da busca — evita 1 fetch por tecla digitada.
    useEffect(() => {
      const t = setTimeout(() => {
        setSearch(searchInput.trim());
        setPage(0);
      }, 350);
      return () => clearTimeout(t);
    }, [searchInput]);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      setLoadError(null);
      fetchAdmin('accounts', {
        params: { search: search || undefined, plan: planFilter || undefined, limit: LIMIT, offset: page * LIMIT },
      })
        .then((json) => { if (!cancelled) setData(json || { accounts: [], total_count: 0 }); })
        .catch((err) => { if (!cancelled) setLoadError(errMsg(err)); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [search, planFilter, page, reloadKey]);

    const accounts = data.accounts || [];
    const total = data.total_count || 0;
    const from = total === 0 ? 0 : page * LIMIT + 1;
    const to = Math.min(total, page * LIMIT + accounts.length);

    function handlePlanChanged(userId, plan) {
      setData((prev) => ({
        ...prev,
        accounts: (prev.accounts || []).map((a) => (a.user_id === userId ? { ...a, plan } : a)),
      }));
      // Re-sincroniza com o backend (a linha de auditoria já reflete a troca).
      setReloadKey((k) => k + 1);
    }

    return (
      <div>
        <h1 className="fda-title">Contas</h1>
        <p className="fda-sub">
          Todas as contas cadastradas no Fides Money. Trocar plano exige motivo e fica na auditoria.
        </p>
        <div className="fda-panel-card">
          <div className="fda-card-head">
            <input
              className="fda-search-input"
              placeholder="Buscar por e-mail ou nome…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <select
              className="fda-plan-filter"
              value={planFilter}
              onChange={(e) => { setPlanFilter(e.target.value); setPage(0); }}
            >
              <option value="">Todos os planos</option>
              <option value="free">free</option>
              <option value="pro">pro</option>
              <option value="family">family</option>
            </select>
          </div>
          <table className="fda-table">
            <thead>
              <tr>
                <th>Conta</th><th>Plano</th><th>Criado em</th><th>Último login</th>
                <th style={{ textAlign: 'right' }}>IA/mês</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="fda-empty-row"><td colSpan={6}>Carregando…</td></tr>
              ) : loadError ? (
                <tr className="fda-empty-row"><td colSpan={6}>{loadError}</td></tr>
              ) : accounts.length === 0 ? (
                <tr className="fda-empty-row"><td colSpan={6}>Nenhuma conta encontrada para essa busca/filtro.</td></tr>
              ) : accounts.map((a) => (
                <tr key={a.user_id}>
                  <td>
                    <div className="fda-cell-main">{a.email}</div>
                    <div className="fda-cell-sub">{a.name || '—'}</div>
                  </td>
                  <td><PlanBadge plan={a.plan} /></td>
                  <td className="fda-cell-sub">{fmtDate(a.created_at)}</td>
                  <td className="fda-cell-sub">{a.last_sign_in_at ? fmtDate(a.last_sign_in_at) : 'nunca'}</td>
                  <td style={{ textAlign: 'right' }}><AiCell plan={a.plan} count={a.ai_msgs_month} /></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="fda-btn" onClick={() => setModalAccount(a)}>Alterar plano</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="fda-pagination">
            <span>{total === 0 ? 'Nenhuma conta' : `Mostrando ${from}–${to} de ${total}`}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="fda-btn" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Anterior
              </button>
              <button className="fda-btn" disabled={loading || to >= total} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </button>
            </div>
          </div>
        </div>

        {modalAccount && (
          <AlterarPlanoModal
            account={modalAccount}
            confirm={confirm}
            toast={toast}
            onClose={() => setModalAccount(null)}
            onSuccess={(plan) => { handlePlanChanged(modalAccount.user_id, plan); setModalAccount(null); }}
          />
        )}
        <ConfirmHost />
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────
  // Auditoria — leitura de admin_audit_log (mais recente primeiro)
  // ───────────────────────────────────────────────────────────

  function AuditoriaView() {
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [data, setData] = useState({ audit: [], total_count: 0 });

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      setLoadError(null);
      fetchAdmin('audit', { params: { limit: LIMIT, offset: page * LIMIT } })
        .then((json) => { if (!cancelled) setData(json || { audit: [], total_count: 0 }); })
        .catch((err) => { if (!cancelled) setLoadError(errMsg(err)); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [page]);

    const rows = data.audit || [];
    const total = data.total_count || 0;
    const from = total === 0 ? 0 : page * LIMIT + 1;
    const to = Math.min(total, page * LIMIT + rows.length);

    return (
      <div>
        <h1 className="fda-title">Auditoria</h1>
        <p className="fda-sub">Toda ação admin — leituras em linha leve, mutações com antes/depois e motivo.</p>
        <div className="fda-panel-card">
          <table className="fda-table">
            <thead>
              <tr><th>Quando</th><th>Admin</th><th>Ação</th><th>Alvo</th><th>Antes → Depois</th><th>Motivo</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="fda-empty-row"><td colSpan={6}>Carregando…</td></tr>
              ) : loadError ? (
                <tr className="fda-empty-row"><td colSpan={6}>{loadError}</td></tr>
              ) : rows.length === 0 ? (
                <tr className="fda-empty-row"><td colSpan={6}>Nenhuma ação registrada ainda.</td></tr>
              ) : rows.map((e) => (
                <tr key={e.id}>
                  <td className="fda-cell-sub" style={{ whiteSpace: 'nowrap' }}>{fmtDate(e.created_at)}</td>
                  <td className="fda-cell-main" style={{ fontSize: 'var(--fs-sm)' }}>{e.admin_email}</td>
                  <td><span className={'fda-badge ' + auditKind(e)}>{e.action}</span></td>
                  <td className="fda-cell-sub">{e.target_user ? e.target_user.slice(0, 8) + '…' : '—'}</td>
                  <td className="fda-num">{auditDiff(e)}</td>
                  <td className="fda-cell-sub">{e.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="fda-pagination">
            <span>{total === 0 ? 'Nenhuma linha' : `Mostrando ${from}–${to} de ${total}`}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="fda-btn" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Anterior
              </button>
              <button className="fda-btn" disabled={loading || to >= total} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────
  // Shell — Sketch 001 Variante A (sidebar de admin, escala p/ fase 2)
  // ───────────────────────────────────────────────────────────

  function Shell({ me, onSignOut, toast }) {
    const [tab, setTab] = useState(readTab);

    useEffect(() => {
      function onHash() { setTab(readTab()); }
      window.addEventListener('hashchange', onHash);
      return () => window.removeEventListener('hashchange', onHash);
    }, []);

    function goTab(t) {
      window.location.hash = t;
      setTab(t);
    }

    return (
      <div className="fda-shell">
        <aside className="fda-side">
          <div className="fda-logo">
            <div className="fda-brand">Fides<span className="tick">.</span> Admin</div>
            <div className="fda-env">produção</div>
          </div>
          <nav className="fda-nav">
            <button className={tab === 'contas' ? 'active' : ''} onClick={() => goTab('contas')}>Contas</button>
            <button className={tab === 'auditoria' ? 'active' : ''} onClick={() => goTab('auditoria')}>Auditoria</button>
            <button className="fda-soon" type="button">Métricas <span className="fda-soon-pill">fase 2</span></button>
            <button className="fda-soon" type="button">Config <span className="fda-soon-pill">backlog</span></button>
          </nav>
          <div className="fda-admin-who">
            <div className="who">{me.email}</div>
            <button className="fda-signout" onClick={onSignOut}>sair</button>
          </div>
        </aside>
        <main className="fda-main">
          {tab === 'auditoria' ? <AuditoriaView /> : <ContasView toast={toast} />}
        </main>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────
  // App — sessão isolada (storageKey fides-admin-auth) → whoami → shell
  // ───────────────────────────────────────────────────────────

  function App() {
    const toast = FidesUI.useToast();
    const clientReady = !!window.fidesAdminClient;

    // undefined = verificando; null = anônimo; objeto = sessão ativa
    const [session, setSession] = useState(undefined);
    // undefined = verificando; 'denied'; {error}; {id,email}
    const [me, setMe] = useState(undefined);
    const [loginNotice, setLoginNotice] = useState(null);

    useEffect(() => {
      if (!clientReady) return;
      let mounted = true;
      window.fidesAdminClient.auth.getSession().then(({ data }) => {
        if (mounted) setSession(data.session || null);
      });
      const { data: sub } = window.fidesAdminClient.auth.onAuthStateChange((_event, sess) => {
        if (mounted) setSession(sess || null);
      });
      return () => {
        mounted = false;
        sub.subscription.unsubscribe();
      };
    }, [clientReady]);

    const userId = session && session.user && session.user.id;

    // Roda whoami só quando a IDENTIDADE muda (login/logout/troca de usuário) —
    // não a cada refresh de token (evita audit spam de whoami).
    useEffect(() => {
      if (!userId) { setMe(undefined); return; }
      let cancelled = false;
      setMe(undefined);
      fetchAdmin('whoami')
        .then((data) => { if (!cancelled) setMe(data); })
        .catch((err) => {
          if (cancelled) return;
          if (err.status === 401) {
            setLoginNotice('Sessão expirada — faça login novamente.');
            window.fidesAdminClient.auth.signOut();
          } else if (err.status === 403) {
            setMe('denied');
          } else {
            setMe({ error: errMsg(err) });
          }
        });
      return () => { cancelled = true; };
    }, [userId]);

    function handleSignOut() {
      window.fidesAdminClient.auth.signOut();
    }

    if (!clientReady) {
      return <FatalError message="Configuração ausente (/fides-config.js). Recarregue a página." />;
    }

    if (session === undefined) {
      return <Loading label="Carregando…" />;
    }

    if (session === null) {
      return (
        <div className="fda-root">
          <LoginScreen notice={loginNotice} />
          <FidesUI.ToastViewport />
        </div>
      );
    }

    if (me === undefined) {
      return <Loading label="Verificando acesso…" />;
    }

    if (me === 'denied') {
      return (
        <div className="fda-root">
          <AcessoNegado email={session.user && session.user.email} onSignOut={handleSignOut} />
          <FidesUI.ToastViewport />
        </div>
      );
    }

    if (me && me.error) {
      return <FatalError message={me.error} />;
    }

    return (
      <div className="fda-root">
        <Shell me={me} onSignOut={handleSignOut} toast={toast} />
        <FidesUI.ToastViewport />
      </div>
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
