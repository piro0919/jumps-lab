import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '@/lib/data';

/**
 * 保護者へのお願いを送る Server Action（src/app/actions/guardian.ts の sendGuardianRequestAction）と、
 * 本人の同意（src/app/actions/menu.ts の consentAiAction）の年齢の判定。DB とメールは差し替える
 */

const env = vi.hoisted(() => ({
  OPENAI_API_KEY: 'sk-test' as string | undefined,
  BETTER_AUTH_URL: 'http://localhost:3312' as string | undefined,
}));
vi.mock('@/env', () => ({ env }));
vi.mock('next/cache', () => ({ refresh: vi.fn() }));
vi.mock('next-intl/server', () => ({
  getLocale: async () => 'ja',
  getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
    `${key} ${JSON.stringify(values)}`,
}));
vi.mock('@/lib/viewer', () => ({
  requireViewer: async () => ({
    userId: 'u1',
    name: 'Taro',
    email: 'taro@example.com',
    image: null,
  }),
}));

const profile = vi.hoisted(() => ({ current: null as Profile | null }));
const data = vi.hoisted(() => ({
  getProfile: vi.fn(async () => profile.current),
  addGuardianRequest: vi.fn<
    (
      userId: string,
      request: { guardianEmail: string; tokenHash: string; days: number; perDay: number },
    ) => Promise<string | null>
  >(async () => 'req-1'),
  releaseGuardianRequest: vi.fn(async () => {}),
  latestGuardianRequest: vi.fn(
    async (): Promise<{ id: string; guardianEmail: string; live: boolean } | null> => null,
  ),
  declareUnder16: vi.fn(async () => {}),
  consentToAi: vi.fn<(userId: string, version: number, declare: boolean) => Promise<boolean>>(
    async () => true,
  ),
  agreeAsGuardian: vi.fn(async (): Promise<'agreed' | 'already' | 'coach' | 'invalid'> => 'agreed'),
  findInvite: vi.fn(
    async (): Promise<{
      inviteId: string;
      teamId: string;
      teamName: string;
      coaches: string[];
      revokedAt: Date | null;
      expiresAt: Date;
    } | null> => null,
  ),
  teamRelation: vi.fn(async () => ({ coach: false, member: false })),
}));
vi.mock('@/lib/data', () => data);

const mail = vi.hoisted(() => ({
  mailReady: vi.fn(() => true),
  sendMail: vi.fn<(mail: { to: string; subject: string; text: string }) => Promise<void>>(
    async () => {},
  ),
}));
vi.mock('@/lib/mail', () => mail);

const { sendGuardianRequestAction, agreeGuardianAction } = await import('@/app/actions/guardian');
const { consentAiAction } = await import('@/app/actions/menu');
const { AI_CONSENT_VERSION } = await import('@/lib/ai');

const athlete = (overrides: Partial<Profile> = {}): Profile => ({
  name: 'Taro',
  grade: null,
  gradeOffset: 0,
  birthdate: '2012-05-01',
  gender: null,
  heightCm: null,
  weightKg: null,
  events: ['long_jump'],
  units: 'metric',
  seasonStartMonth: 1,
  weekStart: 0,
  timeZone: 'Asia/Tokyo',
  plan: 'premium',
  inTeamPlan: false,
  aiConsentVersion: null,
  aiGuardianConsentVersion: null,
  ageDeclared16Plus: null,
  jointUseVersion: null,
  ...overrides,
});

const form = (fields: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
};

beforeEach(() => {
  vi.clearAllMocks();
  profile.current = athlete();
  mail.mailReady.mockReturnValue(true);
  data.addGuardianRequest.mockResolvedValue('req-1');
  data.latestGuardianRequest.mockResolvedValue(null);
  data.findInvite.mockResolvedValue(null);
  data.teamRelation.mockResolvedValue({ coach: false, member: false });
});

describe('sendGuardianRequestAction', () => {
  it('16歳未満の人は、保護者へリンク付きのメールを送る', async () => {
    const result = await sendGuardianRequestAction(form({ email: ' parent@example.com ' }));
    expect(result).toEqual({ ok: true });
    expect(data.addGuardianRequest).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ guardianEmail: 'parent@example.com', days: 7, perDay: 3 }),
    );
    // DB に入れるのはハッシュで、メールのリンクには鍵そのもの
    const { tokenHash } = data.addGuardianRequest.mock.calls[0]![1];
    const sent = mail.sendMail.mock.calls[0]![0];
    expect(sent.to).toBe('parent@example.com');
    const token = /guardian-consent\/([A-Za-z0-9_-]+)/.exec(sent.text)?.[1];
    expect(token).toBeDefined();
    expect(sent.text).toContain('http://localhost:3312/guardian-consent/');
    expect(sent.text).not.toContain(tokenHash);
  });

  it('件名に表示名を入れず、本文の表示名からは URL と制御文字を除く', async () => {
    profile.current = athlete({ name: 'Win a prize at https://evil.example/x\u202e now' });
    expect(await sendGuardianRequestAction(form({ email: 'parent@example.com' }))).toEqual({
      ok: true,
    });
    const sent = mail.sendMail.mock.calls[0]![0];
    expect(sent.subject).not.toContain('Win');
    expect(sent.subject).not.toContain('evil');
    expect(sent.text).toContain('Win a prize at now');
    expect(sent.text).not.toContain('evil.example');
    expect(sent.text).not.toContain('\u202e');
  });

  it('表示名が URL だけなら、本文では言い換える', async () => {
    profile.current = athlete({ name: 'evil.example' });
    await sendGuardianRequestAction(form({ email: 'parent@example.com' }));
    const sent = mail.sendMail.mock.calls[0]![0];
    expect(sent.text).not.toContain('evil.example');
    expect(sent.text).toContain('unnamed');
  });

  it('16歳以上の人は送れない', async () => {
    profile.current = athlete({ birthdate: '2008-01-01' });
    expect(await sendGuardianRequestAction(form({ email: 'parent@example.com' }))).toEqual({
      ok: false,
      error: 'generic',
    });
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('生年月日の無い人は「16歳未満」と答えて送り、送れたあとで答えを残す', async () => {
    profile.current = athlete({ birthdate: null });
    expect(await sendGuardianRequestAction(form({ email: 'parent@example.com' }))).toEqual({
      ok: false,
      error: 'generic',
    });
    expect(
      await sendGuardianRequestAction(form({ email: 'parent@example.com', adult: 'no' })),
    ).toEqual({ ok: true });
    expect(data.declareUnder16).toHaveBeenCalledWith('u1');
    expect(data.declareUnder16.mock.invocationCallOrder[0]).toBeGreaterThan(
      mail.sendMail.mock.invocationCallOrder[0]!,
    );
  });

  it('送れなかったときや回数を超えたときは、「16歳未満」の答えを残さない', async () => {
    profile.current = athlete({ birthdate: null });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mail.sendMail.mockRejectedValueOnce(new Error('Resend down'));
    expect(
      await sendGuardianRequestAction(form({ email: 'parent@example.com', adult: 'no' })),
    ).toEqual({ ok: false, error: 'guardianMailUnavailable' });
    data.addGuardianRequest.mockResolvedValueOnce(null);
    expect(
      await sendGuardianRequestAction(form({ email: 'parent@example.com', adult: 'no' })),
    ).toEqual({ ok: false, error: 'guardianLimit' });
    expect(data.declareUnder16).not.toHaveBeenCalled();
  });

  it('自分の Google のアドレスには送らない', async () => {
    expect(await sendGuardianRequestAction(form({ email: 'Taro@Example.com' }))).toEqual({
      ok: false,
      error: 'guardianSelf',
    });
    expect(data.addGuardianRequest).not.toHaveBeenCalled();
  });

  it('メールアドレスの形でなければ送らない', async () => {
    expect(await sendGuardianRequestAction(form({ email: 'parent' }))).toEqual({
      ok: false,
      error: 'guardianEmail',
    });
  });

  it('24時間の回数を超えたら送らない', async () => {
    data.addGuardianRequest.mockResolvedValue(null);
    expect(await sendGuardianRequestAction(form({ email: 'parent@example.com' }))).toEqual({
      ok: false,
      error: 'guardianLimit',
    });
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('メールの設定が無ければ、行も作らずに「今は使えない」', async () => {
    mail.mailReady.mockReturnValue(false);
    expect(await sendGuardianRequestAction(form({ email: 'parent@example.com' }))).toEqual({
      ok: false,
      error: 'guardianMailUnavailable',
    });
    expect(data.addGuardianRequest).not.toHaveBeenCalled();
  });

  it('送れなかったら行を消す', async () => {
    mail.sendMail.mockRejectedValueOnce(new Error('Resend down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await sendGuardianRequestAction(form({ email: 'parent@example.com' }))).toEqual({
      ok: false,
      error: 'guardianMailUnavailable',
    });
    expect(data.releaseGuardianRequest).toHaveBeenCalledWith('u1', 'req-1');
  });

  it('宛先が無ければ、前に送った宛先へ送り直す', async () => {
    data.latestGuardianRequest.mockResolvedValue({
      id: 'old',
      guardianEmail: 'parent@example.com',
      live: true,
    });
    expect(await sendGuardianRequestAction(form({}))).toEqual({ ok: true });
    expect(mail.sendMail.mock.calls[0]![0].to).toBe('parent@example.com');
  });
});

describe('consentAiAction（本人の同意）', () => {
  it('生年月日から16歳未満の人は、本人では同意できない', async () => {
    expect(await consentAiAction(form({ adult: 'yes' }))).toEqual({ ok: false, error: 'generic' });
    expect(data.consentToAi).not.toHaveBeenCalled();
  });

  it('16歳以上の人は同意できる', async () => {
    profile.current = athlete({ birthdate: '2008-01-01' });
    expect(await consentAiAction(form({}))).toEqual({ ok: true });
    expect(data.consentToAi).toHaveBeenCalledWith('u1', AI_CONSENT_VERSION, false);
  });

  it('生年月日の無い人は「16歳以上」と答えたときだけ同意でき、答えも残す', async () => {
    profile.current = athlete({ birthdate: null });
    expect(await consentAiAction(form({}))).toEqual({ ok: false, error: 'generic' });
    expect(await consentAiAction(form({ adult: 'yes' }))).toEqual({ ok: true });
    expect(data.consentToAi).toHaveBeenCalledWith('u1', AI_CONSENT_VERSION, true);
  });

  it('16歳未満と答えた（分かった）生年月日の無い人は、「16歳以上」と送っても本人では同意できない', async () => {
    profile.current = athlete({ birthdate: null, ageDeclared16Plus: false });
    expect(await consentAiAction(form({ adult: 'yes' }))).toEqual({ ok: false, error: 'generic' });
    expect(data.consentToAi).not.toHaveBeenCalled();
  });

  it('DB が答えの上書きを断ったら、同意できなかったと返す', async () => {
    profile.current = athlete({ birthdate: null });
    data.consentToAi.mockResolvedValueOnce(false);
    expect(await consentAiAction(form({ adult: 'yes' }))).toEqual({ ok: false, error: 'generic' });
  });
});

describe('agreeGuardianAction', () => {
  it('鍵をハッシュにして、いまの版で同意を入れる', async () => {
    expect(await agreeGuardianAction('abc')).toEqual({ ok: true, already: false });
    expect(data.agreeAsGuardian).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f]{64}$/),
      AI_CONSENT_VERSION,
    );
  });

  it('使えないリンクは、理由を言わずに同じ誤り', async () => {
    data.agreeAsGuardian.mockResolvedValueOnce('invalid');
    expect(await agreeGuardianAction('abc')).toEqual({ ok: false, error: 'guardianLinkInvalid' });
    expect(await agreeGuardianAction('x'.repeat(101))).toEqual({
      ok: false,
      error: 'guardianLinkInvalid',
    });
  });
});

describe('agreeGuardianAction（チームへの参加で入れなかったとき）', () => {
  it('もう選手だったら成功として返し、そうと分かる印を付ける', async () => {
    data.agreeAsGuardian.mockResolvedValueOnce('already');
    expect(await agreeGuardianAction('abc')).toEqual({ ok: true, already: true });
  });

  it('お願いした人がそのチームのコーチになっていたら、それと分かる誤り', async () => {
    data.agreeAsGuardian.mockResolvedValueOnce('coach');
    expect(await agreeGuardianAction('abc')).toEqual({ ok: false, error: 'guardianTeamCoach' });
  });
});

describe('sendGuardianRequestAction（チームへの参加）', () => {
  const invite = (overrides: { revokedAt?: Date | null } = {}) => ({
    inviteId: 'invite-1',
    teamId: 'team-1',
    teamName: 'Hawks https://evil.example',
    coaches: ['Coach Ken'],
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  });

  it('招待が使えれば、AI コーチのプランが無くても、招待を付けてチームのメールを送る', async () => {
    profile.current = athlete({ plan: 'free' });
    data.findInvite.mockResolvedValue(invite());
    expect(
      await sendGuardianRequestAction(
        form({ email: 'parent@example.com', purpose: 'team', token: 'invite-token' }),
      ),
    ).toEqual({ ok: true });
    expect(data.addGuardianRequest).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ guardianEmail: 'parent@example.com', inviteId: 'invite-1' }),
    );
    const sent = mail.sendMail.mock.calls[0]![0];
    expect(sent.subject).toContain('teamSubject');
    expect(sent.text).toContain('teamBody');
    expect(sent.text).toContain('Coach Ken');
    expect(sent.text).not.toContain('evil.example');
  });

  it('知らない鍵・切った招待では送らない', async () => {
    const send = () =>
      sendGuardianRequestAction(
        form({ email: 'parent@example.com', purpose: 'team', token: 'invite-token' }),
      );
    expect(await send()).toEqual({ ok: false, error: 'teamInviteInvalid' });
    data.findInvite.mockResolvedValue(invite({ revokedAt: new Date() }));
    expect(await send()).toEqual({ ok: false, error: 'teamInviteInvalid' });
    expect(data.addGuardianRequest).not.toHaveBeenCalled();
  });

  it('そのチームのコーチは送れない', async () => {
    data.findInvite.mockResolvedValue(invite());
    data.teamRelation.mockResolvedValue({ coach: true, member: false });
    expect(
      await sendGuardianRequestAction(
        form({ email: 'parent@example.com', purpose: 'team', token: 'invite-token' }),
      ),
    ).toEqual({ ok: false, error: 'teamCoachJoin' });
  });

  it('16歳以上の人は送れない（本人の同意で入る）', async () => {
    profile.current = athlete({ birthdate: '2008-01-01' });
    data.findInvite.mockResolvedValue(invite());
    expect(
      await sendGuardianRequestAction(
        form({ email: 'parent@example.com', purpose: 'team', token: 'invite-token' }),
      ),
    ).toEqual({ ok: false, error: 'generic' });
    expect(mail.sendMail).not.toHaveBeenCalled();
  });
});
