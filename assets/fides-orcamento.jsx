// fides-orcamento.jsx - Planejamento (Lote 4A)
//
// Mobile-first: cards por categoria, agrupados por BUDGET_GROUPS, com barra
// de progresso semantica, edicao inline rapida e modal de 3 escopos.

(function () {
  'use strict';

  // ---- Helpers locais ----------------------------------------------------

  function formatBRL(n) {
    var v = Number(n) || 0;
    return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function parseBRLInput(raw) {
    if (raw == null) return NaN;
    var s = String(raw).trim();
    if (!s) return NaN;
    // aceita "1.234,56" ou "1234.56" ou "1234,56"
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    return parseFloat(s);
  }

  function groupColor(key) {
    if (key === 'essencial') return 'var(--ok)';
    if (key === 'estilo')    return 'var(--info)';
    if (key === 'divida' || key === 'dividas') return 'var(--bad)';
    return 'var(--accent)';
  }

  function statusFromPct(limit, spent) {
    if (!limit || limit <= 0) return { pct: 0, status: null };
    var pct = Math.round((spent / limit) * 100);
    var status = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
    return { pct: pct, status: status };
  }

  function normalizedGroups() {
    var raw = window.BUDGET_GROUPS || [];
    return raw.map(function (g) {
      return {
        key:   g.key || g.id,
        label: g.label,
        pct:   (g.pct != null ? g.pct : (g.target != null ? g.target : 0))
      };
    });
  }

  // months helper: monthLabel can be a fn (yyyy-mm) -> {short,long} or a string
  function readMonthLabel(monthLabel, ym) {
    try {
      if (typeof monthLabel === 'function') {
        var r = monthLabel(ym);
        if (r && r.long) return r.long;
        if (typeof r === 'string') return r;
      }
      if (typeof monthLabel === 'string') return monthLabel;
    } catch (e) { /* ignore */ }
    return ym;
  }

  function shortMonthName(ix) {
    var meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return meses[ix] || '';
  }

  // ---- StatusIcon --------------------------------------------------------

  function StatusIcon(props) {
    var status = props.status;
    var size = props.size || 16;
    var common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
    if (status === 'ok') {
      return (
        <svg {...common} className="fo-status-icon fo-status-ok" aria-label="dentro do limite">
          <circle cx="12" cy="12" r="9"/>
          <path d="M8 12l3 3 5-6"/>
        </svg>
      );
    }
    if (status === 'warn') {
      return (
        <svg {...common} className="fo-status-icon fo-status-warn" aria-label="proximo do limite">
          <circle cx="12" cy="12" r="9"/>
          <path d="M12 7v6M12 16.5v.5"/>
        </svg>
      );
    }
    if (status === 'over') {
      return (
        <svg {...common} className="fo-status-icon fo-status-over" aria-label="acima do limite">
          <circle cx="12" cy="12" r="9"/>
          <path d="M9 9l6 6M15 9l-6 6"/>
        </svg>
      );
    }
    return null;
  }

  // ---- LimitEditorModal --------------------------------------------------

  function LimitEditorModal(props) {
    var cat            = props.cat;            // { cat_key, label, emoji, limit }
    var open           = props.open;
    var onClose        = props.onClose;
    var selectedMonth  = props.selectedMonth;
    var monthLabelStr  = props.monthLabelStr;
    var existingByMonth = props.existingByMonth || {}; // { 'YYYY-MM': value }
    var existingDefault = props.existingDefault;       // number|null
    var setCategoryLimit    = props.setCategoryLimit;
    var removeCategoryLimit = props.removeCategoryLimit;
    var toast               = props.toast;
    var confirm             = props.confirm;

    var hasThisMonth = existingByMonth[selectedMonth] != null;
    var hasDefault   = existingDefault != null;
    var hasAny       = hasThisMonth || hasDefault || Object.keys(existingByMonth).length > 0;

    var initialValue = hasThisMonth
      ? String(existingByMonth[selectedMonth])
      : (hasDefault ? String(existingDefault) : '');

    var initialScope = hasThisMonth ? 'this' : 'default';

    var year = (selectedMonth || '2026-01').split('-')[0];

    var refValue   = React.useState(initialValue);
    var value      = refValue[0]; var setValue = refValue[1];
    var refScope   = React.useState(initialScope);
    var scope      = refScope[0]; var setScope = refScope[1];

    // pre-marcar selectedMonth + meses ja com limite no ano corrente
    var preChecked = React.useMemo(function () {
      var s = {};
      Object.keys(existingByMonth).forEach(function (m) {
        if (m && m.indexOf(year + '-') === 0) s[m] = true;
      });
      s[selectedMonth] = true;
      return s;
    }, [year, selectedMonth, existingByMonth]);

    var refMonths  = React.useState(preChecked);
    var months     = refMonths[0]; var setMonths = refMonths[1];

    var refSaving = React.useState(false);
    var saving = refSaving[0]; var setSaving = refSaving[1];

    var inputRef = React.useRef(null);

    // reset state when modal opens
    React.useEffect(function () {
      if (!open) return;
      setValue(initialValue);
      setScope(initialScope);
      setMonths(preChecked);
      setSaving(false);
      // focus input
      var t = setTimeout(function () {
        if (inputRef.current) {
          try { inputRef.current.focus(); inputRef.current.select(); } catch (e) {}
        }
      }, 30);
      return function () { clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, cat && cat.cat_key]);

    React.useEffect(function () {
      if (!open) return;
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); onClose && onClose(); }
      }
      document.addEventListener('keydown', onKey);
      return function () { document.removeEventListener('keydown', onKey); };
    }, [open, onClose]);

    if (!open || !cat) return null;

    function toggleMonth(ym) {
      setMonths(function (prev) {
        var nx = Object.assign({}, prev);
        if (nx[ym]) delete nx[ym]; else nx[ym] = true;
        return nx;
      });
    }

    function handleBackdrop(e) {
      if (e.target === e.currentTarget) onClose && onClose();
    }

    function handleSave() {
      var v = parseBRLInput(value);
      if (!isFinite(v) || v <= 0) {
        toast && toast.error('Informe um valor maior que zero.');
        return;
      }
      var months_list = null;
      if (scope === 'custom') {
        months_list = Object.keys(months).filter(function (k) { return months[k]; });
        if (!months_list.length) {
          toast && toast.error('Selecione ao menos um mes.');
          return;
        }
      }
      setSaving(true);
      Promise.resolve(setCategoryLimit(cat.cat_key, v, scope, months_list))
        .then(function () {
          if (scope === 'this') {
            toast && toast.success('Limite definido para ' + monthLabelStr);
          } else if (scope === 'default') {
            toast && toast.success('Limite padrao salvo');
          } else {
            toast && toast.success('Limite aplicado a ' + (months_list ? months_list.length : 0) + ' meses');
          }
          onClose && onClose();
        })
        .catch(function () {
          // toast de erro vem do store
        })
        .finally(function () { setSaving(false); });
    }

    function handleRemove() {
      var removalScope = hasThisMonth ? 'this' : 'default';
      var humanScope = removalScope === 'this' ? monthLabelStr : 'todos os meses (padrao)';
      Promise.resolve(confirm({
        title: 'Remover limite?',
        message: 'O limite de ' + cat.label + ' sera removido de ' + humanScope + '.',
        confirmLabel: 'Remover',
        destructive: true
      })).then(function (ok) {
        if (!ok) return;
        setSaving(true);
        Promise.resolve(removeCategoryLimit(cat.cat_key, removalScope))
          .then(function () {
            toast && toast.warn('Limite removido');
            onClose && onClose();
          })
          .finally(function () { setSaving(false); });
      });
    }

    var monthsGrid = [];
    for (var i = 0; i < 12; i++) {
      var mm = String(i + 1).padStart(2, '0');
      var ym = year + '-' + mm;
      var on = !!months[ym];
      monthsGrid.push(
        <button key={ym}
                type="button"
                className={'fo-month-chip' + (on ? ' on' : '')}
                onClick={(function (k) { return function () { toggleMonth(k); }; })(ym)}>
          {shortMonthName(i)}
        </button>
      );
    }

    return (
      <div className="fo-modal-backdrop" onMouseDown={handleBackdrop} role="dialog" aria-modal="true">
        <div className="fo-modal" onMouseDown={function (e) { e.stopPropagation(); }}>
          <div className="fo-modal-head">
            <div className="fo-modal-title">
              <span className="fo-modal-emoji" aria-hidden="true">{cat.emoji || '#'}</span>
              <span>{cat.label}</span>
            </div>
            <button type="button" className="fo-modal-close" onClick={onClose} aria-label="Fechar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18"/>
              </svg>
            </button>
          </div>

          <div className="fo-modal-body">
            <label className="fo-modal-label" htmlFor="fo-limit-input">Limite mensal</label>
            <div className="fo-input-wrap">
              <span className="fo-input-prefix">R$</span>
              <input id="fo-limit-input"
                     ref={inputRef}
                     className="fo-input"
                     type="number"
                     inputMode="decimal"
                     min="0"
                     step="0.01"
                     placeholder="0,00"
                     value={value}
                     onChange={function (e) { setValue(e.target.value); }}
                     onKeyDown={function (e) { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } }}/>
            </div>

            <div className="fo-modal-section-title">Aplicar a</div>
            <div className="fo-radios">
              <label className={'fo-radio' + (scope === 'this' ? ' on' : '')}>
                <input type="radio" name="fo-scope" value="this"
                       checked={scope === 'this'}
                       onChange={function () { setScope('this'); }}/>
                <span className="fo-radio-mark"/>
                <span className="fo-radio-label">Apenas {monthLabelStr}</span>
              </label>
              <label className={'fo-radio' + (scope === 'default' ? ' on' : '')}>
                <input type="radio" name="fo-scope" value="default"
                       checked={scope === 'default'}
                       onChange={function () { setScope('default'); }}/>
                <span className="fo-radio-mark"/>
                <span className="fo-radio-label">Todos os meses (padrao)</span>
              </label>
              <label className={'fo-radio' + (scope === 'custom' ? ' on' : '')}>
                <input type="radio" name="fo-scope" value="custom"
                       checked={scope === 'custom'}
                       onChange={function () { setScope('custom'); }}/>
                <span className="fo-radio-mark"/>
                <span className="fo-radio-label">Meses especificos...</span>
              </label>
            </div>

            {scope === 'custom' && (
              <div className="fo-months-grid" role="group" aria-label="Selecionar meses">
                {monthsGrid}
              </div>
            )}
          </div>

          <div className="fo-modal-actions">
            {hasAny && (
              <button type="button"
                      className="fo-btn fo-btn-danger"
                      onClick={handleRemove}
                      disabled={saving}>
                Remover limite
              </button>
            )}
            <button type="button"
                    className="fo-btn fo-btn-ghost"
                    onClick={onClose}
                    disabled={saving}>
              Cancelar
            </button>
            <button type="button"
                    className="fo-btn fo-btn-primary"
                    onClick={handleSave}
                    disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- CategoryCard ------------------------------------------------------

  function CategoryCard(props) {
    var item             = props.item; // { cat_key, label, emoji, spent, limit, pct, status }
    var monthLabelStr    = props.monthLabelStr;
    var setCategoryLimit = props.setCategoryLimit;
    var openModal        = props.openModal;
    var toast            = props.toast;

    var refEdit = React.useState(false);
    var editing = refEdit[0]; var setEditing = refEdit[1];
    var refDraft = React.useState('');
    var draft = refDraft[0]; var setDraft = refDraft[1];
    var refSaving = React.useState(false);
    var saving = refSaving[0]; var setSaving = refSaving[1];
    var inputRef = React.useRef(null);

    React.useEffect(function () {
      if (!editing) return;
      var t = setTimeout(function () {
        if (inputRef.current) {
          try { inputRef.current.focus(); inputRef.current.select(); } catch (e) {}
        }
      }, 20);
      return function () { clearTimeout(t); };
    }, [editing]);

    function startEdit(e) {
      if (e) e.stopPropagation();
      setDraft(item.limit != null ? String(item.limit) : '');
      setEditing(true);
    }

    function commit() {
      var v = parseBRLInput(draft);
      if (!isFinite(v) || v <= 0) {
        setEditing(false);
        return;
      }
      setSaving(true);
      Promise.resolve(setCategoryLimit(item.cat_key, v, 'this'))
        .then(function () {
          toast && toast.success('Limite atualizado para ' + monthLabelStr);
          setEditing(false);
        })
        .catch(function () { /* store mostra erro */ })
        .finally(function () { setSaving(false); });
    }

    var status = item.status;
    var fillPct = item.limit && item.limit > 0 ? Math.min(100, item.pct || 0) : 0;
    var overflowPct = status === 'over'
      ? Math.min(100, Math.max(0, ((item.pct || 0) - 100)))
      : 0;

    return (
      <div className={'fo-card fo-card-' + (status || 'none')}>
        <div className="fo-card-head">
          <span className="fo-card-emoji" aria-hidden="true">{item.emoji || '#'}</span>
          <span className="fo-card-label">{item.label}</span>
          <span className="fo-card-status"><StatusIcon status={status}/></span>
        </div>

        <div className="fo-card-bar" role="progressbar"
             aria-valuemin="0" aria-valuemax="100"
             aria-valuenow={Math.round(item.pct || 0)}>
          <div className={'fo-card-bar-fill fo-card-bar-fill-' + (status || 'none')}
               style={{ width: fillPct + '%' }}/>
          {status === 'over' && (
            <div className="fo-card-bar-over"
                 style={{ width: overflowPct + '%' }}/>
          )}
        </div>

        <div className="fo-card-values">
          <div className="fo-card-amounts">
            {item.limit != null ? (
              <>
                <span className="fo-card-spent">{formatBRL(item.spent)}</span>
                <span className="fo-card-sep">/</span>
                <span className="fo-card-limit-amt">{formatBRL(item.limit)}</span>
                <span className={'fo-card-pct fo-card-pct-' + (status || 'none')}>{Math.round(item.pct || 0)}%</span>
              </>
            ) : (
              <>
                <span className="fo-card-spent">{formatBRL(item.spent)}</span>
                <span className="fo-card-nolimit">sem limite</span>
              </>
            )}
          </div>

          <div className="fo-card-actions">
            {editing ? (
              <span className="fo-card-edit-inline">
                <span className="fo-card-edit-prefix">R$</span>
                <input ref={inputRef}
                       type="number"
                       inputMode="decimal"
                       min="0"
                       step="0.01"
                       className="fo-card-edit-input"
                       value={draft}
                       disabled={saving}
                       onChange={function (e) { setDraft(e.target.value); }}
                       onKeyDown={function (e) {
                         if (e.key === 'Enter') { e.preventDefault(); commit(); }
                         else if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
                       }}
                       onBlur={function () { commit(); }}/>
              </span>
            ) : (
              <button type="button"
                      className="fo-card-limit"
                      onClick={startEdit}
                      aria-label={item.limit != null ? 'Editar limite (apenas este mes)' : 'Definir limite'}>
                {item.limit != null ? formatBRL(item.limit) : 'definir limite'}
              </button>
            )}
            <button type="button"
                    className="fo-card-edit"
                    onClick={function () { openModal(item); }}
                    aria-label="Editar limite (mais opcoes)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 4l6 6L8 22H2v-6L14 4z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- FidesOrcamento (page) --------------------------------------------

  function FidesOrcamento() {
    var store = useFides();
    var categories          = store.categories || {};
    var categoryLimits      = store.categoryLimits || {};
    var categoryUsage       = store.categoryUsage || [];
    var selectedMonth       = store.selectedMonth;
    var setSelectedMonth    = store.setSelectedMonth;
    var prevMonth           = store.prevMonth;
    var monthLabel          = store.monthLabel;
    var monthTransactions   = store.monthTransactions || [];
    var setCategoryLimit    = store.setCategoryLimit;
    var removeCategoryLimit = store.removeCategoryLimit;

    var monthLabelStr = readMonthLabel(monthLabel, selectedMonth);

    var toast = window.FidesUI && window.FidesUI.useToast ? window.FidesUI.useToast() : null;
    var confirmHook = window.FidesUI && window.FidesUI.useConfirm ? window.FidesUI.useConfirm() : { confirm: function () { return Promise.resolve(true); }, ConfirmHost: function () { return null; } };
    var confirm     = confirmHook.confirm;
    var ConfirmHost = confirmHook.ConfirmHost;

    var refIncludePending = React.useState(false);
    var includePending    = refIncludePending[0];
    var setIncludePending = refIncludePending[1];

    var refModalCat = React.useState(null);
    var modalCat    = refModalCat[0];
    var setModalCat = refModalCat[1];

    // ---- Items: aplica toggle "incluir pendentes" --------------------
    var items = React.useMemo(function () {
      if (!includePending) return categoryUsage;

      var spentByKey = {};
      monthTransactions.forEach(function (t) {
        if (t.isTransfer) return;
        if (!t.val || t.val >= 0) return;
        var k = t.cat || 'sem-categoria';
        spentByKey[k] = (spentByKey[k] || 0) + Math.abs(t.val);
      });

      var rank = { over: 0, warn: 1, ok: 2 };
      return categoryUsage.map(function (it) {
        var newSpent = spentByKey[it.cat_key] || 0;
        var st = statusFromPct(it.limit, newSpent);
        return Object.assign({}, it, {
          spent: newSpent,
          pct:   it.limit ? st.pct : null,
          status: st.status
        });
      }).sort(function (a, b) {
        var ra = a.status == null ? 3 : rank[a.status];
        var rb = b.status == null ? 3 : rank[b.status];
        if (ra !== rb) return ra - rb;
        return (b.spent || 0) - (a.spent || 0);
      });
    }, [includePending, categoryUsage, monthTransactions]);

    // ---- Group items ---------------------------------------------------
    var groups = React.useMemo(normalizedGroups, []);

    var itemsByGroup = React.useMemo(function () {
      var map = {};
      groups.forEach(function (g) { map[g.key] = []; });
      items.forEach(function (it) {
        var k = it.grp;
        // fallback: tentar pegar grupo de categories
        if (!k && categories[it.cat_key]) k = categories[it.cat_key].group;
        if (!k || !map[k]) {
          // categoria sem grupo conhecido: ignora (sera mostrada se grupo
          // corresponder a algum BUDGET_GROUPS conhecido).
          return;
        }
        map[k].push(it);
      });
      // ordenar cada grupo: severidade desc, depois alfabetica
      Object.keys(map).forEach(function (k) {
        map[k].sort(function (a, b) {
          var rank = { over: 0, warn: 1, ok: 2 };
          var ra = a.status == null ? 3 : rank[a.status];
          var rb = b.status == null ? 3 : rank[b.status];
          if (ra !== rb) return ra - rb;
          return (a.label || '').localeCompare(b.label || '', 'pt-BR');
        });
      });
      return map;
    }, [items, groups, categories]);

    // ---- Empty state condition ----------------------------------------
    var hasAnyLimit = Object.keys(categoryLimits || {}).length > 0;
    var totalSpentMonth = React.useMemo(function () {
      return items.reduce(function (s, it) { return s + (it.spent || 0); }, 0);
    }, [items]);
    var showEmptyState = !hasAnyLimit && totalSpentMonth === 0;

    // ---- Month nav -----------------------------------------------------
    function goPrevMonth() {
      if (!setSelectedMonth || !prevMonth) return;
      setSelectedMonth(prevMonth(selectedMonth));
    }
    function goNextMonth() {
      if (!setSelectedMonth) return;
      var parts = (selectedMonth || '').split('-');
      var y = parseInt(parts[0], 10);
      var m = parseInt(parts[1], 10);
      if (!y || !m) return;
      m += 1; if (m > 12) { m = 1; y += 1; }
      setSelectedMonth(y + '-' + String(m).padStart(2, '0'));
    }

    // ---- Modal helpers -------------------------------------------------
    function openModal(item) {
      setModalCat({
        cat_key: item.cat_key,
        label:   item.label,
        emoji:   item.emoji,
        limit:   item.limit
      });
    }
    function closeModal() { setModalCat(null); }

    var modalLimitEntry = modalCat && categoryLimits ? categoryLimits[modalCat.cat_key] : null;
    var modalByMonth    = modalLimitEntry && modalLimitEntry.byMonth ? modalLimitEntry.byMonth : {};
    var modalDefault    = modalLimitEntry ? (modalLimitEntry['default'] != null ? modalLimitEntry['default'] : null) : null;

    return (
      <div className="fo-page" data-od-id="planejamento">
        <header className="fo-header">
          <h1 className="fo-title">Planejamento</h1>

          <div className="fo-month-row">
            <button type="button" className="fo-month-nav" onClick={goPrevMonth} aria-label="Mes anterior">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 6l-6 6 6 6"/>
              </svg>
            </button>
            <div className="fo-month-current">{monthLabelStr}</div>
            <button type="button" className="fo-month-nav" onClick={goNextMonth} aria-label="Proximo mes">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6"/>
              </svg>
            </button>
          </div>

          <label className={'fo-toggle' + (includePending ? ' on' : '')}>
            <input type="checkbox"
                   checked={includePending}
                   onChange={function (e) { setIncludePending(e.target.checked); }}/>
            <span className="fo-toggle-track"><span className="fo-toggle-thumb"/></span>
            <span className="fo-toggle-label">Incluir pendentes no realizado</span>
          </label>
        </header>

        {showEmptyState && (
          <div className="fo-empty">
            <div className="fo-empty-icon" aria-hidden="true">{'\u{1F3AF}'}</div>
            <div className="fo-empty-title">Comece a planejar</div>
            <div className="fo-empty-text">Defina limites por categoria para acompanhar seus gastos.</div>
          </div>
        )}

        {groups.map(function (g) {
          var list = itemsByGroup[g.key] || [];
          if (list.length === 0) return null;
          var plannedTotal = list.reduce(function (s, it) { return s + (it.limit || 0); }, 0);
          var spentTotal   = list.reduce(function (s, it) { return s + (it.spent || 0); }, 0);
          var dot = groupColor(g.key);
          return (
            <section className="fo-group" key={g.key}>
              <header className="fo-group-header">
                <div className="fo-group-name">
                  <span className="fo-group-dot" style={{ background: dot }} aria-hidden="true"/>
                  <span>{g.label}</span>
                  <span className="fo-group-target">({Math.round((g.pct || 0) * 100)}%)</span>
                </div>
                <div className="fo-group-totals">
                  <span className="fo-group-planned">{formatBRL(plannedTotal)}</span>
                  <span className="fo-group-sep">/</span>
                  <span className="fo-group-spent">{formatBRL(spentTotal)}</span>
                </div>
              </header>

              <div className="fo-group-list">
                {list.map(function (it) {
                  return (
                    <CategoryCard key={it.cat_key}
                                  item={it}
                                  monthLabelStr={monthLabelStr}
                                  setCategoryLimit={setCategoryLimit}
                                  openModal={openModal}
                                  toast={toast}/>
                  );
                })}
              </div>
            </section>
          );
        })}

        <LimitEditorModal open={!!modalCat}
                          cat={modalCat}
                          onClose={closeModal}
                          selectedMonth={selectedMonth}
                          monthLabelStr={monthLabelStr}
                          existingByMonth={modalByMonth}
                          existingDefault={modalDefault}
                          setCategoryLimit={setCategoryLimit}
                          removeCategoryLimit={removeCategoryLimit}
                          toast={toast}
                          confirm={confirm}/>

        <ConfirmHost/>
      </div>
    );
  }

  // Compatibilidade com o shell atual que renderiza <OrcamentoStudio/>.
  var OrcamentoStudio = FidesOrcamento;

  Object.assign(window, { FidesOrcamento: FidesOrcamento, OrcamentoStudio: OrcamentoStudio });
})();
