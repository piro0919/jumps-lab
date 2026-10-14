// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 設定の「アカウントを削除」（delete-account-button.tsx）。メールをそのまま打つまで消すボタンは押せず、
 * 二度押しでも1回しか頼まない。断られたら（stale）ログインし直すボタンを出す。
 * 削除の中身（src/lib/sign-out.ts の deleteAccount）と Google のボタン、文言は差し替える
 */

const EMAIL = 'athlete@example.com';

const account = vi.hoisted(() => ({
  deleteAccount: vi.fn<() => Promise<'deleted' | 'stale' | 'failed'>>(),
}));
vi.mock('@/lib/sign-out', () => account);
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/app/sign-in/google-button', () => ({
  GoogleButton: () => createElement('button', { type: 'button' }, 'google'),
}));

const { DeleteAccountButton } = await import('@/components/delete-account-button');

afterEach(cleanup);

beforeEach(() => {
  account.deleteAccount.mockReset();
});

/** 設定のボタンを押して確認の窓を開き、入力欄と消すボタンを返す */
function openDialog() {
  render(createElement(DeleteAccountButton, { email: EMAIL }));
  act(() => screen.getByRole('button', { name: 'deleteAccount' }).click());
  return {
    input: screen.getByRole('textbox') as HTMLInputElement,
    confirm: () => screen.getByRole('button', { name: 'ok' }) as HTMLButtonElement,
  };
}

const type = (input: HTMLInputElement, value: string) =>
  act(() => {
    fireEvent.change(input, { target: { value } });
  });

describe('DeleteAccountButton', () => {
  it('メールをそのまま打つまで、消すボタンは押せない', () => {
    const { input, confirm } = openDialog();
    expect(confirm().disabled).toBe(true);
    type(input, 'athlete@example.co');
    expect(confirm().disabled).toBe(true);
    type(input, 'ATHLETE@example.com');
    expect(confirm().disabled).toBe(true);
    type(input, EMAIL);
    expect(confirm().disabled).toBe(false);
  });

  it('合わないまま Enter で送っても頼まない', async () => {
    const { input } = openDialog();
    type(input, 'someone@example.com');
    await act(async () => {
      fireEvent.submit(input.form!);
    });
    expect(account.deleteAccount).not.toHaveBeenCalled();
  });

  it('二度押し（ボタンと Enter）でも1回しか頼まない', async () => {
    let finish: (result: 'failed') => void = () => {};
    account.deleteAccount.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { input, confirm } = openDialog();
    type(input, EMAIL);
    await act(async () => {
      confirm().click();
      fireEvent.submit(input.form!);
      fireEvent.submit(input.form!);
    });
    expect(account.deleteAccount).toHaveBeenCalledTimes(1);
    await act(async () => finish('failed'));
    expect(screen.getByText('deleteAccountFailed')).toBeTruthy();
  });

  it('ログインからの時間で断られたら、ログインし直すボタンを出し、消すボタンは隠す', async () => {
    account.deleteAccount.mockResolvedValue('stale');
    const { input, confirm } = openDialog();
    type(input, EMAIL);
    await act(async () => confirm().click());
    expect(screen.getByText('deleteAccountStale')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'google' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'ok' })).toBeNull();
  });
});
