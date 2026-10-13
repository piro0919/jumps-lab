'use client';

// 線（components/progress.tsx）を出すため、移るのは @bprogress の useRouter で
import { useRouter } from '@bprogress/next/app';
import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useRef, useState } from 'react';
import {
  cancelVideoUploadAction,
  finishVideoUploadAction,
  startVideoUploadAction,
} from '@/app/actions/videos';
import { safely } from '@/lib/safe-action';
import { ActionForm } from '@/components/action-form';
import { Segmented } from '@/components/attempt-form';
import { FormActions } from '@/components/form-actions';
import { ErrorText, Field, FieldLabel, Select, TextArea } from '@/components/layout-ui';
import { buttonVariants } from '@/components/ui/button';
import type { Attempt } from '@/lib/data';
import type { JumpEvent } from '@/lib/events';
import { NOTE_MAX_LENGTH } from '@/lib/limits';
import { formatMark, type Units } from '@/lib/units';
import { isVideoType, MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS, type VideoType } from '@/lib/videos';

/** 動画の長さを読むのを待つ時間（5秒） */
const DURATION_TIMEOUT_MS = 5000;
/** 長さの上限に許す端数（秒） */
const DURATION_SLACK_SECONDS = 0.5;
/** 成功の応答（2xx）の上の境 */
const SUCCESS_STATUS_END = 300;

/** ファイルの種類。空で来るブラウザがあるので、そのときは拡張子で決める */
function videoType(file: File): VideoType | null {
  if (isVideoType(file.type)) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'mov') return 'video/quicktime';
  if (extension === 'mp4' || extension === 'm4v') return 'video/mp4';
  if (extension === 'webm') return 'video/webm';
  return null;
}

/**
 * 動画の長さ（秒）。読めなければ null。PC の録画の webm は長さが入っておらず（Infinity）、
 * iPhone の HEVC の mov は PC のブラウザでは開けないことがある。どちらも正しい動画なので、
 * 読めないときは長さを確かめずに通す（大きさの上限は R2 の署名で守る）。5秒待っても返らなければ読めない扱い
 */
function readDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const timer = setTimeout(() => resolve(null), DURATION_TIMEOUT_MS);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      resolve(Number.isFinite(video.duration) ? video.duration : null);
    };
    video.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    video.src = url;
  });
}

/** R2 へ直接送る。進み具合を返すため fetch ではなく XMLHttpRequest */
function put(url: string, file: File, type: string, onProgress: (percent: number) => void) {
  return new Promise<boolean>((resolve) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    request.setRequestHeader('Content-Type', type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => resolve(request.status >= 200 && request.status < SUCCESS_STATUS_END);
    request.onerror = () => resolve(false);
    request.send(file);
  });
}

type Chosen = { file: File; type: VideoType; preview: string };

/**
 * 動画を1本足す（/log/[day]/videos/new）。ファイルを選ぶとその場で見本を出し、長さと大きさを確かめる。
 * 保存で、枠を取る → R2 へ直接送る → 届いたのを確かめる、の順に進め、終わったらその日の画面へ戻る。
 * 種目・練習か試合か・その日の試技（任意）・メモを付ける。元のサイトは日に付けていて、試技には付けていなかった
 */
export function VideoForm({
  day,
  events,
  initialEvent,
  attempts,
  units,
  backHref,
}: {
  day: string;
  events: JumpEvent[];
  initialEvent: JumpEvent;
  /** その日の試技（結び付ける先の候補） */
  attempts: Attempt[];
  units: Units;
  backHref: string;
}) {
  const t = useTranslations('videos');
  const tToday = useTranslations('today');
  const tEvents = useTranslations('events');
  const tErrors = useTranslations('errors');
  const tProfile = useTranslations('profile');
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [event, setEvent] = useState<JumpEvent>(initialEvent);
  const [kind, setKind] = useState<'practice' | 'competition'>('practice');
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [fileError, setFileError] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  // 見本の URL は、選び直したときと画面を離れるときに捨てる
  useEffect(() => () => (chosen ? URL.revokeObjectURL(chosen.preview) : undefined), [chosen]);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    const type = videoType(file);
    const preview = URL.createObjectURL(file);
    const duration = type && file.size <= MAX_VIDEO_BYTES ? await readDuration(preview) : null;
    // 長さは少しの端数を許す（60.02 秒のような記録が混ざる）。読めない長さは確かめない
    if (
      !type ||
      file.size > MAX_VIDEO_BYTES ||
      (duration !== null && duration > MAX_VIDEO_SECONDS + DURATION_SLACK_SECONDS)
    ) {
      URL.revokeObjectURL(preview);
      setChosen(null);
      setFileError(true);
      return;
    }
    setFileError(false);
    setChosen({ file, type, preview });
  };

  const [state, action, pending] = useActionState(
    async (_previous: unknown, formData: FormData) => {
      if (!chosen) return { ok: false as const, error: 'videoFile' };
      // 3つの呼び出しは、電波が切れるなどで投げられても誤りの値で戻る（src/lib/safe-action.ts）
      const started = await safely(() =>
        startVideoUploadAction({
          day,
          event,
          kind,
          attemptId: String(formData.get('attemptId') ?? ''),
          note: String(formData.get('note') ?? ''),
          sizeBytes: chosen.file.size,
          contentType: chosen.type,
        }),
      );
      if (!started.ok) return started;
      setProgress(0);
      const sent = await put(started.url, chosen.file, started.contentType, setProgress);
      const finished = sent ? await safely(() => finishVideoUploadAction(started.id)) : null;
      setProgress(null);
      if (!finished?.ok) {
        // 取った枠をすぐ外す（残すと合計を食い、やり直すたびに1本分ずつ減っていく）。
        // 外す呼び出しも届かなければ、3時間たった枠は次の追加のときに消える
        await safely(() => cancelVideoUploadAction(started.id));
        return { ok: false as const, error: 'videoUpload' };
      }
      router.push(backHref);
      return { ok: true as const };
    },
    null,
  );

  const choices = attempts.filter((a) => a.event === event);
  const error = fileError ? 'videoFile' : state?.ok === false ? state.error : null;

  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <FieldLabel label={t('file')} required={tProfile('required')} />
        {chosen && (
          <video
            src={chosen.preview}
            controls
            playsInline
            className="aspect-video w-full rounded-2xl bg-muted object-contain"
          />
        )}
        <input
          ref={input}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            void choose(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'w-fit' })}
        >
          {chosen ? t('change') : t('choose')}
        </button>
      </div>
      {events.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <FieldLabel label={tProfile('events')} />
          <Segmented options={events} value={event} label={(e) => tEvents(e)} onChange={setEvent} />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <FieldLabel label={tToday('kind')} />
        <Segmented
          options={['practice', 'competition'] as const}
          value={kind}
          label={(k) => tToday(k)}
          onChange={setKind}
        />
      </div>
      {choices.length > 0 && (
        <Field label={t('attempt')}>
          {/* 種目を替えたら選び直す（ほかの種目の試技を結び付けないように） */}
          <Select key={event} name="attemptId" defaultValue="">
            <option value="">{t('attemptNone')}</option>
            {choices.map((a, index) => (
              <option key={a.id} value={a.id}>
                {`${index + 1}. ${formatMark(a.markM, units)} · ${tToday(a.kind)}`}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label={t('note')}>
        <TextArea name="note" maxLength={NOTE_MAX_LENGTH} />
      </Field>
      <FormActions
        label={tToday('save')}
        pending={pending}
        disabled={!chosen}
        message={
          progress !== null ? (
            <span className="text-sm text-muted-foreground tabular-nums">
              {t('uploading', { percent: progress })}
            </span>
          ) : (
            <ErrorText>{error ? tErrors(error as 'generic') : null}</ErrorText>
          )
        }
      />
    </ActionForm>
  );
}
