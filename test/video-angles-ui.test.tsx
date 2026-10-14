// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Angle, AngleInput } from '@/lib/video-angles';
import { measure } from '@/lib/video-angles';

/**
 * 見比べる画面の角度の道具（video-compare.tsx と video-angles.tsx）。点を打つ・1点戻す・やめる、
 * 点が揃うまで保存できないこと、保存したものの一覧と A・B の比較、削除。文言はキーのまま出す
 */

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ number: (value: number) => String(value) }),
}));

let nextId = 0;
/** 保存。サーバーと同じく点から度数を求め直して返す（送られた度数は無い） */
const addVideoAngleAction = vi.fn(async (input: AngleInput) => {
  const degrees = measure(input.kind, input.points, {
    width: input.frameWidth,
    height: input.frameHeight,
  });
  nextId += 1;
  return {
    ok: true as const,
    angle: {
      id: `saved-${nextId}`,
      name: input.name,
      kind: input.kind,
      time: input.time,
      points: input.points,
      frameWidth: input.frameWidth,
      frameHeight: input.frameHeight,
      degrees: degrees ?? 0,
    } satisfies Angle,
  };
});
const deleteVideoAngleAction = vi.fn(async (id: string) => ({ ok: id.length > 0 }));
vi.mock('@/app/actions/videos', () => ({
  setVideoMarkAction: vi.fn(),
  addVideoAngleAction,
  deleteVideoAngleAction,
}));

const { VideoCompare } = await import('@/components/video-compare');

afterEach(() => {
  cleanup();
  addVideoAngleAction.mockClear();
  deleteVideoAngleAction.mockClear();
});

const saved = (extra: Partial<Angle> = {}): Angle => ({
  id: 'b-knee',
  name: 'knee',
  kind: 'angle',
  time: 0,
  points: [
    { x: 0.5, y: 0.2 },
    { x: 0.5, y: 0.5 },
    { x: 0.8, y: 0.5 },
  ],
  frameWidth: 1000,
  frameHeight: 1000,
  degrees: 100,
  ...extra,
});

const show = (angles: { a?: Angle[]; b?: Angle[] } = {}) =>
  render(
    createElement(VideoCompare, {
      a: {
        id: 'a',
        url: 'https://example.com/a.mp4',
        label: 'Oct 1',
        detail: '',
        marks: {},
        angles: angles.a ?? [],
      },
      b: {
        id: 'b',
        url: 'https://example.com/b.mp4',
        label: 'Oct 2',
        detail: '',
        marks: {},
        angles: angles.b ?? [],
      },
    }),
  );

/**
 * 動画を読み込めたことにする。本来の大きさ（frame）と画面の大きさ（box）を与える
 * （happy-dom は動画を読まず、要素の大きさも 0 なので外から与える）
 */
const load = (
  key: 'a' | 'b',
  frame = { width: 1000, height: 1000 },
  box = { width: 200, height: 200 },
) => {
  const video = screen.getByTestId(`compare-video-${key}`) as HTMLVideoElement;
  const define = (name: string, value: number) =>
    Object.defineProperty(video, name, { configurable: true, get: () => value });
  define('duration', 5);
  define('videoWidth', frame.width);
  define('videoHeight', frame.height);
  define('clientWidth', box.width);
  define('clientHeight', box.height);
  fireEvent.loadedMetadata(video);
  return video;
};

/** 打つための SVG。押した所の計算に使う箱の位置と大きさを与える */
const stage = (box = { width: 200, height: 200 }) => {
  const svg = screen.getByRole('button', { name: 'placeOn' });
  svg.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: box.width, height: box.height }) as DOMRect;
  return svg;
};
const tap = (svg: HTMLElement, x: number, y: number) =>
  act(() => {
    fireEvent.click(svg, { clientX: x, clientY: y });
  });
const measureButton = (key: 'a' | 'b') =>
  screen.getAllByRole('button', { name: 'measure' })[key === 'a' ? 0 : 1] as HTMLButtonElement;
const saveButton = () => screen.getByRole('button', { name: 'saveAngle' }) as HTMLButtonElement;
const draft = () => screen.queryByTestId('angle-draft');

describe('角度の道具', () => {
  it('動画の大きさが分かるまで測り始められない', () => {
    show();
    expect(measureButton('a').disabled).toBe(true);
    load('a');
    expect(measureButton('a').disabled).toBe(false);
  });

  it('3点を打つまで保存できず、1点戻すと打ち直せ、揃えば度数を出して保存する（度数は送らない）', async () => {
    show();
    load('a');
    act(() => measureButton('a').click());
    const svg = stage();
    tap(svg, 100, 40);
    tap(svg, 100, 100);
    expect(saveButton().disabled).toBe(true);
    // 間違えた点を戻して打ち直す
    tap(svg, 20, 20);
    expect(saveButton().disabled).toBe(false);
    act(() => screen.getByRole('button', { name: 'undoPoint' }).click());
    expect(saveButton().disabled).toBe(true);
    tap(svg, 160, 100);
    expect(saveButton().disabled).toBe(false);
    // 4点目は受けない
    tap(svg, 10, 10);
    expect(within(draft()!).getByText('90')).not.toBeNull();
    expect(svg.querySelectorAll('circle')).toHaveLength(3);

    const video = screen.getByTestId('compare-video-a') as HTMLVideoElement;
    video.currentTime = 1.2344;
    await act(async () => saveButton().click());
    expect(addVideoAngleAction).toHaveBeenCalledWith({
      videoId: 'a',
      name: 'knee',
      kind: 'angle',
      time: 1.234,
      points: [
        { x: 0.5, y: 0.2 },
        { x: 0.5, y: 0.5 },
        { x: 0.8, y: 0.5 },
      ],
      frameWidth: 1000,
      frameHeight: 1000,
    });
    expect(draft()).toBeNull();
    expect(screen.getByTestId('angle-knee-angle-1').textContent).toContain('90');
  });

  it('動画の外の帯（レターボックス）を押しても点にしない', () => {
    show();
    // 正方形の動画を横長の箱に入れると、左右 100px が帯になる
    load('a', { width: 1000, height: 1000 }, { width: 400, height: 200 });
    act(() => measureButton('a').click());
    const svg = stage({ width: 400, height: 200 });
    tap(svg, 50, 100);
    expect(svg.querySelectorAll('circle')).toHaveLength(0);
    tap(svg, 200, 100);
    expect(svg.querySelectorAll('circle')).toHaveLength(1);
  });

  it('垂直からの傾きは2点で保存できる', async () => {
    show();
    load('a');
    const [kindA] = screen.getAllByRole('radiogroup', { name: 'kindOf' });
    act(() => within(kindA!).getByRole('radio', { name: 'kinds.lean' }).click());
    const [nameA] = screen.getAllByRole('radiogroup', { name: 'angleNameOf' });
    act(() => within(nameA!).getByRole('radio', { name: 'angleNames.trunk' }).click());
    act(() => measureButton('a').click());
    const svg = stage();
    tap(svg, 100, 160);
    expect(saveButton().disabled).toBe(true);
    tap(svg, 140, 120);
    expect(within(draft()!).getByText('45')).not.toBeNull();
    await act(async () => saveButton().click());
    expect(addVideoAngleAction.mock.calls[0]?.[0]).toMatchObject({ name: 'trunk', kind: 'lean' });
  });

  it('やめると打った点を捨て、何も保存しない', () => {
    show();
    load('a');
    act(() => measureButton('a').click());
    tap(stage(), 100, 100);
    act(() => screen.getByRole('button', { name: 'cancelAngle' }).click());
    expect(draft()).toBeNull();
    expect(screen.queryByRole('button', { name: 'placeOn' })).toBeNull();
    expect(addVideoAngleAction).not.toHaveBeenCalled();
  });

  it('保存している間の2回目の押下は送らない', async () => {
    show();
    load('a');
    act(() => measureButton('a').click());
    const svg = stage();
    tap(svg, 100, 40);
    tap(svg, 100, 100);
    tap(svg, 160, 100);
    await act(async () => {
      saveButton().click();
      saveButton().click();
    });
    expect(addVideoAngleAction).toHaveBeenCalledTimes(1);
  });

  it('保存できなかったら誤りを出し、打った点は残す', async () => {
    show();
    load('a');
    addVideoAngleAction.mockRejectedValueOnce(new Error('offline'));
    act(() => measureButton('a').click());
    const svg = stage();
    tap(svg, 100, 40);
    tap(svg, 100, 100);
    tap(svg, 160, 100);
    await act(async () => saveButton().click());
    expect(within(draft()!).getByText('generic')).not.toBeNull();
    expect(svg.querySelectorAll('circle')).toHaveLength(3);
  });

  it('保存した測定は、そのコマにいるときだけ動画に重ね、A と B を同じ名前どうしで比べる', () => {
    show({ a: [saved({ id: 'a-knee', degrees: 150 })], b: [saved({ time: 2, degrees: 162 })] });
    load('a');
    load('b');
    // A は 0 秒（今のコマ）に測ったので描き、B は 2 秒なので描かない
    expect(screen.getAllByRole('img', { name: 'anglesOn' })).toHaveLength(1);
    const row = screen.getByTestId('angle-knee-angle-1');
    expect(row.textContent).toContain('150');
    expect(row.textContent).toContain('162');
    expect(row.textContent).toContain('12');
  });

  it('一覧の行を押すとそのコマへ動かし、ごみ箱から確かめて消す', async () => {
    show({ b: [saved({ time: 2 })] });
    load('b');
    act(() => screen.getByRole('button', { name: /angleLabel/ }).click());
    expect((screen.getByTestId('compare-video-b') as HTMLVideoElement).currentTime).toBe(2);

    act(() => screen.getByRole('button', { name: 'removeAngle' }).click());
    expect(deleteVideoAngleAction).not.toHaveBeenCalled();
    await act(async () => screen.getByRole('button', { name: 'ok' }).click());
    expect(deleteVideoAngleAction).toHaveBeenCalledWith('b-knee');
    expect(screen.queryByTestId('angle-knee-angle-1')).toBeNull();
    expect(screen.getByText('noAngles')).not.toBeNull();
  });
});
