import 'server-only';
import { db } from '@/lib/db';
import type { JumpEvent } from '@/lib/events';
import type { Locale } from '@/i18n/locales';
import type { ReminderRow } from '@/lib/meet-reminder';
import type { Menu, MenuLevel } from '@/lib/menu';
import type { PushTarget } from '@/lib/push-endpoint';
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
};

type ProfileRow = Omit<Profile, 'heightCm' | 'weightKg'> & {
  heightCm: string | null;
  weightKg: string | null;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const { rows } = await db().query<ProfileRow>(
    `select u.name, p.grade, p."gradeOffset", to_char(p.birthdate, 'YYYY-MM-DD') as birthdate, p.gender, p."heightCm", p."weightKg", p.events,
            p.units, p."seasonStartMonth", p."weekStart", p."timeZone", p.plan, p."aiConsentVersion"
       from profile p join "user" u on u.id = p."userId"
      where p."userId" = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return null;
  return { ...row, heightCm: num(row.heightCm), weightKg: num(row.weightKg) };
}

export type ProfileInput = Omit<Profile, 'plan' | 'aiConsentVersion'> & { goalM: number | null };

/**
 * プロフィールを保存する。名前は Better Auth の user 表に持つ。
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
                            units, "seasonStartMonth", "timeZone", "weekStart")
       values ($1, $2, $11, $3, $4, $5, $6, $7::text[], $8, $9, $10, $12)
       on conflict ("userId") do update set
         grade = excluded.grade, "gradeOffset" = excluded."gradeOffset",
         birthdate = excluded.birthdate, gender = excluded.gender,
         "heightCm" = excluded."heightCm", "weightKg" = excluded."weightKg",
         events = excluded.events,
         units = excluded.units, "seasonStartMonth" = excluded."seasonStartMonth",
         "timeZone" = excluded."timeZone", "weekStart" = excluded."weekStart", "updatedAt" = now()`,
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

/** 設定の画面の「プロフィール」の区画だけを保存する。記録のつけ方（種目・単位・シーズン）には触れない */
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
              "heightCm" = $6, "weightKg" = $7, "timeZone" = $8, "updatedAt" = now()
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
 * 時間帯が UTC のままの人だけ、ブラウザの時間帯に直す。登録と設定の保存が、時間帯をみな UTC で
 * 保存していた（2026-10-11 に直した）。UTC 以外の人には触れない（旅行先で開いても変わらないように）
 */
export async function repairTimeZone(
  userId: string,
  timeZone: string,
  grade: Pick<Profile, 'grade' | 'gradeOffset'>,
): Promise<boolean> {
  const { rowCount } = await db().query(
    `update profile set "timeZone" = $2, grade = $3, "gradeOffset" = $4, "updatedAt" = now()
      where "userId" = $1 and "timeZone" = 'UTC'`,
    [userId, timeZone, grade.grade, grade.gradeOffset],
  );
  return rowCount === 1;
}

/**
 * AI コーチの説明（version の版）に同意したことを入れる。同じ版にもう同意していれば何もしない。
 * 版が上がって同意し直したときは、時刻も新しい版に同意した時刻に変わる
 */
export async function consentToAi(userId: string, version: number): Promise<void> {
  await db().query(
    `update profile set "aiConsentAt" = now(), "aiConsentVersion" = $2, "updatedAt" = now()
      where "userId" = $1 and "aiConsentVersion" is distinct from $2`,
    [userId, version],
  );
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

/**
 * その人の動画の置き場所を全部（届いていない枠・期限を過ぎた行も含む）。アカウントを消すときに、
 * 行が消える前に読んでおき、行を消したあとで R2 から消す（src/lib/auth.ts の deleteUser）
 */
export async function videoObjectKeys(userId: string): Promise<string[]> {
  const { rows } = await db().query<{ objectKey: string }>(
    `select "objectKey" from video where "userId" = $1`,
    [userId],
  );
  return rows.map((row) => row.objectKey);
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
