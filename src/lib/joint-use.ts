import { consenterFor } from '@/lib/guardian';

/**
 * 共同利用（プライバシーポリシー 4.）の項目の版。項目は原則として後から変えられず（個人情報保護委員会の通則ガイドライン）、
 * 足すときは利用者に変更を示して同意を取り直してから一覧に書き足す（2026-10-14 に決めた）。
 * 版 1 は 2026-10-14 の一覧、版 2 は「その日の天気」を足した一覧（2026-10-18、本人が同意の取り直しを選んだ）。
 * profile."jointUseVersion" が null の人は版 1。これから作るプロフィールは、ログインの画面で今のポリシーに同意しているので
 * 今の版を入れる（saveProfile）
 */
export const JOINT_USE_VERSION = 2;

/** 天気を足した版。これより前の版の人の天気は保存しない */
const WEATHER_JOINT_USE_VERSION = 2;

type WeatherProfile = {
  jointUseVersion: number | null;
  birthdate: string | null;
  ageDeclared16Plus: boolean | null;
};

/**
 * 天気を保存してよいか。同意した版が天気を含み、本人が同意できる人（16歳以上。src/lib/guardian.ts）だけ。
 * 16歳未満と、生年月日が無く16歳以上かをまだ答えていない人には、天気の欄を出さない（保護者の同意の流れは作っていない。仮決め）
 */
export function weatherAllowed(profile: WeatherProfile, today: string): boolean {
  return weatherConsentable(profile, today) && weatherAgreed(profile);
}

function weatherAgreed(profile: WeatherProfile): boolean {
  return (profile.jointUseVersion ?? 1) >= WEATHER_JOINT_USE_VERSION;
}

function weatherConsentable(profile: WeatherProfile, today: string): boolean {
  return (
    consenterFor({
      birthdate: profile.birthdate,
      declared16Plus: profile.ageDeclared16Plus,
      today,
    }) === 'self'
  );
}

/**
 * コンディションの欄で天気をどう扱うか。fetch は今いる場所の天気を取れる、consent は先に同意を聞く、none は欄を出さない。
 * 取れるのは今日だけ（過ぎた日に今の天気を入れると違う天気が残る）。すでに残した天気は、日によらず欄に出す
 */
export type WeatherAccess = 'fetch' | 'consent' | 'none';

export function weatherAccess(profile: WeatherProfile, day: string, today: string): WeatherAccess {
  if (day !== today || !weatherConsentable(profile, today)) return 'none';
  return weatherAgreed(profile) ? 'fetch' : 'consent';
}

/** 送られてきたコンディションから、残してよくない天気を外す（同意していない人・16歳未満の人の天気は残さない） */
export function keepWeatherIfAllowed<T extends { weather: unknown }>(
  input: T,
  profile: WeatherProfile,
  today: string,
): T {
  return weatherAllowed(profile, today) ? input : { ...input, weather: null };
}
