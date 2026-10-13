// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * 2本の動画を見比べる部品（video-compare.tsx）。見せ方の切り替え（並べる・重ねる）、速さの切り替え、
 * 読み込めなかった動画の誤りの文。文言はキーのまま出す
 */

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ number: (value: number) => String(value) }),
}));

const { VideoCompare } = await import('@/components/video-compare');

afterEach(cleanup);

const a = { id: 'a', url: 'https://example.com/a.mp4', label: 'Oct 1', detail: 'practice' };
const b = { id: 'b', url: 'https://example.com/b.mp4', label: 'Oct 2', detail: 'competition' };

const show = () => render(createElement(VideoCompare, { a, b }));
const opacity = () => screen.queryByRole('slider', { name: 'opacity' });

describe('VideoCompare', () => {
  it('はじめは並べて見せ、重ねたときの濃さのつまみは出さない', () => {
    show();
    expect(screen.getByRole('radio', { name: 'side' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'overlay' }).getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(opacity()).toBeNull();
  });

  it('重ねるに切り替えると、B の濃さのつまみを出し、並べるに戻すと消す', () => {
    show();
    act(() => screen.getByRole('radio', { name: 'overlay' }).click());
    expect(screen.getByRole('radio', { name: 'overlay' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(opacity()).not.toBeNull();
    act(() => screen.getByRole('radio', { name: 'side' }).click());
    expect(opacity()).toBeNull();
  });

  it('見せ方を替えても同じ video 要素を使う（作り直すと読み込み直して位置が頭に戻る）', () => {
    show();
    const before = ['a', 'b'].map((key) => screen.getByTestId(`compare-video-${key}`));
    act(() => screen.getByRole('radio', { name: 'overlay' }).click());
    const after = ['a', 'b'].map((key) => screen.getByTestId(`compare-video-${key}`));
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
  });

  it('どちらの見せ方でも、2本とも音を消して画面の中で再生する', () => {
    show();
    act(() => screen.getByRole('radio', { name: 'overlay' }).click());
    const videos = ['a', 'b'].map((key) => screen.getByTestId(`compare-video-${key}`));
    expect(videos.map((v) => (v as HTMLVideoElement).muted)).toEqual([true, true]);
    expect(videos.map((v) => v.hasAttribute('playsinline'))).toEqual([true, true]);
    expect(videos.map((v) => v.hasAttribute('autoplay'))).toEqual([false, false]);
  });

  it('速さは1つだけ選べ、選んだものに切り替わる', () => {
    show();
    const speeds = screen.getAllByRole('radio').filter((r) => r.textContent === 'speedValue');
    expect(speeds).toHaveLength(3);
    expect(speeds.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    act(() => speeds[0]!.click());
    expect(speeds.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
  });

  it('読み込めなかった動画には誤りの文を出す', () => {
    show();
    expect(screen.queryByText('loadFailed')).toBeNull();
    fireEvent.error(screen.getByTestId('compare-video-b'));
    expect(screen.getAllByText('loadFailed')).toHaveLength(1);
  });
});
