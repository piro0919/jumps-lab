import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { AttemptsCard } from '@/components/attempts-card';
import { CompetitionItem } from '@/components/competitions-board';
import { ConditionCard } from '@/components/condition-card';
import {
  Card,
  CardTitle,
  EmptyState,
  HALVES,
  MAIN_SIDE,
  PageTitle,
  SectionTitle,
} from '@/components/layout-ui';
import { RemoveMemberButton } from '@/components/team-buttons';
import { VideosCard } from '@/components/videos-card';
import { competitionResults } from '@/lib/competition-results';
import {
  type CoachAccess,
  getCoachedTeam,
  getMemberForCoach,
  listMemberAllAttemptsForCoach,
  listMemberAttemptsForCoach,
  listMemberCompetitionsForCoach,
  listMemberDayLogsForCoach,
  listMemberVideosForCoach,
} from '@/lib/data';
import { addDays, todayIn } from '@/lib/dates';
import { viewUrl } from '@/lib/r2';
import { formatMark } from '@/lib/units';
import { requireProfile, requireViewer } from '@/lib/viewer';

/** 選手の記録を見る日数（選手の時間帯の今日を含む直近14日） */
const RECENT_DAYS = 14;

/** 利用者の id（Better Auth が振る文字列）の長さの上限。これより長いものは探さない */
const USER_ID_MAX_LENGTH = 200;

/**
 * コーチが見る、選手1人の記録（2026-10-14）。見るだけで、直す・消す・目印を置くは出さない。
 * 直近14日の日ごとの試技・体調（痛みのメモと練習メモも）・動画と、大会。動画は開くたびに期限つきの URL を作る（本人の画面と同じ）。
 * 押した人がそのチームのコーチで、相手がいまそのチームの選手でなければ開かない。読む文のどれもが同じことを確かめる
 * （src/lib/data.ts の COACH_SEES）。抜けた・外された選手は、その時点から見えない
 */
export default async function TeamMember({
  params,
}: PageProps<'/teams/[teamId]/members/[userId]'>) {
  const viewer = await requireViewer();
  const coach = await requireProfile(viewer.userId);
  const { teamId, userId } = await params;
  if (!z.uuid().safeParse(teamId).success || userId.length > USER_ID_MAX_LENGTH) notFound();
  const access: CoachAccess = { coachId: viewer.userId, teamId, memberId: userId };
  const [team, member] = await Promise.all([
    getCoachedTeam(viewer.userId, teamId),
    getMemberForCoach(access),
  ]);
  if (!team || !member) notFound();

  const today = todayIn(member.timeZone);
  const from = addDays(today, 1 - RECENT_DAYS);
  const [attempts, logs, videos, competitions, allAttempts] = await Promise.all([
    listMemberAttemptsForCoach(access, from, today),
    listMemberDayLogsForCoach(access, from, today),
    listMemberVideosForCoach(access, from, today),
    listMemberCompetitionsForCoach(access),
    listMemberAllAttemptsForCoach(access),
  ]);
  const videoItems = await Promise.all(
    videos.map(async (video) => {
      const sameEvent = attempts.filter((a) => a.day === video.day && a.event === video.event);
      const index = sameEvent.findIndex((a) => a.id === video.attemptId);
      return {
        day: video.day,
        item: {
          id: video.id,
          event: video.event,
          kind: video.kind,
          note: video.note,
          url: await viewUrl(video.objectKey),
          // 保存のボタンは出さない（見るだけ）
          downloadUrl: '',
          expiresAt: video.expiresAt,
          attemptLabel:
            index < 0 ? null : `${index + 1}. ${formatMark(sameEvent[index]!.markM, coach.units)}`,
        },
      };
    }),
  );
  const days = [
    ...new Set([
      ...attempts.map((a) => a.day),
      ...logs.map((l) => l.day),
      ...videos.map((v) => v.day),
    ]),
  ].toSorted((a, b) => b.localeCompare(a));
  const results = competitionResults(allAttempts);

  const t = await getTranslations('teams');
  const tNav = await getTranslations('nav');
  const format = await getFormatter();

  return (
    <main className="flex flex-col gap-3">
      <PageTitle
        back={{ href: `/teams/${team.id}`, label: tNav('backTo', { page: team.name }) }}
        action={<RemoveMemberButton teamId={team.id} memberId={userId} name={member.name} />}
      >
        {member.name}
      </PageTitle>
      <div className={MAIN_SIDE}>
        <div className="flex flex-col gap-3">
          {days.length === 0 ? (
            <Card>
              <CardTitle>{t('recentDays', { days: RECENT_DAYS })}</CardTitle>
              <EmptyState message={t('noRecentDays', { days: RECENT_DAYS })} />
            </Card>
          ) : (
            days.map((day) => {
              const log = logs.find((l) => l.day === day) ?? null;
              const dayVideos = videoItems.filter((v) => v.day === day).map((v) => v.item);
              return (
                <section key={day} className="flex flex-col gap-3">
                  <div className="px-4 pt-3">
                    <SectionTitle>
                      {format.dateTime(new Date(`${day}T00:00:00Z`), {
                        month: 'short',
                        day: 'numeric',
                        weekday: 'short',
                        timeZone: 'UTC',
                      })}
                    </SectionTitle>
                  </div>
                  <div className={HALVES}>
                    <AttemptsCard
                      day={day}
                      events={member.events}
                      units={coach.units}
                      attempts={attempts.filter((a) => a.day === day)}
                      readOnly
                    />
                    <ConditionCard log={log} />
                  </div>
                  {dayVideos.length > 0 && (
                    <VideosCard videos={dayVideos} timeZone={coach.timeZone} />
                  )}
                </section>
              );
            })
          )}
        </div>
        <Card>
          <CardTitle>{tNav('competitions')}</CardTitle>
          {competitions.length === 0 ? (
            <EmptyState message={t('noCompetitions')} />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {competitions.toReversed().map((competition) => (
                <li key={competition.id}>
                  <CompetitionItem
                    competition={competition}
                    results={results.get(competition.day) ?? []}
                    units={coach.units}
                    today={today}
                    readOnly
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
