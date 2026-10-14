import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { TabBar } from '@/components/tab-bar';
import { isAdmin } from '@/lib/admin';
import { getActivityCounts, getProfile } from '@/lib/data';
import { requireViewer } from '@/lib/viewer';

/**
 * ログインしてプロフィールを済ませた人の画面。上に幅いっぱいのヘッダー。
 * スマホは下にタブ、幅 1024px 以上は切り替えをヘッダーの中に置き、本文を広げる（手本の Strava）。
 * 名前はセッションの控え（5分）ではなく DB から出す（設定で変えた直後に合わせるため）
 */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const viewer = await requireViewer();
  const profile = await getProfile(viewer.userId);
  if (!profile) redirect('/welcome');
  const activity = await getActivityCounts(viewer.userId);

  return (
    <>
      <SiteHeader
        name={profile.name}
        email={viewer.email}
        image={viewer.image}
        profile={{ events: profile.events, ...activity }}
        admin={isAdmin(viewer.email)}
      />
      <div className="mx-auto min-h-page-body max-w-lg pb-tab-bar md:max-w-3xl lg:max-w-6xl lg:px-4 lg:pb-10">
        {children}
      </div>
      <TabBar />
    </>
  );
}
