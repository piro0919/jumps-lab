import { getLocale, getTranslations } from 'next-intl/server';
import { ProfileForm } from '@/components/profile-form';
import { SignOutButton } from '@/components/sign-out-button';
import { PageTitle } from '@/components/ui';
import { getProfile } from '@/lib/data';
import { requireViewer } from '@/lib/viewer';

export default async function Settings() {
  const viewer = await requireViewer();
  const profile = (await getProfile(viewer.userId))!;
  const t = await getTranslations('nav');

  return (
    <main className="flex flex-col gap-3 pb-6">
      <PageTitle>{t('settings')}</PageTitle>
      <ProfileForm
        from="settings"
        initial={profile}
        defaultName={profile.name}
        locale={await getLocale()}
      />
      <SignOutButton />
    </main>
  );
}
