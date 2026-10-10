import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BackLink, Badge, Card, PageTitle } from '@/components/layout-ui';
import { TargetsForm } from '@/components/targets-form';
import { getProfile, getTargets } from '@/lib/data';
import { seasonOf, todayIn } from '@/lib/dates';
import { EVENT_BG, eventFromSlug } from '@/lib/events';
import { requireViewer } from '@/lib/viewer';

const FOCUS = ['manualPbM', 'manualSbM', 'manualPracticeBestM', 'seasonGoalM'] as const;

/**
 * 1種目の今季目標と、手で入れる自己ベスト・今季ベスト・練習ベストを直す画面。ホームの数字を押して来る。
 * 本人の選んでいない種目は開かない。前のシーズンに手で入れた今季ベストは、数えないので欄にも出さない
 */
export default async function Targets({ params, searchParams }: PageProps<'/targets/[event]'>) {
  const viewer = await requireViewer();
  const profile = (await getProfile(viewer.userId))!;
  const event = eventFromSlug((await params).event);
  if (!event || !profile.events.includes(event)) notFound();

  const target = (await getTargets(viewer.userId, [event])).get(event)!;
  const season = seasonOf(todayIn(profile.timeZone), profile.seasonStartMonth);
  const { focus } = await searchParams;
  const t = await getTranslations('home');
  const tNav = await getTranslations('nav');
  const tEvents = await getTranslations('events');

  return (
    <main className="flex flex-col gap-3 lg:mx-auto lg:w-full lg:max-w-xl">
      <BackLink href="/">{tNav('home')}</BackLink>
      <PageTitle>
        <span className="flex items-center gap-3">
          {t('targetsTitle')}
          <Badge tone="solid" className={EVENT_BG[event]}>
            {tEvents(event)}
          </Badge>
        </span>
      </PageTitle>
      <Card>
        <TargetsForm
          event={event}
          units={profile.units}
          focus={FOCUS.find((f) => f === focus) ?? 'manualPbM'}
          values={{
            manualPbM: target.manualPbM,
            manualSbM: target.manualSbSeason === season ? target.manualSbM : null,
            manualPracticeBestM: target.manualPracticeBestM,
            seasonGoalM: target.seasonGoalM,
          }}
        />
      </Card>
    </main>
  );
}
