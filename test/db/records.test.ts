import { describe, expect, it } from 'vitest';
import {
  addAttempt,
  addDayConditionIfMissing,
  type AttemptInput,
  type Competition,
  deleteAttempt,
  deleteCompetition,
  getActivityCounts,
  getAttempt,
  getCompetition,
  getDayLog,
  listAllAttempts,
  listAttemptMarksBetween,
  listAttempts,
  listAttemptsBetween,
  listCompetitions,
  listCompetitionsBetween,
  listConditionsBetween,
  listDayLogs,
  listRecentAttempts,
  nextCompetition,
  saveCompetition,
  saveDayLog,
  updateAttempt,
} from '@/lib/data';
import { type AttemptDetails, EMPTY_DETAILS } from '@/lib/attempt-details';
import type { HeightSeries } from '@/lib/height-series';
import { addProfile } from './seed';

/**
 * 試技・大会・日の体調の表。id を受け取る関数は、本人の行のほかは読みも書きもしない
 * （id はブラウザから来るので、ほかの人の id を送られても触れない）
 */

const jump: Omit<AttemptInput, 'day'> = {
  event: 'long_jump',
  kind: 'practice',
  markM: 6.1234,
  windMs: 1.5,
  note: 'note',
};

const meet: Omit<Competition, 'id' | 'name' | 'day'> = {
  venue: 'Stadium',
  callRoomPlace: 'Gate',
  callRoomTime: '09:30',
  startTime: '10:00',
  notes: null,
  isTarget: true,
  entryUrl: 'https://example.com/entry',
};

const log = { condition: 7, fatigue: 3, sleepHours: 7.5, injury: null, note: 'easy' };

/** 1人目の試技を1本入れ、その id を返す */
async function attemptOf(userId: string, day = '2026-10-14') {
  await addAttempt(userId, { ...jump, day });
  const [attempt] = await listAttemptsBetween(userId, day, day);
  return attempt!;
}

async function competitionOf(userId: string, name = 'Meet', day = '2026-10-20') {
  await saveCompetition(userId, { ...meet, id: null, name, day });
  return (await listCompetitions(userId)).find((c) => c.name === name)!;
}

describe('試技', () => {
  it('ほかの人の試技は読めず、書き換えも消しもできない', async () => {
    const [owner, other] = await Promise.all([addProfile(), addProfile()]);
    const attempt = await attemptOf(owner);

    expect(await getAttempt(other, attempt.id)).toBeNull();
    await updateAttempt(other, attempt.id, { ...jump, markM: 9 });
    await deleteAttempt(other, attempt.id);
    expect(await getAttempt(owner, attempt.id)).toEqual(attempt);
  });

  it('本人の試技は書き換えられ（日は変えない）、消せる', async () => {
    const userId = await addProfile();
    const attempt = await attemptOf(userId);
    await updateAttempt(userId, attempt.id, {
      event: 'triple_jump',
      kind: 'competition',
      markM: 13.05,
      windMs: null,
      note: null,
    });
    expect(await getAttempt(userId, attempt.id)).toEqual({
      id: attempt.id,
      day: '2026-10-14',
      event: 'triple_jump',
      kind: 'competition',
      markM: 13.05,
      windMs: null,
      note: null,
      details: EMPTY_DETAILS,
      heightSeries: null,
    });
    await deleteAttempt(userId, attempt.id);
    expect(await getAttempt(userId, attempt.id)).toBeNull();
  });

  it('記録は 0.1mm まで数で戻り、種目・期間で絞れ、跳んだ本数と日数を数える', async () => {
    const [userId, other] = await Promise.all([addProfile(), addProfile()]);
    await addAttempt(userId, { ...jump, day: '2026-10-12' });
    await addAttempt(userId, { ...jump, day: '2026-10-12', event: 'high_jump', markM: 1.8542 });
    await addAttempt(userId, { ...jump, day: '2026-10-14' });
    await addAttempt(other, { ...jump, day: '2026-10-12' });

    const longJumps = await listAttempts(userId, 'long_jump');
    expect(longJumps.map((a) => [a.day, a.markM, a.windMs])).toEqual([
      ['2026-10-12', 6.1234, 1.5],
      ['2026-10-14', 6.1234, 1.5],
    ]);
    expect((await listAttempts(userId, 'high_jump')).map((a) => a.markM)).toEqual([1.8542]);
    expect(await listAttemptsBetween(userId, '2026-10-13', '2026-10-14')).toHaveLength(1);
    expect(await listAllAttempts(userId)).toHaveLength(3);
    expect(await getActivityCounts(userId)).toEqual({ jumps: 3, daysLogged: 2 });
  });

  it('直近の試技は1種目だけを新しい日から、同じ日は後に入れた順で、本数を切って返す', async () => {
    const [userId, other] = await Promise.all([addProfile(), addProfile()]);
    await addAttempt(userId, { ...jump, day: '2026-10-10', markM: 5.9 });
    await addAttempt(userId, { ...jump, day: '2026-10-12', markM: 6.0 });
    await addAttempt(userId, { ...jump, day: '2026-10-12', markM: 6.2 });
    await addAttempt(userId, { ...jump, day: '2026-10-11', markM: 6.1 });
    await addAttempt(userId, { ...jump, day: '2026-10-13', event: 'high_jump', markM: 1.8 });
    await addAttempt(other, { ...jump, day: '2026-10-14', markM: 7 });

    const recent = await listRecentAttempts(userId, 'long_jump', 3);
    expect(recent.map((a) => [a.day, a.markM])).toEqual([
      ['2026-10-12', 6.2],
      ['2026-10-12', 6.0],
      ['2026-10-11', 6.1],
    ]);
  });
});

describe('試技の細かい記録', () => {
  const vaultDetails: AttemptDetails = {
    ...EMPTY_DETAILS,
    approachSteps: 16,
    // 助走 126' 0"、ポール 15' 0"、グリップ 14' 5"、支柱 18"（フィート・インチで入れた値）
    approachLengthM: 38.4048,
    poleLengthM: 4.572,
    poleStiffnessLb: 160,
    gripHeightM: 4.3942,
    standardsCm: 45.7,
  };
  const vault: Omit<AttemptInput, 'day'> = {
    event: 'pole_vault',
    kind: 'practice',
    markM: 4.2,
    windMs: null,
    note: null,
    details: vaultDetails,
  };

  it('入れた値が 0.1mm・0.1cm まで数で戻り、書き換えで空にもできる', async () => {
    const userId = await addProfile();
    await addAttempt(userId, { ...vault, day: '2026-10-14' });
    const [saved] = await listAttemptsBetween(userId, '2026-10-14', '2026-10-14');
    expect(saved?.details).toEqual(vaultDetails);

    await addAttempt(userId, {
      ...jump,
      day: '2026-10-13',
      details: { ...EMPTY_DETAILS, approachSteps: 20, boardOffsetCm: -2.5 },
    });
    const [longJump] = await listAttemptsBetween(userId, '2026-10-13', '2026-10-13');
    expect(longJump?.details).toEqual({ ...EMPTY_DETAILS, approachSteps: 20, boardOffsetCm: -2.5 });

    // 全期間を読む集計（ホーム・分析・記録の一覧）と、それを出さない期間の読み（試技・動画を足す画面、AI のメニュー）は
    // 細かい記録と高さごとの結果の列を読まない。読むのは出す画面だけ
    const [all] = await listAllAttempts(userId);
    const [vaults] = await listAttempts(userId, 'pole_vault');
    const [marks] = await listAttemptMarksBetween(userId, '2026-10-14', '2026-10-14');
    expect(
      [all, vaults, marks].map(
        (attempt) => attempt && ('details' in attempt || 'heightSeries' in attempt),
      ),
    ).toEqual([false, false, false]);
    expect(marks).toEqual(expect.objectContaining({ id: saved!.id, markM: 4.2 }));

    await updateAttempt(userId, saved!.id, { ...vault, details: EMPTY_DETAILS });
    expect((await getAttempt(userId, saved!.id))?.details).toEqual(EMPTY_DETAILS);
  });

  it('範囲の外、種目に合わない欄、ポールより高いグリップは DB が弾く', async () => {
    const userId = await addProfile();
    const day = '2026-10-14';
    const tries = [
      { ...jump, details: { ...EMPTY_DETAILS, approachSteps: 31 } },
      { ...jump, details: { ...EMPTY_DETAILS, approachLengthM: 60.5 } },
      { ...jump, details: { ...EMPTY_DETAILS, boardOffsetCm: -31 } },
      { ...jump, details: { ...EMPTY_DETAILS, poleLengthM: 4.5 } },
      { ...vault, event: 'high_jump' as const },
      { ...vault, details: { ...vaultDetails, standardsCm: 81 } },
      { ...vault, details: { ...vaultDetails, poleStiffnessLb: 49 } },
      { ...vault, details: { ...vaultDetails, gripHeightM: 4.6 } },
    ];
    const results = await Promise.allSettled(tries.map((t) => addAttempt(userId, { ...t, day })));
    expect(results.map((r) => r.status)).toEqual(tries.map(() => 'rejected'));
    expect(await listAttemptsBetween(userId, day, day)).toEqual([]);
  });
});

describe('走高跳・棒高跳の高さごとの結果', () => {
  const series: HeightSeries = [
    { heightM: 1.8, trials: ['cleared'] },
    // 6' 0¾"（フィート・インチで入れた値）
    { heightM: 1.8478, trials: ['missed', 'cleared'] },
    { heightM: 1.9, trials: ['missed', 'missed', 'passed'] },
    { heightM: 1.95, trials: ['missed'] },
  ];
  const highJump: Omit<AttemptInput, 'day'> = {
    event: 'high_jump',
    kind: 'competition',
    markM: 1.8478,
    windMs: null,
    note: null,
    heightSeries: series,
  };

  it('並びも高さも 0.1mm まで戻り、書き換えで消せる。全期間の集計は読まない', async () => {
    const userId = await addProfile();
    const day = '2026-10-14';
    await addAttempt(userId, { ...highJump, day });
    const [saved] = await listAttemptsBetween(userId, day, day);
    const got = await getAttempt(userId, saved!.id);
    const [all] = await listAllAttempts(userId);
    const [jumps] = await listAttempts(userId, 'high_jump');
    expect({
      between: saved?.heightSeries,
      one: got?.heightSeries,
      lean: [all, jumps].map((a) => a && 'heightSeries' in a),
    }).toEqual({ between: series, one: series, lean: [false, false] });

    await updateAttempt(userId, saved!.id, { ...highJump, heightSeries: null });
    expect((await getAttempt(userId, saved!.id))?.heightSeries).toBeNull();
    // 高さごとの結果の無い試技（細かい記録だけの入れ方）は null
    await addAttempt(userId, { ...jump, day });
    const rows = await listAttemptsBetween(userId, day, day);
    expect(rows.map((a) => a.heightSeries)).toEqual([null, null]);
  });

  it('走高跳・棒高跳のほかの種目、配列でない値、空の配列、41 個の高さは DB が弾く', async () => {
    const userId = await addProfile();
    const day = '2026-10-14';
    const many = Array.from({ length: 41 }, (_, i) => ({
      heightM: 1 + i / 100,
      trials: ['cleared'] as const,
    }));
    const tries = [
      { ...highJump, event: 'long_jump' as const },
      { ...highJump, event: 'triple_jump' as const },
      { ...highJump, heightSeries: [] },
      { ...highJump, heightSeries: many as unknown as HeightSeries },
      { ...highJump, heightSeries: { heightM: 1.8 } as unknown as HeightSeries },
    ];
    const results = await Promise.allSettled(tries.map((t) => addAttempt(userId, { ...t, day })));
    expect(results.map((r) => r.status)).toEqual(tries.map(() => 'rejected'));
    // 棒高跳は持てる
    await addAttempt(userId, { ...highJump, event: 'pole_vault', day });
    expect((await listAttemptsBetween(userId, day, day)).map((a) => a.event)).toEqual([
      'pole_vault',
    ]);
  });
});

describe('大会', () => {
  it('ほかの人の大会は読めず、書き換えも消しもできない', async () => {
    const [owner, other] = await Promise.all([addProfile(), addProfile()]);
    const competition = await competitionOf(owner);

    expect(await getCompetition(other, competition.id)).toBeNull();
    await saveCompetition(other, { ...competition, name: 'Hijacked' });
    await deleteCompetition(other, competition.id);
    expect(await getCompetition(owner, competition.id)).toEqual(competition);
    expect(await listCompetitions(other)).toEqual([]);
  });

  it('本人の大会は書き換えられ、時刻は HH:MM で戻り、消せる', async () => {
    const userId = await addProfile();
    const competition = await competitionOf(userId);
    expect(competition).toMatchObject({ ...meet, name: 'Meet', day: '2026-10-20' });

    await saveCompetition(userId, { ...competition, name: 'Renamed', startTime: null });
    expect(await getCompetition(userId, competition.id)).toMatchObject({
      name: 'Renamed',
      startTime: null,
      callRoomTime: '09:30',
    });
    await deleteCompetition(userId, competition.id);
    expect(await getCompetition(userId, competition.id)).toBeNull();
  });

  it('次の大会は今日以降でいちばん近いもの、期間の大会は日付の近い順', async () => {
    const userId = await addProfile();
    await competitionOf(userId, 'Past', '2026-10-13');
    await competitionOf(userId, 'Later', '2026-10-30');
    await competitionOf(userId, 'Today', '2026-10-14');

    expect((await nextCompetition(userId, '2026-10-14'))?.name).toBe('Today');
    expect((await nextCompetition(userId, '2026-10-15'))?.name).toBe('Later');
    expect(await nextCompetition(userId, '2026-10-31')).toBeNull();
    expect(
      (await listCompetitionsBetween(userId, '2026-10-13', '2026-10-14')).map((c) => c.name),
    ).toEqual(['Past', 'Today']);
  });
});

describe('日の体調', () => {
  it('試技やメニューの画面からのコンディションは、行が無い日だけ入れ、ある日は書き換えない', async () => {
    const userId = await addProfile();
    const { note: _note, ...condition } = log;
    await saveDayLog(userId, '2026-10-13', log);
    const added = [
      await addDayConditionIfMissing(userId, '2026-10-14', condition),
      await addDayConditionIfMissing(userId, '2026-10-14', { ...condition, condition: 1 }),
      await addDayConditionIfMissing(userId, '2026-10-13', { ...condition, condition: 1 }),
    ];

    expect(added).toEqual([true, false, false]);
    expect(await getDayLog(userId, '2026-10-14')).toEqual({ ...condition, note: null });
    expect(await getDayLog(userId, '2026-10-13')).toEqual(log);
  });

  it('1日1行。保存し直すと上書きし、ほかの人の同じ日には触れない', async () => {
    const [userId, other] = await Promise.all([addProfile(), addProfile()]);
    await saveDayLog(other, '2026-10-14', log);
    await saveDayLog(userId, '2026-10-14', log);
    await saveDayLog(userId, '2026-10-14', { ...log, condition: 2, sleepHours: 5 });

    expect(await getDayLog(userId, '2026-10-14')).toEqual({ ...log, condition: 2, sleepHours: 5 });
    expect(await getDayLog(other, '2026-10-14')).toEqual(log);
    expect(await listDayLogs(userId)).toEqual([{ day: '2026-10-14', condition: 2, note: 'easy' }]);
  });

  it('期間の体調を日付順に、睡眠を数にして返す', async () => {
    const userId = await addProfile();
    await saveDayLog(userId, '2026-10-14', log);
    await saveDayLog(userId, '2026-10-12', { ...log, sleepHours: 6 });
    await saveDayLog(userId, '2026-10-01', log);

    const rows = await listConditionsBetween(userId, '2026-10-10', '2026-10-14');
    expect(rows.map((r) => [r.day, r.sleepHours])).toEqual([
      ['2026-10-12', 6],
      ['2026-10-14', 7.5],
    ]);
    expect(await getDayLog(userId, '2026-10-13')).toBeNull();
  });
});
