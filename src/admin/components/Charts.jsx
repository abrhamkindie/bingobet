import React from 'react';
import { formatCurrency } from './Utils.jsx';

export function BarChart({ items }) {
  if (!items || !items.length) return null;
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => {
        const pct = Math.max((item.value / max * 100), 2);
        const label = (item.label || '').length > 20 ? (item.label || '').slice(0, 20) + '...' : (item.label || '');
        return (
          <div key={i} className="flex items-center gap-3 group">
            <span className="text-xs text-muted w-24 shrink-0 text-right truncate" title={item.label}>{label}</span>
            <div className="flex-1 relative">
              <div className="h-7 bg-[#f1f5f9] rounded-lg overflow-hidden">
                <div
                  className="h-full rounded-lg min-w-[6px] transition-all duration-700 ease-out"
                  style={{ width: pct + '%', background: item.hex || '#4f46e5' }}
                ></div>
              </div>
            </div>
            <span className="text-xs text-ink w-24 shrink-0 font-semibold text-right tabular-nums">{item.fmt ? formatCurrency(item.value) : item.value}</span>
          </div>
        );
      })}
    </div>
  );
}

export function AreaChart({ data }) {
  if (!data || !data.length) return <div className="text-center text-muted text-xs py-8">No data</div>;
  const values = data.map(d => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 600, h = 200;
  const pad = { t: 20, r: 15, b: 30, l: 10 };
  const chartW = w - pad.l - pad.r;
  const chartH = h - pad.t - pad.b;
  const stepX = chartW / (data.length - 1 || 1);
  const points = data.map((d, i) => ({
    x: pad.l + i * stepX,
    y: pad.t + chartH - ((d.value - min) / range) * chartH,
  }));
  const pathD = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
  const areaD = pathD + ' L' + points[points.length - 1].x.toFixed(1) + ' ' + (pad.t + chartH) + ' L' + points[0].x.toFixed(1) + ' ' + (pad.t + chartH) + ' Z';
  const labels = data.map((d, i) => {
    if (i % Math.max(1, Math.floor(data.length / 6)) !== 0 && i !== data.length - 1) return null;
    const x = pad.l + i * stepX;
    return <text key={i} x={x.toFixed(0)} y={h - 5} textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="Inter, sans-serif">{d.label || ''}</text>;
  });
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto min-w-[300px]">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.20"/>
            <stop offset="55%" stopColor="#4f46e5" stopOpacity="0.06"/>
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.01"/>
          </linearGradient>
        </defs>
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
          <line key={i} x1={pad.l} y1={pad.t + chartH - r * chartH} x2={pad.l + chartW} y2={pad.t + chartH - r * chartH} stroke="#e2e8f0" strokeWidth="1"/>
        ))}
        <path d={areaD} fill="url(#areaGrad)"/>
        <path d={pathD} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {points.map((p, i) => (
          <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="3" fill="#4f46e5" stroke="#ffffff" strokeWidth="2" className="group-hover:opacity-100 opacity-0 transition-opacity"/>
        ))}
        {labels}
      </svg>
    </div>
  );
}

export function DonutChart({ items }) {
  if (!items || !items.length) return <div className="text-center text-muted text-xs py-8">No data</div>;
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const palette = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#06b6d4', '#0f172a'];
  let offset = 0;
  const r = 60, cx = 80, cy = 80, circ = 2 * Math.PI * r;
  const slices = items.map((item, i) => {
    const pct = item.value / total;
    const len = pct * circ;
    const col = palette[i % palette.length];
    const slice = { pct, len, col, label: item.label, value: item.value };
    return slice;
  });

  const renderedSlices = slices.map((s, i) => {
    const dash = s.len + ' ' + (circ - s.len);
    const el = (
      <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.col} strokeWidth="18"
        strokeDasharray={dash} strokeDashoffset={(-offset + s.len).toString()}
        transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="round"
        className="transition-all duration-300 hover:opacity-80 cursor-pointer"
      />
    );
    offset += s.len;
    return el;
  });

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <svg viewBox="0 0 160 160" width="140" height="140" className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="18"/>
        {renderedSlices}
        <text x="80" y="78" textAnchor="middle" dominantBaseline="middle" fill="#0f172a" fontWeight="bold" fontSize="18" fontFamily="Inter, sans-serif">{total}</text>
        <text x="80" y="96" textAnchor="middle" dominantBaseline="middle" fill="#64748b" fontSize="10" fontFamily="Inter, sans-serif">Total</text>
      </svg>
      <div className="flex flex-col gap-2">
        {slices.map((s, i) => {
          const pct = ((s.pct) * 100).toFixed(1);
          return (
            <div key={i} className="flex items-center gap-2.5 text-xs group cursor-pointer">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform group-hover:scale-125" style={{background: s.col}}></span>
              <span className="text-muted group-hover:text-ink transition-colors">{s.label}</span>
              <span className="text-ink font-semibold ml-auto tabular-nums">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChartCard({ title, children, subtitle, action }) {
  return (
    <div className="card rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted mt-0.5">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  );
}
