import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { addDays, todayIn } from '@/lib/dates';
import { COMMENTS_PER_DAY } from '@/lib/limits';
import { addProfile, query } from './seed';

/**
 * コーチと選手のコメント（src/lib/data.ts の day_comment の関数）を本物の DB で確かめる:
 * 1. コーチは、そのチームのコーチで相手がいまの選手のときだけ読み書きできる（ほかのチームのコーチ・選手でない人・抜けた人は不可）
 * 2. 選手は自分の日を、どのチームのものも読め、いま入っているチームにだけ書ける
 * 3. 消せるのは書いた本人だけ
 * 4. チーム・書いた人・選手のアカウントを消すと、コメントも消える
 * 5. 知らせの宛先は、そのチームのコーチ（書いた人を除く）の端末と、コーチが書いたときは選手の端末
 * 6. 書けるのは選手の時間帯の今日を含む直近14日だけで、1人が直近24時間に書けるのは COMMENTS_PER_DAY まで
 */

const {
  addCommentAsAthlete,
  addCommentAsCoach,
  commentPushTargets,
  createTeam,
  deleteComment,
  deleteTeam,
  leaveTeam,
  listDayComments,
  listMemberCommentsForCoach,
  removeMember,
} = await import('@/lib/data');

/** 選手（seed の既定は Asia/Tokyo）の今日。書ける日は今の時計で決まるので、決まった日付にしない */
const DAY = todayIn('Asia/Tokyo');

/** コーチとチームと、そのチームに入った選手 */
async function teamWithAthlete(name = 'Hawks') {
  const coachId = await addProfile({ name: 'Coach' });
  const teamId = await createTeam(coachId, name);
  const athleteId = await addProfile({ name: 'Athlete' });
  await query(
    `insert into team_member ("teamId", "userId", "consentedAt", "consentBy") values ($1, $2, now(), 'self')`,
    [teamId, athleteId],
  );
  return { coachId, teamId, athleteId, access: { coachId, teamId, memberId: athleteId } };
}

const coachReads = (access: { coachId: string; teamId: string; memberId: string }) =>
  listMemberCommentsForCoach(access, DAY, DAY).then((rows) => rows.map((r) => r.body));

async function subscribe(userId: string, locale: 'en' | 'ja' = 'en') {
  const endpoint = `https://fcm.googleapis.com/fcm/send/${randomUUID()}`;
  await query(
    `insert into push_subscription (endpoint, "userId", p256dh, auth, locale) values ($1, $2, 'p', 'a', $3)`,
    [endpoint, userId, locale],
  );
  return endpoint;
}

describe('書く・読む', () => {
  it('コーチと選手がやりとりでき、どちらも同じやりとりを古い順に読む。書き手と役が分かる', async () => {
    const { coachId, teamId, athleteId, access } = await teamWithAthlete();
    expect(await addCommentAsCoach(access, DAY, 'Nice take-off')).toBe('ok');
    expect(await addCommentAsAthlete(athleteId, teamId, DAY, 'Thanks')).toBe('ok');

    const forCoach = await listMemberCommentsForCoach(access, DAY, DAY);
    const forAthlete = await listDayComments(athleteId, DAY);
    expect(
      forCoach.map((c) => ({ body: c.body, byCoach: c.byCoach, author: c.authorId, day: c.day })),
    ).toEqual([
      { body: 'Nice take-off', byCoach: true, author: coachId, day: DAY },
      { body: 'Thanks', byCoach: false, author: athleteId, day: DAY },
    ]);
    expect(forAthlete.map((c) => [c.body, c.authorName, c.teamName])).toEqual([
      ['Nice take-off', 'Coach', 'Hawks'],
      ['Thanks', 'Athlete', 'Hawks'],
    ]);
  });

  it('ほかのチームのコーチ・選手でない人の組・ほかのチームの id では、読めず書けない', async () => {
    const { teamId, athleteId, access } = await teamWithAthlete();
    await addCommentAsCoach(access, DAY, 'Secret');
    const other = await teamWithAthlete('Owls');
    const stranger = await addProfile();

    const attempts = [
      // ほかのチームのコーチが、自分のチームの id でこの選手を
      { coachId: other.coachId, teamId: other.teamId, memberId: athleteId },
      // ほかのチームのコーチが、この選手のチームの id で
      { coachId: other.coachId, teamId, memberId: athleteId },
      // チームに関係のない人が
      { coachId: stranger, teamId, memberId: athleteId },
      // このチームのコーチが、ほかのチームの選手を
      { coachId: access.coachId, teamId, memberId: other.athleteId },
    ];
    const reads = await Promise.all(attempts.map(coachReads));
    const writes = await Promise.all(attempts.map((a) => addCommentAsCoach(a, DAY, 'x')));
    expect(reads).toEqual([[], [], [], []]);
    expect(writes).toEqual(['denied', 'denied', 'denied', 'denied']);
    // 選手でない人は、そのチームに選手として書けない
    expect(await addCommentAsAthlete(stranger, teamId, DAY, 'x')).toBe('denied');
    expect(await coachReads(access)).toEqual(['Secret']);
  });

  it('選手が抜けると、コーチはそのときから読めず書けない。選手は抜けたチームのやりとりを読めるが、書き足せない', async () => {
    const { teamId, athleteId, access } = await teamWithAthlete();
    await addCommentAsCoach(access, DAY, 'Before');
    await leaveTeam(athleteId, teamId);

    expect(await coachReads(access)).toEqual([]);
    expect(await addCommentAsCoach(access, DAY, 'After')).toBe('denied');
    expect(await addCommentAsAthlete(athleteId, teamId, DAY, 'Reply')).toBe('denied');
    expect((await listDayComments(athleteId, DAY)).map((c) => c.body)).toEqual(['Before']);
  });

  it('外された選手のやりとりも、コーチから見えなくなる', async () => {
    const { coachId, teamId, athleteId, access } = await teamWithAthlete();
    await addCommentAsCoach(access, DAY, 'Hi');
    await removeMember(coachId, teamId, athleteId);
    expect(await coachReads(access)).toEqual([]);
  });

  it('2つのチームに入っている選手のやりとりは、チームごとに分かれ、コーチは自分のチームのものだけ読む', async () => {
    const a = await teamWithAthlete('A');
    const coachB = await addProfile({ name: 'Coach B' });
    const teamB = await createTeam(coachB, 'B');
    await query(
      `insert into team_member ("teamId", "userId", "consentedAt", "consentBy") values ($1, $2, now(), 'self')`,
      [teamB, a.athleteId],
    );
    const accessB = { coachId: coachB, teamId: teamB, memberId: a.athleteId };
    await addCommentAsCoach(a.access, DAY, 'From A');
    await addCommentAsCoach(accessB, DAY, 'From B');
    await addCommentAsAthlete(a.athleteId, teamB, DAY, 'To B');

    expect(await coachReads(a.access)).toEqual(['From A']);
    expect(await coachReads(accessB)).toEqual(['From B', 'To B']);
    expect((await listDayComments(a.athleteId, DAY)).map((c) => [c.teamName, c.body])).toEqual([
      ['A', 'From A'],
      ['B', 'From B'],
      ['B', 'To B'],
    ]);
  });
});

describe('書ける日と数', () => {
  it('選手の時間帯の今日を含む直近14日だけ書ける（先の日と14日前は、コーチも選手も書けない）', async () => {
    const { teamId, athleteId, access } = await teamWithAthlete();
    const days = [addDays(DAY, 1), DAY, addDays(DAY, -13), addDays(DAY, -14)];
    const byCoach = [];
    const byAthlete = [];
    for (const day of days) {
      byCoach.push(await addCommentAsCoach(access, day, 'c'));
      byAthlete.push(await addCommentAsAthlete(athleteId, teamId, day, 'a'));
    }
    expect({ byCoach, byAthlete }).toEqual({
      byCoach: ['denied', 'ok', 'ok', 'denied'],
      byAthlete: ['denied', 'ok', 'ok', 'denied'],
    });
  });

  it('今日は選手の時間帯で数える（UTC より1日先の時間帯の選手の今日にも書ける）', async () => {
    const coachId = await addProfile({ name: 'Coach' });
    const teamId = await createTeam(coachId, 'Kiri');
    const athleteId = await addProfile({ timeZone: 'Pacific/Kiritimati' });
    await query(
      `insert into team_member ("teamId", "userId", "consentedAt", "consentBy") values ($1, $2, now(), 'self')`,
      [teamId, athleteId],
    );
    const theirToday = todayIn('Pacific/Kiritimati');
    expect(
      await addCommentAsCoach({ coachId, teamId, memberId: athleteId }, theirToday, 'Hi'),
    ).toBe('ok');
  });

  it(`1人が直近24時間に書けるのは ${COMMENTS_PER_DAY} まで。24時間より前のものは数えない`, async () => {
    const { coachId, teamId, athleteId, access } = await teamWithAthlete();
    const fill = (count: number, age: string) =>
      query(
        `insert into day_comment ("athleteId", day, "authorId", "teamId", body, "createdAt")
         select $1, $2::date, $3, $4, 'x', now() - $5::interval from generate_series(1, $6)`,
        [athleteId, DAY, coachId, teamId, age, count],
      );
    await fill(COMMENTS_PER_DAY, '25 hours');
    await fill(COMMENTS_PER_DAY - 1, '1 hour');
    const last = await addCommentAsCoach(access, DAY, 'Last');
    const over = await addCommentAsCoach(access, DAY, 'Over');
    // 選手は自分の数で数える（コーチが書きすぎても、選手は書ける）
    const athlete = await addCommentAsAthlete(athleteId, teamId, DAY, 'Reply');
    expect({ last, over, athlete }).toEqual({ last: 'ok', over: 'limit', athlete: 'ok' });
  });
});

describe('消す', () => {
  it('書いた本人だけが消せる。相手のコメントは、コーチも選手も消せない', async () => {
    const { teamId, athleteId, access } = await teamWithAthlete();
    await addCommentAsCoach(access, DAY, 'Coach');
    await addCommentAsAthlete(athleteId, teamId, DAY, 'Athlete');
    const [byCoach, byAthlete] = await listDayComments(athleteId, DAY);
    const stranger = await addProfile();

    const refused = [
      await deleteComment(athleteId, byCoach!.id),
      await deleteComment(access.coachId, byAthlete!.id),
      await deleteComment(stranger, byCoach!.id),
    ];
    expect(refused).toEqual([false, false, false]);
    expect(await deleteComment(access.coachId, byCoach!.id)).toBe(true);
    expect(await deleteComment(athleteId, byAthlete!.id)).toBe(true);
    expect(await listDayComments(athleteId, DAY)).toEqual([]);
  });

  it('選手が抜けたあとは、コーチは自分のコメントも消せない（見えないものは触れない）。選手は自分のものを消せる', async () => {
    const { teamId, athleteId, access } = await teamWithAthlete();
    await addCommentAsCoach(access, DAY, 'Coach');
    await addCommentAsAthlete(athleteId, teamId, DAY, 'Athlete');
    const [byCoach, byAthlete] = await listDayComments(athleteId, DAY);
    await leaveTeam(athleteId, teamId);

    expect(await deleteComment(access.coachId, byCoach!.id)).toBe(false);
    expect(await deleteComment(athleteId, byAthlete!.id)).toBe(true);
  });
});

describe('アカウントやチームを消したとき', () => {
  const count = async (athleteId: string) =>
    Number(
      (
        await query<{ count: string }>(`select count(*) from day_comment where "athleteId" = $1`, [
          athleteId,
        ])
      )[0]!.count,
    );

  it('チームを消すと、そのチームのやりとりが消える', async () => {
    const { coachId, teamId, athleteId, access } = await teamWithAthlete();
    await addCommentAsCoach(access, DAY, 'Hi');
    await addCommentAsAthlete(athleteId, teamId, DAY, 'Hello');
    await deleteTeam(coachId, teamId);
    expect(await count(athleteId)).toBe(0);
  });

  it('コーチがアカウントを消すと、そのコーチのコメント（とチーム）が消える', async () => {
    const { coachId, athleteId, access } = await teamWithAthlete();
    await addCommentAsCoach(access, DAY, 'Hi');
    await query(`delete from "user" where id = $1`, [coachId]);
    expect(await count(athleteId)).toBe(0);
  });

  it('選手がアカウントを消すと、その人の日のやりとりがすべて消える（コーチのコメントも）', async () => {
    const { teamId, athleteId, access } = await teamWithAthlete();
    await addCommentAsCoach(access, DAY, 'Hi');
    await addCommentAsAthlete(athleteId, teamId, DAY, 'Hello');
    await query(`delete from "user" where id = $1`, [athleteId]);
    expect(await count(athleteId)).toBe(0);
  });

  it('コーチがほかにもいるチームでは、1人がアカウントを消しても、ほかの人のコメントは残る', async () => {
    const { teamId, athleteId, access } = await teamWithAthlete();
    const second = await addProfile({ name: 'Second' });
    await query(`insert into team_coach ("teamId", "userId") values ($1, $2)`, [teamId, second]);
    await addCommentAsCoach(access, DAY, 'First');
    await addCommentAsCoach({ ...access, coachId: second }, DAY, 'Second');
    await addCommentAsAthlete(athleteId, teamId, DAY, 'Athlete');
    await query(`delete from "user" where id = $1`, [access.coachId]);
    expect((await listDayComments(athleteId, DAY)).map((c) => c.body)).toEqual([
      'Second',
      'Athlete',
    ]);
  });
});

describe('知らせの宛先（commentPushTargets）', () => {
  it('選手が書けばそのチームのコーチ全員、コーチが書けば選手とほかのコーチ（書いた人を除く）。名前とチームの名前つき', async () => {
    const { coachId, teamId, athleteId } = await teamWithAthlete();
    const second = await addProfile({ name: 'Second' });
    await query(`insert into team_coach ("teamId", "userId") values ($1, $2)`, [teamId, second]);
    const athletePhone = await subscribe(athleteId, 'ja');
    const coachPhone = await subscribe(coachId);
    const secondPhone = await subscribe(second);

    const targets = async (authorId: string) =>
      (await commentPushTargets({ teamId, athleteId, authorId }))?.targets
        .map((t) => [t.endpoint, t.locale, t.toCoach] as const)
        .toSorted(([a], [b]) => a.localeCompare(b));
    const sorted = (list: (readonly [string, string, boolean])[]) =>
      list.toSorted(([a], [b]) => a.localeCompare(b));
    const found = await commentPushTargets({ teamId, athleteId, authorId: athleteId });
    expect({
      byAthlete: await targets(athleteId),
      byCoach: await targets(coachId),
      names: [found?.athleteName, found?.teamName],
    }).toEqual({
      byAthlete: sorted([
        [coachPhone, 'en', true],
        [secondPhone, 'en', true],
      ]),
      byCoach: sorted([
        [athletePhone, 'ja', false],
        [secondPhone, 'en', true],
      ]),
      names: ['Athlete', 'Hawks'],
    });
  });

  it('選手が通知を入れていなければ宛先は空。抜けた選手のやりとりには送らない（null）', async () => {
    const { coachId, teamId, athleteId } = await teamWithAthlete();
    const empty = await commentPushTargets({ teamId, athleteId, authorId: coachId });
    await leaveTeam(athleteId, teamId);
    const left = await commentPushTargets({ teamId, athleteId, authorId: coachId });
    expect([empty?.targets, left]).toEqual([[], null]);
  });
});
