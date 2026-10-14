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
import type { CommentRole } from '@/lib/comments';
import { COMMENT_MAX_LENGTH } from '@/lib/limits';
import { safely } from '@/lib/safe-action';

/** 画面に出すコメント1つ。役は見ている人から見た書き手（自分・コーチ・選手） */
export type CommentItem = {
  id: string;
  authorName: string;
  role: CommentRole;
  body: string;
  /** 書いた時刻（ISO 8601） */
  createdAt: string;
};

/**
 * コーチと選手のやりとり（2026-10-14）。選手の1日・1チームに1つ。古い順に並べ、下に書く欄を置く。
 * 自分のコメントは右に青で、相手のものは左に灰色で（AI コーチの相談と同じ形）。直すことはできず、
 * 自分のものだけ確かめてから消せる。form が無ければ見るだけ（抜けたチームのやりとり、書ける日を過ぎた日）
 */
export function CommentThread({
  title,
  comments,
  timeZone,
  form,
}: {
  title: string;
  comments: CommentItem[];
  /** 時刻を出す時間帯（見ている人の設定） */
  timeZone: string;
  /** 書く先。athleteId はコーチの画面から書くときだけ */
  form: { teamId: string; day: string; athleteId?: string } | null;
}) {
  const t = useTranslations('comments');
  const tErrors = useTranslations('errors');
  const format = useFormatter();
  const formRef = useRef<HTMLFormElement>(null);
  const [removing, setRemoving] = useState<string | null>(null);
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
        {comments.length === 0 ? (
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
        {form && (
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
        <ErrorText>{state?.ok === false ? tErrors(state.error as 'generic') : null}</ErrorText>
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
