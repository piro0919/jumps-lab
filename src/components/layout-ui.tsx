import { cn } from 'cn';
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
      <h1 className="text-[32px] leading-tight font-extrabold tracking-tight">{children}</h1>
      {action}
    </div>
  );
}

/**
 * 数字を主役にした1項目（手本の Nike Run Club の「20.6 / Miles」の形）。
 * 数字は細長く太い斜体の字で大きく、単位は横に小さく、ラベルは下に小さく置く。
 * 値が無いときは薄いダッシュ
 */
export function Stat({
  value,
  label,
  size = 'md',
  inverse = false,
  color,
}: {
  value: { value: string; unit: string } | string | number | null;
  label: string;
  size?: 'giant' | 'hero' | 'md' | 'sm';
  /** 色付きの地の上。字をすべて白にする（薄めると 4.5 を割るので薄めない） */
  inverse?: boolean;
  /** 数字の色（種目の色など）。無ければ地の字の色 */
  color?: string;
}) {
  const parts =
    value === null ? null : typeof value === 'object' ? value : { value: String(value), unit: '' };
  const numberSize = {
    giant: 'text-[88px] leading-[0.85]',
    hero: 'text-[64px] leading-[0.95]',
    md: 'text-[30px] leading-none',
    sm: 'text-[22px] leading-none',
  }[size];
  const sub = inverse ? 'text-white' : 'text-muted-foreground';

  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-baseline gap-1">
        <span
          className={cn(
            'font-display font-extrabold tracking-tight tabular-nums italic',
            numberSize,
            parts !== null && color,
            parts === null && (inverse ? 'text-white/50' : 'text-muted-foreground/40'),
          )}
        >
          {parts === null ? '—' : parts.value}
        </span>
        {parts?.unit && (
          <span className={cn('font-display text-xl font-bold italic', sub)}>{parts.unit}</span>
        )}
      </span>
      <span className={cn('text-[13px] font-semibold', sub)}>{label}</span>
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={cn('mx-4 rounded-3xl bg-card p-5', className)}>{children}</section>;
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

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <p className="text-sm text-destructive">{children}</p> : null;
}

/**
 * 切り替えの1つ分の見た目（手本の Nike Run Club の W・M・Y・All）。選んだものを丸く塗る。
 * 並べる外側は SEGMENTS
 */
export function segmentClass(active: boolean) {
  return cn(
    'flex h-9 items-center justify-center rounded-full px-4 text-sm font-bold whitespace-nowrap transition-colors',
    active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
  );
}

export const SEGMENTS = 'flex w-fit gap-1 rounded-full bg-muted p-1';
