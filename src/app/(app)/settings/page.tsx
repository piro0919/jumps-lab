import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { ProfileSettingsForm, RecordSettingsForm } from '@/components/profile-form';
import { Card, CardTitle, LABEL, PageTitle, FORM_PAGE } from '@/components/layout-ui';
import { DeleteAccountButton } from '@/components/delete-account-button';
import { SignOutButton } from '@/components/sign-out-button';
import { ThemeSetting } from '@/components/theme-setting';
import { LanguageSetting } from '@/components/language-setting';
import { PushSetting } from '@/components/push-setting';
import { isLocale, LOCALE_COOKIE } from '@/i18n/locales';
import { cookies } from 'next/headers';
import { todayIn } from '@/lib/dates';
import { videoUsage } from '@/lib/data';
import { currentGrade } from '@/lib/grade';
import { pushPublicKey } from '@/lib/push';
import { GIB, MIB, USER_VIDEO_BYTES } from '@/lib/videos';
import { requireProfile, requireViewer } from '@/lib/viewer';

/**
 * 設定。プロフィールと記録はカードごとに保存し、表示（配色）はその場で切り替わる。
 * 通知（鍵が揃っているときだけ。src/lib/push.ts の pushPublicKey）、
 * 最後にアカウント（ログインしている Google アカウントとログアウト、動画に使った量、アカウントの削除）。
 * プロフィールの欄だけを並べていて「設定がプロフィールっぽい」と言われ、区画に分けた（本人、2026-10-11）
 */
export default async function Settings() {
  const viewer = await requireViewer();
  // 動画に使った量は、プロフィールと並べて読む（1往復ぶん待ちを減らす）
  const [profile, used] = await Promise.all([
    requireProfile(viewer.userId),
    videoUsage(viewer.userId),
  ]);
  const t = await getTranslations('nav');
  const tProfile = await getTranslations('profile');
  const tVideos = await getTranslations('videos');
  const chosenLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const format = await getFormatter();
  const locale = await getLocale();
  const vapidPublicKey = pushPublicKey();
  // 動画に使った量。1人 1GB まで（src/lib/videos.ts）。MB は 1024 の倍で数える
  const megabytes = (bytes: number) =>
    format.number(bytes / MIB, {
      style: 'unit',
      unit: 'megabyte',
      maximumFractionDigits: 0,
    });

  return (
    <main className={FORM_PAGE}>
      <PageTitle>{t('settings')}</PageTitle>
      <ProfileSettingsForm
        initial={profile}
        initialGrade={currentGrade(
          profile.birthdate,
          profile.timeZone,
          profile.gradeOffset,
          profile.grade,
          todayIn(profile.timeZone),
        )}
      />
      <RecordSettingsForm initial={profile} locale={locale} />
      <Card>
        <CardTitle>{tProfile('sectionDisplay')}</CardTitle>
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>{t('theme')}</span>
          <ThemeSetting />
        </div>
        <div className="mt-4 flex flex-col gap-1.5">
          <span className={LABEL}>{t('language')}</span>
          <LanguageSetting current={isLocale(chosenLocale) ? chosenLocale : 'auto'} />
        </div>
      </Card>
      {vapidPublicKey && <PushSetting vapidPublicKey={vapidPublicKey} locale={locale} />}
      <Card>
        <CardTitle>{tProfile('sectionAccount')}</CardTitle>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={LABEL}>{tProfile('googleAccount')}</span>
            <span className="truncate text-sm font-semibold">{viewer.email}</span>
          </div>
          <SignOutButton />
        </div>
        <div className="mt-4 flex flex-col gap-1.5">
          <span className={LABEL}>{tVideos('usage')}</span>
          <span className="text-sm font-semibold tabular-nums">
            {tVideos('usageValue', {
              used: megabytes(used),
              limit: format.number(USER_VIDEO_BYTES / GIB, {
                style: 'unit',
                unit: 'gigabyte',
              }),
            })}
          </span>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, (used / USER_VIDEO_BYTES) * 100)}%` }}
            />
          </div>
        </div>
        <div className="mt-4">
          <DeleteAccountButton email={viewer.email} />
        </div>
      </Card>
    </main>
  );
}
