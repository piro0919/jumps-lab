/**
 * 単位の換算。DB は長さをメートル、身長を cm、体重を kg で持ち、ここで表示の単位に直す。
 * imperial は米国の陸上の書き方に合わせ、記録はフィートとインチ（4分の1インチ刻み、切り捨て）で出す
 */
export type Units = 'metric' | 'imperial';

const INCH_M = 0.0254;
const INCHES_PER_FOOT = 12;
const POUND_KG = 0.45359237;

export type FeetInches = { feet: number; inches: number };

/**
 * メートルをフィートとインチへ。インチは 0.25 刻みに切り捨てる。
 * 記録を実際より良く見せないため（米国の換算表と同じ向き）
 */
export function metersToFeetInches(meters: number): FeetInches {
  // 浮動小数の誤差で 0.25 の境目を下に割らないよう、ごく小さく足してから切る
  const quarters = Math.floor((meters / INCH_M) * 4 + 1e-6);
  const totalInches = quarters / 4;
  const feet = Math.floor(totalInches / INCHES_PER_FOOT);
  return { feet, inches: totalInches - feet * INCHES_PER_FOOT };
}

export function feetInchesToMeters({ feet, inches }: FeetInches): number {
  return Math.round((feet * INCHES_PER_FOOT + inches) * INCH_M * 100) / 100;
}

/** 記録の表示。metric は「1.85 m」、imperial は「6' 0¾"」 */
export function formatMark(meters: number, units: Units): string {
  if (units === 'metric') return `${meters.toFixed(2)} m`;
  const { feet, inches } = metersToFeetInches(meters);
  const whole = Math.floor(inches);
  const fraction = ['', '¼', '½', '¾'][Math.round((inches - whole) * 4)];
  return `${feet}' ${whole}${fraction}"`;
}

export function cmToFeetInches(cm: number): FeetInches {
  const totalInches = Math.round(cm / 2.54);
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
}

export function feetInchesToCm({ feet, inches }: FeetInches): number {
  return Math.round((feet * 12 + inches) * 2.54 * 10) / 10;
}

export function kgToLb(kg: number): number {
  return Math.round(kg / POUND_KG);
}

export function lbToKg(lb: number): number {
  return Math.round(lb * POUND_KG * 10) / 10;
}
