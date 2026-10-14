import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkSourceUrl,
  htmlToText,
  isPublicAddress,
  requestOnce,
  SourceError,
} from '@/lib/fetch-source';

describe('isPublicAddress', () => {
  it('accepts public addresses and refuses private, local and reserved ones', () => {
    const cases = [
      '8.8.8.8',
      '2606:4700:4700::1111',
      '127.0.0.1',
      '10.1.2.3',
      '172.20.0.1',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:127.0.0.1',
      '::ffff:7f00:1',
      'not-an-ip',
    ];
    expect(Object.fromEntries(cases.map((c) => [c, isPublicAddress(c)]))).toEqual({
      '8.8.8.8': true,
      '2606:4700:4700::1111': true,
      '127.0.0.1': false,
      '10.1.2.3': false,
      '172.20.0.1': false,
      '192.168.1.1': false,
      '169.254.169.254': false,
      '100.64.0.1': false,
      '0.0.0.0': false,
      '::1': false,
      'fd00::1': false,
      'fe80::1': false,
      '::ffff:127.0.0.1': false,
      '::ffff:7f00:1': false,
      'not-an-ip': false,
    });
  });
});

describe('checkSourceUrl', () => {
  const kind = (raw: string) => {
    try {
      checkSourceUrl(raw);
      return 'ok';
    } catch (error) {
      return error instanceof SourceError ? error.kind : 'other';
    }
  };

  it('allows plain public http and https pages only', () => {
    const cases = [
      'https://www.example.com/schedule',
      'http://example.jp/a.pdf',
      'ftp://example.com/a',
      'javascript:alert(1)',
      'https://user:pw@example.com/',
      'https://example.com:8080/',
      'http://localhost/',
      'http://intranet/',
      'http://127.0.0.1/',
      'http://[::1]/',
      'http://169.254.169.254/latest/meta-data/',
      'not a url',
    ];
    expect(cases.map(kind)).toEqual([
      'ok',
      'ok',
      'url',
      'url',
      'url',
      'url',
      'url',
      'url',
      'url',
      'url',
      'url',
      'url',
    ]);
  });
});

describe('htmlToText', () => {
  it('keeps table rows, cells and absolute links, and drops scripts', () => {
    const html = `<html><head><title>日程</title><script>var x = 1;</script><style>p{}</style></head>
      <body><table><tr><th>日付</th><th>大会名</th></tr>
      <tr><td>11月1日</td><td><a href="/pdf/youkou.pdf">県選手権&amp;記録会</a></td></tr></table>
      <p>お問い合わせ&nbsp;は<a href="mailto:x@example.com">こちら</a></p></body></html>`;
    expect(htmlToText(html, new URL('https://example.jp/schedule/'))).toBe(
      [
        '日程',
        '日付 | 大会名 |',
        '11月1日 | 県選手権&記録会 (https://example.jp/pdf/youkou.pdf) |',
        'お問い合わせ はこちら',
      ].join('\n'),
    );
  });
});

/**
 * 1回の読み込み（requestOnce）を手元のサーバーで確かめる。IP を直接書いた宛先は名前を引かないので、
 * 公開の宛先かの確かめ（safeLookup）を通らずに手元へ繋がる。本番の入口の checkSourceUrl は IP と番号で止める
 */
describe('requestOnce', () => {
  const servers: Server[] = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((s) => new Promise((done) => s.close(done))));
  });

  async function serve(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<URL> {
    const server = createServer(handler);
    servers.push(server);
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const { port } = server.address() as AddressInfo;
    return new URL(`http://127.0.0.1:${port}/`);
  }

  it('gzip の本文の途中で接続が切られたら、待ち続けずに unreachable で終わる', async () => {
    const url = await serve((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Encoding': 'gzip' });
      res.write(gzipSync(Buffer.alloc(100_000, 'a')).subarray(0, 200));
      setTimeout(() => res.socket?.destroy(), 50);
    });
    const result = await requestOnce(url, AbortSignal.timeout(5_000)).catch(
      (error: unknown) => error,
    );
    expect(result).toBeInstanceOf(SourceError);
    expect((result as SourceError).kind).toBe('unreachable');
  });

  it('全体の時間の上限（signal）で、少しずつ送り続ける相手も切る', async () => {
    const url = await serve((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      const timer = setInterval(() => res.write('a'), 20);
      res.on('close', () => clearInterval(timer));
    });
    const started = Date.now();
    const result = await requestOnce(url, AbortSignal.timeout(300)).catch(
      (error: unknown) => error,
    );
    const elapsed = Date.now() - started;
    expect({ kind: (result as SourceError).kind, fast: elapsed < 2_000 }).toEqual({
      kind: 'unreachable',
      fast: true,
    });
  });

  it('転送の応答は本文を読まずに、頭だけを返す', async () => {
    const url = await serve((_req, res) => {
      res.writeHead(302, { Location: 'https://example.com/next' });
      res.write(Buffer.alloc(1_000_000, 'a'));
      // 本文を終えないので、本文を読み切ろうとすると返らない
    });
    const result = await requestOnce(url, AbortSignal.timeout(2_000));
    expect({
      status: result.status,
      location: result.headers.location,
      size: result.body.length,
    }).toEqual({ status: 302, location: 'https://example.com/next', size: 0 });
  });
});
