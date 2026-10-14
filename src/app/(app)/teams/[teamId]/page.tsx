import { ChevronRight, Pencil } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { z } from 'zod';
import {
  Badge,
  Card,
  CardTitle,
  EmptyState,
  MAIN_SIDE,
  PageTitle,
  Stat,
} from '@/components/layout-ui';
import { InviteCard } from '@/components/team-buttons';
import { buttonVariants } from '@/components/ui/button';
import { getCoachedTeam, teamRoster } from '@/lib/data';
import { todayIn } from '@/lib/dates';
import { EVENT_BG, EVENT_TEXT } from '@/lib/events';
import { rosterFlags, sortRoster, VIDEO_WINDOW_DAYS } from '@/lib/teams';
import { formatMarkParts } from '@/lib/units';
import { requireProfile, requireViewer } from '@/lib/viewer';

/**
 * コーチの画面（2026-10-14）。チームの選手の一覧を、印（直近7日の痛みのメモ・高い疲労）のある選手から並べる。
 * 1行に、名前・種目・最後に記録した日・直近7日の最新の体調と疲労（別々に）・種目ごとの最新の記録・直近14日の動画の本数。
 * 押すと選手の記録（見るだけ）。右の列に招待のリンク。コーチでなければ開かない
 */
export default async function TeamDashboard({ params }: PageProps<'/teams/[teamId]'>) {
  const viewer = await requireViewer();
  const profile = await requireProfile(viewer.userId);
  const { teamId } = await params;
  const team = z.uuid().safeParse(teamId).success
    ? await getCoachedTeam(viewer.userId, teamId)
    : null;
  if (!team) notFound();
  const locale = await getLocale();
  const roster = sortRoster(
    (await teamRoster(viewer.userId, team.id, VIDEO_WINDOW_DAYS)).map((row) => ({
      ...row,
      flags: rosterFlags(row, todayIn(row.timeZone)),
    })),
    locale,
  );
  const t = await getTranslations('teams');
  const tEvents = await getTranslations('events');
  const tToday = await getTranslations('today');
  const tNav = await getTranslations('nav');
  const format = await getFormatter();
  const day = (value: string) =>
    format.dateTime(new Date(`${value}T00:00:00Z`), {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  const sameOrDay = (value: string | undefined, lastDay: string | null) =>
    value === undefined ? '' : value === lastDay ? 'same' : day(value);

  return (
    <main className="flex flex-col gap-3">
      <PageTitle
        back={{ href: '/teams', label: tNav('backTo', { page: t('title') }) }}
        action={
          <Link
            href={`/teams/${team.id}/edit`}
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            <Pencil aria-hidden className="size-4" />
            {tToday('edit')}
          </Link>
        }
      >
        {team.name}
      </PageTitle>
      <div className={MAIN_SIDE}>
        <Card>
          <CardTitle>{t('athletes', { count: roster.length })}</CardTitle>
          {roster.length === 0 ? (
            <EmptyState message={t('noAthletes')} />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {roster.map((member) => (
                <li key={member.userId}>
                  <Link
                    href={`/teams/${team.id}/members/${member.userId}`}
                    className="flex items-start gap-3 py-3"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-2">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-lg font-extrabold">{member.name}</span>
                        {member.flags.includes('pain') && (
                          <Badge tone="danger">{t('flagPain')}</Badge>
                        )}
                        {member.flags.includes('fatigue') && (
                          <Badge tone="danger">
                            {t('flagFatigue', { value: member.latestFatigue?.value ?? 0 })}
                          </Badge>
                        )}
                      </span>
                      <span className="flex flex-wrap gap-1.5">
                        {member.events.map((event) => (
                          <Badge key={event} tone="solid" className={EVENT_BG[event]}>
                            {tEvents(event)}
                          </Badge>
                        ))}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t('rosterLine', {
                          last: member.lastDay === null ? 'none' : day(member.lastDay),
                          condition: member.latestCondition?.value.toString() ?? 'none',
                          // 最後の記録と同じ日なら日付を出さない（同じ日付が3回並んで数字が埋もれた。2026-10-15）
                          conditionDate: sameOrDay(member.latestCondition?.day, member.lastDay),
                          fatigue: member.latestFatigue?.value.toString() ?? 'none',
                          fatigueDate: sameOrDay(member.latestFatigue?.day, member.lastDay),
                          videos: member.videos,
                          days: VIDEO_WINDOW_DAYS,
                        })}
                      </span>
                      {member.latestBests.length > 0 && (
                        <span className="flex flex-wrap gap-x-5 gap-y-2">
                          {member.latestBests.map((best) => (
                            <Stat
                              key={best.event}
                              size="sm"
                              color={EVENT_TEXT[best.event]}
                              value={formatMarkParts(best.markM, profile.units)}
                              label={t('latestMark', {
                                event: tEvents(best.event),
                                date: day(best.day),
                              })}
                            />
                          ))}
                        </span>
                      )}
                    </span>
                    <ChevronRight aria-hidden className="mt-1 size-5 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <InviteCard teamId={team.id} expiresAt={team.inviteExpiresAt} timeZone={profile.timeZone} />
      </div>
    </main>
  );
}
