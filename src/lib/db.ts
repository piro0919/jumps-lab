import 'server-only';
import { attachDatabasePool } from '@vercel/functions';
import pg from 'pg';
import { env } from '@/env';

let pool: pg.Pool | undefined;

/**
 * DB への接続をまとめたもの。関数の中で1つだけ作り、要求をまたいで使い回す。
 * Vercel の関数は温まったまま次の要求を受けるので、TCP の接続を張り直さずに済む。
 * attachDatabasePool に渡すと、関数が眠る前に使っていない接続を閉じてくれる。
 *
 * 初めて使うときに作る。読み込みの時点で作ると、DB の無いビルドが落ちる
 */
export function db(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 5 });
    attachDatabasePool(pool);
  }
  return pool;
}
