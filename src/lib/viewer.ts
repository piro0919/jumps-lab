import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getAuth } from '@/lib/auth';

export type Viewer = { userId: string; name: string; image: string | null };

/**
 * いまログインしている人。いなければログインの画面へ送る。
 * 画面からも Server Action からも呼ぶ。Server Action の引数はブラウザから来るので、
 * 誰の行を書くかは必ずここで決め、引数の id を信じない。
 * 1回の要求の中では1度だけ確かめる
 */
export const requireViewer = cache(async (): Promise<Viewer> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  return {
    userId: session.user.id,
    name: session.user.name,
    image: session.user.image ?? null,
  };
});
