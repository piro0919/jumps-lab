'use client';

import { type ComponentProps, useTransition } from 'react';

/**
 * Server Action を送るフォーム。<form action> に渡すと、React は送り終えた時点で入力を空に戻す。
 * 保存に失敗したときに書いた文が消えるので、ここで送り方を変えて入力を残す。
 * 押したボタンの name と value（消去のボタンなど）も一緒に送る
 */
export function ActionForm({
  action,
  ...props
}: Omit<ComponentProps<'form'>, 'action' | 'onSubmit'> & {
  action: (formData: FormData) => void;
}) {
  const [, startTransition] = useTransition();
  return (
    <form
      {...props}
      onSubmit={(event) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        const formData = new FormData(event.currentTarget, submitter);
        startTransition(() => action(formData));
      }}
    />
  );
}
