// fides-charts.jsx — Reusable SVG charts with optional gradient + glow.
// All charts accept `accent` (CSS color) and an optional `glow` flag.

// ─── Helpers ──────────────────────────────────────────────────
function smoothPath(points) {
  if (points.length < 2) return '';
  let d = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  return d;
}

// ─── AreaChart — Balanço mensal ───────────────────────────────
function AreaChart({ data, height = 220, accent = '#B45309', glow = false }) {
  const W = 1000, H = height, padX = 24, padTop = 24, padBot = 36;
  const max = Math.max(...data.flatMap(d => [d.rec, d.des])) * 1.1;
  const xs = data.map((_, i) => padX + i * (W - padX * 2) / (data.length - 1));
  const yRec = data.map(d => padTop + (1 - d.rec / max) * (H - padTop - padBot));
  const yDes = data.map(d => padTop + (1 - d.des / max) * (H - padTop - padBot));
  const ptsRec = xs.map((x, i) => [x, yRec[i]]);
  const ptsDes = xs.map((x, i) => [x, yDes[i]]);
  const recPath = smoothPath(ptsRec);
  const desPath = smoothPath(ptsDes);
  const recArea = recPath + ` L ${xs[xs.length - 1]},${H - padBot} L ${xs[0]},${H - padBot} Z`;
  const desArea = desPath + ` L ${xs[xs.length - 1]},${H - padBot} L ${xs[0]},${H - padBot} Z`;
  const uid = React.useId().replace(/[:]/g, '');
  // Find current month index (last non-future)
  const curIdx = data.findIndex(d => d.future) - 1;
  const cur = curIdx >= 0 ? curIdx : data.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`g-rec-${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"  stopColor={accent} stopOpacity="0.32"/>
          <stop offset="100%" stopColor={accent} stopOpacity="0"/>
        </linearGradient>
        <linearGradient id={`g-des-${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"  stopColor="#0F172A" stopOpacity="0.10"/>
          <stop offset="100%" stopColor="#0F172A" stopOpacity="0"/>
        </linearGradient>
        {glow && (
          <filter id={`glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        )}
        <pattern id={`grid-${uid}`} width="60" height="40" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeOpacity="0.06" strokeWidth="1"/>
        </pattern>
      </defs>
      <rect x={padX} y={padTop} width={W - padX*2} height={H - padTop - padBot} fill={`url(#grid-${uid})`}/>
      {/* expense area */}
      <path d={desArea} fill={`url(#g-des-${uid})`}/>
      <path d={desPath} fill="none" stroke="#0F172A" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="3 3"/>
      {/* income area + line */}
      <path d={recArea} fill={`url(#g-rec-${uid})`}/>
      <path d={recPath} fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" filter={glow ? `url(#glow-${uid})` : undefined}/>
      {/* current month dot */}
      <circle cx={xs[cur]} cy={yRec[cur]} r="5" fill="#fff" stroke={accent} strokeWidth="2.4"/>
      {/* x axis labels */}
      {data.map((d, i) => (
        <text key={i} x={xs[i]} y={H - 12} textAnchor="middle"
              fontSize="11" fill="currentColor" fillOpacity={d.future ? 0.3 : 0.55}
              fontFamily="var(--font-sans)" letterSpacing="0.04em" style={{textTransform:'uppercase'}}>
          {d.m}
        </text>
      ))}
      {/* future zone */}
      {data.some(d => d.future) && (() => {
        const firstFuture = data.findIndex(d => d.future);
        const x0 = padX + (firstFuture - 0.5) * (W - padX*2) / (data.length - 1);
        return <rect x={x0} y={padTop} width={W - padX - x0} height={H - padTop - padBot} fill="currentColor" fillOpacity="0.025"/>;
      })()}
    </svg>
  );
}

// ─── Sparkline — small inline trend line ──────────────────────
function Sparkline({ values, height = 36, width = 110, accent = '#B45309', glow = false, fill = true }) {
  const min = Math.min(...values), max = Math.max(...values);
  const range = (max - min) || 1;
  const padY = 4;
  const xs = values.map((_, i) => (i / (values.length - 1)) * width);
  const ys = values.map(v => padY + (1 - (v - min) / range) * (height - padY * 2));
  const pts = xs.map((x, i) => [x, ys[i]]);
  const path = smoothPath(pts);
  const area = path + ` L ${width},${height} L 0,${height} Z`;
  const uid = React.useId().replace(/[:]/g, '');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`sp-${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.32"/>
          <stop offset="100%" stopColor={accent} stopOpacity="0"/>
        </linearGradient>
        {glow && (
          <filter id={`spg-${uid}`} x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="2.4" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        )}
      </defs>
      {fill && <path d={area} fill={`url(#sp-${uid})`}/>}
      <path d={path} fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round"
            filter={glow ? `url(#spg-${uid})` : undefined}/>
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="2.6" fill={accent}/>
    </svg>
  );
}

// ─── Donut — Gastos por categoria ─────────────────────────────
function Donut({ data, size = 200, thickness = 22, gap = 0.012, accent = '#B45309', glow = false }) {
  const total = data.reduce((s, d) => s + d.val, 0);
  const R = size / 2 - 4;
  const r = R - thickness;
  const cx = size / 2, cy = size / 2;
  let acc = -Math.PI / 2;
  const uid = React.useId().replace(/[:]/g, '');
  const arcs = data.map((d) => {
    const a = (d.val / total) * Math.PI * 2;
    const a0 = acc + gap / 2;
    const a1 = acc + a - gap / 2;
    acc += a;
    const large = a > Math.PI ? 1 : 0;
    const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0);
    const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
    const xi1 = cx + r * Math.cos(a1), yi1 = cy + r * Math.sin(a1);
    const xi0 = cx + r * Math.cos(a0), yi0 = cy + r * Math.sin(a0);
    const d_ = `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${r} ${r} 0 ${large} 0 ${xi0} ${yi0} Z`;
    return { d: d_, tint: d.tint, label: d.label, val: d.val };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        {glow && (
          <filter id={`donut-${uid}`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        )}
      </defs>
      <g filter={glow ? `url(#donut-${uid})` : undefined}>
        {arcs.map((a, i) => <path key={i} d={a.d} fill={a.tint}/>)}
      </g>
    </svg>
  );
}

// ─── BudgetBar — multi-segment progress for budget groups ─────
function BudgetBar({ segments, height = 8, radius = 6 }) {
  const total = segments.reduce((s, d) => s + d.target, 0) || 1;
  return (
    <div style={{ display: 'flex', width: '100%', height, gap: 2, borderRadius: radius, overflow: 'hidden' }}>
      {segments.map((s, i) => (
        <div key={i} style={{ flex: s.target / total, background: s.tint, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, background: s.tint, opacity: 0.25 }}/>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: `${Math.min(100, (s.spent / s.limit) * 100)}%`, background: s.tint }}/>
        </div>
      ))}
    </div>
  );
}

// ─── ProgressBar ──────────────────────────────────────────────
function ProgressBar({ value, height = 6, tint = '#B45309', track = 'currentColor', trackOpacity = 0.08, glow = false }) {
  const pct = Math.max(0, Math.min(1, value));
  const over = pct > 1 || value > 1;
  return (
    <div style={{ width: '100%', height, background: track, borderRadius: 999, position: 'relative',
                  ['--track-op']: trackOpacity, opacity: 1 }}>
      <div style={{ position: 'absolute', inset: 0, background: track, opacity: trackOpacity, borderRadius: 999 }}/>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${Math.min(100, pct * 100)}%`,
                    background: tint, borderRadius: 999,
                    boxShadow: glow ? `0 0 12px ${tint}66` : 'none',
                    transition: 'width 600ms cubic-bezier(.2,.7,.2,1)' }}/>
    </div>
  );
}

// ─── Saldo acumulado ──────────────────────────────────────────
function AccumulatedChart({ data, height = 240, accent = 'var(--accent)' }) {
  let acc = 0;
  const accData = data.map(d => {
    acc += (d.rec - d.des);
    return { m: d.m, val: acc, future: d.future };
  });
  const W = 1000, padX = 24, padTop = 24, padBot = 36;
  const vals = accData.map(d => d.val);
  const minV = Math.min(0, ...vals);
  const maxV = Math.max(...vals) * 1.1 || 1;
  const range = maxV - minV || 1;
  const xs = accData.map((_, i) => padX + i * (W - padX * 2) / (accData.length - 1));
  const ys = accData.map(d => padTop + (1 - (d.val - minV) / range) * (height - padTop - padBot));
  const pts = xs.map((x, i) => [x, ys[i]]);
  const linePath = smoothPath(pts);
  const uid = React.useId().replace(/[:]/g, '');
  const zeroY = padTop + (1 - (0 - minV) / range) * (height - padTop - padBot);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height}
         style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`g-acc-${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   stopColor={accent} stopOpacity="0.28"/>
          <stop offset="100%" stopColor={accent} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <line x1={padX} y1={zeroY} x2={W - padX} y2={zeroY}
            stroke="currentColor" strokeOpacity="0.15"
            strokeWidth="1" strokeDasharray="4 4"/>
      <path d={linePath + ` L ${xs[xs.length-1]},${zeroY} L ${xs[0]},${zeroY} Z`}
            fill={`url(#g-acc-${uid})`}/>
      <path d={linePath} fill="none" stroke={accent}
            strokeWidth="2.4" strokeLinecap="round"/>
      {accData.map((d, i) => (
        <circle key={i} cx={xs[i]} cy={ys[i]} r="4"
                fill={d.future ? 'transparent' : '#fff'}
                stroke={accent} strokeWidth="2"
                opacity={d.future ? 0.5 : 1}/>
      ))}
      {accData.map((d, i) => (
        <text key={i} x={xs[i]} y={height - 12} textAnchor="middle"
              fontSize="11" fill="currentColor"
              fillOpacity={d.future ? 0.3 : 0.55}
              fontFamily="var(--font-sans)" letterSpacing="0.04em"
              style={{ textTransform: 'uppercase' }}>
          {d.m}
        </text>
      ))}
    </svg>
  );
}

// ─── Por categoria (barras horizontais) ───────────────────────
function CategoryChart({ data, height = 240 }) {
  if (!data || data.length === 0) return null;
  const total = data.reduce((s, d) => s + d.val, 0);
  const sorted = [...data].sort((a, b) => b.val - a.val).slice(0, 7);
  const barMax = sorted[0].val;
  const W = 1000, padX = 24, padTop = 16, padBot = 8;
  const itemH = Math.floor((height - padTop - padBot) / sorted.length);
  const barH = Math.max(12, itemH - 10);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height}
         style={{ display: 'block', overflow: 'visible' }}>
      {sorted.map((d, i) => {
        const y = padTop + i * itemH;
        const maxBarW = W - padX * 2 - 200;
        const barW = Math.max(8, (d.val / barMax) * maxBarW);
        const pct = ((d.val / total) * 100).toFixed(0);
        const valFmt = d.val.toLocaleString('pt-BR', {
          minimumFractionDigits: 0, maximumFractionDigits: 0
        });
        return (
          <g key={d.key || i}>
            <text x={padX} y={y + barH / 2 + 4}
                  fontSize="12" fill="currentColor" fillOpacity="0.65"
                  fontFamily="var(--font-sans)">
              {d.label}
            </text>
            <rect x={padX + 160} y={y} width={barW} height={barH}
                  rx={barH / 2} fill={d.tint || 'var(--accent)'} opacity="0.85"/>
            <text x={padX + 160 + barW + 10} y={y + barH / 2 + 4}
                  fontSize="11" fill="currentColor" fillOpacity="0.55"
                  fontFamily="var(--font-sans)">
              R${valFmt} · {pct}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

Object.assign(window, { AreaChart, Sparkline, Donut, BudgetBar, ProgressBar, smoothPath, AccumulatedChart, CategoryChart });
