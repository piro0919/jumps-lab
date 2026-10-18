import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge, Card, CardTitle } from '@/components/layout-ui';
import { buttonVariants } from '@/components/ui/button';
import { REASON_SOURCES, type Readiness } from '@/lib/readiness';

/**
 * 今日のアドバイス（分析の画面の一番上）。今日の練習の強さを大きく出し、その理由を出典つきで並べる。
 * 判定は src/lib/readiness.ts。痛みの記入がある日は、病院で診てもらう目安を決まった文で必ず出す
 * （AI には書かせない。2026-10-11 に調べた根拠に沿って本人と決めた）
 */
export async function AdviceCard({
  readiness,
  menu,
}: {
  readiness: Readiness;
  /** 今日の AI のメニュー。made は作ってある、none はまだ、null は AI を使えない環境（ボタンを出さない） */
  menu: 'made' | 'none' | null;
}) {
  const t = await getTranslations('advice');
  const tMenu = await getTranslations('menu');
  const { level, reasons, weeksToTarget } = readiness;

  return (
    <Card>
      <CardTitle
        action={
          <Badge tone="neutral">
            {weeksToTarget === null ? t('build') : t('toward', { weeks: weeksToTarget })}
          </Badge>
        }
      >
        {t('title')}
      </CardTitle>
      <div className="flex flex-col gap-3">
        <span className="text-lg font-extrabold">{t(`level.${level}`)}</span>
        {reasons.length > 0 && (
          <ul className="flex flex-col gap-2">
            {reasons.map((reason) => (
              <li key={reason.key} className="text-sm">
                {t(`reason.${reason.key}`, reason)}{' '}
                <a
                  href={REASON_SOURCES[reason.key]}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs whitespace-nowrap underline"
                >
                  {t('source')}
                </a>
              </li>
            ))}
          </ul>
        )}
        {level === 'protect' && <p className="text-sm font-semibold">{t('doctor')}</p>}
        {/* AI のメニュー（中元さんのフィードバックの第1段階）。強さはこのカードが決め、AI はその中で中身を書く */}
        {menu === 'none' && (
          <Link
            href="/log/today/menu/new"
            className={buttonVariants({ size: 'sm', className: 'w-fit' })}
          >
            {tMenu('create')}
          </Link>
        )}
        {menu === 'made' && (
          <Link
            href="/log/today/menu"
            className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'w-fit' })}
          >
            {tMenu('view')}
          </Link>
        )}
      </div>
    </Card>
  );
}
