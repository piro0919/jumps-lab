import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Card, PageTitle, FORM_PAGE } from '@/components/layout-ui';
import { MenuForm } from '@/components/menu-form';
import { aiEnabled } from '@/lib/ai';
import { getMenu } from '@/lib/data';
import { todayIn } from '@/lib/dates';
import { requireProfile, requireViewer } from '@/lib/viewer';

/**
 * 今日のメニューを作る画面。作れるのは今日の分だけで、もう作ってあればメニューの画面へ送る。
 * AI のキーが無い環境（本番は名義が決まるまで）では開かない
 */
export default async function NewMenu({ params }: PageProps<'/log/[day]/menu/new'>) {
  const viewer = await requireViewer();
  const profile = await requireProfile(viewer.userId);
  const today = todayIn(profile.timeZone);
  const requested = (await params).day;
  if (!aiEnabled() || (requested !== 'today' && requested !== today)) redirect('/');
  if (await getMenu(viewer.userId, today)) redirect('/log/today/menu');
  const t = await getTranslations('menu');
  const tNav = await getTranslations('nav');

  return (
    <main className={FORM_PAGE}>
      <PageTitle back={{ href: '/', label: tNav('backTo', { page: tNav('home') }) }}>
        {t('newTitle')}
      </PageTitle>
      <Card>
        <MenuForm />
      </Card>
    </main>
  );
}
