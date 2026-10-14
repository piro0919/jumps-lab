'use client';

import { Trash2, Undo2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { MouseEvent } from 'react';
import {
  Badge,
  Card,
  CardTitle,
  EmptyState,
  ErrorText,
  SEGMENTS,
  SEGMENT_GRID,
  Stat,
  segmentClass,
} from '@/components/layout-ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import {
  ANGLE_KINDS,
  ANGLE_NAMES,
  POINTS_NEEDED,
  compareAngles,
  toDisplay,
  toNormalized,
  type Angle,
  type AngleKind,
  type AngleName,
  type Point,
  type Size,
} from '@/lib/video-angles';

/**
 * 動画の上で手で測る角度の部品（src/lib/video-angles.ts）。状態は見比べる画面（video-compare.tsx）が持ち、
 * ここは描くだけ: 動画に重ねる線と点（AngleOverlay）、打っている途中の操作（AngleDraftBar）、
 * 測り方と名前を選んで測り始め、保存したものを並べて A と B を比べるカード（AnglesCard）
 */

/** 線・点・字の太さと大きさ（画面のピクセル。動画の大きさによらず同じ太さで描く） */
const LINE_WIDTH = 2.5;
const HALO_WIDTH = 5;
const POINT_RADIUS = 5;
const TEXT_HALO_WIDTH = 4;
/** 値の字を点から離す距離 */
const LABEL_OFFSET = 10;
/** 傾きの基準にする垂直の点線の刻み */
const DASH = '4 4';

/** 動画に重ねて描く1つの測定。label は値の字（点が足りないうちは null） */
export type AngleShape = { id: string; kind: AngleKind; points: Point[]; label: string | null };

/** 1つの測定を、画面のピクセルで描く */
function Shape({ shape, box, frame }: { shape: AngleShape; box: Size; frame: Size }) {
  const px = shape.points.flatMap((p) => {
    const d = toDisplay(p, box, frame);
    return d ? [d] : [];
  });
  const segments = px.slice(1).map((to, i) => ({ from: px[i] ?? to, to }));
  // 傾きは、下の点から上へ同じ長さの垂直の点線を引き、どれだけ傾いているかを見せる
  const [p, q] = px;
  const vertical =
    shape.kind === 'lean' && p && q
      ? (() => {
          const low = p.y >= q.y ? p : q;
          const length = Math.hypot(q.x - p.x, q.y - p.y);
          return { x: low.x, y1: low.y, y2: low.y - length };
        })()
      : null;
  // 値の字は、3点の角度は真ん中の点の横、傾きは線の真ん中の横に置く。右半分なら左へ出す（はみ出さないように）
  const anchor =
    shape.kind === 'angle' ? px[1] : p && q ? { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 } : null;
  const right = anchor ? anchor.x > box.width / 2 : false;

  return (
    <g>
      {vertical && (
        <line
          x1={vertical.x}
          y1={vertical.y1}
          x2={vertical.x}
          y2={vertical.y2}
          strokeWidth={LINE_WIDTH}
          strokeDasharray={DASH}
          className="stroke-background"
        />
      )}
      {segments.map(({ from, to }, i) => (
        <g key={i}>
          <line
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            strokeWidth={HALO_WIDTH}
            strokeLinecap="round"
            className="stroke-background"
          />
          <line
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            strokeWidth={LINE_WIDTH}
            strokeLinecap="round"
            className="stroke-primary"
          />
        </g>
      ))}
      {px.map((point, i) => (
        <circle
          key={i}
          cx={point.x}
          cy={point.y}
          r={POINT_RADIUS}
          strokeWidth={2}
          className="fill-primary stroke-background"
        />
      ))}
      {anchor && shape.label && (
        <text
          x={anchor.x + (right ? -LABEL_OFFSET : LABEL_OFFSET)}
          y={anchor.y - LABEL_OFFSET}
          textAnchor={right ? 'end' : 'start'}
          strokeWidth={TEXT_HALO_WIDTH}
          paintOrder="stroke"
          className="fill-foreground stroke-background text-sm font-bold"
        >
          {shape.label}
        </text>
      )}
    </g>
  );
}

/**
 * 動画の要素にぴったり重ねる SVG。点は動画の中の割合で持ち、object-contain の帯を除いた絵の上に描く。
 * 打っている間（placing）だけ押せ、押した所を割合にして onPlace へ渡す（帯の上は受けない）
 */
export function AngleOverlay({
  frame,
  box,
  shapes,
  placing,
  label,
  onPlace,
}: {
  frame: Size | null;
  box: Size | null;
  shapes: AngleShape[];
  placing: boolean;
  label: string;
  onPlace: (point: Point) => void;
}) {
  if (!frame || !box || (!placing && shapes.length === 0)) return null;

  const place = (e: MouseEvent<SVGSVGElement>) => {
    // 押したときの箱の大きさで割合にする（描いたあとに大きさが変わっていても、押した所に置く）
    const rect = e.currentTarget.getBoundingClientRect();
    const point = toNormalized(
      e.clientX - rect.left,
      e.clientY - rect.top,
      { width: rect.width, height: rect.height },
      frame,
    );
    if (point) onPlace(point);
  };

  return (
    <svg
      role={placing ? 'button' : 'img'}
      aria-label={label}
      width={box.width}
      height={box.height}
      className={cn(
        'absolute inset-0 size-full',
        placing ? 'cursor-crosshair touch-none' : 'pointer-events-none',
      )}
      onClick={placing ? place : undefined}
    >
      {shapes.map((shape) => (
        <Shape key={shape.id} shape={shape} box={box} frame={frame} />
      ))}
    </svg>
  );
}

/** 度数の数（Stat に渡す）。整数で見せる（手で打つ点のずれは 1° より大きい）。差は + と − を付ける */
function useDegrees() {
  const t = useTranslations('compare');
  const format = useFormatter();
  return (value: number | null, signed = false) =>
    value === null
      ? null
      : {
          value: format.number(value, {
            maximumFractionDigits: 0,
            signDisplay: signed ? 'exceptZero' : 'auto',
          }),
          unit: t('degreesUnit'),
        };
}

/** 測定の名前（「膝の角度」「体幹の傾き」）。同じものが2つ以上あれば番号を付ける */
export function useAngleLabel() {
  const t = useTranslations('compare');
  return (name: AngleName, kind: AngleKind, index?: number) =>
    index === undefined
      ? t('angleLabel', { name: t(`angleNames.${name}`), kind })
      : t('angleLabelNth', { name: t(`angleNames.${name}`), kind, n: index });
}

/** 点を打っている途中の操作。動画のすぐ下に出す（スマホで、打つ所とボタンが離れないように） */
export function AngleDraftBar({
  video,
  name,
  kind,
  placed,
  degrees,
  saving,
  error,
  onUndo,
  onCancel,
  onSave,
}: {
  video: string;
  name: AngleName;
  kind: AngleKind;
  placed: number;
  degrees: number | null;
  saving: boolean;
  error: string | null;
  onUndo: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const t = useTranslations('compare');
  const degreesValue = useDegrees();
  const label = useAngleLabel();
  const needed = POINTS_NEEDED[kind];

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-muted p-4" data-testid="angle-draft">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            <Badge tone="accent">{video}</Badge>
            <span className="truncate text-sm font-bold">{label(name, kind)}</span>
          </span>
          <span className="text-xs text-muted-foreground">
            {t('pointsPlaced', { placed, needed })}
          </span>
        </div>
        <Stat size="sm" value={degreesValue(degrees)} label={t(`kinds.${kind}`)} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          type="button"
          disabled={placed === 0}
          onClick={onUndo}
        >
          <Undo2 aria-hidden />
          {t('undoPoint')}
        </Button>
        <Button variant="secondary" size="sm" type="button" onClick={onCancel}>
          {t('cancelAngle')}
        </Button>
        <Button
          size="sm"
          type="button"
          className="ml-auto"
          disabled={placed < needed || degrees === null || saving}
          onClick={onSave}
        >
          {t('saveAngle')}
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

/** 1本分の、測り方・名前の選択と保存した測定 */
export type AngleSide = {
  /** 「A」「B」 */
  video: string;
  /** 日付（画面に出す文） */
  title: string;
  angles: Angle[];
  name: AngleName;
  kind: AngleKind;
  /** 測り始められるか（読み込めて、縦横が分かり、ほかで打っていない） */
  canMeasure: boolean;
  /** この動画で打っている途中か（測り方は変えられない） */
  drafting: boolean;
};

/**
 * 角度のカード。1本ごとに測り方（3点の角度・垂直からの傾き）と名前を選んで「測る」を押し、
 * 保存した測定を時刻の順に並べる（押すとそのコマへ動かし、ごみ箱で消す）。下に、同じ名前・同じ測り方どうしの
 * A・B・B − A を並べる（時間の目印のあいだの時間と同じ形）
 */
export function AnglesCard({
  sides,
  seconds,
  error,
  onKind,
  onName,
  onMeasure,
  onSeek,
  onRemove,
}: {
  sides: Record<'a' | 'b', AngleSide>;
  seconds: (value: number) => string;
  error: string | null;
  onKind: (key: 'a' | 'b', kind: AngleKind) => void;
  onName: (key: 'a' | 'b', name: AngleName) => void;
  onMeasure: (key: 'a' | 'b') => void;
  onSeek: (key: 'a' | 'b', time: number) => void;
  onRemove: (key: 'a' | 'b', angle: Angle) => void;
}) {
  const t = useTranslations('compare');
  const degreesValue = useDegrees();
  const label = useAngleLabel();
  const rows = compareAngles(sides.a.angles, sides.b.angles);

  return (
    <Card className="flex flex-col gap-4">
      <CardTitle>{t('angles')}</CardTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        {(['a', 'b'] as const).map((key) => {
          const side = sides[key];
          return (
            <div key={key} className="flex min-w-0 flex-col gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <Badge tone={key === 'a' ? 'neutral' : 'accent'}>{side.video}</Badge>
                <span className="truncate text-sm font-bold">{side.title}</span>
              </span>
              <div
                className={SEGMENTS}
                role="radiogroup"
                aria-label={t('kindOf', { video: side.video })}
              >
                {ANGLE_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    role="radio"
                    aria-checked={side.kind === kind}
                    disabled={side.drafting}
                    className={segmentClass(side.kind === kind)}
                    onClick={() => onKind(key, kind)}
                  >
                    {t(`kinds.${kind}`)}
                  </button>
                ))}
              </div>
              <div
                className={SEGMENT_GRID}
                role="radiogroup"
                aria-label={t('angleNameOf', { video: side.video })}
              >
                {ANGLE_NAMES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="radio"
                    aria-checked={side.name === name}
                    className={segmentClass(side.name === name)}
                    onClick={() => onName(key, name)}
                  >
                    {t(`angleNames.${name}`)}
                  </button>
                ))}
              </div>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                className="self-start"
                disabled={!side.canMeasure}
                onClick={() => onMeasure(key)}
              >
                {t('measure', { video: side.video })}
              </Button>
              {side.angles.length > 0 && (
                <ul className="flex flex-col divide-y divide-border">
                  {side.angles.map((angle) => (
                    <li key={angle.id} className="flex items-center gap-2">
                      {/* 押すとそのコマへ動かし、線を重ねて見せる */}
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 text-left"
                        onClick={() => onSeek(key, angle.time)}
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-bold">
                            {label(angle.name, angle.kind)}
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {seconds(angle.time)}
                          </span>
                        </span>
                        <span className="text-sm font-bold tabular-nums">
                          {t('degrees', { value: degreesValue(angle.degrees)?.value ?? '' })}
                        </span>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        aria-label={t('removeAngle', {
                          angle: label(angle.name, angle.kind),
                          video: side.video,
                        })}
                        onClick={() => onRemove(key, angle)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <ErrorText>{error}</ErrorText>
      {rows.length === 0 ? (
        <EmptyState message={t('noAngles')} />
      ) : (
        <ul className="flex flex-col gap-4" aria-label={t('angleComparison')}>
          {rows.map((row) => (
            <li
              key={row.key}
              data-testid={`angle-${row.key}`}
              className="flex flex-col gap-2 lg:grid lg:grid-cols-4 lg:items-center lg:gap-3"
            >
              <span className="text-sm font-bold">
                {label(row.name, row.kind, row.count > 1 ? row.index : undefined)}
              </span>
              <div className="grid grid-cols-3 gap-3 lg:col-span-3">
                <Stat size="sm" value={degreesValue(row.a)} label={sides.a.video} />
                <Stat size="sm" value={degreesValue(row.b)} label={sides.b.video} />
                <Stat size="sm" value={degreesValue(row.diff, true)} label={t('difference')} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
