import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { testUrl } from './urls';

/**
 * テストの場面を入れる。表を空にせず、人ごとに別の id を振る（テストどうしで行がぶつからない）。
 * 全員の行を読む関数（通知の Cron、管理の画面）は、テストの中で自分の人の行だけに絞って確かめる
 */

/** テストの中で表を直に読み書きする */
export async function query<T extends pg.QueryResultRow>(text: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: testUrl });
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

/** ログインした人（Better Auth の user の行）を1人足し、id を返す */
export async function addUser(name?: string): Promise<string> {
  const id = `test-${randomUUID()}`;
  await query(
    `insert into "user" (id, name, email, "emailVerified") values ($1, $2, $1 || '@example.com', true)`,
    [id, name ?? id],
  );
  return id;
}

/** 登録を済ませた人（user とプロフィール）を1人足し、id を返す */
export async function addProfile(
  options: { name?: string; timeZone?: string; events?: string[] } = {},
): Promise<string> {
  const id = await addUser(options.name);
  await query(`insert into profile ("userId", events, "timeZone") values ($1, $2::text[], $3)`, [
    id,
    options.events ?? ['long_jump'],
    options.timeZone ?? 'Asia/Tokyo',
  ]);
  return id;
}
