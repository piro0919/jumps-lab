import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * メール（src/lib/mail.ts）。Resend は fetch を差し替えて確かめ、本物には送らない。
 * キーが無いときにリンクをログへ出すのは手元の開発（development）だけで、本番（production）では決して出さない
 */

const env = vi.hoisted(() => ({
  RESEND_API_KEY: undefined as string | undefined,
  MAIL_FROM: undefined as string | undefined,
}));
vi.mock('@/env', () => ({ env }));

const { mailMode, mailReady, sendMail } = await import('@/lib/mail');

describe('mailMode', () => {
  it('キーと差出人が揃えば Resend で送る', () => {
    expect(mailMode({ apiKey: 're_x', from: 'Jumps Lab <a@b.c>', nodeEnv: 'production' })).toBe(
      'resend',
    );
  });

  it('本番でキーが無ければ送らず、ログにも出さない', () => {
    expect(mailMode({ apiKey: undefined, from: undefined, nodeEnv: 'production' })).toBe('none');
    expect(mailMode({ apiKey: undefined, from: 'a@b.c', nodeEnv: 'production' })).toBe('none');
    expect(mailMode({ apiKey: undefined, from: undefined, nodeEnv: 'test' })).toBe('none');
    expect(mailMode({ apiKey: undefined, from: undefined, nodeEnv: undefined })).toBe('none');
  });

  it('手元の開発でキーが無ければログに出す', () => {
    expect(mailMode({ apiKey: undefined, from: undefined, nodeEnv: 'development' })).toBe('log');
  });

  // キーだけあって差出人が無いのは設定の誤り。手元でもログに逃がさず、使えないと出す
  it('キーがあって差出人が無ければ送らない', () => {
    expect(mailMode({ apiKey: 're_x', from: undefined, nodeEnv: 'development' })).toBe('none');
  });
});

describe('sendMail', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    env.RESEND_API_KEY = 're_test';
    env.MAIL_FROM = 'Jumps Lab <noreply@example.com>';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('Resend の API に、鍵と差出人・宛先・件名・本文を送る', async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 'email-id' }));
    await sendMail({ to: 'guardian@example.com', subject: 'S', text: 'T' });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer re_test');
    expect(JSON.parse(String(init?.body))).toEqual({
      from: 'Jumps Lab <noreply@example.com>',
      to: ['guardian@example.com'],
      subject: 'S',
      text: 'T',
    });
  });

  it('断られたら投げる。誤りの文に宛先を入れない', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { name: 'validation_error', message: 'Invalid `to`: guardian@example.com' },
        { status: 422 },
      ),
    );
    const error = await sendMail({ to: 'guardian@example.com', subject: 'S', text: 'T' }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('validation_error');
    expect((error as Error).message).not.toContain('guardian@example.com');
  });

  it('本番でキーが無ければ、送らずに投げる（ログにも出さない）', async () => {
    env.RESEND_API_KEY = undefined;
    vi.stubEnv('NODE_ENV', 'production');
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    expect(mailReady()).toBe(false);
    await expect(sendMail({ to: 'g@example.com', subject: 'S', text: 'link' })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it('手元の開発でキーが無ければ、送らずに本文をログに出す', async () => {
    env.RESEND_API_KEY = undefined;
    vi.stubEnv('NODE_ENV', 'development');
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    expect(mailReady()).toBe(true);
    await sendMail({ to: 'g@example.com', subject: 'S', text: 'https://x/guardian-consent/t' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledOnce();
    expect(String(info.mock.calls[0]![0])).toContain('https://x/guardian-consent/t');
  });
});
