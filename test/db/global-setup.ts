import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';
import { adminUrl, TEST_DB, testUrl } from './urls';

/** 表の変更のファイルを置く場所 */
const MIGRATIONS_DIR = new URL('../../db/migrations/', import.meta.url);

/** db/migrations/ にある表の変更の名前（番号順）。scripts/migrate.ts と同じ形のファイルだけを拾う */
export async function readMigrationNames(): Promise<string[]> {
  return (await readdir(MIGRATIONS_DIR))
    .filter((file) => /^\d{4}_[a-z0-9_]+\.sql$/.test(file))
    .map((file) => file.replace(/\.sql$/, ''))
    .toSorted();
}

/**
 * テストの前に、テスト用の DB を空から作り直し、db/migrations/ を番号順に当てる。
 * 本番と同じ表で確かめるため、表の作りを書き写さず migration をそのまま使う（vocafy と同じ）
 */
export default async function setup() {
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`drop database if exists ${TEST_DB} with (force)`);
    await admin.query(`create database ${TEST_DB}`);
  } finally {
    await admin.end();
  }

  const client = new pg.Client({ connectionString: testUrl });
  await client.connect();
  try {
    for (const name of await readMigrationNames()) {
      await client.query(await readFile(new URL(`${name}.sql`, MIGRATIONS_DIR), 'utf8'));
    }
  } finally {
    await client.end();
  }
}
