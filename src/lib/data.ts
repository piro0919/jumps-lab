import 'server-only';
import { todayIn } from '@/lib/dates';
import { db } from '@/lib/db';
import type { JumpEvent } from '@/lib/events';
import type { Locale } from '@/i18n/locales';
import type { ReminderRow } from '@/lib/meet-reminder';
import type { Menu, MenuLevel } from '@/lib/menu';
import type { PushTarget } from '@/lib/push-endpoint';
import { consenterFor, declaredFromBirthdate } from '@/lib/guardian';
import type { Grade, Plan } from '@/lib/profile-options';
import type { Units } from '@/lib/units';
import { toMarks, type MarkName, type Marks } from '@/lib/video-marks';

/**
 * DB の読み書き。どの関数も userId を引数に取り、その人の行だけを触る。
 * userId は requireViewer() が決めたものだけを渡す。
 * pg は numeric を文字列で返すので、ここで数に直す
 */

const num = (value: string | null): number | null => (value === null ? null : Number(value));

export type Profile = {
  name: string;
  /** 手で選んだ学年。学年を計算する人（src/lib/grade.ts の computesGrade）は使わない */
  grade: Grade | null;
  /** 計算した学年とのずれ（年数） */
  gradeOffset: number;
  birthdate: string | null;
  gender: 'male' | 'female' | 'other' | null;
  heightCm: number | null;
  weightKg: number | null;
  events: JumpEvent[];
  units: Units;
  seasonStartMonth: number;
  /** 週の始まり。0 が日曜、1 が月曜 */
  weekStart: 0 | 1;
  timeZone: string;
  /** プラン。AI の機能は premium だけ（src/lib/ai.ts の aiEnabled）。プロフィールの保存では変えない */
  plan: Plan;
  /** 同意した AI コーチの説明の版。null はまだ（src/lib/ai.ts の aiUsable）。プロフィールの保存では変えない */
  aiConsentVersion: number | null;
  /** 保護者が同意した AI コーチの説明の版（16歳未満の人。src/lib/guardian.ts）。null はまだ */
  aiGuardianConsentVersion: number | null;
  /** 生年月日の無い人が答えた「16歳以上か」。null はまだ答えていない */
  ageDeclared16Plus: boolean | null;
};

type ProfileRow = Omit<Profile, 'heightCm' | 'weightKg'> & {
  heightCm: string | null;
  weightKg: string | null;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const { rows } = await db().query<ProfileRow>(
    `select u.name, p.grade, p."gradeOffset", to_char(p.birthdate, 'YYYY-MM-DD') as birthdate, p.gender, p."heightCm", p."weightKg", p.events,
            p.units, p."seasonStartMonth", p."weekStart", p."timeZone", p.plan, p."aiConsentVersion",
            p."aiGuardianConsentVersion", p."ageDeclared16Plus"
       from profile p join "user" u on u.id = p."userId"
      where p."userId" = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return null;
  return { ...row, heightCm: num(row.heightCm), weightKg: num(row.weightKg) };
}

export type ProfileInput = Omit<
  Profile,
  'plan' | 'aiConsentVersion' | 'aiGuardianConsentVersion' | 'ageDeclared16Plus'
> & { goalM: number | null };

/**
 * プロフィールを保存する。名前は Better Auth の user 表に持つ。
 * 生年月日があれば「16歳以上か」も一緒に残す（src/lib/guardian.ts の declaredFromBirthdate）。
 * 目標は、はじめに選んだ先頭の種目の今季目標として入れる（プロトタイプの「目標記録」）
 */
export async function saveProfile(userId: string, input: ProfileInput): Promise<void> {
  const client = await db().connect();
  try {
    await client.query('begin');
    await client.query(`update "user" set name = $2, "updatedAt" = now() where id = $1`, [
      userId,
      input.name,
    ]);
    await client.query(
      `insert into profile ("userId", grade, "gradeOffset", birthdate, gender, "heightCm", "weightKg", events,
                            units, "seasonStartMonth", "timeZone", "weekStart", "ageDeclared16Plus")
       values ($1, $2, $11, $3, $4, $5, $6, $7::text[], $8, $9, $10, $12, $13)
       on conflict ("userId") do update set
         grade = excluded.grade, "gradeOffset" = excluded."gradeOffset",
         birthdate = excluded.birthdate, gender = excluded.gender,
         "heightCm" = excluded."heightCm", "weightKg" = excluded."weightKg",
         events = excluded.events,
         units = excluded.units, "seasonStartMonth" = excluded."seasonStartMonth",
         "timeZone" = excluded."timeZone", "weekStart" = excluded."weekStart",
         "ageDeclared16Plus" = coalesce(excluded."ageDeclared16Plus", profile."ageDeclared16Plus"),
         "updatedAt" = now()`,
      [
        userId,
        input.grade,
        input.birthdate,
        input.gender,
        input.heightCm,
        input.weightKg,
        input.events,
        input.units,
        input.seasonStartMonth,
        input.timeZone,
        input.gradeOffset,
        input.weekStart,
        declaredFromBirthdate(input.birthdate, todayIn(input.timeZone)),
      ],
    );
    if (input.goalM !== null) {
      await client.query(
        `insert into event_target ("userId", event, "seasonGoalM") values ($1, $2, $3)
         on conflict ("userId", event) do update set "seasonGoalM" = excluded."seasonGoalM",
                                                     "updatedAt" = now()`,
        [userId, input.events[0], input.goalM],
      );
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/** 設定の画面の「プロフィール」の区画で保存するもの */
export type ProfileDetails = Pick<
  Profile,
  'name' | 'grade' | 'gradeOffset' | 'birthdate' | 'gender' | 'heightCm' | 'weightKg' | 'timeZone'
>;

/**
 * 設定の画面の「プロフィール」の区画だけを保存する。記録のつけ方（種目・単位・シーズン）には触れない。
 * 生年月日があれば「16歳以上か」も一緒に残す。生年月日を消しても前の答えは残る（16歳未満と分かった人が消して同意しないように）
 */
export async function saveProfileDetails(userId: string, input: ProfileDetails): Promise<void> {
  const client = await db().connect();
  try {
    await client.query('begin');
    await client.query(`update "user" set name = $2, "updatedAt" = now() where id = $1`, [
      userId,
      input.name,
    ]);
    await client.query(
      `update profile set grade = $2, "gradeOffset" = $3, birthdate = $4, gender = $5,
              "heightCm" = $6, "weightKg" = $7, "timeZone" = $8,
              "ageDeclared16Plus" = coalesce($9, "ageDeclared16Plus"), "updatedAt" = now()
        where "userId" = $1`,
      [
        userId,
        input.grade,
        input.gradeOffset,
        input.birthdate,
        input.gender,
        input.heightCm,
        input.weightKg,
        input.timeZone,
        declaredFromBirthdate(input.birthdate, todayIn(input.timeZone)),
      ],
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * AI コーチの説明（version の版）に本人が同意したことを入れる。同じ版にもう同意していれば時刻は変えない。
 * 版が上がって同意し直したときは、時刻も新しい版に同意した時刻に変わる。
 * declare16Plus は生年月日の無い人が「16歳以上です」と答えて押したこと。答えも残すが、
 * もう16歳未満と分かっている人（"ageDeclared16Plus" が false）は入れずに false を返す（答えを上書きして本人だけで同意させない）
 */
export async function consentToAi(
  userId: string,
  version: number,
  declare16Plus: boolean,
): Promise<boolean> {
  const { rowCount } = await db().query(
    `update profile
        set "aiConsentAt" = case when "aiConsentVersion" is distinct from $2 then now() else "aiConsentAt" end,
            "aiConsentVersion" = $2,
            "ageDeclared16Plus" = case when $3 then true else "ageDeclared16Plus" end,
            "updatedAt" = now()
      where "userId" = $1 and not ($3 and "ageDeclared16Plus" is false)`,
    [userId, version, declare16Plus],
  );
  return rowCount === 1;
}

/**
 * 生年月日の無い人が「16歳未満です」と答えたことを残す（保護者へのお願いを送れたとき）。
 * 一度残すと、本人の答えでは16歳以上に戻せない。戻せるのは16歳以上と分かる生年月日の保存だけ
 */
export async function declareUnder16(userId: string): Promise<void> {
  await db().query(
    `update profile set "ageDeclared16Plus" = false, "updatedAt" = now() where "userId" = $1`,
    [userId],
  );
}

/** 本人の画面に出す、保護者へのお願い（いちばん新しい、使われていないもの） */
export type GuardianRequest = { id: string; guardianEmail: string; live: boolean };

/**
 * 保護者へのお願い r（guardian_consent_request）が、$2 の招待と同じことへのお願いか。
 * $2 が null なら AI コーチのお願い、招待なら同じチームへの参加のお願い（招待を作り直してもチームで数える）
 */
const SAME_PURPOSE = `(case when $2::uuid is null then r.purpose = 'ai'
  else r.purpose = 'team' and (select i."teamId" from team_invite i where i.id = r."inviteId")
                            = (select i."teamId" from team_invite i where i.id = $2::uuid) end)`;

/**
 * 保護者へのお願いを1件入れる（メールを送る前）。24時間に送った数が perDay に達していれば入れずに null。
 * 人ごとのロックを取ってから数え、入れる前にこの人のまだ使われていないお願いをみな切る（"cancelledAt"）。
 * 同時に押した2回が、どちらも古い数を見て上限を抜けたり、生きたリンクを2つ残したりしないように。
 * メールを送れずに新しい行を消しても、切った前のお願いは戻さない（もう一度送ってもらう）
 */
export async function addGuardianRequest(
  userId: string,
  request: {
    guardianEmail: string;
    tokenHash: string;
    days: number;
    perDay: number;
    /** チームへの参加のお願いなら、その招待（無ければ AI コーチのお願い） */
    inviteId?: string;
  },
): Promise<string | null> {
  const inviteId = request.inviteId ?? null;
  const client = await db().connect();
  try {
    await client.query('begin');
    await client.query(`select pg_advisory_xact_lock(hashtext('guardian:' || $1))`, [userId]);
    // 24時間の回数は、AI コーチとチームのお願いを合わせて数える（メールの送り先を他人に向けて連打させない）
    const { rows: counted } = await client.query<{ sent: number }>(
      `select count(*)::integer as sent from guardian_consent_request
        where "userId" = $1 and "createdAt" > now() - interval '1 day'`,
      [userId],
    );
    if ((counted[0]?.sent ?? 0) >= request.perDay) {
      await client.query('rollback');
      return null;
    }
    // 切るのは同じことへのお願いだけ（AI コーチなら AI コーチの、チームなら同じチームの）
    await client.query(
      `update guardian_consent_request r
          set "cancelledAt" = now(), "expiresAt" = least(r."expiresAt", now())
        where r."userId" = $1 and r."usedAt" is null and r."cancelledAt" is null
          and ${SAME_PURPOSE}`,
      [userId, inviteId],
    );
    const { rows } = await client.query<{ id: string }>(
      `insert into guardian_consent_request ("userId", "guardianEmail", "tokenHash", "expiresAt", purpose, "inviteId")
       values ($1, $2, $3, now() + make_interval(days => $4::integer),
               case when $5::uuid is null then 'ai' else 'team' end, $5)
       returning id`,
      [userId, request.guardianEmail, request.tokenHash, request.days, inviteId],
    );
    await client.query('commit');
    return rows[0]?.id ?? null;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/** メールを送れなかったお願いを消す（送れていないリンクで回数を使わせない） */
export async function releaseGuardianRequest(userId: string, id: string): Promise<void> {
  await db().query(`delete from guardian_consent_request where "userId" = $1 and id = $2`, [
    userId,
    id,
  ]);
}

/**
 * 待っているお願い（使われておらず、送り直しや保護者の同意で切られていないもの）。live は期限の内か。
 * 切られた行は出さない（「期限が切れました」と出したり、古い宛先へ送り直したりしないように）
 */
export async function latestGuardianRequest(
  userId: string,
  /** チームへの参加のお願いなら、そのチーム（無ければ AI コーチのお願い） */
  teamId: string | null = null,
): Promise<GuardianRequest | null> {
  const { rows } = await db().query<GuardianRequest>(
    `select r.id, r."guardianEmail", r."expiresAt" > now() as live
       from guardian_consent_request r left join team_invite i on i.id = r."inviteId"
      where r."userId" = $1 and r."usedAt" is null and r."cancelledAt" is null
        and (case when $2::uuid is null then r.purpose = 'ai' else r.purpose = 'team' and i."teamId" = $2 end)
      order by r."createdAt" desc limit 1`,
    [userId, teamId],
  );
  return rows[0] ?? null;
}

/** 保護者のリンクの行。チームへの参加のお願いなら、チームの名前・コーチの表示名・招待がまだ使えるかも */
export type GuardianLink = {
  childName: string;
  usedAt: Date | null;
  expiresAt: Date;
  /** AI コーチのお願いなら null */
  team: { name: string; coaches: string[]; inviteLive: boolean } | null;
};

/** 保護者のリンクの行と、お願いした人の表示名。鍵はハッシュで探す。無ければ null */
export async function findGuardianRequest(tokenHash: string): Promise<GuardianLink | null> {
  const { rows } = await db().query<
    Omit<GuardianLink, 'team'> & {
      teamName: string | null;
      coaches: string[] | null;
      inviteLive: boolean | null;
    }
  >(
    `select u.name as "childName", r."usedAt", r."expiresAt", t.name as "teamName",
            ${TEAM_COACH_NAMES} as coaches,
            (i."revokedAt" is null and i."expiresAt" > now()) as "inviteLive"
       from guardian_consent_request r join "user" u on u.id = r."userId"
       left join team_invite i on i.id = r."inviteId"
       left join team t on t.id = i."teamId"
      where r."tokenHash" = $1`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) return null;
  const { teamName, coaches, inviteLive, ...rest } = row;
  return {
    ...rest,
    team:
      teamName === null
        ? null
        : { name: teamName, coaches: coaches ?? [], inviteLive: inviteLive === true },
  };
}

/** チーム t のコーチの表示名（コーチになった順） */
const TEAM_COACH_NAMES = `(select coalesce(array_agg(cu.name order by c."createdAt"), '{}')
     from team_coach c join "user" cu on cu.id = c."userId" where c."teamId" = t.id)`;

/**
 * 保護者が同意した（ログインの無い画面から）。リンクが期限の内で使われていなければ、1回だけ使う。
 * - AI コーチのお願い: お願いした人に version の版の保護者の同意を入れる
 * - チームへの参加のお願い: 招待がまだ使える（切られておらず期限の内）ときだけ、お願いした人をチームに入れる
 *   （同意したのは保護者と残す）。コーチが切った招待で入らないように
 * 同じことへのほかのリンクは切り、前の同意の記録（前の行）は消す。使えたら true
 */
export async function agreeAsGuardian(tokenHash: string, version: number): Promise<boolean> {
  const client = await db().connect();
  try {
    await client.query('begin');
    const { rows } = await client.query<{ id: string; userId: string; inviteId: string | null }>(
      `update guardian_consent_request r set "usedAt" = now()
        where r."tokenHash" = $1 and r."usedAt" is null and r."expiresAt" > now()
          and (r.purpose = 'ai' or exists (
                select 1 from team_invite i
                 where i.id = r."inviteId" and i."revokedAt" is null and i."expiresAt" > now()))
        returning r.id, r."userId", r."inviteId"`,
      [tokenHash],
    );
    const used = rows[0];
    if (!used) {
      await client.query('rollback');
      return false;
    }
    if (used.inviteId === null) {
      await client.query(
        `update profile set "aiGuardianConsentVersion" = $2, "aiGuardianConsentAt" = now(), "updatedAt" = now()
          where "userId" = $1`,
        [used.userId, version],
      );
    } else {
      // コーチ本人はそのチームの選手にしない（自分の記録を自分に見せても意味が無い）
      await client.query(
        `insert into team_member ("teamId", "userId", "consentedAt", "consentBy")
         select i."teamId", $1, now(), 'guardian' from team_invite i
          where i.id = $2
            and not exists (select 1 from team_coach c where c."teamId" = i."teamId" and c."userId" = $1)
         on conflict ("teamId", "userId") do nothing`,
        [used.userId, used.inviteId],
      );
    }
    await client.query(
      `update guardian_consent_request r
          set "cancelledAt" = now(), "expiresAt" = least(r."expiresAt", now())
        where r."userId" = $1 and r.id <> $3 and r."usedAt" is null and r."cancelledAt" is null
          and ${SAME_PURPOSE}`,
      [used.userId, used.inviteId, used.id],
    );
    await client.query(
      `delete from guardian_consent_request r
        where r."userId" = $1 and r.id <> $3 and r."usedAt" is not null and ${SAME_PURPOSE}`,
      [used.userId, used.inviteId, used.id],
    );
    await client.query('commit');
    return true;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 使われずに期限の過ぎたお願いを消す（保護者のメールアドレスを残さない）。期限の翌日まで残すのは、
 * 24時間に送った回数を数えるため。大会の知らせの Cron が一緒に呼ぶ。消した数を返す
 */
export async function purgeGuardianRequests(): Promise<number> {
  const { rowCount } = await db().query(
    `delete from guardian_consent_request
      where "usedAt" is null and "expiresAt" < now() - interval '1 day'`,
  );
  return rowCount ?? 0;
}

/** 設定の画面の「記録」の区画で保存するもの */
export type RecordSettings = Pick<
  Profile,
  'events' | 'units' | 'seasonStartMonth' | 'weekStart' | 'timeZone'
>;

/** 設定の画面の「記録」の区画だけを保存する。名前や身長などには触れない */
export async function saveRecordSettings(userId: string, input: RecordSettings): Promise<void> {
  await db().query(
    `update profile set events = $2::text[], units = $3, "seasonStartMonth" = $4, "timeZone" = $5,
            "weekStart" = $6, "updatedAt" = now()
      where "userId" = $1`,
    [userId, input.events, input.units, input.seasonStartMonth, input.timeZone, input.weekStart],
  );
}

export type Target = {
  seasonGoalM: number | null;
  manualPbM: number | null;
  manualSbM: number | null;
  manualSbSeason: number | null;
  manualPracticeBestM: number | null;
};

function toTarget(row: Record<keyof Target, string | null> | undefined): Target {
  return {
    seasonGoalM: num(row?.seasonGoalM ?? null),
    manualPbM: num(row?.manualPbM ?? null),
    manualSbM: num(row?.manualSbM ?? null),
    manualSbSeason: num(row?.manualSbSeason ?? null),
    manualPracticeBestM: num(row?.manualPracticeBestM ?? null),
  };
}

/** 種目ごとの目標と手で入れたベスト。行の無い種目は空の値 */
export async function getTargets(
  userId: string,
  events: JumpEvent[],
): Promise<Map<JumpEvent, Target>> {
  // 種目ごとに問い合わせると、4種目でプールの接続を4本ふさぐ。1回でまとめて読む
  const { rows } = await db().query<Record<keyof Target, string | null> & { event: JumpEvent }>(
    `select event, "seasonGoalM", "manualPbM", "manualSbM", "manualSbSeason", "manualPracticeBestM"
       from event_target where "userId" = $1 and event = any($2::text[])`,
    [userId, events],
  );
  return new Map(events.map((event) => [event, toTarget(rows.find((row) => row.event === event))]));
}

/** 目標と手で入れたベストのうち、1つだけを書き換える */
export async function saveTargetField(
  userId: string,
  event: JumpEvent,
  field: 'seasonGoalM' | 'manualPbM' | 'manualSbM' | 'manualPracticeBestM',
  value: number | null,
  season: number,
): Promise<void> {
  // 列の名前は型で4つに限っているので、文字列に埋めてよい。
  // SB を書くときだけ、どのシーズンの値かも残す
  const isSb = field === 'manualSbM';
  await db().query(
    `insert into event_target ("userId", event, "${field}", "manualSbSeason")
     values ($1, $2, $3, case when $5 then $4::smallint end)
     on conflict ("userId", event) do update set
       "${field}" = $3,
       "manualSbSeason" = case when $5 then $4::smallint else event_target."manualSbSeason" end,
       "updatedAt" = now()`,
    [userId, event, value, season, isSb],
  );
}

export type Attempt = {
  id: string;
  day: string;
  event: JumpEvent;
  kind: 'practice' | 'competition';
  markM: number;
  windMs: number | null;
  note: string | null;
};

type AttemptRow = Omit<Attempt, 'markM' | 'windMs'> & { markM: string; windMs: string | null };

const attemptColumns = `id, to_char(day, 'YYYY-MM-DD') as day, event, kind, "markM", "windMs", note`;

function toAttempt(row: AttemptRow): Attempt {
  return { ...row, markM: Number(row.markM), windMs: num(row.windMs) };
}

/** 1種目の記録すべて。古い順 */
export async function listAttempts(userId: string, event: JumpEvent): Promise<Attempt[]> {
  const { rows } = await db().query<AttemptRow>(
    `select ${attemptColumns} from attempt where "userId" = $1 and event = $2
      order by day, "createdAt"`,
    [userId, event],
  );
  return rows.map(toAttempt);
}

/** 期間の中の記録（全種目）。カレンダー用 */
export async function listAttemptsBetween(
  userId: string,
  from: string,
  to: string,
): Promise<Attempt[]> {
  const { rows } = await db().query<AttemptRow>(
    `select ${attemptColumns} from attempt where "userId" = $1 and day between $2 and $3
      order by day, "createdAt"`,
    [userId, from, to],
  );
  return rows.map(toAttempt);
}

export async function addAttempt(userId: string, input: Omit<Attempt, 'id'>): Promise<void> {
  await db().query(
    `insert into attempt ("userId", day, event, kind, "markM", "windMs", note)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, input.day, input.event, input.kind, input.markM, input.windMs, input.note],
  );
}

/** 本人の試技を1本。無いか他人の試技なら null */
export async function getAttempt(userId: string, id: string): Promise<Attempt | null> {
  const { rows } = await db().query<AttemptRow>(
    `select ${attemptColumns} from attempt where "userId" = $1 and id = $2`,
    [userId, id],
  );
  return rows[0] ? toAttempt(rows[0]) : null;
}

/** 試技を1本書き換える（日は変えない）。本人の試技だけ */
export async function updateAttempt(
  userId: string,
  id: string,
  input: Omit<Attempt, 'id' | 'day'>,
): Promise<void> {
  await db().query(
    `update attempt set event = $3, kind = $4, "markM" = $5, "windMs" = $6, note = $7
      where "userId" = $1 and id = $2`,
    [userId, id, input.event, input.kind, input.markM, input.windMs, input.note],
  );
}

export async function deleteAttempt(userId: string, id: string): Promise<void> {
  await db().query(`delete from attempt where "userId" = $1 and id = $2`, [userId, id]);
}

export type DayLog = {
  condition: number | null;
  fatigue: number | null;
  sleepHours: number | null;
  injury: string | null;
  note: string | null;
};

export async function getDayLog(userId: string, day: string): Promise<DayLog | null> {
  const { rows } = await db().query<Omit<DayLog, 'sleepHours'> & { sleepHours: string | null }>(
    `select condition, fatigue, "sleepHours", injury, note from day_log
      where "userId" = $1 and day = $2`,
    [userId, day],
  );
  const row = rows[0];
  return row ? { ...row, sleepHours: num(row.sleepHours) } : null;
}

export async function saveDayLog(userId: string, day: string, log: DayLog): Promise<void> {
  await db().query(
    `insert into day_log ("userId", day, condition, fatigue, "sleepHours", injury, note)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict ("userId", day) do update set
       condition = excluded.condition, fatigue = excluded.fatigue,
       "sleepHours" = excluded."sleepHours", injury = excluded.injury, note = excluded.note,
       "updatedAt" = now()`,
    [userId, day, log.condition, log.fatigue, log.sleepHours, log.injury, log.note],
  );
}

export type Competition = {
  id: string;
  name: string;
  day: string;
  venue: string | null;
  callRoomPlace: string | null;
  callRoomTime: string | null;
  startTime: string | null;
  notes: string | null;
  /** 主目標の大会か。今日のアドバイスが、この大会の前2週間を調整期にする */
  isTarget: boolean;
  /** 申し込みのサイト。大会の一覧から開く */
  entryUrl: string | null;
};

const competitionColumns = `id, name, to_char(day, 'YYYY-MM-DD') as day, venue, "callRoomPlace",
  to_char("callRoomTime", 'HH24:MI') as "callRoomTime", to_char("startTime", 'HH24:MI') as "startTime", notes,
  "isTarget", "entryUrl"`;

/** today 以降でいちばん近い大会 */
export async function nextCompetition(userId: string, today: string): Promise<Competition | null> {
  const { rows } = await db().query<Competition>(
    `select ${competitionColumns} from competition where "userId" = $1 and day >= $2
      order by day, "startTime" nulls last limit 1`,
    [userId, today],
  );
  return rows[0] ?? null;
}

export async function saveCompetition(
  userId: string,
  input: Omit<Competition, 'id'> & { id: string | null },
): Promise<void> {
  const values = [
    input.name,
    input.day,
    input.venue,
    input.callRoomPlace,
    input.callRoomTime,
    input.startTime,
    input.notes,
    input.isTarget,
    input.entryUrl,
  ];
  if (input.id) {
    await db().query(
      `update competition set name = $3, day = $4, venue = $5, "callRoomPlace" = $6,
              "callRoomTime" = $7, "startTime" = $8, notes = $9, "isTarget" = $10, "entryUrl" = $11
        where "userId" = $1 and id = $2`,
      [userId, input.id, ...values],
    );
  } else {
    await db().query(
      `insert into competition ("userId", name, day, venue, "callRoomPlace", "callRoomTime",
                                "startTime", notes, "isTarget", "entryUrl")
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [userId, ...values],
    );
  }
}

export async function deleteCompetition(userId: string, id: string): Promise<void> {
  await db().query(`delete from competition where "userId" = $1 and id = $2`, [userId, id]);
}

/** 記録すべて（全種目）。記録の一覧用。古い順 */
/** 跳んだ本数と、試技を入れた日の数（ユーザーメニューに出す）。全部を読まずに数だけ数える */
export async function getActivityCounts(
  userId: string,
): Promise<{ jumps: number; daysLogged: number }> {
  const { rows } = await db().query<{ jumps: string; daysLogged: string }>(
    `select count(*) as jumps, count(distinct day) as "daysLogged" from attempt where "userId" = $1`,
    [userId],
  );
  return { jumps: Number(rows[0]?.jumps ?? 0), daysLogged: Number(rows[0]?.daysLogged ?? 0) };
}

export async function listAllAttempts(userId: string): Promise<Attempt[]> {
  const { rows } = await db().query<AttemptRow>(
    `select ${attemptColumns} from attempt where "userId" = $1 order by day, "createdAt"`,
    [userId],
  );
  return rows.map(toAttempt);
}

/** 体調とメモのある日すべて。記録の一覧用 */
export async function listDayLogs(
  userId: string,
): Promise<{ day: string; condition: number | null; note: string | null }[]> {
  const { rows } = await db().query<{ day: string; condition: number | null; note: string | null }>(
    `select to_char(day, 'YYYY-MM-DD') as day, condition, note from day_log where "userId" = $1`,
    [userId],
  );
  return rows;
}

/** from から to までの日の体調（今日のアドバイスが、睡眠の平均と本人のふだんの値を出すのに使う） */
export async function listConditionsBetween(
  userId: string,
  from: string,
  to: string,
): Promise<(DayLog & { day: string })[]> {
  const { rows } = await db().query<DayLog & { day: string; sleepHours: string | null }>(
    `select to_char(day, 'YYYY-MM-DD') as day, condition, fatigue, "sleepHours", injury, note
       from day_log where "userId" = $1 and day between $2 and $3 order by day`,
    [userId, from, to],
  );
  return rows.map((row) => ({ ...row, sleepHours: num(row.sleepHours) }));
}

/** from から to までの大会（今日のアドバイス用。日付の近い順） */
export async function listCompetitionsBetween(
  userId: string,
  from: string,
  to: string,
): Promise<Competition[]> {
  const { rows } = await db().query<Competition>(
    `select ${competitionColumns} from competition
      where "userId" = $1 and day between $2 and $3 order by day, "startTime" nulls last`,
    [userId, from, to],
  );
  return rows;
}

/** 大会すべて。日付の古い順 */
/** 本人の大会を1つ。無いか他人の大会なら null */
export async function getCompetition(userId: string, id: string): Promise<Competition | null> {
  const { rows } = await db().query<Competition>(
    `select ${competitionColumns} from competition where "userId" = $1 and id = $2`,
    [userId, id],
  );
  return rows[0] ?? null;
}

export async function listCompetitions(userId: string): Promise<Competition[]> {
  const { rows } = await db().query<Competition>(
    `select ${competitionColumns} from competition where "userId" = $1
      order by day, "startTime" nulls last`,
    [userId],
  );
  return rows;
}

export type Video = {
  id: string;
  day: string;
  event: JumpEvent;
  kind: 'practice' | 'competition';
  attemptId: string | null;
  note: string | null;
  objectKey: string;
  sizeBytes: number;
  /** 消える時刻（ISO 8601） */
  expiresAt: string;
  /** 時間の目印（src/lib/video-marks.ts） */
  marks: Marks;
};

const videoColumns = `id, to_char(day, 'YYYY-MM-DD') as day, event, kind, "attemptId", note, "objectKey", "sizeBytes",
  to_char("expiresAt" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "expiresAt", marks`;

/** 読んだ行の目印を、知っている名前と数だけにする */
const toVideo = (row: Video): Video => ({ ...row, marks: toMarks(row.marks) });

/** 期限の過ぎていない動画（期限を過ぎた行は、R2 の本体がもう無いか、まもなく消える） */
const LIVE_VIDEO = `"expiresAt" > now()`;

/**
 * 送る前に1本分の枠を取る（pending の行）。入力の中身もここで入れ、届いたら ready にするだけにする。
 * 合計が上限を超えるなら取らずに false。合計は届いていない pending も数える。
 * 結び付ける試技は、本人のその日の試技だけ（違えば結び付けない）
 */
export async function reserveVideo(
  userId: string,
  video: {
    id: string;
    day: string;
    event: JumpEvent;
    kind: 'practice' | 'competition';
    attemptId: string | null;
    note: string | null;
    objectKey: string;
    contentType: string;
    sizeBytes: number;
  },
  limitBytes: number,
  keepDays: number,
): Promise<boolean> {
  // 人ごとのロックを取ってから数える。取らずに数えると、同時に送った2本がどちらも古い合計を見て上限を抜ける
  const client = await db().connect();
  try {
    await client.query('begin');
    await client.query(`select pg_advisory_xact_lock(hashtext('video:' || $1))`, [userId]);
    const { rowCount } = await client.query(
      `insert into video (id, "userId", day, event, kind, "attemptId", note, "objectKey", "contentType", "sizeBytes",
                          "expiresAt")
       select $1, $2, $3, $4, $5,
              (select a.id from attempt a where a.id = $6 and a."userId" = $2 and a.day = $3),
              $7, $8, $9, $10::integer, now() + make_interval(days => $12::integer)
        where (select coalesce(sum("sizeBytes"), 0) from video where "userId" = $2 and ${LIVE_VIDEO})
              + $10::bigint <= $11::bigint`,
      [
        video.id,
        userId,
        video.day,
        video.event,
        video.kind,
        video.attemptId,
        video.note,
        video.objectKey,
        video.contentType,
        video.sizeBytes,
        limitBytes,
        keepDays,
      ],
    );
    await client.query('commit');
    return rowCount === 1;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/** 届いたのを確かめた1本を、見せる状態にする */
export async function completeVideo(userId: string, id: string): Promise<boolean> {
  const { rowCount } = await db().query(
    `update video set status = 'ready' where "userId" = $1 and id = $2 and status = 'pending'`,
    [userId, id],
  );
  return rowCount === 1;
}

/** 枠を取った（pending の）1本。届いた大きさと比べるため */
export async function getPendingVideo(
  userId: string,
  id: string,
): Promise<{ objectKey: string; sizeBytes: number } | null> {
  const { rows } = await db().query<{ objectKey: string; sizeBytes: number }>(
    `select "objectKey", "sizeBytes" from video where "userId" = $1 and id = $2 and status = 'pending'`,
    [userId, id],
  );
  return rows[0] ?? null;
}

/**
 * 送りかけて3時間たっても届かなかった枠と、期限を過ぎた動画の行を外し、その置き場所を返す（R2 に残っていれば消すため）。
 * 送るための URL は30分で切れるが、遅い回線では 100MB の送信がその先まで続くので、間を空ける
 */
export async function releaseStaleVideos(userId: string): Promise<string[]> {
  const { rows } = await db().query<{ objectKey: string }>(
    `delete from video where "userId" = $1
        and ((status = 'pending' and "createdAt" < now() - interval '3 hours') or not (${LIVE_VIDEO}))
      returning "objectKey"`,
    [userId],
  );
  return rows.map((r) => r.objectKey);
}

/** その日の動画。古い順 */
export async function listVideosOnDay(userId: string, day: string): Promise<Video[]> {
  const { rows } = await db().query<Video>(
    `select ${videoColumns} from video
      where "userId" = $1 and day = $2 and status = 'ready' and ${LIVE_VIDEO}
      order by "createdAt"`,
    [userId, day],
  );
  return rows.map(toVideo);
}

/** 本人の見られる1本（届いていて、期限の過ぎていないもの）。ほかの人の動画や消えた動画は null */
export async function getVideo(userId: string, id: string): Promise<Video | null> {
  const { rows } = await db().query<Video>(
    `select ${videoColumns} from video
      where "userId" = $1 and id = $2 and status = 'ready' and ${LIVE_VIDEO}`,
    [userId, id],
  );
  return rows[0] ? toVideo(rows[0]) : null;
}

/**
 * 1本と見比べられる、本人のほかの動画（同じ種目で、届いていて、期限の過ぎていないもの）。新しい順。
 * 種目が違う跳躍は並べても比べようがないので出さない
 */
export async function listComparableVideos(
  userId: string,
  event: JumpEvent,
  exceptId: string,
): Promise<Video[]> {
  const { rows } = await db().query<Video>(
    `select ${videoColumns} from video
      where "userId" = $1 and event = $2 and id <> $3 and status = 'ready' and ${LIVE_VIDEO}
      order by day desc, "createdAt" desc`,
    [userId, event, exceptId],
  );
  return rows.map(toVideo);
}

/**
 * 本人の見られる1本（届いていて、期限の過ぎていないもの）に、目印を1つ置く（time が null なら外す）。
 * 置き直すと上書きする。1つずつ書き換えるので、別の画面で置いたほかの目印を古い値で消さない。
 * 置けたら置いたあとの目印を、置けなかった（ほかの人の動画・消えた動画）なら null を返す
 */
export async function setVideoMark(
  userId: string,
  id: string,
  mark: MarkName,
  time: number | null,
): Promise<Marks | null> {
  const { rows } = await db().query<{ marks: unknown }>(
    `update video
        set marks = case when $4::numeric is null then marks - $3::text
                         else marks || jsonb_build_object($3::text, $4::numeric) end
      where "userId" = $1 and id = $2 and status = 'ready' and ${LIVE_VIDEO}
      returning marks`,
    [userId, id, mark, time],
  );
  return rows[0] ? toMarks(rows[0].marks) : null;
}

/** 送れなかった枠を外し、R2 から消すための置き場所を返す */
export async function releaseVideo(userId: string, id: string): Promise<string | null> {
  const { rows } = await db().query<{ objectKey: string }>(
    `delete from video where "userId" = $1 and id = $2 and status = 'pending' returning "objectKey"`,
    [userId, id],
  );
  return rows[0]?.objectKey ?? null;
}

/** 1本を消し、R2 から消すための置き場所を返す */
export async function deleteVideo(userId: string, id: string): Promise<string | null> {
  const { rows } = await db().query<{ objectKey: string }>(
    `delete from video where "userId" = $1 and id = $2 returning "objectKey"`,
    [userId, id],
  );
  return rows[0]?.objectKey ?? null;
}

/** 動画の合計の大きさ（届いていない枠も含む。期限を過ぎた動画は数えない） */
export async function videoUsage(userId: string): Promise<number> {
  const { rows } = await db().query<{ total: string }>(
    `select coalesce(sum("sizeBytes"), 0) as total from video where "userId" = $1 and ${LIVE_VIDEO}`,
    [userId],
  );
  return Number(rows[0]!.total);
}

export type SavedMenu = {
  level: MenuLevel;
  model: string;
  menu: Menu;
  /** 練習時間（分）。チャットの前に作ったメニューには無い */
  minutes: number | null;
  /** チャットで直すたびに 1 ずつ上がる */
  version: number;
};

/** その日の AI のメニュー。無ければ null */
export async function getMenu(userId: string, day: string): Promise<SavedMenu | null> {
  const { rows } = await db().query<SavedMenu>(
    `select level, model, menu, minutes, version from practice_menu where "userId" = $1 and day = $2`,
    [userId, day],
  );
  return rows[0] ?? null;
}

/** その日に AI のメニューがあるか（記録の日の画面のリンク用） */
export async function hasMenu(userId: string, day: string): Promise<boolean> {
  const { rowCount } = await db().query(
    `select 1 from practice_menu where "userId" = $1 and day = $2`,
    [userId, day],
  );
  return rowCount === 1;
}

/** メニューを保存する。その日にもうあれば保存せず false（1日に1つ。二度押しで2回作らせない） */
export async function saveMenu(
  userId: string,
  day: string,
  saved: Omit<SavedMenu, 'version'>,
): Promise<boolean> {
  const { rowCount } = await db().query(
    `insert into practice_menu ("userId", day, level, model, menu, minutes) values ($1, $2, $3, $4, $5, $6)
     on conflict ("userId", day) do nothing`,
    [userId, day, saved.level, saved.model, JSON.stringify(saved.menu), saved.minutes],
  );
  return rowCount === 1;
}

export type MenuMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** assistant の返事で直したメニューの版。直さなかったら null */
  version: number | null;
};

/** その日のチャット。古い順（同じ時刻に入れた相談と返事は、相談が先） */
export async function listMenuMessages(userId: string, day: string): Promise<MenuMessage[]> {
  const { rows } = await db().query<MenuMessage>(
    `select id, role, content, version from menu_message
      where "userId" = $1 and day = $2 order by "createdAt", role desc`,
    [userId, day],
  );
  return rows;
}

/**
 * 相談と返事を保存し、直したメニューがあれば版を上げて上書きする（直さなかった返事では版を変えない）。
 * 読んだときの版（fromVersion）から変わっていたら何もせず false（別の画面で同時に直したとき、後の方を捨てる）
 */
export async function saveMenuExchange(
  userId: string,
  day: string,
  exchange: {
    fromVersion: number;
    question: string;
    reply: string;
    revised: { level: MenuLevel; model: string; menu: Menu; minutes: number } | null;
  },
): Promise<boolean> {
  const client = await db().connect();
  try {
    await client.query('begin');
    const { rows } = await client.query<{ version: number }>(
      `update practice_menu
          set version = version + (case when $6::jsonb is null then 0 else 1 end),
              level = coalesce($4, level), model = coalesce($5, model),
              menu = coalesce($6::jsonb, menu), minutes = coalesce($7, minutes)
        where "userId" = $1 and day = $2 and version = $3
        returning version`,
      [
        userId,
        day,
        exchange.fromVersion,
        exchange.revised?.level ?? null,
        exchange.revised?.model ?? null,
        exchange.revised ? JSON.stringify(exchange.revised.menu) : null,
        exchange.revised?.minutes ?? null,
      ],
    );
    const version = rows[0]?.version;
    if (version === undefined) {
      await client.query('rollback');
      return false;
    }
    await client.query(
      `insert into menu_message ("userId", day, role, content, version, "createdAt")
       values ($1, $2, 'user', $3, null, now()), ($1, $2, 'assistant', $4, $5, now())`,
      [userId, day, exchange.question, exchange.reply, exchange.revised ? version : null],
    );
    await client.query('commit');
    return true;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/** AI を1回呼ぶ前に記録する（失敗した呼び出しも上限に数えるため） */
export async function recordAiCall(
  userId: string,
  day: string,
  kind: 'menu' | 'chat',
  model: string,
): Promise<void> {
  await db().query(`insert into ai_call ("userId", day, kind, model) values ($1, $2, $3, $4)`, [
    userId,
    day,
    kind,
    model,
  ]);
}

/** AI を呼んだ回数。その日の分と、その日と同じ月の分 */
export async function countAiCalls(
  userId: string,
  day: string,
  kind: 'menu' | 'chat',
): Promise<{ today: number; month: number }> {
  const { rows } = await db().query<{ today: string; month: string }>(
    `select count(*) filter (where day = $2::date) as today, count(*) as month from ai_call
      where "userId" = $1 and kind = $3 and date_trunc('month', day) = date_trunc('month', $2::date)`,
    [userId, day, kind],
  );
  return { today: Number(rows[0]!.today), month: Number(rows[0]!.month) };
}

/**
 * 通知の宛先を保存する。同じ宛先がもうあれば、鍵と言語と持ち主を今の人で置き換える
 * （宛先はブラウザのもの。前の人がログアウトの片付けをできずに残った行も、今ログインしている人のものにする）
 */
export async function savePushSubscription(
  userId: string,
  target: PushTarget,
  locale: Locale,
): Promise<void> {
  await db().query(
    `insert into push_subscription (endpoint, "userId", p256dh, auth, locale)
     values ($1, $2, $3, $4, $5)
     on conflict (endpoint) do update set "userId" = excluded."userId", p256dh = excluded.p256dh,
       auth = excluded.auth, locale = excluded.locale`,
    [target.endpoint, userId, target.keys.p256dh, target.keys.auth, locale],
  );
}

/** 本人の宛先を1つ消す（通知を切ったとき、この端末でログアウトするとき） */
export async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  await db().query(`delete from push_subscription where "userId" = $1 and endpoint = $2`, [
    userId,
    endpoint,
  ]);
}

/*
 * 大会の前日の知らせの Cron（src/app/api/cron/meet-reminder）だけが使う。本人を決めずに、全員の行を読み書きする
 */

/** 通知を入れている人の、from から to までの大会を、宛先ごとに読む（誰に送るかは src/lib/meet-reminder.ts が選ぶ） */
export async function listReminderRows(from: string, to: string): Promise<ReminderRow[]> {
  const { rows } = await db().query<ReminderRow>(
    `select s.endpoint, s.p256dh, s.auth, s.locale, s."userId", p."timeZone",
            c.id as "competitionId", c.name, to_char(c.day, 'YYYY-MM-DD') as day
       from push_subscription s
       join profile p on p."userId" = s."userId"
       join competition c on c."userId" = s."userId" and c.day between $1 and $2
      order by s."createdAt"`,
    [from, to],
  );
  return rows;
}

/** 送った印の残す日数。前日の知らせの印は、大会が過ぎれば要らない */
const PUSH_SENT_KEEP_DAYS = 30;

/**
 * 知らせの印を付ける。初めて付けられた key だけを返す（送る前に付け、付けられたものだけ送る。二度送らない）。
 * 古い印は同じ文で消す（DB への往復を増やさない）
 */
export async function claimPushKeys(keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const { rows } = await db().query<{ key: string }>(
    `with old as (delete from push_sent where "sentAt" < now() - make_interval(days => $2))
     insert into push_sent (key) select unnest($1::text[]) on conflict (key) do nothing returning key`,
    [keys, PUSH_SENT_KEEP_DAYS],
  );
  return new Set(rows.map((row) => row.key));
}

/** 送れなかった知らせの印を外す（印を付けたまま失敗すると、その知らせは二度と送られない） */
export async function releasePushKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await db().query(`delete from push_sent where key = any($1::text[])`, [keys]);
}

/** 通知サービスが無効と返した宛先を消す */
export async function deletePushEndpoints(endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) return;
  await db().query(`delete from push_subscription where endpoint = any($1::text[])`, [endpoints]);
}

/*
 * 管理の画面（/admin）だけが使う。ほかの関数と違い、本人以外の行を読み書きする。
 * 呼ぶ前に、ログインしている人が管理者か（src/lib/admin.ts の isAdmin）を必ず確かめる
 */

export type AdminUser = { id: string; name: string; email: string; plan: Plan };

/**
 * プロフィールを作った人を、登録の新しい順に読む。query があれば、メールか名前にその語を含む人だけ。
 * % と _ は語のまま探す（LIKE の記号として効かせない）
 */
export async function listUsersForAdmin(query: string | null, limit: number): Promise<AdminUser[]> {
  const pattern = query === null ? null : `%${query.replace(/[\\%_]/g, '\\$&')}%`;
  const { rows } = await db().query<AdminUser>(
    `select u.id, u.name, u.email, p.plan
       from profile p join "user" u on u.id = p."userId"
      where $1::text is null or u.email ilike $1 escape '\\' or u.name ilike $1 escape '\\'
      order by u."createdAt" desc, u.id
      limit $2`,
    [pattern, limit],
  );
  return rows;
}

/** 1人のプランを変える。プロフィールが無ければ何もせず false */
export async function setPlan(userId: string, plan: Plan): Promise<boolean> {
  const { rowCount } = await db().query(
    `update profile set plan = $2, "updatedAt" = now() where "userId" = $1`,
    [userId, plan],
  );
  return rowCount === 1;
}

/*
 * チームとコーチ（2026-10-14。src/lib/teams.ts）。コーチの関数は、どの文の中でも
 * 「押した人がそのチームのコーチか」と「相手がいまそのチームの選手か」を確かめる（呼ぶ側の確かめに頼らない）。
 * 確かめられなければ空か null を返し、画面は notFound にする
 */

/** $1 の人が、$2 のチームのコーチか */
const IS_COACH = `exists (select 1 from team_coach c where c."teamId" = $2 and c."userId" = $1)`;

/** $1 の人が $2 のチームのコーチで、$3 の人がいまそのチームの選手か */
const COACH_SEES = `exists (select 1 from team_coach c join team_member m on m."teamId" = c."teamId"
  where c."teamId" = $2 and c."userId" = $1 and m."userId" = $3)`;

/** コーチが選手の記録を読むときの組（コーチ・チーム・選手）。文ごとに COACH_SEES で確かめる */
export type CoachAccess = { coachId: string; teamId: string; memberId: string };

const accessParams = (access: CoachAccess) => [access.coachId, access.teamId, access.memberId];

/** チームを作り、作った人をコーチにする。チームの id を返す */
export async function createTeam(userId: string, name: string): Promise<string> {
  const client = await db().connect();
  try {
    await client.query('begin');
    const { rows } = await client.query<{ id: string }>(
      `insert into team (name) values ($1) returning id`,
      [name],
    );
    const id = rows[0]!.id;
    await client.query(`insert into team_coach ("teamId", "userId") values ($1, $2)`, [id, userId]);
    await client.query('commit');
    return id;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/** チームの名前を変える。コーチだけ。変えられたら true */
export async function renameTeam(coachId: string, teamId: string, name: string): Promise<boolean> {
  const { rowCount } = await db().query(`update team set name = $3 where id = $2 and ${IS_COACH}`, [
    coachId,
    teamId,
    name,
  ]);
  return rowCount === 1;
}

/** チームを消す。コーチだけ。選手の記録には触れない（参加・招待・チームへのお願いの行だけが一緒に消える） */
export async function deleteTeam(coachId: string, teamId: string): Promise<boolean> {
  const { rowCount } = await db().query(`delete from team where id = $2 and ${IS_COACH}`, [
    coachId,
    teamId,
  ]);
  return rowCount === 1;
}

/** コーチの画面に出すチーム。使える招待があれば、その期限 */
export type CoachedTeam = { id: string; name: string; inviteExpiresAt: string | null };

/** コーチしているチームを1つ。コーチでなければ null */
export async function getCoachedTeam(coachId: string, teamId: string): Promise<CoachedTeam | null> {
  const { rows } = await db().query<CoachedTeam>(
    `select t.id, t.name,
            (select to_char(max(i."expiresAt") at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
               from team_invite i
              where i."teamId" = t.id and i."revokedAt" is null and i."expiresAt" > now()) as "inviteExpiresAt"
       from team t where t.id = $2 and ${IS_COACH}`,
    [coachId, teamId],
  );
  return rows[0] ?? null;
}

/** コーチしているチーム（作った順）と選手の数 */
export async function listCoachedTeams(
  userId: string,
): Promise<{ id: string; name: string; memberCount: number }[]> {
  const { rows } = await db().query<{ id: string; name: string; memberCount: number }>(
    `select t.id, t.name,
            (select count(*)::integer from team_member m where m."teamId" = t.id) as "memberCount"
       from team t join team_coach c on c."teamId" = t.id
      where c."userId" = $1 order by t."createdAt", t.id`,
    [userId],
  );
  return rows;
}

/** 選手として入っているチーム（入った順）とコーチの表示名 */
export async function listMemberships(
  userId: string,
): Promise<{ id: string; name: string; coaches: string[]; joinedAt: Date }[]> {
  const { rows } = await db().query<{
    id: string;
    name: string;
    coaches: string[];
    joinedAt: Date;
  }>(
    `select t.id, t.name, ${TEAM_COACH_NAMES} as coaches, m."joinedAt"
       from team_member m join team t on t.id = m."teamId"
      where m."userId" = $1 order by m."joinedAt", t.id`,
    [userId],
  );
  return rows;
}

/**
 * 招待を作る。コーチだけ。前の招待は切る（使えるリンクはチームに1つ）。作れたら期限、コーチでなければ null。
 * 同時に2回押しても、使えるリンクを2つ残さないように、チームの行を押さえてから切る
 */
export async function createInvite(
  coachId: string,
  teamId: string,
  tokenHash: string,
  days: number,
): Promise<Date | null> {
  const client = await db().connect();
  try {
    await client.query('begin');
    const { rowCount } = await client.query(
      `select 1 from team where id = $2 and ${IS_COACH} for update`,
      [coachId, teamId],
    );
    if (rowCount !== 1) {
      await client.query('rollback');
      return null;
    }
    await client.query(
      `update team_invite set "revokedAt" = now() where "teamId" = $1 and "revokedAt" is null`,
      [teamId],
    );
    const { rows } = await client.query<{ expiresAt: Date }>(
      `insert into team_invite ("teamId", "tokenHash", "expiresAt")
       values ($1, $2, now() + make_interval(days => $3::integer)) returning "expiresAt"`,
      [teamId, tokenHash, days],
    );
    await client.query('commit');
    return rows[0]!.expiresAt;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/** 招待を切る（使えるものすべて）。コーチだけ */
export async function revokeInvites(coachId: string, teamId: string): Promise<void> {
  await db().query(
    `update team_invite set "revokedAt" = now()
      where "teamId" = $2 and "revokedAt" is null and ${IS_COACH}`,
    [coachId, teamId],
  );
}

/** 招待の画面に出すもの。鍵はハッシュで探す */
export type InviteInfo = {
  inviteId: string;
  teamId: string;
  teamName: string;
  coaches: string[];
  revokedAt: Date | null;
  expiresAt: Date;
};

/** 招待のリンクの行と、チームの名前とコーチの表示名。無ければ null */
export async function findInvite(tokenHash: string): Promise<InviteInfo | null> {
  const { rows } = await db().query<InviteInfo>(
    `select i.id as "inviteId", t.id as "teamId", t.name as "teamName", ${TEAM_COACH_NAMES} as coaches,
            i."revokedAt", i."expiresAt"
       from team_invite i join team t on t.id = i."teamId"
      where i."tokenHash" = $1`,
    [tokenHash],
  );
  return rows[0] ?? null;
}

/** この人とチームのつながり（コーチか、選手か） */
export async function teamRelation(
  userId: string,
  teamId: string,
): Promise<{ coach: boolean; member: boolean }> {
  const { rows } = await db().query<{ coach: boolean; member: boolean }>(
    `select ${IS_COACH} as coach,
            exists (select 1 from team_member m where m."teamId" = $2 and m."userId" = $1) as member`,
    [userId, teamId],
  );
  return rows[0] ?? { coach: false, member: false };
}

export type JoinResult = 'joined' | 'already' | 'invalid' | 'coach' | 'guardian' | 'ask';

/**
 * 本人の同意でチームに入る（招待の画面の「同意して参加」）。年齢の確かめもこの中で行う:
 * - 16歳未満（生年月日か、前の答え）は入れずに guardian（保護者の同意で入る）
 * - 生年月日が無く16歳以上かを答えていない人は、declare16Plus（「16歳以上です」と答えて押した）が無ければ ask。
 *   答えて押したら答えを残す。もう16歳未満と分かっている人の答えは上書きしない（AI コーチの consentToAi と同じ）
 * - 招待が切れている・期限が過ぎた・知らない鍵は invalid、そのチームのコーチは coach、もう入っていれば already
 * プロフィールの行を押さえてから決める（同時に生年月日を変えても、古い年齢で入らないように）
 */
export async function joinTeamBySelf(
  userId: string,
  tokenHash: string,
  declare16Plus: boolean,
  now: Date = new Date(),
): Promise<JoinResult> {
  const client = await db().connect();
  const finish = async (result: JoinResult, commit = false) => {
    await client.query(commit ? 'commit' : 'rollback');
    return result;
  };
  try {
    await client.query('begin');
    const { rows: invites } = await client.query<{ teamId: string }>(
      `select "teamId" from team_invite
        where "tokenHash" = $1 and "revokedAt" is null and "expiresAt" > now()`,
      [tokenHash],
    );
    const teamId = invites[0]?.teamId;
    if (!teamId) return await finish('invalid');
    const { rows: profiles } = await client.query<{
      birthdate: string | null;
      ageDeclared16Plus: boolean | null;
      timeZone: string;
    }>(
      `select to_char(birthdate, 'YYYY-MM-DD') as birthdate, "ageDeclared16Plus", "timeZone"
         from profile where "userId" = $1 for update`,
      [userId],
    );
    const profile = profiles[0];
    if (!profile) return await finish('invalid');
    const declared =
      declare16Plus && profile.ageDeclared16Plus === null ? true : profile.ageDeclared16Plus;
    const consenter = consenterFor({
      birthdate: profile.birthdate,
      declared16Plus: declared,
      today: todayIn(profile.timeZone, now),
    });
    if (consenter !== 'self') return await finish(consenter);
    const { rows: relation } = await client.query<{ coach: boolean }>(
      `select ${IS_COACH} as coach`,
      [userId, teamId],
    );
    if (relation[0]?.coach) return await finish('coach');
    if (profile.birthdate === null && profile.ageDeclared16Plus === null) {
      await client.query(
        `update profile set "ageDeclared16Plus" = true, "updatedAt" = now() where "userId" = $1`,
        [userId],
      );
    }
    const { rowCount } = await client.query(
      `insert into team_member ("teamId", "userId", "consentedAt", "consentBy")
       values ($1, $2, now(), 'self') on conflict ("teamId", "userId") do nothing`,
      [teamId, userId],
    );
    return await finish(rowCount === 1 ? 'joined' : 'already', true);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 選手としてのつながりを消す（抜ける・外される）。消したときから、コーチはこの人の記録を見られない。
 * 保護者の同意で入った人の、その同意の記録（保護者のメールアドレス）も一緒に消す
 */
async function endMembership(
  teamId: string,
  memberId: string,
  /** 外すコーチ。null は本人が抜けるとき */
  coachId: string | null,
): Promise<boolean> {
  const { rows } = await db().query<{ gone: number }>(
    `with gone as (
       delete from team_member
        where "teamId" = $2 and "userId" = $3
          and ($1::text is null or ${IS_COACH})
        returning 1),
     consent as (
       delete from guardian_consent_request r
        where exists (select 1 from gone) and r."userId" = $3 and r.purpose = 'team'
          and r."inviteId" in (select i.id from team_invite i where i."teamId" = $2))
     select count(*)::integer as gone from gone`,
    [coachId, teamId, memberId],
  );
  return rows[0]?.gone === 1;
}

/** チームから抜ける（本人）。抜けたら true */
export async function leaveTeam(userId: string, teamId: string): Promise<boolean> {
  return endMembership(teamId, userId, null);
}

/** 選手をチームから外す。コーチだけ。外せたら true */
export async function removeMember(
  coachId: string,
  teamId: string,
  memberId: string,
): Promise<boolean> {
  return endMembership(teamId, memberId, coachId);
}

/** コーチの画面の選手の一覧の1行（印は src/lib/teams.ts の rosterFlags で付ける） */
export type RosterRow = {
  userId: string;
  name: string;
  events: JumpEvent[];
  timeZone: string;
  /** 試技か体調を入れた最新の日 */
  lastDay: string | null;
  /** 体調か疲労を入れた最新の日と、その値 */
  latest: { day: string; condition: number | null; fatigue: number | null } | null;
  /** 痛みのメモがある最新の日 */
  lastPainDay: string | null;
  /** 種目ごとの、試技を入れた最新の日のいちばん良い記録 */
  latestBests: { event: JumpEvent; day: string; markM: number }[];
  /** 直近 videoDays 日の動画の本数 */
  videos: number;
};

/** チームの選手の一覧。コーチでなければ空 */
export async function teamRoster(
  coachId: string,
  teamId: string,
  videoDays: number,
): Promise<RosterRow[]> {
  const { rows } = await db().query<
    Omit<RosterRow, 'latestBests'> & {
      latestBests: { event: JumpEvent; day: string; markM: string | number }[] | null;
    }
  >(
    `select u.id as "userId", u.name, p.events, p."timeZone",
            to_char(greatest((select max(a.day) from attempt a where a."userId" = m."userId"),
                             (select max(l.day) from day_log l where l."userId" = m."userId")), 'YYYY-MM-DD') as "lastDay",
            (select json_build_object('day', to_char(l.day, 'YYYY-MM-DD'), 'condition', l.condition, 'fatigue', l.fatigue)
               from day_log l
              where l."userId" = m."userId" and (l.condition is not null or l.fatigue is not null)
              order by l.day desc limit 1) as latest,
            (select to_char(max(l.day), 'YYYY-MM-DD') from day_log l
              where l."userId" = m."userId" and btrim(coalesce(l.injury, '')) <> '') as "lastPainDay",
            (select json_agg(json_build_object('event', b.event, 'day', b.day, 'markM', b.best) order by b.event)
               from (select distinct on (a.event) a.event, to_char(a.day, 'YYYY-MM-DD') as day,
                            max(a."markM") over (partition by a.event, a.day) as best
                       from attempt a where a."userId" = m."userId"
                      order by a.event, a.day desc) b) as "latestBests",
            (select count(*)::integer from video v
              where v."userId" = m."userId" and v.status = 'ready' and v."expiresAt" > now()
                and v.day > (now() at time zone p."timeZone")::date - $3::integer) as videos
       from team_member m
       join team_coach c on c."teamId" = m."teamId" and c."userId" = $1
       join "user" u on u.id = m."userId"
       join profile p on p."userId" = m."userId"
      where m."teamId" = $2`,
    [coachId, teamId, videoDays],
  );
  return rows.map((row) => ({
    ...row,
    latestBests: (row.latestBests ?? []).map((b) => ({ ...b, markM: Number(b.markM) })),
  }));
}

/** コーチが見る選手。コーチでないか、いまの選手でなければ null */
export async function getMemberForCoach(access: CoachAccess): Promise<{
  name: string;
  events: JumpEvent[];
  timeZone: string;
  joinedAt: Date;
} | null> {
  const { rows } = await db().query<{
    name: string;
    events: JumpEvent[];
    timeZone: string;
    joinedAt: Date;
  }>(
    `select u.name, p.events, p."timeZone", m."joinedAt"
       from team_member m join "user" u on u.id = m."userId" join profile p on p."userId" = m."userId"
      where m."teamId" = $2 and m."userId" = $3 and ${COACH_SEES}`,
    accessParams(access),
  );
  return rows[0] ?? null;
}

/** コーチが見る、選手の from から to までの試技（古い順） */
export async function listMemberAttemptsForCoach(
  access: CoachAccess,
  from: string,
  to: string,
): Promise<Attempt[]> {
  const { rows } = await db().query<AttemptRow>(
    `select ${attemptColumns} from attempt
      where "userId" = $3 and day between $4 and $5 and ${COACH_SEES}
      order by day, "createdAt"`,
    [...accessParams(access), from, to],
  );
  return rows.map(toAttempt);
}

/** コーチが見る、選手の from から to までの体調・痛みのメモ・練習メモ（日付の古い順） */
export async function listMemberDayLogsForCoach(
  access: CoachAccess,
  from: string,
  to: string,
): Promise<(DayLog & { day: string })[]> {
  const { rows } = await db().query<DayLog & { day: string; sleepHours: string | null }>(
    `select to_char(day, 'YYYY-MM-DD') as day, condition, fatigue, "sleepHours", injury, note
       from day_log where "userId" = $3 and day between $4 and $5 and ${COACH_SEES} order by day`,
    [...accessParams(access), from, to],
  );
  return rows.map((row) => ({ ...row, sleepHours: num(row.sleepHours) }));
}

/** コーチが見る、選手の大会すべて（日付の古い順） */
export async function listMemberCompetitionsForCoach(access: CoachAccess): Promise<Competition[]> {
  const { rows } = await db().query<Competition>(
    `select ${competitionColumns} from competition where "userId" = $3 and ${COACH_SEES}
      order by day, "startTime" nulls last`,
    accessParams(access),
  );
  return rows;
}

/** コーチが見る、選手の大会の結果に使う試技すべて（古い順） */
export async function listMemberAllAttemptsForCoach(access: CoachAccess): Promise<Attempt[]> {
  const { rows } = await db().query<AttemptRow>(
    `select ${attemptColumns} from attempt where "userId" = $3 and ${COACH_SEES}
      order by day, "createdAt"`,
    accessParams(access),
  );
  return rows.map(toAttempt);
}

/** コーチが見る、選手の from から to までの動画（届いていて期限の過ぎていないもの。古い順） */
export async function listMemberVideosForCoach(
  access: CoachAccess,
  from: string,
  to: string,
): Promise<Video[]> {
  const { rows } = await db().query<Video>(
    `select ${videoColumns} from video
      where "userId" = $3 and day between $4 and $5 and status = 'ready' and ${LIVE_VIDEO}
        and ${COACH_SEES}
      order by day, "createdAt"`,
    [...accessParams(access), from, to],
  );
  return rows.map(toVideo);
}
