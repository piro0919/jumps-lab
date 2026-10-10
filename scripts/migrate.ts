import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';
import { scriptEnv } from './lib/env';

/**
 * db/migrations/ を DB に当てる。どれを当てたかは schema_migrations 表に残す（Vocafy と同じ作り）。
 *
 *   pnpm migrate          まだ当てていないものを、番号順に1本ずつ当てる
 *   pnpm migrate --check  まだ当てていないものがあれば、名前を出して失敗する
 *
 * 当てる先は DATABASE_URL。1本ずつトランザクションで包むので、途中で失敗したファイルは何も残さない。
 * 2本が同時に走っても、advisory lock で後の方が待ち、同じものを二度当てない
 */
const dir = new URL('../db/migrations/', import.meta.url);

/** db/migrations/ のファイル名から、番号順の名前の一覧へ。.sql は落とす */
function migrationNames(files: string[]): string[] {
  return files
    .filter((file) => /^\d{4}_[a-z0-9_]+\.sql$/.test(file))
    .map((file) => file.replace(/\.sql$/, ''))
    .toSorted();
}

async function main() {
  const check = process.argv.includes('--check');
  const pool = new pg.Pool({ connectionString: scriptEnv('DATABASE_URL') });
  try {
    await pool.query(
      'create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())',
    );
    const names = migrationNames(await readdir(dir));
    const { rows } = await pool.query<{ name: string }>('select name from schema_migrations');
    const applied = new Set(rows.map((r) => r.name));
    const pending = names.filter((name) => !applied.has(name));

    if (check) {
      if (pending.length > 0) {
        console.error(`まだ当てていない migration: ${pending.join(', ')}`);
        process.exitCode = 1;
      }
      return;
    }

    for (const name of pending) {
      const body = await readFile(new URL(`${name}.sql`, dir), 'utf8');
      const client = await pool.connect();
      try {
        await client.query('begin');
        await client.query("select pg_advisory_xact_lock(hashtext('schema_migrations'))");
        const { rowCount } = await client.query('select 1 from schema_migrations where name = $1', [
          name,
        ]);
        if (rowCount === 0) {
          await client.query(body);
          await client.query('insert into schema_migrations (name) values ($1)', [name]);
        }
        await client.query('commit');
        console.log(`当てた: ${name}`);
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    }
    if (pending.length === 0) console.log('当てるものはありません');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
