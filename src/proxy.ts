import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * ログインしていない人をログインの画面へ送る。アプリはログインした人だけが使う。
 * Better Auth の Cookie があるかだけを見て、DB には問い合わせない（印が古いときは各画面がセッションを確かめる）。
 * ログインの画面からトップへ送るのはここではしない。印だけ残ってセッションが切れた人を、
 * ログインの画面とトップのあいだで往復させてしまうため（ログインの画面がセッションを確かめて送る）
 */
// 規約とポリシー。ログインの画面と Google の同意画面の審査から踏まれるので、誰でも開ける
const PUBLIC = new Set(['/privacy', '/terms', '/en/privacy', '/en/terms']);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC.has(pathname)) return NextResponse.next();

  const signedIn = getSessionCookie(request) !== null;
  const onSignIn = pathname === '/sign-in';

  if (!signedIn && !onSignIn) return NextResponse.redirect(new URL('/sign-in', request.url));
  return NextResponse.next();
}

// ログインの受け口、Next の配信物、アイコンや OG 画像などは通す
export const config = {
  matcher: [
    '/((?!api/auth|_next/|favicon\\.ico|icon|apple-icon|manifest\\.webmanifest|opengraph-image|robots\\.txt|sitemap\\.xml).*)',
  ],
};
