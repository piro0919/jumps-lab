import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { asksAge } from '@/lib/ai';
import { Card, FORM_PAGE, PageTitle } from '@/components/layout-ui';
import { SiteHeader } from '@/components/site-header';
import { TeamJoinChoice } from '@/components/team-join';
import { TeamShareDetails } from '@/components/team-share-details';
import { buttonVariants } from '@/components/ui/button';
import { findInvite, getProfile, latestGuardianRequest, teamRelation } from '@/lib/data';
import { todayIn } from '@/lib/dates';
import { consenterFor, GUARDIAN_LINK_DAYS, maskEmail } from '@/lib/guardian';
import { hashInviteToken, INVITE_TOKEN_MAX_LENGTH, inviteLinkState } from '@/lib/teams';
import { joinReturnPath } from '@/lib/safe-next';
import { getViewer } from '@/lib/viewer';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('teams');
  // 招待のリンクで開く画面。検索に載せない（robots.ts でも踏ませない）。
  // 道に鍵が入るので、この画面から別のページへ移っても Referer で鍵を渡さない
  return {
    title: t('joinMetaTitle'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

/**
 * チームの招待の画面（/join/<鍵>。2026-10-14）。ログインしていなければ、ログインの画面を通ってここへ戻る
 * （Cookie が無ければ src/proxy.ts が、Cookie が残ってセッションが切れていればこの画面が送る）。
 * プロフィールがまだなら、ようこその画面を通ってここへ戻る。
 * チームの名前とコーチの表示名、コーチに見せるもの（見るだけ・いつでも抜けられる）を見せ、「同意して参加」で入る。
 * 16歳未満の人は保護者の同意で入る（AI コーチと同じ線。src/lib/guardian.ts）。
 * アプリの外枠（下のタブ）には入れない: プロフィールの無い人をようこその画面へ送るとき、ここへ戻す道を持たせるため。
 * 切った・期限の過ぎた・知らないリンクは、どれか言わずに同じ「もう使えません」を出す
 */
export default async function Join({ params }: PageProps<'/join/[token]'>) {
  const { token } = await params;
  const viewer = await getViewer();
  if (!viewer) {
    // Cookie だけ残ってセッションが切れた人は、src/proxy.ts を通り抜けてここへ来る。
    // requireViewer の /sign-in では招待を失うので、ここでも ?next= を付けてログインの画面へ送る
    const back = joinReturnPath(`/join/${token}`);
    redirect(back === null ? '/sign-in' : `/sign-in?next=${encodeURIComponent(back)}`);
  }
  const profile = await getProfile(viewer.userId);
  if (!profile) redirect(`/welcome?next=${encodeURIComponent(`/join/${token}`)}`);

  const invite =
    token.length <= INVITE_TOKEN_MAX_LENGTH ? await findInvite(hashInviteToken(token)) : null;
  const valid = invite !== null && inviteLinkState(invite, new Date()) === 'valid';
  const [relation, request] = valid
    ? await Promise.all([
        teamRelation(viewer.userId, invite.teamId),
        latestGuardianRequest(viewer.userId, invite.teamId),
      ])
    : [null, null];
  const t = await getTranslations('teams');
  const format = await getFormatter();

  const body = () => {
    if (!valid || !relation) {
      return (
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-semibold">{t('inviteInvalid')}</p>
          <p>{t('inviteInvalidNext')}</p>
        </div>
      );
    }
    if (relation.coach || relation.member) {
      return (
        <div className="flex flex-col items-start gap-4 text-sm">
          <p className="font-semibold">
            {relation.coach
              ? t('alreadyCoach', { team: invite.teamName })
              : t('alreadyMember', { team: invite.teamName })}
          </p>
          <Link
            href={relation.coach ? `/teams/${invite.teamId}` : '/teams'}
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            {t('open')}
          </Link>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-4 text-sm">
        <TeamShareDetails
          notes={{ notShown: t('notShown'), leave: t('leaveAnytime') }}
          intro={
            <p>
              {t('joinIntro', {
                team: invite.teamName,
                coaches: format.list(invite.coaches),
              })}
            </p>
          }
        />
        <TeamJoinChoice
          token={token}
          team={invite.teamName}
          consenter={consenterFor({
            birthdate: profile.birthdate,
            declared16Plus: profile.ageDeclared16Plus,
            today: todayIn(profile.timeZone),
          })}
          askAge={asksAge(profile)}
          request={request ? { email: maskEmail(request.guardianEmail), live: request.live } : null}
          linkDays={GUARDIAN_LINK_DAYS}
        />
      </div>
    );
  };

  return (
    <>
      <SiteHeader name={profile.name} email={viewer.email} image={viewer.image} />
      <div className="mx-auto w-full max-w-2xl">
        <main className={FORM_PAGE}>
          <PageTitle>
            {valid ? t('joinTitle', { team: invite.teamName }) : t('joinMetaTitle')}
          </PageTitle>
          <Card>{body()}</Card>
        </main>
      </div>
    </>
  );
}
