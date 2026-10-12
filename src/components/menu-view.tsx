import { getTranslations } from 'next-intl/server';
import { Badge, Card, CardTitle, DisplayNumber, Stat } from '@/components/layout-ui';
import { LIMITS, type Menu, type MenuLevel, menuTotals } from '@/lib/menu';

/**
 * AI が作った今日のメニュー。上に要約と跳躍の本数（上限つき）、下に区分ごとのカード。
 * 痛みの記入がある日は、今日のアドバイスと同じ決まった文（病院の目安）を必ず出す
 */
export async function MenuView({ menu, level }: { menu: Menu; level: MenuLevel }) {
  const t = await getTranslations('menu');
  const tAdvice = await getTranslations('advice');
  const totals = menuTotals(menu);
  const limit = LIMITS[level];

  return (
    <>
      <Card>
        <CardTitle action={<Badge tone="neutral">{tAdvice(`level.${level}`)}</Badge>}>
          {t('summary')}
        </CardTitle>
        <div className="flex flex-col gap-4">
          <p className="text-sm">{menu.summary}</p>
          {/* 3つとも「数字＋小さな単位」の同じ形にして、ラベルの高さをそろえる（上限は単位の側に出す） */}
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Stat
              size="sm"
              value={{
                value: String(totals.takeoffs),
                unit: t('outOf', { limit: limit.takeoffs }),
              }}
              label={t('takeoffs')}
            />
            <Stat
              size="sm"
              value={{
                value: String(totals.contacts),
                unit: t('outOf', { limit: limit.contacts }),
              }}
              label={t('contacts')}
            />
            <Stat
              size="sm"
              value={{ value: String(totals.minutes), unit: t('minUnit') }}
              label={t('total')}
            />
          </div>
          {level === 'protect' && <p className="text-sm font-semibold">{tAdvice('doctor')}</p>}
          {menu.cautions.length > 0 && (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
              {menu.cautions.map((caution) => (
                <li key={caution}>{caution}</li>
              ))}
            </ul>
          )}
          {menu.missing.length > 0 && (
            <p className="text-xs break-keep wrap-anywhere text-muted-foreground">
              {t('missing', { items: menu.missing.join(' / ') })}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{t('disclaimer')}</p>
        </div>
      </Card>
      {menu.sections
        .filter((section) => section.items.length > 0)
        .map((section, index) => (
          <Card key={`${section.kind}-${index}`}>
            <CardTitle>{t(`section.${section.kind}`)}</CardTitle>
            <ul className="flex flex-col divide-y divide-border">
              {section.items.map((item, i) => (
                <li key={i} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <span className="flex flex-wrap items-center gap-2">
                    {/* 大会の当日のアップは、始める時刻を名前の前に */}
                    {item.at && <DisplayNumber size="sm">{item.at}</DisplayNumber>}
                    <span className="text-lg font-extrabold">{item.name}</span>
                    {item.takeoffs > 0 && (
                      <Badge tone="accent">{t('takeoffCount', { count: item.takeoffs })}</Badge>
                    )}
                    {item.contacts > 0 && (
                      <Badge tone="accent">{t('contactCount', { count: item.contacts })}</Badge>
                    )}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {[
                      // 1セットは書かない（情報にならない）。回数の欄が時間と同じ文なら、時間だけを出す
                      item.sets !== null && item.sets > 1 && t('sets', { count: item.sets }),
                      item.reps !== t('minutesValue', { count: item.minutes }) && item.reps,
                      item.intensity,
                      t('minutesValue', { count: item.minutes }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <p className="text-sm">{item.purpose}</p>
                  <p className="text-sm text-muted-foreground">{item.reason}</p>
                </li>
              ))}
            </ul>
          </Card>
        ))}
    </>
  );
}
