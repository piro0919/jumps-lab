'use client';

import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Card, ErrorText, LABEL, SEGMENTS, segmentClass } from '@/components/layout-ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import {
  DEFAULT_FPS,
  align,
  clamp,
  fpsFromInterval,
  isPlaying,
  stepFrame,
  toLocal,
  toShared,
  type Alignment,
} from '@/lib/video-sync';

/** 見比べる1本。label は日付、detail は練習か試合とメモ（画面に出す文） */
export type CompareVideo = { id: string; url: string; label: string; detail: string };

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
/** 再生中に、主でない方の動画がこれ以上ずれたら合わせ直す（秒）。小さいと絶えずシークしてカクつく */
const DRIFT_SECONDS = 0.1;
/** 位置のつまみの刻み（秒） */
const SCRUB_STEP = 0.01;
/** 秒を出す桁（小数第2位まで） */
const TIME_DIGITS = 2;

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
  const format = useFormatter();
  const videos = { a, b };
  const refA = useRef<HTMLVideoElement>(null);
  const refB = useRef<HTMLVideoElement>(null);
  const videoOf = (key: Key) => (key === 'a' ? refA.current : refB.current);

  const [mode, setMode] = useState<Mode>('side');
  const [speed, setSpeed] = useState<Speed>(INITIAL_SPEED);
  const [opacity, setOpacity] = useState(INITIAL_OPACITY);
  const [playing, setPlaying] = useState(false);
  const [shared, setShared] = useState(0);
  const [durations, setDurations] = useState<Record<Key, number>>({ a: NaN, b: NaN });
  const [locals, setLocals] = useState<Record<Key, number>>({ a: 0, b: 0 });
  const [syncs, setSyncs] = useState<Record<Key, number | null>>({ a: null, b: null });
  const [failed, setFailed] = useState<Record<Key, boolean>>({ a: false, b: false });
  const [landscape, setLandscape] = useState<Record<Key, boolean>>({ a: false, b: false });

  const alignment = useMemo(
    () =>
      align(
        { duration: durations.a, sync: syncs.a ?? 0 },
        { duration: durations.b, sync: syncs.b ?? 0 },
      ),
    [durations, syncs],
  );

  // 再生の繰り返し（requestAnimationFrame）から読む値。描くたびに新しくする
  const sharedRef = useRef(0);
  const alignmentRef = useRef(alignment);
  const durationsRef = useRef(durations);
  const speedRef = useRef(speed);
  /** requestVideoFrameCallback で見積もったコマの速さ。見積もれないうちは null（DEFAULT_FPS で送る） */
  const fpsRef = useRef<Record<Key, number | null>>({ a: null, b: null });
  useEffect(() => {
    alignmentRef.current = alignment;
    durationsRef.current = durations;
    speedRef.current = speed;
  });

  const startOf = (key: Key, al: Alignment) => (key === 'a' ? al.startA : al.startB);
  const fps = (key?: Key) => {
    const known = (key ? [fpsRef.current[key]] : [fpsRef.current.a, fpsRef.current.b]).filter(
      (v): v is number => v !== null,
    );
    return known.length > 0 ? Math.max(...known) : DEFAULT_FPS;
  };

  /** 共通の時刻へ2本ともシークする */
  const seekAll = (time: number, al: Alignment = alignmentRef.current) => {
    sharedRef.current = time;
    setShared(time);
    for (const key of KEYS) {
      const video = videoOf(key);
      if (!video || failed[key]) continue;
      video.currentTime = toLocal(time, startOf(key, al), durationsRef.current[key]);
    }
  };

  const pause = () => {
    setPlaying(false);
    for (const key of KEYS) videoOf(key)?.pause();
    seekAll(sharedRef.current);
  };

  const play = () => {
    // 終わりまで見たあとは頭から
    if (sharedRef.current >= alignmentRef.current.length) seekAll(0);
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
      const elapsed = last === null ? 0 : (now - last) / 1000;
      last = now;
      const al = alignmentRef.current;
      const lengths = durationsRef.current;
      let time = sharedRef.current + elapsed * speedRef.current;
      let master: Key | null = null;
      for (const key of KEYS) {
        const video = videoOf(key);
        const start = startOf(key, al);
        if (
          video &&
          !video.paused &&
          !video.seeking &&
          isPlaying(sharedRef.current, start, lengths[key])
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
        if (!video) continue;
        const start = startOf(key, al);
        const expected = toLocal(time, start, lengths[key]);
        if (isPlaying(time, start, lengths[key])) {
          if (video.paused) {
            video.currentTime = expected;
            video.play().catch(() => undefined);
          } else if (key !== master && Math.abs(video.currentTime - expected) > DRIFT_SECONDS) {
            video.currentTime = expected;
          }
        } else if (!video.paused || Math.abs(video.currentTime - expected) > DRIFT_SECONDS) {
          video.pause();
          video.currentTime = expected;
        }
      }
      sharedRef.current = time;
      setShared(time);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  /** 長さと縦横を読む。速さもここで合わせる（読み込み直すとブラウザが 1 に戻すことがある） */
  const readMetadata = (key: Key, video: HTMLVideoElement) => {
    video.playbackRate = speedRef.current;
    setDurations((d) => ({ ...d, [key]: video.duration }));
    setLandscape((l) => ({ ...l, [key]: video.videoWidth > video.videoHeight }));
    setLocals((l) => ({ ...l, [key]: video.currentTime }));
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
    // 付けたときに1回だけ（以降は onLoadedMetadata と onError が受ける）
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
            fpsRef.current[key] = Math.max(fpsRef.current[key] ?? 0, estimate);
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
    seekAll(stepFrame(sharedRef.current, direction, fps(), alignmentRef.current.length));
  };

  /** 1本だけを動かす（合わせる点を探すとき）。もう片方と共通の時刻はずれるが、次にまとめて動かすときに揃う */
  const seekOne = (key: Key, time: number) => {
    const video = videoOf(key);
    if (!video) return;
    if (playing) pause();
    video.currentTime = clamp(time, 0, Number.isFinite(video.duration) ? video.duration : 0);
  };

  /** 今の位置を、その動画の合わせる点にする。もう片方は、自分の合わせる点からの同じ時間だけずれた位置へ */
  const setSync = (key: Key) => {
    const video = videoOf(key);
    if (!video) return;
    if (playing) pause();
    const next = { ...syncs, [key]: video.currentTime };
    setSyncs(next);
    const al = align(
      { duration: durations.a, sync: next.a ?? 0 },
      { duration: durations.b, sync: next.b ?? 0 },
    );
    alignmentRef.current = al;
    seekAll(toShared(video.currentTime, startOf(key, al)), al);
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
      onTimeUpdate={(e) => {
        const time = e.currentTarget.currentTime;
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
    'w-full rounded-2xl bg-muted object-contain',
    stacked ? 'max-h-compare-video-stacked lg:max-h-compare-video' : 'max-h-compare-video',
  );
  const duration = alignment.length;

  return (
    <div className="flex flex-col gap-3">
      <div className={cn('mx-4', SEGMENTS)} role="radiogroup" aria-label={t('mode')}>
        {COMPARE_MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
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
                className={cn('flex min-w-0 flex-col gap-2', onTop && 'absolute inset-0')}
              >
                {mode === 'side' && (
                  <Badge tone={key === 'a' ? 'neutral' : 'accent'}>{name(key)}</Badge>
                )}
                {videoElement(
                  key,
                  cn(frameClass, onTop && 'h-full'),
                  onTop ? { opacity: opacity / 100 } : undefined,
                )}
              </div>
            );
          })}
        </div>
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

        <input
          type="range"
          aria-label={t('position')}
          min={0}
          max={duration || 0}
          step={SCRUB_STEP}
          value={Math.min(shared, duration || 0)}
          onChange={(e) => {
            if (playing) pause();
            seekAll(Number(e.target.value));
          }}
          className="h-6 w-full accent-primary"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label={t('previousFrame')}
              onClick={() => stepBoth(-1)}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <Button
              size="icon"
              type="button"
              aria-label={playing ? t('pause') : t('play')}
              onClick={playing ? pause : play}
            >
              {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label={t('nextFrame')}
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
                    max={Number.isFinite(durations[key]) ? durations[key] : 0}
                    step={SCRUB_STEP}
                    value={locals[key]}
                    onChange={(e) => seekOne(key, Number(e.target.value))}
                    className="h-6 w-full accent-primary"
                  />
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      aria-label={t('previousFrameOf', { video: name(key) })}
                      onClick={() => seekOne(key, locals[key] - 1 / fps(key))}
                    >
                      <ChevronLeft aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      aria-label={t('nextFrameOf', { video: name(key) })}
                      onClick={() => seekOne(key, locals[key] + 1 / fps(key))}
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
                      onClick={() => setSync(key)}
                    >
                      {t('setSync', { video: name(key) })}
                    </Button>
                  </div>
                  {syncs[key] !== null && (
                    <Badge tone="accent">{t('syncAt', { time: seconds(syncs[key] ?? 0) })}</Badge>
                  )}
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
            onClick={clearSync}
          >
            {t('clearSync')}
          </Button>
        )}
      </Card>
    </div>
  );
}
