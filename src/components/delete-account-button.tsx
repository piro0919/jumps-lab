'use client';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useRef, useState } from 'react';
import { GoogleButton } from '@/app/sign-in/google-button';
import { ErrorText, Field, Input } from '@/components/layout-ui';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { deleteAccount } from '@/lib/sign-out';

type State = 'idle' | 'pending' | 'stale' | 'failed';

/**
 * 設定のアカウントの区画の「アカウントを削除」。確認の窓で自分のメールをそのまま打つまで、消すボタンは押せない。
 * 二度押し（Enter も）は ref で止める。ログインから時間がたっていて断られたら、ログインし直すボタンを出す
 * （断られたときは何も消えていない。src/lib/auth.ts の deleteUser の順番）。
 * 消せたら、ページを読み直してログインしていないトップ（LP）へ移る（前の人の画面を残さない）
 */
export function DeleteAccountButton({ email }: { email: string }) {
  const t = useTranslations('profile');
  const tToday = useTranslations('today');
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [state, setState] = useState<State>('idle');
  const busy = useRef(false);
  // 打ち込みの大文字小文字は問わない（スマホのキーボードが先頭を大文字にすることがある）
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  const onOpenChange = (next: boolean) => {
    // 消している最中は閉じない（閉じても止まらず、結果が見えなくなる）
    if (busy.current) return;
    setOpen(next);
    if (!next) {
      setTyped('');
      setState('idle');
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!matches || busy.current) return;
    busy.current = true;
    setState('pending');
    const result = await deleteAccount();
    if (result === 'deleted') {
      window.location.replace('/');
      return;
    }
    busy.current = false;
    setState(result);
  };

  return (
    <>
      <Button variant="secondary" size="sm" type="button" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden />
        {t('deleteAccount')}
      </Button>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <form onSubmit={submit} className="grid gap-4">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('deleteAccountTitle')}</AlertDialogTitle>
            </AlertDialogHeader>
            {state === 'stale' ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm">{t('deleteAccountStale')}</p>
                <GoogleButton callbackURL="/settings" />
              </div>
            ) : (
              <Field label={t('deleteAccountConfirm', { email })}>
                <Input
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  type="email"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={state === 'pending'}
                />
              </Field>
            )}
            {state === 'failed' && <ErrorText>{t('deleteAccountFailed')}</ErrorText>}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={state === 'pending'}>
                {tToday('cancel')}
              </AlertDialogCancel>
              {state !== 'stale' && (
                <Button
                  variant="destructive"
                  type="submit"
                  disabled={!matches || state === 'pending'}
                >
                  {tToday('ok')}
                </Button>
              )}
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
