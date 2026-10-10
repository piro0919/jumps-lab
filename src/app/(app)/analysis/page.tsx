import Link from 'next/link';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { TrendChart } from '@/components/trend-chart';
import { Card, CardTitle, PageTitle } from '@/components/layout-ui';
import { analyze } from '@/lib/analysis';
import { getProfile, listAttempts } from '@/lib/data';
import { isJumpEvent } from '@/lib/events';
import { formatMark } from '@/lib/units';
import { requireViewer } from '@/lib/viewer';

/**
 * 1種目の記録の数字。総数・平均・月別ベスト・直近10本の推移。
 * 種目は ?event= で選び、無ければ本人の選んだ種目の先頭（種目で絞るのはこの画面だけ）
 */
export default async function Analysis({ searchParams }: PageProps<'/analysis'>) {
  const viewer = await requireViewer();
  const profile = (await getProfile(viewer.userId))!;
  const requested = (await searchParams).event;
  const event =
    isJumpEvent(requested) && profile.events.includes(requested) ? requested : profile.events[0]!;
  const result = analyze(await listAttempts(viewer.userId, event));
  const t = await getTranslations('analysis');
  const tNav = await getTranslations('nav');
  const tEvents = await getTranslations('events');
  const format = await getFormatter();
  const locale = await getLocale();

  return (
    <main className="flex flex-col gap-3">
      <PageTitle>{tNav('analysis')}</PageTitle>

      {profile.events.length > 1 && (
        <nav className="mx-4 flex w-fit gap-1 rounded-xl bg-muted p-1">
          {profile.events.map((e) => (
            <Link
              key={e}
              href={`/analysis?event=${e}`}
              aria-current={e === event ? 'page' : undefined}
              className={`flex h-8 items-center rounded-lg px-3 text-sm font-semibold ${
                e === event ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {tEvents(e)}
            </Link>
          ))}
        </nav>
      )}

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[3fr_2fr] lg:items-start">
        <div className="flex flex-col gap-3">
          <div className="mx-4 grid grid-cols-2 gap-3">
            <section className="rounded-2xl bg-card p-4">
              <h2 className="text-[13px] font-medium text-muted-foreground">{t('total')}</h2>
              <p className="text-[28px] font-bold tabular-nums">{result.total}</p>
            </section>
            <section className="rounded-2xl bg-card p-4">
              <h2 className="text-[13px] font-medium text-muted-foreground">{t('average')}</h2>
              <p className="text-[28px] font-bold tabular-nums">
                {result.averageM === null ? '—' : formatMark(result.averageM, profile.units)}
              </p>
            </section>
          </div>

          <Card>
            <CardTitle>{t('trend')}</CardTitle>
            {result.recent.length >= 2 ? (
              <TrendChart rows={result.recent} units={profile.units} locale={locale} />
            ) : (
              <p className="text-sm text-muted-foreground">{t('needTwo')}</p>
            )}
          </Card>
        </div>
        <Card>
          <CardTitle>{t('monthlyBest')}</CardTitle>
          {result.monthlyBest.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noMarks')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {result.monthlyBest.map(({ month, bestM }) => (
                <li key={month} className="flex items-baseline justify-between py-2.5">
                  <span className="text-sm">
                    {format.dateTime(new Date(`${month}-01T00:00:00Z`), {
                      year: 'numeric',
                      month: 'long',
                      timeZone: 'UTC',
                    })}
                  </span>
                  <span className="font-bold tabular-nums">{formatMark(bestM, profile.units)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
