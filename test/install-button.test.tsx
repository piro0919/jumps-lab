// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ホーム画面に置くボタン（install-button.tsx）。出すかどうかと、押したときにブラウザの確認を出すか手順を案内するか。
 * ブラウザの仕組み（use-pwa）と iOS の案内の窓、文言は差し替える（vocafy の test/install-app.test.ts と同じ形）
 */

const pwa = vi.hoisted(() => ({
  canInstall: false,
  isInstalled: false,
  needsManualInstall: false,
  install: vi.fn(),
}));
vi.mock('use-pwa', () => ({ usePwa: () => pwa }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/dynamic', () => ({
  default: () => (props: { isShown: boolean }) =>
    props.isShown ? createElement('div', { role: 'dialog' }, 'guide') : null,
}));

const { InstallButton } = await import('@/components/install-button');

// vitest の globals を使っていないので、描いた部品はテストごとに自分で片付ける（残すと前の部品が重なる）
afterEach(cleanup);

beforeEach(() => {
  pwa.canInstall = false;
  pwa.isInstalled = false;
  pwa.needsManualInstall = false;
  pwa.install.mockReset();
});

const button = () => screen.queryByRole('button', { name: 'install' });

describe('InstallButton', () => {
  it('入れられないブラウザでは出さない', () => {
    render(createElement(InstallButton));
    expect(button()).toBeNull();
  });

  it('もう入れていれば出さない', () => {
    pwa.canInstall = true;
    pwa.isInstalled = true;
    render(createElement(InstallButton));
    expect(button()).toBeNull();
  });

  it('Chrome 系はブラウザの確認を出す', () => {
    pwa.canInstall = true;
    render(createElement(InstallButton));
    act(() => button()?.click());
    expect(pwa.install).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('iPhone と iPad は手順の案内を開く', () => {
    pwa.needsManualInstall = true;
    render(createElement(InstallButton));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => button()?.click());
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(pwa.install).not.toHaveBeenCalled();
  });
});
