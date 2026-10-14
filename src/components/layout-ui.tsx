import { cn } from '@/lib/cn';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Input as ShadcnInput } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import TextareaAutosize, { type TextareaAutosizeProps } from 'react-textarea-autosize';
import type { ComponentProps, ReactNode } from 'react';

/**
 * 画面の部品と見た目の決まり。どの画面もここの部品と値だけを使い、その場で寸法を書き起こさない
 * （CLAUDE.md の「Design rules」。外れた書き方は test/design-rules.test.ts が落とす）。
 *
 * 字: 大見出し 32px（PageTitle）・塊の見出し 16px（SectionTitle）・本文 14px（text-sm）・
 *     欄のラベル 13px（LABEL）・小さな字 12px（text-xs）。数字は DisplayNumber と Stat だけ
 * 太さ: semibold・bold・extrabold の3つ（medium は使わない）
 * 角: ボタン・札・丸いもの full、入力欄と行 xl、面の中の小さな面 2xl、カード 3xl
 * 余白: カードどうし 12px（gap-3）、カードの内側 20px（p-5）、カードの中の塊どうし 16px（gap-4）
 * 操作: カードの題の横の操作は文字付きのボタン（追加は青・編集は灰）、一覧の1行ごとの操作はアイコンだけのボタン（鉛筆・ごみ箱）。
 *     空のときは EmptyState（文＋足すボタン）にして、題の横の操作は隠す
 * 色: アプリの色は青（primary）1つ。押すボタン・選んでいるもの・次の大会に使う。黒で塗ったものは置かない。
 *     ほかに色が付くのは、種目の4色・「今日を記録」の黄緑（brand）・消すときの赤（destructive）だけ
 */

/**
 * タブレットと PC（幅 768px 以上）の2列の組み方。スマホでは縦に積む。
 * はじめは 1024px からで、タブレットではスマホと同じ 480px の1列が真ん中に細く出ていた（2026-10-15 に 768px からに）。
 * MAIN_SIDE は「主役の列と右の列を 3:2」でホームと分析、HALVES は「同じ幅の2列」で日の画面と大会。
 * 画面ごとに列の幅を決めていて、似た形のホームと分析で色付きのカードの幅がずれた（本人、2026-10-11）。
 * 右の列は 20rem で固定していて、広い画面で種目のカードだけが伸び、右のカードの文が折り返した（本人、2026-10-11）
 */
// タブレット（768〜1023px）は同じ幅の2列。3:2 だと右の列が 290px になり、カードの題が2行に折れた
export const MAIN_SIDE =
  'flex flex-col gap-3 md:grid md:grid-cols-2 md:items-start lg:grid-cols-main-side';
export const HALVES = 'flex flex-col gap-3 md:grid md:grid-cols-2 md:items-start';
/** LP の文とスマホの枠を並べる節。枠は幅が要るので、2列にするのは 1024px から（768px ではタブレットの右端に詰まった） */
export const LP_HALVES = 'flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start';

/**
 * 入力の画面（試技の追加・コンディション・大会の追加と編集・設定）の main。幅 768px 以上では幅 42rem で真ん中に置く。
 * 一覧や表示の画面は画面いっぱい。入力の画面ごとに幅を決めていて、設定だけ広かった（本人、2026-10-11）
 */
export const FORM_PAGE = 'flex flex-col gap-3 pb-6 md:mx-auto md:w-full md:max-w-2xl';

/** 欄のラベル。入力欄の上、数字の下、スライダーの名前 */
export const LABEL = 'text-[13px] font-semibold text-muted-foreground';

/**
 * アプリのアイコン。角は辺の 22%（iPhone のアイコンと同じ形）。xl のままだと 36px でほぼ円になり、
 * 右上の顔写真の丸と見分けがつかなかった（本人、2026-10-11）
 */
const APP_ICON_SIZE = { header: 'size-9', hero: 'size-20' } as const;

export function AppIcon({ size }: { size: keyof typeof APP_ICON_SIZE }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/icon-192x192.png" alt="" className={cn('rounded-app-icon', APP_ICON_SIZE[size])} />
  );
}

/**
 * ロゴの文字（Kanit の極太の斜体、大文字）。ヘッダーとログインの画面だけで使う。
 * 書体は Google Fonts から10個を並べて本人が選んだ（2026-10-11。数字の Barlow Condensed とは分けた）
 */
const WORDMARK_SIZE = {
  // 20px では小さいと言われて 24px に（本人、2026-10-11）
  header: 'text-2xl',
  hero: 'text-[44px]',
} as const;

export function Wordmark({
  children,
  size,
  className,
}: {
  children: ReactNode;
  size: keyof typeof WORDMARK_SIZE;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'font-logo leading-none tracking-tight whitespace-nowrap uppercase italic',
        WORDMARK_SIZE[size],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * ページの題。back があれば、題の左に戻るボタン（「<」）を置く（Google のアプリと同じ形）。
 * 戻り先の名前は画面には出さず、ボタンの名前として読み上げに渡す。
 * はじめは題の上の行に「< 今日」と小さく出していて、好きじゃないと言われた（本人、2026-10-11）
 */
export function PageTitle({
  children,
  action,
  back,
  as: Tag = 'h1',
}: {
  children: ReactNode;
  action?: ReactNode;
  /** LP のスマホの枠の中では見出しにしない（ページの h1 が枠の数だけ増えるため） */
  as?: 'h1' | 'p';
  /** label は戻るボタンの読み上げの名前（「記録に戻る」の文。呼ぶ側が nav.backTo で組む） */
  back?: { href: string; label: string };
}) {
  return (
    <div className="flex items-end justify-between gap-3 px-4 pt-6 pb-3">
      <div className="flex min-w-0 items-center gap-1">
        {back && (
          <Link
            href={back.href}
            aria-label={back.label}
            className={buttonVariants({
              variant: 'ghost',
              size: 'icon',
              className: '-ml-2 shrink-0',
            })}
          >
            <ChevronLeft aria-hidden className="size-6" />
          </Link>
        )}
        <Tag className="text-page-title leading-tight font-extrabold tracking-tight">
          {children}
        </Tag>
      </div>
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

  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-baseline gap-1">
        <DisplayNumber
          size={size}
          className={cn(
            parts !== null && color,
            parts === null && (inverse ? 'text-white/50' : 'text-muted-foreground/40'),
          )}
        >
          {parts === null ? '—' : parts.value}
        </DisplayNumber>
        {parts?.unit && (
          <span
            className={cn(
              'font-display text-lg font-bold italic',
              inverse ? 'text-white' : 'text-muted-foreground',
            )}
          >
            {parts.unit}
          </span>
        )}
      </span>
      <span className={cn(LABEL, inverse && 'text-white')}>{label}</span>
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={cn('mx-4 rounded-3xl bg-card p-5', className)}>{children}</section>;
}

/** 塊の見出し（16px）。色付きのカードの上では inverse で白い字 */
export function SectionTitle({
  children,
  inverse = false,
}: {
  children: ReactNode;
  /**
   * 色付きの地の上。true は白い字（種目の色の地）。'primary' はアプリの青の地の上の字の色
   * （ダークでは青が明るくなるので、白だと 3.12 しか取れなかった）
   */
  inverse?: boolean | 'primary';
}) {
  return (
    <h2
      className={cn(
        'text-base font-extrabold',
        inverse === 'primary'
          ? 'text-primary-foreground'
          : inverse
            ? 'text-white'
            : 'text-foreground',
      )}
    >
      {children}
    </h2>
  );
}

/** カードの見出しの行。見出しの右にボタンを置ける */
export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <SectionTitle>{children}</SectionTitle>
      {action}
    </div>
  );
}

/**
 * 大きな数字。字は細長く太い斜体（Barlow Condensed）。数字はかならずこれか Stat を通す。
 * 大きさは5段: giant 88px・hero 64px・md 30px・sm 22px
 */
const DISPLAY_SIZE = {
  giant: 'text-[88px] leading-[0.85]',
  hero: 'text-[64px] leading-[0.95]',
  md: 'text-[30px] leading-none',
  sm: 'text-[22px] leading-none',
} as const;

export function DisplayNumber({
  children,
  size,
  className,
}: {
  children: ReactNode;
  size: keyof typeof DISPLAY_SIZE;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'font-display font-extrabold tracking-tight tabular-nums italic',
        DISPLAY_SIZE[size],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** 色付きのカードの右下に、大きく薄く透かす英字（種目の略字など）。カードに relative と overflow-hidden が要る */
export function Watermark({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -right-3 -bottom-8 font-display text-watermark leading-none font-extrabold text-white/10 italic select-none"
    >
      {children}
    </span>
  );
}

/**
 * 小さな札（ベスト・追い風参考・あと◯日・必須・種目の名前）。形はどれも同じで、色だけ選ぶ。
 * event は種目の色の地のクラス（EVENT_BG）を className で渡す
 */
const BADGE_TONE = {
  neutral: 'bg-muted text-muted-foreground',
  accent: 'bg-secondary text-primary',
  danger: 'bg-destructive/10 text-destructive',
  // 種目の色の上。白を重ねると地が明るくなって 3.7〜4.05 しかなかったので、黒を重ねて 6 を超える（2026-10-15）
  inverse: 'bg-black/15 text-white',
  solid: 'text-white',
} as const;

export function Badge({
  children,
  tone,
  className,
}: {
  children: ReactNode;
  tone: keyof typeof BADGE_TONE;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-bold',
        BADGE_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * 欄の見出し。必須の欄にだけ印を付ける（必須の方が少ないので、少ない側に付ける）。
 * 印の文言は使う側が渡す（言語ごとに違うため）
 */
export function FieldLabel({ label, required }: { label: string; required?: string }) {
  return (
    <span className={cn('flex items-center gap-1.5', LABEL)}>
      {label}
      {required && <Badge tone="danger">{required}</Badge>}
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

/**
 * 自由に文を書く欄（メモ・ケガ・注意事項）。2行から始めて、書いた分だけ縦に伸びる（react-textarea-autosize）。
 * メモを1行の入力欄にしていて改行できなかった（本人、2026-10-11）。CSS の field-sizing は iPhone の Safari で
 * 効くか確かめきれないので使わない。見た目は入力欄（Input）と同じ地と角
 */
export function TextArea({
  className,
  style,
  ...props
}: Omit<ComponentProps<'textarea'>, 'style'> & { style?: TextareaAutosizeProps['style'] }) {
  return (
    <TextareaAutosize
      minRows={2}
      {...props}
      style={style}
      className={cn(
        'w-full resize-none rounded-xl border border-transparent bg-muted px-3 py-2.5 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        className,
      )}
    />
  );
}

/**
 * 一覧やカードが空のときの出し方。「〜はありません」の文と、足せるものがあれば足す画面へのボタン（灰色・小）。
 * 空のときにボタンがあるカードと、文だけのカードが混ざっていて、最初に何を押せばよいか迷う画面があった（2026-10-11）
 */
export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-muted-foreground">{message}</p>
      {action && (
        <Link href={action.href} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <p className="text-sm text-destructive">{children}</p> : null;
}

/**
 * 切り替えの1つ分の見た目（手本の Nike Run Club の W・M・Y・All）。選んだものを丸く塗る。
 * 並べる外側は SEGMENTS。1つだけ選ぶものはこの形にし、複数選べるもの（種目）は離れた丸い札にする
 */
export function segmentClass(active: boolean) {
  return cn(
    'flex h-9 items-center justify-center rounded-full px-4 text-sm font-bold whitespace-nowrap transition-colors',
    active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
  );
}

export const SEGMENTS = 'flex w-fit gap-1 rounded-full bg-muted p-1';

/**
 * 選ぶものが多く、1列では 375px に収まらない切り替え（動画の目印の6つ）。中身は segmentClass のまま、
 * 3つずつの2段に並べる。外側は2段を包むので full ではなく 3xl の角
 */
export const SEGMENT_GRID = 'grid grid-cols-3 gap-1 rounded-3xl bg-muted p-1';

/** LP の見出しの下の文。LP は読ませる文が主役なので、アプリの本文（text-sm）より1段大きい */
export const LEAD = 'max-w-md text-base leading-relaxed text-muted-foreground';

/**
 * LP の大きな見出し。英字はロゴと同じ Kanit の極太の斜体・大文字で組む（Strong の「Think less. Lift more.」の型）。
 * 日本語は Kanit に字が無いので、端末の字の極太で、斜体にしない（日本語を斜めにすると崩れる）。
 * hero は1画面目、section は機能の節。アプリの画面では使わない（アプリの題は PageTitle）
 */
const HEADLINE_SIZE = {
  latin: {
    hero: 'text-[56px] leading-[0.92] lg:text-[88px]',
    section: 'text-[36px] leading-[0.95] lg:text-[48px]',
  },
  ja: {
    hero: 'text-[40px] leading-tight lg:text-[60px]',
    section: 'text-[28px] leading-snug lg:text-[36px]',
  },
} as const;

export function Headline({
  children,
  size,
  script,
  as: Tag = 'h2',
}: {
  children: ReactNode;
  size: 'hero' | 'section';
  /** 文字の種類。日本語の文は斜体と大文字にしない */
  script: 'latin' | 'ja';
  as?: 'h1' | 'h2';
}) {
  return (
    <Tag
      className={cn(
        'tracking-tight text-balance',
        script === 'latin'
          ? 'font-logo uppercase italic'
          : 'font-extrabold [word-break:auto-phrase]',
        HEADLINE_SIZE[script][size],
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * LP でアプリの画面を見せるスマホの枠。中はアプリの部品に見本のデータを流したもので、押せない（inert）。
 * 枠は灰色（黒で塗ったものは置かない）。高さを決めて、はみ出した下は地の色へ溶かす
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div
      inert
      className="relative mx-auto w-full max-w-phone rounded-phone bg-muted p-2.5 shadow-2xl select-none"
    >
      <div className="relative h-phone overflow-hidden rounded-phone-screen bg-background">
        <div className="flex flex-col gap-3 pt-4">{children}</div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-background to-transparent" />
      </div>
    </div>
  );
}
