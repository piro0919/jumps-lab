import { describe, expect, it } from 'vitest';
import {
  addAttempt,
  type Attempt,
  type Competition,
  deleteAttempt,
  deleteCompetition,
  getActivityCounts,
  getAttempt,
  getCompetition,
  getDayLog,
  listAllAttempts,
  listAttempts,
  listAttemptsBetween,
  listCompetitions,
  listCompetitionsBetween,
  listConditionsBetween,
  listDayLogs,
  nextCompetition,
  saveCompetition,
  saveDayLog,
  updateAttempt,
} from '@/lib/data';
import { addProfile } from './seed';

/**
 * 試技・大会・日の体調の表。id を受け取る関数は、本人の行のほかは読みも書きもしない
 * （id はブラウザから来るので、ほかの人の id を送られても触れない）
 */

const jump: Omit<Attempt, 'id' | 'day'> = {
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
