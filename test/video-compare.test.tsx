// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
vi.mock('@/app/actions/videos', () => ({
  setVideoMarkAction,
  addVideoAngleAction: vi.fn(),
  deleteVideoAngleAction: vi.fn(),
}));

const { VideoCompare } = await import('@/components/video-compare');

afterEach(() => {
  cleanup();
  setVideoMarkAction.mockClear();
  vi.restoreAllMocks();
});

const a = {
  id: 'a',
  url: 'https://example.com/a.mp4',
  label: 'Oct 1',
  detail: 'practice',
  marks: {},
  angles: [],
};
const b = {
  id: 'b',
  url: 'https://example.com/b.mp4',
  label: 'Oct 2',
  detail: 'competition',
  marks: {},
  angles: [],
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
const videoEl = (key: 'a' | 'b') => screen.getByTestId(`compare-video-${key}`) as HTMLVideoElement;
/** 動画の長さを決めて、読み込めたことにする（happy-dom は動画を読まないので、長さを外から与える） */
const load = (key: 'a' | 'b', duration: number) => {
  const video = videoEl(key);
  Object.defineProperty(video, 'duration', { configurable: true, get: () => duration });
  fireEvent.loadedMetadata(video);
  return video;
};
const playButton = () => screen.getByRole('button', { name: 'play' }) as HTMLButtonElement;
/** 再生の繰り返し（requestAnimationFrame）を回さず、再生中の状態だけを作る */
const startPlaying = () => {
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 0);
  act(() => playButton().click());
  expect(screen.getByRole('button', { name: 'pause' })).not.toBeNull();
};

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
    const [switchA] = screen.getAllByRole('radiogroup', { name: 'markOf' });
    act(() => within(switchA!).getByRole('radio', { name: 'markShort.takeoff' }).click());
    const [markA] = screen.getAllByRole('button', { name: 'setMark' });
    await act(async () => markA!.click());

    expect(setVideoMarkAction).toHaveBeenCalledWith({ videoId: 'a', mark: 'takeoff', time: 1.234 });
    const row = screen.getByTestId('interval-step1-takeoff');
    expect(row.textContent).toContain('0.234');
    expect(row.textContent).toContain('0.25');
    expect(row.textContent).toContain('0.016');
    // 置いたあとは、次のまだ置いていない目印を選んでおく
    const [after] = screen.getAllByRole('radiogroup', { name: 'markOf' });
    expect(
      within(after!)
        .getAllByRole('radio')
        .filter((r) => r.getAttribute('aria-checked') === 'true')
        .map((r) => r.textContent),
    ).toEqual(['markShort.landing']);
  });

  it('目印は6つの中から1つだけを選ぶ切り替えで、選んだものだけが選ばれた形になる', () => {
    show();
    const [switchA] = screen.getAllByRole('radiogroup', { name: 'markOf' });
    const radios = within(switchA!).getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual([
      'markShort.start',
      'markShort.step3',
      'markShort.step2',
      'markShort.step1',
      'markShort.takeoff',
      'markShort.landing',
    ]);
    act(() => radios[3]!.click());
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual([
      'false',
      'false',
      'false',
      'true',
      'false',
      'false',
    ]);
  });

  it('2本の長さが分かるまで再生は押せない', () => {
    show();
    expect(playButton().disabled).toBe(true);
    load('a', 4);
    expect(playButton().disabled).toBe(true);
    load('b', 6);
    expect(playButton().disabled).toBe(false);
  });

  it('長さを持たない webm（Infinity）は終わりの先へ跳んで長さを読み、分かったら頭へ戻して再生できるようにする', () => {
    show();
    load('b', 6);
    const video = load('a', Number.POSITIVE_INFINITY);
    // 長さを決めさせるために、終わりの先へ跳ぶ。長さが分かるまでは再生できない
    expect(video.currentTime).toBeGreaterThan(1e6);
    expect(playButton().disabled).toBe(true);
    // 跳んでいる間の位置は、1本ごとの秒に出さない
    fireEvent.timeUpdate(video);
    expect(screen.getAllByText('seconds')).toHaveLength(2);

    Object.defineProperty(video, 'duration', { configurable: true, get: () => 4.2 });
    fireEvent.durationChange(video);
    expect(video.currentTime).toBe(0);
    expect(playButton().disabled).toBe(false);
    const [slider] = screen.getAllByRole('slider', { name: 'positionOf' }) as HTMLInputElement[];
    expect(slider!.max).toBe('4.2');
  });

  it('1本ごとのコマ送りは、続けて押すと押した数だけ進む（timeupdate を待たない）', () => {
    show();
    const video = load('a', 5);
    load('b', 5);
    video.currentTime = 1;
    const [next] = screen.getAllByRole('button', { name: 'nextFrameOf' });
    act(() => {
      next!.click();
      next!.click();
    });
    expect(video.currentTime).toBeCloseTo(1 + 2 / 30);
  });

  it('再生中に目印を置くと、見ていたコマの時刻を置き、その動画を時計へ戻さない', async () => {
    show();
    const video = load('a', 5);
    load('b', 5);
    startPlaying();
    // 時計（0）より先のコマを見ている
    video.currentTime = 1.2344;
    const [markA] = screen.getAllByRole('button', { name: 'setMark' });
    await act(async () => markA!.click());
    expect(setVideoMarkAction).toHaveBeenCalledWith({ videoId: 'a', mark: 'start', time: 1.234 });
    expect(video.currentTime).toBe(1.2344);
    // もう片方は、その位置に揃える
    expect(videoEl('b').currentTime).toBeCloseTo(1.2344);
  });

  it('再生中に合わせる点を置いても、その動画は見ていたコマから動かさない', () => {
    show();
    const video = load('a', 5);
    load('b', 5);
    startPlaying();
    video.currentTime = 2.5;
    const [syncA] = screen.getAllByRole('button', { name: 'setSync' });
    act(() => syncA!.click());
    expect(video.currentTime).toBe(2.5);
    expect(screen.getByRole('button', { name: 'play' })).not.toBeNull();
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
