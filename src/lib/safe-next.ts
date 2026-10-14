/**
 * ログインのあとに戻る先（koidamashii の safeNext と同じ作り）。このサイトの中のパスだけを通す。
 *
 * 文字の並びで「//」や「\」を弾くだけでは足りない。URL の読み方はタブと改行を捨てるので、
 * 「/\t/evil.example」は「//evil.example」になって外へ抜ける。実際に URL として読み、
 * 行き先がこのサイトのままのときだけ、読み直したパスを返す
 */
export function safeNext(value: string | null | undefined): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/';
  const base = 'https://jumps-lab.invalid';
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return '/';
  }
  if (url.origin !== base) return '/';
  return `${url.pathname}${url.search}${url.hash}`;
}

/** チームの招待の画面の道（/join/<鍵>）。戻り先として通すのはこの形だけ */
const JOIN_PATH = /^\/join\/[A-Za-z0-9_-]{1,100}$/;

/**
 * ログインとようこその画面のあとに戻る先。チームの招待の画面（/join/<鍵>）だけを通す
 * （招待のリンクからログインした人を、招待の画面へ戻すため。2026-10-14）。ほかは null（いつものトップへ）
 */
export function joinReturnPath(value: string | null | undefined): string | null {
  const path = safeNext(value);
  return JOIN_PATH.test(path) ? path : null;
}
