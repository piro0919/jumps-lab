import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Input as ShadcnInput } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
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
  return <section className={`mx-4 rounded-2xl bg-card p-4 ${className}`}>{children}</section>;
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
    <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
      {label}
      {required && (
        <span className="rounded bg-destructive/10 px-1.5 py-px text-[11px] font-semibold text-destructive">
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

/*
 * 入力とボタンは shadcn/ui（Base UI 版）の部品に、この画面の寸法を載せて使う。
 * 入力欄は枠を消して灰色の地にする（Strong の入力欄）。指で押しやすいよう高さは 44px
 */
const fieldClass = 'h-11 rounded-xl border-transparent bg-muted px-3 text-base md:text-base';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <ShadcnInput {...props} className={cn(fieldClass, className)} />;
}

export function Select({ className, children, ...props }: Omit<ComponentProps<'select'>, 'size'>) {
  return (
    <NativeSelect
      {...props}
      className={cn(
        'w-full [&_select]:h-11 [&_select]:rounded-xl [&_select]:border-transparent [&_select]:bg-muted [&_select]:pl-3 [&_select]:text-base',
        className,
      )}
    >
      {children}
    </NativeSelect>
  );
}

export function TextArea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <Textarea
      {...props}
      className={cn(
        'min-h-24 rounded-xl border-transparent bg-muted p-3 text-base md:text-base',
        className,
      )}
    />
  );
}

/** 押すと結果が起きるボタン。濃い青はこれだけに使う */
export function PrimaryButton({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      className={cn(
        'h-11 rounded-xl px-5 text-[15px] font-semibold active:scale-[0.98]',
        className,
      )}
    />
  );
}

/** 控えめなボタン。追加・キャンセルなど */
export function SubtleButton({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="secondary"
      {...props}
      className={cn('h-9 rounded-full px-3.5 font-semibold active:scale-[0.98]', className)}
    />
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <p className="text-sm text-destructive">{children}</p> : null;
}
