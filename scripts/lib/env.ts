import { z } from 'zod';

/**
 * scripts/ が読む鍵。どれも .env.local に置く。
 * スクリプトごとに要る鍵が違うので、使う時点で1つずつ確かめる
 */
const SCHEMA = {
  // 移行を当てる先。手元は compose.yaml の Postgres、本番は Neon
  DATABASE_URL: z.string().min(1),
} as const;

export function scriptEnv(name: keyof typeof SCHEMA): string {
  const result = SCHEMA[name].safeParse(process.env[name]);
  if (!result.success) throw new Error(`${name} が .env.local にありません`);
  return result.data;
}
