'use client';

import { SendHorizontal, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useActionState, useRef, useState, useTransition } from 'react';
import { addCommentAction, deleteCommentAction } from '@/app/actions/comments';
import { ActionForm } from '@/components/action-form';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Badge, Card, CardTitle, EmptyState, ErrorText, TextArea } from '@/components/layout-ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { CommentItem } from '@/lib/comments';
import { COMMENT_MAX_LENGTH, COMMENTS_PER_DAY } from '@/lib/limits';
import { safely } from '@/lib/safe-action';

/**
 * コーチと選手のやりとり（2026-10-14）。選手の1日・1チームに1つ。古い順に並べ、下に書く欄を置く。
 * 自分のコメントは右に青で、相手のものは左に灰色で（AI コーチの相談と同じ形）。直すことはできず、
 * 自分のものだけ確かめてから消せる。form が無ければ見るだけ（抜けたチームのやりとり、書ける日を過ぎた日）。
 * collapsed のときは、まだコメントの無い日は「コメントを書く」ボタンだけにし、押すと書く欄を出す
 * （コーチの選手の画面で、空の書く欄が14日分並んで長くなった。2026-10-15）
 */
export function CommentThread({
  title,
  comments,
  timeZone,
  form,
  collapsed = false,
}: {
  title: string;
  comments: CommentItem[];
  /** 時刻を出す時間帯（見ている人の設定） */
  timeZone: string;
  /** 書く先。athleteId はコーチの画面から書くときだけ */
  form: { teamId: string; day: string; athleteId?: string } | null;
  /** コメントの無い日は書く欄を畳んでおく */
  collapsed?: boolean;
}) {
  const t = useTranslations('comments');
  const tErrors = useTranslations('errors');
  const format = useFormatter();
  const formRef = useRef<HTMLFormElement>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const folded = collapsed && comments.length === 0 && !opened;
  const [, startTransition] = useTransition();
  const [state, action, pending] = useActionState(async (_previous: unknown, data: FormData) => {
    const result = await safely(() => addCommentAction(null, data));
    // 送れたら欄を空にする（失敗したら書いた文を残す）
    if (result?.ok) formRef.current?.reset();
    return result;
  }, null);

  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div className="flex flex-col gap-4">
        {folded && form ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => {
              setOpened(true);
              // 開いた欄にそのまま書けるようにする（描き直しの後で欄に移る）
              requestAnimationFrame(() => formRef.current?.querySelector('textarea')?.focus());
            }}
          >
            {t('write')}
          </Button>
        ) : comments.length === 0 ? (
          <EmptyState message={t('empty')} />
        ) : (
          <ul className="flex flex-col gap-3">
            {comments.map((comment) => {
              const mine = comment.role === 'you';
              return (
                <li
                  key={comment.id}
                  className={cn('flex max-w-5/6 flex-col gap-1', mine ? 'self-end' : 'self-start')}
                >
                  <div
                    className={cn(
                      'flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground',
                      mine && 'justify-end',
                    )}
                  >
                    <span className="font-bold text-foreground">{comment.authorName}</span>
                    {comment.role !== 'athlete' && (
                      <Badge tone={comment.role === 'coach' ? 'accent' : 'neutral'}>
                        {t(comment.role)}
                      </Badge>
                    )}
                    <time dateTime={comment.createdAt}>
                      {format.dateTime(new Date(comment.createdAt), {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZone,
                      })}
                    </time>
                  </div>
                  <div className={cn('flex items-start gap-1', mine && 'flex-row-reverse')}>
                    <p
                      className={cn(
                        'rounded-2xl px-4 py-2.5 text-sm break-words whitespace-pre-wrap',
                        mine ? 'bg-primary text-primary-foreground' : 'bg-muted',
                      )}
                    >
                      {comment.body}
                    </p>
                    {mine && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t('delete')}
                        onClick={() => setRemoving(comment.id)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {form && !folded && (
          <ActionForm ref={formRef} action={action} className="flex items-end gap-2">
            <input type="hidden" name="teamId" value={form.teamId} />
            <input type="hidden" name="day" value={form.day} />
            {form.athleteId && <input type="hidden" name="athleteId" value={form.athleteId} />}
            <TextArea
              name="body"
              aria-label={t('write')}
              placeholder={t('placeholder')}
              maxLength={COMMENT_MAX_LENGTH}
              required
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={pending} aria-label={t('send')}>
              <SendHorizontal aria-hidden />
            </Button>
          </ActionForm>
        )}
        <ErrorText>
          {state?.ok === false
            ? state.error === 'commentLimit'
              ? tErrors('commentLimit', { count: COMMENTS_PER_DAY })
              : tErrors(state.error as 'generic')
            : null}
        </ErrorText>
      </div>
      <ConfirmDialog
        open={removing !== null}
        title={t('deleteConfirm')}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        onConfirm={() => {
          const id = removing;
          if (id) startTransition(() => deleteCommentAction(id));
        }}
      />
    </Card>
  );
}
