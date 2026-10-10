import { execFileSync } from 'node:child_process';
import type { BrowserContext } from '@playwright/test';

/**
 * 試験用の利用者を作り直し、そのセッションの Cookie をブラウザに入れる。
 * Google の画面は通せないので、scripts/dev-session.ts（手元の確かめ用と同じ）で DB にセッションを作る。
 * 利用者は試験ごとに分ける（パソコンとスマホが同時に走っても、手元の dev-user の記録も消さない）
 */
export async function signInAsFreshUser(context: BrowserContext, userId: string, baseURL: string) {
  const out = execFileSync(
    'pnpm',
    [
      'exec',
      'tsx',
      '--env-file-if-exists=.env.local',
      'scripts/dev-session.ts',
      '--fresh',
      `--user=${userId}`,
    ],
    { encoding: 'utf8' },
  );
  const line = out.split('\n').find((l) => l.startsWith('better-auth.session_token='));
  if (!line) throw new Error(`セッションを作れませんでした: ${out}`);
  const value = line.slice('better-auth.session_token='.length).trim();
  await context.addCookies([{ name: 'better-auth.session_token', value, url: baseURL }]);
}
