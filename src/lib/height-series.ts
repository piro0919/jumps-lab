import { z } from 'zod';
import type { JumpEvent } from '@/lib/events';
import { BAR_HEIGHT_MAX_M, BAR_HEIGHT_MIN_M, HEIGHT_SERIES_MAX_ROWS } from '@/lib/limits';
import { feetInchesToMeters, metersToFeetInches, TENTH_MM_PER_M, type Units } from '@/lib/units';

/**
 * 走高跳と棒高跳の、高さごとの結果（○×–。2026-10-14 に本人から任された）。
 * 規則は World Athletics の Technical Rules（Book C – C2.1）の TR26 を読んで合わせた
 * （https://worldathletics.org/download/download?filename=92a127cb-d569-4db3-88e8-370e634ab2cd.pdf&urlslug=C2.1%2B-%2BTechnical%2BRules）:
 * - TR26.2 どの高さから始めてもよい。続けて3回の失敗で、それより先は跳べない。失敗は高さをまたいでも数える
 *   （「regardless of the height at which any of such failures occur」）
 * - TR26.2 の注 1回目・2回目に失敗したあと、その高さの残りをパスして次の高さへ進める（×– や ××–）
 * - TR26.3 ある高さでパスしたら、その高さではもう跳べない
 * - TR26.8 同じ高さで並んだら、(1) その高さで跳んだ回数の少ないほう、(2) その高さまで（その高さを含む）の失敗の
 *   合計の少ないほうを上にする。画面に出す2つの失敗の数はこの2つ
 * 決勝の同順位の跳躍（ジャンプオフ、TR26.9）は残さない（v1 では入れない）
 */

/** 1回ごとの結果。cleared は成功、missed は失敗、passed はその高さの残りをパス */
const TRIALS = ['cleared', 'missed', 'passed'] as const;
export type Trial = (typeof TRIALS)[number];

/** 1つの高さ。heightM はメートル（記録と同じく 0.1mm まで） */
type HeightRow = { heightM: number; trials: Trial[] };

/** 高さの低い順 */
export type HeightSeries = HeightRow[];

/**
 * 結果の記号。世界のどの記録用紙も O（成功）、X（失敗）、-（パス）で書く（World Athletics の結果も同じ）。
 * 国で意味の変わる ○ や ✓ ではなく、この3つを使う。パスは見やすいよう en ダッシュにする
 */
export const TRIAL_SYMBOL: Record<Trial, string> = { cleared: 'O', missed: 'X', passed: '–' };

/** 1つの高さで跳べる回数（TR26.2） */
export const TRIALS_PER_HEIGHT = 3;

/** 続けてこの回数失敗すると、それより先は跳べない（TR26.2） */
const ELIMINATION_MISSES = 3;

/** 高さごとの結果を持てる種目 */
const VERTICAL_EVENTS: readonly JumpEvent[] = ['high_jump', 'pole_vault'];

export function hasHeightSeries(event: JumpEvent): boolean {
  return VERTICAL_EVENTS.includes(event);
}

/**
 * 次の高さを出すときの上げ幅のはじめの値（欄は書き換えられる）。メートルは 3cm（走高跳）と 10cm（棒高跳）、
 * フィート・インチは 1 インチと 6 インチ（米国の学校の大会で多い上げ幅。どちらも仮決め）
 */
const HJ_STEP = 0.03;
const PV_STEP = 0.1;
const HJ_STEP_IN = 1;
const PV_STEP_IN = 6;

const CM_PER_M = 100;

/**
 * 前の高さの次に出す高さ（メートル）。メートルの人はセンチに丸め、フィート・インチの人は
 * 4分の1インチの刻みのまま上げ幅を足す（欄に出す値と送る値が同じになるように）
 */
export function nextHeight(event: JumpEvent, units: Units, lastM: number): number {
  if (units === 'metric') {
    const step = event === 'pole_vault' ? PV_STEP : HJ_STEP;
    return Math.round((lastM + step) * CM_PER_M) / CM_PER_M;
  }
  const { feet, inches } = metersToFeetInches(lastM);
  const step = event === 'pole_vault' ? PV_STEP_IN : HJ_STEP_IN;
  return feetInchesToMeters({ feet, inches: inches + step });
}

/** 弾く理由（errors.series.*）。index はその理由の高さの位置 */
export type SeriesError =
  /** 高さが低い順になっていない（同じ高さが2つも含む） */
  | 'heightOrder'
  /** 高さが範囲の外 */
  | 'heightRange'
  /** 結果の無い高さ */
  | 'noTrials'
  /** 成功やパスのあとに、同じ高さでまだ跳んでいる */
  | 'afterEnd'
  /** 失敗のまま（成功もパスもせず）次の高さへ進んでいる */
  | 'unfinished'
  /** 続けて3回失敗したあとに、まだ跳んでいる */
  | 'afterElimination'
  /** どの高さも越えていない。記録が無いので保存できない */
  | 'noClear';

export type SeriesSummary = {
  /** 越えたいちばん高い高さ。無ければ null */
  bestM: number | null;
  /** いちばん高く越えた高さでの失敗の数（TR26.8.1） */
  missesAtBest: number;
  /** いちばん高く越えた高さまで（その高さを含む）の失敗の合計（TR26.8.2） */
  missesTotal: number;
  /** 続けて3回失敗して終わったか */
  eliminated: boolean;
};

/** 越えた高さと、同順位を分ける2つの失敗の数 */
export function summarize(series: HeightSeries): SeriesSummary {
  let bestIndex = -1;
  let consecutive = 0;
  series.forEach((row, index) => {
    if (row.trials.includes('cleared')) bestIndex = index;
    for (const trial of row.trials) {
      if (trial === 'missed') consecutive += 1;
      if (trial === 'cleared') consecutive = 0;
    }
  });
  const misses = (row: HeightRow) => row.trials.filter((t) => t === 'missed').length;
  const best = series[bestIndex];
  return {
    bestM: best ? best.heightM : null,
    missesAtBest: best ? misses(best) : 0,
    missesTotal: series.slice(0, bestIndex + 1).reduce((sum, row) => sum + misses(row), 0),
    eliminated: consecutive >= ELIMINATION_MISSES,
  };
}

/**
 * 高さごとの結果が規則どおりかを確かめる。はじめに見つかった誤りと、その高さの位置を返す。
 * 何も越えていない（noClear）は形の誤りをすべて確かめてから返す
 */
export function checkSeries(
  series: HeightSeries,
): { ok: true; summary: SeriesSummary } | { ok: false; error: SeriesError; index: number } {
  let consecutive = 0;
  for (const [index, row] of series.entries()) {
    const fail = (error: SeriesError) => ({ ok: false as const, error, index });
    if (row.heightM < BAR_HEIGHT_MIN_M || row.heightM > BAR_HEIGHT_MAX_M)
      return fail('heightRange');
    if (index > 0 && row.heightM <= series[index - 1].heightM) return fail('heightOrder');
    if (row.trials.length === 0) return fail('noTrials');
    for (const [at, trial] of row.trials.entries()) {
      if (consecutive >= ELIMINATION_MISSES) return fail('afterElimination');
      // 成功とパスはその高さの最後（TR26.3）。2回目以降は前が失敗のときだけ跳べる
      if (at > 0 && row.trials[at - 1] !== 'missed') return fail('afterEnd');
      if (trial === 'missed') consecutive += 1;
      if (trial === 'cleared') consecutive = 0;
    }
    const last = row.trials[row.trials.length - 1];
    if (index < series.length - 1 && last === 'missed') {
      // 3回続けて失敗した高さの後ろに高さがあれば、続けて跳んだことになる
      return fail(consecutive >= ELIMINATION_MISSES ? 'afterElimination' : 'unfinished');
    }
  }
  const summary = summarize(series);
  if (summary.bestM === null) return { ok: false, error: 'noClear', index: 0 };
  return { ok: true, summary };
}

/** 1つの高さの結果を「XO」の形に */
export function trialSymbols(trials: readonly Trial[]): string {
  return trials.map((t) => TRIAL_SYMBOL[t]).join('');
}

/** メートルを DB と同じ 0.1mm に丸める */
const toTenthMm = (meters: number) => Math.round(meters * TENTH_MM_PER_M) / TENTH_MM_PER_M;

/**
 * 送られてきた高さごとの結果（フォームの隠しの欄の JSON）。空なら null。
 * 形だけをここで見て、規則は checkSeries で見る
 */
export const heightSeriesSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  },
  z
    .array(
      z.object({
        heightM: z.number().finite().transform(toTenthMm),
        trials: z.array(z.enum(TRIALS)).max(TRIALS_PER_HEIGHT),
      }),
    )
    .max(HEIGHT_SERIES_MAX_ROWS)
    // 高さが1つも無いのは「高さごとに入れていない」と同じ
    .transform((rows) => (rows.length === 0 ? null : rows))
    .nullable(),
);
