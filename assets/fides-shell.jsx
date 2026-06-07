// fides-shell.jsx — Logo, Sidebar, Topbar shared across screens

// ─── Logo ─────────────────────────────────────────────────────
// Geometric F mark: rounded square holding an F formed by 3 stacked
// horizontal pills (descending in length — subtle "ascending values"
// metaphor for a finance app). Paired with serif wordmark.
function FidesMark({ size = 28, accent }) {
  const r = size * 0.22;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: 'block', flex: 'none' }}>
      <rect x="0" y="0" width="32" height="32" rx={r} fill={accent || 'var(--accent)'}/>
      {/* F shape: vertical stem + 2 horizontal arms */}
      <g fill="#FFFFFF">
        <rect x="9"  y="7"  width="3"  height="18" rx="1.5"/>
        <rect x="9"  y="7"  width="14" height="3"  rx="1.5"/>
        <rect x="9"  y="14" width="10" height="3"  rx="1.5"/>
      </g>
    </svg>
  );
}

function FidesLogo({ size = 28, variant = 'v1', collapsed = false }) {
  // V1 uses serif wordmark with subtle italic; V2 sans confident; V3 sans tighter.
  const wordFamily = variant === 'v1' ? 'var(--font-serif)' : 'var(--font-sans)';
  const wordWeight = variant === 'v1' ? 400 : 600;
  const wordSize   = size * 0.78;
  const tracking   = variant === 'v3' ? '-0.04em' : '-0.02em';
  const style      = variant === 'v1' ? 'italic' : 'normal';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <FidesMark size={size}/>
      {!collapsed && (
        <span style={{ fontFamily: wordFamily, fontWeight: wordWeight, fontStyle: style,
                       fontSize: wordSize, letterSpacing: tracking, color: 'var(--ink)' }}>
          Fides
        </span>
      )}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────
const NAV = [
  { id: 'dashboard',   label: 'Visão geral',  icon: Icon.Home },
  { id: 'transacoes',  label: 'Transações',   icon: Icon.Receipt },
  { id: 'orcamento',   label: 'Planejamento', icon: Icon.Pie },
  { id: 'contas',      label: 'Contas & cartões', icon: Icon.Wallet },
  { id: 'metas',       label: 'Metas',        icon: Icon.Goal },
  { id: 'dividas',     label: 'Dívidas',      icon: Icon.TrendDown },
  { id: 'familia',     label: 'Família',      icon: Icon.Users },
];

function Sidebar({ active, onNav, variant }) {
  const { userName, firstName, userEmail } = useFides();
  const displayName = firstName || userName || 'Usuário';
  const initials = displayName.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U';
  return (
    <aside className="fds-sb" data-od-id="sidebar">
      <div className="fds-sb-head" data-od-id="sidebar-logo">
        <FidesLogo size={28} variant={variant}/>
      </div>

      <div className="fds-sb-section" data-od-id="sidebar-workspace">
        <div className="fds-sb-section-label">Workspace</div>
        <button className="fds-workspace">
          <div className="fds-workspace-mark" style={{ background: 'var(--accent)' }}>
            <span>{initials}</span>
          </div>
          <div className="fds-workspace-meta">
            <div className="fds-workspace-name">{displayName}</div>
          </div>
          <Icon.Down size={14} style={{ opacity: 0.45 }}/>
        </button>
      </div>

      <nav className="fds-sb-nav" data-od-id="sidebar-nav">
        {NAV.map((n) => {
          const Ic = n.icon;
          const on = active === n.id;
          return (
            <button key={n.id} className={`fds-nav-item${on ? ' on' : ''}`} onClick={() => onNav?.(n.id)}>
              <Ic size={17}/>
              <span>{n.label}</span>
              {n.badge != null && <span className="fds-nav-badge">{n.badge}</span>}
            </button>
          );
        })}
      </nav>

      <div className="fds-sb-foot" data-od-id="sidebar-footer">
        <div className="fds-sb-hint">
          <Icon.Sparkles size={14} style={{ color: 'var(--accent)' }}/>
          <div>
            <div className="fds-hint-t">Maio fecha em 14 dias</div>
            <div className="fds-hint-s">Você está R$\u00a0892 abaixo da meta de gasto.</div>
          </div>
        </div>
        <button className="fds-sb-user" onClick={() => onNav?.('perfil')}>
          <div className="fds-avatar">{initials}</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div className="fds-user-name">{displayName}</div>
            {userEmail && <div className="fds-user-sub">{userEmail}</div>}
          </div>
          <Icon.Settings size={15} style={{ opacity: 0.5 }}/>
        </button>
      </div>
    </aside>
  );
}

// ─── Topbar ───────────────────────────────────────────────────
function Topbar({ title, subtitle, onAdd, period = 'Maio · 2026', actions, hideTitle = false }) {
  return (
    <header className="fds-top" data-od-id="topbar">
      <div className="fds-top-l">
        {!hideTitle && (
          <>
            <h1 className="fds-top-title">{title}</h1>
            {subtitle && <p className="fds-top-sub">{subtitle}</p>}
          </>
        )}
      </div>
      <div className="fds-top-r">
        <div className="fds-search">
          <Icon.Search size={15} style={{ opacity: 0.5 }}/>
          <input placeholder="Buscar transações, contas, categorias…" readOnly/>
          <kbd className="fds-kbd">⌘K</kbd>
        </div>
        <button className="fds-icon-btn" title="Notificações">
          <Icon.Bell size={17}/>
          <span className="fds-dot"/>
        </button>
        <div className="fds-period">
          <Icon.Calendar size={14} style={{ opacity: 0.55 }}/>
          <span>{period}</span>
          <Icon.Down size={13} style={{ opacity: 0.45 }}/>
        </div>
        {actions}
        {onAdd && (
          <button className="fds-btn-primary" onClick={onAdd}>
            <Icon.Plus size={15}/>
            <span>Lançar</span>
          </button>
        )}
      </div>
    </header>
  );
}

Object.assign(window, { FidesLogo, FidesMark, Sidebar, Topbar, NAV });
