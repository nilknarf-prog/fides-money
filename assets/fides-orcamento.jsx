// fides-orcamento.jsx — Planejamento (Lote 4A — redesign)
//
// Mobile-first: insights agregados + secoes de grupos colapsaveis + cards de
// categoria com limites, edicao inline e modal de 3 escopos.

(function () {
  'use strict';

  var PLN_MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  var PLN_MONTHS_LONG = [
    'Janeiro','Fevereiro','Marco','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
  ];

  var GROUP_META = {
    essencial: { label: 'Essencial',                tint: 'var(--g-essencial)', target: 50 },
    estilo:    { label: 'Estilo de vida',           tint: 'var(--g-estilo)',    target: 30 },
    divida:    { label: 'Dividas & investimentos',  tint: 'var(--g-divida)',    target: 20 }
  };

  // ─── Helpers ───────────────────────────────────────────────
  function goMonth(ym, delta) {
    var p = ym.split('-').map(Number);
    var m = p[1] + delta;
    var y = p[0];
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    return y + '-' + String(m).padStart(2, '0');
  }
  function fmtMesLongo(ym) {
    var p = ym.split('-').map(Number);
    return PLN_MONTHS_LONG[p[1] - 1] + ' de ' + p[0];
  }
  function fmtVal(v) {
    if (typeof window.fmtBRL === 'function') {
      return window.fmtBRL(v).replace(',00', '');
    }
    return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 0, maximumFractionDigits: 0
    });
  }
  function parseBR(raw) {
    var s = String(raw || '').trim();
    if (!s) return 0;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    return parseFloat(s) || 0;
  }
  function plnStatus(pct) {
    if (pct >= 1)   return { cls: 'bad',  label: 'Estourou' };
    if (pct >= 0.8) return { cls: 'warn', label: 'Atencao'  };
    return { cls: 'ok', label: 'Em dia' };
  }

  // ─── Header ────────────────────────────────────────────────
  function PlnHeader(props) {
    return React.createElement('header', { className: 'pln-head' },
      React.createElement('div', { className: 'pln-head-top' },
        React.createElement('h1', { className: 'pln-title' },
          React.createElement('span', { className: 'pln-title-mark' },
            React.createElement(window.Icon.Pie, { size: 16 })
          ),
          'Planejamento'
        ),
        React.createElement('button', { className: 'pln-copy-btn', onClick: props.onCopy },
          React.createElement(window.Icon.Import, { size: 15 }),
          React.createElement('span', { className: 'lbl-long' }, 'Copiar limites'),
          React.createElement('span', { className: 'lbl-short' }, 'Copiar')
        )
      ),
      React.createElement('div', { className: 'pln-month' },
        React.createElement('button', {
          className: 'pln-month-nav', onClick: props.onPrev, title: 'Mes anterior'
        }, React.createElement(window.Icon.Left, { size: 16 })),
        React.createElement('span', { className: 'pln-month-lbl' }, props.lbl.long),
        React.createElement('button', {
          className: 'pln-month-nav', onClick: props.onNext, title: 'Proximo mes'
        }, React.createElement(window.Icon.Right, { size: 16 }))
      ),
      React.createElement('label', {
        className: 'pln-toggle',
        onClick: function (e) { e.preventDefault(); props.onToggleIncPend(); }
      },
        React.createElement('span', {
          className: 'pln-toggle-sw' + (props.incPend ? ' on' : '')
        }),
        'Incluir pendentes no realizado',
        React.createElement('span', { className: 'pln-toggle-hint' },
          props.incPend ? '· somando previstos' : '· so pagos'
        )
      )
    );
  }

  // ─── Insights aggregate ────────────────────────────────────
  function PlnInsights(props) {
    var groups = props.groups;
    var totals = props.totals;
    var dist = props.dist;
    var receita = props.receita || 0;
    var targets = props.groupTargets || { essencial: 0.50, estilo: 0.30, divida: 0.20 };
    var onEditTargets = props.onEditTargets;
    var inLimit = totals.catsInLimit;
    var totalCats = totals.catsWithLimit;

    var denom = receita > 0 ? receita : dist.total;
    var isFallbackDenom = !(receita > 0) && dist.total > 0;
    var essShare    = denom ? dist.essencial / denom : 0;
    var estiloShare = denom ? dist.estilo    / denom : 0;
    var dividaShare = denom ? dist.divida    / denom : 0;

    var pctEss = Math.round((targets.essencial || 0) * 100);
    var pctEst = Math.round((targets.estilo    || 0) * 100);
    var pctDiv = Math.round((targets.divida    || 0) * 100);

    var dots = [];
    groups.forEach(function (g) {
      g.withLimit.forEach(function (c) {
        var p = c.limit ? c.spent / c.limit : 0;
        dots.push(p >= 1 ? 'bad' : p >= 0.8 ? 'warn' : 'ok');
      });
    });

    var allCats = (groups || []).reduce(function (acc, g) { return acc.concat(g.cats || []); }, []);
    var overCount = allCats.filter(function (c) { return c.status === 'bad'; }).length;
    var warnCount = allCats.filter(function (c) { return c.status === 'warn'; }).length;

    var msg;
    if (dividaShare > (targets.divida || 0)) {
      msg = React.createElement(React.Fragment, null,
        'Dividas levam ',
        React.createElement('b', null, Math.round(dividaShare * 100) + '%'),
        ' do realizado — sua meta e ate ',
        React.createElement('b', null, pctDiv + '%'),
        '. Vale priorizar a renegociacao.'
      );
    } else if (estiloShare > (targets.estilo || 0)) {
      msg = React.createElement(React.Fragment, null,
        'Estilo & Lazer consome ',
        React.createElement('b', null, Math.round(estiloShare * 100) + '%'),
        ' do realizado — sua meta e ate ',
        React.createElement('b', null, pctEst + '%'),
        '. Revise gastos nao essenciais.'
      );
    } else if (essShare > (targets.essencial || 0)) {
      msg = React.createElement(React.Fragment, null,
        'Voce esta alocando ',
        React.createElement('b', null, Math.round(essShare * 100) + '%'),
        ' em Essencial — sua meta e ate ',
        React.createElement('b', null, pctEss + '%'),
        '. Olhe contas fixas para abrir espaco.'
      );
    } else if (overCount >= 2) {
      msg = React.createElement(React.Fragment, null,
        React.createElement('b', null, String(overCount)),
        ' categorias estouraram o limite este mes. Considere revisar os tetos ou redistribuir gastos.'
      );
    } else if (overCount === 1) {
      msg = React.createElement(React.Fragment, null,
        '1 categoria estourou o limite este mes. Fique de olho nos proximos lancamentos.'
      );
    } else if (warnCount > 0) {
      msg = React.createElement(React.Fragment, null,
        React.createElement('b', null, String(warnCount)),
        (warnCount === 1 ? ' categoria esta' : ' categorias estao'),
        ' se aproximando do limite. Bom sinal, mas atencao.'
      );
    } else {
      msg = React.createElement(React.Fragment, null,
        'Boa distribuicao: ',
        React.createElement('b', null, Math.round(essShare * 100) + '%'),
        ' em Essencial, dentro da meta de ',
        React.createElement('b', null, pctEss + '%'),
        '. Continue assim.'
      );
    }

    var segs = [
      { id: 'essencial', tint: 'var(--g-essencial)', label: 'Essencial', val: dist.essencial, tgt: pctEss },
      { id: 'estilo',    tint: 'var(--g-estilo)',    label: 'Estilo',    val: dist.estilo,    tgt: pctEst },
      { id: 'divida',    tint: 'var(--g-divida)',    label: 'Dividas',   val: dist.divida,    tgt: pctDiv }
    ];

    return React.createElement('div', { className: 'pln-insights' },
      React.createElement('div', { className: 'pln-ins-top' },
        React.createElement('div', { className: 'pln-ins-eyebrow' },
          React.createElement(window.Icon.Sparkles, { size: 12 }),
          'Resumo do mes'
        ),
        React.createElement('div', { className: 'pln-ins-headline' },
          React.createElement('b', null, String(inLimit)),
          ' de ',
          React.createElement('b', null, String(totalCats)),
          ' categorias dentro do limite',
          totalCats - inLimit > 0 ? React.createElement(React.Fragment, null,
            ' · ',
            React.createElement('b', null, String(totalCats - inLimit)),
            ' ' + (totalCats - inLimit === 1 ? 'pede' : 'pedem') + ' atencao'
          ) : null,
          '.'
        ),
        React.createElement('div', { className: 'pln-ins-count-viz' },
          dots.map(function (d, i) {
            return React.createElement('span', { key: i, className: 'pln-ins-dot ' + d });
          })
        )
      ),
      React.createElement('div', { className: 'pln-dist' },
        React.createElement('div', { className: 'pln-dist-head' },
          React.createElement('div', { className: 'pln-dist-lbl' },
            'Distribuicao este mes',
            isFallbackDenom
              ? React.createElement('span', { className: 'pln-dist-badge' }, 'do total')
              : null
          ),
          React.createElement('button', {
            className: 'pln-dist-edit',
            type: 'button',
            onClick: onEditTargets,
            title: 'Editar metas dos grupos'
          },
            React.createElement(window.Icon.Edit || window.Icon.Pencil || window.Icon.Settings, { size: 13 }),
            React.createElement('span', null, 'Editar metas')
          )
        ),
        React.createElement('div', { className: 'pln-dist-bar' },
          segs.map(function (s) {
            return React.createElement('div', {
              key: s.id, className: 'pln-dist-seg',
              style: {
                width: (denom ? (s.val / denom) * 100 : 0) + '%',
                background: s.tint
              }
            });
          })
        ),
        React.createElement('div', { className: 'pln-dist-legend' },
          segs.map(function (s) {
            return React.createElement('div', { key: s.id, className: 'pln-dist-leg' },
              React.createElement('span', { className: 'pln-dist-leg-dot', style: { background: s.tint } }),
              s.label + ' ',
              React.createElement('b', null,
                (denom ? Math.round((s.val / denom) * 100) : 0) + '%'
              ),
              React.createElement('span', { className: 'tgt' }, '/ ' + s.tgt + '%')
            );
          })
        )
      ),
      React.createElement('div', { className: 'pln-ins-msg' },
        React.createElement('span', { className: 'pln-ins-msg-ic' },
          React.createElement(window.Icon.Sparkles, { size: 13 })
        ),
        React.createElement('span', null, msg)
      ),
      React.createElement('div', { className: 'pln-ins-totals' },
        React.createElement('div', { className: 'pln-ins-tot' },
          React.createElement('span', { className: 'pln-ins-tot-lbl' }, 'Planejado'),
          React.createElement('span', { className: 'pln-ins-tot-val' }, fmtVal(totals.planned))
        ),
        React.createElement('div', { className: 'pln-ins-tot' },
          React.createElement('span', { className: 'pln-ins-tot-lbl' }, 'Realizado'),
          React.createElement('span', { className: 'pln-ins-tot-val' }, fmtVal(totals.realized))
        ),
        React.createElement('div', { className: 'pln-ins-tot' },
          React.createElement('span', { className: 'pln-ins-tot-lbl' }, 'Projecao'),
          React.createElement('span', {
            className: 'pln-ins-tot-val ' + (totals.projection != null && totals.projection > totals.planned ? 'warn' : 'pos')
          }, totals.projection != null ? fmtVal(totals.projection) : '—')
        )
      )
    );
  }

  // ─── Category card ─────────────────────────────────────────
  function PlnCategoryCard(props) {
    var c = props.c;
    var ctx = props.ctx;
    var isOpen = ctx.expanded === c.cat_key;
    var isEditing = ctx.editing === c.cat_key;
    var pct = c.limit ? c.spent / c.limit : 0;
    var st = plnStatus(pct);
    var rest = c.limit - c.spent;
    var proj = ctx.dayElapsed ? c.spent * (ctx.daysInMonth / ctx.dayElapsed) : c.spent;
    var projPct = c.limit ? (proj / c.limit) : 0;
    var dailyRate = ctx.dayElapsed ? Math.round(c.spent / ctx.dayElapsed) : 0;
    var showProj = ctx.isCurrentMonth && c.limit > 0 && ctx.dayElapsed >= 7 && (
      (ctx.dayElapsed < 15 && projPct > 1.30) ||
      (ctx.dayElapsed >= 15 && projPct > 1.05)
    );
    var overWidth = Math.min((pct - 1) / 0.5, 1) * 100;

    return React.createElement('div', { className: 'pln-cat' + (isOpen ? ' open' : '') },
      React.createElement('div', {
        className: 'pln-cat-main',
        onClick: function () { if (!isEditing) ctx.onToggle(c.cat_key); },
        role: 'button', tabIndex: 0
      },
        React.createElement('div', { className: 'pln-cat-row1' },
          React.createElement(window.CategoryAvatar, { cat: c.cat_key, size: 30 }),
          React.createElement('span', { className: 'pln-cat-name' }, c.label),
          React.createElement('span', { className: 'pln-status ' + st.cls },
            React.createElement('span', { className: 'pln-status-dot' }),
            st.label
          ),
          React.createElement(window.Icon.Down, { size: 16, className: 'pln-cat-chev' })
        ),
        React.createElement('div', { className: 'pln-cat-row2' },
          React.createElement('div', { className: 'pln-cat-vals' },
            React.createElement('span', { className: 'pln-cat-spent' }, fmtVal(c.spent)),
            React.createElement('span', { className: 'pln-cat-of' }, '/'),
            isEditing
              ? React.createElement('span', {
                  className: 'pln-cat-edit-wrap',
                  onClick: function (e) { e.stopPropagation(); }
                },
                  React.createElement('span', { className: 'cur' }, 'R$'),
                  React.createElement('input', {
                    autoFocus: true, inputMode: 'numeric',
                    className: 'pln-cat-edit-input',
                    defaultValue: String(c.limit || ''),
                    onBlur: function (e) { ctx.onEditSave(c.cat_key, e.target.value); },
                    onKeyDown: function (e) {
                      if (e.key === 'Enter') e.target.blur();
                      if (e.key === 'Escape') ctx.onEditSave(c.cat_key, null);
                    }
                  })
                )
              : React.createElement('span', {
                  className: 'pln-cat-limit-tap',
                  onClick: function (e) { e.stopPropagation(); ctx.onEditStart(c.cat_key); },
                  title: 'Toque para editar o limite'
                },
                  React.createElement('span', { className: 'pln-cat-limit' }, fmtVal(c.limit))
                )
          ),
          React.createElement('span', { className: 'pln-cat-pct ' + st.cls, title: '% do limite definido' },
            Math.round(pct * 100) + '%'
          ),
          React.createElement('button', {
            className: 'pln-cat-pencil',
            onClick: function (e) { e.stopPropagation(); ctx.onOpenLimit(c.cat_key); },
            title: 'Editar limite (opcoes)'
          },
            React.createElement(window.Icon.Settings, { size: 15 })
          )
        ),
        React.createElement('div', { className: 'pln-bar' + (pct > 1 ? ' over' : '') },
          React.createElement('div', {
            className: 'pln-bar-fill ' + st.cls,
            style: { width: (Math.min(pct, 1) * 100) + '%' }
          }),
          pct > 1
            ? React.createElement('div', {
                className: 'pln-bar-over-hatch',
                style: { width: Math.max(overWidth, 12) + '%' }
              })
            : null
        ),
        showProj
          ? React.createElement('div', { className: 'pln-proj-warn' },
              '📈 No ritmo de ' + fmtVal(dailyRate) + '/dia, deve fechar em ' + fmtVal(proj) + ' (limite ' + fmtVal(c.limit) + ')'
            )
          : null
      ),
      isOpen
        ? React.createElement('div', { className: 'pln-cat-detail' },
            React.createElement('div', { className: 'pln-detail-row' },
              React.createElement(window.Icon.Wallet, { size: 14, className: 'pln-detail-ic' }),
              rest >= 0
                ? React.createElement('span', null,
                    'Sobra ',
                    React.createElement('span', { className: 'pos pln-num' }, fmtVal(rest)),
                    ' do limite deste mes.'
                  )
                : React.createElement('span', null,
                    'Excedente de ',
                    React.createElement('span', { className: 'neg pln-num' }, fmtVal(Math.abs(rest))),
                    ' sobre o limite.'
                  )
            ),
            React.createElement('div', { className: 'pln-detail-row' },
              React.createElement(window.Icon.TrendUp, { size: 14, className: 'pln-detail-ic' }),
              React.createElement('span', null,
                'No ritmo atual, fecha em ',
                React.createElement('b', { className: 'pln-num' }, fmtVal(proj)),
                ' ',
                React.createElement('span', { className: projPct > 1 ? 'neg' : 'pos' },
                  '(' + (projPct >= 1 ? '+' : '-') +
                  Math.abs(Math.round((projPct - 1) * 100)) + '% do limite)'
                ),
                '.'
              )
            ),
            ctx.receita > 0
              ? React.createElement('div', { className: 'pln-detail-row' },
                  React.createElement(window.Icon.Pie, { size: 14, className: 'pln-detail-ic' }),
                  React.createElement('span', null,
                    'Representa ',
                    React.createElement('b', { className: 'pln-num' },
                      ((c.spent / ctx.receita) * 100).toFixed(1) + '%'
                    ),
                    ' da receita do mes · base: receitas registradas'
                  )
                )
              : null
          )
        : null
    );
  }

  // ─── Category WITHOUT a defined limit ──────────────────────
  function PlnNoLimitCard(props) {
    var c = props.c;
    return React.createElement('div', { className: 'pln-cat nolimit' },
      React.createElement('div', { className: 'pln-cat-nolimit-main' },
        React.createElement(window.CategoryAvatar, { cat: c.cat_key, size: 30 }),
        React.createElement('div', { className: 'pln-nolimit-meta' },
          React.createElement('div', { className: 'pln-nolimit-name' }, c.label),
          React.createElement('div', { className: 'pln-nolimit-sub' },
            'sem limite definido',
            c.spent > 0
              ? React.createElement(React.Fragment, null,
                  ' · gastou ',
                  React.createElement('span', { className: 'pln-num' }, fmtVal(c.spent))
                )
              : null
          )
        ),
        React.createElement('button', {
          className: 'pln-define-btn',
          onClick: function () { props.onDefine(c.cat_key); }
        },
          React.createElement(window.Icon.Plus, { size: 13 }),
          'Definir limite'
        )
      )
    );
  }

  // ─── Group section ─────────────────────────────────────────
  function PlnGroupSection(props) {
    var g = props.g;
    var ctx = props.ctx;
    var collapsed = props.collapsed;
    var gm = GROUP_META[g.id] || { label: g.label, tint: 'var(--ink)', target: 0 };
    var pct = g.limit ? g.spent / g.limit : 0;
    var pctColor = pct >= 1 ? 'var(--bad)'
                 : pct >= 0.8 ? 'var(--warn)'
                 : gm.tint;

    return React.createElement('section', {
      className: 'pln-group' + (collapsed ? ' collapsed' : '')
    },
      React.createElement('div', {
        className: 'pln-group-head',
        onClick: props.onToggleCollapse,
        role: 'button', tabIndex: 0
      },
        React.createElement('span', { className: 'pln-group-toggle' },
          React.createElement(window.Icon.Down, { size: 16 })
        ),
        React.createElement('span', { className: 'pln-group-bar', style: { background: gm.tint } }),
        React.createElement('div', { className: 'pln-group-meta' },
          React.createElement('div', { className: 'pln-group-name' },
            gm.label,
            React.createElement('span', { className: 'pln-group-target' },
              'meta ',
              React.createElement('b', { style: { fontWeight: 700 } }, gm.target),
              '%'
            )
          ),
          React.createElement('div', { className: 'pln-group-sub' },
            React.createElement('span', { className: 'pln-num' }, fmtVal(g.spent)),
            ' de ',
            React.createElement('span', { className: 'pln-num' }, fmtVal(g.limit)),
            ' · ',
            React.createElement('span', { className: pct > 1 ? 'over' : '' },
              Math.round(pct * 100) + '% usado'
            )
          )
        ),
        React.createElement('span', {
          className: 'pln-group-pct',
          style: { color: pctColor }
        }, Math.round(pct * 100) + '%')
      ),
      React.createElement('div', { className: 'pln-group-cats' },
        g.withLimit.map(function (c) {
          return React.createElement(PlnCategoryCard, { key: c.cat_key, c: c, ctx: ctx });
        })
      ),
      g.noLimit.length > 0
        ? React.createElement(React.Fragment, null,
            React.createElement('div', { className: 'pln-group-nolimit-hd' }, 'Sem limite'),
            React.createElement('div', { className: 'pln-group-cats' },
              g.noLimit.map(function (c) {
                return React.createElement(PlnNoLimitCard, {
                  key: c.cat_key, c: c, onDefine: ctx.onOpenLimit
                });
              })
            )
          )
        : null
    );
  }

  // ─── Limit edit sheet (bottom sheet) ───────────────────────
  function LimitSheet(props) {
    var cat = props.cat;
    var lbl = props.lbl;
    var currentLimit = props.currentLimit || 0;
    var categories = (window.useFides && window.useFides.categories) || {};
    var catInfo = (window.CATEGORIES && window.CATEGORIES[cat]) || { label: cat, tint: '#888', emoji: '🏷️' };

    var stVal = React.useState(currentLimit ? String(currentLimit).replace('.', ',') : '');
    var val = stVal[0]; var setVal = stVal[1];
    var stMode = React.useState(props.initialMode || 'this');
    var mode = stMode[0]; var setMode = stMode[1];

    var monthName = (lbl && lbl.long) ? lbl.long.split(' de ')[0] : 'este mes';
    var year = (lbl && lbl.long) ? lbl.long.split(' de ')[1] || '' : '';
    var selectedIdx = (lbl && lbl.long) ? (function () {
      for (var i = 0; i < PLN_MONTHS_LONG.length; i++) {
        if (PLN_MONTHS_LONG[i].toLowerCase() === monthName.toLowerCase()) return i;
      }
      return null;
    })() : null;

    var stPicked = React.useState(function () {
      var s = new Set();
      if (selectedIdx != null) s.add(selectedIdx);
      return s;
    });
    var picked = stPicked[0]; var setPicked = stPicked[1];

    function togglePick(i) {
      setPicked(function (p) {
        var n = new Set(p);
        if (n.has(i)) n.delete(i); else n.add(i);
        return n;
      });
    }

    var numericVal = parseBR(val);

    var options = [
      { id: 'this', main: ('Apenas ' + monthName + (year ? ' ' + year : '')).trim(), sub: 'Vale so para este mes' },
      { id: 'all',  main: 'Todos os meses', sub: 'Padrao — aplica daqui em diante' },
      { id: 'specific', main: 'Meses especificos...', sub: 'Escolha quais meses recebem este limite' }
    ];

    return React.createElement('div', {
      className: 'pln-sheet-backdrop', onClick: props.onClose
    },
      React.createElement('div', {
        className: 'pln-sheet', onClick: function (e) { e.stopPropagation(); }
      },
        React.createElement('div', { className: 'pln-sheet-grip' }),
        React.createElement('div', { className: 'pln-sheet-head' },
          React.createElement('span', {
            className: 'pln-sheet-emoji',
            style: {
              background: catInfo.tint + '1A',
              border: '1px solid ' + catInfo.tint + '33'
            }
          }, catInfo.emoji || '🏷️'),
          React.createElement('div', { className: 'pln-sheet-titles' },
            React.createElement('div', { className: 'pln-sheet-eyebrow' },
              currentLimit > 0 ? 'Editar limite' : 'Novo limite'
            ),
            React.createElement('div', { className: 'pln-sheet-title' },
              catInfo.label + ' — Limite mensal'
            )
          ),
          React.createElement('button', {
            className: 'pln-sheet-x', onClick: props.onClose
          }, React.createElement(window.Icon.X, { size: 16 }))
        ),
        React.createElement('div', { className: 'pln-sheet-body' },
          React.createElement('div', null,
            React.createElement('div', { className: 'pln-field-lbl' }, 'Limite'),
            React.createElement('div', { className: 'pln-value-input' },
              React.createElement('span', { className: 'cur' }, 'R$'),
              React.createElement('input', {
                autoFocus: true, inputMode: 'numeric',
                placeholder: '0', value: val,
                onChange: function (e) { setVal(e.target.value); }
              })
            )
          ),
          React.createElement('div', null,
            React.createElement('div', { className: 'pln-field-lbl' }, 'Aplicar a'),
            React.createElement('div', { className: 'pln-radio-list' },
              options.map(function (o) {
                return React.createElement('button', {
                  key: o.id,
                  className: 'pln-radio' + (mode === o.id ? ' on' : ''),
                  onClick: function () { setMode(o.id); }
                },
                  React.createElement('span', { className: 'pln-radio-mark' }),
                  React.createElement('span', { className: 'pln-radio-txt' },
                    React.createElement('span', { className: 'pln-radio-main' }, o.main),
                    React.createElement('span', { className: 'pln-radio-sub' }, o.sub)
                  )
                );
              })
            ),
            mode === 'specific'
              ? React.createElement('div', { className: 'pln-months-grid' },
                  PLN_MONTHS.map(function (m, i) {
                    return React.createElement('button', {
                      key: m,
                      className: 'pln-month-cell' + (picked.has(i) ? ' on' : ''),
                      onClick: function () { togglePick(i); }
                    }, m);
                  })
                )
              : null
          )
        ),
        React.createElement('div', { className: 'pln-sheet-foot' },
          currentLimit > 0
            ? React.createElement('button', {
                className: 'pln-btn pln-btn-danger',
                onClick: function () { props.onRemove(cat); }
              },
                React.createElement(window.Icon.X, { size: 15 }),
                'Remover'
              )
            : null,
          React.createElement('button', {
            className: 'pln-btn pln-btn-ghost', onClick: props.onClose
          }, 'Cancelar'),
          React.createElement('button', {
            className: 'pln-btn pln-btn-primary',
            disabled: numericVal <= 0,
            onClick: function () { props.onSave(cat, numericVal, mode, picked); }
          },
            React.createElement(window.Icon.Check, { size: 16 }),
            'Salvar'
          )
        )
      )
    );
  }

  // ─── Group targets sheet (Lote 4B) ──────────────────────────
  function GroupTargetsSheet(props) {
    var current = props.current || { essencial: 0.50, estilo: 0.30, divida: 0.20 };
    var stEss = React.useState(String(Math.round((current.essencial || 0) * 100)));
    var ess = stEss[0]; var setEss = stEss[1];
    var stEst = React.useState(String(Math.round((current.estilo || 0) * 100)));
    var est = stEst[0]; var setEst = stEst[1];
    var stDiv = React.useState(String(Math.round((current.divida || 0) * 100)));
    var div = stDiv[0]; var setDiv = stDiv[1];
    var stBusy = React.useState(false);
    var busy = stBusy[0]; var setBusy = stBusy[1];

    function parsePct(s) {
      var n = parseInt(String(s).replace(/[^0-9]/g, ''), 10);
      if (isNaN(n)) return 0;
      return Math.max(0, Math.min(100, n));
    }

    var nEss = parsePct(ess);
    var nEst = parsePct(est);
    var nDiv = parsePct(div);
    var sum  = nEss + nEst + nDiv;
    var sumWarn = sum !== 100;

    function handleSave() {
      if (busy) return;
      setBusy(true);
      props.onSave({
        essencial: nEss / 100,
        estilo:    nEst / 100,
        divida:    nDiv / 100,
      }).finally(function () { setBusy(false); });
    }

    function handleReset() {
      if (busy) return;
      setBusy(true);
      props.onReset().finally(function () { setBusy(false); });
    }

    return React.createElement('div', { className: 'pln-sheet-backdrop', onClick: props.onClose },
      React.createElement('div', { className: 'pln-sheet pln-tgt-sheet', onClick: function (e) { e.stopPropagation(); } },
        React.createElement('div', { className: 'pln-sheet-head' },
          React.createElement('h3', { className: 'pln-sheet-title' }, 'Editar metas dos grupos'),
          React.createElement('button', { className: 'pln-sheet-close', type: 'button', onClick: props.onClose },
            React.createElement(window.Icon.X, { size: 14 })
          )
        ),
        React.createElement('p', { className: 'pln-tgt-help' },
          'Defina a porcentagem alvo da sua renda para cada grupo. Os valores ideais sao 50/30/20, mas voce pode ajustar.'
        ),
        React.createElement('div', { className: 'pln-tgt-rows' },
          [
            { id: 'essencial', label: 'Essencial', tint: 'var(--g-essencial)', val: ess, set: setEss },
            { id: 'estilo',    label: 'Estilo de vida', tint: 'var(--g-estilo)', val: est, set: setEst },
            { id: 'divida',    label: 'Dividas & invest.', tint: 'var(--g-divida)', val: div, set: setDiv },
          ].map(function (r) {
            return React.createElement('div', { key: r.id, className: 'pln-tgt-row' },
              React.createElement('span', { className: 'pln-tgt-dot', style: { background: r.tint } }),
              React.createElement('span', { className: 'pln-tgt-lbl' }, r.label),
              React.createElement('div', { className: 'pln-tgt-input-wrap' },
                React.createElement('input', {
                  className: 'pln-tgt-input',
                  type: 'tel',
                  inputMode: 'numeric',
                  maxLength: 3,
                  value: r.val,
                  onChange: function (e) { r.set(e.target.value.replace(/[^0-9]/g, '').slice(0, 3)); }
                }),
                React.createElement('span', { className: 'pln-tgt-pct' }, '%')
              )
            );
          })
        ),
        React.createElement('div', { className: 'pln-tgt-sum' + (sumWarn ? ' warn' : '') },
          'Soma: ', React.createElement('b', null, sum + '%'),
          sumWarn ? React.createElement('span', { className: 'pln-tgt-sum-note' }, ' (ideal 100%)') : null
        ),
        React.createElement('div', { className: 'pln-sheet-foot' },
          React.createElement('button', {
            className: 'pln-btn-ghost', type: 'button', onClick: handleReset, disabled: busy
          }, 'Resetar 50/30/20'),
          React.createElement('button', {
            className: 'pln-btn-primary', type: 'button', onClick: handleSave, disabled: busy
          }, 'Salvar')
        )
      )
    );
  }

  // ─── Copy-limits sheet (placeholder visual) ────────────────
  function CopySheet(props) {
    var stPicking = React.useState(false);
    var picking = stPicking[0]; var setPicking = stPicking[1];

    return React.createElement('div', {
      className: 'pln-sheet-backdrop', onClick: props.onClose
    },
      React.createElement('div', {
        className: 'pln-sheet', onClick: function (e) { e.stopPropagation(); }
      },
        React.createElement('div', { className: 'pln-sheet-grip' }),
        React.createElement('div', { className: 'pln-sheet-head' },
          React.createElement('span', {
            className: 'pln-sheet-emoji',
            style: { background: 'var(--accent-soft)', color: 'var(--accent)' }
          }, React.createElement(window.Icon.Import, { size: 20 })),
          React.createElement('div', { className: 'pln-sheet-titles' },
            React.createElement('div', { className: 'pln-sheet-eyebrow' }, 'Atalho'),
            React.createElement('div', { className: 'pln-sheet-title' }, 'Copiar limites')
          ),
          React.createElement('button', {
            className: 'pln-sheet-x', onClick: props.onClose
          }, React.createElement(window.Icon.X, { size: 16 }))
        ),
        React.createElement('div', { className: 'pln-sheet-body' },
          React.createElement('button', {
            className: 'pln-copy-opt', onClick: props.onApply
          },
            React.createElement('span', { className: 'pln-copy-opt-ic' },
              React.createElement(window.Icon.Left, { size: 17 })
            ),
            React.createElement('span', { className: 'pln-copy-opt-txt' },
              React.createElement('span', { className: 'pln-copy-opt-main' }, 'Copiar do mes anterior'),
              React.createElement('span', { className: 'pln-copy-opt-sub' }, 'Traz os limites do mes anterior para ca')
            ),
            React.createElement(window.Icon.Right, { size: 16, style: { color: 'var(--muted-2)' } })
          ),
          React.createElement('button', {
            className: 'pln-copy-opt',
            onClick: function () { setPicking(function (v) { return !v; }); }
          },
            React.createElement('span', { className: 'pln-copy-opt-ic' },
              React.createElement(window.Icon.Calendar, { size: 17 })
            ),
            React.createElement('span', { className: 'pln-copy-opt-txt' },
              React.createElement('span', { className: 'pln-copy-opt-main' }, 'Copiar de um mes especifico'),
              React.createElement('span', { className: 'pln-copy-opt-sub' }, 'Escolha qualquer mes do historico')
            ),
            React.createElement(window.Icon.Down, {
              size: 16,
              style: {
                color: 'var(--muted-2)',
                transform: picking ? 'rotate(180deg)' : 'none',
                transition: 'transform .18s'
              }
            })
          ),
          picking
            ? React.createElement('div', { className: 'pln-months-grid', style: { marginTop: 0 } },
                PLN_MONTHS.map(function (m) {
                  return React.createElement('button', {
                    key: m, className: 'pln-month-cell', onClick: props.onApply
                  }, m);
                })
              )
            : null,
          React.createElement('button', {
            className: 'pln-copy-opt', onClick: props.onApply
          },
            React.createElement('span', { className: 'pln-copy-opt-ic' },
              React.createElement(window.Icon.TrendUp, { size: 17 })
            ),
            React.createElement('span', { className: 'pln-copy-opt-txt' },
              React.createElement('span', { className: 'pln-copy-opt-main' }, 'Sugerir pela media'),
              React.createElement('span', { className: 'pln-copy-opt-sub' }, 'Calcula com base nos ultimos 3 meses realizados')
            ),
            React.createElement(window.Icon.Right, { size: 16, style: { color: 'var(--muted-2)' } })
          )
        )
      )
    );
  }

  // ─── Empty state ──────────────────────────────────────────
  function PlnEmptyState(props) {
    return React.createElement('div', { className: 'pln-body' },
      React.createElement('div', { className: 'pln-empty' },
        React.createElement('div', { className: 'pln-empty-art' },
          React.createElement(window.Icon.Pie, { size: 36 })
        ),
        React.createElement('div', { className: 'pln-empty-title' },
          'Planeje seu mes por categoria'
        ),
        React.createElement('div', { className: 'pln-empty-body' },
          'Defina quanto pretende gastar em cada categoria. O Fides acompanha o realizado, ' +
          'avisa quando voce se aproxima do limite e mostra como seu dinheiro se divide entre ' +
          'o essencial, o estilo de vida e as dividas.'
        ),
        React.createElement('div', { className: 'pln-empty-rule' },
          React.createElement('div', {
            className: 'pln-empty-rule-seg',
            style: { background: 'var(--g-essencial)' }
          },
            React.createElement('span', { className: 'pln-empty-rule-pct' }, '50%'),
            React.createElement('span', { className: 'pln-empty-rule-lbl' }, 'Essencial')
          ),
          React.createElement('div', {
            className: 'pln-empty-rule-seg',
            style: { background: 'var(--g-estilo)' }
          },
            React.createElement('span', { className: 'pln-empty-rule-pct' }, '30%'),
            React.createElement('span', { className: 'pln-empty-rule-lbl' }, 'Estilo')
          ),
          React.createElement('div', {
            className: 'pln-empty-rule-seg',
            style: { background: 'var(--g-divida)' }
          },
            React.createElement('span', { className: 'pln-empty-rule-pct' }, '20%'),
            React.createElement('span', { className: 'pln-empty-rule-lbl' }, 'Dividas')
          )
        ),
        React.createElement('div', { className: 'pln-empty-acts' },
          React.createElement('button', {
            className: 'pln-btn pln-btn-primary', onClick: props.onApplyRule
          },
            React.createElement(window.Icon.Sparkles, { size: 16 }),
            'Comecar com a regra 50·30·20'
          ),
          React.createElement('button', {
            className: 'pln-btn pln-btn-ghost', onClick: props.onCopy
          },
            React.createElement(window.Icon.Import, { size: 15 }),
            'Copiar de outro mes'
          )
        )
      )
    );
  }

  // ─── Rule info card (Lote 4B) ─────────────────────────────
  function RuleInfoCard() {
    var stCollapsed = React.useState(function () {
      try { return localStorage.getItem('fides:collapsed_503020_card') === '1'; }
      catch (_) { return false; }
    });
    var collapsed = stCollapsed[0];
    var setCollapsed = stCollapsed[1];

    function handleToggle() {
      var next = !collapsed;
      try { localStorage.setItem('fides:collapsed_503020_card', next ? '1' : '0'); } catch (_) {}
      setCollapsed(next);
    }

    return React.createElement('div', { className: 'pln-rule-card' + (collapsed ? ' collapsed' : '') },
      React.createElement('button', {
        className: 'pln-rule-toggle',
        type: 'button',
        onClick: handleToggle,
        'aria-expanded': String(!collapsed),
        'aria-label': collapsed ? 'Expandir dica 50/30/20' : 'Recolher dica 50/30/20'
      },
        React.createElement('div', { className: 'pln-rule-eyebrow' },
          React.createElement(window.Icon.Sparkles, { size: 12 }),
          'Sobre a regra 50·30·20'
        ),
        React.createElement(window.Icon.Down, { size: 14, className: 'pln-rule-chevron' })
      ),
      !collapsed
        ? React.createElement('p', { className: 'pln-rule-body' },
            'Um guia simples de quanto da sua renda destinar a cada grupo: ',
            React.createElement('b', null, '50% Essencial'),
            ' (moradia, mercado, transporte), ',
            React.createElement('b', null, '30% Estilo de vida'),
            ' (lazer, compras, assinaturas) e ',
            React.createElement('b', null, '20% Dividas e investimentos'),
            '. Voce pode ajustar essas metas no botao Editar metas.'
          )
        : null
    );
  }

  // ─── Main component ───────────────────────────────────────
  function FidesOrcamento() {
    var store = window.useFides();
    var categoryUsage      = store.categoryUsage || [];
    var monthTransactions  = store.monthTransactions || [];
    var selectedMonth      = store.selectedMonth;
    var setSelectedMonth   = store.setSelectedMonth;
    var setCategoryLimit   = store.setCategoryLimit;
    var removeCategoryLimit = store.removeCategoryLimit;
    var groupTargets        = store.groupTargets || { essencial: 0.50, estilo: 0.30, divida: 0.20 };
    var setGroupTargetsStore = store.setGroupTargets;
    var resetGroupTargetsStore = store.resetGroupTargets;

    var toast = window.FidesUI.useToast();
    var refConfirm = window.FidesUI.useConfirm();
    var ConfirmHost = refConfirm.ConfirmHost;
    var confirm = refConfirm.confirm;

    var stIncPend = React.useState(true);
    var incPend = stIncPend[0]; var setIncPend = stIncPend[1];
    var stExp = React.useState(null);
    var expanded = stExp[0]; var setExpanded = stExp[1];
    var stEdit = React.useState(null);
    var editing = stEdit[0]; var setEditing = stEdit[1];
    var stLimit = React.useState(null);
    var limitSheet = stLimit[0]; var setLimitSheet = stLimit[1];
    var stCopy = React.useState(false);
    var copySheet = stCopy[0]; var setCopySheet = stCopy[1];
    var stCollapsed = React.useState({});
    var collapsedGroups = stCollapsed[0]; var setCollapsedGroups = stCollapsed[1];
    var stTargets = React.useState(false);
    var targetsSheetOpen = stTargets[0]; var setTargetsSheetOpen = stTargets[1];

    var lbl = typeof store.monthLabel === 'function'
      ? store.monthLabel(selectedMonth)
      : { long: fmtMesLongo(selectedMonth), short: selectedMonth };

    // Dia atual para projecao
    var today = new Date();
    var parts = String(selectedMonth).split('-').map(Number);
    var daysInMonth = new Date(parts[0], parts[1], 0).getDate();
    var isCurrentMonth = today.getFullYear() === parts[0] && (today.getMonth() + 1) === parts[1];
    var dayElapsed = isCurrentMonth ? today.getDate() : daysInMonth;

    // Ajustar spent pelo toggle "incluir pendentes"
    var adjustedUsage = React.useMemo(function () {
      if (incPend) return categoryUsage;
      var spentMap = {};
      monthTransactions.forEach(function (t) {
        if (t.isTransfer || t.val >= 0 || t.status !== 'pago') return;
        spentMap[t.cat] = (spentMap[t.cat] || 0) + Math.abs(t.val);
      });
      return categoryUsage.map(function (c) {
        var sp = spentMap[c.cat_key] || 0;
        var p = c.limit ? Math.round((sp / c.limit) * 100) : null;
        var st = !c.limit ? null : p >= 100 ? 'over' : p >= 80 ? 'warn' : 'ok';
        var n = {};
        for (var k in c) if (Object.prototype.hasOwnProperty.call(c, k)) n[k] = c[k];
        n.spent = sp; n.pct = p; n.status = st;
        return n;
      });
    }, [incPend, categoryUsage, monthTransactions]);

    // Receita do mes
    var receita = React.useMemo(function () {
      return monthTransactions
        .filter(function (t) { return t.val > 0 && !t.isTransfer; })
        .reduce(function (s, t) { return s + t.val; }, 0);
    }, [monthTransactions]);

    // Construir grupos
    var groups = React.useMemo(function () {
      var ids = ['essencial', 'estilo', 'divida'];
      return ids.map(function (id) {
        var cats = adjustedUsage.filter(function (c) { return c.grp === id; });
        var withLimit = cats.filter(function (c) { return c.limit > 0; });
        var noLimit = cats.filter(function (c) {
          return !c.limit && c.spent > 0;
        });
        withLimit.sort(function (a, b) {
          var rank = { bad: 3, warn: 2, ok: 1 };
          var ra = a.limit ? (a.spent / a.limit >= 1 ? 'bad' : a.spent / a.limit >= 0.8 ? 'warn' : 'ok') : 'ok';
          var rb = b.limit ? (b.spent / b.limit >= 1 ? 'bad' : b.spent / b.limit >= 0.8 ? 'warn' : 'ok') : 'ok';
          return (rank[rb] || 0) - (rank[ra] || 0) || b.spent - a.spent;
        });
        var limit = cats.reduce(function (s, c) { return s + (c.limit || 0); }, 0);
        var spent = cats.reduce(function (s, c) { return s + c.spent; }, 0);
        return {
          id: id,
          label: (GROUP_META[id] || {}).label || id,
          cats: cats, withLimit: withLimit, noLimit: noLimit,
          limit: limit, spent: spent
        };
      });
    }, [adjustedUsage]);

    var totals = React.useMemo(function () {
      var planned = 0, realized = 0, withLim = 0, inLim = 0;
      groups.forEach(function (g) {
        g.cats.forEach(function (c) {
          planned += (c.limit || 0);
          realized += c.spent;
          if (c.limit > 0) { withLim++; if (c.spent <= c.limit) inLim++; }
        });
      });
      var proj = (isCurrentMonth && dayElapsed < 7)
        ? null
        : (dayElapsed ? realized * (daysInMonth / dayElapsed) : realized);
      return {
        planned: planned, realized: realized, projection: proj,
        catsWithLimit: withLim, catsInLimit: inLim
      };
    }, [groups, daysInMonth, dayElapsed]);

    var dist = React.useMemo(function () {
      var d = { essencial: 0, estilo: 0, divida: 0 };
      groups.forEach(function (g) { d[g.id] = g.spent; });
      d.total = d.essencial + d.estilo + d.divida;
      return d;
    }, [groups]);

    function toggleGroup(gid) {
      setCollapsedGroups(function (p) {
        var n = {};
        for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) n[k] = p[k];
        n[gid] = !n[gid];
        return n;
      });
    }

    function onEditSave(catKey, raw) {
      if (raw !== null) {
        var v = parseBR(raw);
        if (v > 0) {
          Promise.resolve(setCategoryLimit(catKey, v, 'this'))
            .then(function () { toast.success('Limite atualizado'); })
            .catch(function () { toast.error('Erro ao salvar'); });
        }
      }
      setEditing(null);
    }

    function onSaveLimit(catKey, value, mode, picked) {
      var scope = mode === 'all' ? 'default'
                : mode === 'specific' ? 'custom'
                : 'this';
      var months = null;
      if (scope === 'custom') {
        var year = String(selectedMonth).split('-')[0];
        months = Array.from(picked || []).map(function (i) {
          return year + '-' + String(i + 1).padStart(2, '0');
        });
      }
      Promise.resolve(setCategoryLimit(catKey, value, scope, months))
        .then(function () {
          if (scope === 'this') toast.success('Limite definido para ' + lbl.long);
          else if (scope === 'default') toast.success('Limite padrao salvo');
          else toast.success('Limite aplicado a ' + (months || []).length + ' meses');
          setLimitSheet(null);
        })
        .catch(function () { toast.error('Erro ao salvar limite'); });
    }

    function onRemoveLimit(catKey) {
      confirm({
        title: 'Remover limite?',
        message: 'Esta categoria voltara a aparecer sem limite definido.',
        destructive: true,
        confirmLabel: 'Remover limite'
      }).then(function (ok) {
        if (!ok) return;
        Promise.resolve(removeCategoryLimit(catKey, 'this'))
          .then(function () {
            toast.warn('Limite removido');
            setLimitSheet(null);
          })
          .catch(function () { toast.error('Erro ao remover limite'); });
      });
    }

    function handleSaveTargets(next) {
      return setGroupTargetsStore(next)
        .then(function () {
          toast.success('Metas atualizadas');
          setTargetsSheetOpen(false);
        })
        .catch(function (err) {
          toast.error('Erro ao salvar: ' + (err.message || 'tente novamente'));
        });
    }
    function handleResetTargets() {
      return resetGroupTargetsStore()
        .then(function () {
          toast.success('Metas resetadas para 50/30/20');
          setTargetsSheetOpen(false);
        })
        .catch(function (err) {
          toast.error('Erro ao resetar: ' + (err.message || 'tente novamente'));
        });
    }

    var ctx = {
      expanded: expanded,
      editing: editing,
      receita: receita,
      daysInMonth: daysInMonth,
      dayElapsed: dayElapsed,
      isCurrentMonth: isCurrentMonth,
      onToggle: function (id) { setExpanded(function (e) { return e === id ? null : id; }); },
      onEditStart: function (id) { setEditing(id); },
      onEditSave: onEditSave,
      onOpenLimit: function (id) { setLimitSheet({ cat: id, mode: 'this' }); }
    };

    var isEmpty = !categoryUsage || categoryUsage.length === 0
      || (totals.catsWithLimit === 0 && totals.realized === 0);

    var sheetCat = limitSheet && limitSheet.cat;
    var sheetCurrentLimit = 0;
    if (sheetCat) {
      for (var i = 0; i < groups.length; i++) {
        for (var j = 0; j < groups[i].cats.length; j++) {
          if (groups[i].cats[j].cat_key === sheetCat) {
            sheetCurrentLimit = groups[i].cats[j].limit || 0;
            break;
          }
        }
      }
    }

    return React.createElement('div', { className: 'pln-screen' },
      React.createElement(PlnHeader, {
        incPend: incPend,
        onToggleIncPend: function () { setIncPend(function (v) { return !v; }); },
        onCopy: function () { setCopySheet(true); },
        lbl: lbl,
        onPrev: function () { setSelectedMonth(goMonth(selectedMonth, -1)); },
        onNext: function () { setSelectedMonth(goMonth(selectedMonth, +1)); }
      }),
      isEmpty
        ? React.createElement(PlnEmptyState, {
            onCopy: function () { setCopySheet(true); },
            onApplyRule: function () { toast.info('Em breve — proxima versao'); }
          })
        : React.createElement('div', { className: 'pln-body' },
            React.createElement(RuleInfoCard, null),
            React.createElement(PlnInsights, {
              groups: groups, totals: totals, dist: dist, receita: receita,
              groupTargets: groupTargets,
              onEditTargets: function () { setTargetsSheetOpen(true); }
            }),
            groups.map(function (g) {
              return React.createElement(PlnGroupSection, {
                key: g.id, g: g, ctx: ctx,
                collapsed: !!collapsedGroups[g.id],
                onToggleCollapse: function () { toggleGroup(g.id); }
              });
            })
          ),
      limitSheet
        ? React.createElement(LimitSheet, {
            cat: sheetCat,
            currentLimit: sheetCurrentLimit,
            initialMode: limitSheet.mode,
            lbl: lbl,
            onClose: function () { setLimitSheet(null); },
            onSave: onSaveLimit,
            onRemove: onRemoveLimit
          })
        : null,
      copySheet
        ? React.createElement(CopySheet, {
            lbl: lbl,
            onClose: function () { setCopySheet(false); },
            onApply: function () {
              toast.info('Em breve — proxima versao');
              setCopySheet(false);
            }
          })
        : null,
      targetsSheetOpen
        ? React.createElement(GroupTargetsSheet, {
            current: groupTargets,
            onSave: handleSaveTargets,
            onReset: handleResetTargets,
            onClose: function () { setTargetsSheetOpen(false); }
          })
        : null,
      React.createElement(ConfirmHost, null)
    );
  }

  // Compatibilidade com o shell atual.
  var OrcamentoStudio = FidesOrcamento;
  Object.assign(window, {
    FidesOrcamento: FidesOrcamento,
    OrcamentoStudio: OrcamentoStudio
  });
})();
