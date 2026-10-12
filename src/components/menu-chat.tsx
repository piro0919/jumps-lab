'use client';

import { SendHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState, useRef } from 'react';
import { askMenuAction } from '@/app/actions/menu';
import { ActionForm } from '@/components/action-form';
import { Card, CardTitle, ErrorText, TextArea } from '@/components/layout-ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { MenuMessage } from '@/lib/data';
import { QUESTION_MAX_LENGTH } from '@/lib/menu';

/**
 * 今日のメニューを AI に相談して直すチャット（中元さんのフィードバックの第2段階。2026-10-12 に本人と決めた）。
 * メニューを見ながら相談できるよう、メニューの画面の下に置く。直したメニューは画面の上のカードに入れ替わる
 */
export function MenuChat({
  messages,
  readOnly = false,
}: {
  messages: MenuMessage[];
  /** 過去の日。やりとりを見るだけで、送る欄を出さない */
  readOnly?: boolean;
}) {
  const t = useTranslations('menu');
  const tErrors = useTranslations('errors');
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (previous: unknown, formData: FormData) => {
    const result = await askMenuAction(null, formData);
    // 送れたら欄を空にする（失敗したら書いた文を残す）
    if (result?.ok) formRef.current?.reset();
    return result;
  }, null);

  return (
    <Card>
      <CardTitle>{t('chatTitle')}</CardTitle>
      <div className="flex flex-col gap-4">
        {messages.length > 0 && (
          <ul className="flex flex-col gap-2">
            {messages.map((message) => (
              <li
                key={message.id}
                className={cn(
                  'max-w-5/6 rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
                  message.role === 'user'
                    ? 'self-end bg-primary text-primary-foreground'
                    : 'self-start bg-muted',
                )}
              >
                {message.content}
                {message.version !== null && (
                  <span className="mt-1 block text-xs font-bold">
                    {t('revised', { version: message.version })}
                  </span>
                )}
              </li>
            ))}
            {pending && (
              <li className="self-start rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                {t('thinking')}
              </li>
            )}
          </ul>
        )}
        {!readOnly && (
          <ActionForm ref={formRef} action={action} className="flex items-end gap-2">
            <TextArea
              name="question"
              aria-label={t('chatTitle')}
              placeholder={t('chatPlaceholder')}
              maxLength={QUESTION_MAX_LENGTH}
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
    </Card>
  );
}
