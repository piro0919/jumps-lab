import { addDays } from '@/lib/dates';

/**
 * コーチと選手のコメント（2026-10-14 に本人と決めた。「簡単に」）。選手の1日に付き、チームごとに分かれる。
 * 書けるのは、コーチが選手の画面で見られる日（選手の時間帯の今日を含む直近14日）だけ。
 * それより前の日に選手が書いても、コーチの画面には出ないので、見るだけにする
 */

/** コーチが見る選手の日数。コメントを書ける日も同じ（選手の時間帯の今日を含む直近14日） */
export const MEMBER_RECENT_DAYS = 14;

/** その日にコメントを書けるか。today は選手の時間帯の今日 */
export function commentOpen(day: string, today: string): boolean {
  return day <= today && day >= addDays(today, 1 - MEMBER_RECENT_DAYS);
}

/** コメントの書き手が、見ている人から見て誰か（自分・コーチ・選手） */
export type CommentRole = 'you' | 'coach' | 'athlete';

export function commentRole(
  comment: { authorId: string; byCoach: boolean },
  viewerId: string,
): CommentRole {
  if (comment.authorId === viewerId) return 'you';
  return comment.byCoach ? 'coach' : 'athlete';
}

/** 画面に出すコメント1つ。役は見ている人から見た書き手（自分・コーチ・選手） */
export type CommentItem = {
  id: string;
  authorName: string;
  role: CommentRole;
  body: string;
  /** 書いた時刻（ISO 8601） */
  createdAt: string;
};

/** DB のコメントを、見ている人から見た画面のコメントにする（選手の日の画面とコーチの選手の画面） */
export function toCommentItem(
  comment: {
    id: string;
    authorId: string;
    authorName: string;
    byCoach: boolean;
    body: string;
    createdAt: Date;
  },
  viewerId: string,
): CommentItem {
  return {
    id: comment.id,
    authorName: comment.authorName,
    role: commentRole(comment, viewerId),
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
  };
}
