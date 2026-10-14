/*
 * アドレスに入った秘密を、外へ送る前に伏せる。ブラウザ（Vercel Web Analytics の beforeSend）と
 * サーバー（Sentry の scrubEvent）の両方から使うので、node: のものを読み込まない
 */

/** 保護者へのリンクの道（/guardian-consent/<鍵>）。鍵1つで同意できてしまう */
const GUARDIAN_PATH = /\/guardian-consent\/[^/?#]+/g;

/** アドレスや道に入った保護者へのリンクの鍵を [token] に替える */
export function redactSecretPaths(url: string): string {
  return url.replace(GUARDIAN_PATH, '/guardian-consent/[token]');
}
