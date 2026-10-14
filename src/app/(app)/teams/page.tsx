import { ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Card, CardTitle, EmptyState, HALVES, PageTitle } from '@/components/layout-ui';
import { LeaveTeamButton } from '@/components/team-buttons';
import { buttonVariants } from '@/components/ui/button';
import { listCoachedTeams, listMemberships } from '@/lib/data';
import { requireProfile, requireViewer } from '@/lib/viewer';

/**
 * チーム（2026-10-14）。アバターのメニューの「チーム」から開く。左にコーチしているチーム（押すとコーチの画面）、
 * 右に選手として入っているチーム（抜けるのはここ）。チームのことはこの画面1つにまとめ、設定には置かない
 * （設定は自分のプロフィールと記録のつけ方の画面で、抜ける場所を2つにしないため）
 */
export default async function Teams() {
  const viewer = await requireViewer();
  const profile = await requireProfile(viewer.userId);
  const [coached, memberships] = await Promise.all([
    listCoachedTeams(viewer.userId),
    listMemberships(viewer.userId),
  ]);
  const t = await getTranslations('teams');
  const format = await getFormatter();

  return (
    <main className="flex flex-col gap-3">
      <PageTitle
        action={
          <Link href="/teams/new" className={buttonVariants({ size: 'sm' })}>
            <Plus aria-hidden className="size-4" />
            {t('add')}
          </Link>
        }
      >
        {t('title')}
      </PageTitle>
      <div className={HALVES}>
        <Card>
          <CardTitle>{t('coaching')}</CardTitle>
          {coached.length === 0 ? (
            <EmptyState
              message={t('noCoaching')}
              action={{ href: '/teams/new', label: t('create') }}
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {coached.map((team) => (
                <li key={team.id}>
                  <Link href={`/teams/${team.id}`} className="flex items-center gap-3 py-3">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-lg font-extrabold">{team.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {t('memberCount', { count: team.memberCount })}
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle>{t('member')}</CardTitle>
          {memberships.length === 0 ? (
            <EmptyState message={t('noMember')} />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {memberships.map((team) => (
                <li key={team.id} className="flex items-center gap-3 py-3">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-lg font-extrabold">{team.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('coachedBy', { coaches: format.list(team.coaches) })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t('joined', {
                        date: format.dateTime(team.joinedAt, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          timeZone: profile.timeZone,
                        }),
                      })}
                    </span>
                  </span>
                  <LeaveTeamButton teamId={team.id} team={team.name} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
