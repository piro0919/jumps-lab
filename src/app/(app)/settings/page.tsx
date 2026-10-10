import { getLocale, getTranslations } from 'next-intl/server';
import { ProfileSettingsForm, RecordSettingsForm } from '@/components/profile-form';
import { Card, CardTitle, LABEL, PageTitle, FORM_PAGE } from '@/components/layout-ui';
import { SignOutButton } from '@/components/sign-out-button';
import { ThemeSetting } from '@/components/theme-setting';
import { getProfile } from '@/lib/data';
import { todayIn } from '@/lib/dates';
import { currentGrade } from '@/lib/grade';
import { requireViewer } from '@/lib/viewer';

/**
 * 設定。プロフィールと記録はカードごとに保存し、表示（配色）はその場で切り替わる。
 * 最後にアカウント（ログインしている Google アカウントとログアウト）。
 * プロフィールの欄だけを並べていて「設定がプロフィールっぽい」と言われ、区画に分けた（本人、2026-10-11）
 */
export default async function Settings() {
  const viewer = await requireViewer();
  const profile = (await getProfile(viewer.userId))!;
  const t = await getTranslations('nav');
  const tProfile = await getTranslations('profile');

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
      <RecordSettingsForm initial={profile} locale={await getLocale()} />
      <Card>
        <CardTitle>{tProfile('sectionDisplay')}</CardTitle>
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>{t('theme')}</span>
          <ThemeSetting />
        </div>
      </Card>
      <Card>
        <CardTitle>{tProfile('sectionAccount')}</CardTitle>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={LABEL}>{tProfile('googleAccount')}</span>
            <span className="truncate text-sm font-semibold">{viewer.email}</span>
          </div>
          <SignOutButton />
        </div>
      </Card>
    </main>
  );
}
