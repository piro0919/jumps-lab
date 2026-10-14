// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * 大会の取り込みの入力（src/components/meet-import.tsx）。読み取り元を切り替えるとファイルの欄は作り直されて空になるので、
 * 選んでいたファイルも忘れる（空の欄のまま、前のファイルを送らない）
 */

vi.mock('@/app/actions/meet-import', () => ({ importMeetsAction: vi.fn() }));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ dateTime: () => 'Oct 14' }),
}));

const { MeetImport } = await import('@/components/meet-import');

afterEach(cleanup);

describe('MeetImport', () => {
  it('ファイルを選んでから URL に切り替えて戻ると、読み込みのボタンは押せない', () => {
    render(createElement(MeetImport, { added: [] }));
    const read = screen.getByRole('button', { name: 'read' });
    fireEvent.click(screen.getByRole('radio', { name: 'fromFile' }));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, {
      target: { files: [new File(['%PDF-1.4'], 'a.pdf', { type: 'application/pdf' })] },
    });
    const afterPick = (read as HTMLButtonElement).disabled;
    fireEvent.click(screen.getByRole('radio', { name: 'fromUrl' }));
    fireEvent.click(screen.getByRole('radio', { name: 'fromFile' }));
    expect({ afterPick, afterSwitch: (read as HTMLButtonElement).disabled }).toEqual({
      afterPick: false,
      afterSwitch: true,
    });
  });
});
