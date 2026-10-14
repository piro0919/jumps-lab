import { describe, expect, it } from 'vitest';
import {
  consenterFor,
  consentSatisfied,
  declaredFromBirthdate,
  GUARDIAN_AGE,
  guardianLinkState,
  hashGuardianToken,
  mailSafeName,
  maskEmail,
  newGuardianToken,
} from '@/lib/guardian';

/**
 * AI コーチの同意を本人と保護者のどちらから取るか（src/lib/guardian.ts）。
 * 16歳の誕生日の当日から本人。生年月日が無ければ本人の答え、答えていなければ聞く
 */
describe('consenterFor', () => {
  const today = '2026-10-14';

  it('16歳の誕生日の当日から本人、前の日までは保護者', () => {
    expect(GUARDIAN_AGE).toBe(16);
    expect(consenterFor({ birthdate: '2010-10-14', declared16Plus: null, today })).toBe('self');
    expect(consenterFor({ birthdate: '2010-10-15', declared16Plus: null, today })).toBe('guardian');
  });

  it('生年月日があれば答えより生年月日を使う', () => {
    expect(consenterFor({ birthdate: '2012-04-02', declared16Plus: true, today })).toBe('guardian');
    expect(consenterFor({ birthdate: '2000-01-01', declared16Plus: false, today })).toBe('self');
  });

  it('生年月日が無ければ答えで決め、答えていなければ聞く', () => {
    expect(consenterFor({ birthdate: null, declared16Plus: true, today })).toBe('self');
    expect(consenterFor({ birthdate: null, declared16Plus: false, today })).toBe('guardian');
    expect(consenterFor({ birthdate: null, declared16Plus: null, today })).toBe('ask');
  });

  // 16年後はかならずうるう年（2100年を除く）なので、16歳の誕生日は2月29日にある
  it('2月29日生まれは、2月29日に16歳になる', () => {
    expect(
      consenterFor({ birthdate: '2008-02-29', declared16Plus: null, today: '2024-02-28' }),
    ).toBe('guardian');
    expect(
      consenterFor({ birthdate: '2008-02-29', declared16Plus: null, today: '2024-02-29' }),
    ).toBe('self');
  });
});

describe('consentSatisfied', () => {
  const version = 2;

  it('本人の同意は16歳以上だけ数える', () => {
    expect(consentSatisfied('self', { self: version, guardian: null }, version)).toBe(true);
    expect(consentSatisfied('guardian', { self: version, guardian: null }, version)).toBe(false);
    expect(consentSatisfied('ask', { self: version, guardian: null }, version)).toBe(false);
  });

  it('保護者の同意は、16歳になったあとも数える', () => {
    expect(consentSatisfied('guardian', { self: null, guardian: version }, version)).toBe(true);
    expect(consentSatisfied('self', { self: null, guardian: version }, version)).toBe(true);
  });

  it('前の版の同意は数えない', () => {
    expect(consentSatisfied('self', { self: 1, guardian: 1 }, version)).toBe(false);
    expect(consentSatisfied('guardian', { self: version, guardian: 1 }, version)).toBe(false);
  });
});

describe('リンクの鍵', () => {
  it('毎回ちがう、URL にそのまま入る鍵を作る', () => {
    const a = newGuardianToken();
    const b = newGuardianToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('ハッシュは同じ鍵から同じ値で、鍵そのものは含まない', () => {
    const token = newGuardianToken();
    expect(hashGuardianToken(token)).toBe(hashGuardianToken(token));
    expect(hashGuardianToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashGuardianToken(token)).not.toContain(token);
  });
});

describe('guardianLinkState', () => {
  const now = new Date('2026-10-14T00:00:00Z');

  it('期限の内で使われていなければ使える', () => {
    expect(
      guardianLinkState({ usedAt: null, expiresAt: new Date('2026-10-14T00:00:01Z') }, now),
    ).toBe('valid');
  });

  it('期限ちょうどからは切れている', () => {
    expect(guardianLinkState({ usedAt: null, expiresAt: now }, now)).toBe('expired');
  });

  it('使ったものは、期限の内でも使えない', () => {
    expect(
      guardianLinkState(
        { usedAt: new Date('2026-10-13T00:00:00Z'), expiresAt: new Date('2026-10-20T00:00:00Z') },
        now,
      ),
    ).toBe('used');
  });
});

describe('maskEmail', () => {
  it('先頭の1文字とドメインだけを見せる', () => {
    expect(maskEmail('guardian@example.com')).toBe('g***@example.com');
    expect(maskEmail('a@b.jp')).toBe('a***@b.jp');
  });

  it('形のおかしいものは全部伏せる', () => {
    expect(maskEmail('no-at-mark')).toBe('***');
    expect(maskEmail('@example.com')).toBe('***');
  });
});

describe('declaredFromBirthdate', () => {
  const today = '2026-10-14';

  it('生年月日があれば16歳以上かを返し、無ければ null（前の答えのまま）', () => {
    expect(declaredFromBirthdate('2010-10-14', today)).toBe(true);
    expect(declaredFromBirthdate('2010-10-15', today)).toBe(false);
    expect(declaredFromBirthdate(null, today)).toBeNull();
  });
});

describe('mailSafeName', () => {
  it('URL・ドメイン・制御文字を除き、空白を詰める', () => {
    expect(mailSafeName('Taro')).toBe('Taro');
    expect(mailSafeName('山田 太郎')).toBe('山田 太郎');
    expect(mailSafeName('Click https://evil.example/login now')).toBe('Click now');
    expect(mailSafeName('see www.evil.example')).toBe('see');
    expect(mailSafeName('go to evil.example/pay')).toBe('go to');
    expect(mailSafeName('A\u202eB\nC')).toBe('A B C');
  });

  it('長い名前は切り、何も残らなければ null', () => {
    expect([...mailSafeName('あ'.repeat(80))!]).toHaveLength(50);
    expect(mailSafeName('https://evil.example')).toBeNull();
    expect(mailSafeName('  ')).toBeNull();
  });
});
