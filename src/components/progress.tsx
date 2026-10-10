'use client';

import { ProgressProvider } from '@bprogress/next/app';
import type { ReactNode } from 'react';

/**
 * ページを移るあいだ、画面の上端にアプリの青の細い線を出す（@bprogress/next。vocafy などほかのリポジトリと同じ）。
 * 回る印は出さない。拾えるのはリンクを押したときだけなので、コードから移るときは next/navigation でなく
 * @bprogress/next/app の useRouter を使う。戻る・進むは移り終えるのを待たずに線を消すので出さない（vocafy と同じ）
 */
export function Progress({ children }: { children: ReactNode }) {
  return (
    <ProgressProvider
      height="3px"
      color="var(--primary)"
      options={{ showSpinner: false }}
      shallowRouting
    >
      {children}
    </ProgressProvider>
  );
}
