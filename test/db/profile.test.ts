import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  consentToAi,
  consentToJointUse,
  declareUnder16,
  getProfile,
  getTargets,
  listUsersForAdmin,
  type ProfileInput,
  saveProfile,
  saveProfileDetails,
  saveRecordSettings,
  saveTargetField,
  setPlan,
} from '@/lib/data';
import { JOINT_USE_VERSION } from '@/lib/joint-use';
import { addProfile, addUser, query } from './seed';

/** プロフィール・同意・プラン・目標の表 */

const input: ProfileInput = {
  name: 'Saved Name',
  grade: null,
  gradeOffset: 0,
  birthdate: '2008-05-01',
  gender: 'female',
  heightCm: 165.5,
  weightKg: 52.3,
  events: ['triple_jump', 'long_jump'],
  units: 'imperial',
  seasonStartMonth: 4,
  weekStart: 1,
  timeZone: 'Asia/Tokyo',
  goalM: 12.5,
};

async function consentAt(userId: string) {
  const [row] = await query<{ at: Date | null }>(
    `select "aiConsentAt" as at from profile where "userId" = $1`,
    [userId],
  );
  return row!.at;
}

describe('saveProfile', () => {
  it('初めての保存でプロフィールを作り、名前を user に、目標を先頭の種目に入れる', async () => {
    const userId = await addUser();
    await saveProfile(userId, input);

    expect(await getProfile(userId)).toEqual({
      ...input,
      goalM: undefined,
      plan: 'free',
      inTeamPlan: false,
      aiConsentVersion: null,
      aiGuardianConsentVersion: null,
      // 生年月日（2008年生まれ）から16歳以上と分かる
      ageDeclared16Plus: true,
      // ログインの画面で今のポリシー（天気を足した共同利用の一覧）に同意している
      jointUseVersion: JOINT_USE_VERSION,
    });
    const targets = await getTargets(userId, ['triple_jump', 'long_jump']);
    expect(targets.get('triple_jump')?.seasonGoalM).toBe(12.5);
    expect(targets.get('long_jump')?.seasonGoalM).toBeNull();
  });

  it('保存し直しても、プランと AI の同意には触れない', async () => {
    const userId = await addUser();
    await saveProfile(userId, input);
    await setPlan(userId, 'premium');
    await consentToAi(userId, 1, false);

    await saveProfile(userId, { ...input, name: 'Again', goalM: null });
    await saveProfileDetails(userId, { ...input, name: 'Details' });
    await saveRecordSettings(userId, { ...input, events: ['high_jump'] });

    expect(await getProfile(userId)).toMatchObject({
      name: 'Details',
      events: ['high_jump'],
      plan: 'premium',
      aiConsentVersion: 1,
    });
    expect(await consentAt(userId)).not.toBeNull();
  });
});

describe('saveProfileDetails と saveRecordSettings', () => {
  it('それぞれ自分の区画の列だけを書き換える', async () => {
    const userId = await addUser();
    await saveProfile(userId, input);

    await saveProfileDetails(userId, {
      name: 'New',
      grade: null,
      gradeOffset: 1,
      birthdate: null,
      gender: 'male',
      heightCm: 170,
      weightKg: null,
      timeZone: 'Europe/Paris',
    });
    expect(await getProfile(userId)).toMatchObject({
      name: 'New',
      gender: 'male',
      heightCm: 170,
      weightKg: null,
      timeZone: 'Europe/Paris',
      // 記録の区画は前のまま
      events: input.events,
      units: 'imperial',
      seasonStartMonth: 4,
      weekStart: 1,
    });

    await saveRecordSettings(userId, {
      events: ['pole_vault'],
      units: 'metric',
      seasonStartMonth: 1,
      weekStart: 0,
      timeZone: 'America/New_York',
    });
    expect(await getProfile(userId)).toMatchObject({
      name: 'New',
      gender: 'male',
      heightCm: 170,
      events: ['pole_vault'],
      units: 'metric',
      seasonStartMonth: 1,
      weekStart: 0,
      timeZone: 'America/New_York',
    });
  });
});

describe('consentToAi', () => {
  it('同意した版を入れ、同じ版では何もせず、新しい版では版と時刻を改める', async () => {
    const userId = await addProfile();
    await consentToAi(userId, 1, false);
    expect((await getProfile(userId))?.aiConsentVersion).toBe(1);

    // 同意した時刻を昔にしておき、変わったかどうかで確かめる
    await query(`update profile set "aiConsentAt" = '2026-01-01T00:00:00Z' where "userId" = $1`, [
      userId,
    ]);
    await consentToAi(userId, 1, false);
    expect((await consentAt(userId))?.toISOString()).toBe('2026-01-01T00:00:00.000Z');

    await consentToAi(userId, 2, false);
    expect((await getProfile(userId))?.aiConsentVersion).toBe(2);
    expect((await consentAt(userId))?.toISOString()).not.toBe('2026-01-01T00:00:00.000Z');
  });
  it('生年月日の無い人の「16歳以上」は答えも残すが、16歳未満と答えた人の答えは上書きしない', async () => {
    const adult = await addProfile();
    expect(await consentToAi(adult, 1, true)).toBe(true);
    expect(await getProfile(adult)).toMatchObject({ aiConsentVersion: 1, ageDeclared16Plus: true });

    const minor = await addProfile();
    await declareUnder16(minor);
    expect(await consentToAi(minor, 1, true)).toBe(false);
    expect(await getProfile(minor)).toMatchObject({
      aiConsentVersion: null,
      ageDeclared16Plus: false,
    });
  });
});

describe('16歳未満と分かったことを残す（生年月日を消しても本人だけで同意させない）', () => {
  /** 今日（Asia/Tokyo）から years 年前の生年月日 */
  const bornYearsAgo = (years: number) => {
    const today = new Date();
    return `${today.getUTCFullYear() - years}-01-01`;
  };
  const under16 = bornYearsAgo(12);
  const over16 = bornYearsAgo(20);

  it('登録で16歳未満の生年月日を入れると false を残し、設定で生年月日を消しても残る', async () => {
    const userId = await addUser();
    await saveProfile(userId, { ...input, birthdate: under16 });
    expect((await getProfile(userId))?.ageDeclared16Plus).toBe(false);

    await saveProfileDetails(userId, { ...input, birthdate: null });
    const cleared = (await getProfile(userId))!;
    expect(cleared).toMatchObject({ birthdate: null, ageDeclared16Plus: false });
    // 「16歳以上です」と答えて本人だけで同意しようとしても入らない
    expect(await consentToAi(userId, 1, true)).toBe(false);
    expect(await getProfile(userId)).toMatchObject({
      aiConsentVersion: null,
      ageDeclared16Plus: false,
    });

    // 登録をやり直して（生年月日なしで）保存しても戻らない
    await saveProfile(userId, { ...input, birthdate: null });
    expect((await getProfile(userId))?.ageDeclared16Plus).toBe(false);
  });

  it('設定で16歳未満の生年月日を入れると false を残し、16歳以上の生年月日でだけ戻る', async () => {
    const userId = await addUser();
    await saveProfile(userId, { ...input, birthdate: null });
    expect((await getProfile(userId))?.ageDeclared16Plus).toBeNull();

    await saveProfileDetails(userId, { ...input, birthdate: under16 });
    await saveProfileDetails(userId, { ...input, birthdate: null });
    expect((await getProfile(userId))?.ageDeclared16Plus).toBe(false);

    await saveProfileDetails(userId, { ...input, birthdate: over16 });
    expect((await getProfile(userId))?.ageDeclared16Plus).toBe(true);
    await saveProfileDetails(userId, { ...input, birthdate: null });
    expect(await consentToAi(userId, 1, true)).toBe(true);
  });
});

describe('setPlan', () => {
  it('プロフィールのある人のプランを変え、無い人には何もせず false', async () => {
    const [userId, noProfile] = await Promise.all([addProfile(), addUser()]);
    expect(await setPlan(userId, 'premium')).toBe(true);
    expect((await getProfile(userId))?.plan).toBe('premium');
    expect(await setPlan(noProfile, 'premium')).toBe(false);
  });
});

describe('listUsersForAdmin', () => {
  /** 探す語がほかのテストの人に当たらないよう、名前に毎回違う印を入れる */
  const token = () => randomUUID().slice(0, 8);

  it('% と _ と \\ を、LIKE の記号ではなく語のまま探す', async () => {
    const t = token();
    const percent = await addProfile({ name: `${t} 50%` });
    await addProfile({ name: `${t} 50x` });
    const underscore = await addProfile({ name: `${t} a_b` });
    await addProfile({ name: `${t} axb` });
    const backslash = await addProfile({ name: `${t} c\\d` });
    await addProfile({ name: `${t} cd` });

    const ids = async (q: string) => (await listUsersForAdmin(q, 100)).map((u) => u.id);
    expect(await ids(`${t} 50%`)).toEqual([percent]);
    expect(await ids(`${t} a_b`)).toEqual([underscore]);
    expect(await ids(`${t} c\\d`)).toEqual([backslash]);
  });

  it('メールでも探せ、大文字と小文字を区別せず、新しい順にプランを付けて返す', async () => {
    const t = token();
    const older = await addProfile({ name: `${t} Older` });
    const newer = await addProfile({ name: `${t} Newer` });
    await query(`update "user" set "createdAt" = now() - interval '1 day' where id = $1`, [older]);
    await setPlan(newer, 'premium');

    const users = await listUsersForAdmin(t.toUpperCase(), 100);
    expect(users).toEqual([
      { id: newer, name: `${t} Newer`, email: `${newer}@example.com`, plan: 'premium' },
      { id: older, name: `${t} Older`, email: `${older}@example.com`, plan: 'free' },
    ]);
    expect((await listUsersForAdmin(older, 100)).map((u) => u.id)).toEqual([older]);
    expect(await listUsersForAdmin(t, 1)).toHaveLength(1);
  });

  it('プロフィールを作っていない人は出さない', async () => {
    const t = token();
    await addUser(`${t} no profile`);
    expect(await listUsersForAdmin(t, 100)).toEqual([]);
  });
});

describe('saveTargetField', () => {
  it('1つの値だけを書き、SB を書いたときだけシーズンも残す', async () => {
    const userId = await addProfile();
    await saveTargetField(userId, 'long_jump', 'manualSbM', 6.1, 2026);
    await saveTargetField(userId, 'long_jump', 'manualPbM', 6.5, 2027);
    await saveTargetField(userId, 'long_jump', 'seasonGoalM', 6.8, 2027);

    const targets = await getTargets(userId, ['long_jump', 'high_jump']);
    expect(targets.get('long_jump')).toEqual({
      seasonGoalM: 6.8,
      manualPbM: 6.5,
      manualSbM: 6.1,
      manualSbSeason: 2026,
      manualPracticeBestM: null,
    });
    expect(targets.get('high_jump')).toEqual({
      seasonGoalM: null,
      manualPbM: null,
      manualSbM: null,
      manualSbSeason: null,
      manualPracticeBestM: null,
    });

    await saveTargetField(userId, 'long_jump', 'manualSbM', null, 2027);
    expect((await getTargets(userId, ['long_jump'])).get('long_jump')).toMatchObject({
      manualSbM: null,
      manualSbSeason: 2027,
      manualPbM: 6.5,
    });
  });
});

describe('共同利用の項目の同意', () => {
  it('前からいる人は版 1（null）のまま。同意で今の版と時刻が入り、保存し直しても同意し直しても変わらない', async () => {
    const userId = await addProfile();
    const before = (await getProfile(userId))?.jointUseVersion;
    await consentToJointUse(userId, JOINT_USE_VERSION);
    const [first] = await query<{ at: Date }>(
      `select "jointUseAgreedAt" as at from profile where "userId" = $1`,
      [userId],
    );
    await consentToJointUse(userId, JOINT_USE_VERSION);
    await saveProfile(userId, input);
    const [second] = await query<{ at: Date; version: number }>(
      `select "jointUseAgreedAt" as at, "jointUseVersion" as version from profile where "userId" = $1`,
      [userId],
    );

    expect({ before, version: second!.version, sameTime: +second!.at === +first!.at }).toEqual({
      before: null,
      version: JOINT_USE_VERSION,
      sameTime: true,
    });
  });
});
