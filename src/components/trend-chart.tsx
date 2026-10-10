'use client';

import { useState } from 'react';
import type { MarkRow } from '@/lib/bests';
import { formatMark, type Units } from '@/lib/units';

const WIDTH = 320;
const HEIGHT = 160;
const PAD = { top: 12, right: 12, bottom: 20, left: 12 };

/**
 * 直近の記録の推移。1系列なので凡例は置かず、題で名前を言う。
 * 線は 2px、点は 8px。点に触るとその記録を出す（当たり判定は点より広く取る）
 */
export function TrendChart({
  rows,
  units,
  locale,
}: {
  rows: MarkRow[];
  units: Units;
  locale: string;
}) {
  const [active, setActive] = useState<number>(rows.length - 1);
  const marks = rows.map((r) => r.markM);
  const min = Math.min(...marks);
  const max = Math.max(...marks);
  // 全部同じ値でも線を真ん中に置く
  const span = max - min || 0.1;
  const low = min - span * 0.15;
  const high = max + span * 0.15;

  const x = (i: number) =>
    PAD.left + (rows.length === 1 ? 0.5 : i / (rows.length - 1)) * (WIDTH - PAD.left - PAD.right);
  const y = (m: number) =>
    PAD.top + (1 - (m - low) / (high - low)) * (HEIGHT - PAD.top - PAD.bottom);
  const path = rows.map((r, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(r.markM)}`).join(' ');
  const point = rows[active];
  const dayLabel = (day: string) =>
    new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${day}T00:00:00Z`),
    );

  return (
    <div className="flex flex-col gap-2">
      {point && (
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold tabular-nums">{formatMark(point.markM, units)}</span>
          <span className="text-sm text-sub tabular-nums">{dayLabel(point.day)}</span>
        </div>
      )}
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img">
        {[max, min].map((m) => (
          <g key={m}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(m)}
              y2={y(m)}
              className="stroke-line"
              strokeWidth={1}
            />
          </g>
        ))}
        <path
          d={path}
          fill="none"
          className="stroke-accent"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {rows.map((r, i) => (
          <g key={i} onPointerEnter={() => setActive(i)} onClick={() => setActive(i)}>
            {/* 当たり判定。見えない広い円 */}
            <circle cx={x(i)} cy={y(r.markM)} r={14} fill="transparent" />
            <circle
              cx={x(i)}
              cy={y(r.markM)}
              r={i === active ? 5 : 4}
              className={i === active ? 'fill-accent stroke-surface' : 'fill-surface stroke-accent'}
              strokeWidth={2}
            />
          </g>
        ))}
        <text x={PAD.left} y={HEIGHT - 4} className="fill-sub text-[10px]">
          {dayLabel(rows[0]!.day)}
        </text>
        <text
          x={WIDTH - PAD.right}
          y={HEIGHT - 4}
          textAnchor="end"
          className="fill-sub text-[10px]"
        >
          {dayLabel(rows.at(-1)!.day)}
        </text>
      </svg>
    </div>
  );
}
