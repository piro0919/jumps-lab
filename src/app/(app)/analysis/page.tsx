import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { EventSwitcher } from '@/components/event-switcher';
import { TrendChart } from '@/components/trend-chart';
import { Card, CardTitle, PageTitle } from '@/components/ui';
import { analyze } from '@/lib/analysis';
import { getProfile, listAttempts } from '@/lib/data';
import { formatMark } from '@/lib/units';
import { requireViewer } from '@/lib/viewer';

/** 見ている種目の記録の数字。総数・平均・月別ベスト・直近10本の推移 */
export default async function Analysis() {
  const viewer = await requireViewer();
  const profile = (await getProfile(viewer.userId))!;
  const result = analyze(await listAttempts(viewer.userId, profile.currentEvent));
  const t = await getTranslations('analysis');
  const tNav = await getTranslations('nav');
  const format = await getFormatter();
  const locale = await getLocale();

  return (
    <main className="flex flex-col gap-3">
      <PageTitle action={<EventSwitcher events={profile.events} current={profile.currentEvent} />}>
        {tNav('analysis')}
      </PageTitle>

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[3fr_2fr] lg:items-start">
        <div className="flex flex-col gap-3">
          <div className="mx-4 grid grid-cols-2 gap-3">
            <section className="rounded-2xl bg-surface p-4">
              <h2 className="text-[13px] font-medium text-sub">{t('total')}</h2>
              <p className="text-[28px] font-bold tabular-nums">{result.total}</p>
            </section>
            <section className="rounded-2xl bg-surface p-4">
              <h2 className="text-[13px] font-medium text-sub">{t('average')}</h2>
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
              <p className="text-sm text-sub">{t('needTwo')}</p>
            )}
          </Card>
        </div>
        <Card>
          <CardTitle>{t('monthlyBest')}</CardTitle>
          {result.monthlyBest.length === 0 ? (
            <p className="text-sm text-sub">{t('noMarks')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
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
