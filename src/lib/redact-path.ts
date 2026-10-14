/*
 * アドレスに入った秘密を、外へ送る前に伏せる。ブラウザ（Vercel Web Analytics の beforeSend）と
 * サーバー（Sentry の scrubEvent）の両方から使うので、node: のものを読み込まない
 */

/** 保護者へのリンクの道（/guardian-consent/<鍵>）。鍵1つで同意できてしまう */
const GUARDIAN_PATH = /\/guardian-consent\/[^/?#]+/g;

/**
 * チームの招待の道（/join/<鍵>）。鍵1つでチームに入れてしまう。ログインの画面とようこその画面の
 * ?next= に入ったもの（/ を %2F にしたもの）も拾う
 */
const JOIN_PATH = /(\/|%2F)join(\/|%2F)[A-Za-z0-9_-]+/gi;

/** アドレスや道に入った保護者へのリンクと招待のリンクの鍵を [token] に替える */
export function redactSecretPaths(url: string): string {
  return url
    .replace(GUARDIAN_PATH, '/guardian-consent/[token]')
    .replace(JOIN_PATH, (_match, a: string, b: string) => `${a}join${b}[token]`);
}
