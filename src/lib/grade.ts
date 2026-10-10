import { GRADES, type Grade } from './profile-options';

/**
 * 生年月日からの学年（日本の数え方）。年度は4月に始まり、4月2日から翌年4月1日に生まれた人が同じ学年。
 * 学年は保存せず毎回ここで出すので、4月になると自動で1つ上がる。
 * 浪人・留年・飛び級などで計算と合わない人は、ずれ（offset、年数）を持つ
 */

/** 今日を含む年度（4月始まり） */
function schoolYear(day: string): number {
  const year = Number(day.slice(0, 4));
  return day.slice(5) >= '04-01' ? year : year - 1;
}

/** 生まれた人の学年の基準の年。4月2日以降の生まれはその年、4月1日までは前の年 */
function cohort(birthdate: string): number {
  const year = Number(birthdate.slice(0, 4));
  return birthdate.slice(5) >= '04-02' ? year : year - 1;
}

/** 小学1年を 1 とした学年の数。中1 が 7、高1 が 10、大1 が 13 */
export function gradeNumber(birthdate: string, today: string): number {
  return schoolYear(today) - cohort(birthdate) - 6;
}

/** 学年の数を選択肢へ。中学より下は選択肢に無いので null、大4 より上は一般 */
export function gradeFromNumber(n: number): Grade | null {
  if (n < 7) return null;
  if (n > 16) return 'adult';
  return GRADES[n - 7] ?? null;
}

function numberOf(grade: Grade): number {
  return GRADES.indexOf(grade) + 7;
}

/**
 * 学年を生年月日から計算する人か。日本の学年の数え方なので、日本の時間帯の人だけ。
 * ほかの国は学年の始まりも区切りの誕生日も違う（米英・中国は9月、韓国は3月、豪州は1〜2月）
 */
export function computesGrade(birthdate: string | null, timeZone: string): birthdate is string {
  return birthdate !== null && timeZone === 'Asia/Tokyo';
}

/** いまの学年。計算する人は計算とずれから、ほかの人は手で選んだ値 */
export function currentGrade(
  birthdate: string | null,
  timeZone: string,
  offset: number,
  manual: Grade | null,
  today: string,
): Grade | null {
  if (!computesGrade(birthdate, timeZone)) return manual;
  return gradeFromNumber(gradeNumber(birthdate, today) + offset);
}

/** 本人が選んだ学年を、計算とのずれに直す。一般を選んだときは、計算がすでに一般なら 0 */
export function offsetFor(birthdate: string, chosen: Grade, today: string): number {
  const computed = gradeNumber(birthdate, today);
  if (chosen === 'adult' && computed > 16) return 0;
  return numberOf(chosen) - computed;
}
