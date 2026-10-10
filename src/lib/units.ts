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
  // 0.1mm で丸めて持つので、フィート・インチで入れた値はインチに戻すと境目のわずかに下になることがある。
  // 4分の1インチの 1% （約 0.06mm）だけ足してから切り、入れた値に戻す
  const quarters = Math.floor((meters / INCH_M) * 4 + 0.01);
  const totalInches = quarters / 4;
  const feet = Math.floor(totalInches / INCHES_PER_FOOT);
  return { feet, inches: totalInches - feet * INCHES_PER_FOOT };
}

/** フィートとインチをメートルへ。0.1mm で丸める（DB の列と同じ。センチで丸めると戻らない） */
export function feetInchesToMeters({ feet, inches }: FeetInches): number {
  return Math.round((feet * INCHES_PER_FOOT + inches) * INCH_M * 10000) / 10000;
}

/**
 * 記録の表示。metric は「1.85 m」（センチで切り捨て。陸上の計測と同じ向き）、imperial は「6' 0¾"」
 */
export function formatMark(meters: number, units: Units): string {
  if (units === 'metric') return `${(Math.floor(meters * 100 + 1e-6) / 100).toFixed(2)} m`;
  const { feet, inches } = metersToFeetInches(meters);
  const whole = Math.floor(inches);
  const fraction = ['', '¼', '½', '¾'][Math.round((inches - whole) * 4)];
  // 目標までの差のような1フィート未満の長さは、インチだけで書く
  return feet === 0 ? `${whole}${fraction}"` : `${feet}' ${whole}${fraction}"`;
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
