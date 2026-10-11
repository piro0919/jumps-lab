import { getTranslations } from 'next-intl/server';
import { Badge, Card, CardTitle } from '@/components/layout-ui';
import { REASON_SOURCES, type Readiness } from '@/lib/readiness';

/**
 * 今日のアドバイス（ホーム）。今日の練習の強さを大きく出し、その理由を出典つきで並べる。
 * 判定は src/lib/readiness.ts。痛みの記入がある日は、病院で診てもらう目安を決まった文で必ず出す
 * （AI には書かせない。2026-10-11 に調べた根拠に沿って本人と決めた）
 */
export async function AdviceCard({ readiness }: { readiness: Readiness }) {
  const t = await getTranslations('advice');
  const { level, reasons, weeksToTarget, needsLog } = readiness;

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
        {reasons.length === 0 ? (
          !needsLog && <p className="text-sm text-muted-foreground">{t('normal')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {reasons.map((reason) => (
              <li key={reason.key} className="text-sm">
                {t(`reason.${reason.key}`, reason)}{' '}
                <a
                  href={REASON_SOURCES[reason.key]}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs whitespace-nowrap text-muted-foreground underline"
                >
                  {t('source')}
                </a>
              </li>
            ))}
          </ul>
        )}
        {level === 'protect' && <p className="text-sm font-semibold">{t('doctor')}</p>}
        {/* 入れるボタンは、すぐ下の今日のコンディションのカードにある（2つ並んでいた。本人、2026-10-11） */}
        {needsLog && <p className="text-sm text-muted-foreground">{t('needsLog')}</p>}
      </div>
    </Card>
  );
}
