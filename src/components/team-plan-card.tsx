import { ExternalLink } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Badge, Card, CardTitle } from '@/components/layout-ui';
import { buttonVariants } from '@/components/ui/button';
import { TEAM_PLAN_FORM_URL } from '@/lib/team-plan';

/**
 * /teams のチーム向けプランのお知らせ（2026-10-15）。値段が決まるまでは開発中と出し、Google フォームで問い合わせを受ける。
 * 画面に説明を置かない決まりの例外（本人の希望）
 */
export async function TeamPlanCard() {
  const t = await getTranslations('teamPlan');
  return (
    <Card>
      <CardTitle action={<Badge tone="accent">{t('badge')}</Badge>}>{t('title')}</CardTitle>
      <p className="text-sm text-muted-foreground">{t('body')}</p>
      <div className="mt-4 flex justify-end">
        <a
          href={TEAM_PLAN_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
        >
          {t('contact')}
          <ExternalLink aria-hidden className="size-4" />
        </a>
      </div>
    </Card>
  );
}
