import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';

/**
 * ボタンの決まり（shadcn/ui の生成物を、この画面の決まりに書き換えたもの）。
 * 形はどれも丸いボタン（手本の Nike Run Club）。置く場所で寸法を足さず、variant と size で選ぶ。
 *
 * variant: default（黒。押すと結果が起きるもの）・secondary（灰色。追加以外の控えめな操作・キャンセル）・
 *          ghost（地なし。アイコンだけのボタン）・destructive（消す）・outline（確認の窓のキャンセル）
 * size:    sm（36px。見出しの横・カードの中）・default（44px。フォームの下の送信）・icon（36px 角）
 *
 * ボタンの形のリンクは buttonVariants でクラスを作って Link に付ける
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-bold whitespace-nowrap transition outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-foreground text-background hover:bg-foreground/85',
        secondary: 'bg-muted text-foreground hover:bg-accent',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
        destructive: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
        outline: 'border border-border bg-card text-foreground hover:bg-accent',
      },
      size: {
        sm: 'h-9 px-4 text-sm',
        default: 'h-11 px-6 text-[15px]',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
