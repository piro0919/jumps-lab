import { getLocale, getTranslations } from 'next-intl/server';
import { ProfileForm } from '@/components/profile-form';
import { PageTitle } from '@/components/layout-ui';
import { getProfile } from '@/lib/data';
import { todayIn } from '@/lib/dates';
import { currentGrade } from '@/lib/grade';
import { requireViewer } from '@/lib/viewer';

export default async function Settings() {
  const viewer = await requireViewer();
  const profile = (await getProfile(viewer.userId))!;
  const t = await getTranslations('nav');

  return (
    <main className="flex flex-col gap-3 pb-6 lg:mx-auto lg:w-full lg:max-w-2xl">
      <PageTitle>{t('settings')}</PageTitle>
      <ProfileForm
        from="settings"
        initial={profile}
        initialGrade={currentGrade(
          profile.birthdate,
          profile.timeZone,
          profile.gradeOffset,
          profile.grade,
          todayIn(profile.timeZone),
        )}
        defaultName={profile.name}
        locale={await getLocale()}
      />
    </main>
  );
}
