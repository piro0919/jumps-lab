import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  angleAt,
  angleInputSchema,
  atFrame,
  compareAngles,
  contentBox,
  leanFromVertical,
  measure,
  placeLabels,
  toDisplay,
  toNormalized,
  wholeDegrees,
  type Angle,
  type LabelBox,
} from '@/lib/video-angles';

/** 動画の上で手で測る角度の計算と、画面の位置と動画の中の割合の行き来（src/lib/video-angles.ts） */

describe('angleAt', () => {
  it('真ん中の点での角度を 0〜180° で出す', () => {
    const vertex = { x: 0, y: 0 };
    const results = [
      angleAt({ x: 1, y: 0 }, vertex, { x: 0, y: 1 }),
      angleAt({ x: 1, y: 0 }, vertex, { x: -1, y: 0 }),
      angleAt({ x: 1, y: 0 }, vertex, { x: 2, y: 0 }),
      angleAt({ x: 1, y: 0 }, vertex, { x: 1, y: 1 }),
      // 打つ向き（時計回りか反時計回りか）で変わらない
      angleAt({ x: 0, y: 1 }, vertex, { x: 1, y: 0 }),
    ];
    expect(results.map((v) => (v === null ? null : Math.round(v * 1000) / 1000))).toEqual([
      90, 180, 0, 45, 90,
    ]);
  });

  it('端の点が真ん中の点と重なれば決まらない', () => {
    expect(angleAt({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 })).toBeNull();
  });
});

describe('leanFromVertical', () => {
  it('垂直からの傾きを向きを付けずに 0〜90° で出す', () => {
    const results = [
      leanFromVertical({ x: 0, y: 0 }, { x: 0, y: 1 }),
      leanFromVertical({ x: 0, y: 0 }, { x: 1, y: 1 }),
      leanFromVertical({ x: 0, y: 0 }, { x: -1, y: 1 }),
      leanFromVertical({ x: 0, y: 1 }, { x: 1, y: 0 }),
      leanFromVertical({ x: 0, y: 0 }, { x: 1, y: 0 }),
    ];
    expect(results.map((v) => (v === null ? null : Math.round(v * 1000) / 1000))).toEqual([
      0, 45, 45, 45, 90,
    ]);
  });

  it('2点が重なれば決まらない', () => {
    expect(leanFromVertical({ x: 0.2, y: 0.2 }, { x: 0.2, y: 0.2 })).toBeNull();
  });
});

describe('measure', () => {
  it('割合ではなく、本来の幅と高さを掛けたピクセルの上で角度を出す', () => {
    // 縦長 1080×1920 の動画で、割合では 45° に見える2本の線: 横へ 0.1 は 108px、縦へ 0.1 は 192px
    const points = [
      { x: 0.6, y: 0.5 },
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.4 },
    ];
    expect(measure('angle', points, { width: 1080, height: 1920 })).toBe(90);
    const lean = measure(
      'lean',
      [
        { x: 0.5, y: 0.5 },
        { x: 0.6, y: 0.4 },
      ],
      { width: 1080, height: 1920 },
    );
    // atan(108 / 192) = 29.36°
    expect(lean).toBe(29.4);
  });

  it('点の数が測り方と合わない・点が重なる・大きさが分からないときは null', () => {
    const p = { x: 0.1, y: 0.1 };
    const q = { x: 0.2, y: 0.3 };
    expect([
      measure('angle', [p, q], { width: 100, height: 100 }),
      measure('lean', [p, q, q], { width: 100, height: 100 }),
      measure('lean', [p, p], { width: 100, height: 100 }),
      measure('lean', [p, q], { width: 0, height: 100 }),
    ]).toEqual([null, null, null, null]);
  });
});

describe('contentBox と位置の行き来', () => {
  it('縦長の動画を横長の箱に入れると、左右に同じ幅の帯が空く', () => {
    expect(contentBox({ width: 400, height: 300 }, { width: 1080, height: 1920 })).toEqual({
      x: 115.625,
      y: 0,
      width: 168.75,
      height: 300,
    });
  });

  it('横長の動画を縦長の箱に入れると、上下に帯が空く', () => {
    expect(contentBox({ width: 300, height: 400 }, { width: 1920, height: 1080 })).toEqual({
      x: 0,
      y: 115.625,
      width: 300,
      height: 168.75,
    });
  });

  it('箱の上の位置を割合にし、割合から同じ位置へ戻す', () => {
    const box = { width: 400, height: 300 };
    const frame = { width: 1080, height: 1920 };
    const point = toNormalized(200, 150, box, frame);
    expect(point).toEqual({ x: 0.5, y: 0.5 });
    expect(toDisplay({ x: 0.25, y: 0.75 }, box, frame)).toEqual({ x: 157.8125, y: 225 });
    expect(toNormalized(157.8125, 225, box, frame)).toEqual({ x: 0.25, y: 0.75 });
  });

  it('同じ割合の点は、箱の大きさが変わっても絵の同じ所に来る', () => {
    const frame = { width: 1920, height: 1080 };
    const point = { x: 0.3, y: 0.6 };
    const small = toDisplay(point, { width: 390, height: 300 }, frame);
    const large = toDisplay(point, { width: 1280, height: 720 }, frame);
    // それぞれの絵の左上からの割合が同じ
    const smallBox = contentBox({ width: 390, height: 300 }, frame)!;
    const largeBox = contentBox({ width: 1280, height: 720 }, frame)!;
    expect([
      (small!.x - smallBox.x) / smallBox.width,
      (large!.x - largeBox.x) / largeBox.width,
    ]).toEqual([0.3, 0.3]);
    expect((small!.y - smallBox.y) / smallBox.height).toBeCloseTo(0.6);
    expect((large!.y - largeBox.y) / largeBox.height).toBeCloseTo(0.6);
  });

  it('帯の上を押しても点にしない。大きさが分からなければ何もしない', () => {
    const box = { width: 400, height: 300 };
    const frame = { width: 1080, height: 1920 };
    expect([
      toNormalized(50, 150, box, frame),
      toNormalized(390, 150, box, frame),
      toNormalized(200, 150, { width: 0, height: 0 }, frame),
      toDisplay({ x: 0.5, y: 0.5 }, box, { width: 0, height: 0 }),
    ]).toEqual([null, null, null, null]);
  });
});

describe('atFrame', () => {
  it('測ったコマから1コマ以内なら描く', () => {
    expect([
      atFrame(1.5, 1.5, 30),
      atFrame(1.5, 1.533, 30),
      atFrame(1.5, 1.534, 30),
      atFrame(1.5, 1.6, 30),
      atFrame(1.5, 1.516, 60),
      atFrame(1.5, 1.52, 60),
    ]).toEqual([true, true, false, false, true, false]);
  });
});

const angle = (name: Angle['name'], kind: Angle['kind'], time: number, degrees: number): Angle => ({
  id: randomUUID(),
  name,
  kind,
  time,
  degrees,
  points: [],
  frameWidth: 100,
  frameHeight: 100,
});

describe('compareAngles', () => {
  it('同じ名前・同じ測り方どうしを並べ、両方あるときだけ B − A を出す', () => {
    const rows = compareAngles(
      [angle('knee', 'angle', 1, 150), angle('trunk', 'lean', 1, 10)],
      [angle('knee', 'angle', 2, 162.5), angle('knee', 'lean', 2, 5)],
    );
    expect(rows.map(({ key, a, b, diff }) => ({ key, a, b, diff }))).toEqual([
      { key: 'knee-angle-1', a: 150, b: 162.5, diff: 13 },
      { key: 'knee-lean-1', a: null, b: 5, diff: null },
      { key: 'trunk-lean-1', a: 10, b: null, diff: null },
    ]);
  });

  it('B − A は画面に出す整数の A と B の差にする（0.1° の差を丸めると、見えている A と B と食い違う）', () => {
    const cases = [
      [10.4, 10.6],
      [10.6, 11.4],
      [150.5, 150.4],
    ] as const;
    const rows = cases.map(
      ([a, b]) => compareAngles([angle('knee', 'angle', 1, a)], [angle('knee', 'angle', 1, b)])[0],
    );
    // 見えている数は 10 と 11、11 と 11、151 と 150
    expect(rows.map((row) => row?.diff)).toEqual([1, 0, -1]);
    expect(
      rows.map((row) =>
        row && row.a !== null && row.b !== null ? wholeDegrees(row.b) - wholeDegrees(row.a) : null,
      ),
    ).toEqual(rows.map((row) => row?.diff));
  });

  it('同じものがいくつもあれば、時刻の順に1番目どうし、2番目どうしを比べる', () => {
    const rows = compareAngles(
      [angle('knee', 'angle', 2, 140), angle('knee', 'angle', 1, 160)],
      [angle('knee', 'angle', 5, 165)],
    );
    expect(rows.map(({ index, count, a, b, diff }) => ({ index, count, a, b, diff }))).toEqual([
      { index: 1, count: 2, a: 160, b: 165, diff: 5 },
      { index: 2, count: 2, a: 140, b: null, diff: null },
    ]);
  });
});

describe('angleInputSchema', () => {
  const base = {
    videoId: randomUUID(),
    name: 'knee',
    kind: 'angle',
    time: 1.2344,
    points: [
      { x: 0.1, y: 0.2 },
      { x: 0.3, y: 0.4 },
      { x: 0.5, y: 0.6 },
    ],
    frameWidth: 1080,
    frameHeight: 1920,
  } as const;

  it('点の数の上限を、測り方を見る前に落とす（長い配列を受けない）', () => {
    const many = Array.from({ length: 1000 }, () => ({ x: 0.5, y: 0.5 }));
    const result = angleInputSchema.safeParse({ ...base, points: many });
    expect(result.error?.issues[0]).toMatchObject({ code: 'too_big', path: ['points'] });
  });

  it('時刻をミリ秒に丸めて受ける', () => {
    expect(angleInputSchema.parse(base).time).toBe(1.234);
  });

  it('範囲の外の点・数でない点・測り方と合わない点の数・知らない名前・でたらめな大きさは受けない', () => {
    const bad = [
      { ...base, points: [{ x: 1.1, y: 0 }, ...base.points.slice(1)] },
      { ...base, points: [{ x: Number.NaN, y: 0 }, ...base.points.slice(1)] },
      { ...base, points: [{ x: Infinity, y: 0 }, ...base.points.slice(1)] },
      { ...base, kind: 'lean' },
      { ...base, points: base.points.slice(0, 2) },
      { ...base, name: 'elbow' },
      { ...base, frameWidth: 0 },
      { ...base, frameHeight: 1.5 },
      { ...base, time: -1 },
      { ...base, time: 601 },
      { ...base, videoId: 'x' },
    ];
    expect(bad.map((input) => angleInputSchema.safeParse(input).success)).toEqual(
      bad.map(() => false),
    );
  });
});

describe('placeLabels', () => {
  const box = { width: 200, height: 200 };
  const size = { width: 80, height: 18 };
  const hits = (p: LabelBox, q: LabelBox) =>
    p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height;

  it('点の右上に置き、右半分の点なら左上に置く', () => {
    expect(
      placeLabels(
        [
          { anchor: { x: 20, y: 100 }, size },
          { anchor: { x: 180, y: 160 }, size },
        ],
        box,
        10,
      ),
    ).toEqual([
      { x: 30, y: 72, ...size },
      { x: 90, y: 132, ...size },
    ]);
  });

  it('同じ所の字は重ならないよう下へずらし、箱の中に収める', () => {
    const labels = placeLabels(
      [
        { anchor: { x: 50, y: 50 }, size },
        { anchor: { x: 52, y: 52 }, size },
        { anchor: { x: 54, y: 48 }, size },
      ],
      box,
      10,
    );
    expect(labels.map((l) => l.y)).toEqual([22, 40, 58]);
    expect(labels.every((l, i) => labels.slice(i + 1).every((m) => !hits(l, m)))).toBe(true);
  });

  it('下に入らなければ上へずらし、箱の外へは出さない', () => {
    const labels = placeLabels(
      [
        { anchor: { x: 10, y: 199 }, size },
        { anchor: { x: 10, y: 199 }, size },
      ],
      { width: 100, height: 200 },
      10,
    );
    expect(labels.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 20, y: 171 },
      { x: 20, y: 153 },
    ]);
  });
});
