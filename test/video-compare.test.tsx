// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * 2本の動画を見比べる部品（video-compare.tsx）。見せ方の切り替え（並べる・重ねる）、速さの切り替え、
 * 読み込めなかった動画の誤りの文、時間の目印を置く・外すと、あいだの時間。文言はキーのまま出す
 */

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ number: (value: number) => String(value) }),
}));

/** 目印の保存。置いた後の目印を返す（DB の代わりに、ここで持つ） */
const saved: Record<string, Record<string, number>> = {};
const setVideoMarkAction = vi.fn(
  async ({ videoId, mark, time }: { videoId: string; mark: string; time: number | null }) => {
    const marks = { ...saved[videoId] };
    if (time === null) delete marks[mark];
    else marks[mark] = time;
    saved[videoId] = marks;
    return { ok: true as const, marks };
  },
);
vi.mock('@/app/actions/videos', () => ({ setVideoMarkAction }));

const { VideoCompare } = await import('@/components/video-compare');

afterEach(() => {
  cleanup();
  setVideoMarkAction.mockClear();
});

const a = {
  id: 'a',
  url: 'https://example.com/a.mp4',
  label: 'Oct 1',
  detail: 'practice',
  marks: {},
};
const b = {
  id: 'b',
  url: 'https://example.com/b.mp4',
  label: 'Oct 2',
  detail: 'competition',
  marks: {},
};

const show = (marks: { a?: Record<string, number>; b?: Record<string, number> } = {}) => {
  saved.a = { ...marks.a };
  saved.b = { ...marks.b };
  return render(
    createElement(VideoCompare, {
      a: { ...a, marks: marks.a ?? {} },
      b: { ...b, marks: marks.b ?? {} },
    }),
  );
};
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

  it('選んだ目印を今の位置に置き、両方にあるあいだの時間と B − A を出す', async () => {
    show({ a: { step1: 1 }, b: { step1: 1.1, takeoff: 1.35 } });
    // B にしかないあいだは、A を空にして出す
    expect(screen.getByTestId('interval-step1-takeoff').textContent).toContain('—');

    const video = screen.getByTestId('compare-video-a') as HTMLVideoElement;
    video.currentTime = 1.2344;
    const [selectA] = screen.getAllByRole('combobox', { name: 'markOf' });
    fireEvent.change(selectA!, { target: { value: 'takeoff' } });
    const [markA] = screen.getAllByRole('button', { name: 'setMark' });
    await act(async () => markA!.click());

    expect(setVideoMarkAction).toHaveBeenCalledWith({ videoId: 'a', mark: 'takeoff', time: 1.234 });
    const row = screen.getByTestId('interval-step1-takeoff');
    expect(row.textContent).toContain('0.234');
    expect(row.textContent).toContain('0.25');
    expect(row.textContent).toContain('0.016');
    // 置いたあとは、次のまだ置いていない目印を選んでおく
    expect(
      (screen.getAllByRole('combobox', { name: 'markOf' })[0] as HTMLSelectElement).value,
    ).toBe('landing');
  });

  it('目印を外すと、そのあいだの時間を消す', async () => {
    show({ a: { step1: 1, takeoff: 1.25 } });
    expect(screen.getByTestId('interval-step1-takeoff').textContent).toContain('0.25');
    const [remove] = screen.getAllByRole('button', { name: 'removeMark' });
    await act(async () => remove!.click());
    expect(setVideoMarkAction).toHaveBeenCalledWith({ videoId: 'a', mark: 'step1', time: null });
    expect(screen.queryByTestId('interval-step1-takeoff')).toBeNull();
    expect(screen.getByText('noTiming')).not.toBeNull();
  });

  it('保存している間の2回目の押下は送らない', async () => {
    show();
    const [markA] = screen.getAllByRole('button', { name: 'setMark' });
    await act(async () => {
      markA!.click();
      markA!.click();
    });
    expect(setVideoMarkAction).toHaveBeenCalledTimes(1);
  });

  it('保存できなかったら誤りを出す', async () => {
    show();
    setVideoMarkAction.mockRejectedValueOnce(new Error('offline'));
    const [markA] = screen.getAllByRole('button', { name: 'setMark' });
    await act(async () => markA!.click());
    expect(screen.getByText('generic')).not.toBeNull();
  });
});
