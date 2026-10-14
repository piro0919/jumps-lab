import { describe, expect, it } from 'vitest';
import { checkSourceUrl, htmlToText, isPublicAddress, SourceError } from '@/lib/fetch-source';

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
