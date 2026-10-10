import { getTranslations } from 'next-intl/server';
import { Badge, SectionTitle, Watermark } from '@/components/layout-ui';
import { MarkEditor } from '@/components/mark-editor';
import { EVENT_BG, EVENT_MARK, type JumpEvent } from '@/lib/events';
import { formatMark, type Units } from '@/lib/units';

/**
 * 1種目のカード。種目の色で塗り、PB を画面いっぱいの数字で出す（手本の Nike Run Club の色付きのカード）。
 * その下に SB・練習ベスト・今季の目標を横に3つ。どの数字も押すとその場で手で直せる。
 * ホームと、LP の見本の画面（見本のデータで描き、押せないようにして置く）で使う
 */
export async function EventHero({
  event,
  goalM,
  bests,
  manual,
  units,
}: {
  event: JumpEvent;
  goalM: number | null;
  bests: { pbM: number | null; sbM: number | null; practiceBestM: number | null };
  manual: { pbM: number | null; sbM: number | null; practiceBestM: number | null };
  units: Units;
}) {
  const t = await getTranslations('home');
  const tEvents = await getTranslations('events');
  // 目標までの差は SB から測る（今季の目標なので）
  const gap = goalM !== null && bests.sbM !== null ? goalM - bests.sbM : null;

  return (
    <section
      className={`relative mx-4 overflow-hidden rounded-3xl p-5 text-white ${EVENT_BG[event]}`}
    >
      <Watermark>{EVENT_MARK[event]}</Watermark>
      <div className="relative flex flex-col gap-4">
        <SectionTitle inverse>{tEvents(event)}</SectionTitle>
        <MarkEditor
          event={event}
          field="manualPbM"
          label={t('pb')}
          shown={bests.pbM}
          manual={manual.pbM}
          units={units}
          size="giant"
          inverse
        />
        <div className="grid grid-cols-3 gap-4">
          <MarkEditor
            event={event}
            field="manualSbM"
            label={t('sb')}
            shown={bests.sbM}
            manual={manual.sbM}
            units={units}
            inverse
          />
          <MarkEditor
            event={event}
            field="manualPracticeBestM"
            label={t('practiceBest')}
            shown={bests.practiceBestM}
            manual={manual.practiceBestM}
            units={units}
            inverse
          />
          <MarkEditor
            event={event}
            field="seasonGoalM"
            label={t('goal')}
            shown={goalM}
            manual={goalM}
            units={units}
            inverse
          />
        </div>
        {gap !== null && (
          <Badge tone="inverse">
            {gap <= 0 ? t('goalReached') : t('toGoal', { distance: formatMark(gap, units) })}
          </Badge>
        )}
      </div>
    </section>
  );
}
