import { FileInput } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CompetitionForm } from '@/components/competition-form';
import { Card, PageTitle, FORM_PAGE } from '@/components/layout-ui';
import { buttonVariants } from '@/components/ui/button';
import { aiEnabled } from '@/lib/ai';
import { todayIn } from '@/lib/dates';
import { inJapan, JAAF_ENTRY_URL } from '@/lib/japan';
import { readDraft } from '@/lib/meet-import';
import { requireProfile, requireViewer } from '@/lib/viewer';

/**
 * 大会を足す画面。日付ははじめ今日。日本の人は申し込みのサイトに日本陸連の申し込みサイトを入れておく。
 * 大会の取り込み（/competitions/import）から来たときは、URL の下書きを入れ、保存したら取り込みの一覧へ戻る。
 * Premium の人には、取り込みへのボタンを上に出す
 */
export default async function NewCompetition({ searchParams }: PageProps<'/competitions/new'>) {
  const viewer = await requireViewer();
  const profile = await requireProfile(viewer.userId);
  const params = await searchParams;
  const draft = readDraft(params);
  const fromImport = draft !== null && params.from === 'import';
  const t = await getTranslations('calendar');
  const tNav = await getTranslations('nav');
  const tImport = await getTranslations('meetImport');

  return (
    <main className={FORM_PAGE}>
      <PageTitle
        back={
          fromImport
            ? { href: '/competitions/import', label: tNav('backTo', { page: tImport('title') }) }
            : { href: '/competitions', label: tNav('backTo', { page: tNav('competitions') }) }
        }
      >
        {t('addCompetition')}
      </PageTitle>
      <Card>
        {aiEnabled(profile) && !fromImport && (
          <div className="mb-4">
            <Link
              href="/competitions/import"
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            >
              <FileInput aria-hidden />
              {tImport('open')}
            </Link>
          </div>
        )}
        <CompetitionForm
          initial={null}
          draft={draft}
          returnTo={fromImport ? '/competitions/import' : '/competitions'}
          defaultDay={todayIn(profile.timeZone)}
          defaultEntryUrl={inJapan(profile.timeZone) ? JAAF_ENTRY_URL : ''}
        />
      </Card>
    </main>
  );
}
