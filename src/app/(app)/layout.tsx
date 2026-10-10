import { redirect } from 'next/navigation';
import { TabBar } from '@/components/tab-bar';
import { getProfile } from '@/lib/data';
import { requireViewer } from '@/lib/viewer';

/** ログインしてプロフィールを済ませた人の画面。下にタブを置く */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const viewer = await requireViewer();
  if (!(await getProfile(viewer.userId))) redirect('/welcome');

  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-[calc(64px+env(safe-area-inset-bottom))]">
      {children}
      <TabBar />
    </div>
  );
}
