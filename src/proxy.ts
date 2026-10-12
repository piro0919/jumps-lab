import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';
import { PAGE_LOCALE_HEADER } from '@/i18n/locales';

/**
 * ログインしていない人をログインの画面へ送る。アプリはログインした人だけが使う。
 * Better Auth の Cookie があるかだけを見て、DB には問い合わせない（印が古いときは各画面がセッションを確かめる）。
 * ログインの画面からトップへ送るのはここではしない。印だけ残ってセッションが切れた人を、
 * ログインの画面とトップのあいだで往復させてしまうため（ログインの画面がセッションを確かめて送る）。
 *
 * トップ（/）は、ログインしていない人には LP の英語版（中身は /en）を、ログインした人にはホームを出す。
 * 日本語の LP は /ja。LP の言語は URL で決め、ブラウザの言語では変えない（検索に両方を載せるため）
 */
// 規約とポリシー。ログインの画面と Google の同意画面の審査から踏まれるので、誰でも開ける
const PUBLIC = new Set(['/privacy', '/terms', '/en/privacy', '/en/terms']);

/** トップ（/）へ送る。?utm_source などのクエリは残す */
function toTop(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/';
  return NextResponse.redirect(url);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // 言語のヘッダー（src/i18n/request.ts が読む）は LP にだけ付ける。ブラウザから同じ名前で送られてきたものは
  // どのページでも外し、LP ではこちらで付け直す
  const headers = new Headers(request.headers);
  headers.delete(PAGE_LOCALE_HEADER);
  const pass = () => NextResponse.next({ request: { headers } });

  if (PUBLIC.has(pathname)) return pass();

  const signedIn = getSessionCookie(request) !== null;

  // 英語の LP の正しい URL は / なので、/en を直に開いたら / へ
  if (pathname === '/en') return toTop(request);
  if (pathname === '/ja') {
    if (signedIn) return toTop(request);
    headers.set(PAGE_LOCALE_HEADER, 'ja');
    return pass();
  }
  if (pathname === '/' && !signedIn) {
    headers.set(PAGE_LOCALE_HEADER, 'en');
    return NextResponse.rewrite(new URL('/en', request.url), { request: { headers } });
  }

  const onSignIn = pathname === '/sign-in';
  if (!signedIn && !onSignIn) return NextResponse.redirect(new URL('/sign-in', request.url));
  return pass();
}

// ログインの受け口、Next の配信物、アイコンや OG 画像（日本語の LP の /ja/opengraph-image も）、LP の写真（public/landing）などは通す
export const config = {
  matcher: [
    '/((?!api/auth|_next/|landing/|favicon\\.ico|icon|apple-icon|manifest\\.webmanifest|opengraph-image|ja/opengraph-image|robots\\.txt|sitemap\\.xml).*)',
  ],
};
