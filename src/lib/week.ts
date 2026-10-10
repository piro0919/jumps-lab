/**
 * 週の始まり（0 が日曜、1 が月曜）。登録したときのはじめの値をブラウザの地域から決める（設定で直せる）。
 * Intl の週の情報（getWeekInfo、古い版は weekInfo）があればそれに従い、月曜始まりの地域だけを月曜にする
 * （土曜始まりの地域は日曜に寄せる。選べるのは日曜と月曜だけ）。
 * 無いブラウザでは時間帯から推す: 南北アメリカと、東アジアの日曜始まりの国は日曜、ほかは月曜
 */
type WeekInfo = { firstDay: number };

const SUNDAY_ZONES = new Set([
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Taipei',
  'Asia/Hong_Kong',
  'Asia/Macau',
  'Asia/Manila',
  'Asia/Jerusalem',
]);

export function weekStartFor(locale: string, timeZone: string): 0 | 1 {
  try {
    const intl = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => WeekInfo;
      weekInfo?: WeekInfo;
    };
    const info = intl.getWeekInfo?.() ?? intl.weekInfo;
    if (info) return info.firstDay === 1 ? 1 : 0;
  } catch {
    // 言語の名前が読めないときは時間帯で決める
  }
  return timeZone.startsWith('America/') || SUNDAY_ZONES.has(timeZone) ? 0 : 1;
}
