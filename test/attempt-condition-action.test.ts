import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 試技を足す画面で一緒に入れたその日のコンディション（src/app/actions/today.ts の saveAttemptAction）。DB は差し替える:
 * 1. 欄が送られてきたら、試技より先に「まだ無ければ入れる」で書く
 * 2. 欄が無ければ（閉じたまま）書かない。書き換えのときも書かない
 * 3. 範囲の外なら試技も書かない
 * 4. 天気は、共同利用の天気の項目に同意した16歳以上の人の分だけ残す（src/lib/joint-use.ts）
 */

vi.mock('next/cache', () => ({ refresh: vi.fn() }));
vi.mock('@/lib/viewer', () => ({
  requireViewer: async () => ({ userId: 'me', name: 'Me', email: 'me@example.com', image: null }),
}));
const calls: string[] = [];
const data = vi.hoisted(() => ({
  getProfile: vi.fn(async () => ({
    events: ['long_jump'],
    timeZone: 'UTC',
    birthdate: '2000-05-01' as string | null,
    ageDeclared16Plus: true as boolean | null,
    jointUseVersion: 2 as number | null,
  })),
  getAttempt: vi.fn(async () => ({ id: 'a', event: 'long_jump' })),
  addAttempt: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
  updateAttempt: vi.fn(async () => {}),
  deleteAttempt: vi.fn(async () => {}),
  saveDayLog: vi.fn(async () => {}),
  addDayConditionIfMissing: vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true),
}));
vi.mock('@/lib/data', () => data);

const { saveAttemptAction } = await import('@/app/actions/today');

const form = (fields: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries({
    id: '',
    day: '2026-10-01',
    event: 'long_jump',
    kind: 'practice',
    markM: '6.10',
    ...fields,
  }))
    formData.set(key, value);
  return formData;
};

const condition = { condition: '6', fatigue: '8', sleepHours: '6.5', injury: '内転筋が少し痛い' };

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  data.addDayConditionIfMissing.mockImplementation(async () => {
    calls.push('condition');
    return true;
  });
  data.addAttempt.mockImplementation(async () => {
    calls.push('attempt');
  });
});

describe('saveAttemptAction のコンディション', () => {
  it('送られてきたら、試技より先にその日のコンディションを入れる', async () => {
    const result = await saveAttemptAction(null, form(condition));
    expect({ result, calls, args: data.addDayConditionIfMissing.mock.calls[0] }).toEqual({
      result: { ok: true },
      calls: ['condition', 'attempt'],
      args: [
        'me',
        '2026-10-01',
        { condition: 6, fatigue: 8, sleepHours: 6.5, injury: '内転筋が少し痛い', weather: null },
      ],
    });
  });

  it('天気は、同意した16歳以上の人の今日の分だけ残し、ほかの人と過ぎた日の分は外してコンディションだけ入れる', async () => {
    const weather = { code: 3, temperatureC: 14.2, windMs: 3.1, windDeg: 270, isDay: true };
    // 本人の時間帯（UTC）の今日
    const today = new Date().toISOString().slice(0, 10);
    const withWeather = form({ ...condition, day: today, weather: JSON.stringify(weather) });
    await saveAttemptAction(null, withWeather);
    data.getProfile.mockResolvedValueOnce({
      events: ['long_jump'],
      timeZone: 'UTC',
      birthdate: '2000-05-01',
      ageDeclared16Plus: true,
      jointUseVersion: null,
    });
    await saveAttemptAction(null, withWeather);
    data.getProfile.mockResolvedValueOnce({
      events: ['long_jump'],
      timeZone: 'UTC',
      birthdate: '2015-05-01',
      ageDeclared16Plus: false,
      jointUseVersion: 2,
    });
    await saveAttemptAction(null, withWeather);
    await saveAttemptAction(null, form({ ...condition, weather: JSON.stringify(weather) }));
    expect(
      data.addDayConditionIfMissing.mock.calls.map(
        (args) => (args[2] as { weather: unknown }).weather,
      ),
    ).toEqual([weather, null, null, null]);
  });

  it('欄が無いとき（閉じたまま）と、試技の書き換えでは入れない', async () => {
    await saveAttemptAction(null, form({}));
    await saveAttemptAction(
      null,
      form({ ...condition, id: '6f1f4a4e-6a55-4a77-9a3b-2a3c3f0b1d11' }),
    );
    expect(data.addDayConditionIfMissing).not.toHaveBeenCalled();
  });

  it('範囲の外なら、コンディションも試技も書かない', async () => {
    const result = await saveAttemptAction(null, form({ ...condition, condition: '11' }));
    expect({ result, calls }).toEqual({ result: { ok: false, error: 'generic' }, calls: [] });
  });
});
