import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { Barlow_Condensed, Kanit } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

// 記録の数字と英字の見出しの字（手本の Nike Run Club の、細長く太い斜体の数字）。
// 英数字だけの書体なので、日本語の文は端末の字のまま
const display = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['700', '800'],
  style: ['italic'],
  variable: '--font-barlow',
});

// ロゴの字（Kanit の極太の斜体）。数字の書体と分けて、ロゴを看板として立たせる（本人が選んだ、2026-10-11）
const logo = Kanit({
  subsets: ['latin'],
  weight: '800',
  style: 'italic',
  variable: '--font-kanit',
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');

  return {
    metadataBase: new URL('https://jumpslab.kkweb.io'),
    title: { default: t('title'), template: `%s | ${t('title')}` },
    description: t('description'),
    alternates: { canonical: './' },
  };
}

// 下のタブを画面の端まで伸ばし、iPhone のホームバーの分は safe-area で空ける
export const viewport: Viewport = { viewportFit: 'cover' };

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const locale = await getLocale();

  return (
    // 配色は next-themes が描く前に data-theme を書き込むので、そのずれの警告は出さない
    <html
      lang={locale}
      className={`${display.variable} ${logo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full min-w-[375px] font-sans">
        <ThemeProvider>
          <NextIntlClientProvider>{children}</NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
