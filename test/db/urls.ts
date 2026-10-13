/**
 * DB を読み書きするテスト（test/db/）の接続先。手元の Postgres（compose.yaml）か、CI の Postgres の中に、
 * テスト専用の DB を作って使う（vocafy の test/db/urls.ts と同じ作り）。手元の DB（jumpslab）の行には触れない。
 *
 * DATABASE_URL のホストが手元でなければ止まる。.env.local や端末に本番（Neon）の接続文字列が入っていても、
 * テストが本番の DB を消したり作ったりしないように
 */
const base = process.env.DATABASE_URL ?? 'postgres://jumpslab:jumpslab@localhost:5436/jumpslab';

/** テスト用の DB の名前。作り直すときに消すので、この名前の DB にしか使わない */
export const TEST_DB = 'jumpslab_test';

/** つないでよいホスト。手元の Postgres と、CI のサービス（GitHub Actions はポートを localhost に出す） */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * 手元のホストか。CI の中だけは、点の無い名前（docker のサービス名）も通す。
 * 点のある名前（ep-xxx.ap-southeast-1.aws.neon.tech など）はどこでも通さない
 */
export function isLocalHost(hostname: string, ci: boolean): boolean {
  return LOCAL_HOSTS.has(hostname) || (ci && /^[a-z0-9-]+$/i.test(hostname));
}

const url = new URL(base);
if (!isLocalHost(url.hostname, process.env.CI === 'true')) {
  throw new Error(
    `DB のテストは手元の Postgres にしかつなぎません（DATABASE_URL のホストが ${url.hostname}）`,
  );
}

/** テスト用の DB を作り直すときにつなぐ先（同じサーバーの、手元の DB） */
export const adminUrl = url.href;

const test = new URL(url);
test.pathname = `/${TEST_DB}`;
export const testUrl = test.href;
