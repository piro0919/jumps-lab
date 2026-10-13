import { describe, expect, it, vi } from 'vitest';

// 鍵の末尾の改行は落とす（spatto で `vercel env add … < file` の改行が入り、本番の契約ボタンが落ちた）
vi.stubEnv('DATABASE_URL', 'postgres://localhost/test\n');
vi.stubEnv('OPENAI_API_KEY', 'sk-test\n');
vi.stubEnv('BETTER_AUTH_URL', ' https://example.com \n');

const { env } = await import('@/env');

describe('env', () => {
  it('前後の空白と改行を落とす', () => {
    expect(env.OPENAI_API_KEY).toBe('sk-test');
    expect(env.DATABASE_URL).toBe('postgres://localhost/test');
  });

  it('URL も落としてから確かめる', () => {
    expect(env.BETTER_AUTH_URL).toBe('https://example.com');
  });
});
