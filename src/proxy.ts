import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * ログインしていない人をログインの画面へ送る。アプリはログインした人だけが使う。
 * Better Auth の Cookie があるかだけを見て、DB には問い合わせない（印が古いときは各画面がセッションを確かめる）。
 * ログインの画面に印のある人が来たら、トップへ送る
 */
export function proxy(request: NextRequest) {
  const signedIn = getSessionCookie(request) !== null;
  const onSignIn = request.nextUrl.pathname === '/sign-in';

  if (!signedIn && !onSignIn) return NextResponse.redirect(new URL('/sign-in', request.url));
  if (signedIn && onSignIn) return NextResponse.redirect(new URL('/', request.url));
  return NextResponse.next();
}

// ログインの受け口、Next の配信物、アイコンや OG 画像などは通す
export const config = {
  matcher: [
    '/((?!api/auth|_next/|favicon\\.ico|icon|apple-icon|manifest\\.webmanifest|opengraph-image|robots\\.txt|sitemap\\.xml).*)',
  ],
};
