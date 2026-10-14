import { afterEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({ OPENAI_API_KEY: undefined as string | undefined }));
vi.mock('@/env', () => ({ env }));

const { AI_CONSENT_VERSION, aiEnabled, aiUsable, asksAge, classifyAiFailure, consentNotice } =
  await import('@/lib/ai');

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
  /** 生年月日の無い、16歳以上と答えた Premium の人 */
  const base = {
    plan: 'premium' as const,
    aiConsentVersion: null as number | null,
    aiGuardianConsentVersion: null as number | null,
    birthdate: null as string | null,
    ageDeclared16Plus: true as boolean | null,
    timeZone: 'Asia/Tokyo',
  };
  // 2026-10-14 の昼（日本時間）
  const now = new Date('2026-10-14T03:00:00Z');

  it('Premium でも同意する前は送らない', () => {
    env.OPENAI_API_KEY = 'sk-test';
    expect(aiUsable(base, now)).toBe(false);
  });

  it('Premium で同意した人は使える', () => {
    env.OPENAI_API_KEY = 'sk-test';
    expect(aiUsable({ ...base, aiConsentVersion: consented }, now)).toBe(true);
  });

  it('同意していても Free の人は使えない', () => {
    env.OPENAI_API_KEY = 'sk-test';
    expect(aiUsable({ ...base, plan: 'free', aiConsentVersion: consented }, now)).toBe(false);
  });

  it('前の版に同意した人には、もう一度聞く', () => {
    env.OPENAI_API_KEY = 'sk-test';
    expect(aiUsable({ ...base, aiConsentVersion: AI_CONSENT_VERSION - 1 }, now)).toBe(false);
  });

  it('キーが無ければ同意した Premium の人も使えない', () => {
    expect(aiUsable({ ...base, aiConsentVersion: consented }, now)).toBe(false);
  });

  it('16歳未満は、本人が同意していても保護者の同意が要る', () => {
    env.OPENAI_API_KEY = 'sk-test';
    const minor = { ...base, birthdate: '2011-01-01', aiConsentVersion: consented };
    expect(aiUsable(minor, now)).toBe(false);
    expect(aiUsable({ ...minor, aiGuardianConsentVersion: consented }, now)).toBe(true);
  });

  it('保護者の同意も、版が上がれば聞き直す', () => {
    env.OPENAI_API_KEY = 'sk-test';
    const minor = { ...base, birthdate: '2011-01-01' };
    expect(aiUsable({ ...minor, aiGuardianConsentVersion: AI_CONSENT_VERSION - 1 }, now)).toBe(
      false,
    );
  });

  it('16歳未満と答えた人も、保護者の同意で使える', () => {
    env.OPENAI_API_KEY = 'sk-test';
    const declared = { ...base, ageDeclared16Plus: false, aiConsentVersion: consented };
    expect(aiUsable(declared, now)).toBe(false);
    expect(aiUsable({ ...declared, aiGuardianConsentVersion: consented }, now)).toBe(true);
  });

  it('16歳かどうかは本人の時間帯の今日で数える', () => {
    env.OPENAI_API_KEY = 'sk-test';
    // 2010-10-14 生まれ。UTC ではまだ 10月13日（15歳）、東京ではもう 10月14日（16歳）
    const evening = new Date('2026-10-13T20:00:00Z');
    const athlete = { ...base, birthdate: '2010-10-14', aiConsentVersion: consented };
    expect(aiUsable(athlete, evening)).toBe(true);
    expect(aiUsable({ ...athlete, timeZone: 'UTC' }, evening)).toBe(false);
  });
});

describe('consentNotice と asksAge（同意の画面）', () => {
  const now = new Date('2026-10-14T03:00:00Z');
  const base = {
    plan: 'premium' as const,
    aiConsentVersion: null as number | null,
    aiGuardianConsentVersion: null as number | null,
    birthdate: null as string | null,
    ageDeclared16Plus: null as boolean | null,
    timeZone: 'Asia/Tokyo',
  };

  it('年齢を聞く前にいまの版へ同意した、生年月日の無い人には理由を出す（黙って使えなくしない）', () => {
    expect(consentNotice({ ...base, aiConsentVersion: AI_CONSENT_VERSION }, now)).toBe('askAgeNow');
  });

  it('前の版に同意した人には changed、初めての人には何も出さない', () => {
    expect(consentNotice({ ...base, aiConsentVersion: AI_CONSENT_VERSION - 1 }, now)).toBe(
      'changed',
    );
    expect(consentNotice({ ...base, aiGuardianConsentVersion: AI_CONSENT_VERSION - 1 }, now)).toBe(
      'changed',
    );
    expect(consentNotice(base, now)).toBeNull();
  });

  it('16歳未満と答えた（分かった）人には「16歳以上ですか」を聞き直さない', () => {
    expect(asksAge({ birthdate: null, ageDeclared16Plus: null })).toBe(true);
    expect(asksAge({ birthdate: null, ageDeclared16Plus: true })).toBe(true);
    expect(asksAge({ birthdate: null, ageDeclared16Plus: false })).toBe(false);
    expect(asksAge({ birthdate: '2012-01-01', ageDeclared16Plus: null })).toBe(false);
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
