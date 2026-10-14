import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

/** Better Auth の鍵の最短の長さ（Better Auth が求める 32 文字） */
const AUTH_SECRET_MIN_LENGTH = 32;

/**
 * サイトが読む環境変数の検査。値の前後の空白と改行は落とす。`vercel env add … < file` で入れると末尾の改行まで入り、
 * spatto で本番の契約ボタンが 500 で落ちた（2026-10、Stripe の鍵）。署名や照合に使う鍵は1文字違うだけで黙って通らなくなる。next.config.ts が読み込むので、欠けていればビルドの頭で止まる。
 * scripts/ の鍵は手元でしか使わないので、ここではなく scripts/lib/env.ts で確かめる
 */
export const env = createEnv({
  server: {
    // 手元は compose.yaml の Postgres、本番は Neon（プールを通す接続文字列）
    DATABASE_URL: z.string().trim().min(1),
    // ログイン（Better Auth）。鍵を持たないビルドや CI も通すため、ここでは任意にしておく。
    // 欠けたままログインの受け口に来たら、そこで名前を挙げて止まる（src/lib/auth.ts）
    BETTER_AUTH_SECRET: z.string().trim().min(AUTH_SECRET_MIN_LENGTH).optional(),
    BETTER_AUTH_URL: z.string().trim().pipe(z.url()).optional(),
    GOOGLE_CLIENT_ID: z.string().trim().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().trim().min(1).optional(),
    // Sentry の送り先。無ければ送らない（src/lib/monitoring.ts）
    SENTRY_DSN: z.string().trim().pipe(z.url()).optional(),
    // 動画の置き場（Cloudflare R2）。手元は jumps-lab-dev にだけ書ける鍵、本番は jumps-lab。
    // 無くてもビルドは通し、使う時点で名前を挙げて止まる（src/lib/r2.ts。onigiri と同じ）
    R2_ENDPOINT: z.string().trim().pipe(z.url()).optional(),
    R2_ACCESS_KEY_ID: z.string().trim().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().trim().min(1).optional(),
    R2_BUCKET: z.string().trim().min(1).optional(),
    // AI コーチ（OpenAI）。無ければ AI の機能を出さない（src/lib/ai.ts）。
    // 今は中元さんから借りたキーを手元だけに置く。本番に入れるのは、払う名義が決まってから（2026-10-12）
    OPENAI_API_KEY: z.string().trim().min(1).optional(),
    // 管理の画面（/admin）に入れる人の Google のメール。カンマで区切る。無ければ誰も入れない（src/lib/admin.ts）
    ADMIN_EMAILS: z.string().trim().min(1).optional(),
    // 通知（Web Push）の VAPID の秘密鍵と、送り主（サイトの URL）。公開鍵（下の NEXT_PUBLIC_）と3つ揃わなければ
    // 通知の設定を出さず、送らない（src/lib/push.ts の pushReady）
    VAPID_PRIVATE_KEY: z.string().trim().min(1).optional(),
    VAPID_SUBJECT: z.string().trim().pipe(z.url()).optional(),
    // Vercel の Cron が付けてくる鍵（Authorization: Bearer）。無ければ Cron の受け口は 503 を返す
    CRON_SECRET: z.string().trim().min(1).optional(),
    // メール（Resend の HTTP API）。16歳未満の人の保護者へ、AI コーチの同意のお願いを送る（src/lib/mail.ts）。
    // 2つ揃わなければ送らず、画面は「今は使えません」を出す。MAIL_FROM は "Jumps Lab <noreply@…>" の形で、
    // そのドメインを Resend で確かめてから入れる
    RESEND_API_KEY: z.string().trim().min(1).optional(),
    MAIL_FROM: z.string().trim().min(1).optional(),
  },
  client: {
    // 通知の VAPID の公開鍵。ブラウザが購読するときに渡す
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().trim().min(1).optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    SENTRY_DSN: process.env.SENTRY_DSN,
    R2_ENDPOINT: process.env.R2_ENDPOINT,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET: process.env.R2_BUCKET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
    CRON_SECRET: process.env.CRON_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    MAIL_FROM: process.env.MAIL_FROM,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  },
  emptyStringAsUndefined: true,
});
