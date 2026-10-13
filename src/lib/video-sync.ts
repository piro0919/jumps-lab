/**
 * 2本の動画を並べて見るときの、時刻の合わせ方（/videos/compare）。画面に依存しない計算だけを置く。
 *
 * それぞれの動画に「合わせる点」（踏み切りの瞬間など、その動画の中の秒）を1つ持たせ、
 * 2本の合わせる点が同じ時刻に来るように、共通の時間軸の上に並べる。
 * 共通の時間軸の 0 は、先に始まる方の頭。長さは、あとに終わる方の終わりまで。
 * 片方が始まる前と終わったあとは、その動画は頭か最後の1コマで止めておく
 */

/** 1本分。duration は長さ（秒）、sync は合わせる点（その動画の中の秒。決めていなければ 0 = 頭で揃える） */
export type Clip = { duration: number; sync: number };

export type Alignment = {
  /** 共通の時間軸の上で、A と B が始まる時刻（秒） */
  startA: number;
  startB: number;
  /** 共通の時間軸の長さ（秒） */
  length: number;
  /** 先に終わる方。同時なら null */
  endsFirst: 'a' | 'b' | null;
};

/** 終わりを同時とみなす差（秒）。小数の誤差で、同じ長さの動画を片方が先に終わると言わないように */
const SAME_END_SECONDS = 1e-6;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** 長さ。読み込む前（NaN）や配信中（Infinity）は 0 とみなす */
function lengthOf(duration: number): number {
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

/** 合わせる点は、その動画の長さの中に収める（長さが分からないうちは 0） */
function syncOf(clip: Clip): number {
  return clamp(Number.isFinite(clip.sync) ? clip.sync : 0, 0, lengthOf(clip.duration));
}

/** 2本を、合わせる点が同じ時刻に来るように並べる */
export function align(a: Clip, b: Clip): Alignment {
  const syncA = syncOf(a);
  const syncB = syncOf(b);
  const lead = Math.max(syncA, syncB);
  const startA = lead - syncA;
  const startB = lead - syncB;
  const endA = startA + lengthOf(a.duration);
  const endB = startB + lengthOf(b.duration);
  const endsFirst =
    Math.abs(endA - endB) < SAME_END_SECONDS ? null : endA < endB ? ('a' as const) : ('b' as const);
  return { startA, startB, length: Math.max(endA, endB), endsFirst };
}

/** 共通の時間軸の時刻を、1本の動画の中の秒にする。始まる前は頭、終わったあとは最後 */
export function toLocal(shared: number, start: number, duration: number): number {
  return clamp(shared - start, 0, lengthOf(duration));
}

/** 1本の動画の中の秒を、共通の時間軸の時刻にする */
export function toShared(local: number, start: number): number {
  return local + start;
}

/** その時刻に、その動画が動いている（頭や最後で止まっていない）か */
export function isPlaying(shared: number, start: number, duration: number): boolean {
  return shared >= start && shared < start + duration;
}

/** コマの速さが分からないときに見なす値（スマホの動画のふつうの速さ） */
export const DEFAULT_FPS = 30;
/** コマの間隔として受け入れる範囲。外れた値（シークの跳び・止まっていた分）は数えない */
const MIN_FPS = 15;
const MAX_FPS = 240;

/**
 * 続けて描いた2コマの、動画の中の時刻の差から、コマの速さを見積もる。
 * 受け入れる範囲の外なら null（シークで跳んだ、コマが落ちたなど）
 */
export function fpsFromInterval(interval: number): number | null {
  if (!(interval > 0)) return null;
  const fps = 1 / interval;
  return fps >= MIN_FPS && fps <= MAX_FPS ? Math.round(fps) : null;
}

/** 1コマ進める（direction 1）か戻す（-1）。共通の時間軸の中に収める */
export function stepFrame(shared: number, direction: 1 | -1, fps: number, length: number): number {
  return clamp(shared + direction / (fps > 0 ? fps : DEFAULT_FPS), 0, lengthOf(length));
}
