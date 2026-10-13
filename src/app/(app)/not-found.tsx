import { NotFoundView } from '@/components/not-found-view';

/** ログインの中で、無いページや、消した・ほかの人の記録の id を開いたとき（notFound()）。ヘッダーとタブは残す */
export default function AppNotFound() {
  return <NotFoundView frame="app" />;
}
