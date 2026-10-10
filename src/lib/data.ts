import 'server-only';
import { db } from '@/lib/db';
import type { JumpEvent } from '@/lib/events';
import type { Units } from '@/lib/units';

/**
 * DB の読み書き。どの関数も userId を引数に取り、その人の行だけを触る。
 * userId は requireViewer() が決めたものだけを渡す。
 * pg は numeric を文字列で返すので、ここで数に直す
 */

const num = (value: string | null): number | null => (value === null ? null : Number(value));

export type Profile = {
  name: string;
  grade: string | null;
  birthdate: string | null;
  gender: 'male' | 'female' | 'other' | null;
  heightCm: number | null;
  weightKg: number | null;
  events: JumpEvent[];
  currentEvent: JumpEvent;
  units: Units;
  seasonStartMonth: number;
  timeZone: string;
};

type ProfileRow = Omit<Profile, 'heightCm' | 'weightKg'> & {
  heightCm: string | null;
  weightKg: string | null;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const { rows } = await db().query<ProfileRow>(
    `select u.name, p.grade, to_char(p.birthdate, 'YYYY-MM-DD') as birthdate, p.gender, p."heightCm", p."weightKg", p.events,
            p."currentEvent", p.units, p."seasonStartMonth", p."timeZone"
       from profile p join "user" u on u.id = p."userId"
      where p."userId" = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return null;
  return { ...row, heightCm: num(row.heightCm), weightKg: num(row.weightKg) };
}

export type ProfileInput = Omit<Profile, 'currentEvent'> & { goalM: number | null };

/**
 * プロフィールを保存する。名前は Better Auth の user 表に持つ。
 * 見ている種目が、選んだ種目から外れたら先頭に戻す。
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
      `insert into profile ("userId", grade, birthdate, gender, "heightCm", "weightKg", events,
                            "currentEvent", units, "seasonStartMonth", "timeZone")
       values ($1, $2, $3, $4, $5, $6, $7::text[], ($7::text[])[1], $8, $9, $10)
       on conflict ("userId") do update set
         grade = excluded.grade, birthdate = excluded.birthdate, gender = excluded.gender,
         "heightCm" = excluded."heightCm", "weightKg" = excluded."weightKg",
         events = excluded.events,
         "currentEvent" = case when profile."currentEvent" = any(excluded.events)
                               then profile."currentEvent" else excluded.events[1] end,
         units = excluded.units, "seasonStartMonth" = excluded."seasonStartMonth",
         "timeZone" = excluded."timeZone", "updatedAt" = now()`,
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

export async function setCurrentEvent(userId: string, event: JumpEvent): Promise<void> {
  await db().query(
    `update profile set "currentEvent" = $2, "updatedAt" = now()
      where "userId" = $1 and $2 = any(events)`,
    [userId, event],
  );
}

export type Target = {
  seasonGoalM: number | null;
  manualPbM: number | null;
  manualSbM: number | null;
  manualSbSeason: number | null;
  manualPracticeBestM: number | null;
};

export async function getTarget(userId: string, event: JumpEvent): Promise<Target> {
  const { rows } = await db().query<Record<keyof Target, string | null>>(
    `select "seasonGoalM", "manualPbM", "manualSbM", "manualSbSeason", "manualPracticeBestM"
       from event_target where "userId" = $1 and event = $2`,
    [userId, event],
  );
  const row = rows[0];
  return {
    seasonGoalM: num(row?.seasonGoalM ?? null),
    manualPbM: num(row?.manualPbM ?? null),
    manualSbM: num(row?.manualSbM ?? null),
    manualSbSeason: num(row?.manualSbSeason ?? null),
    manualPracticeBestM: num(row?.manualPracticeBestM ?? null),
  };
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
};

const competitionColumns = `id, name, to_char(day, 'YYYY-MM-DD') as day, venue, "callRoomPlace",
  to_char("callRoomTime", 'HH24:MI') as "callRoomTime", to_char("startTime", 'HH24:MI') as "startTime", notes`;

export async function listCompetitionsBetween(
  userId: string,
  from: string,
  to: string,
): Promise<Competition[]> {
  const { rows } = await db().query<Competition>(
    `select ${competitionColumns} from competition where "userId" = $1 and day between $2 and $3
      order by day, "startTime" nulls last`,
    [userId, from, to],
  );
  return rows;
}

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
  ];
  if (input.id) {
    await db().query(
      `update competition set name = $3, day = $4, venue = $5, "callRoomPlace" = $6,
              "callRoomTime" = $7, "startTime" = $8, notes = $9
        where "userId" = $1 and id = $2`,
      [userId, input.id, ...values],
    );
  } else {
    await db().query(
      `insert into competition ("userId", name, day, venue, "callRoomPlace", "callRoomTime",
                                "startTime", notes)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, ...values],
    );
  }
}

export async function deleteCompetition(userId: string, id: string): Promise<void> {
  await db().query(`delete from competition where "userId" = $1 and id = $2`, [userId, id]);
}
