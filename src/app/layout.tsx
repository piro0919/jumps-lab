import { Analytics } from '@vercel/analytics/next';
import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { Progress } from '@/components/progress';
import { ThemeProvider } from '@/components/theme-provider';
import { WindowSize } from '@/components/window-size';
import { SITE_URL } from '@/lib/site';
import { FONT_VARIABLES } from './fonts';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');

  return {
    metadataBase: new URL(SITE_URL),
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
    <html lang={locale} className={`${FONT_VARIABLES} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full min-w-page font-sans">
        <ThemeProvider>
          <NextIntlClientProvider>
            <Progress>{children}</Progress>
            <WindowSize />
          </NextIntlClientProvider>
        </ThemeProvider>
        {/* 閲覧数の集計。Cookie を使わない（プライバシーポリシーの5）。Vercel の画面で有効にするまでは何も送らない */}
        <Analytics />
      </body>
    </html>
  );
}
