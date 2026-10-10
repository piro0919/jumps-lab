'use client';

import { type ComponentProps, useEffect, useRef, useTransition } from 'react';

/**
 * Server Action を送るフォーム。<form action> に渡すと、React は送り終えた時点で入力を空に戻す。
 * 保存に失敗したときに書いた文が消えるので、ここで送り方を変えて入力を残す。
 * 押したボタンの name と value（消去のボタンなど）も一緒に送る。
 * 送っている間は次の送信を受けない（Enter の連打や、Enter のあとのボタンで同じ記録が2本入らないように）
 */
export function ActionForm({
  action,
  ...props
}: Omit<ComponentProps<'form'>, 'action' | 'onSubmit'> & {
  action: (formData: FormData) => void;
}) {
  const [pending, startTransition] = useTransition();
  const sending = useRef(false);
  useEffect(() => {
    if (!pending) sending.current = false;
  }, [pending]);
  return (
    <form
      {...props}
      onSubmit={(event) => {
        event.preventDefault();
        if (sending.current) return;
        sending.current = true;
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        const formData = new FormData(event.currentTarget, submitter);
        startTransition(() => action(formData));
      }}
    />
  );
}
