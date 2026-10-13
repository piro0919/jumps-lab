import { afterEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({ OPENAI_API_KEY: undefined as string | undefined }));
vi.mock('@/env', () => ({ env }));

const { aiEnabled } = await import('@/lib/ai');

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
