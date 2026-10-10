import { redirect } from 'next/navigation';
import { TabBar } from '@/components/tab-bar';
import { getProfile } from '@/lib/data';
import { requireViewer } from '@/lib/viewer';

/**
 * ログインしてプロフィールを済ませた人の画面。
 * スマホは1列で下にタブ、幅 1024px 以上は左にメニューを置いて本文を広げる
 */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const viewer = await requireViewer();
  if (!(await getProfile(viewer.userId))) redirect('/welcome');

  return (
    <div className="lg:pl-60">
      <div className="mx-auto min-h-dvh max-w-lg pb-[calc(64px+env(safe-area-inset-bottom))] lg:max-w-5xl lg:px-4 lg:pb-10">
        {children}
      </div>
      <TabBar />
    </div>
  );
}
