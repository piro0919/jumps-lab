import { addDays, daysBetween, ISO_MONTH_START, ISO_YEAR_END } from './dates';

/**
 * 今日のアドバイス（ホームのカード）。その日の体調と大会の予定から、今日の練習の強さを決める。
 * 2026-10-11 に本人と決めた。根拠を2回調べ、数字ごとに出典を持たせている（REASON_SOURCES）。
 * 跳躍の本数のような中身には研究の裏付けが無いので、ここでは強さだけを決め、メニューは出さない。
 *
 * 上から順に見て、最初に当たったものを今日の強さにする:
 * 1. 患部を守る: 今日の痛み・違和感の欄に記入がある（IOC の合意声明。痛みを見ながら続ける方式は使わない）
 * 2. 試合前の軽め: 大会まで0〜3日（量だけ減らし、強さと跳躍の質は保つ）
 * 3. 調整期: 主目標の大会まで14日以内（Bosquet 2007: 2週間、量を減らし強さと頻度は保つ）
 * 4. 軽め: 昨夜の睡眠が6時間以下（Craven 2022）、直近7晩の平均が推奨の下限未満（18歳未満は8時間、
 *    それ以上は7時間。AASM・NSF）、疲労か体調がふだんより大きく悪い
 * 5. 通常
 * 理由は当たったものを全部並べる（強さを決めた1つだけでなく）
 */

/** 前の晩の睡眠がこれ以下なら軽め（Craven 2022 の睡眠不足の定義） */
const SHORT_NIGHT_HOURS = 6;
/** 推奨の睡眠の下限。18歳未満は8時間（AASM・NSF）、18歳以上は7時間（NSF）。年齢が分からなければ若い側 */
const YOUTH_SLEEP_HOURS = 8;
const ADULT_SLEEP_HOURS = 7;
const ADULT_AGE = 18;
/** 睡眠の平均を見る日数と、平均を出すのに要る晩の数（どちらも仮決め。根拠のある数字は無い） */
const SLEEP_WINDOW_DAYS = 7;
const SLEEP_MIN_NIGHTS = 3;
/** 試合前の軽めにする日数（大会の当日を含む） */
const PRE_MEET_DAYS = 3;
/** 主目標の大会の前、調整期にする日数（Bosquet 2007 の2週間） */
const TAPER_DAYS = 14;
/** 時期の表示で「主目標の大会に向けた期間」とする日数（仮決め） */
const TOWARD_TARGET_DAYS = 56;
/**
 * 疲労と体調。記録が BASELINE_MIN_LOGS 件たまるまでは決まった線（仮決め）で、たまったら
 * 直近 BASELINE_WINDOW_DAYS 日の本人の平均から WORSE_BY 以上悪いときに軽めにする。
 * 決まった線も、本人の平均からの差も、検証された数字は見つかっていない（仮決め）
 */
const HIGH_FATIGUE = 8;
const LOW_CONDITION = 3;
const BASELINE_WINDOW_DAYS = 28;
const BASELINE_MIN_LOGS = 14;
const WORSE_BY = 2;
const DAYS_PER_WEEK = 7;
/** 睡眠の平均は小数1桁で出す */
const TENTHS = 10;

type ReadinessLevel = 'protect' | 'preMeet' | 'taper' | 'lighter' | 'normal';

export type ReadinessReason =
  | { key: 'injury' }
  | { key: 'preMeet'; days: number }
  | { key: 'taper'; days: number }
  | { key: 'shortNight'; hours: number }
  | { key: 'shortWeek'; average: number; target: number }
  | { key: 'fatigue'; value: number }
  | { key: 'condition'; value: number };

export type Readiness = {
  level: ReadinessLevel;
  reasons: ReadinessReason[];
  /** 主目標の大会まで何週か。8週より先か、主目標の大会が無ければ null（準備期） */
  weeksToTarget: number | null;
  /** 今日の体調が入っていない（体調からの判定はしていない） */
  needsLog: boolean;
};

export type ConditionLog = {
  day: string;
  condition: number | null;
  fatigue: number | null;
  sleepHours: number | null;
  injury: string | null;
};

/** 理由ごとの出典。画面で「出典」のリンクにする */
export const REASON_SOURCES: Record<ReadinessReason['key'], string> = {
  injury:
    'https://www.ausport.gov.au/__data/assets/pdf_file/0004/689647/IOC_consensus_statement_on_youth_athletic_development.pdf',
  preMeet: 'https://www.jaaf.or.jp/files/upload/201812/jhs-004.pdf',
  taper: 'https://pubmed.ncbi.nlm.nih.gov/17762369/',
  shortNight: 'https://bjsm.bmj.com/content/55/7/356.abstract',
  shortWeek: 'https://aasm.org/?p=2098',
  fatigue: 'https://bjsm.bmj.com/content/50/5/281',
  condition: 'https://bjsm.bmj.com/content/50/5/281',
};

/** 誕生日を迎えた年数 */
export function ageOn(birthdate: string, today: string): number {
  const years = Number(today.slice(0, ISO_YEAR_END)) - Number(birthdate.slice(0, ISO_YEAR_END));
  // 月日（MM-DD）で、今年の誕生日を過ぎたか
  return today.slice(ISO_MONTH_START) >= birthdate.slice(ISO_MONTH_START) ? years : years - 1;
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** 決まった線か本人の平均で、その値が悪いか。high は大きいほど悪い（疲労） */
function worse(
  value: number | null,
  history: (number | null)[],
  fixed: number,
  high: boolean,
): boolean {
  if (value === null) return false;
  const past = history.filter((v): v is number => v !== null);
  if (past.length < BASELINE_MIN_LOGS) return high ? value >= fixed : value <= fixed;
  const mean = average(past);
  return high ? value >= mean + WORSE_BY : value <= mean - WORSE_BY;
}

export function readiness({
  today,
  logs,
  competitions,
  birthdate,
}: {
  today: string;
  /** 直近の体調（今日を含む、BASELINE_WINDOW_DAYS 日ぶん） */
  logs: ConditionLog[];
  /** 今日以降の大会 */
  competitions: { day: string; isTarget: boolean }[];
  birthdate: string | null;
}): Readiness {
  const reasons: ReadinessReason[] = [];
  const todayLog = logs.find((log) => log.day === today) ?? null;

  if (todayLog?.injury) reasons.push({ key: 'injury' });

  const next = competitions.find((c) => c.day >= today);
  const daysToNext = next ? daysBetween(today, next.day) : null;
  if (daysToNext !== null && daysToNext <= PRE_MEET_DAYS) {
    reasons.push({ key: 'preMeet', days: daysToNext });
  }
  const target = competitions.find((c) => c.isTarget && c.day >= today);
  const daysToTarget = target ? daysBetween(today, target.day) : null;
  if (daysToTarget !== null && daysToTarget > PRE_MEET_DAYS && daysToTarget <= TAPER_DAYS) {
    reasons.push({ key: 'taper', days: daysToTarget });
  }

  // 睡眠: 昨夜（今日の記録の睡眠）と、直近7晩の平均
  const lastNight = todayLog?.sleepHours ?? null;
  if (lastNight !== null && lastNight <= SHORT_NIGHT_HOURS) {
    reasons.push({ key: 'shortNight', hours: lastNight });
  }
  const weekStart = addDays(today, 1 - SLEEP_WINDOW_DAYS);
  const nights = logs
    .filter((log) => log.day >= weekStart && log.day <= today)
    .map((log) => log.sleepHours)
    .filter((h): h is number => h !== null);
  const sleepTarget =
    birthdate !== null && ageOn(birthdate, today) >= ADULT_AGE
      ? ADULT_SLEEP_HOURS
      : YOUTH_SLEEP_HOURS;
  if (nights.length >= SLEEP_MIN_NIGHTS && average(nights) < sleepTarget) {
    reasons.push({
      key: 'shortWeek',
      average: Math.round(average(nights) * TENTHS) / TENTHS,
      target: sleepTarget,
    });
  }

  // 疲労と体調: 今日の値を、今日より前の記録と比べる
  const before = logs.filter((log) => log.day < today);
  if (
    worse(
      todayLog?.fatigue ?? null,
      before.map((l) => l.fatigue),
      HIGH_FATIGUE,
      true,
    )
  ) {
    reasons.push({ key: 'fatigue', value: todayLog!.fatigue! });
  }
  if (
    worse(
      todayLog?.condition ?? null,
      before.map((l) => l.condition),
      LOW_CONDITION,
      false,
    )
  ) {
    reasons.push({ key: 'condition', value: todayLog!.condition! });
  }

  const has = (key: ReadinessReason['key']) => reasons.some((r) => r.key === key);
  const level: ReadinessLevel = has('injury')
    ? 'protect'
    : has('preMeet')
      ? 'preMeet'
      : has('taper')
        ? 'taper'
        : reasons.length > 0
          ? 'lighter'
          : 'normal';

  return {
    level,
    reasons,
    weeksToTarget:
      daysToTarget !== null && daysToTarget <= TOWARD_TARGET_DAYS
        ? Math.ceil(daysToTarget / DAYS_PER_WEEK)
        : null,
    needsLog: todayLog === null,
  };
}

/** 体調を読む範囲の始まり（今日を含めて BASELINE_WINDOW_DAYS 日） */
export function readinessFrom(today: string): string {
  return addDays(today, 1 - BASELINE_WINDOW_DAYS);
}

/** 大会を読む範囲の終わり（主目標に向けた期間の表示まで） */
export function readinessUntil(today: string): string {
  return addDays(today, TOWARD_TARGET_DAYS);
}
