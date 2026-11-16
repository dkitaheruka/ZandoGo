import { useState } from 'react';
import type { AnalyticsRevenuePoint, AnalyticsSegmentItem } from '../lib/types';

const PALETTE = ['#26735B', '#F2B84B', '#3B82F6', '#B84C43', '#10B981', '#8B5CF6'];

export function TrendAreaChart({
  data,
  dark = false,
  height = 200,
  valuePrefix = '$',
}: {
  data: AnalyticsRevenuePoint[];
  dark?: boolean;
  height?: number;
  valuePrefix?: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className={`h-44 flex items-center justify-center text-xs ${dark ? 'text-brume/50' : 'text-encre/50'}`}>
        Aucune donnée disponible sur la période.
      </div>
    );
  }

  const width = 620;
  const padX = 36;
  const padTop = 26;
  const padBottom = 32;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;
  const maxVal = Math.max(10, ...data.map((d) => Number(d.revenueUsd) || 0));

  const points = data.map((d, idx) => {
    const x = padX + (data.length === 1 ? innerW / 2 : (idx / (data.length - 1)) * innerW);
    const y = padTop + innerH - (Math.max(0, Number(d.revenueUsd) || 0) / maxVal) * innerH;
    return { x, y, ...d };
  });

  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath =
    points.length > 0
      ? `M ${points[0].x.toFixed(1)},${(padTop + innerH).toFixed(1)} L ${points
          .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(' L ')} L ${points[points.length - 1].x.toFixed(1)},${(padTop + innerH).toFixed(1)} Z`
      : '';

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className="relative w-full select-none">
      {activePoint && (
        <div
          className={`mb-2 inline-flex items-center gap-3 px-3 py-1 rounded-full text-[11px] font-mono ${
            dark ? 'bg-white/10 text-safran border border-white/15' : 'bg-nuit text-brume'
          }`}
        >
          <span className="font-bold">{activePoint.label}</span>
          <span>
            {valuePrefix}
            {Number(activePoint.revenueUsd).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
          </span>
          <span className="opacity-75">· {activePoint.ordersCount} cmd</span>
        </div>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible" role="img">
        <defs>
          <linearGradient id={dark ? 'zgAreaDark' : 'zgAreaLight'} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={dark ? '#F2B84B' : '#26735B'} stopOpacity="0.38" />
            <stop offset="100%" stopColor={dark ? '#F2B84B' : '#26735B'} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {gridLines.map((ratio) => {
          const y = padTop + innerH - ratio * innerH;
          const labelVal = Math.round(maxVal * ratio);
          return (
            <g key={ratio}>
              <line
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                stroke={dark ? 'rgba(255,255,255,0.08)' : 'rgba(23,35,32,0.08)'}
                strokeDasharray="3 3"
              />
              <text
                x={padX - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="9"
                fill={dark ? 'rgba(247,245,238,0.45)' : 'rgba(23,35,32,0.45)'}
                className="font-mono"
              >
                {valuePrefix}
                {labelVal}
              </text>
            </g>
          );
        })}

        {areaPath && <path d={areaPath} fill={`url(#${dark ? 'zgAreaDark' : 'zgAreaLight'})`} />}

        <polyline
          fill="none"
          stroke={dark ? '#F2B84B' : '#26735B'}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polyline}
        />

        {points.map((p, idx) => {
          const isHovered = hoveredIdx === idx;
          return (
            <g
              key={p.label}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? 6 : 4}
                fill={dark ? '#172320' : '#FFFFFF'}
                stroke={dark ? '#F2B84B' : '#26735B'}
                strokeWidth="2.5"
              />
              <text
                x={p.x}
                y={height - 8}
                textAnchor="middle"
                fontSize="10"
                fontWeight={isHovered ? '700' : '500'}
                fill={dark ? 'rgba(247,245,238,0.75)' : 'rgba(23,35,32,0.7)'}
              >
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function RevenueBarChart({
  data,
  dark = false,
  height = 210,
}: {
  data: { label: string; revenueUsd: number; ordersCount?: number }[];
  dark?: boolean;
  height?: number;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className={`h-44 flex items-center justify-center text-xs ${dark ? 'text-brume/50' : 'text-encre/50'}`}>
        Aucune donnée à afficher.
      </div>
    );
  }

  const maxVal = Math.max(1, ...data.map((d) => Number(d.revenueUsd) || 0));

  return (
    <div className="space-y-2">
      <div
        className="grid gap-2.5 items-end pt-4"
        style={{
          gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
          height: `${height}px`,
        }}
      >
        {data.map((item, idx) => {
          const val = Number(item.revenueUsd) || 0;
          const pct = Math.max(10, Math.round((val / maxVal) * 100));
          const isHovered = hoveredIdx === idx;
          return (
            <div
              key={`${item.label}-${idx}`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="flex flex-col items-center justify-end h-full gap-1.5 group cursor-pointer"
            >
              <span
                className={`text-[10px] font-mono tabular-nums transition-opacity ${
                  isHovered
                    ? dark
                      ? 'text-safran font-bold'
                      : 'text-nuit font-bold'
                    : dark
                    ? 'text-brume/60'
                    : 'text-encre/60'
                }`}
              >
                ${val >= 100 ? Math.round(val) : val.toFixed(0)}
              </span>
              <div
                className={`w-full max-w-[44px] rounded-t-lg overflow-hidden flex items-end flex-1 max-h-[140px] ${
                  dark ? 'bg-white/5' : 'bg-brume'
                }`}
              >
                <div
                  className={`w-full rounded-t-lg transition-all duration-300 ${
                    isHovered ? 'bg-seve' : 'bg-safran'
                  }`}
                  style={{ height: `${pct}%` }}
                />
              </div>
              <span
                title={item.label}
                className={`text-[10px] font-display font-semibold truncate max-w-full text-center ${
                  dark ? 'text-brume/80' : 'text-nuit'
                }`}
              >
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DonutBreakdownChart({
  items,
  dark = false,
  unitSuffix = '',
  centerLabel = 'Total',
}: {
  items: (AnalyticsSegmentItem & { sublabel?: string })[];
  dark?: boolean;
  unitSuffix?: string;
  centerLabel?: string;
}) {
  const clean = (items || []).filter((i) => Number(i.value) > 0);
  const total = clean.reduce((acc, i) => acc + Number(i.value), 0);

  if (clean.length === 0 || total <= 0) {
    return (
      <div className={`py-10 text-center text-xs ${dark ? 'text-brume/50' : 'text-encre/50'}`}>
        Répartition en attente de données.
      </div>
    );
  }

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="transparent"
            stroke={dark ? 'rgba(255,255,255,0.08)' : 'rgba(23,35,32,0.08)'}
            strokeWidth="18"
          />
          {clean.map((seg, idx) => {
            const val = Number(seg.value);
            const dash = (val / total) * circumference;
            const offset = -(accumulated / total) * circumference;
            accumulated += val;
            const color = seg.color || PALETTE[idx % PALETTE.length];
            return (
              <circle
                key={`${seg.label}-${idx}`}
                cx="70"
                cy="70"
                r={radius}
                fill="transparent"
                stroke={color}
                strokeWidth="18"
                strokeDasharray={`${dash} ${circumference}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className={`text-[10px] uppercase font-mono ${dark ? 'text-brume/55' : 'text-encre/55'}`}>
            {centerLabel}
          </span>
          <span className={`font-display text-lg font-extrabold tabular-nums ${dark ? 'text-white' : 'text-nuit'}`}>
            {Number.isInteger(total) ? total : total.toFixed(1)}
            {unitSuffix}
          </span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2.5 text-xs">
        {clean.map((seg, idx) => {
          const val = Number(seg.value);
          const pct = Math.round((val / total) * 100);
          const color = seg.color || PALETTE[idx % PALETTE.length];
          return (
            <div key={`${seg.label}-${idx}`} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <div className="min-w-0">
                  <span className={`font-medium truncate block ${dark ? 'text-brume/90' : 'text-nuit'}`}>
                    {seg.label}
                  </span>
                  {seg.sublabel && (
                    <span className={`text-[10px] font-mono ${dark ? 'text-brume/50' : 'text-encre/50'}`}>
                      {seg.sublabel}
                    </span>
                  )}
                </div>
              </div>
              <span className={`font-mono font-bold tabular-nums shrink-0 ${dark ? 'text-safran' : 'text-nuit'}`}>
                {pct}% ({Number.isInteger(val) ? val : val.toFixed(2)}
                {unitSuffix})
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HorizontalBarList({
  items,
  dark = false,
  valueFormatter = (v) => `$${v.toFixed(2)}`,
}: {
  items: { label: string; value: number; subtitle?: string }[];
  dark?: boolean;
  valueFormatter?: (val: number) => string;
}) {
  if (!items || items.length === 0) {
    return (
      <div className={`py-8 text-center text-xs ${dark ? 'text-brume/50' : 'text-encre/50'}`}>
        Aucune donnée disponible.
      </div>
    );
  }
  const maxVal = Math.max(1, ...items.map((i) => Number(i.value) || 0));

  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const val = Number(item.value) || 0;
        const pct = Math.max(6, Math.round((val / maxVal) * 100));
        return (
          <div key={`${item.label}-${idx}`} className="space-y-1 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className={`font-semibold truncate ${dark ? 'text-brume' : 'text-nuit'}`}>{item.label}</span>
              <span className={`font-mono font-bold tabular-nums shrink-0 ${dark ? 'text-safran' : 'text-seve'}`}>
                {valueFormatter(val)}
              </span>
            </div>
            <div className={`h-2 w-full rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-brume'}`}>
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  idx === 0 ? 'bg-safran' : 'bg-seve'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {item.subtitle && (
              <p className={`text-[10px] font-mono ${dark ? 'text-brume/55' : 'text-encre/55'}`}>{item.subtitle}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
