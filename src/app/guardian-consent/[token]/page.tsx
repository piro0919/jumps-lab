import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { AiConsentDetails } from '@/components/ai-consent-details';
import { GuardianAgreeForm } from '@/components/guardian-agree-form';
import { TeamShareDetails } from '@/components/team-share-details';
import { AppIcon, Card, FORM_PAGE, PageTitle, Wordmark } from '@/components/layout-ui';
import { findGuardianRequest } from '@/lib/data';
import { guardianLinkState, hashGuardianToken, TOKEN_MAX_LENGTH } from '@/lib/guardian';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('guardianConsent');
  // メールのリンクで開く画面。検索に載せない（robots.ts でも踏ませない）
  // 道に鍵が入るので、この画面から別のページへ移っても Referer で鍵を渡さない
  return {
    title: t('metaTitle'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

/**
 * 保護者の同意の画面（16歳未満の人の AI コーチと、チームへの参加。2026-10-14）。
 * チームへの参加のお願いなら、チームの名前・コーチの表示名と、コーチに見せるもの（招待の画面と同じ）を見せる。ログインせずに開く（src/proxy.ts が通す）。
 * 見せるのは、お願いした人の表示名と、本人の同意の画面と同じ「何を・どこへ送るか」だけ。記録やメールアドレスは見せない。
 * 期限切れ・使用済み・知らないリンクは、どれか言わずに同じ「もう使えません」を出す。
 * 言語はこの画面を開いた人のブラウザ（と言語の Cookie）で決まる
 */
export default async function GuardianConsent({ params }: PageProps<'/guardian-consent/[token]'>) {
  const { token } = await params;
  const request =
    token.length <= TOKEN_MAX_LENGTH ? await findGuardianRequest(hashGuardianToken(token)) : null;
  // チームへの参加のお願いは、コーチが招待を切った・期限が過ぎたら使えない（同意しても入れない）
  const valid =
    request !== null &&
    guardianLinkState(request, new Date()) === 'valid' &&
    (request.team === null || request.team.inviteLive);
  const t = await getTranslations('guardianConsent');
  const tTeams = await getTranslations('teams');
  const format = await getFormatter();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col py-6">
      <div className="flex items-center gap-2 px-4">
        <AppIcon size="header" />
        <Wordmark size="header">Jumps Lab</Wordmark>
      </div>
      <main className={FORM_PAGE}>
        <PageTitle>{request?.team ? tTeams('guardianTitle') : t('title')}</PageTitle>
        <Card>
          {valid && request.team ? (
            <div className="flex flex-col gap-4 text-sm">
              <TeamShareDetails
                notes={{
                  notShown: tTeams('guardianNotShown', { name: request.childName }),
                  leave: tTeams('guardianLeave', { name: request.childName }),
                }}
                intro={
                  <p>
                    {tTeams('guardianIntro', {
                      name: request.childName,
                      team: request.team.name,
                      coaches: format.list(request.team.coaches),
                    })}
                  </p>
                }
              />
              <GuardianAgreeForm token={token} name={request.childName} team={request.team.name} />
            </div>
          ) : valid ? (
            <div className="flex flex-col gap-4 text-sm">
              <AiConsentDetails
                intro={
                  <>
                    <p>{t('intro', { name: request.childName })}</p>
                    <p>{t('sentIntro', { name: request.childName })}</p>
                  </>
                }
                notSent={t('notSent', { name: request.childName })}
              />
              <GuardianAgreeForm token={token} name={request.childName} />
            </div>
          ) : (
            <div className="flex flex-col gap-2 text-sm">
              <p className="font-semibold">{t('invalid')}</p>
              <p>{t('invalidNext')}</p>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
