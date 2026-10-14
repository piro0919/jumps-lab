'use server';

import { refresh } from 'next/cache';
import { z } from 'zod';
import {
  addVideoAngle,
  completeVideo,
  deleteVideoAngle,
  deleteVideo,
  getPendingVideo,
  getProfile,
  releaseStaleVideos,
  releaseVideo,
  reserveVideo,
  setVideoMark,
} from '@/lib/data';
import { isDay, todayIn } from '@/lib/dates';
import { EVENTS } from '@/lib/events';
import { optionalText } from '@/lib/form';
import { ANGLES_PER_VIDEO, NOTE_MAX_LENGTH } from '@/lib/limits';
import { deleteObject, objectSize, uploadUrl } from '@/lib/r2';
import {
  MAX_VIDEO_BYTES,
  USER_VIDEO_BYTES,
  VIDEO_KEEP_DAYS,
  VIDEO_TYPES,
  videoKey,
} from '@/lib/videos';
import { angleInputSchema, measure, type Angle, type AngleInput } from '@/lib/video-angles';
import { markInputSchema, type MarkInput, type Marks } from '@/lib/video-marks';
import { requireViewer } from '@/lib/viewer';

/**
 * 動画を足す・消す。送り方は3段:
 * 1. startVideoUploadAction で枠を取り、ブラウザが R2 へ直接送るための署名 URL を返す
 * 2. ブラウザがその URL へファイルを送る（関数を通さない。大きさと種類は署名で縛ってある）
 * 3. finishVideoUploadAction で R2 に届いた大きさを確かめ、見せる状態にする
 */

const startSchema = z.object({
  day: z.string().refine(isDay),
  event: z.enum(EVENTS),
  kind: z.enum(['practice', 'competition']),
  attemptId: z.preprocess((v) => (v === '' ? null : v), z.uuid().nullable()),
  note: optionalText(NOTE_MAX_LENGTH),
  sizeBytes: z.coerce.number().int().min(1).max(MAX_VIDEO_BYTES),
  contentType: z.enum(VIDEO_TYPES),
});

type StartResult =
  | { ok: true; id: string; url: string; contentType: string }
  | { ok: false; error: 'videoQuota' | 'videoFile' | 'generic' };

export async function startVideoUploadAction(input: {
  day: string;
  event: string;
  kind: string;
  attemptId: string;
  note: string;
  sizeBytes: number;
  contentType: string;
}): Promise<StartResult> {
  const viewer = await requireViewer();
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return {
      ok: false,
      error: field === 'sizeBytes' || field === 'contentType' ? 'videoFile' : 'generic',
    };
  }
  const video = parsed.data;
  const profile = await getProfile(viewer.userId);
  // 先の日には足せない（試技と同じ）。種目は本人の選んだ種目だけ
  if (!profile || video.day > todayIn(profile.timeZone) || !profile.events.includes(video.event)) {
    return { ok: false, error: 'generic' };
  }
  try {
    // 届かずに残った枠と、期限を過ぎた動画の行を外してから数える（途中で閉じた送信が、合計を食い続けないように）
    for (const key of await releaseStaleVideos(viewer.userId)) {
      await deleteObject(key).catch(() => {});
    }
    const id = crypto.randomUUID();
    const objectKey = videoKey(viewer.userId, id, video.contentType);
    const reserved = await reserveVideo(
      viewer.userId,
      { ...video, id, objectKey },
      USER_VIDEO_BYTES,
      VIDEO_KEEP_DAYS,
    );
    if (!reserved) return { ok: false, error: 'videoQuota' };
    const url = await uploadUrl(objectKey, video.sizeBytes, video.contentType);
    return { ok: true, id, url, contentType: video.contentType };
  } catch (error) {
    console.error(error);
    return { ok: false, error: 'generic' };
  }
}

/** R2 に届いた大きさが、枠を取ったときの申告と同じなら見せる。違えば枠もファイルも捨てる */
export async function finishVideoUploadAction(id: string): Promise<{ ok: boolean }> {
  const viewer = await requireViewer();
  if (!z.uuid().safeParse(id).success) return { ok: false };
  try {
    const pending = await getPendingVideo(viewer.userId, id);
    if (!pending) return { ok: false };
    const size = await objectSize(pending.objectKey);
    if (size !== pending.sizeBytes) {
      await deleteVideo(viewer.userId, id);
      if (size !== null) await deleteObject(pending.objectKey);
      return { ok: false };
    }
    const done = await completeVideo(viewer.userId, id);
    if (done) refresh();
    return { ok: done };
  } catch (error) {
    console.error(error);
    return { ok: false };
  }
}

/** 送れなかったときに、取った枠をすぐ外す（外さないと、3時間のあいだ合計を食う） */
export async function cancelVideoUploadAction(id: string): Promise<void> {
  const viewer = await requireViewer();
  if (!z.uuid().safeParse(id).success) return;
  const key = await releaseVideo(viewer.userId, id);
  if (key) await deleteObject(key).catch((error) => console.error(error));
}

/**
 * 動画に時間の目印を1つ置く（time が null なら外す）。本人の、届いていて期限の過ぎていない動画だけ。
 * 置いたあとの目印を返し、画面はそれで描き直す（見比べる画面はその場で描くので refresh しない）
 */
export async function setVideoMarkAction(
  input: MarkInput,
): Promise<{ ok: true; marks: Marks } | { ok: false; error: 'generic' }> {
  const viewer = await requireViewer();
  const parsed = markInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'generic' };
  const { videoId, mark, time } = parsed.data;
  try {
    const marks = await setVideoMark(viewer.userId, videoId, mark, time);
    return marks ? { ok: true, marks } : { ok: false, error: 'generic' };
  } catch (error) {
    console.error(error);
    return { ok: false, error: 'generic' };
  }
}

/**
 * 動画に手で測った角度を1つ保存する。本人の、届いていて期限の過ぎていない動画だけ。
 * 度数はブラウザから受け取らず、点と動画の本来の幅・高さから求め直す（点が重なって決まらなければ保存しない）。
 * 見比べる画面はその場で描くので refresh しない
 */
export async function addVideoAngleAction(
  input: AngleInput,
): Promise<{ ok: true; angle: Angle } | { ok: false; error: 'generic' | 'angleLimit' }> {
  const viewer = await requireViewer();
  const parsed = angleInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'generic' };
  const { videoId, name, kind, time, points, frameWidth, frameHeight } = parsed.data;
  const degrees = measure(kind, points, { width: frameWidth, height: frameHeight });
  if (degrees === null) return { ok: false, error: 'generic' };
  try {
    const result = await addVideoAngle(
      viewer.userId,
      { videoId, name, kind, time, points, frameWidth, frameHeight, degrees },
      ANGLES_PER_VIDEO,
    );
    if (result === 'denied') return { ok: false, error: 'generic' };
    if (result === 'limit') return { ok: false, error: 'angleLimit' };
    return { ok: true, angle: result };
  } catch (error) {
    console.error(error);
    return { ok: false, error: 'generic' };
  }
}

/**
 * 本人の動画の測定を1つ消す。もう無い測定（別の画面で消した・2回目の押下）も、消えているので ok を返す
 * （画面はその行を外すだけ。ほかの人の測定は deleteVideoAngle が消さないので、ok を返しても何も起きない）
 */
export async function deleteVideoAngleAction(id: string): Promise<{ ok: boolean }> {
  const viewer = await requireViewer();
  if (!z.uuid().safeParse(id).success) return { ok: false };
  try {
    await deleteVideoAngle(viewer.userId, id);
    return { ok: true };
  } catch (error) {
    console.error(error);
    return { ok: false };
  }
}

export async function deleteVideoAction(id: string): Promise<void> {
  const viewer = await requireViewer();
  if (!z.uuid().safeParse(id).success) return;
  const key = await deleteVideo(viewer.userId, id);
  // 行を先に消す。R2 で失敗しても、画面からは消え、合計からも外れる（残ったファイルは本人には見えない）
  if (key) await deleteObject(key).catch((error) => console.error(error));
  refresh();
}
