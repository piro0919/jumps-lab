// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 招待の画面の下の部分（src/components/team-join.tsx）。
 * 16歳以上は「同意して参加」、16歳未満は保護者の欄だけ（本人のボタンを出さない）、
 * 生年月日の無い人は「16歳以上ですか」を先に聞く。保護者へのお願いは、チームへの参加として招待の鍵と一緒に送る
 */

const actions = vi.hoisted(() => ({
  joinTeamAction: vi.fn<
    (previous: unknown, formData: FormData) => Promise<{ ok: true } | { ok: false; error: string }>
  >(async () => ({ ok: true })),
  sendGuardianRequestAction: vi.fn<(formData: FormData) => Promise<{ ok: true }>>(async () => ({
    ok: true,
  })),
}));
vi.mock('@/app/actions/teams', () => ({ joinTeamAction: actions.joinTeamAction }));
vi.mock('@/app/actions/guardian', () => ({
  sendGuardianRequestAction: actions.sendGuardianRequestAction,
}));
vi.mock('@/app/actions/menu', () => ({ consentAiAction: vi.fn() }));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));

const { TeamJoinChoice } = await import('@/components/team-join');

afterEach(cleanup);

beforeEach(() => {
  actions.joinTeamAction.mockClear();
  actions.sendGuardianRequestAction.mockClear();
});

type Props = Parameters<typeof TeamJoinChoice>[0];
const show = (props: Partial<Props> = {}) =>
  render(
    createElement(TeamJoinChoice, {
      token: 'invite-token',
      team: 'Hawks',
      consenter: 'self',
      askAge: false,
      request: null,
      linkDays: 7,
      ...props,
    }),
  );

const button = (name: string) => screen.queryByRole('button', { name });

/** 送ったフォームの値 */
const sent = (call: unknown[] | undefined) =>
  Object.fromEntries((call?.at(-1) as FormData).entries());

describe('TeamJoinChoice', () => {
  it('16歳以上は「同意して参加」だけで、押すと招待の鍵を送る', async () => {
    show();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    await act(async () => button('join')!.click());
    expect(actions.joinTeamAction).toHaveBeenCalledTimes(1);
    expect(sent(actions.joinTeamAction.mock.calls[0])).toEqual({ token: 'invite-token' });
  });

  it('16歳未満は本人のボタンを出さず、保護者の欄だけ', () => {
    show({ consenter: 'guardian' });
    expect(button('join')).toBeNull();
    expect(screen.getByRole('textbox')).not.toBeNull();
    expect(screen.getByText(/^guardianNeeded/)).not.toBeNull();
  });

  it('保護者へのお願いは、チームへの参加として招待の鍵と一緒に送る', async () => {
    show({ consenter: 'guardian', request: { email: 'p***@example.com', live: true } });
    await act(async () => button('resend')!.click());
    expect(sent(actions.sendGuardianRequestAction.mock.calls[0])).toEqual({
      purpose: 'team',
      token: 'invite-token',
    });
    expect(actions.joinTeamAction).not.toHaveBeenCalled();
  });

  it('生年月日の無い人は、答えるまでどちらも出さない', () => {
    show({ consenter: 'ask', askAge: true });
    expect(screen.getByRole('radiogroup', { name: 'ageQuestion' })).not.toBeNull();
    expect(button('join')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('「はい」で参加のボタン（16歳以上と答えたことも送る）、「いいえ」で保護者の欄', async () => {
    show({ consenter: 'ask', askAge: true });
    act(() => screen.getByRole('radio', { name: 'ageYes' }).click());
    await act(async () => button('join')!.click());
    expect(sent(actions.joinTeamAction.mock.calls[0])).toEqual({
      token: 'invite-token',
      adult: 'yes',
    });

    act(() => screen.getByRole('radio', { name: 'ageNo' }).click());
    expect(button('join')).toBeNull();
    expect(screen.getByRole('textbox')).not.toBeNull();
  });

  it('サーバーが保護者の同意が要ると断ったら、保護者の欄に切り替える', async () => {
    actions.joinTeamAction.mockResolvedValueOnce({ ok: false, error: 'teamNeedsGuardian' });
    show();
    await act(async () => button('join')!.click());
    expect([button('join'), screen.queryByRole('textbox') !== null]).toEqual([null, true]);
  });

  it('サーバーが16歳以上かを聞くと断ったら、年齢の問いに切り替える', async () => {
    actions.joinTeamAction.mockResolvedValueOnce({ ok: false, error: 'teamAskAge' });
    show();
    await act(async () => button('join')!.click());
    expect([
      button('join'),
      screen.queryByRole('radiogroup', { name: 'ageQuestion' }) !== null,
    ]).toEqual([null, true]);
    act(() => screen.getByRole('radio', { name: 'ageYes' }).click());
    await act(async () => button('join')!.click());
    expect(sent(actions.joinTeamAction.mock.calls.at(-1))).toEqual({
      token: 'invite-token',
      adult: 'yes',
    });
  });
});
