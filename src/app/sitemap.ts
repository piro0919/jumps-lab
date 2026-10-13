import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/** 英語と日本語の組。英語の LP の正しい URL は /（/en は / へ送る。src/proxy.ts） */
const PAIRS = [
  { en: '/', ja: '/ja', xDefault: true },
  { en: '/en/privacy', ja: '/privacy', xDefault: false },
  { en: '/en/terms', ja: '/terms', xDefault: false },
] as const;

/**
 * 誰でも開けるページだけを載せる。どれも英語と日本語を hreflang で結ぶ。
 * x-default は LP だけ（各ページの metadata の alternates と同じ。規約とポリシーは日本語が正）
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return PAIRS.flatMap(({ en, ja, xDefault }) => {
    const languages = {
      en: `${SITE_URL}${en}`,
      ja: `${SITE_URL}${ja}`,
      ...(xDefault ? { 'x-default': `${SITE_URL}${en}` } : {}),
    };
    return [
      { url: `${SITE_URL}${en}`, alternates: { languages } },
      { url: `${SITE_URL}${ja}`, alternates: { languages } },
    ];
  });
}
