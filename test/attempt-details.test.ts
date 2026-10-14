import { describe, expect, it } from 'vitest';
import {
  attemptDetailsSchema,
  detailFieldsFor,
  EMPTY_DETAILS,
  hasDetails,
  keepDetailsFor,
} from '@/lib/attempt-details';

/**
 * 試技の細かい記録（src/lib/attempt-details.ts）。種目に合う欄だけを持ち、送られた値は画面と同じ範囲で確かめる
 */

const everything = {
  approachSteps: 16,
  approachLengthM: 38.4,
  boardOffsetCm: 4,
  poleLengthM: 4.57,
  poleStiffnessLb: 160,
  gripHeightM: 4.3,
  standardsCm: 60,
};

describe('種目ごとの欄', () => {
  it('走高跳は助走だけ、走幅跳と三段跳は踏切板も、棒高跳はポールの欄も持つ', () => {
    expect({
      high_jump: detailFieldsFor('high_jump'),
      long_jump: detailFieldsFor('long_jump'),
      triple_jump: detailFieldsFor('triple_jump'),
      pole_vault: detailFieldsFor('pole_vault'),
    }).toEqual({
      high_jump: ['approachSteps', 'approachLengthM'],
      long_jump: ['approachSteps', 'approachLengthM', 'boardOffsetCm'],
      triple_jump: ['approachSteps', 'approachLengthM', 'boardOffsetCm'],
      pole_vault: [
        'approachSteps',
        'approachLengthM',
        'poleLengthM',
        'poleStiffnessLb',
        'gripHeightM',
        'standardsCm',
      ],
    });
  });

  it('種目に合わない欄は空にする', () => {
    expect(keepDetailsFor('high_jump', everything)).toEqual({
      ...EMPTY_DETAILS,
      approachSteps: 16,
      approachLengthM: 38.4,
    });
    expect(keepDetailsFor('long_jump', everything)).toEqual({
      ...EMPTY_DETAILS,
      approachSteps: 16,
      approachLengthM: 38.4,
      boardOffsetCm: 4,
    });
    expect(keepDetailsFor('pole_vault', everything)).toEqual({
      ...everything,
      boardOffsetCm: null,
    });
  });

  it('1つでも入っていれば hasDetails（0 も入っている）', () => {
    expect([hasDetails(EMPTY_DETAILS), hasDetails({ ...EMPTY_DETAILS, standardsCm: 0 })]).toEqual([
      false,
      true,
    ]);
  });
});

describe('送られた値の検査', () => {
  const parse = (form: Record<string, string | undefined>) => attemptDetailsSchema.safeParse(form);

  it('空の欄と送られなかった欄は null、数は数に直す', () => {
    expect(parse({ approachSteps: '18', boardOffsetCm: '-2.5', standardsCm: '' }).data).toEqual({
      ...EMPTY_DETAILS,
      approachSteps: 18,
      boardOffsetCm: -2.5,
    });
  });

  it('範囲の外と、歩数・ポンドの小数を弾く', () => {
    const bad = [
      { approachSteps: '0' },
      { approachSteps: '31' },
      { approachSteps: '12.5' },
      { approachLengthM: '60.01' },
      { boardOffsetCm: '-30.1' },
      { boardOffsetCm: '100.1' },
      { poleLengthM: '1.99' },
      { poleStiffnessLb: '150.5' },
      { poleStiffnessLb: '251' },
      { gripHeightM: '6.01' },
      { standardsCm: '80.5' },
      { standardsCm: 'abc' },
    ];
    expect(bad.map((form) => parse(form).success)).toEqual(bad.map(() => false));
  });

  it('境目の値は通す', () => {
    const edges = [
      { approachSteps: '1', approachLengthM: '60', boardOffsetCm: '-30' },
      { approachSteps: '30', approachLengthM: '1', boardOffsetCm: '100' },
      { poleLengthM: '6', poleStiffnessLb: '250', gripHeightM: '6', standardsCm: '80' },
      { poleLengthM: '2', poleStiffnessLb: '50', gripHeightM: '1', standardsCm: '0' },
    ];
    expect(edges.map((form) => parse(form).success)).toEqual(edges.map(() => true));
  });

  it('グリップがポールより高いと grip で弾く', () => {
    const result = parse({ poleLengthM: '4.5', gripHeightM: '4.6' });
    expect(result.error?.issues.map((i) => i.message)).toEqual(['grip']);
  });
});
