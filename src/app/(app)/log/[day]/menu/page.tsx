import { notFound, redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { PageTitle, FORM_PAGE } from '@/components/layout-ui';
import { MenuChat } from '@/components/menu-chat';
import { MenuView } from '@/components/menu-view';
import { aiEnabled } from '@/lib/ai';
import { getMenu, listMenuMessages } from '@/lib/data';
import { resolveLogDay, todayIn } from '@/lib/dates';
import { requireProfile, requireViewer } from '@/lib/viewer';

/** その日に AI が作ったメニューと、それを直したチャット。相談できるのは今日だけ。無ければ開かない */
export default async function MenuPage({ params }: PageProps<'/log/[day]/menu'>) {
  const viewer = await requireViewer();
  const profile = await requireProfile(viewer.userId);
  const today = todayIn(profile.timeZone);
  const requested = (await params).day;
  const day = resolveLogDay(requested, today);
  if (!day) redirect('/log/today');
  const [saved, messages] = await Promise.all([
    getMenu(viewer.userId, day),
    listMenuMessages(viewer.userId, day),
  ]);
  if (!saved) notFound();
  const t = await getTranslations('menu');
  const tLog = await getTranslations('log');
  const tNav = await getTranslations('nav');
  const format = await getFormatter();
  const dayLabel =
    day === today
      ? tLog('today')
      : format.dateTime(new Date(`${day}T00:00:00Z`), {
          month: 'short',
          day: 'numeric',
          weekday: 'short',
          timeZone: 'UTC',
        });

  return (
    <main className={FORM_PAGE}>
      <PageTitle
        back={{
          href: `/log/${requested === 'today' ? 'today' : day}`,
          label: tNav('backTo', { page: dayLabel }),
        }}
      >
        {t('title')}
      </PageTitle>
      <MenuView menu={saved.menu} level={saved.level} />
      {/* 相談して直せるのは今日のメニューだけ。過去の日はやりとりを見るだけ */}
      {day === today && aiEnabled(profile) ? (
        <MenuChat messages={messages} />
      ) : (
        messages.length > 0 && <MenuChat messages={messages} readOnly />
      )}
    </main>
  );
}
