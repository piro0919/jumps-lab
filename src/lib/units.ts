/**
 * 単位の換算。DB は長さをメートル、身長を cm、体重を kg で持ち、ここで表示の単位に直す。
 * imperial は米国の陸上の書き方に合わせ、記録はフィートとインチ（4分の1インチ刻み、切り捨て）で出す
 */
export type Units = 'metric' | 'imperial';

const INCH_M = 0.0254;
const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;
const POUND_KG = 0.45359237;
/** 記録のインチの刻み（4分の1インチ） */
const QUARTERS_PER_INCH = 4;
/** 4分の1インチの 1%。切り捨ての前に足して、入れた値に戻す */
const QUARTER_SLACK = 0.01;
/** メートルを 0.1mm で丸めるときの倍率（DB の列と同じ桁） */
export const TENTH_MM_PER_M = 10000;
/** センチで切り捨てる前に足す、小数の誤差の分 */
const FLOAT_SLACK = 1e-6;
/** 身長と体重を小数1桁で丸めるときの倍率 */
const ONE_DECIMAL = 10;

export type FeetInches = { feet: number; inches: number };

/**
 * メートルをフィートとインチへ。インチは 0.25 刻みに切り捨てる。
 * 記録を実際より良く見せないため（米国の換算表と同じ向き）
 */
export function metersToFeetInches(meters: number): FeetInches {
  // 0.1mm で丸めて持つので、フィート・インチで入れた値はインチに戻すと境目のわずかに下になることがある。
  // 4分の1インチの 1% （約 0.06mm）だけ足してから切り、入れた値に戻す
  const quarters = Math.floor((meters / INCH_M) * QUARTERS_PER_INCH + QUARTER_SLACK);
  const totalInches = quarters / QUARTERS_PER_INCH;
  const feet = Math.floor(totalInches / INCHES_PER_FOOT);
  return { feet, inches: totalInches - feet * INCHES_PER_FOOT };
}

/** フィートとインチをメートルへ。0.1mm で丸める（DB の列と同じ。センチで丸めると戻らない） */
export function feetInchesToMeters({ feet, inches }: FeetInches): number {
  return Math.round((feet * INCHES_PER_FOOT + inches) * INCH_M * TENTH_MM_PER_M) / TENTH_MM_PER_M;
}

/**
 * 記録の表示。metric は「1.85 m」（センチで切り捨て。陸上の計測と同じ向き）、imperial は「6' 0¾"」
 */
export function formatMark(meters: number, units: Units): string {
  if (units === 'metric') return `${(Math.floor(meters * 100 + FLOAT_SLACK) / 100).toFixed(2)} m`;
  const { feet, inches } = metersToFeetInches(meters);
  // 目標までの差のような1フィート未満の長さは、インチだけで書く
  return feet === 0 ? quarterInches(inches) : `${feet}' ${quarterInches(inches)}`;
}

/** 4分の1インチ刻みのインチを「4¾"」の形に */
function quarterInches(inches: number): string {
  const whole = Math.floor(inches);
  const fraction = ['', '¼', '½', '¾'][Math.round((inches - whole) * QUARTERS_PER_INCH)];
  return `${whole}${fraction}"`;
}

/** インチを cm へ。0.1cm で丸める（DB の列と同じ桁。4分の1インチ刻みの値はこれで戻る） */
export function inchesToCm(inches: number): number {
  return Math.round(inches * CM_PER_INCH * ONE_DECIMAL) / ONE_DECIMAL;
}

/** cm をいちばん近い4分の1インチへ。入力の欄に戻すときと表示に使う */
export function cmToQuarterInches(cm: number): number {
  return Math.round((cm / CM_PER_INCH) * QUARTERS_PER_INCH) / QUARTERS_PER_INCH;
}

/**
 * 踏切板からの距離や支柱の位置のような、短い長さ（cm。0 以上）の表示。metric は「12 cm」（1cm に丸める）、
 * imperial は「4¾"」（いちばん近い4分の1インチ）。記録ではないので、切り捨てずに丸める
 */
export function formatShortLength(cm: number, units: Units): string {
  if (units === 'metric') return `${Math.round(cm)} cm`;
  return quarterInches(cmToQuarterInches(cm));
}

/**
 * 記録を数字と単位に分ける。大きな数字の横に単位を小さく添えるため。
 * imperial はフィートとインチの記号が数字の一部なので、単位は空
 */
export function formatMarkParts(meters: number, units: Units): { value: string; unit: string } {
  if (units === 'imperial') return { value: formatMark(meters, units), unit: '' };
  return { value: formatMark(meters, units).replace(/ m$/, ''), unit: 'm' };
}

export function cmToFeetInches(cm: number): FeetInches {
  const totalInches = Math.round(cm / CM_PER_INCH);
  return {
    feet: Math.floor(totalInches / INCHES_PER_FOOT),
    inches: totalInches % INCHES_PER_FOOT,
  };
}

export function feetInchesToCm({ feet, inches }: FeetInches): number {
  return Math.round((feet * INCHES_PER_FOOT + inches) * CM_PER_INCH * ONE_DECIMAL) / ONE_DECIMAL;
}

export function kgToLb(kg: number): number {
  return Math.round(kg / POUND_KG);
}

export function lbToKg(lb: number): number {
  return Math.round(lb * POUND_KG * ONE_DECIMAL) / ONE_DECIMAL;
}
