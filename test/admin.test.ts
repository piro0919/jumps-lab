import { afterEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({ ADMIN_EMAILS: undefined as string | undefined }));
vi.mock('@/env', () => ({ env }));

const { isAdmin, parseAdminEmails } = await import('@/lib/admin');

describe('parseAdminEmails', () => {
  it('カンマで区切り、前後の空白を落として小文字にする', () => {
    expect([...parseAdminEmails(' Owner@Example.com ,friend@example.com')]).toEqual([
      'owner@example.com',
      'friend@example.com',
    ]);
  });

  it('空の項目や未設定は捨てる', () => {
    expect([...parseAdminEmails('a@example.com,, ,')]).toEqual(['a@example.com']);
    expect(parseAdminEmails(undefined).size).toBe(0);
    expect(parseAdminEmails('').size).toBe(0);
  });
});

describe('isAdmin', () => {
  afterEach(() => {
    env.ADMIN_EMAILS = undefined;
  });

  it('並んだメールの人だけ。大文字と小文字は区別しない', () => {
    env.ADMIN_EMAILS = 'owner@example.com, Friend@Example.com';
    expect(isAdmin('Owner@example.com')).toBe(true);
    expect(isAdmin('friend@example.com')).toBe(true);
    expect(isAdmin('someone@example.com')).toBe(false);
  });

  it('未設定なら誰も入れない', () => {
    expect(isAdmin('owner@example.com')).toBe(false);
    expect(isAdmin('')).toBe(false);
  });

  it('メールの一部だけでは入れない', () => {
    env.ADMIN_EMAILS = 'owner@example.com';
    expect(isAdmin('owner@example')).toBe(false);
    expect(isAdmin('xowner@example.com')).toBe(false);
  });
});
