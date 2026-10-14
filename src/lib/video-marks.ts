import { z } from 'zod';

/**
 * 動画の時間の目印（2026-10-14 に本人と決めた）。中元さんの弟さんが見たかった「いつもより踏み切りが遅い」
 * 「助走のリズムがいつもより速い・遅い」は、どちらも時間の差なので、動画の上で時刻を測る（AI は使わない）。
 * 距離は測らない（縮尺の合わせと、真横からの動画が要る）。
 *
 * 目印は4種目に共通の決まった6つ。助走のある跳躍はどれも「助走の始まり → 最後の数歩 → 踏み切り → 着地」の順に進む。
 * 歩（step3・step2・step1）と踏み切り（takeoff）は、どれも足が地面に着いた瞬間で揃える
 * （踏み切りは踏み切る足が着いた瞬間）。着いた瞬間どうしの差が、1歩の時間（助走のリズム）になる。
 * 三段跳のホップとステップの着地、棒高跳の突っ込みは置かない（仮決め。欲しいと言われたら足す）。
 * 画面に依存しない計算と、保存する値の検査だけを置く（画面とサーバーの両方から読むので server-only にしない）
 */
export const MARKS = ['start', 'step3', 'step2', 'step1', 'takeoff', 'landing'] as const;
export type MarkName = (typeof MARKS)[number];

/** 1本の目印。目印の名前 → その動画の中の秒（ミリ秒まで） */
export type Marks = Partial<Record<MarkName, number>>;

/** 1秒のミリ秒の数。秒とミリ秒の行き来は toMs・fromMs・roundToMs を使う（目印・角度・見比べる画面の時計で共通） */
const MS_PER_SECOND = 1000;

/**
 * 目印に置ける時刻の上限（秒）。長さは送る前に画面で読めたときだけ確かめるので（MediaRecorder の webm は
 * 長さを持たない）、60 秒を少し超える動画もありうる。上限はでたらめな値を止めるためだけに、広めに取る
 */
export const MARK_MAX_SECONDS = 600;

/** 秒を、整数のミリ秒にする（DB の "timeMs" へ書くとき） */
export function toMs(seconds: number): number {
  return Math.round(seconds * MS_PER_SECOND);
}

/** ミリ秒を秒にする */
export function fromMs(ms: number): number {
  return ms / MS_PER_SECOND;
}

/** ミリ秒に丸める */
export function roundToMs(seconds: number): number {
  return fromMs(toMs(seconds));
}

/** 目印を1つ置く（time が null なら外す）ときの入力。置き直すと上書きする */
export const markInputSchema = z.object({
  videoId: z.uuid(),
  mark: z.enum(MARKS),
  time: z.number().finite().min(0).max(MARK_MAX_SECONDS).transform(roundToMs).nullable(),
});

export type MarkInput = z.input<typeof markInputSchema>;

/** DB から読んだ値を目印にする。知らない名前や数でない値は捨てる（壊れた行で画面を落とさない） */
export function toMarks(value: unknown): Marks {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const marks: Marks = {};
  for (const name of MARKS) {
    const time = (value as Record<string, unknown>)[name];
    if (typeof time === 'number' && Number.isFinite(time) && time >= 0) marks[name] = time;
  }
  return marks;
}

/** 決まった順で、まだ置いていない最初の目印。全部置いてあれば最後の1つ */
export function nextMark(marks: Marks, after?: MarkName): MarkName {
  const from = after === undefined ? 0 : MARKS.indexOf(after) + 1;
  return (
    MARKS.slice(from).find((name) => marks[name] === undefined) ??
    MARKS.find((name) => marks[name] === undefined) ??
    'landing'
  );
}

/** 2つの目印のあいだ。seconds は to − from（秒） */
export type Interval = { from: MarkName; to: MarkName; seconds: number };

/**
 * 置いてある目印を決まった順に並べ、隣どうしのあいだの時間を出す（抜けている目印は飛ばして隣とみなす）。
 * 順が逆になっている（後の目印の方が早い）あいだは出さない。置き間違いを数として見せない（仮決め）
 */
export function intervals(marks: Marks): Interval[] {
  const placed = MARKS.flatMap((name) => {
    const time = marks[name];
    return time === undefined ? [] : [{ name, time }];
  });
  return placed.slice(1).flatMap((to, i) => {
    const from = placed[i];
    if (!from) return [];
    const seconds = roundToMs(to.time - from.time);
    return seconds > 0 ? [{ from: from.name, to: to.name, seconds }] : [];
  });
}

/** 助走の時間（助走の始まりから踏み切りまで）。どちらかが無いか、順が逆なら null */
export function approachTime(marks: Marks): number | null {
  if (marks.start === undefined || marks.takeoff === undefined) return null;
  const seconds = roundToMs(marks.takeoff - marks.start);
  return seconds > 0 ? seconds : null;
}

/** 見比べる1行。a・b はそれぞれのあいだの時間（無ければ null）、diff は B − A（両方あるときだけ） */
export type IntervalRow = {
  /** 助走の時間の行は 'approach'、それ以外は隣どうしの目印 */
  key: string;
  from: MarkName;
  to: MarkName;
  a: number | null;
  b: number | null;
  diff: number | null;
};

const order = (name: MarkName) => MARKS.indexOf(name);

/** 助走の時間の目印の組（始まり → 踏み切り） */
const APPROACH_PAIR = 'start-takeoff';

/**
 * 2本のあいだの時間を、同じ目印の組どうしで並べる。どちらか一方にしかない組も、片方を空にして出す。
 * 並びは目印の決まった順で、最後に助走の時間（始まり → 踏み切り）を置く
 */
export function compareIntervals(a: Marks, b: Marks): IntervalRow[] {
  const rows = new Map<string, IntervalRow>();
  const add = (side: 'a' | 'b', list: Interval[]) => {
    for (const { from, to, seconds } of list) {
      const key = `${from}-${to}`;
      // 始まりと踏み切りが隣どうしなら、それは助走の時間そのもの。助走の行にまとめる
      if (key === APPROACH_PAIR) continue;
      const row = rows.get(key) ?? { key, from, to, a: null, b: null, diff: null };
      row[side] = seconds;
      rows.set(key, row);
    }
  };
  add('a', intervals(a));
  add('b', intervals(b));
  const sorted = [...rows.values()].toSorted(
    (x, y) => order(x.from) - order(y.from) || order(x.to) - order(y.to),
  );
  const approachA = approachTime(a);
  const approachB = approachTime(b);
  if (approachA !== null || approachB !== null) {
    sorted.push({
      key: 'approach',
      from: 'start',
      to: 'takeoff',
      a: approachA,
      b: approachB,
      diff: null,
    });
  }
  return sorted.map((row) => ({
    ...row,
    diff: row.a !== null && row.b !== null ? roundToMs(row.b - row.a) : null,
  }));
}
