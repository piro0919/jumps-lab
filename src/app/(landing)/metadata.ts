import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

/**
 * LP の題と説明。英語は /、日本語は /ja を正しい URL にして、互いを hreflang で結ぶ。
 * 英語の中身は /en にあるが、/en は / へ送る（src/proxy.ts）ので、canonical は / にする
 */
export async function landingMetadata(path: '/' | '/ja'): Promise<Metadata> {
  const t = await getTranslations('landing');

  return {
    title: { absolute: t('metaTitle') },
    description: t('metaDescription'),
    alternates: { canonical: path, languages: { en: '/', ja: '/ja', 'x-default': '/' } },
  };
}
