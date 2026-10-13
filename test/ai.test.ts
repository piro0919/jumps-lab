import { afterEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({ OPENAI_API_KEY: undefined as string | undefined }));
vi.mock('@/env', () => ({ env }));

const { AI_CONSENT_VERSION, aiEnabled, aiUsable, classifyAiFailure } = await import('@/lib/ai');

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

  const consented = AI_CONSENT_VERSION;

  it('Premium でも同意する前は送らない', () => {
    env.OPENAI_API_KEY = 'sk-test';
    expect(aiUsable({ plan: 'premium', aiConsentVersion: null })).toBe(false);
  });

  it('Premium で同意した人は使える', () => {
    env.OPENAI_API_KEY = 'sk-test';
    expect(aiUsable({ plan: 'premium', aiConsentVersion: consented })).toBe(true);
  });

  it('同意していても Free の人は使えない', () => {
    env.OPENAI_API_KEY = 'sk-test';
    expect(aiUsable({ plan: 'free', aiConsentVersion: consented })).toBe(false);
  });

  it('前の版に同意した人には、もう一度聞く', () => {
    env.OPENAI_API_KEY = 'sk-test';
    expect(aiUsable({ plan: 'premium', aiConsentVersion: AI_CONSENT_VERSION - 1 })).toBe(false);
  });

  it('キーが無ければ同意した Premium の人も使えない', () => {
    expect(aiUsable({ plan: 'premium', aiConsentVersion: consented })).toBe(false);
  });
});

describe('classifyAiFailure', () => {
  const body = (type: string, code: string | null) => ({ error: { message: 'x', type, code } });

  it('401 と 403 はキーや場所の問題', () => {
    expect(
      classifyAiFailure({ status: 401, body: body('invalid_request_error', 'invalid_api_key') }),
    ).toBe('auth');
    expect(classifyAiFailure({ status: 403 })).toBe('auth');
  });

  it('429 の混雑は busy', () => {
    expect(
      classifyAiFailure({ status: 429, body: body('rate_limit_error', 'rate_limit_exceeded') }),
    ).toBe('busy');
    expect(classifyAiFailure({ status: 429, body: body('rate_limit_error', 'slow_down') })).toBe(
      'busy',
    );
  });

  it('429 の残高切れや上限は quota（type に入っても code に入っても）', () => {
    expect(
      classifyAiFailure({ status: 429, body: body('insufficient_quota', 'insufficient_quota') }),
    ).toBe('quota');
    expect(
      classifyAiFailure({
        status: 429,
        body: body('insufficient_quota', 'credit_balance_exhausted'),
      }),
    ).toBe('quota');
    expect(
      classifyAiFailure({
        status: 429,
        body: body('rate_limit_error', 'project_spend_limit_exceeded'),
      }),
    ).toBe('quota');
    expect(classifyAiFailure({ status: 429, body: body('insufficient_quota', null) })).toBe(
      'quota',
    );
  });

  it('429 で本文が読めなければ busy（待てば直る側に倒す）', () => {
    expect(classifyAiFailure({ status: 429 })).toBe('busy');
    expect(classifyAiFailure({ status: 429, body: '<html>' })).toBe('busy');
  });

  it('5xx は busy', () => {
    expect(classifyAiFailure({ status: 500 })).toBe('busy');
    expect(
      classifyAiFailure({
        status: 503,
        body: body('service_unavailable_error', 'server_is_overloaded'),
      }),
    ).toBe('busy');
  });

  it('400 などこちらの誤りは unknown', () => {
    expect(classifyAiFailure({ status: 400, body: body('invalid_request_error', null) })).toBe(
      'unknown',
    );
  });

  it('時間切れ・中断・通信の失敗は busy', () => {
    expect(classifyAiFailure({ thrown: new DOMException('timeout', 'TimeoutError') })).toBe('busy');
    expect(classifyAiFailure({ thrown: new DOMException('aborted', 'AbortError') })).toBe('busy');
    expect(classifyAiFailure({ thrown: new TypeError('fetch failed') })).toBe('busy');
  });

  it('ほかの例外は unknown', () => {
    expect(classifyAiFailure({ thrown: new Error('x') })).toBe('unknown');
    expect(classifyAiFailure({})).toBe('unknown');
  });
});
