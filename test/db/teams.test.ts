import { describe, expect, it } from 'vitest';
import { addProfile, query } from './seed';

/**
 * チームとコーチ（src/lib/data.ts のチームの関数）を本物の DB で確かめる:
 * 1. コーチの関数は、どの文でも「押した人がそのチームのコーチか」と「相手がいまそのチームの選手か」を確かめる。
 *    ほかのチームのコーチ・選手でない人・抜けた人・外された人は見えない
 * 2. 招待は切ったものと期限の過ぎたものでは入れない。作り直すと前のリンクは切れる
 * 3. 16歳未満の人は本人だけでは入れず、保護者の同意で入る（招待が切れていたら入れない）
 * 4. チームを消しても選手の記録は残り、コーチがアカウントを消すとチームも消える
 */

const {
  addGuardianRequest,
  agreeAsGuardian,
  createInvite,
  createTeam,
  deleteTeam,
  findInvite,
  getCoachedTeam,
  getMemberForCoach,
  joinTeamBySelf,
  latestGuardianRequest,
  leaveTeam,
  listCoachedTeams,
  listMemberCompetitionAttemptsForCoach,
  listMemberAttemptsForCoach,
  listMemberCompetitionsForCoach,
  listMemberDayLogsForCoach,
  listMemberVideosForCoach,
  listMemberships,
  removeMember,
  renameTeam,
  revokeInvites,
  teamRelation,
  teamRoster,
} = await import('@/lib/data');
const { hashInviteToken, newInviteToken } = await import('@/lib/teams');
const { hashGuardianToken, newGuardianToken } = await import('@/lib/guardian');
const { todayIn, addDays } = await import('@/lib/dates');

const INVITE_DAYS = 14;
const VIDEO_DAYS = 14;

/** コーチとチームと、使える招待を1つ作る */
async function teamWithInvite(name = 'Hawks') {
  const coachId = await addProfile({ name: 'Coach' });
  const teamId = await createTeam(coachId, name);
  const token = newInviteToken();
  await createInvite(coachId, teamId, hashInviteToken(token), INVITE_DAYS);
  return { coachId, teamId, token, tokenHash: hashInviteToken(token) };
}

/** 生年月日のある選手（16歳以上） */
async function adult(name = 'Athlete') {
  const userId = await addProfile({ name, events: ['long_jump', 'triple_jump'] });
  await query(`update profile set birthdate = '2005-01-01' where "userId" = $1`, [userId]);
  return userId;
}

/** 生年月日のある選手（16歳未満） */
async function minor(name = 'Kid') {
  const userId = await addProfile({ name });
  await query(`update profile set birthdate = '2013-01-01' where "userId" = $1`, [userId]);
  return userId;
}

/** その人の記録を1日分入れる（試技・体調と痛みのメモ・大会・動画） */
async function seedRecords(userId: string, day: string) {
  await query(
    `insert into attempt ("userId", day, event, kind, "markM") values ($1, $2, 'long_jump', 'practice', 6.1), ($1, $2, 'long_jump', 'practice', 6.4)`,
    [userId, day],
  );
  await query(
    `insert into day_log ("userId", day, condition, fatigue, injury, note) values ($1, $2, 6, 8, 'left knee', 'drills')`,
    [userId, day],
  );
  await query(`insert into competition ("userId", name, day) values ($1, 'Meet', $2)`, [
    userId,
    day,
  ]);
  await query(
    `insert into video ("userId", day, event, kind, "objectKey", "contentType", "sizeBytes", status, "expiresAt")
     values ($1, $2, 'long_jump', 'practice', $3, 'video/mp4', 100, 'ready', now() + interval '90 days')`,
    [userId, day, `videos/${userId}/${crypto.randomUUID()}.mp4`],
  );
}

/** コーチの読む関数を全部呼び、見えたものの数を返す */
async function seen(coachId: string, teamId: string, memberId: string, day: string) {
  const access = { coachId, teamId, memberId };
  return {
    member: (await getMemberForCoach(access)) !== null,
    attempts: (await listMemberAttemptsForCoach(access, day, day)).length,
    competitionAttempts: (await listMemberCompetitionAttemptsForCoach(access)).length,
    logs: (await listMemberDayLogsForCoach(access, day, day)).length,
    competitions: (await listMemberCompetitionsForCoach(access)).length,
    videos: (await listMemberVideosForCoach(access, day, day)).length,
    roster: (await teamRoster(coachId, teamId, VIDEO_DAYS)).filter((r) => r.userId === memberId)
      .length,
  };
}

const NOTHING = {
  member: false,
  attempts: 0,
  competitionAttempts: 0,
  logs: 0,
  competitions: 0,
  videos: 0,
  roster: 0,
};

describe('チームを作る・直す・消す', () => {
  it('作った人がコーチになり、ほかの人はチームを開けず、名前を変えたり消したりできない', async () => {
    const coachId = await addProfile();
    const otherId = await addProfile();
    const teamId = await createTeam(coachId, 'Hawks');
    expect(await getCoachedTeam(coachId, teamId)).toMatchObject({ name: 'Hawks' });
    expect(await getCoachedTeam(otherId, teamId)).toBeNull();
    expect(await listCoachedTeams(coachId)).toEqual([
      { id: teamId, name: 'Hawks', memberCount: 0 },
    ]);

    expect(await renameTeam(otherId, teamId, 'Stolen')).toBe(false);
    expect(await deleteTeam(otherId, teamId)).toBe(false);
    expect(await renameTeam(coachId, teamId, 'Eagles')).toBe(true);
    expect((await getCoachedTeam(coachId, teamId))?.name).toBe('Eagles');
  });

  it('1人で何チームでもコーチできる', async () => {
    const coachId = await addProfile();
    await createTeam(coachId, 'A');
    await createTeam(coachId, 'B');
    expect((await listCoachedTeams(coachId)).map((t) => t.name)).toEqual(['A', 'B']);
  });
});

describe('招待', () => {
  it('鍵はハッシュだけを持ち、作り直すと前のリンクは切れる。コーチでなければ作れない', async () => {
    const { coachId, teamId, token, tokenHash } = await teamWithInvite();
    const rows = await query<{ tokenHash: string }>(
      `select "tokenHash" from team_invite where "teamId" = $1`,
      [teamId],
    );
    expect(rows).toEqual([{ tokenHash }]);
    expect(rows[0]!.tokenHash).not.toBe(token);

    const second = newInviteToken();
    await createInvite(coachId, teamId, hashInviteToken(second), INVITE_DAYS);
    expect((await findInvite(tokenHash))?.revokedAt).not.toBeNull();
    expect((await findInvite(hashInviteToken(second)))?.revokedAt).toBeNull();

    const stranger = await addProfile();
    expect(
      await createInvite(stranger, teamId, hashInviteToken(newInviteToken()), INVITE_DAYS),
    ).toBeNull();
  });

  it('切った招待・期限の過ぎた招待・知らない鍵では入れない', async () => {
    const revoked = await teamWithInvite();
    await revokeInvites(revoked.coachId, revoked.teamId);
    const expired = await teamWithInvite();
    await query(
      `update team_invite set "expiresAt" = now() - interval '1 minute' where "teamId" = $1`,
      [expired.teamId],
    );
    const athleteId = await adult();

    expect(await joinTeamBySelf(athleteId, revoked.tokenHash, false)).toBe('invalid');
    expect(await joinTeamBySelf(athleteId, expired.tokenHash, false)).toBe('invalid');
    expect(await joinTeamBySelf(athleteId, hashInviteToken('unknown'), false)).toBe('invalid');
    expect(await listMemberships(athleteId)).toEqual([]);
  });

  it('ほかの人のチームの招待は切れない', async () => {
    const { teamId, tokenHash } = await teamWithInvite();
    await revokeInvites(await addProfile(), teamId);
    expect((await findInvite(tokenHash))?.revokedAt).toBeNull();
  });
});

describe('本人の同意で入る', () => {
  it('16歳以上は入れて、同意した時刻と本人が同意したことを残す。2回目は already', async () => {
    const { teamId, tokenHash } = await teamWithInvite();
    const athleteId = await adult();
    expect(await joinTeamBySelf(athleteId, tokenHash, false)).toBe('joined');
    expect(await joinTeamBySelf(athleteId, tokenHash, false)).toBe('already');
    const [row] = await query<{ consentBy: string; consentedAt: Date | null }>(
      `select "consentBy", "consentedAt" from team_member where "teamId" = $1 and "userId" = $2`,
      [teamId, athleteId],
    );
    expect(row).toMatchObject({ consentBy: 'self' });
    expect(row?.consentedAt).toBeInstanceOf(Date);
    expect(await teamRelation(athleteId, teamId)).toEqual({ coach: false, member: true });
  });

  it('16歳未満（生年月日あり）は本人だけでは入れない', async () => {
    const { tokenHash } = await teamWithInvite();
    const kidId = await minor();
    expect(await joinTeamBySelf(kidId, tokenHash, true)).toBe('guardian');
    expect(await listMemberships(kidId)).toEqual([]);
  });

  it('生年月日の無い人は、16歳以上と答えて押したときだけ入り、答えを残す', async () => {
    const { tokenHash } = await teamWithInvite();
    const userId = await addProfile();
    expect(await joinTeamBySelf(userId, tokenHash, false)).toBe('ask');
    expect(await joinTeamBySelf(userId, tokenHash, true)).toBe('joined');
    const [row] = await query<{ ageDeclared16Plus: boolean }>(
      `select "ageDeclared16Plus" from profile where "userId" = $1`,
      [userId],
    );
    expect(row?.ageDeclared16Plus).toBe(true);
  });

  it('16歳未満と分かっている人（生年月日を消した人）は、16歳以上と答えても入れない', async () => {
    const { tokenHash } = await teamWithInvite();
    const userId = await addProfile();
    await query(`update profile set "ageDeclared16Plus" = false where "userId" = $1`, [userId]);
    expect(await joinTeamBySelf(userId, tokenHash, true)).toBe('guardian');
    expect(await listMemberships(userId)).toEqual([]);
  });

  it('コーチは自分のチームに選手として入れない', async () => {
    const { coachId, tokenHash } = await teamWithInvite();
    await query(`update profile set birthdate = '1990-01-01' where "userId" = $1`, [coachId]);
    expect(await joinTeamBySelf(coachId, tokenHash, false)).toBe('coach');
  });

  it('コーチかどうかを年齢より先に見る（生年月日の無いコーチ・16歳未満のコーチにも coach）', async () => {
    const team = await teamWithInvite();
    expect(await joinTeamBySelf(team.coachId, team.tokenHash, false)).toBe('coach');
    const young = await teamWithInvite('Young');
    await query(`update profile set birthdate = '2013-01-01' where "userId" = $1`, [young.coachId]);
    expect(await joinTeamBySelf(young.coachId, young.tokenHash, false)).toBe('coach');
  });
});

describe('コーチが見られるもの', () => {
  it('そのチームのコーチだけが、いまの選手の記録を見られる', async () => {
    const team = await teamWithInvite();
    const other = await teamWithInvite('Other');
    const athleteId = await adult();
    const outsiderId = await adult('Outsider');
    const day = todayIn('Asia/Tokyo');
    await seedRecords(athleteId, day);
    await seedRecords(outsiderId, day);
    await joinTeamBySelf(athleteId, team.tokenHash, false);
    // もう1つのチームには、別の選手だけが入っている
    await joinTeamBySelf(outsiderId, other.tokenHash, false);

    expect(await seen(team.coachId, team.teamId, athleteId, day)).toEqual({
      member: true,
      attempts: 2,
      // 大会の結果に使うのは、大会の日に「大会」として入れた試技だけ（seedRecords の試技は練習）
      competitionAttempts: 0,
      logs: 1,
      competitions: 1,
      videos: 1,
      roster: 1,
    });
    // ほかのチームのコーチは、自分のチームの id を使っても、この選手を見られない
    expect(await seen(other.coachId, other.teamId, athleteId, day)).toEqual(NOTHING);
    // ほかのチームのコーチが、この選手のチームの id を使っても見られない
    expect(await seen(other.coachId, team.teamId, athleteId, day)).toEqual(NOTHING);
    // コーチでも、チームに入っていない人は見られない
    expect(await seen(team.coachId, team.teamId, outsiderId, day)).toEqual(NOTHING);
    // 選手どうしは見られない
    expect(await seen(outsiderId, other.teamId, athleteId, day)).toEqual(NOTHING);
  });

  it('抜けた選手は、抜けたときから見えない。保護者の同意の記録も消える', async () => {
    const team = await teamWithInvite();
    const athleteId = await adult();
    const day = todayIn('Asia/Tokyo');
    await seedRecords(athleteId, day);
    await joinTeamBySelf(athleteId, team.tokenHash, false);
    expect((await seen(team.coachId, team.teamId, athleteId, day)).member).toBe(true);

    expect(await leaveTeam(athleteId, team.teamId)).toBe(true);
    expect(await seen(team.coachId, team.teamId, athleteId, day)).toEqual(NOTHING);
    expect(await leaveTeam(athleteId, team.teamId)).toBe(false);
  });

  it('外された選手は見えない。外せるのはそのチームのコーチだけ', async () => {
    const team = await teamWithInvite();
    const other = await teamWithInvite('Other');
    const athleteId = await adult();
    const day = todayIn('Asia/Tokyo');
    await seedRecords(athleteId, day);
    await joinTeamBySelf(athleteId, team.tokenHash, false);

    expect(await removeMember(other.coachId, team.teamId, athleteId)).toBe(false);
    expect((await seen(team.coachId, team.teamId, athleteId, day)).member).toBe(true);
    expect(await removeMember(team.coachId, team.teamId, athleteId)).toBe(true);
    expect(await seen(team.coachId, team.teamId, athleteId, day)).toEqual(NOTHING);
  });

  it('一覧の行は、痛みのメモの日・最新の体調と疲労・種目ごとの最新の記録・動画の本数を持つ', async () => {
    const team = await teamWithInvite();
    const athleteId = await adult('Aoi');
    const today = todayIn('Asia/Tokyo');
    await seedRecords(athleteId, addDays(today, -1));
    await query(
      `insert into attempt ("userId", day, event, kind, "markM") values ($1, $2, 'triple_jump', 'competition', 13.2)`,
      [athleteId, addDays(today, -20)],
    );
    // 古い動画は数えない
    await query(
      `insert into video ("userId", day, event, kind, "objectKey", "contentType", "sizeBytes", status, "expiresAt")
       values ($1, $2, 'long_jump', 'practice', $3, 'video/mp4', 100, 'ready', now() + interval '90 days')`,
      [athleteId, addDays(today, -VIDEO_DAYS), `videos/${athleteId}/old.mp4`],
    );
    await joinTeamBySelf(athleteId, team.tokenHash, false);

    const [row] = await teamRoster(team.coachId, team.teamId, VIDEO_DAYS);
    expect(row).toMatchObject({
      name: 'Aoi',
      events: ['long_jump', 'triple_jump'],
      lastDay: addDays(today, -1),
      latestCondition: { day: addDays(today, -1), value: 6 },
      latestFatigue: { day: addDays(today, -1), value: 8 },
      lastPainDay: addDays(today, -1),
      videos: 1,
    });
    expect(row?.latestBests).toEqual([
      { event: 'long_jump', day: addDays(today, -1), markM: 6.4 },
      { event: 'triple_jump', day: addDays(today, -20), markM: 13.2 },
    ]);
  });
});

describe('一覧の体調と疲労', () => {
  it('体調と疲労は別々に、それぞれ直近7日の最新を取る（体調だけの新しい日で、前の高い疲労を隠さない）', async () => {
    const team = await teamWithInvite();
    const athleteId = await adult();
    const today = todayIn('Asia/Tokyo');
    await query(
      `insert into day_log ("userId", day, condition, fatigue) values ($1, $2, 5, 9), ($1, $3, 7, null), ($1, $4, 2, 10)`,
      [athleteId, addDays(today, -2), addDays(today, -1), addDays(today, -7)],
    );
    await joinTeamBySelf(athleteId, team.tokenHash, false);

    const [row] = await teamRoster(team.coachId, team.teamId, VIDEO_DAYS);
    expect(row).toMatchObject({
      latestCondition: { day: addDays(today, -1), value: 7 },
      latestFatigue: { day: addDays(today, -2), value: 9 },
    });
  });

  it('7日より前の体調と疲労は取らない', async () => {
    const team = await teamWithInvite();
    const athleteId = await adult();
    const today = todayIn('Asia/Tokyo');
    await query(`insert into day_log ("userId", day, condition, fatigue) values ($1, $2, 3, 9)`, [
      athleteId,
      addDays(today, -7),
    ]);
    await joinTeamBySelf(athleteId, team.tokenHash, false);

    const [row] = await teamRoster(team.coachId, team.teamId, VIDEO_DAYS);
    expect(row).toMatchObject({ latestCondition: null, latestFatigue: null });
  });
});

describe('大会の結果に使う試技', () => {
  it('大会の日に「大会」として入れた試技だけを読む', async () => {
    const team = await teamWithInvite();
    const athleteId = await adult();
    const today = todayIn('Asia/Tokyo');
    const meet = addDays(today, -3);
    await query(`insert into competition ("userId", name, day) values ($1, 'Meet', $2)`, [
      athleteId,
      meet,
    ]);
    await query(
      `insert into attempt ("userId", day, event, kind, "markM") values
         ($1, $2, 'long_jump', 'competition', 6.5),
         ($1, $2, 'long_jump', 'practice', 6.9),
         ($1, $3, 'long_jump', 'competition', 7.0)`,
      [athleteId, meet, addDays(today, -10)],
    );
    await joinTeamBySelf(athleteId, team.tokenHash, false);

    const attempts = await listMemberCompetitionAttemptsForCoach({
      coachId: team.coachId,
      teamId: team.teamId,
      memberId: athleteId,
    });
    expect(attempts.map((a) => [a.day, a.kind, a.markM])).toEqual([[meet, 'competition', 6.5]]);
  });
});

describe('16歳未満の人は保護者の同意で入る', () => {
  async function guardianRequest(userId: string, inviteId: string | undefined) {
    const token = newGuardianToken();
    await addGuardianRequest(userId, {
      guardianEmail: 'parent@example.com',
      tokenHash: hashGuardianToken(token),
      days: 7,
      perDay: 10,
      ...(inviteId ? { inviteId } : {}),
    });
    return hashGuardianToken(token);
  }

  it('保護者が同意すると入り、保護者が同意したと残す。AI コーチのお願いとは別に数える', async () => {
    const team = await teamWithInvite();
    const kidId = await minor();
    const invite = await findInvite(team.tokenHash);
    const aiHash = await guardianRequest(kidId, undefined);
    const teamHash = await guardianRequest(kidId, invite!.inviteId);

    // チームのお願いを送っても、AI コーチのお願いは切れない
    expect(await latestGuardianRequest(kidId)).toMatchObject({ live: true });
    expect(await latestGuardianRequest(kidId, team.teamId)).toMatchObject({ live: true });

    expect(await agreeAsGuardian(teamHash, 2)).toBe('agreed');
    const [row] = await query<{ consentBy: string }>(
      `select "consentBy" from team_member where "teamId" = $1 and "userId" = $2`,
      [team.teamId, kidId],
    );
    expect(row).toEqual({ consentBy: 'guardian' });
    // チームへの同意は AI コーチの同意にならない
    const [profile] = await query<{ aiGuardianConsentVersion: number | null }>(
      `select "aiGuardianConsentVersion" from profile where "userId" = $1`,
      [kidId],
    );
    expect(profile?.aiGuardianConsentVersion).toBeNull();
    expect(await agreeAsGuardian(aiHash, 2)).toBe('agreed');
  });

  it('コーチが招待を切ったあとは、保護者が同意しても入らない', async () => {
    const team = await teamWithInvite();
    const kidId = await minor();
    const invite = await findInvite(team.tokenHash);
    const teamHash = await guardianRequest(kidId, invite!.inviteId);
    await revokeInvites(team.coachId, team.teamId);

    expect(await agreeAsGuardian(teamHash, 2)).toBe('invalid');
    expect(await listMemberships(kidId)).toEqual([]);
  });

  it('招待を作り直すと、前の招待へのお願いは待っていることにならず、切れる', async () => {
    const team = await teamWithInvite();
    const kidId = await minor();
    const invite = await findInvite(team.tokenHash);
    const teamHash = await guardianRequest(kidId, invite!.inviteId);
    expect(await latestGuardianRequest(kidId, team.teamId)).toMatchObject({ live: true });

    await createInvite(team.coachId, team.teamId, hashInviteToken(newInviteToken()), INVITE_DAYS);
    expect(await latestGuardianRequest(kidId, team.teamId)).toBeNull();
    const [row] = await query<{ cancelledAt: Date | null }>(
      `select "cancelledAt" from guardian_consent_request where "tokenHash" = $1`,
      [teamHash],
    );
    expect(row?.cancelledAt).toBeInstanceOf(Date);
  });

  it('招待を切ると、その招待へのお願いは待っていることにならず、切れる', async () => {
    const team = await teamWithInvite();
    const kidId = await minor();
    const invite = await findInvite(team.tokenHash);
    const teamHash = await guardianRequest(kidId, invite!.inviteId);
    await revokeInvites(team.coachId, team.teamId);

    expect(await latestGuardianRequest(kidId, team.teamId)).toBeNull();
    const [row] = await query<{ cancelledAt: Date | null }>(
      `select "cancelledAt" from guardian_consent_request where "tokenHash" = $1`,
      [teamHash],
    );
    expect(row?.cancelledAt).toBeInstanceOf(Date);
  });

  it('期限の過ぎた招待へのお願いは、待っていることにならない', async () => {
    const team = await teamWithInvite();
    const kidId = await minor();
    const invite = await findInvite(team.tokenHash);
    await guardianRequest(kidId, invite!.inviteId);
    await query(`update team_invite set "expiresAt" = now() - interval '1 minute' where id = $1`, [
      invite!.inviteId,
    ]);
    expect(await latestGuardianRequest(kidId, team.teamId)).toBeNull();
  });

  it('保護者が同意したときにもう入っていれば already を返し、リンクを使ったことにしない', async () => {
    const team = await teamWithInvite();
    const kidId = await minor();
    const invite = await findInvite(team.tokenHash);
    const second = await guardianRequest(kidId, invite!.inviteId);
    // 先に別の経路（ここでは直に）で入っている
    await query(
      `insert into team_member ("teamId", "userId", "consentedAt", "consentBy") values ($1, $2, now(), 'guardian')`,
      [team.teamId, kidId],
    );
    expect(await agreeAsGuardian(second, 2)).toBe('already');
    const [row] = await query<{ usedAt: Date | null; cancelledAt: Date | null }>(
      `select "usedAt", "cancelledAt" from guardian_consent_request where "tokenHash" = $1`,
      [second],
    );
    expect(row).toMatchObject({ usedAt: null });
    expect(row?.cancelledAt).toBeInstanceOf(Date);
    expect(await agreeAsGuardian(second, 2)).toBe('invalid');
  });

  it('お願いした人がそのチームのコーチになっていたら coach を返し、入れない', async () => {
    const team = await teamWithInvite();
    const kidId = await minor();
    const invite = await findInvite(team.tokenHash);
    const teamHash = await guardianRequest(kidId, invite!.inviteId);
    await query(`insert into team_coach ("teamId", "userId") values ($1, $2)`, [
      team.teamId,
      kidId,
    ]);
    expect(await agreeAsGuardian(teamHash, 2)).toBe('coach');
    expect(await listMemberships(kidId)).toEqual([]);
    const [row] = await query<{ usedAt: Date | null }>(
      `select "usedAt" from guardian_consent_request where "tokenHash" = $1`,
      [teamHash],
    );
    expect(row?.usedAt).toBeNull();
  });

  it('抜けると、そのチームへの保護者の同意の記録（保護者のメールアドレス）も消える', async () => {
    const team = await teamWithInvite();
    const kidId = await minor();
    const invite = await findInvite(team.tokenHash);
    await agreeAsGuardian(await guardianRequest(kidId, invite!.inviteId), 2);
    await leaveTeam(kidId, team.teamId);
    const rows = await query(
      `select 1 from guardian_consent_request where "userId" = $1 and purpose = 'team'`,
      [kidId],
    );
    expect(rows).toEqual([]);
  });
});

describe('消したとき', () => {
  it('チームを消すと参加・招待・チームへのお願いが消え、選手の記録は残る', async () => {
    const team = await teamWithInvite();
    const athleteId = await adult();
    const kidId = await minor();
    const day = todayIn('Asia/Tokyo');
    await seedRecords(athleteId, day);
    await joinTeamBySelf(athleteId, team.tokenHash, false);
    const invite = await findInvite(team.tokenHash);
    await addGuardianRequest(kidId, {
      guardianEmail: 'parent@example.com',
      tokenHash: hashGuardianToken(newGuardianToken()),
      days: 7,
      perDay: 10,
      inviteId: invite!.inviteId,
    });

    expect(await deleteTeam(team.coachId, team.teamId)).toBe(true);
    for (const table of ['team_coach', 'team_member', 'team_invite']) {
      expect(await query(`select 1 from ${table} where "teamId" = $1`, [team.teamId])).toEqual([]);
    }
    expect(
      await query(`select 1 from guardian_consent_request where "userId" = $1`, [kidId]),
    ).toEqual([]);
    expect(await query(`select 1 from attempt where "userId" = $1`, [athleteId])).toHaveLength(2);
  });

  it('コーチがアカウントを消すとチームも消え、選手がアカウントを消すと参加だけが消える', async () => {
    const team = await teamWithInvite();
    const other = await teamWithInvite('Other');
    const athleteId = await adult();
    await joinTeamBySelf(athleteId, team.tokenHash, false);
    await joinTeamBySelf(athleteId, other.tokenHash, false);

    await query(`delete from "user" where id = $1`, [team.coachId]);
    expect(await query(`select 1 from team where id = $1`, [team.teamId])).toEqual([]);
    expect(await query(`select 1 from team_member where "teamId" = $1`, [team.teamId])).toEqual([]);

    await query(`delete from "user" where id = $1`, [athleteId]);
    expect(await query(`select 1 from team where id = $1`, [other.teamId])).toHaveLength(1);
    expect(await query(`select 1 from team_member where "teamId" = $1`, [other.teamId])).toEqual(
      [],
    );
  });

  it('コーチがほかにもいるチームは、1人が消えても残る', async () => {
    const team = await teamWithInvite();
    const secondCoach = await addProfile();
    await query(`insert into team_coach ("teamId", "userId") values ($1, $2)`, [
      team.teamId,
      secondCoach,
    ]);
    await query(`delete from "user" where id = $1`, [team.coachId]);
    expect(await getCoachedTeam(secondCoach, team.teamId)).not.toBeNull();
  });
});
