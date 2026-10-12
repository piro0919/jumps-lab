import { notFound, redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { PageTitle, FORM_PAGE } from '@/components/layout-ui';
import { MenuView } from '@/components/menu-view';
import { getMenu } from '@/lib/data';
import { resolveLogDay, todayIn } from '@/lib/dates';
import { requireProfile, requireViewer } from '@/lib/viewer';

/** その日に AI が作ったメニュー。見るだけ。無ければ開かない */
export default async function MenuPage({ params }: PageProps<'/log/[day]/menu'>) {
  const viewer = await requireViewer();
  const profile = await requireProfile(viewer.userId);
  const today = todayIn(profile.timeZone);
  const requested = (await params).day;
  const day = resolveLogDay(requested, today);
  if (!day) redirect('/log/today');
  const saved = await getMenu(viewer.userId, day);
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
    </main>
  );
}
