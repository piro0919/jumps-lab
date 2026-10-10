import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { ProfileForm } from '@/components/profile-form';
import { PageTitle } from '@/components/layout-ui';
import { getProfile } from '@/lib/data';
import { requireViewer } from '@/lib/viewer';

/** 初めてログインした人のプロフィール設定。済んでいればホームへ */
export default async function Welcome() {
  const viewer = await requireViewer();
  if (await getProfile(viewer.userId)) redirect('/');
  const t = await getTranslations('profile');

  return (
    <main className="mx-auto max-w-lg">
      <PageTitle>{t('welcome')}</PageTitle>
      <div className="pb-8">
        <ProfileForm defaultName={viewer.name} locale={await getLocale()} />
      </div>
    </main>
  );
}
