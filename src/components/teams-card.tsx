import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Badge, Card, CardTitle } from '@/components/layout-ui';
import type { CoachedTeamSummary } from '@/lib/data';

/**
 * ホームのチームのカード（2026-10-14）。チームをコーチしている人にだけ、1チーム1行で名前・選手の数・印のある選手の数を出す。
 * 印のある選手がいるときだけ赤い札で目立たせる。押すとコーチの画面。コーチしていなければ何も出さない
 * （選手とコーチの切り替えは置かない。本人、2026-10-14「シンプルに」）
 */
export function TeamsCard({ teams }: { teams: CoachedTeamSummary[] }) {
  const t = useTranslations('teams');
  if (teams.length === 0) return null;
  return (
    <Card>
      <CardTitle>{t('title')}</CardTitle>
      <ul className="flex flex-col divide-y divide-border">
        {teams.map((team) => (
          <li key={team.id}>
            <Link href={`/teams/${team.id}`} className="flex items-center gap-3 py-3">
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-lg font-extrabold">{team.name}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {t('memberCount', { count: team.memberCount })}
                  </span>
                  {team.flagged > 0 && (
                    <Badge tone="danger">{t('flagged', { count: team.flagged })}</Badge>
                  )}
                </span>
              </span>
              <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
