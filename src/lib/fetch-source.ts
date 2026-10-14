import 'server-only';
import { lookup, type LookupAddress, type LookupOptions } from 'node:dns';
import http, { type IncomingMessage } from 'node:http';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';
import { pipeline } from 'node:stream';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';

/**
 * 大会の取り込みで、選手が貼った URL をサーバーから読む（src/lib/meet-import.ts）。
 * 宛先は選手が決めるので、サーバーの内側（手元・社内の網・クラウドの管理用の宛先）を読ませない:
 * http と https の標準の番号だけ、名前を引いた先が公開の宛先だけ（接続の直前に確かめるので、引き直しで内側へ向け直されても通らない）、
 * 転送は数回まで毎回同じ確かめ、大きさと時間に上限
 */

/** 読む大きさの上限。PDF の要項でも足りる大きさ（仮決め） */
const MAX_BYTES = 8_388_608; // 8MB
/** 読み込みの時間の上限（ミリ秒）。転送をたどる分も含めた全体 */
const TIMEOUT_MS = 15_000;
/** 通信が止まったまま待つ上限（ミリ秒） */
const IDLE_TIMEOUT_MS = 10_000;
/** 転送をたどる回数 */
const MAX_REDIRECTS = 4;
/** AI に渡す本文の字数の上限。日程の表が収まり、費用が膨らまない長さ（仮決め） */
const SOURCE_TEXT_MAX_CHARS = 60_000;
/** 文字コードを探す、HTML の頭の長さ */
const CHARSET_SNIFF_BYTES = 4096;

const HTTP_REDIRECT_MIN = 300;
const HTTP_REDIRECT_MAX = 399;
const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;
const PORTS = new Set(['', '80', '443']);

/** 読めなかった理由。画面にはこの種類だけを返す */
export type SourceErrorKind = 'url' | 'unreachable' | 'tooLarge' | 'type';

export class SourceError extends Error {
  readonly kind: SourceErrorKind;

  constructor(kind: SourceErrorKind, message: string) {
    super(message);
    this.name = 'SourceError';
    this.kind = kind;
  }
}

/** 読んだもの。HTML と文字は本文に直し、PDF と写真はそのまま AI に渡す */
export type FetchedSource =
  | { kind: 'text'; text: string }
  | { kind: 'pdf'; data: Buffer }
  | { kind: 'image'; mimeType: string; data: Buffer };

/** 公開されていない宛先（手元・私設の網・リンクローカル・文書用・マルチキャスト・変換用など） */
const PRIVATE_V4 = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
];
const PRIVATE_V6 = [
  '::/128',
  '::1/128',
  '64:ff9b::/96',
  '64:ff9b:1::/48',
  '100::/64',
  '2001::/32',
  '2001:db8::/32',
  '2002::/16',
  'fc00::/7',
  'fe80::/10',
  'ff00::/8',
];
const PRIVATE = new BlockList();
for (const [list, family] of [
  [PRIVATE_V4, 'ipv4'],
  [PRIVATE_V6, 'ipv6'],
] as const) {
  for (const cidr of list) {
    const [network, prefix] = cidr.split('/');
    PRIVATE.addSubnet(network!, Number(prefix), family);
  }
}

/** isIP の返す版 */
const IPV4 = 4;
const IPV6 = 6;

/** IPv4 を埋め込んだ IPv6（::ffff:10.0.0.1）から IPv4 を取り出す */
const MAPPED = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;

/** 公開の宛先か。分からない形は公開とみなさない */
export function isPublicAddress(address: string): boolean {
  const mapped = MAPPED.exec(address);
  if (mapped) return isPublicAddress(mapped[1]!);
  const family = isIP(address);
  if (family === IPV4) return !PRIVATE.check(address, 'ipv4');
  if (family === IPV6) {
    // ::ffff:0a00:0001 のような16進の書き方の埋め込み
    if (/^::ffff:/i.test(address)) return false;
    return !PRIVATE.check(address, 'ipv6');
  }
  return false;
}

/** 読んでよい URL か（http/https、標準の番号、ID とパスワードを含まない）。読むのは確かめたあと */
export function checkSourceUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new SourceError('url', 'URL として読めません');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SourceError('url', 'http と https だけ読みます');
  }
  if (url.username || url.password) throw new SourceError('url', 'ID 付きの URL は読みません');
  if (!PORTS.has(url.port)) throw new SourceError('url', '標準でない番号は読みません');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !isPublicAddress(host)) {
    throw new SourceError('url', '公開されていない宛先です');
  }
  if (host === 'localhost' || host.endsWith('.localhost') || !host.includes('.')) {
    if (!isIP(host)) throw new SourceError('url', '公開されていない宛先です');
  }
  return url;
}

/** 名前を引き、公開でない宛先が1つでもあれば断る（接続の直前に http が呼ぶ） */
function safeLookup(
  hostname: string,
  options: LookupOptions,
  callback: (
    error: NodeJS.ErrnoException | null,
    address: string | LookupAddress[],
    family?: number,
  ) => void,
): void {
  lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) {
      callback(error, []);
      return;
    }
    if (addresses.length === 0 || addresses.some((a) => !isPublicAddress(a.address))) {
      callback(Object.assign(new Error('公開されていない宛先です'), { code: 'EBLOCKED' }), []);
      return;
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0]!.address, addresses[0]!.family);
  });
}

type Raw = { status: number; headers: IncomingMessage['headers']; body: Buffer };

/** 1回だけ読む（転送はたどらない）。圧縮は解き、上限を超えたら止める。signal で全体の時間を切る */
export function requestOnce(url: URL, signal: AbortSignal): Promise<Raw> {
  const client = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const fail = (error: unknown) => reject(new SourceError('unreachable', String(error)));
    const request = client.get(
      url,
      {
        lookup: safeLookup,
        headers: {
          'User-Agent': 'JumpsLab/1.0 (+https://jumpslab.kkweb.io)',
          Accept: 'text/html,application/xhtml+xml,application/pdf,image/*;q=0.9,*/*;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        // 通信が止まったまま待つ上限。全体の上限は signal
        timeout: IDLE_TIMEOUT_MS,
        signal,
      },
      (response) => {
        const status = response.statusCode ?? 0;
        // 転送なら本文は使わないので、読まずに切る（転送先は頭の location だけで決まる）
        if (status >= HTTP_REDIRECT_MIN && status <= HTTP_REDIRECT_MAX) {
          resolve({ status, headers: response.headers, body: Buffer.alloc(0) });
          response.destroy();
          return;
        }
        const encoding = String(response.headers['content-encoding'] ?? '').toLowerCase();
        const decompress =
          encoding === 'gzip'
            ? createGunzip()
            : encoding === 'deflate'
              ? createInflate()
              : encoding === 'br'
                ? createBrotliDecompress()
                : null;
        // pipe と違い pipeline は、応答そのものの失敗（途中で切られたなど）も受け取れる
        const stream = decompress
          ? pipeline(response, decompress, (error) => {
              if (error) fail(error);
            })
          : response;
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            request.destroy();
            reject(new SourceError('tooLarge', '大きすぎます'));
            return;
          }
          chunks.push(chunk);
        });
        stream.on('end', () =>
          resolve({ status, headers: response.headers, body: Buffer.concat(chunks) }),
        );
        stream.on('error', fail);
      },
    );
    request.on('timeout', () => request.destroy(new Error('時間切れ')));
    request.on('error', fail);
  });
}

/** HTML の meta か、HTTP の頭から文字コードを決める。無ければ UTF-8 */
function charsetOf(contentType: string, body: Buffer): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  if (fromHeader) return fromHeader;
  const head = body.subarray(0, CHARSET_SNIFF_BYTES).toString('latin1');
  return /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ?? 'utf-8';
}

function decode(body: Buffer, charset: string): string {
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder('utf-8').decode(body);
  }
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const value =
        code[1] === 'x' || code[1] === 'X'
          ? Number.parseInt(code.slice(2), 16)
          : Number.parseInt(code.slice(1), 10);
      try {
        return String.fromCodePoint(value);
      } catch {
        return whole;
      }
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/**
 * HTML を、AI に渡す本文にする。表の行と段落は改行、表の枡は「 | 」でつなぎ、リンクは「文字 (URL)」で残す
 * （要項の PDF や申し込みのサイトへのリンクを、大会の entryUrl に使わせるため）
 */
export function htmlToText(html: string, base: URL): string {
  const withoutHidden = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1\s*>/gi, ' ');
  const withLinks = withoutHidden.replace(
    /<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi,
    (_whole, href: string, inner: string) => {
      let absolute: string | null = null;
      try {
        const url = new URL(decodeEntities(href), base);
        if (url.protocol === 'http:' || url.protocol === 'https:') absolute = url.href;
      } catch {
        absolute = null;
      }
      return absolute ? `${inner} (${absolute})` : inner;
    },
  );
  const text = withLinks
    .replace(/<\/(td|th)\s*>/gi, ' | ')
    .replace(/<(br|hr)\b[^>]*>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|table|section|article|dd|dt|caption|title)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/[ \t 　]+/g, ' ').trim())
    .filter((line) => line !== '' && line !== '|')
    .join('\n')
    .slice(0, SOURCE_TEXT_MAX_CHARS);
}

/** PDF の頭の印。種類を名乗らずに返すサイトもあるので、中身でも見分ける */
const PDF_MAGIC = '%PDF-';

export function looksLikePdf(data: Buffer): boolean {
  return data.subarray(0, PDF_MAGIC.length).toString('latin1') === PDF_MAGIC;
}

/** 読める写真の種類（URL の先と、送られたファイルの両方。ブラウザは JPEG に縮めて送り、縮められなかったものはそのまま） */
export const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** URL を読み、本文か PDF か写真にする。読めなければ SourceError */
export async function fetchSource(raw: string): Promise<FetchedSource> {
  let url = checkSourceUrl(raw);
  // 転送をたどる分も含めた、全体の時間の上限
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await requestOnce(url, signal);
    if (response.status >= HTTP_REDIRECT_MIN && response.status <= HTTP_REDIRECT_MAX) {
      const location = response.headers.location;
      if (!location)
        throw new SourceError('unreachable', `転送先がありません (${response.status})`);
      url = checkSourceUrl(new URL(location, url).href);
      continue;
    }
    if (response.status < HTTP_OK_MIN || response.status > HTTP_OK_MAX) {
      throw new SourceError('unreachable', `読めません (${response.status})`);
    }
    const contentType = String(response.headers['content-type'] ?? '').toLowerCase();
    const mimeType = contentType.split(';')[0]!.trim();
    if (mimeType === 'application/pdf' || looksLikePdf(response.body)) {
      return { kind: 'pdf', data: response.body };
    }
    if (IMAGE_TYPES.has(mimeType)) return { kind: 'image', mimeType, data: response.body };
    if (mimeType === 'text/html' || mimeType === 'application/xhtml+xml') {
      const text = htmlToText(decode(response.body, charsetOf(contentType, response.body)), url);
      return { kind: 'text', text };
    }
    if (mimeType === 'text/plain') {
      const text = decode(response.body, charsetOf(contentType, response.body));
      return { kind: 'text', text: text.slice(0, SOURCE_TEXT_MAX_CHARS) };
    }
    throw new SourceError('type', `読めない種類です (${mimeType || '不明'})`);
  }
  throw new SourceError('unreachable', '転送が多すぎます');
}
