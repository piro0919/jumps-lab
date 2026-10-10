import 'server-only';
import type { NodeOptions } from '@sentry/nextjs';
import { env } from '@/env';
import { scrubEvent } from '@/lib/scrub-event';

/**
 * 本番で落ちたことを知るための Sentry の設定。鯉魂の src/lib/monitoring.ts を写した。
 *
 * **送るのはサーバーで落ちたことだけ。** ブラウザには入れず、画面の録画も所要時間の計測も使わない。
 * 記録やプロフィール、IP、Cookie は送る中身に紛れうるので、集めない設定にしたうえで送る前に削る。
 * プライバシーポリシー（/privacy の5）に書いた範囲を超えないこと
 */

export const sentryOptions: NodeOptions = {
  // 無ければ送らない（手元と CI）
  dsn: env.SENTRY_DSN,
  // 手元では送らない。開発中の落ち方で無料枠を使い切ると、本番の分が届かない
  enabled: process.env.NODE_ENV === 'production',
  environment: process.env.VERCEL_ENV ?? 'development',
  // v11 は何も言わなければ利用者、Cookie、ヘッダー、本文、問い合わせの文字列を集める
  // （https://docs.sentry.io/platforms/javascript/guides/nextjs/data-management/data-collected/）。
  // すべて止め、漏れた分は beforeSend で削る
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
  },
  beforeSend: scrubEvent,
  tracesSampleRate: 0,
};
