import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import './globals.css';
import { Geist } from 'next/font/google';
import { cn } from '@/lib/utils';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

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
    <html lang={locale} className={cn('h-full antialiased', 'font-sans', geist.variable)}>
      <body className="min-h-full min-w-[375px] font-sans">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
