import Link from 'next/link';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { TrendChart } from '@/components/trend-chart';
import { Card, CardTitle, PageTitle, SEGMENTS, Stat, segmentClass } from '@/components/layout-ui';
import { analyze } from '@/lib/analysis';
import { getProfile, listAttempts } from '@/lib/data';
import { cn } from 'cn';
import { EVENT_BG, EVENT_MARK, EVENT_TEXT, isJumpEvent } from '@/lib/events';
import { formatMark, formatMarkParts } from '@/lib/units';
import { requireViewer } from '@/lib/viewer';

const KINDS = ['all', 'practice', 'competition'] as const;

/**
 * 1種目の記録の数字。総数・平均・月別ベスト・直近10本の推移。
 * 種目は ?event= で選び、無ければ本人の選んだ種目の先頭（種目で絞るのはこの画面だけ）
 */
export default async function Analysis({ searchParams }: PageProps<'/analysis'>) {
  const viewer = await requireViewer();
  const profile = (await getProfile(viewer.userId))!;
  const params = await searchParams;
  const event =
    isJumpEvent(params.event) && profile.events.includes(params.event)
      ? params.event
      : profile.events[0]!;
  // 練習と試合を分けて見る。既定は両方
  const kind = KINDS.find((k) => k === params.kind) ?? 'all';
  const attempts = await listAttempts(viewer.userId, event);
  const result = analyze(kind === 'all' ? attempts : attempts.filter((a) => a.kind === kind));
  const t = await getTranslations('analysis');
  const tNav = await getTranslations('nav');
  const tEvents = await getTranslations('events');
  const format = await getFormatter();
  const locale = await getLocale();

  const href = (next: { event?: string; kind?: string }) => {
    const query = new URLSearchParams({ event, kind, ...next });
    if (query.get('kind') === 'all') query.delete('kind');
    return `/analysis?${query}`;
  };

  return (
    <main className="flex flex-col gap-3">
      <PageTitle>{tNav('analysis')}</PageTitle>

      <div className="mx-4 flex flex-wrap gap-2">
        {profile.events.length > 1 && (
          <nav className={SEGMENTS}>
            {profile.events.map((e) => (
              <Link
                key={e}
                href={href({ event: e })}
                aria-current={e === event ? 'page' : undefined}
                className={cn(
                  segmentClass(e === event),
                  e === event && `${EVENT_BG[e]} text-white`,
                )}
              >
                {tEvents(e)}
              </Link>
            ))}
          </nav>
        )}
        <nav className={SEGMENTS}>
          {KINDS.map((k) => (
            <Link
              key={k}
              href={href({ kind: k })}
              aria-current={k === kind ? 'page' : undefined}
              className={segmentClass(k === kind)}
            >
              {t(k)}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[3fr_2fr] lg:items-start">
        <div className="flex flex-col gap-3">
          <Card
            className={`relative grid gap-4 overflow-hidden text-white sm:grid-cols-2 ${EVENT_BG[event]}`}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -right-3 -bottom-8 font-display text-[160px] leading-none font-extrabold text-white/10 italic select-none"
            >
              {EVENT_MARK[event]}
            </span>
            <Stat size="hero" inverse value={result.total} label={t('total')} />
            <Stat
              size="hero"
              inverse
              value={
                result.averageM === null ? null : formatMarkParts(result.averageM, profile.units)
              }
              label={t('average')}
            />
          </Card>

          <Card>
            <CardTitle>{t('trend')}</CardTitle>
            {result.recent.length >= 2 ? (
              <TrendChart
                rows={result.recent}
                units={profile.units}
                locale={locale}
                colorClass={EVENT_TEXT[event]}
              />
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
                  <span
                    className={`font-display text-2xl font-extrabold italic tabular-nums ${EVENT_TEXT[event]}`}
                  >
                    {formatMark(bestM, profile.units)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
