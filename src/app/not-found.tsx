import { NotFoundView } from '@/components/not-found-view';

/** どの画面にも当たらない URL。ヘッダーの外なので、上にアイコンとロゴを置いてホームへ戻れるようにする */
export default function NotFound() {
  return <NotFoundView frame="bare" />;
}
