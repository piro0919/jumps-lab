import { describe, expect, it } from 'vitest';
import {
  checkSeries,
  hasHeightSeries,
  heightSeriesSchema,
  nextHeight,
  summarize,
  trialSymbols,
  type HeightSeries,
  type Trial,
} from '@/lib/height-series';
import { formatMark, metersToFeetInches } from '@/lib/units';

/**
 * 走高跳・棒高跳の高さごとの結果の規則（World Athletics Technical Rules TR26.2・26.3・26.8）。
 * 記号は記録用紙と同じ O（成功）・X（失敗）・-（パス）で書いて、ここで結果に直す
 */
const TRIAL_OF: Record<string, Trial> = { O: 'cleared', X: 'missed', '-': 'passed' };

/** 「1.80:O 1.85:XO」の形から結果を作る */
function series(text: string): HeightSeries {
  return text.split(' ').map((part) => {
    const [height, marks = ''] = part.split(':');
    return { heightM: Number(height), trials: [...marks].map((m) => TRIAL_OF[m]!) };
  });
}

/** 弾いた理由と高さ（通れば ok） */
function verdict(text: string) {
  const s = series(text);
  const result = checkSeries(s);
  return result.ok ? 'ok' : `${result.error}@${s[result.index]!.heightM}`;
}

describe('checkSeries', () => {
  it('規則どおりの並びは通る（パスは失敗のあとでもよい。TR26.2 の注）', () => {
    const valid = [
      '1.80:O',
      '1.80:O 1.85:XO 1.90:XXO 1.95:XXX',
      '1.80:- 1.85:O',
      '1.80:O 1.85:X- 1.90:O',
      '1.80:O 1.85:XX- 1.90:O',
      // 最後の高さは途中でやめてもよい（優勝が決まった・棄権）
      '1.80:O 1.85:X',
      // 高さをまたいで2回続けて失敗しても、3回目でなければ続けられる
      '1.80:O 1.85:X- 1.90:XO',
    ];
    expect(valid.map(verdict)).toEqual(valid.map(() => 'ok'));
  });

  it('続けて3回の失敗は、高さをまたいでも競技の終わり（TR26.2）', () => {
    expect(
      [
        '1.80:O 1.85:XXX 1.90:O',
        '1.80:O 1.85:XX- 1.90:XO',
        '1.80:O 1.85:X- 1.90:X- 1.95:XO',
        '1.80:O 1.85:XX- 1.90:X 1.95:O',
      ].map(verdict),
    ).toEqual([
      'afterElimination@1.85',
      'afterElimination@1.9',
      'afterElimination@1.95',
      'afterElimination@1.9',
    ]);
  });

  it('3回目の失敗で終わる並びは、高さをまたいでいても通る', () => {
    expect(['1.80:O 1.85:XX- 1.90:X', '1.80:O 1.85:X- 1.90:X- 1.95:X'].map(verdict)).toEqual([
      'ok',
      'ok',
    ]);
  });

  it('成功・パスのあとは同じ高さで跳べない（TR26.3）。失敗のまま次の高さへは進めない', () => {
    expect(
      ['1.80:OX', '1.80:-O', '1.80:X-X', '1.80:X 1.85:O', '1.80:O 1.85:XX 1.90:O'].map(verdict),
    ).toEqual([
      'afterEnd@1.8',
      'afterEnd@1.8',
      'afterEnd@1.8',
      'unfinished@1.8',
      'unfinished@1.85',
    ]);
  });

  it('高さは低い順で同じ高さは2度出ない。範囲の外と結果の無い高さも弾く', () => {
    expect(
      ['1.80:O 1.80:O', '1.85:O 1.80:O', '0.40:O', '7.10:O', '1.80:O 1.85:'].map(verdict),
    ).toEqual([
      'heightOrder@1.8',
      'heightOrder@1.8',
      'heightRange@0.4',
      'heightRange@7.1',
      'noTrials@1.85',
    ]);
  });

  it('どの高さも越えていなければ保存できない（記録が無い）', () => {
    expect(['1.80:XXX', '1.80:- 1.85:XX- 1.90:X'].map(verdict)).toEqual([
      'noClear@1.8',
      'noClear@1.8',
    ]);
  });
});

describe('summarize', () => {
  it('記録はいちばん高く越えた高さ。失敗はその高さでの数と、その高さまでの合計（TR26.8）', () => {
    expect(summarize(series('1.80:O 1.85:XO 1.90:X- 1.95:XXO 2.00:XXX'))).toEqual({
      bestM: 1.95,
      missesAtBest: 2,
      // 2.00 の3回は越えた高さより後なので数えない
      missesTotal: 4,
      eliminated: true,
    });
  });

  it('越えた高さが無ければ記録は null、失敗の数は 0', () => {
    expect(summarize(series('1.80:XX- 1.85:X'))).toEqual({
      bestM: null,
      missesAtBest: 0,
      missesTotal: 0,
      eliminated: true,
    });
  });
});

describe('nextHeight', () => {
  it('メートルは 3cm（走高跳）・10cm（棒高跳）上げ、センチに丸める', () => {
    expect([
      nextHeight('high_jump', 'metric', 1.8),
      nextHeight('pole_vault', 'metric', 4.2),
      // フィート・インチで入れた 6' 0¾" の次も、センチの高さにする
      nextHeight('high_jump', 'metric', 1.8478),
    ]).toEqual([1.83, 4.3, 1.88]);
  });

  it('フィート・インチは 1 インチ（走高跳）・6 インチ（棒高跳）上げ、4分の1インチの刻みのまま', () => {
    const shown = (meters: number) => formatMark(meters, 'imperial');
    expect([
      shown(nextHeight('high_jump', 'imperial', 1.8288)),
      shown(nextHeight('high_jump', 'imperial', 1.8478)),
      shown(nextHeight('pole_vault', 'imperial', 4.2672)),
      // 11 インチの次は 12 インチではなく、次のフィート
      metersToFeetInches(nextHeight('high_jump', 'imperial', 1.8034)),
    ]).toEqual([`6' 1"`, `6' 1¾"`, `14' 6"`, { feet: 6, inches: 0 }]);
  });
});

describe('heightSeriesSchema', () => {
  it('空と高さ0個は null、JSON の文字は読み、高さは 0.1mm に丸める', () => {
    const parse = (value: unknown) => heightSeriesSchema.safeParse(value);
    expect(
      [
        parse(''),
        parse(undefined),
        parse('[]'),
        parse('[{"heightM":1.80004,"trials":["missed","cleared"]}]'),
      ].map((r) => r.data),
    ).toEqual([null, null, null, [{ heightM: 1.8, trials: ['missed', 'cleared'] }]]);
  });

  it('壊れた JSON、知らない結果、4つ以上の結果、高さの無い行、41 個の高さは弾く', () => {
    const many = JSON.stringify(
      Array.from({ length: 41 }, (_, i) => ({ heightM: 1 + i / 100, trials: ['cleared'] })),
    );
    const bad = [
      '[{"heightM":1.8,',
      '[{"heightM":1.8,"trials":["o"]}]',
      '[{"heightM":1.8,"trials":["missed","missed","missed","missed"]}]',
      '[{"heightM":null,"trials":["cleared"]}]',
      many,
    ];
    expect(bad.map((value) => heightSeriesSchema.safeParse(value).success)).toEqual(
      bad.map(() => false),
    );
  });
});

describe('表示と種目', () => {
  it('結果は記録用紙と同じ O・X・– で書き、高さごとの結果は走高跳と棒高跳だけ', () => {
    expect({
      symbols: trialSymbols(['missed', 'missed', 'passed']),
      events: (['high_jump', 'long_jump', 'triple_jump', 'pole_vault'] as const).filter(
        hasHeightSeries,
      ),
    }).toEqual({ symbols: 'XX–', events: ['high_jump', 'pole_vault'] });
  });
});
