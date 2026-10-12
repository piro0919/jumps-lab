'use server';

import { refresh } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { aiEnabled, askJson } from '@/lib/ai';
import {
  countMenuQuestions,
  countMenusInMonth,
  getMenu,
  getProfile,
  listAttemptsBetween,
  listCompetitionsBetween,
  listConditionsBetween,
  listMenuMessages,
  type Profile,
  saveMenu,
  saveMenuExchange,
} from '@/lib/data';
import { addDays, daysBetween, todayIn } from '@/lib/dates';
import { type ActionResult, optionalText } from '@/lib/form';
import { NOTE_MAX_LENGTH } from '@/lib/limits';
import {
  CHAT_MODEL,
  checkMenu,
  type Menu,
  MENU_MODEL,
  MENU_SCHEMA,
  menuInstructions,
  MENUS_PER_MONTH,
  QUESTION_MAX_LENGTH,
  QUESTIONS_PER_DAY,
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
  const [logs, competitions, attempts] = await Promise.all([
    listConditionsBetween(userId, readinessFrom(today), today),
    listCompetitionsBetween(userId, today, readinessUntil(today)),
    listAttemptsBetween(userId, historyFrom, today),
  ]);
  const advice: Readiness = readiness({ today, logs, competitions, birthdate: profile.birthdate });
  return {
    advice,
    data: {
      today,
      athlete: {
        events: profile.events,
        age: profile.birthdate ? ageOn(profile.birthdate, today) : null,
        gender: profile.gender,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
      },
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
      upcomingCompetitions: competitions.map((c) => ({
        daysLeft: daysBetween(today, c.day),
        mainGoal: c.isTarget,
      })),
    },
  };
}

async function language(): Promise<'en' | 'ja'> {
  return (await getLocale()) === 'ja' ? 'ja' : 'en';
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
  if (!aiEnabled()) return { ok: false, error: 'generic' };
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'menuMinutes' };
  const profile = await getProfile(viewer.userId);
  if (!profile) return { ok: false, error: 'generic' };
  const today = todayIn(profile.timeZone);

  try {
    if (await getMenu(viewer.userId, today)) return { ok: true };
    if ((await countMenusInMonth(viewer.userId, today)) >= MENUS_PER_MONTH) {
      return { ok: false, error: 'menuLimit' };
    }
    const { advice, data } = await menuContext(viewer.userId, profile, today);
    const input = JSON.stringify({
      ...data,
      session: { minutes: parsed.data.minutes, note: parsed.data.note },
    });
    let instructions = menuInstructions(advice.level, await language());

    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      const menu = await askJson<Menu>({
        model: MENU_MODEL,
        instructions,
        input,
        schemaName: 'practice_menu',
        schema: MENU_SCHEMA,
      });
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
    return { ok: false, error: 'menuFailed' };
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
  if (!aiEnabled()) return { ok: false, error: 'generic' };
  const parsed = askSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'generic' };
  const profile = await getProfile(viewer.userId);
  if (!profile) return { ok: false, error: 'generic' };
  const today = todayIn(profile.timeZone);

  try {
    const current = await getMenu(viewer.userId, today);
    if (!current) return { ok: false, error: 'generic' };
    if ((await countMenuQuestions(viewer.userId, today)) >= QUESTIONS_PER_DAY) {
      return { ok: false, error: 'chatLimit' };
    }
    const [{ advice, data }, history] = await Promise.all([
      menuContext(viewer.userId, profile, today),
      listMenuMessages(viewer.userId, today),
    ]);
    const minutes = current.minutes ?? SESSION_MAX_MINUTES;
    const input = JSON.stringify({
      ...data,
      session: { minutes: current.minutes },
      currentMenu: current.menu,
      conversation: history
        .slice(-CHAT_HISTORY_MESSAGES)
        .map((m) => ({ role: m.role, text: m.content })),
      athleteMessage: parsed.data.question,
    });
    let instructions = revisionInstructions(advice.level, await language());
    // 強さが作ったときから変わっていたら（あとで痛みを記録したなど）、今のメニューのままでは出せない
    const levelChanged = advice.level !== current.level;
    if (levelChanged) {
      instructions = `${instructions}\nToday's intensity changed since the menu was made. You must revise the menu to fit the new intensity and set "changed" to true.`;
    }

    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      const answer = await askJson<Revision>({
        model: CHAT_MODEL,
        instructions,
        input,
        schemaName: 'menu_revision',
        schema: REVISION_SCHEMA,
      });
      const sessionMinutes = Math.min(
        SESSION_MAX_MINUTES,
        Math.max(SESSION_MIN_MINUTES, answer.changed ? answer.sessionMinutes : minutes),
      );
      const problem =
        answer.changed || levelChanged
          ? checkMenu(answer.menu, advice.level, sessionMinutes)
          : null;
      if (!problem) {
        const saved = await saveMenuExchange(viewer.userId, today, {
          fromVersion: current.version,
          question: parsed.data.question,
          reply: answer.reply,
          revised:
            answer.changed || levelChanged
              ? {
                  level: advice.level,
                  model: CHAT_MODEL,
                  menu: answer.menu,
                  minutes: sessionMinutes,
                }
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
    return { ok: false, error: 'menuFailed' };
  }
}
