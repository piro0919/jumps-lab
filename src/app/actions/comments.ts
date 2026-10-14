'use server';

import { refresh } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { after } from 'next/server';
import { z } from 'zod';
import {
  addCommentAsAthlete,
  addCommentAsCoach,
  type CommentWrite,
  deleteComment,
} from '@/lib/data';
import { isDay } from '@/lib/dates';
import type { ActionResult } from '@/lib/form';
import { COMMENT_MAX_LENGTH, USER_ID_MAX_LENGTH } from '@/lib/limits';
import { sendCommentPush } from '@/lib/push';
import { requireViewer } from '@/lib/viewer';

/**
 * コーチと選手のコメント（2026-10-14）。書く・消すのどちらも、押した人を requireViewer で決め、
 * コーチか・いまの選手かは src/lib/data.ts の文の中で確かめる（ブラウザから来た id を信じない）。
 * 書けたら、相手の端末への知らせを after() で送る（返事を待たせない。Cron は使わない）
 */

const commentSchema = z.object({
  teamId: z.uuid(),
  day: z.string().refine(isDay),
  body: z.string().trim().min(1).max(COMMENT_MAX_LENGTH),
  // コーチの画面から書くときだけ、選手の id が来る
  athleteId: z.string().min(1).max(USER_ID_MAX_LENGTH).optional(),
});

/**
 * コメントを書く。選手は自分の日に、コーチはいまの選手の日に。書ける日はコーチの画面に出る直近14日だけ。
 * 1人が書けるのは直近24時間に COMMENTS_PER_DAY まで（超えたら commentLimit）
 */
export async function addCommentAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = commentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'comment' };
  const { teamId, day, body } = parsed.data;
  const athleteId = parsed.data.athleteId ?? viewer.userId;

  // 書けるか（コーチか・いまの選手か・書ける日か・書きすぎていないか）は、書く文の中で確かめる（1往復）
  let written: CommentWrite;
  try {
    written =
      athleteId === viewer.userId
        ? await addCommentAsAthlete(viewer.userId, teamId, day, body)
        : await addCommentAsCoach(
            { coachId: viewer.userId, teamId, memberId: athleteId },
            day,
            body,
          );
  } catch (error) {
    // Next の redirect と notFound は投げ直す（誤りの値にすると、送り先へ移らない）
    unstable_rethrow(error);
    console.error(error);
    return { ok: false, error: 'generic' };
  }
  if (written === 'limit') return { ok: false, error: 'commentLimit' };
  if (written === 'denied') return { ok: false, error: 'generic' };

  after(async () => {
    try {
      const result = await sendCommentPush({ teamId, athleteId, authorId: viewer.userId, day });
      if (result.sent + result.failed > 0) console.info('comment push', result);
    } catch (error) {
      console.error(error);
    }
  });
  refresh();
  return { ok: true };
}

/** 自分のコメントを消す（確かめの窓のあと）。消したら画面を読み直す */
export async function deleteCommentAction(id: string): Promise<void> {
  const viewer = await requireViewer();
  if (!z.uuid().safeParse(id).success) return;
  await deleteComment(viewer.userId, id);
  refresh();
}
