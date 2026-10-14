import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getAuth } from '@/lib/auth';
import { getProfile, type Profile } from '@/lib/data';

export type Viewer = { userId: string; name: string; email: string; image: string | null };

/**
 * いまログインしている人。いなければ null（ログインの画面へ送る先を、呼ぶ側が決めるとき。招待の画面）。
 * 1回の要求の中では1度だけ確かめる
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  return {
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
  };
});

/**
 * いまログインしている人。いなければログインの画面へ送る。
 * 画面からも Server Action からも呼ぶ。Server Action の引数はブラウザから来るので、
 * 誰の行を書くかは必ずここで決め、引数の id を信じない。
 * 1回の要求の中では1度だけ確かめる
 */
export const requireViewer = cache(async (): Promise<Viewer> => {
  const viewer = await getViewer();
  if (!viewer) redirect('/sign-in');
  return viewer;
});

/**
 * いまの人のプロフィール。まだ作っていなければ、ようこその画面へ送る。
 * 外枠（app/(app)/layout.tsx）も同じ判断で送るが、ページの本体は外枠と並んで動くので、
 * 本体が「ある」と決めつけて読むと、送られる前に落ちてエラーが残った（e2e で見つけた、2026-10-11）
 */
export const requireProfile = cache(async (userId: string): Promise<Profile> => {
  const profile = await getProfile(userId);
  if (!profile) redirect('/welcome');
  return profile;
});
