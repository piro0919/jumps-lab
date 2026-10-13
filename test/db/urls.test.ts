import { describe, expect, it } from 'vitest';
import { isLocalHost, TEST_DB, testUrl } from './urls';

/** DB のテストが本番（Neon）につながないための柵 */
describe('isLocalHost', () => {
  it('手元の Postgres は通す', () => {
    expect(isLocalHost('localhost', false)).toBe(true);
    expect(isLocalHost('127.0.0.1', false)).toBe(true);
    expect(isLocalHost('[::1]', false)).toBe(true);
  });

  it('Neon のホストは CI の中でも通さない', () => {
    expect(isLocalHost('ep-cool-sun-123456-pooler.ap-southeast-1.aws.neon.tech', false)).toBe(
      false,
    );
    expect(isLocalHost('ep-cool-sun-123456-pooler.ap-southeast-1.aws.neon.tech', true)).toBe(false);
  });

  it('点の無い名前（docker のサービス）は CI の中でだけ通す', () => {
    expect(isLocalHost('postgres', true)).toBe(true);
    expect(isLocalHost('postgres', false)).toBe(false);
  });
});

describe('testUrl', () => {
  it('手元の DB ではなく、テスト用の DB を指す', () => {
    expect(new URL(testUrl).pathname).toBe(`/${TEST_DB}`);
  });
});
