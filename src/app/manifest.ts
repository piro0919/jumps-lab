import type { MetadataRoute } from 'next';

/**
 * ホーム画面に置いたときの姿。`display: standalone` でブラウザの URL 欄が消える。
 * `id` を固定しておく。`start_url` を後から変えると別のアプリとして扱われ、入れた人の手元に古い方が残る。
 * アイコンはすねが上の端まで伸びていて、丸く切り抜く端末で欠けるので maskable にはしない。
 * 開いた直後の一瞬に出る色（background_color）はアイコンの青、上の帯の色（theme_color）は画面の地の灰色
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Jumps Lab',
    short_name: 'Jumps Lab',
    description: 'Log your high jump, long jump, triple jump and pole vault marks.',
    scope: '/',
    start_url: '/',
    display: 'standalone',
    background_color: '#1e6fd9',
    theme_color: '#f2f2f7',
    icons: [
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
