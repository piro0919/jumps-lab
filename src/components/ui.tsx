import type { ComponentProps, ReactNode } from 'react';

/**
 * 画面の部品。どの画面も同じ形を使う。
 * 大見出し → 白い面 → 項目、の並び（Strong の画面の型）
 */

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 px-4 pt-6 pb-3">
      <h1 className="text-[28px] leading-tight font-bold tracking-tight">{children}</h1>
      {action}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`mx-4 rounded-2xl bg-surface p-4 ${className}`}>{children}</section>;
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-semibold">{children}</h2>
      {action}
    </div>
  );
}

/**
 * 欄の見出し。必須の欄にだけ印を付ける（必須の方が少ないので、少ない側に付ける）。
 * 印の文言は使う側が渡す（言語ごとに違うため）
 */
export function FieldLabel({ label, required }: { label: string; required?: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[13px] font-medium text-sub">
      {label}
      {required && (
        <span className="rounded bg-danger/10 px-1.5 py-px text-[11px] font-semibold text-danger">
          {required}
        </span>
      )}
    </span>
  );
}

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <FieldLabel label={label} required={required} />
      {children}
    </label>
  );
}

const inputClass =
  'h-11 w-full min-w-0 rounded-xl bg-field px-3 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent';

export function Input(props: ComponentProps<'input'>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function Select(props: ComponentProps<'select'>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function TextArea(props: ComponentProps<'textarea'>) {
  return (
    <textarea
      {...props}
      className={`min-h-24 w-full rounded-xl bg-field p-3 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent ${props.className ?? ''}`}
    />
  );
}

/** 押すと結果が起きるボタン。濃い青はこれだけに使う */
export function PrimaryButton(props: ComponentProps<'button'>) {
  return (
    <button
      {...props}
      className={`inline-flex h-11 items-center justify-center rounded-xl bg-accent px-5 text-[15px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-40 ${props.className ?? ''}`}
    />
  );
}

/** 控えめなボタン。追加・キャンセルなど */
export function SubtleButton(props: ComponentProps<'button'>) {
  return (
    <button
      {...props}
      className={`inline-flex h-9 items-center justify-center gap-1 rounded-full bg-accent-soft px-3.5 text-sm font-semibold text-accent transition active:scale-[0.98] disabled:opacity-40 ${props.className ?? ''}`}
    />
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <p className="text-sm text-danger">{children}</p> : null;
}
