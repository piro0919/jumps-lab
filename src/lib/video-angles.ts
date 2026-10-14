import { z } from 'zod';
import { ANGLE_FRAME_MAX_PX } from '@/lib/limits';
import { MARK_MAX_SECONDS, roundToMs } from '@/lib/video-marks';

/**
 * 動画の上で手で測る角度（2026-10-14 に本人から任された）。AI の骨格推定は手持ちの動画で使えなかったので
 * （CLAUDE.md の「On hold: numbers from video」）、Kinovea と同じく、止めたコマの上に点を打って測る。
 *
 * 測り方は2つ。
 * - angle（3点の角度）: 3点を打ち、真ん中の点での角度（0〜180°）。膝なら 腰→膝→足首 の順に打つ
 * - lean（垂直からの傾き）: 2点を打ち、その線が垂直から何度傾いているか（0〜90°）。向きは付けない。
 *   助走の向き（右から左か、左から右か）とカメラの側で符号が入れ替わり、別の日の動画どうしで比べられなくなるため
 *
 * 点は動画の本来の幅と高さに対する割合（0〜1）で持つ。画面の大きさや、object-contain で上下・左右に空く帯
 * （レターボックス）に左右されず、どの画面でも同じ所に描ける。角度は割合のままではなく、本来の幅と高さを掛けた
 * ピクセルの上で求める（縦長の動画で縦と横の 0.1 は長さが違う）。
 * 画面とサーバーの両方から読むので server-only にしない。サーバーは送られた度数を使わず、点から求め直す
 */

export const ANGLE_NAMES = ['knee', 'hip', 'trunk', 'shin', 'arm', 'other'] as const;
export type AngleName = (typeof ANGLE_NAMES)[number];

export const ANGLE_KINDS = ['angle', 'lean'] as const;
export type AngleKind = (typeof ANGLE_KINDS)[number];

/** 測り方ごとの点の数 */
const THREE_POINTS = 3;
export const POINTS_NEEDED: Record<AngleKind, number> = { angle: THREE_POINTS, lean: 2 };

/** 動画の中の位置（本来の幅・高さに対する割合、0〜1） */
export type Point = { x: number; y: number };
/** 大きさ（ピクセル） */
export type Size = { width: number; height: number };
/** 画面の上の長方形（ピクセル） */
export type Rect = { x: number; y: number; width: number; height: number };

/** 保存してある1つの測定 */
export type Angle = {
  id: string;
  name: AngleName;
  kind: AngleKind;
  /** 動画の中の秒（ミリ秒まで） */
  time: number;
  points: Point[];
  /** 打ったときの動画の本来の幅と高さ（角度をピクセルの上で求め直すため） */
  frameWidth: number;
  frameHeight: number;
  degrees: number;
};

const HALF_TURN_DEGREES = 180;
const toDegrees = (radians: number) => (radians * HALF_TURN_DEGREES) / Math.PI;

/** 度を小数第1位に丸める（手で打つ点のずれは 1° より大きいので、それより細かくは持たない） */
const DEGREE_STEP = 10;
const roundDegrees = (degrees: number) => Math.round(degrees * DEGREE_STEP) / DEGREE_STEP;

/** 真ん中の点 vertex での、a と c のあいだの角度（0〜180°）。どちらかが vertex と重なれば null */
export function angleAt(a: Point, vertex: Point, c: Point): number | null {
  const ux = a.x - vertex.x;
  const uy = a.y - vertex.y;
  const wx = c.x - vertex.x;
  const wy = c.y - vertex.y;
  if ((ux === 0 && uy === 0) || (wx === 0 && wy === 0)) return null;
  // acos より atan2 の方が 0° と 180° の近くでずれない
  return toDegrees(Math.atan2(Math.abs(ux * wy - uy * wx), ux * wx + uy * wy));
}

/** p と q を結ぶ線の、垂直からの傾き（0〜90°、向きは付けない）。2点が重なれば null */
export function leanFromVertical(p: Point, q: Point): number | null {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  if (dx === 0 && dy === 0) return null;
  return toDegrees(Math.atan2(Math.abs(dx), Math.abs(dy)));
}

/**
 * 割合の点から度数を求める（本来の幅と高さを掛けたピクセルの上で）。小数第1位に丸める。
 * 点の数が足りない・点が重なって決まらないときは null
 */
export function measure(kind: AngleKind, points: Point[], frame: Size): number | null {
  if (points.length !== POINTS_NEEDED[kind] || frame.width <= 0 || frame.height <= 0) return null;
  const px = points.map((p) => ({ x: p.x * frame.width, y: p.y * frame.height }));
  const [first, second, third] = px;
  if (!first || !second) return null;
  const degrees =
    kind === 'angle'
      ? third
        ? angleAt(first, second, third)
        : null
      : leanFromVertical(first, second);
  return degrees === null ? null : roundDegrees(degrees);
}

/**
 * object-fit: contain で、要素の箱（box）の中に動画の絵が描かれる長方形。縦横の比を保って箱に収め、
 * 余った方向の両側に同じ幅の帯が空く（レターボックス）
 */
export function contentBox(box: Size, frame: Size): Rect | null {
  if (box.width <= 0 || box.height <= 0 || frame.width <= 0 || frame.height <= 0) return null;
  const scale = Math.min(box.width / frame.width, box.height / frame.height);
  const width = frame.width * scale;
  const height = frame.height * scale;
  return { x: (box.width - width) / 2, y: (box.height - height) / 2, width, height };
}

/** 箱の左上からの位置（ピクセル）を、動画の中の割合にする。絵の外（帯の上）なら null */
export function toNormalized(x: number, y: number, box: Size, frame: Size): Point | null {
  const content = contentBox(box, frame);
  if (!content) return null;
  const nx = (x - content.x) / content.width;
  const ny = (y - content.y) / content.height;
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
  return { x: nx, y: ny };
}

/** 動画の中の割合を、箱の左上からの位置（ピクセル）にする */
export function toDisplay(point: Point, box: Size, frame: Size): { x: number; y: number } | null {
  const content = contentBox(box, frame);
  if (!content) return null;
  return { x: content.x + point.x * content.width, y: content.y + point.y * content.height };
}

/** ミリ秒に丸めた時刻のずれを許す幅（秒） */
const MS_SLACK = 0.0005;

/** 動画の今の位置が、測ったコマ（time）から1コマ以内か */
export function atFrame(time: number, current: number, fps: number): boolean {
  return Math.abs(time - current) <= 1 / fps + MS_SLACK;
}

/** 見比べる1行。a・b はそれぞれの度数（無ければ null）、diff は B − A（両方あるときだけ） */
export type AngleRow = {
  key: string;
  name: AngleName;
  kind: AngleKind;
  /** 同じ名前と測り方の何番目か（1から）。count が 1 なら番号は出さない */
  index: number;
  count: number;
  a: number | null;
  b: number | null;
  diff: number | null;
};

/**
 * 2本の測定を、同じ名前・同じ測り方どうしで並べる。1本に同じものがいくつもあれば、時刻の順に1番目どうし、
 * 2番目どうしを比べる（仮決め）。並びは名前の決まった順、3点の角度、傾きの順
 */
export function compareAngles(a: Angle[], b: Angle[]): AngleRow[] {
  const byTime = (list: Angle[], name: AngleName, kind: AngleKind) =>
    list
      .filter((m) => m.name === name && m.kind === kind)
      .toSorted((x, y) => x.time - y.time)
      .map((m) => m.degrees);
  return ANGLE_NAMES.flatMap((name) =>
    ANGLE_KINDS.flatMap((kind) => {
      const listA = byTime(a, name, kind);
      const listB = byTime(b, name, kind);
      const count = Math.max(listA.length, listB.length);
      return Array.from({ length: count }, (_, i) => {
        const valueA = listA[i] ?? null;
        const valueB = listB[i] ?? null;
        return {
          key: `${name}-${kind}-${i + 1}`,
          name,
          kind,
          index: i + 1,
          count,
          a: valueA,
          b: valueB,
          diff: valueA !== null && valueB !== null ? roundDegrees(valueB - valueA) : null,
        };
      });
    }),
  );
}

const pointSchema = z.object({
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
});

const frameSide = z.number().int().min(1).max(ANGLE_FRAME_MAX_PX);

/** 測定を1つ保存するときの入力。度数は受け取らず、サーバーが点から求める */
export const angleInputSchema = z
  .object({
    videoId: z.uuid(),
    name: z.enum(ANGLE_NAMES),
    kind: z.enum(ANGLE_KINDS),
    time: z.number().finite().min(0).max(MARK_MAX_SECONDS).transform(roundToMs),
    points: z.array(pointSchema),
    frameWidth: frameSide,
    frameHeight: frameSide,
  })
  .refine((input) => input.points.length === POINTS_NEEDED[input.kind], { path: ['points'] });

export type AngleInput = z.input<typeof angleInputSchema>;
