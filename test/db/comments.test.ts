import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { addProfile, query } from './seed';

/**
 * コーチと選手のコメント（src/lib/data.ts の day_comment の関数）を本物の DB で確かめる:
 * 1. コーチは、そのチームのコーチで相手がいまの選手のときだけ読み書きできる（ほかのチームのコーチ・選手でない人・抜けた人は不可）
 * 2. 選手は自分の日を、どのチームのものも読め、いま入っているチームにだけ書ける
 * 3. 消せるのは書いた本人だけ
 * 4. チーム・書いた人・選手のアカウントを消すと、コメントも消える
 * 5. 知らせの宛先は、コーチが書けば選手の端末、選手が書けばそのチームのほかのコーチの端末
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

const DAY = '2026-10-14';

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
    expect(await addCommentAsCoach(access, DAY, 'Nice take-off')).toBe(true);
    expect(await addCommentAsAthlete(athleteId, teamId, DAY, 'Thanks')).toBe(true);

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
    expect(writes).toEqual([false, false, false, false]);
    // 選手でない人は、そのチームに選手として書けない
    expect(await addCommentAsAthlete(stranger, teamId, DAY, 'x')).toBe(false);
    expect(await coachReads(access)).toEqual(['Secret']);
  });

  it('選手が抜けると、コーチはそのときから読めず書けない。選手は抜けたチームのやりとりを読めるが、書き足せない', async () => {
    const { teamId, athleteId, access } = await teamWithAthlete();
    await addCommentAsCoach(access, DAY, 'Before');
    await leaveTeam(athleteId, teamId);

    expect(await coachReads(access)).toEqual([]);
    expect(await addCommentAsCoach(access, DAY, 'After')).toBe(false);
    expect(await addCommentAsAthlete(athleteId, teamId, DAY, 'Reply')).toBe(false);
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
  it('コーチが書けば選手の端末、選手が書けばそのチームのほかのコーチの端末。名前とチームの名前つき', async () => {
    const { coachId, teamId, athleteId } = await teamWithAthlete();
    const second = await addProfile({ name: 'Second' });
    await query(`insert into team_coach ("teamId", "userId") values ($1, $2)`, [teamId, second]);
    const athletePhone = await subscribe(athleteId, 'ja');
    const coachPhone = await subscribe(coachId);
    const secondPhone = await subscribe(second);

    const toAthlete = await commentPushTargets({
      teamId,
      athleteId,
      authorId: coachId,
      toCoaches: false,
    });
    const toCoaches = await commentPushTargets({
      teamId,
      athleteId,
      authorId: athleteId,
      toCoaches: true,
    });
    // 2人目のコーチが書いたら、1人目のコーチへは送らない（選手へ送る）。コーチどうしで送り合わない
    expect({
      athlete: toAthlete?.targets.map((t) => [t.endpoint, t.locale]),
      coaches: toCoaches?.targets.map((t) => t.endpoint).toSorted(),
      names: [toCoaches?.athleteName, toCoaches?.teamName],
    }).toEqual({
      athlete: [[athletePhone, 'ja']],
      coaches: [coachPhone, secondPhone].toSorted(),
      names: ['Athlete', 'Hawks'],
    });
  });

  it('選手が通知を入れていなければ宛先は空。抜けた選手のやりとりには送らない（null）', async () => {
    const { coachId, teamId, athleteId } = await teamWithAthlete();
    const empty = await commentPushTargets({
      teamId,
      athleteId,
      authorId: coachId,
      toCoaches: false,
    });
    await leaveTeam(athleteId, teamId);
    const left = await commentPushTargets({
      teamId,
      athleteId,
      authorId: coachId,
      toCoaches: false,
    });
    expect([empty?.targets, left]).toEqual([[], null]);
  });
});
