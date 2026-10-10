'use client';

import { useTranslations } from 'next-intl';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * 消す前の確認。ボタンは「キャンセル / OK」で、実行する側に動作名を入れない（spatto と同じ決まり）。
 * 開いたときに OK へ焦点を当てない（Enter の押し間違いで消さないため）
 */
export function ConfirmDialog({
  open,
  title,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('today');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {t('ok')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
