'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { MarkRow } from '@/lib/bests';
import { DisplayNumber } from '@/components/layout-ui';
import { formatMark, type Units } from '@/lib/units';

/** 幅が測れるまでの描き幅。測れたら実際の幅（px）で描き直す */
const INITIAL_WIDTH = 320;
const HEIGHT = 160;
const PAD = { top: 12, right: 12, bottom: 20, left: 12 };
/** 全部同じ値のときの縦の幅（m）と、上下に空ける余白（幅に対する割合） */
const FLAT_SPAN_M = 0.1;
const SPAN_MARGIN = 0.15;
/** 1本だけのときの横の位置（真ん中） */
const SINGLE_X = 0.5;
/** 点の半径（選んだ点と、ほかの点） */
const ACTIVE_DOT_R = 5;
const DOT_R = 4;
/** 日付の字の下端を、絵の下端から上げる分 */
const LABEL_LIFT = 4;

/**
 * 直近の記録の推移。1系列なので凡例は置かず、題で名前を言う。
 * 線は 2px、点は 8px。点に触るとその記録を出す（当たり判定は点より広く取る）。
 * 描き幅は実際の幅（px）に合わせる。決まった幅の絵を引き伸ばすと、パソコンの幅で日付の字・線・点まで
 * 2倍ほどに大きくなっていた（2026-10-14 に分析の画面で見つけた）
 */
export function TrendChart({
  rows,
  units,
  locale,
  colorClass = 'text-primary',
}: {
  rows: MarkRow[];
  units: Units;
  locale: string;
  /** 線と点の色（種目の色の字のクラス）。線は currentColor で描く */
  colorClass?: string;
}) {
  const [active, setActive] = useState<number>(rows.length - 1);
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(INITIAL_WIDTH);
  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    const measure = () => setWidth(Math.max(1, Math.round(element.getBoundingClientRect().width)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const marks = rows.map((r) => r.markM);
  const min = Math.min(...marks);
  const max = Math.max(...marks);
  // 全部同じ値でも線を真ん中に置く
  const span = max - min || FLAT_SPAN_M;
  const low = min - span * SPAN_MARGIN;
  const high = max + span * SPAN_MARGIN;

  const x = (i: number) =>
    PAD.left +
    (rows.length === 1 ? SINGLE_X : i / (rows.length - 1)) * (width - PAD.left - PAD.right);
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
          <DisplayNumber size="sm">{formatMark(point.markM, units)}</DisplayNumber>
          <span className="text-sm text-muted-foreground tabular-nums">{dayLabel(point.day)}</span>
        </div>
      )}
      <div ref={frame}>
        <svg viewBox={`0 0 ${width} ${HEIGHT}`} className={`w-full ${colorClass}`} role="img">
          {[max, min].map((m) => (
            <g key={m}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(m)}
                y2={y(m)}
                className="stroke-border"
                strokeWidth={1}
              />
            </g>
          ))}
          <path
            d={path}
            fill="none"
            className="stroke-current"
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
                r={i === active ? ACTIVE_DOT_R : DOT_R}
                className={i === active ? 'fill-current stroke-card' : 'fill-card stroke-current'}
                strokeWidth={2}
              />
            </g>
          ))}
          <text
            x={PAD.left}
            y={HEIGHT - LABEL_LIFT}
            className="fill-muted-foreground text-chart-axis"
          >
            {dayLabel(rows[0]!.day)}
          </text>
          <text
            x={width - PAD.right}
            y={HEIGHT - LABEL_LIFT}
            textAnchor="end"
            className="fill-muted-foreground text-chart-axis"
          >
            {dayLabel(rows.at(-1)!.day)}
          </text>
        </svg>
      </div>
    </div>
  );
}
