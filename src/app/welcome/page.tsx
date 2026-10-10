import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { ProfileForm } from '@/components/profile-form';
import { PageTitle } from '@/components/layout-ui';
import { SiteHeader } from '@/components/site-header';
import { getProfile } from '@/lib/data';
import { requireViewer } from '@/lib/viewer';

/**
 * 初めてログインした人のプロフィール設定。済んでいればホームへ。
 * ほかの画面と同じヘッダー（ロゴと自分のアイコン）を付ける。付けずにフォームだけを黒い地に浮かせていて、
 * 画面がシュールすぎると言われた（本人、2026-10-11）
 */
export default async function Welcome() {
  const viewer = await requireViewer();
  if (await getProfile(viewer.userId)) redirect('/');
  const t = await getTranslations('profile');

  return (
    <>
      <SiteHeader name={viewer.name} email={viewer.email} image={viewer.image} minimal />
      <main className="mx-auto max-w-lg">
        <PageTitle>{t('welcome')}</PageTitle>
        <div className="pb-8">
          <ProfileForm defaultName={viewer.name} locale={await getLocale()} />
        </div>
      </main>
    </>
  );
}
