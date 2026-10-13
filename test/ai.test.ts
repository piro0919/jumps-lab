import { afterEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({ OPENAI_API_KEY: undefined as string | undefined }));
vi.mock('@/env', () => ({ env }));

const { aiEnabled, aiUsable } = await import('@/lib/ai');

describe('aiEnabled', () => {
  afterEach(() => {
    env.OPENAI_API_KEY = undefined;
  });

  it('キーがあっても Free の人には出さない', () => {
    env.OPENAI_API_KEY = 'sk-test';
    expect(aiEnabled({ plan: 'free' })).toBe(false);
  });

  it('Premium の人には出す', () => {
    env.OPENAI_API_KEY = 'sk-test';
    expect(aiEnabled({ plan: 'premium' })).toBe(true);
  });

  it('キーが無ければ Premium の人にも出さない', () => {
    expect(aiEnabled({ plan: 'premium' })).toBe(false);
  });
});

describe('aiUsable', () => {
  afterEach(() => {
    env.OPENAI_API_KEY = undefined;
  });

  const consented = new Date('2026-10-14T00:00:00Z');

  it('Premium でも同意する前は送らない', () => {
    env.OPENAI_API_KEY = 'sk-test';
    expect(aiUsable({ plan: 'premium', aiConsentAt: null })).toBe(false);
  });

  it('Premium で同意した人は使える', () => {
    env.OPENAI_API_KEY = 'sk-test';
    expect(aiUsable({ plan: 'premium', aiConsentAt: consented })).toBe(true);
  });

  it('同意していても Free の人は使えない', () => {
    env.OPENAI_API_KEY = 'sk-test';
    expect(aiUsable({ plan: 'free', aiConsentAt: consented })).toBe(false);
  });

  it('キーが無ければ同意した Premium の人も使えない', () => {
    expect(aiUsable({ plan: 'premium', aiConsentAt: consented })).toBe(false);
  });
});
