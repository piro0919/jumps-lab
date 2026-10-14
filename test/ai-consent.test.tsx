// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * AI コーチの同意の画面の下の部分（src/components/ai-consent.tsx）。
 * 生年月日の無い人には「16歳以上ですか」を先に聞き、答えで同意のボタンか保護者の欄を出す。
 * 保護者の欄は、メールアドレスの形になるまで送れない。送ったあとは宛先（伏せたもの）と送り直しを出す
 */

const actions = vi.hoisted(() => ({
  consentAiAction: vi.fn<(formData: FormData) => Promise<{ ok: true }>>(async () => ({
    ok: true,
  })),
  sendGuardianRequestAction: vi.fn<(formData: FormData) => Promise<{ ok: true }>>(async () => ({
    ok: true,
  })),
}));
vi.mock('@/app/actions/menu', () => ({ consentAiAction: actions.consentAiAction }));
vi.mock('@/app/actions/guardian', () => ({
  sendGuardianRequestAction: actions.sendGuardianRequestAction,
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));

const { AiConsentChoice } = await import('@/components/ai-consent');

afterEach(cleanup);

beforeEach(() => {
  actions.consentAiAction.mockClear();
  actions.sendGuardianRequestAction.mockClear();
});

type Props = Parameters<typeof AiConsentChoice>[0];
const show = (props: Partial<Props> = {}) =>
  render(
    createElement(AiConsentChoice, {
      consenter: 'self',
      askAge: false,
      request: null,
      linkDays: 7,
      ...props,
    }),
  );

const button = (name: string) => screen.queryByRole('button', { name });

describe('AiConsentChoice', () => {
  it('16歳以上（生年月日あり）は、聞かずに同意のボタンだけ', () => {
    show();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(button('agree')).not.toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('生年月日の無い人は、答えるまでどちらも出さない', () => {
    show({ consenter: 'ask', askAge: true });
    expect(screen.getByRole('radiogroup', { name: 'ageQuestion' })).not.toBeNull();
    expect(button('agree')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('「はい」で同意のボタン、「いいえ」で保護者の欄', () => {
    show({ consenter: 'ask', askAge: true });
    act(() => screen.getByRole('radio', { name: 'ageYes' }).click());
    expect(screen.getByRole('radio', { name: 'ageYes' }).getAttribute('aria-checked')).toBe('true');
    expect(button('agree')).not.toBeNull();
    act(() => screen.getByRole('radio', { name: 'ageNo' }).click());
    expect(button('agree')).toBeNull();
    expect(screen.getByRole('textbox')).not.toBeNull();
  });

  it('前に答えた人は、その答えを選んだ状態で出す', () => {
    show({ consenter: 'guardian', askAge: true });
    expect(screen.getByRole('radio', { name: 'ageNo' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('textbox')).not.toBeNull();
  });

  it('「はい」で同意すると、答えも一緒に送る', async () => {
    show({ consenter: 'ask', askAge: true });
    act(() => screen.getByRole('radio', { name: 'ageYes' }).click());
    await act(async () => {
      button('agree')!.click();
    });
    expect(actions.consentAiAction).toHaveBeenCalledOnce();
    expect(actions.consentAiAction.mock.calls[0]![0].get('adult')).toBe('yes');
  });
});

describe('保護者の欄', () => {
  const type = (value: string) =>
    act(() => {
      fireEvent.change(screen.getByRole('textbox'), { target: { value } });
    });

  it('メールアドレスの形になるまで送れない', () => {
    show({ consenter: 'guardian' });
    const send = () => button('send') as HTMLButtonElement;
    expect(send().disabled).toBe(true);
    type('parent');
    expect(send().disabled).toBe(true);
    type('parent@example');
    expect(send().disabled).toBe(true);
    type('parent@example.com');
    expect(send().disabled).toBe(false);
  });

  it('送ると、打った宛先と「16歳未満」の答えを送る', async () => {
    show({ consenter: 'ask', askAge: true });
    act(() => screen.getByRole('radio', { name: 'ageNo' }).click());
    type('parent@example.com');
    await act(async () => {
      button('send')!.click();
    });
    const sent = actions.sendGuardianRequestAction.mock.calls[0]![0];
    expect(sent.get('email')).toBe('parent@example.com');
    expect(sent.get('adult')).toBe('no');
  });

  it('送ったあとは、伏せた宛先と送り直し・宛先を変えるボタン', async () => {
    show({ consenter: 'guardian', request: { email: 'p***@example.com', live: true } });
    expect(screen.getByText('sent {"email":"p***@example.com","days":7}')).not.toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    // 送り直しは宛先を送らない（サーバーが前の宛先を使う）
    await act(async () => {
      button('resend')!.click();
    });
    expect(actions.sendGuardianRequestAction.mock.calls[0]![0].has('email')).toBe(false);
    act(() => button('changeEmail')!.click());
    expect(screen.getByRole('textbox')).not.toBeNull();
  });

  it('期限が切れたお願いは、切れたと出す', () => {
    show({ consenter: 'guardian', request: { email: 'p***@example.com', live: false } });
    expect(screen.getByText('expired {"email":"p***@example.com"}')).not.toBeNull();
  });
});
