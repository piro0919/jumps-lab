'use server';

import { refresh } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { AI_CONSENT_VERSION, AiError, aiConsenter, aiEnabled, aiUsable, askJson } from '@/lib/ai';
import { eventBests } from '@/lib/bests';
import {
  consentToAi,
  countAiCalls,
  getMenu,
  getProfile,
  getTargets,
  listAllAttempts,
  listAttemptsBetween,
  listCompetitionsBetween,
  listConditionsBetween,
  listMenuMessages,
  type Profile,
  recordAiCall,
  saveMenu,
  saveMenuExchange,
} from '@/lib/data';
import { addDays, daysBetween, todayIn } from '@/lib/dates';
import { type ActionResult, optionalText } from '@/lib/form';
import { NOTE_MAX_LENGTH } from '@/lib/limits';
import {
  AI_CALL_LIMITS,
  CHAT_MODEL,
  checkMenu,
  type Menu,
  MENU_MODEL,
  MENU_SCHEMA,
  menuInstructions,
  menuTotals,
  QUESTION_MAX_LENGTH,
  REPLY_MAX_LENGTH,
  type Revision,
  REVISION_SCHEMA,
  revisionInstructions,
  SESSION_MAX_MINUTES,
  SESSION_MIN_MINUTES,
} from '@/lib/menu';
import { ageOn, type Readiness, readiness, readinessFrom, readinessUntil } from '@/lib/readiness';
import { requireViewer } from '@/lib/viewer';

/** AI に渡す練習の記録の日数（中元さんの案の直近14日） */
const HISTORY_DAYS = 14;
/** 本数が上限を超えたときに作り直させる回数 */
const RETRIES = 1;
/** チャットで前のやりとりを何件まで渡すか（長くなるほど1回の費用が増える。仮決め） */
const CHAT_HISTORY_MESSAGES = 10;

/**
 * 今日の強さと、AI に渡す材料。名前やメールは渡さない。
 * 渡すのはメニューを決めるのに使う数と、本人が書いた今日のメモと痛みの欄
 */
async function menuContext(userId: string, profile: Profile, today: string) {
  const historyFrom = addDays(today, 1 - HISTORY_DAYS);
  const [logs, competitions, attempts, targets, allAttempts] = await Promise.all([
    listConditionsBetween(userId, readinessFrom(today), today),
    listCompetitionsBetween(userId, today, readinessUntil(today)),
    listAttemptsBetween(userId, historyFrom, today),
    getTargets(userId, profile.events),
    listAllAttempts(userId),
  ]);
  // 種目ごとの自己ベストと今季ベスト。ホームと同じ数え方（記録と手で入れた値の高い方、追い風参考は除く）。
  // 中元さんの案（2026-10-14 のお返事で合意）。練習ベストと目標は渡さない
  const bests = profile.events.map((event) => {
    const { pbM, sbM } = eventBests(
      allAttempts,
      event,
      targets.get(event),
      today,
      profile.seasonStartMonth,
    );
    return { event, personalBestM: pbM, seasonBestM: sbM };
  });
  const advice: Readiness = readiness({ today, logs, competitions, birthdate: profile.birthdate });
  // 今日の大会（あれば、練習ではなくアップの段取りを作る）。招集か開始の早いもの
  const firstTime = (c: { callRoomTime: string | null; startTime: string | null }) =>
    c.callRoomTime ?? c.startTime ?? '99:99';
  const meet =
    competitions
      .filter((c) => c.day === today)
      .toSorted((a, b) => firstTime(a).localeCompare(firstTime(b)))[0] ?? null;
  return {
    advice,
    meetDay: meet !== null,
    data: {
      today,
      athlete: {
        events: profile.events,
        age: profile.birthdate ? ageOn(profile.birthdate, today) : null,
        gender: profile.gender,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
      },
      bests,
      intensity: { level: advice.level, reasons: advice.reasons },
      last14Days: logs
        .filter((log) => log.day >= historyFrom)
        .map((log) => ({
          day: log.day,
          condition: log.condition,
          fatigue: log.fatigue,
          sleepHours: log.sleepHours,
          pain: log.injury,
          practiceNote: log.note,
        })),
      attemptsLast14Days: attempts.map((a) => ({
        day: a.day,
        event: a.event,
        kind: a.kind,
        markM: a.markM,
        windMs: a.windMs,
        note: a.note,
      })),
      meetToday: meet && {
        venue: meet.venue,
        callRoomPlace: meet.callRoomPlace,
        callRoomTime: meet.callRoomTime,
        startTime: meet.startTime,
        notes: meet.notes,
      },
      upcomingCompetitions: competitions.map((c) => ({
        daysLeft: daysBetween(today, c.day),
        mainGoal: c.isTarget,
      })),
    },
  };
}

/** 今日・今月の AI の呼び出しが上限に達しているか */
async function overLimit(userId: string, today: string, kind: 'menu' | 'chat'): Promise<boolean> {
  const used = await countAiCalls(userId, today, kind);
  const limit = AI_CALL_LIMITS[kind];
  return used.today >= limit.perDay || used.month >= limit.perMonth;
}

/**
 * AI が答えられなかったときに画面へ返すエラー。理由は種類だけで伝え、キーや支払いのことは選手に言わない
 * （残高切れも「今は使えない、記録はつけられる」と出す）。分からないものは今までどおり menuFailed
 */
function aiFailure(error: unknown): string {
  if (!(error instanceof AiError)) return 'menuFailed';
  switch (error.kind) {
    case 'auth':
    case 'quota':
      return 'aiUnavailable';
    case 'busy':
      return 'aiBusy';
    case 'unknown':
      return 'menuFailed';
  }
}

async function language(): Promise<'en' | 'ja'> {
  return (await getLocale()) === 'ja' ? 'ja' : 'en';
}

/**
 * AI コーチを使うことに本人が同意する（/log/[day]/menu/new の同意の画面）。同意したら同じ画面を描き直し、メニューの入力を出す。
 * 本人が同意できるのは16歳以上だけ（src/lib/guardian.ts）。生年月日の無い人は「16歳以上です」と答えて押し（adult=yes）、
 * 答えも残す。生年月日から16歳未満の人と、16歳未満と答えたり分かったりした人（"ageDeclared16Plus" が false）は断る
 * （保護者の同意が要る。答えの上書きは DB でも断る）
 */
export async function consentAiAction(formData: FormData): Promise<ActionResult> {
  const viewer = await requireViewer();
  const profile = await getProfile(viewer.userId);
  if (!profile || !aiEnabled(profile)) return { ok: false, error: 'generic' };
  const declaredAdult = formData.get('adult') === 'yes';
  const allowed =
    profile.birthdate === null
      ? declaredAdult && profile.ageDeclared16Plus !== false
      : aiConsenter(profile) === 'self';
  if (!allowed) return { ok: false, error: 'generic' };
  try {
    const saved = await consentToAi(viewer.userId, AI_CONSENT_VERSION, profile.birthdate === null);
    if (!saved) return { ok: false, error: 'generic' };
  } catch (error) {
    console.error(error);
    return { ok: false, error: 'generic' };
  }
  refresh();
  return { ok: true };
}

const createSchema = z.object({
  minutes: z.coerce.number().int().min(SESSION_MIN_MINUTES).max(SESSION_MAX_MINUTES),
  note: optionalText(NOTE_MAX_LENGTH),
});

/**
 * 今日のメニューを AI に作らせて保存する（1日に1つ）。今日の強さは readiness.ts が決め、
 * AI が返したメニューの跳躍の本数が上限を超えていれば作り直させ、それでも超えれば保存しない
 */
export async function createMenuAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const profile = await getProfile(viewer.userId);
  if (!profile || !aiUsable(profile)) return { ok: false, error: 'generic' };
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'menuMinutes' };
  const today = todayIn(profile.timeZone);

  try {
    if (await getMenu(viewer.userId, today)) return { ok: true };
    if (await overLimit(viewer.userId, today, 'menu')) return { ok: false, error: 'menuLimit' };
    const { advice, meetDay, data } = await menuContext(viewer.userId, profile, today);
    const input = JSON.stringify({
      ...data,
      session: { minutes: parsed.data.minutes, note: parsed.data.note },
    });
    let instructions = menuInstructions(advice.level, await language(), meetDay);

    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      // 呼ぶ前に記録する（失敗しても上限に数える）
      await recordAiCall(viewer.userId, today, 'menu', MENU_MODEL);
      const answer = await askJson<Menu>({
        model: MENU_MODEL,
        instructions,
        input,
        schemaName: 'practice_menu',
        schema: MENU_SCHEMA,
      });
      // 種類（練習か大会の当日のアップか）はサーバーが入れる
      const menu: Menu = { ...answer, meetDay };
      const problem = checkMenu(menu, advice.level, parsed.data.minutes);
      if (!problem) {
        await saveMenu(viewer.userId, today, {
          level: advice.level,
          model: MENU_MODEL,
          menu,
          minutes: parsed.data.minutes,
        });
        return { ok: true };
      }
      console.warn(`メニューを作り直させます: ${problem}`);
      instructions = `${instructions}\nYour previous menu was rejected: ${problem} Stay within the limits.`;
    }
    return { ok: false, error: 'menuFailed' };
  } catch (error) {
    console.error(error);
    return { ok: false, error: aiFailure(error) };
  }
}

const askSchema = z.object({
  question: z.string().trim().min(1).max(QUESTION_MAX_LENGTH),
});

/**
 * 今日のメニューについて AI に相談する（第2段階。課金ができるまで全員）。
 * 返事を保存し、メニューを直したなら上限を確かめてから版を上げて上書きする。
 * 強さは送るたびに判定し直す（あとから痛みを記録した日は、直したメニューも跳ばない）
 */
export async function askMenuAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const profile = await getProfile(viewer.userId);
  if (!profile || !aiUsable(profile)) return { ok: false, error: 'generic' };
  const parsed = askSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'generic' };
  const today = todayIn(profile.timeZone);

  try {
    const current = await getMenu(viewer.userId, today);
    if (!current) return { ok: false, error: 'generic' };
    if (await overLimit(viewer.userId, today, 'chat')) return { ok: false, error: 'chatLimit' };
    const [{ advice, data }, history] = await Promise.all([
      menuContext(viewer.userId, profile, today),
      listMenuMessages(viewer.userId, today),
    ]);
    // 練習時間を持たないメニュー（チャットより前に作ったもの）は、メニューの合計の分を練習時間とみなす
    const minutes = current.minutes ?? menuTotals(current.menu).minutes;
    const input = JSON.stringify({
      ...data,
      session: { minutes: current.minutes },
      currentMenu: current.menu,
      conversation: history
        .slice(-CHAT_HISTORY_MESSAGES)
        .map((m) => ({ role: m.role, text: m.content })),
      athleteMessage: parsed.data.question,
    });
    // 種類は作ったときのまま（練習のメニューを作ったあとで当日の大会を足しても、アップに書き換えない）
    const meetDay = current.menu.meetDay ?? false;
    let instructions = revisionInstructions(advice.level, await language(), meetDay);
    // 強さが作ったときから変わっていたら（あとで痛みを記録したなど）、今のメニューのままでは出せない
    const levelChanged = advice.level !== current.level;
    if (levelChanged) {
      instructions = `${instructions}\nToday's intensity changed since the menu was made. You must revise the menu to fit the new intensity and set "changed" to true.`;
    }

    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      await recordAiCall(viewer.userId, today, 'chat', CHAT_MODEL);
      const answer = await askJson<Revision>({
        model: CHAT_MODEL,
        instructions,
        input,
        schemaName: 'menu_revision',
        schema: REVISION_SCHEMA,
      });
      // 強さが変わった日は、直したメニューが無ければ出せない
      const revised =
        (answer.changed || levelChanged) && answer.menu ? { ...answer.menu, meetDay } : null;
      const sessionMinutes = Math.min(
        SESSION_MAX_MINUTES,
        Math.max(SESSION_MIN_MINUTES, revised ? answer.sessionMinutes : minutes),
      );
      const problem =
        (answer.changed || levelChanged) && !answer.menu
          ? 'The revised menu is missing.'
          : revised
            ? checkMenu(revised, advice.level, sessionMinutes)
            : null;
      if (!problem) {
        const saved = await saveMenuExchange(viewer.userId, today, {
          fromVersion: current.version,
          question: parsed.data.question,
          // 返事の長さは表の柵に合わせて切る（超えると保存ごと失敗する）
          reply: answer.reply.slice(0, REPLY_MAX_LENGTH),
          revised: revised
            ? { level: advice.level, model: CHAT_MODEL, menu: revised, minutes: sessionMinutes }
            : null,
        });
        if (!saved) return { ok: false, error: 'generic' };
        refresh();
        return { ok: true };
      }
      console.warn(`直したメニューを作り直させます: ${problem}`);
      instructions = `${instructions}\nYour previous menu was rejected: ${problem} Stay within the limits.`;
    }
    return { ok: false, error: 'menuFailed' };
  } catch (error) {
    console.error(error);
    return { ok: false, error: aiFailure(error) };
  }
}
