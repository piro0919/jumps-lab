import { Pencil } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge, Card, CardTitle, LABEL, Stat, EmptyState } from '@/components/layout-ui';
import { buttonVariants } from '@/components/ui/button';
import { WeatherSummary } from '@/components/weather-summary';
import type { DayLog } from '@/lib/data';
import type { Units } from '@/lib/units';
import type { Weather } from '@/lib/weather';
import { stillHurts } from '@/lib/injury';

/**
 * コンディション。見るだけで、直すのは「編集」から移る /log/[day]/condition の画面。入れていない欄は出さない。
 * 日の画面と、ホームの「今日のコンディション」で使う。入れていない日は、ほかの空のカードと同じく
 * 文と「コンディションを入力」のボタン（EmptyState）。ホームからは日の画面を経由せずに1往復で入れられる
 */
export async function ConditionCard({
  log,
  editHref,
  title,
  sample = false,
  units = 'metric',
}: {
  /** 天気は本人の画面でだけ読む（getDayLog）。コーチの画面の行には無い */
  log: (DayLog & { weather?: Weather | null }) | null;
  /** 直す画面。無ければ見るだけ（コーチが選手の記録を見る画面） */
  editHref?: string;
  /** 題。無ければ「コンディション」 */
  title?: string;
  /** LP の見本。リンクの先読みをしない（押せない枠の中でも、Next は画面に入ったリンクを先読みする） */
  sample?: boolean;
  /** 天気の気温の単位 */
  units?: Units;
}) {
  const t = await getTranslations('today');
  const tUnits = await getTranslations('units');

  const numbers = [
    { label: t('physical'), value: log?.condition, suffix: '/10' },
    { label: t('fatigue'), value: log?.fatigue, suffix: '/10' },
    { label: t('sleep'), value: log?.sleepHours, suffix: tUnits('hours') },
  ].filter((row) => row.value !== null && row.value !== undefined);
  const texts = [
    { label: t('injury'), value: log?.injury, alert: true },
    {
      label: t('injuryStatusLabel'),
      value: log?.injuryStatus ? t(`injuryStatus.${log.injuryStatus}`) : null,
      alert: stillHurts(log?.injuryStatus),
    },
    { label: t('note'), value: log?.note, alert: false },
  ].filter((row) => row.value);
  const weather = log?.weather ?? null;
  const empty = numbers.length === 0 && texts.length === 0 && !weather;

  return (
    <Card>
      <CardTitle
        action={
          empty || !editHref ? undefined : (
            <Link
              href={editHref}
              prefetch={sample ? false : undefined}
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            >
              <Pencil aria-hidden className="size-4" />
              {t('edit')}
            </Link>
          )
        }
      >
        {title ?? t('condition')}
      </CardTitle>
      {empty ? (
        <EmptyState
          message={t('noCondition')}
          action={editHref ? { href: editHref, label: t('enterCondition') } : undefined}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {numbers.length > 0 && (
            // 数字はほかの画面と同じ Stat で（普通の太字で出していて、数字の書体が揃っていなかった）
            <div className="grid grid-cols-3 gap-2">
              {numbers.map((row) => (
                <Stat
                  key={row.label}
                  size="sm"
                  value={{ value: String(row.value), unit: row.suffix }}
                  label={row.label}
                />
              ))}
            </div>
          )}
          {weather && (
            <div className="flex flex-col gap-1">
              <span className={LABEL}>{t('weather')}</span>
              <WeatherSummary weather={weather} units={units} />
            </div>
          )}
          {texts.map((row) => (
            <div key={row.label} className="flex flex-col gap-1">
              {/* 痛みのメモは赤い札で目立たせる（コーチの一覧の「痛みのメモ」の印と同じ色。ふつうのメモと
                  同じ見た目で、開いた先で見つけにくかった。2026-10-15） */}
              {row.alert ? (
                <Badge tone="danger">{row.label}</Badge>
              ) : (
                <span className={LABEL}>{row.label}</span>
              )}
              <p className="text-sm whitespace-pre-wrap">{row.value}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
