import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/**
 * 入力の画面のいちばん下の行。右に保存のボタン1つ、左に結果（誤り・保存しました）。
 * キャンセルは置かない（上の戻るリンクとブラウザの戻るで足りる）。ボタンの文言はどの画面も「保存」
 * （試技だけ「追加」で、キャンセルと2つ並んでいた。本人、2026-10-11）
 */
export function FormActions({
  label,
  pending,
  disabled,
  message,
}: {
  label: string;
  pending: boolean;
  disabled?: boolean;
  /** 左に出す結果。無ければ空 */
  message?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-end gap-3">
      {message}
      <Button type="submit" disabled={pending || disabled}>
        {label}
      </Button>
    </div>
  );
}
