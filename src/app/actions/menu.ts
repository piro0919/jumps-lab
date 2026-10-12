'use server';

import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { aiEnabled, askJson } from '@/lib/ai';
import {
  countMenusInMonth,
  getMenu,
  getProfile,
  listAttemptsBetween,
  listCompetitionsBetween,
  listConditionsBetween,
  saveMenu,
} from '@/lib/data';
import { addDays, daysBetween, todayIn } from '@/lib/dates';
import { type ActionResult, optionalText } from '@/lib/form';
import { NOTE_MAX_LENGTH } from '@/lib/limits';
import {
  checkMenu,
  type Menu,
  MENU_MODEL,
  MENU_SCHEMA,
  menuInstructions,
  MENUS_PER_MONTH,
  SESSION_MAX_MINUTES,
  SESSION_MIN_MINUTES,
} from '@/lib/menu';
import { ageOn, readiness, readinessFrom, readinessUntil } from '@/lib/readiness';
import { requireViewer } from '@/lib/viewer';

/** AI に渡す練習の記録の日数（中元さんの案の直近14日） */
const HISTORY_DAYS = 14;
/** 本数が上限を超えたときに作り直させる回数 */
const RETRIES = 1;

const schema = z.object({
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
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'menuMinutes' };
  const profile = await getProfile(viewer.userId);
  if (!profile) return { ok: false, error: 'generic' };
  const today = todayIn(profile.timeZone);

  try {
    if (await getMenu(viewer.userId, today)) return { ok: true };
    if ((await countMenusInMonth(viewer.userId, today)) >= MENUS_PER_MONTH) {
      return { ok: false, error: 'menuLimit' };
    }
    const historyFrom = addDays(today, 1 - HISTORY_DAYS);
    const [logs, competitions, attempts] = await Promise.all([
      listConditionsBetween(viewer.userId, readinessFrom(today), today),
      listCompetitionsBetween(viewer.userId, today, readinessUntil(today)),
      listAttemptsBetween(viewer.userId, historyFrom, today),
    ]);
    const advice = readiness({ today, logs, competitions, birthdate: profile.birthdate });

    // 名前やメールは渡さない。渡すのはメニューを決めるのに使う数と、本人が書いた今日のメモと痛みの欄
    const input = JSON.stringify({
      today,
      athlete: {
        events: profile.events,
        age: profile.birthdate ? ageOn(profile.birthdate, today) : null,
        gender: profile.gender,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
      },
      intensity: { level: advice.level, reasons: advice.reasons },
      session: { minutes: parsed.data.minutes, note: parsed.data.note },
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
    });
    const locale = (await getLocale()) === 'ja' ? 'ja' : 'en';
    let instructions = menuInstructions(advice.level, locale);

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
        await saveMenu(viewer.userId, today, { level: advice.level, model: MENU_MODEL, menu });
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
