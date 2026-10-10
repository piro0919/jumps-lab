import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { AttemptForm } from '@/components/attempt-form';
import { Card, FORM_PAGE, PageTitle } from '@/components/layout-ui';
import { getAttempt, getProfile } from '@/lib/data';
import { todayIn } from '@/lib/dates';
import { requireViewer } from '@/lib/viewer';

/**
 * 試技を1本直す画面。日の画面の行の鉛筆から来て、保存したらその日の画面へ戻る。
 * 試技は消して足し直すしかなかった（2026-10-11）。本人の試技でなければ開かない。
 * 種目から外した種目の試技は、その種目も選べるように並べる
 */
export default async function EditAttempt({ params }: PageProps<'/attempts/[id]/edit'>) {
  const viewer = await requireViewer();
  const { id } = await params;
  const attempt = z.uuid().safeParse(id).success ? await getAttempt(viewer.userId, id) : null;
  if (!attempt) notFound();
  const profile = (await getProfile(viewer.userId))!;
  const today = todayIn(profile.timeZone);
  const events = profile.events.includes(attempt.event)
    ? profile.events
    : [...profile.events, attempt.event];

  const t = await getTranslations('today');
  const tLog = await getTranslations('log');
  const tNav = await getTranslations('nav');
  const format = await getFormatter();
  const backHref = `/log/${attempt.day === today ? 'today' : attempt.day}`;
  const dayLabel =
    attempt.day === today
      ? tLog('today')
      : format.dateTime(new Date(`${attempt.day}T00:00:00Z`), {
          month: 'short',
          day: 'numeric',
          weekday: 'short',
          timeZone: 'UTC',
        });

  return (
    <main className={FORM_PAGE}>
      <PageTitle back={{ href: backHref, label: tNav('backTo', { page: dayLabel }) }}>
        {t('editAttempt')}
      </PageTitle>
      <Card>
        <AttemptForm
          day={attempt.day}
          events={events}
          initialEvent={attempt.event}
          units={profile.units}
          backHref={backHref}
          initial={attempt}
        />
      </Card>
    </main>
  );
}
