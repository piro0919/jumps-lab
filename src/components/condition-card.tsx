import { Pencil } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Card, CardTitle, LABEL } from '@/components/layout-ui';
import { buttonVariants } from '@/components/ui/button';
import type { DayLog } from '@/lib/data';

/**
 * コンディション。見るだけで、直すのは「編集」から移る /log/[day]/condition の画面。入れていない欄は出さない。
 * 日の画面と、ホームの「今日のコンディション」で使う。ホームでまだ入れていない日は、「入力する」のボタンだけを出す
 * （日の画面を経由せずに1往復で入れられるように。本人、2026-10-11）
 */
export async function ConditionCard({
  log,
  editHref,
  title,
  emptyAsButton = false,
}: {
  log: DayLog | null;
  editHref: string;
  /** 題。無ければ「コンディション」 */
  title?: string;
  /** 入れていないとき、「ありません」の文の代わりに入力のボタンを出す */
  emptyAsButton?: boolean;
}) {
  const t = await getTranslations('today');
  const tUnits = await getTranslations('units');

  const numbers = [
    { label: t('physical'), value: log?.condition, suffix: '/10' },
    { label: t('fatigue'), value: log?.fatigue, suffix: '/10' },
    { label: t('sleep'), value: log?.sleepHours, suffix: tUnits('hours') },
  ].filter((row) => row.value !== null && row.value !== undefined);
  const texts = [
    { label: t('injury'), value: log?.injury },
    { label: t('note'), value: log?.note },
  ].filter((row) => row.value);
  const empty = numbers.length === 0 && texts.length === 0;

  // 天気のカードの空のときと同じ組み方（題、その下に灰色のボタン）。題とボタンを横に並べた別の形にしていて、
  // 隣の天気と見た目が食い違い、狭い列で題も折れていた（本人、2026-10-11）
  if (empty && emptyAsButton) {
    return (
      <Card>
        <CardTitle>{title ?? t('condition')}</CardTitle>
        <Link href={editHref} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
          {t('enterCondition')}
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle
        action={
          <Link href={editHref} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            <Pencil aria-hidden className="size-4" />
            {t('edit')}
          </Link>
        }
      >
        {title ?? t('condition')}
      </CardTitle>
      {empty ? (
        <p className="text-sm text-muted-foreground">{t('noCondition')}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {numbers.length > 0 && (
            <dl className="grid grid-cols-3 gap-2">
              {numbers.map((row) => (
                <div key={row.label} className="flex flex-col gap-1">
                  <dt className={LABEL}>{row.label}</dt>
                  <dd className="text-base font-bold tabular-nums">
                    {row.value}
                    {row.suffix}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {texts.map((row) => (
            <div key={row.label} className="flex flex-col gap-1">
              <span className={LABEL}>{row.label}</span>
              <p className="text-sm whitespace-pre-wrap">{row.value}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
