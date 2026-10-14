import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * 検索に載せるのは LP（/ と /ja）と規約・ポリシーだけ。アプリの中はログインの画面へ送られるだけなので、
 * クローラーに踏ませない（koidamashii ではクローラーが Neon を一晩中起こしていた。2026-10-13）
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin',
        '/analysis',
        '/attempts',
        '/competitions',
        // 保護者の同意の画面（メールのリンク）。ログインせずに開けるが、検索に載せない
        '/guardian-consent/',
        '/log',
        '/settings',
        '/sign-in',
        '/welcome',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
