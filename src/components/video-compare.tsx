'use client';

import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import {
  addVideoAngleAction,
  deleteVideoAngleAction,
  setVideoMarkAction,
} from '@/app/actions/videos';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  Badge,
  Card,
  CardTitle,
  EmptyState,
  ErrorText,
  LABEL,
  SEGMENTS,
  SEGMENT_GRID,
  Stat,
  segmentClass,
} from '@/components/layout-ui';
import { Button } from '@/components/ui/button';
import {
  AngleDraftBar,
  AngleOverlay,
  AnglesCard,
  useAngleLabel,
  type AngleShape,
} from '@/components/video-angles';
import { cn } from '@/lib/cn';
import { ANGLES_PER_VIDEO } from '@/lib/limits';
import { safely } from '@/lib/safe-action';
import {
  POINTS_NEEDED,
  atFrame,
  measure,
  wholeDegrees,
  type Angle,
  type AngleKind,
  type AngleName,
  type Point,
  type Size,
} from '@/lib/video-angles';
import {
  MARKS,
  compareIntervals,
  fromMs,
  nextMark,
  roundToMs,
  type MarkName,
  type Marks,
} from '@/lib/video-marks';
import {
  DEFAULT_FPS,
  align,
  canPlay,
  clamp,
  follow,
  fpsFromInterval,
  isPlaying,
  lengthOf,
  stepFrame,
  toLocal,
  toShared,
  type Alignment,
} from '@/lib/video-sync';

/**
 * 見比べる1本。label は日付、detail は練習か試合とメモ（画面に出す文）、marks は保存してある時間の目印、
 * angles は手で測った角度（時刻の順）
 */
export type CompareVideo = {
  id: string;
  url: string;
  label: string;
  detail: string;
  marks: Marks;
  angles: Angle[];
};

type Key = 'a' | 'b';
const KEYS = ['a', 'b'] as const;

const COMPARE_MODES = ['side', 'overlay'] as const;
type Mode = (typeof COMPARE_MODES)[number];

/** 再生の速さ。踏み切りの一瞬を見るので、遅い方から並べる */
const QUARTER_SPEED = 0.25;
const HALF_SPEED = 0.5;
const FULL_SPEED = 1;
const SPEEDS = [QUARTER_SPEED, HALF_SPEED, FULL_SPEED] as const;
type Speed = (typeof SPEEDS)[number];
const INITIAL_SPEED: Speed = HALF_SPEED;

/** 重ねたときの上の動画（B）の濃さ（%）。半分から始める */
const INITIAL_OPACITY = 50;
/** 位置のつまみの刻み（秒） */
const SCRUB_STEP = 0.01;
/** 秒を出す桁（小数第2位まで） */
const TIME_DIGITS = 2;
/**
 * 長さを持たない動画（MediaRecorder の webm）の長さを読むために、いったん跳ぶ先。終わりより先へシークすると、
 * ブラウザが終わりまで読んで長さを決める（durationchange）。決まったら頭へ戻す
 */
const PROBE_SECONDS = Number.MAX_SAFE_INTEGER;
/** 測り始めたときに動画を動かす先と、下に貼り付く操作（AngleDraftBar）とのあいだ（ピクセル） */
const DRAFT_SCROLL_GAP = 8;

/**
 * 共通の時刻（秒）。再生中は毎コマ変わるので state に置かず、ここに置いて位置のつまみだけが読む
 * （state に置くと、毎コマこの画面全体を描き直していた）
 */
type Clock = {
  get: () => number;
  set: (time: number) => void;
  subscribe: (listener: () => void) => () => void;
};

function createClock(): Clock {
  let time = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => time,
    set: (next) => {
      time = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** 2本まとめて動かす位置のつまみ。共通の時刻が変わるたびに、これだけを描き直す */
function PositionSlider({
  clock,
  length,
  label,
  disabled,
  onSeek,
}: {
  clock: Clock;
  length: number;
  label: string;
  disabled: boolean;
  onSeek: (time: number) => void;
}) {
  const time = useSyncExternalStore(clock.subscribe, clock.get, clock.get);
  return (
    <input
      type="range"
      aria-label={label}
      min={0}
      max={length}
      step={SCRUB_STEP}
      value={Math.min(time, length)}
      disabled={disabled}
      onChange={(e) => onSeek(Number(e.target.value))}
      className="h-6 w-full accent-primary"
    />
  );
}

/**
 * 2本の動画を並べて見比べる（/videos/compare）。AI で骨格を取るのはやめ、海外のコーチ向けのアプリ
 * （OnForm・CoachNow など）と同じ「並べて・重ねて・同じ瞬間で止めて・コマ送り」で見る（2026-10-14）。
 *
 * 時刻の合わせ方は src/lib/video-sync.ts。それぞれの動画に合わせる点（踏み切りなど）を置き、
 * 2本の合わせる点が同じ時刻に来る共通の時間軸で、再生・位置のつまみ・コマ送りをまとめて動かす。
 * 再生中は、動いている方の動画の時刻を時計にし（読み込み待ちで止まれば時計も止まる）、もう片方を合わせる。
 * どちらも動いていない間（片方が始まる前など）だけ、経った時間で時計を進める。
 * 合わせる点を探すときは、1本ごとのつまみとコマ送りでその動画だけを動かす。
 * 音は出さない（muted）。勝手に再生しない
 */
export function VideoCompare({ a, b }: { a: CompareVideo; b: CompareVideo }) {
  const t = useTranslations('compare');
  const tErrors = useTranslations('errors');
  const format = useFormatter();
  const videos = { a, b };
  const refA = useRef<HTMLVideoElement>(null);
  const refB = useRef<HTMLVideoElement>(null);
  const videoOf = (key: Key) => (key === 'a' ? refA.current : refB.current);

  const [mode, setMode] = useState<Mode>('side');
  const [speed, setSpeed] = useState<Speed>(INITIAL_SPEED);
  const [opacity, setOpacity] = useState(INITIAL_OPACITY);
  const [playing, setPlaying] = useState(false);
  const [clock] = useState(createClock);
  const [durations, setDurations] = useState<Record<Key, number>>({ a: NaN, b: NaN });
  const [locals, setLocals] = useState<Record<Key, number>>({ a: 0, b: 0 });
  const [syncs, setSyncs] = useState<Record<Key, number | null>>({ a: null, b: null });
  const [failed, setFailed] = useState<Record<Key, boolean>>({ a: false, b: false });
  const [landscape, setLandscape] = useState<Record<Key, boolean>>({ a: false, b: false });
  const [marks, setMarks] = useState<Record<Key, Marks>>({ a: a.marks, b: b.marks });
  const [chosen, setChosen] = useState<Record<Key, MarkName>>({
    a: nextMark(a.marks),
    b: nextMark(b.marks),
  });
  const [markFailed, setMarkFailed] = useState<Record<Key, boolean>>({ a: false, b: false });
  const [marking, startMarking] = useTransition();
  /** 目印を保存している間は次の押下を受けない（連打や Enter で2回送らないように） */
  const sendingMark = useRef(false);

  // 手で測る角度（src/lib/video-angles.ts）
  const [angles, setAngles] = useState<Record<Key, Angle[]>>({ a: a.angles, b: b.angles });
  /** 動画の本来の幅と高さ（読み込むまで null） */
  const [frames, setFrames] = useState<Record<Key, Size | null>>({ a: null, b: null });
  /** 動画の要素の画面での大きさ（線を重ねる SVG の大きさ） */
  const [boxes, setBoxes] = useState<Record<Key, Size | null>>({ a: null, b: null });
  /** 見積もったコマの速さ（測ったコマから1コマ以内かを決める）。見積もるまで null */
  const [frameRates, setFrameRates] = useState<Record<Key, number | null>>({ a: null, b: null });
  const [angleChoice, setAngleChoice] = useState<Record<Key, { name: AngleName; kind: AngleKind }>>(
    { a: { name: 'knee', kind: 'angle' }, b: { name: 'knee', kind: 'angle' } },
  );
  /**
   * 点を打っている途中の測定（1本ずつ）。time は打ち始めたときのその動画のコマ（保存する時刻）。
   * 打っている間は、その動画を動かす操作（再生・つまみ・コマ送り・合わせる点・並べ方）を止める
   * （動かせると、点を打ったコマと保存する時刻・見えている絵がずれた）
   */
  const [draft, setDraft] = useState<{ key: Key; time: number; points: Point[] } | null>(null);
  /** 角度の保存・削除の誤り。key は打っている途中の動画（削除の誤りは null でカードに出す） */
  const [angleError, setAngleError] = useState<{
    key: Key | null;
    error: 'generic' | 'angleLimit';
  } | null>(null);
  const [removingAngle, setRemovingAngle] = useState<{ key: Key; id: string } | null>(null);
  const [savingAngle, startSavingAngle] = useTransition();
  /** 角度を保存・削除している間は次の押下を受けない（連打や Enter で2回送らないように） */
  const sendingAngle = useRef(false);
  const removingAngleRef = useRef(false);
  /** 1本ずつの動画の箱（測り始めたときに動かす先）と、打っている途中の操作の箱 */
  const videoBoxRefs = useRef<Record<Key, HTMLDivElement | null>>({ a: null, b: null });
  const draftBarRef = useRef<HTMLDivElement>(null);
  const angleLabel = useAngleLabel();

  const alignment = useMemo(
    () =>
      align(
        { duration: durations.a, sync: syncs.a ?? 0 },
        { duration: durations.b, sync: syncs.b ?? 0 },
      ),
    [durations, syncs],
  );

  // 再生の繰り返し（requestAnimationFrame）から読む値。描くたびに新しくする
  const alignmentRef = useRef(alignment);
  const durationsRef = useRef(durations);
  const speedRef = useRef(speed);
  const failedRef = useRef(failed);
  /** 長さを読むために終わりの先へ跳んでいる間（その間の位置は見せない） */
  const probing = useRef<Record<Key, boolean>>({ a: false, b: false });
  /** requestVideoFrameCallback で見積もったコマの速さ。見積もれないうちは null（DEFAULT_FPS で送る） */
  const fpsRef = useRef<Record<Key, number | null>>({ a: null, b: null });
  useEffect(() => {
    alignmentRef.current = alignment;
    durationsRef.current = durations;
    speedRef.current = speed;
    failedRef.current = failed;
  });

  const startOf = (key: Key, al: Alignment) => (key === 'a' ? al.startA : al.startB);
  const fps = (key?: Key) => {
    const known = (key ? [fpsRef.current[key]] : [fpsRef.current.a, fpsRef.current.b]).filter(
      (v): v is number => v !== null,
    );
    return known.length > 0 ? Math.max(...known) : DEFAULT_FPS;
  };

  /** 共通の時刻へ2本ともシークする。keep の動画は動かさない（その動画の今の位置から時刻を決めたとき） */
  const seekAll = (time: number, al: Alignment = alignmentRef.current, keep?: Key) => {
    clock.set(time);
    for (const key of KEYS) {
      const video = videoOf(key);
      if (!video || key === keep || failedRef.current[key]) continue;
      video.currentTime = toLocal(time, startOf(key, al), durationsRef.current[key]);
    }
  };

  const stopVideos = () => {
    setPlaying(false);
    for (const key of KEYS) videoOf(key)?.pause();
  };

  const pause = () => {
    stopVideos();
    seekAll(clock.get());
  };

  /**
   * 1本の今の位置（local）を使うときに止める。その動画は動かさず、もう片方をその位置に揃える
   * （pause() は共通の時計へ2本とも戻すので、見ていたコマから最大 DRIFT_SECONDS ずれた）
   */
  const pauseAt = (key: Key, local: number, al: Alignment = alignmentRef.current) => {
    stopVideos();
    seekAll(toShared(local, startOf(key, al)), al, key);
  };

  const ready = canPlay([durations.a, durations.b], [failed.a, failed.b]);

  const play = () => {
    if (!ready) return;
    // 終わりまで見たあとは頭から
    if (clock.get() >= alignmentRef.current.length) seekAll(0);
    setPlaying(true);
  };

  // 速さは2本とも同じにする
  useEffect(() => {
    for (const key of KEYS) {
      const video = videoOf(key);
      if (video) {
        video.defaultPlaybackRate = speed;
        video.playbackRate = speed;
      }
    }
  }, [speed]);

  // 再生中の時計。動いている方の動画の時刻を共通の時刻にし、もう片方を合わせる
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last: number | null = null;
    const tick = (now: number) => {
      const elapsed = last === null ? 0 : fromMs(now - last);
      last = now;
      const al = alignmentRef.current;
      const lengths = durationsRef.current;
      let time = clock.get() + elapsed * speedRef.current;
      let master: Key | null = null;
      for (const key of KEYS) {
        const video = videoOf(key);
        const start = startOf(key, al);
        if (
          video &&
          !video.paused &&
          !video.seeking &&
          isPlaying(clock.get(), start, lengths[key])
        ) {
          time = toShared(video.currentTime, start);
          master = key;
          break;
        }
      }
      if (time >= al.length) {
        setPlaying(false);
        for (const key of KEYS) videoOf(key)?.pause();
        seekAll(al.length, al);
        return;
      }
      for (const key of KEYS) {
        const video = videoOf(key);
        if (!video || failedRef.current[key]) continue;
        const start = startOf(key, al);
        const expected = toLocal(time, start, lengths[key]);
        const action = follow({
          paused: video.paused,
          seeking: video.seeking,
          current: video.currentTime,
          expected,
          active: isPlaying(time, start, lengths[key]),
          master: key === master,
        });
        if (action === 'start') {
          video.currentTime = expected;
          video.play().catch(() => undefined);
        } else if (action === 'seek') {
          video.currentTime = expected;
        } else if (action === 'hold') {
          video.pause();
          video.currentTime = expected;
        }
      }
      clock.set(time);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  /**
   * 長さを読む。長さを持たない動画（Infinity）は、終わりの先へ跳んで長さを決めさせ（durationchange か
   * timeupdate で分かる）、分かったら頭へ戻す。長さは分かったときだけ覚える
   */
  const readLength = (key: Key, video: HTMLVideoElement) => {
    if (video.duration === Infinity) {
      if (!probing.current[key]) {
        probing.current[key] = true;
        video.currentTime = PROBE_SECONDS;
      }
      return;
    }
    if (lengthOf(video.duration) === 0) return;
    if (probing.current[key]) {
      probing.current[key] = false;
      video.currentTime = 0;
      setLocals((l) => ({ ...l, [key]: 0 }));
    }
    const length = video.duration;
    setDurations((d) => (d[key] === length ? d : { ...d, [key]: length }));
  };

  /** 動画の要素の画面での大きさを読む（線を重ねる SVG を同じ大きさにする） */
  const readBox = (key: Key, video: HTMLVideoElement) => {
    const width = video.clientWidth;
    const height = video.clientHeight;
    setBoxes((b) =>
      b[key]?.width === width && b[key]?.height === height ? b : { ...b, [key]: { width, height } },
    );
  };

  /** 長さと縦横を読む。速さもここで合わせる（読み込み直すとブラウザが 1 に戻すことがある） */
  const readMetadata = (key: Key, video: HTMLVideoElement) => {
    video.playbackRate = speedRef.current;
    setLandscape((l) => ({ ...l, [key]: video.videoWidth > video.videoHeight }));
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      setFrames((f) => ({ ...f, [key]: { width: video.videoWidth, height: video.videoHeight } }));
    }
    readBox(key, video);
    readLength(key, video);
    if (!probing.current[key]) setLocals((l) => ({ ...l, [key]: video.currentTime }));
  };

  // 動画はサーバーが描いた時点で読み込みを始めるので、React が受け口を付ける前に loadedmetadata や error が
  // 済んでいることがある（長さが分からないまま、つまみの上限が 0 になった）。付けたときに一度読み直す
  useEffect(() => {
    for (const key of KEYS) {
      const video = videoOf(key);
      if (!video) continue;
      if (video.error) setFailed((f) => ({ ...f, [key]: true }));
      else if (video.readyState >= HTMLMediaElement.HAVE_METADATA) readMetadata(key, video);
    }
    // 付けたときに1回だけ（以降は onLoadedMetadata・onDurationChange と onError が受ける）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 画面の幅が変わる・並べ方が変わると動画の要素の大きさが変わるので、重ねる SVG も合わせる
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      for (const key of KEYS) {
        const video = videoOf(key);
        if (video) readBox(key, video);
      }
    });
    for (const key of KEYS) {
      const video = videoOf(key);
      if (video) observer.observe(video);
    }
    return () => observer.disconnect();
    // 付けたときに1回だけ（同じ video 要素を使い続ける）
  }, []);

  // コマの速さを、続けて描いた2コマの時刻の差から見積もる（requestVideoFrameCallback のあるブラウザだけ）。
  // 再生中に1コマずつ進んだときだけ数え、落ちたコマで小さく見積もらないよう、見えた中の大きい方を取る
  useEffect(() => {
    const stops: (() => void)[] = [];
    for (const key of KEYS) {
      const video = videoOf(key);
      if (!video || !('requestVideoFrameCallback' in video)) continue;
      let previous: VideoFrameCallbackMetadata | null = null;
      let handle = 0;
      const onFrame: VideoFrameRequestCallback = (_now, metadata) => {
        if (
          previous &&
          !video.paused &&
          metadata.presentedFrames - previous.presentedFrames === 1
        ) {
          const estimate = fpsFromInterval(metadata.mediaTime - previous.mediaTime);
          if (estimate !== null) {
            const next = Math.max(fpsRef.current[key] ?? 0, estimate);
            if (next !== fpsRef.current[key]) {
              fpsRef.current[key] = next;
              setFrameRates((r) => ({ ...r, [key]: next }));
            }
          }
        }
        previous = metadata;
        handle = video.requestVideoFrameCallback(onFrame);
      };
      handle = video.requestVideoFrameCallback(onFrame);
      stops.push(() => video.cancelVideoFrameCallback(handle));
    }
    return () => stops.forEach((stop) => stop());
  }, []);

  /** 2本まとめて1コマ送る */
  const stepBoth = (direction: 1 | -1) => {
    pause();
    seekAll(stepFrame(clock.get(), direction, fps(), alignmentRef.current.length));
  };

  /** 1本だけを動かす（合わせる点を探すとき）。もう片方と共通の時刻はずれるが、次にまとめて動かすときに揃う */
  const seekOne = (key: Key, time: number) => {
    const video = videoOf(key);
    if (!video) return;
    if (playing) pause();
    video.currentTime = clamp(time, 0, lengthOf(durationsRef.current[key]));
  };

  /**
   * 1本だけを1コマ送る。今の位置は video.currentTime から読む（シークした直後から行き先を返す）。
   * timeupdate で更新する locals から読むと、続けて押したときに1コマしか進まなかった
   */
  const stepOne = (key: Key, direction: 1 | -1) => {
    const video = videoOf(key);
    if (!video) return;
    seekOne(key, video.currentTime + direction / fps(key));
  };

  /** 今の位置を、その動画の合わせる点にする。もう片方は、自分の合わせる点からの同じ時間だけずれた位置へ */
  const setSync = (key: Key) => {
    const video = videoOf(key);
    if (!video) return;
    // 止める前に読む（止めると時計へ戻すシークで、見ていたコマからずれる）
    const local = video.currentTime;
    const next = { ...syncs, [key]: local };
    setSyncs(next);
    const al = align(
      { duration: durations.a, sync: next.a ?? 0 },
      { duration: durations.b, sync: next.b ?? 0 },
    );
    alignmentRef.current = al;
    pauseAt(key, local, al);
  };

  /**
   * 目印を置く（time が null なら外す）。置き直すと上書きする。保存できたら、保存した後の目印で描き直し、
   * 置いたときは次の目印を選んでおく（助走の始まりから順に置いていけるように）
   */
  const saveMark = (key: Key, mark: MarkName, time: number | null) => {
    if (sendingMark.current) return;
    sendingMark.current = true;
    setMarkFailed((f) => ({ ...f, [key]: false }));
    startMarking(async () => {
      try {
        const result = await safely(() =>
          setVideoMarkAction({ videoId: videos[key].id, mark, time }),
        );
        if (result.ok) {
          setMarks((m) => ({ ...m, [key]: result.marks }));
          if (time !== null) setChosen((c) => ({ ...c, [key]: nextMark(result.marks, mark) }));
        } else {
          setMarkFailed((f) => ({ ...f, [key]: true }));
        }
      } finally {
        sendingMark.current = false;
      }
    });
  };

  const placeMark = (key: Key) => {
    const video = videoOf(key);
    if (!video) return;
    // 止める前に読み、この動画は動かさない（見ていたコマの時刻を置く）
    const local = video.currentTime;
    if (playing) pauseAt(key, local);
    saveMark(key, chosen[key], roundToMs(local));
  };

  /**
   * その動画で点を打ち始める。止めて、今のコマを保存する時刻にし、線を重ねられる「並べる」にする。
   * 動画が見える所へ動かすのは、並べ方が替わって描き直したあと（下の effect）
   */
  const startAngle = (key: Key) => {
    const video = videoOf(key);
    if (!video) return;
    // 止める前に読み、この動画は動かさない（見ていたコマで測る）
    const local = video.currentTime;
    if (playing) pauseAt(key, local);
    setMode('side');
    setAngleError(null);
    setDraft({ key, time: roundToMs(local), points: [] });
  };

  // 測り始めたら、並べ方が替わって描き直したあとで、その動画と下に貼り付く操作の両方が見える所へ動かし、
  // 点を打つ SVG に焦点を当てる（キーボードでそのまま打てるように）。同じ処理の中で動かすと、重ねて見せていた
  // ときの古い並びの位置へ動いた。上のヘッダーは scroll-mt-20 で、下は貼り付く操作（下のタブの上）の分を空ける
  const draftKey = draft?.key ?? null;
  useEffect(() => {
    if (draftKey === null) return;
    const frame = requestAnimationFrame(() => {
      const target = videoBoxRefs.current[draftKey];
      if (!target) return;
      const bar = draftBarRef.current;
      if (bar) {
        const stuckAt = Number.parseFloat(getComputedStyle(bar).bottom) || 0;
        target.style.scrollMarginBottom = `${bar.offsetHeight + stuckAt + DRAFT_SCROLL_GAP}px`;
      }
      target
        .querySelector<SVGSVGElement>('svg[role="application"]')
        ?.focus({ preventScroll: true });
      target.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [draftKey]);

  const placePoint = (key: Key, point: Point) =>
    setDraft((d) =>
      d && d.key === key && d.points.length < POINTS_NEEDED[angleChoice[key].kind]
        ? { ...d, points: [...d.points, point] }
        : d,
    );

  /** 打っている測定の度数（点が足りない・重なっているときは null） */
  const draftFrame = draft ? frames[draft.key] : null;
  const draftDegrees =
    draft && draftFrame ? measure(angleChoice[draft.key].kind, draft.points, draftFrame) : null;

  /**
   * 打った点を保存する。時刻は打ち始めたときのコマ（打っている間はその動画を動かせないので、点を打った絵と合う）。
   * 度数はサーバーが点から求め直したものを使う
   */
  const saveAngle = () => {
    if (!draft || sendingAngle.current) return;
    const { key, points, time } = draft;
    const frame = frames[key];
    const { name: angleName, kind } = angleChoice[key];
    if (!frame || measure(kind, points, frame) === null) return;
    sendingAngle.current = true;
    setAngleError(null);
    startSavingAngle(async () => {
      try {
        const result = await safely(() =>
          addVideoAngleAction({
            videoId: videos[key].id,
            name: angleName,
            kind,
            time,
            points,
            frameWidth: frame.width,
            frameHeight: frame.height,
          }),
        );
        if (result.ok) {
          const saved = result.angle;
          setAngles((all) => ({
            ...all,
            [key]: [...all[key], saved].toSorted((x, y) => x.time - y.time),
          }));
          setDraft(null);
        } else {
          setAngleError({ key, error: result.error === 'angleLimit' ? 'angleLimit' : 'generic' });
        }
      } finally {
        sendingAngle.current = false;
      }
    });
  };

  /** 測定を1つ消す。消している間の次の押下は受けない（もう消えた測定は、サーバーが消せたとして返す） */
  const removeAngle = (key: Key, id: string) => {
    if (removingAngleRef.current) return;
    removingAngleRef.current = true;
    setAngleError(null);
    startSavingAngle(async () => {
      try {
        const result = await safely(() => deleteVideoAngleAction(id));
        if (result.ok) {
          setAngles((all) => ({ ...all, [key]: all[key].filter((angle) => angle.id !== id) }));
        } else {
          setAngleError({ key: null, error: 'generic' });
        }
      } finally {
        removingAngleRef.current = false;
      }
    });
  };

  const clearSync = () => {
    if (playing) pause();
    const cleared = { a: null, b: null };
    setSyncs(cleared);
    const al = align({ duration: durations.a, sync: 0 }, { duration: durations.b, sync: 0 });
    alignmentRef.current = al;
    seekAll(0, al);
  };

  const seconds = (value: number) =>
    t('seconds', {
      time: format.number(value, {
        minimumFractionDigits: TIME_DIGITS,
        maximumFractionDigits: TIME_DIGITS,
      }),
    });

  const name = (key: Key) => t(key === 'a' ? 'videoA' : 'videoB');
  const degreesText = (value: number) =>
    format.number(wholeDegrees(value), { maximumFractionDigits: 0 });
  /** 打っている途中は、2本を一緒に動かす操作と並べ方を止める。frozen(key) はその動画を動かす操作 */
  const drafting = draft !== null;
  const frozen = (key: Key) => draft?.key === key;

  /** 動画に重ねる測定。打っている途中ならそれだけ、止まっていれば今のコマから1コマ以内に測ったもの */
  const shapesOf = (key: Key): AngleShape[] => {
    if (draft?.key === key) {
      return [
        {
          id: 'draft',
          kind: angleChoice[key].kind,
          points: draft.points,
          label: draftDegrees === null ? null : t('degrees', { value: degreesText(draftDegrees) }),
        },
      ];
    }
    if (playing) return [];
    return angles[key]
      .filter((angle) => atFrame(angle.time, locals[key], frameRates[key] ?? DEFAULT_FPS))
      .map((angle) => ({
        id: angle.id,
        kind: angle.kind,
        points: angle.points,
        label: t('angleOnVideo', {
          angle: angleLabel(angle.name, angle.kind),
          value: degreesText(angle.degrees),
        }),
      }));
  };
  const markName = (mark: MarkName) => t(`marks.${mark}`);
  const rows = useMemo(() => compareIntervals(marks.a, marks.b), [marks]);
  /** あいだの時間の数（Stat に渡す）。差は + と − を付ける */
  const timeValue = (value: number | null, signed = false) =>
    value === null
      ? null
      : {
          value: format.number(value, {
            minimumFractionDigits: TIME_DIGITS,
            maximumFractionDigits: TIME_DIGITS,
            signDisplay: signed ? 'exceptZero' : 'auto',
          }),
          unit: t('secondsUnit'),
        };

  const videoElement = (key: Key, className: string, style?: { opacity: number }) => (
    <video
      ref={key === 'a' ? refA : refB}
      // 頭の1コマを描かせる（iPhone は preload だけでは描かない。日の画面の動画と同じ）
      src={`${videos[key].url}#t=0.1`}
      muted
      playsInline
      preload="metadata"
      aria-label={name(key)}
      data-testid={`compare-video-${key}`}
      className={className}
      style={style}
      onLoadedMetadata={(e) => readMetadata(key, e.currentTarget)}
      onDurationChange={(e) => readLength(key, e.currentTarget)}
      onTimeUpdate={(e) => {
        const video = e.currentTarget;
        // 長さを読むために跳んでいる間の位置は見せない
        if (probing.current[key]) {
          readLength(key, video);
          return;
        }
        const time = video.currentTime;
        setLocals((l) => ({ ...l, [key]: time }));
      }}
      onError={() => setFailed((f) => ({ ...f, [key]: true }))}
    />
  );

  // スマホで横長の動画を左右に並べると、1本が幅 150px ほどで小さすぎる。横長が1本でもあれば縦に積み、
  // 2本とも1画面に入るよう高さを抑える。縦長（スマホを立てて撮ったもの）どうしは左右に並べる
  // （縦に積むと1本で画面が埋まり、見比べられない）
  const stacked = mode === 'side' && (landscape.a || landscape.b);
  const frameClass = cn(
    'block w-full rounded-2xl bg-muted object-contain',
    stacked ? 'max-h-compare-video-stacked lg:max-h-compare-video' : 'max-h-compare-video',
  );
  const duration = alignment.length;
  const angleSide = (key: Key) => ({
    video: name(key),
    title: videos[key].label,
    angles: angles[key],
    name: angleChoice[key].name,
    kind: angleChoice[key].kind,
    canMeasure:
      !failed[key] &&
      frames[key] !== null &&
      draft === null &&
      !savingAngle &&
      angles[key].length < ANGLES_PER_VIDEO,
    drafting: draft?.key === key,
  });
  const angleErrorText = (error: 'generic' | 'angleLimit') =>
    error === 'angleLimit' ? t('angleLimit', { max: ANGLES_PER_VIDEO }) : tErrors('generic');

  return (
    <div className="flex flex-col gap-3">
      <div className={cn('mx-4', SEGMENTS)} role="radiogroup" aria-label={t('mode')}>
        {COMPARE_MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            // 打っている間は替えない（重ねて見せると線が消え、点を打てないまま保存できた）
            disabled={drafting}
            className={segmentClass(mode === m)}
            onClick={() => setMode(m)}
          >
            {t(m)}
          </button>
        ))}
      </div>

      <Card className="flex flex-col gap-4">
        {/* 見せ方を替えても同じ video 要素を使い続ける（作り直すと読み込み直して、位置が頭に戻る） */}
        <div
          data-testid="compare-stage"
          className={cn(
            mode === 'overlay'
              ? 'relative'
              : cn('grid gap-3', stacked ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-2'),
          )}
        >
          {KEYS.map((key) => {
            const onTop = mode === 'overlay' && key === 'b';
            return (
              <div
                key={key}
                ref={(element) => {
                  videoBoxRefs.current[key] = element;
                }}
                // 測り始めたときに動かす先。上のヘッダーに隠れないよう、その分を空ける（下は effect で決める）
                className={cn(
                  'flex min-w-0 scroll-mt-20 flex-col gap-2',
                  onTop && 'absolute inset-0',
                )}
              >
                {mode === 'side' && (
                  <Badge tone={key === 'a' ? 'neutral' : 'accent'}>{name(key)}</Badge>
                )}
                {/* 測った線を重ねる SVG は、この箱（動画の要素と同じ大きさ）にぴったり重ねる */}
                <div className={cn('relative', onTop && 'h-full')}>
                  {videoElement(
                    key,
                    cn(frameClass, onTop && 'h-full'),
                    onTop ? { opacity: opacity / 100 } : undefined,
                  )}
                  {/* 重ねて見せるときは2本の絵が重なるので、線は並べたときだけ描く */}
                  {mode === 'side' && (
                    <AngleOverlay
                      frame={frames[key]}
                      box={boxes[key]}
                      shapes={shapesOf(key)}
                      placing={draft?.key === key}
                      label={t(draft?.key === key ? 'placeOn' : 'anglesOn', { video: name(key) })}
                      keyHint={t('placeKeys')}
                      onPlace={(point) => placePoint(key, point)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {draft && (
          // スマホでは下のタブの上に貼り付け、動画を見ながら押せるようにする（タブの下に隠れていた）
          <div ref={draftBarRef} className="sticky bottom-tab-bar z-10 lg:bottom-4">
            <AngleDraftBar
              video={name(draft.key)}
              name={angleChoice[draft.key].name}
              kind={angleChoice[draft.key].kind}
              placed={draft.points.length}
              degrees={draftDegrees}
              saving={savingAngle}
              error={angleError?.key === draft.key ? angleErrorText(angleError.error) : null}
              onUndo={() => setDraft((d) => d && { ...d, points: d.points.slice(0, -1) })}
              onCancel={() => setDraft(null)}
              onSave={saveAngle}
            />
          </div>
        )}
        {mode === 'overlay' && (
          <label className="flex flex-col gap-1.5">
            <span className={cn('flex items-baseline justify-between', LABEL)}>
              {t('opacity')}
              <span className="text-sm font-bold text-foreground tabular-nums">
                {format.number(opacity / 100, { style: 'percent' })}
              </span>
            </span>
            <input
              type="range"
              aria-label={t('opacity')}
              min={0}
              max={100}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="h-6 w-full accent-primary"
            />
          </label>
        )}

        <PositionSlider
          clock={clock}
          length={duration}
          label={t('position')}
          disabled={drafting}
          onSeek={(time) => {
            if (playing) pause();
            seekAll(time);
          }}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label={t('previousFrame')}
              disabled={drafting}
              onClick={() => stepBoth(-1)}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <Button
              size="icon"
              type="button"
              aria-label={playing ? t('pause') : t('play')}
              // 2本の長さが分かるまでは押せない（時間軸の長さが 0 のまま再生すると、すぐ止まる）
              disabled={drafting || (!playing && !ready)}
              onClick={playing ? pause : play}
            >
              {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label={t('nextFrame')}
              disabled={drafting}
              onClick={() => stepBoth(1)}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
          <div className={SEGMENTS} role="radiogroup" aria-label={t('speed')}>
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={speed === s}
                className={segmentClass(speed === s)}
                onClick={() => setSpeed(s)}
              >
                {t('speedValue', { speed: s })}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="grid gap-4 lg:grid-cols-2">
          {KEYS.map((key) => (
            <div key={key} className="flex min-w-0 flex-col gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <Badge tone={key === 'a' ? 'neutral' : 'accent'}>{name(key)}</Badge>
                <span className="truncate text-sm font-bold">{videos[key].label}</span>
                <span className="truncate text-xs text-muted-foreground">{videos[key].detail}</span>
              </span>
              {failed[key] ? (
                <ErrorText>{t('loadFailed')}</ErrorText>
              ) : (
                <>
                  <input
                    type="range"
                    aria-label={t('positionOf', { video: name(key) })}
                    min={0}
                    max={lengthOf(durations[key])}
                    step={SCRUB_STEP}
                    value={locals[key]}
                    disabled={frozen(key)}
                    onChange={(e) => seekOne(key, Number(e.target.value))}
                    className="h-6 w-full accent-primary"
                  />
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      aria-label={t('previousFrameOf', { video: name(key) })}
                      disabled={frozen(key)}
                      onClick={() => stepOne(key, -1)}
                    >
                      <ChevronLeft aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      aria-label={t('nextFrameOf', { video: name(key) })}
                      disabled={frozen(key)}
                      onClick={() => stepOne(key, 1)}
                    >
                      <ChevronRight aria-hidden />
                    </Button>
                    <span className="flex-1 text-xs text-muted-foreground tabular-nums">
                      {seconds(locals[key])}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      // 合わせる点を置くと、もう片方の動画も動く
                      disabled={drafting}
                      onClick={() => setSync(key)}
                    >
                      {t('setSync', { video: name(key) })}
                    </Button>
                  </div>
                  {syncs[key] !== null && (
                    <Badge tone="accent">{t('syncAt', { time: seconds(syncs[key] ?? 0) })}</Badge>
                  )}
                  <div
                    className={SEGMENT_GRID}
                    role="radiogroup"
                    aria-label={t('markOf', { video: name(key) })}
                  >
                    {MARKS.map((mark) => (
                      <button
                        key={mark}
                        type="button"
                        role="radio"
                        aria-checked={chosen[key] === mark}
                        className={segmentClass(chosen[key] === mark)}
                        onClick={() => setChosen((c) => ({ ...c, [key]: mark }))}
                      >
                        {t(`markShort.${mark}`)}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    className="self-start"
                    disabled={marking}
                    onClick={() => placeMark(key)}
                  >
                    {t('setMark')}
                  </Button>
                  {MARKS.some((mark) => marks[key][mark] !== undefined) && (
                    <ul className="flex flex-col divide-y divide-border">
                      {MARKS.map((mark) => {
                        const time = marks[key][mark];
                        if (time === undefined) return null;
                        return (
                          <li key={mark} className="flex items-center gap-2">
                            {/* 押すとその目印の位置へ動かす（置き直す前に確かめられるように） */}
                            <button
                              type="button"
                              className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 text-left"
                              disabled={frozen(key)}
                              onClick={() => seekOne(key, time)}
                            >
                              <span className="truncate text-sm font-bold">{markName(mark)}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {seconds(time)}
                              </span>
                            </button>
                            <Button
                              variant="ghost"
                              size="icon"
                              type="button"
                              aria-label={t('removeMark', {
                                mark: markName(mark),
                                video: name(key),
                              })}
                              disabled={marking}
                              onClick={() => saveMark(key, mark, null)}
                            >
                              <X aria-hidden />
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <ErrorText>{markFailed[key] ? tErrors('generic') : null}</ErrorText>
                </>
              )}
            </div>
          ))}
        </div>
        {(syncs.a !== null || syncs.b !== null) && (
          <Button
            variant="secondary"
            size="sm"
            type="button"
            className="self-start"
            disabled={drafting}
            onClick={clearSync}
          >
            {t('clearSync')}
          </Button>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>{t('timing')}</CardTitle>
        {rows.length === 0 ? (
          <EmptyState message={t('noTiming')} />
        ) : (
          <ul className="flex flex-col gap-4" aria-label={t('timing')}>
            {rows.map((row) => (
              // PC では1行に「あいだの名前・A・B・B − A」を並べる（3つの数だけをカードの幅に広げると間が空きすぎる）
              <li
                key={row.key}
                data-testid={`interval-${row.key}`}
                className="flex flex-col gap-2 lg:grid lg:grid-cols-4 lg:items-center lg:gap-3"
              >
                <span className="text-sm font-bold">
                  {row.key === 'approach'
                    ? t('approach')
                    : t('interval', { from: markName(row.from), to: markName(row.to) })}
                </span>
                <div className="grid grid-cols-3 gap-3 lg:col-span-3">
                  <Stat size="sm" value={timeValue(row.a)} label={name('a')} />
                  <Stat size="sm" value={timeValue(row.b)} label={name('b')} />
                  <Stat size="sm" value={timeValue(row.diff, true)} label={t('difference')} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AnglesCard
        sides={{ a: angleSide('a'), b: angleSide('b') }}
        seconds={seconds}
        error={angleError && angleError.key === null ? angleErrorText(angleError.error) : null}
        onKind={(key, kind) => setAngleChoice((c) => ({ ...c, [key]: { ...c[key], kind } }))}
        onName={(key, angleName) =>
          setAngleChoice((c) => ({ ...c, [key]: { ...c[key], name: angleName } }))
        }
        onMeasure={startAngle}
        onSeek={seekOne}
        onRemove={(key, angle) => setRemovingAngle({ key, id: angle.id })}
      />
      <ConfirmDialog
        open={removingAngle !== null}
        title={t('removeAngleConfirm')}
        onOpenChange={(open) => {
          if (!open) setRemovingAngle(null);
        }}
        onConfirm={() => {
          if (removingAngle) removeAngle(removingAngle.key, removingAngle.id);
        }}
      />
    </div>
  );
}
