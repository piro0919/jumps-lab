import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readMigrationNames } from './global-setup';
import { adminUrl } from './urls';

/**
 * 表の変更を当てるスクリプト（scripts/migrate.ts）。使い捨ての DB に本物のスクリプトを走らせる（vocafy と同じ）。
 * --check は Vercel のビルドの頭で走り（vercel.json の buildCommand）、本番に当てていない変更があればビルドを止める
 */

const run = promisify(execFile);
const DB = 'jumpslab_migrate_test';
const url = new URL(adminUrl);
url.pathname = `/${DB}`;

async function admin(sql: string) {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

/** スクリプトを走らせ、終わり方と出力を返す（失敗しても投げない） */
async function migrate(...args: string[]) {
  try {
    const { stdout, stderr } = await run('pnpm', ['exec', 'tsx', 'scripts/migrate.ts', ...args], {
      env: { ...process.env, DATABASE_URL: url.href },
    });
    return { code: 0, out: stdout + stderr };
  } catch (error) {
    const e = error as { code: number; stdout: string; stderr: string };
    return { code: e.code, out: e.stdout + e.stderr };
  }
}

let names: string[];
beforeAll(async () => {
  await admin(`drop database if exists ${DB} with (force)`);
  await admin(`create database ${DB}`);
  names = await readMigrationNames();
}, 60_000);
afterAll(() => admin(`drop database if exists ${DB} with (force)`));

describe('scripts/migrate.ts', () => {
  it('まだ当てていない変更があれば、--check は名前を出して失敗する', async () => {
    const { code, out } = await migrate('--check');
    expect(code).toBe(1);
    expect(out).toContain(names[0]);
    expect(out).toContain(names.at(-1));
  }, 60_000);

  it('2本が同時に走っても、同じ変更を二度当てない', async () => {
    const [a, b] = await Promise.all([migrate(), migrate()]);
    expect([a.code, b.code]).toEqual([0, 0]);
    const client = new pg.Client({ connectionString: url.href });
    await client.connect();
    try {
      const { rows } = await client.query<{ name: string }>(
        'select name from schema_migrations order by name',
      );
      expect(rows.map((r) => r.name)).toEqual(names);
    } finally {
      await client.end();
    }
  }, 120_000);

  it('すべて当てたあとは、--check が通り、もう一度走らせても何も当てない', async () => {
    expect((await migrate('--check')).code).toBe(0);
    const again = await migrate();
    expect(again.code).toBe(0);
    expect(again.out).toContain('当てるものはありません');
  }, 60_000);
});
