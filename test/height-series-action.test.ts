import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 試技を保存する Server Action（src/app/actions/today.ts の saveAttemptAction）の、高さごとの結果の扱い。DB は差し替える:
 * 1. 高さごとの結果があれば、記録は送られてきた値ではなく、いちばん高く越えた高さ
 * 2. 規則に合わない並び・何も越えていない結果は series.<理由> で弾き、書かない
 * 3. 走幅跳・三段跳では捨てる
 */

vi.mock('next/cache', () => ({ refresh: vi.fn() }));
vi.mock('@/lib/viewer', () => ({
  requireViewer: async () => ({ userId: 'me', name: 'Me', email: 'me@example.com', image: null }),
}));
const data = vi.hoisted(() => ({
  getProfile: vi.fn(async () => ({
    events: ['high_jump', 'long_jump'],
    timeZone: 'UTC',
  })),
  getAttempt: vi.fn(async () => null),
  addAttempt: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
  updateAttempt: vi.fn(async () => {}),
  deleteAttempt: vi.fn(async () => {}),
  saveDayLog: vi.fn(async () => {}),
}));
vi.mock('@/lib/data', () => data);

const { saveAttemptAction } = await import('@/app/actions/today');

const form = (fields: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries({
    id: '',
    day: '2026-10-01',
    event: 'high_jump',
    kind: 'competition',
    markM: '',
    ...fields,
  }))
    formData.set(key, value);
  return formData;
};

const json = (value: unknown) => JSON.stringify(value);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('saveAttemptAction の高さごとの結果', () => {
  it('記録はいちばん高く越えた高さ。送られてきた記録の値は使わない', async () => {
    const series = [
      { heightM: 1.8, trials: ['cleared'] },
      { heightM: 1.85, trials: ['missed', 'cleared'] },
      { heightM: 1.9, trials: ['missed', 'missed', 'missed'] },
    ];
    const result = await saveAttemptAction(
      null,
      form({ markM: '2.50', heightSeries: json(series) }),
    );
    expect({ result, saved: data.addAttempt.mock.calls[0]?.[1] }).toEqual({
      result: { ok: true },
      saved: expect.objectContaining({ markM: 1.85, heightSeries: series }),
    });
  });

  it('規則に合わない並びと、何も越えていない結果は理由を返して書かない', async () => {
    const results = [
      await saveAttemptAction(
        null,
        form({
          heightSeries: json([
            { heightM: 1.8, trials: ['missed', 'missed', 'passed'] },
            { heightM: 1.85, trials: ['missed', 'cleared'] },
          ]),
        }),
      ),
      await saveAttemptAction(
        null,
        form({ markM: '1.80', heightSeries: json([{ heightM: 1.8, trials: ['missed'] }]) }),
      ),
      await saveAttemptAction(null, form({ heightSeries: '{broken' })),
    ];
    expect({ results, writes: data.addAttempt.mock.calls.length }).toEqual({
      results: [
        // どの高さかは位置で返す（画面がその高さの名前で言う）。何も越えていないのは高さによらない
        { ok: false, error: 'series.afterElimination', row: 1 },
        { ok: false, error: 'series.noClear', row: null },
        { ok: false, error: 'generic' },
      ],
      writes: 0,
    });
  });

  it('走幅跳では高さごとの結果を捨て、入れた記録で保存する', async () => {
    const result = await saveAttemptAction(
      null,
      form({
        event: 'long_jump',
        markM: '6.10',
        heightSeries: json([{ heightM: 1.8, trials: ['cleared'] }]),
      }),
    );
    expect({ result, saved: data.addAttempt.mock.calls[0]?.[1] }).toEqual({
      result: { ok: true },
      saved: expect.objectContaining({ markM: 6.1, heightSeries: null }),
    });
  });
});
